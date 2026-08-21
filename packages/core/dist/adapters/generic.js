"use strict";
/**
 * Generic Adapter for "flat-config" agents.
 *
 * Used for user-defined ("custom") agents and for real agents that keep their
 * config in one or two JSON/JSONC files with a simple layout:
 *   - configPath: the main config file (settings, providers + models)
 *   - mcpPath:    optional SEPARATE file where MCP servers live
 *                 (omitted → MCP servers are persisted INSIDE the main file
 *                 under the `mcpServers` key)
 *
 * Two on-disk shapes are supported for MCP servers (configurable via
 * `mcpShape`):
 *   - 'array'  (default, custom agents): mcpServers: [ { name, type, command,
 *              args, env, enabled, ... } ] — the unified core schema
 *   - 'keyed'  (Pi, Junie, Gemini):      mcpServers: { "<name>": { command,
 *              args, env, ... } } — a per-tool object map. command is a
 *              STRING with a separate args[] (never a command array).
 *
 * Unknown top-level keys in existing files are preserved on write, so the
 * adapter is safe to point at files with extra fields (Gemini settings,
 * Pi settings, Junie config, agent-specific extensions...).
 *
 * Per-platform paths: `configPaths` / `mcpConfigPaths` on AgentInfo are the
 * source of truth; getConfigPath() resolves the platform's template at
 * runtime. A single `configPath` option is applied to all platforms when no
 * per-platform map is given (custom agents).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericAdapter = void 0;
exports.createGenericAdapter = createGenericAdapter;
const utils_1 = require("../utils");
const path = __importStar(require("node:path"));
class GenericAdapter {
    info;
    configTemplate;
    mcpTemplate;
    fileFormat;
    mcpShape;
    configCache = null;
    mainRawCache = null;
    mcpRawCache = null;
    constructor(options) {
        this.configTemplate = options.configPath;
        this.mcpTemplate = options.mcpPath || null;
        this.fileFormat = options.format || 'json';
        this.mcpShape = options.mcpShape || 'array';
        const configPaths = {
            darwin: options.configPath,
            win32: options.configPath,
            linux: options.configPath,
            ...(options.configPaths || {}),
        };
        const mcpPaths = options.mcpPath
            ? {
                darwin: options.mcpPath,
                win32: options.mcpPath,
                linux: options.mcpPath,
                ...(options.mcpConfigPaths || {}),
            }
            : undefined;
        const supports = {
            modelProviders: true,
            mcpServers: true,
            permissions: false,
            projectConfig: false,
            ...(options.supports || {}),
        };
        this.info = {
            id: options.id,
            name: options.name,
            description: options.description || 'Custom agent (user-defined config path)',
            configFormat: this.fileFormat,
            configPaths,
            binaries: options.binaries || [],
            supports,
            // Same-file MCP mode: the MCP file IS the main config file
            mcpConfigPaths: mcpPaths || configPaths,
        };
    }
    getConfigPath(platform) {
        const current = platform || this.detectPlatform();
        const template = this.info.configPaths[current] || this.info.configPaths.darwin;
        return (0, utils_1.resolveConfigPath)(template);
    }
    getMCPConfigPath() {
        if (!this.mcpTemplate)
            return null;
        return (0, utils_1.resolveConfigPath)(this.mcpTemplate);
    }
    detectPlatform() {
        if (typeof process !== 'undefined' && process.platform) {
            const p = process.platform;
            if (p === 'darwin')
                return 'darwin';
            if (p === 'win32')
                return 'win32';
            return 'linux';
        }
        return 'darwin';
    }
    // ============================================================================
    // MCP shape conversion (unified array schema <-> per-tool keyed maps)
    // ============================================================================
    mapTransport(type) {
        switch ((type || 'stdio').toLowerCase()) {
            case 'sse':
                return 'sse';
            case 'http':
            case 'stream-http':
            case 'streamable-http':
            case 'remote':
                return 'http';
            default:
                return 'stdio';
        }
    }
    decodeMCPRaw(raw) {
        if (this.mcpShape === 'array') {
            if (!Array.isArray(raw))
                return [];
            return raw
                .filter((e) => Boolean(e) && typeof e === 'object')
                .map((entry) => {
                const { name, ...rest } = entry;
                return {
                    name: name || 'unnamed',
                    ...this.mapToMCPServer(rest),
                };
            });
        }
        // keyed: { "<name>": { command, args, env, ... } }
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return [];
        const out = [];
        for (const [name, entry] of Object.entries(raw)) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry))
                continue;
            out.push({
                name,
                ...this.mapToMCPServer(entry),
            });
        }
        return out;
    }
    isRecord(v) {
        return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
    }
    mapToMCPServer(entry) {
        const command = entry.command;
        const rawType = entry.type;
        return {
            // URL-only entries (pi's drawio/miro/rezi) carry no type — treat them
            // as http transports so the unified model is consistent.
            type: typeof rawType === 'string'
                ? this.mapTransport(rawType)
                : typeof entry.url === 'string'
                    ? 'http'
                    : 'stdio',
            command: Array.isArray(command)
                ? typeof command[0] === 'string'
                    ? command[0]
                    : undefined
                : typeof command === 'string'
                    ? command
                    : undefined,
            args: Array.isArray(command)
                ? command.slice(1)
                : Array.isArray(entry.args)
                    ? entry.args
                    : undefined,
            env: this.isRecord(entry.env) ? entry.env : undefined,
            url: typeof entry.url === 'string' ? entry.url : undefined,
            headers: this.isRecord(entry.headers) ? entry.headers : undefined,
            cwd: typeof entry.cwd === 'string' ? entry.cwd : undefined,
            timeout: typeof entry.timeout === 'number' ? entry.timeout : undefined,
            enabled: entry.enabled !== false,
            approvalMode: entry.approvalMode === 'prompt' || entry.approvalMode === 'auto' || entry.approvalMode === 'never'
                ? entry.approvalMode
                : undefined,
            tools: Array.isArray(entry.tools) ? entry.tools : undefined,
        };
    }
    encodeMCP(servers) {
        if (this.mcpShape === 'array') {
            return servers.map(({ name, ...rest }) => ({ name, ...rest }));
        }
        // keyed per-tool map: { "<name>": {...} }. Existing entries are MERGED
        // so tool-specific keys survive (pi's `directTools`, junie's `type`
        // field) and brand-new servers use the intersection-safe minimal shape:
        // string command + separate args[]; URL entries without a type — every
        // tool in this family (pi/junie/gemini) defaults URL entries to remote.
        const existing = (this.getRawMCPServersObject() || {});
        const out = {};
        for (const s of servers) {
            const prior = existing[s.name] || {};
            if (s.type === 'stdio' && s.command) {
                out[s.name] = {
                    ...prior,
                    command: s.command,
                    ...(s.args && s.args.length ? { args: s.args } : {}),
                    ...(s.env ? { env: s.env } : {}),
                    ...(s.cwd ? { cwd: s.cwd } : {}),
                    ...(s.timeout !== undefined ? { timeout: s.timeout } : {}),
                    ...(s.tools && s.tools.length ? { tools: s.tools } : {}),
                    ...(s.enabled === false ? { enabled: false } : {}),
                };
            }
            else if (s.url) {
                out[s.name] = {
                    ...prior,
                    url: s.url,
                    ...(s.headers ? { headers: s.headers } : {}),
                    ...(s.env ? { env: s.env } : {}),
                    // SSE is the one transport these tools need an explicit type for
                    ...(s.type === 'sse' ? { type: 'sse' } : {}),
                    ...(s.enabled === false ? { enabled: false } : {}),
                };
            }
            else if (Object.keys(prior).length > 0) {
                // No managed fields for this server but it exists on disk — keep it
                // untouched (e.g. a server the tool owns itself).
                out[s.name] = prior;
            }
        }
        return out;
    }
    /**
     * The raw `mcpServers` value on disk (same-file mode reads the main file,
     * separate-file mode reads the MCP file). Used by encodeMCP to merge
     * tool-specific keys without clobbering them.
     */
    getRawMCPServersObject() {
        const raw = this.mcpTemplate ? this.mcpRawCache : this.mainRawCache;
        if (!raw)
            return null;
        const mcp = raw.mcpServers;
        return mcp && typeof mcp === 'object' && !Array.isArray(mcp) ? mcp : null;
    }
    // ============================================================================
    // Config File Operations
    // ============================================================================
    async ensureDir(filePath) {
        await import('node:fs/promises').then(async ({ mkdir }) => {
            const dir = path.dirname(filePath);
            await mkdir(dir, { recursive: true }).catch(() => undefined);
        });
    }
    async readConfig() {
        const configPath = this.getConfigPath();
        const mainContent = await (0, utils_1.readFileSafe)(configPath);
        let modelProviders = [];
        let models = [];
        this.mainRawCache = null;
        if (mainContent) {
            const raw = (0, utils_1.parseConfig)(mainContent, this.fileFormat);
            this.mainRawCache = raw;
            if (Array.isArray(raw.modelProviders))
                modelProviders = raw.modelProviders;
            if (Array.isArray(raw.models))
                models = raw.models;
        }
        let mcpServers = [];
        const mcpPath = this.getMCPConfigPath();
        if (mcpPath) {
            const mcpContent = await (0, utils_1.readFileSafe)(mcpPath);
            if (mcpContent) {
                const raw = (0, utils_1.parseConfig)(mcpContent, this.fileFormat);
                this.mcpRawCache = raw;
                mcpServers = this.decodeMCPRaw(raw.mcpServers);
            }
        }
        else if (this.mainRawCache) {
            // Same-file mode: MCP servers live under `mcpServers` in the main file
            mcpServers = this.decodeMCPRaw(this.mainRawCache.mcpServers);
        }
        const config = {
            version: '1.0.0',
            lastModified: Date.now(),
            modelProviders,
            models,
            mcpServers,
            permissions: [],
            customSettings: {},
        };
        this.configCache = config;
        return config;
    }
    async writeConfig(config) {
        const validation = (0, utils_1.validateAgentConfig)(config);
        if (!validation.valid) {
            throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
        }
        const configPath = this.getConfigPath();
        await this.ensureDir(configPath);
        const mainRaw = this.mainRawCache
            ? JSON.parse(JSON.stringify(this.mainRawCache))
            : {};
        // Keep unknown keys, drop the managed ones (rebuilt below)
        delete mainRaw.modelProviders;
        delete mainRaw.models;
        const main = { ...mainRaw };
        // Only write provider/model keys when the agent's config actually holds
        // them (Pi/Junie/Gemini keep providers managed by their own auth flows —
        // writing empty arrays would pollute their settings files).
        if (this.info.supports.modelProviders) {
            main.modelProviders = config.modelProviders;
            main.models = config.models;
        }
        const mcpPath = this.getMCPConfigPath();
        if (mcpPath) {
            // Separate MCP file: never write mcpServers into the main config
            await this.ensureDir(mcpPath);
            const mcpRaw = this.mcpRawCache
                ? JSON.parse(JSON.stringify(this.mcpRawCache))
                : {};
            delete mcpRaw.mcpServers;
            const mcpFile = {
                ...mcpRaw,
                mcpServers: this.encodeMCP(config.mcpServers),
            };
            await (0, utils_1.backupFile)(mcpPath).catch(() => undefined);
            await (0, utils_1.writeFileSafe)(mcpPath, (0, utils_1.stringifyConfig)(mcpFile, this.fileFormat));
            this.mcpRawCache = mcpFile;
        }
        else if (this.info.supports.mcpServers) {
            // Same-file mode: MCP servers persist inside the main config file
            main.mcpServers = this.encodeMCP(config.mcpServers);
        }
        await (0, utils_1.backupFile)(configPath).catch(() => undefined);
        await (0, utils_1.writeFileSafe)(configPath, (0, utils_1.stringifyConfig)(main, this.fileFormat));
        this.mainRawCache = main;
        this.configCache = config;
    }
    validateConfig(config) {
        return (0, utils_1.validateAgentConfig)(config);
    }
    // ============================================================================
    // Generic read-mutate-write ops
    // ============================================================================
    async mutate(fn) {
        const config = await this.readConfig();
        const result = fn(config);
        config.lastModified = Date.now();
        await this.writeConfig(config);
        return result;
    }
    listModelProviders() {
        if (!this.configCache)
            throw new Error('Config not loaded. Call readConfig() first.');
        return this.configCache.modelProviders;
    }
    addModelProvider(provider) {
        return this.mutate((config) => {
            if (config.modelProviders.some((p) => p.id === provider.id)) {
                throw new Error(`Provider with id "${provider.id}" already exists`);
            }
            config.modelProviders.push(provider);
        }).then(() => undefined);
    }
    removeModelProvider(providerId) {
        return this.mutate((config) => {
            config.modelProviders = config.modelProviders.filter((p) => p.id !== providerId);
            config.models = config.models.filter((m) => m.providerId !== providerId);
        }).then(() => undefined);
    }
    updateModelProvider(providerId, updates) {
        return this.mutate((config) => {
            const index = config.modelProviders.findIndex((p) => p.id === providerId);
            if (index === -1)
                throw new Error(`Provider with id "${providerId}" not found`);
            config.modelProviders[index] = { ...config.modelProviders[index], ...updates };
        }).then(() => undefined);
    }
    listModels() {
        if (!this.configCache)
            throw new Error('Config not loaded. Call readConfig() first.');
        return this.configCache.models;
    }
    addModel(model) {
        return this.mutate((config) => {
            if (config.models.some((m) => m.id === model.id && m.providerId === model.providerId)) {
                throw new Error(`Model "${model.id}" already exists under provider "${model.providerId}"`);
            }
            config.models.push(model);
        }).then(() => undefined);
    }
    removeModel(modelId) {
        return this.mutate((config) => {
            config.models = config.models.filter((m) => m.id !== modelId);
        }).then(() => undefined);
    }
    updateModel(modelId, updates) {
        return this.mutate((config) => {
            const index = config.models.findIndex((m) => m.id === modelId);
            if (index === -1)
                throw new Error(`Model with id "${modelId}" not found`);
            config.models[index] = { ...config.models[index], ...updates };
        }).then(() => undefined);
    }
    listMCPServers() {
        if (!this.configCache)
            throw new Error('Config not loaded. Call readConfig() first.');
        return this.configCache.mcpServers;
    }
    addMCPServer(server) {
        return this.mutate((config) => {
            if (config.mcpServers.some((s) => s.name === server.name)) {
                throw new Error(`MCP server with name "${server.name}" already exists`);
            }
            config.mcpServers.push(server);
        }).then(() => undefined);
    }
    removeMCPServer(serverName) {
        return this.mutate((config) => {
            config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
        }).then(() => undefined);
    }
    updateMCPServer(serverName, updates) {
        return this.mutate((config) => {
            const index = config.mcpServers.findIndex((s) => s.name === serverName);
            if (index === -1)
                throw new Error(`MCP server with name "${serverName}" not found`);
            config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
        }).then(() => undefined);
    }
    // Permissions are not supported for custom agents (unified schema has none)
    listPermissions() {
        return this.configCache?.permissions || [];
    }
    async addPermission() {
        throw new Error(`${this.info.name} does not support permission rules`);
    }
    async removePermission() {
        throw new Error(`${this.info.name} does not support permission rules`);
    }
    async updatePermission() {
        throw new Error(`${this.info.name} does not support permission rules`);
    }
    // ============================================================================
    // Utility
    // ============================================================================
    async backupConfig() {
        return (0, utils_1.backupFile)(this.getConfigPath());
    }
    async restoreConfig(backupPath) {
        const content = await (0, utils_1.readFileSafe)(backupPath);
        if (!content)
            throw new Error(`Backup file not found: ${backupPath}`);
        await (0, utils_1.writeFileSafe)(this.getConfigPath(), content);
        this.configCache = null;
        this.mainRawCache = null;
    }
}
exports.GenericAdapter = GenericAdapter;
/** Factory for a custom agent adapter bound to explicit paths. */
function createGenericAdapter(options) {
    return new GenericAdapter(options);
}
//# sourceMappingURL=generic.js.map