"use strict";
/**
 * OpenCode-style Adapter
 * Manages configuration for OpenCode CLI ("code") and MIMO CLI (mimocode).
 *
 * Both agents share the exact same config schema (MIMO is an OpenCode fork):
 *   - OpenCode:  ~/.config/opencode/opencode.json
 *   - MIMO:      ~/.config/mimocode/mimocode.jsonc
 *
 * Schema (JSONC):
 * {
 *   "$schema": "...",
 *   "provider": {
 *     "<id>": {
 *       "name": "Provider Name",
 *       "env": ["API_KEY_ENV_VAR"],
 *       "npm": "@ai-sdk/openai-compatible",
 *       "options": { "baseURL": "https://...", "apiKey": "...", "headers": {} },
 *       "models": {
 *         "<modelId>": { "name": "Model Name", "limit": {...}, ... }
 *       }
 *     }
 *   },
 *   "model": "<default model id>",
 *   "small_model": "<small model id>",
 *   "disabled_providers": ["<id>"],
 *   "mcp": {
 *     "<name>": {
 *       "type": "local" | "remote" | "sse",
 *       "command": ["npx", "-y", "pkg"],
 *       "url": "https://...",
 *       "enabled": true,
 *       "environmentVariables": {},
 *       "headers": {}
 *     }
 *   }
 * }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenCodeStyleAdapter = void 0;
exports.createOpenCodeAdapter = createOpenCodeAdapter;
exports.createMimoAdapter = createMimoAdapter;
const utils_1 = require("../utils");
// ============================================================================
// Adapter Implementation (parameterized for OpenCode and MIMO)
// ============================================================================
class OpenCodeStyleAdapter {
    info;
    configPath;
    configCache = null;
    rawCache = null;
    isMimo;
    constructor(options) {
        this.isMimo = Boolean(options.isMimo);
        this.info = {
            id: options.id,
            name: options.name,
            description: options.description,
            configFormat: 'jsonc',
            configPaths: options.configPaths,
            // MCP servers live inside the main config (`mcp` key) for this family
            mcpConfigPaths: { ...options.configPaths },
            binaries: options.binaries,
            supports: {
                modelProviders: true,
                mcpServers: true,
                permissions: false,
                projectConfig: false,
            },
        };
        this.configPath = this.getConfigPath();
    }
    getConfigPath(platform) {
        const current = platform || this.detectPlatform();
        const template = this.info.configPaths[current] || this.info.configPaths.darwin;
        return (0, utils_1.resolveConfigPath)(template);
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
        if (typeof navigator !== 'undefined') {
            const ua = navigator.userAgent;
            if (/Mac/i.test(ua))
                return 'darwin';
            if (/Windows/i.test(ua))
                return 'win32';
            return 'linux';
        }
        return 'darwin';
    }
    // ============================================================================
    // Config File Operations
    // ============================================================================
    async readConfig() {
        const content = await (0, utils_1.readFileSafe)(this.configPath);
        if (!content) {
            const config = this.getDefaultConfig();
            this.configCache = config;
            this.rawCache = null;
            return config;
        }
        try {
            const raw = (0, utils_1.parseConfig)(content, 'jsonc');
            const config = this.transformFromRaw(raw);
            this.configCache = config;
            this.rawCache = raw;
            return config;
        }
        catch (error) {
            throw new Error(`Failed to parse ${this.info.name} config: ${error}`);
        }
    }
    async writeConfig(config) {
        const validation = (0, utils_1.validateAgentConfig)(config);
        if (!validation.valid) {
            throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
        }
        // Safety net: keep a timestamped backup before touching the agent's file
        try {
            await (0, utils_1.backupFile)(this.configPath);
        }
        catch {
            // Ignore backup failures (e.g. file doesn't exist yet)
        }
        const raw = this.transformToRaw(config);
        const content = (0, utils_1.stringifyConfig)(raw, 'jsonc');
        await (0, utils_1.writeFileSafe)(this.configPath, content);
        this.configCache = config;
        this.rawCache = raw;
    }
    validateConfig(config) {
        return (0, utils_1.validateAgentConfig)(config);
    }
    // ============================================================================
    // Transform Functions
    // ============================================================================
    transformFromRaw(raw) {
        const modelProviders = [];
        const models = [];
        const mcpServers = [];
        const disabled = new Set(raw.disabled_providers || []);
        const providers = raw.provider || {};
        let priority = 0;
        for (const [id, entry] of Object.entries(providers)) {
            const options = entry.options || {};
            modelProviders.push({
                id,
                name: entry.name || id,
                type: 'openai-compatible',
                config: {
                    baseUrl: options.baseURL,
                    apiKey: options.apiKey,
                    npm: entry.npm,
                    env: entry.env,
                    headers: options.headers,
                    options: options,
                },
                enabled: !disabled.has(id),
                priority: priority++,
            });
            // Models declared under this provider
            for (const [modelId, modelEntry] of Object.entries(entry.models || {})) {
                const { name: displayName, ...rest } = modelEntry;
                models.push({
                    id: modelId,
                    providerId: id,
                    name: modelId,
                    displayName: displayName || modelId,
                    roles: ['chat', 'edit', 'apply', 'summarize'],
                    customOptions: {
                        ...rest,
                        ...(modelEntry.limit ? { limit: modelEntry.limit } : {}),
                    },
                });
            }
        }
        for (const [name, server] of Object.entries(raw.mcp || {})) {
            if (server.command?.length) {
                const [command, ...args] = server.command;
                mcpServers.push({
                    name,
                    type: 'stdio',
                    command,
                    args,
                    env: server.environmentVariables,
                    enabled: server.enabled !== false,
                    tools: server.tools,
                });
            }
            else if (server.url) {
                mcpServers.push({
                    name,
                    type: server.type === 'sse' ? 'sse' : 'http',
                    url: server.url,
                    headers: server.headers,
                    env: server.environmentVariables,
                    enabled: server.enabled !== false,
                    tools: server.tools,
                });
            }
        }
        return {
            version: '1.0.0',
            lastModified: Date.now(),
            modelProviders,
            models,
            mcpServers,
            permissions: [],
            customSettings: {
                model: raw.model,
                smallModel: raw.small_model,
            },
        };
    }
    transformToRaw(config) {
        // Start from the previously-read raw config so unknown keys survive
        const raw = this.rawCache
            ? JSON.parse(JSON.stringify(this.rawCache))
            : {};
        const providers = {};
        for (const provider of config.modelProviders) {
            const existing = raw.provider?.[provider.id];
            const existingOptions = existing?.options || {};
            const baseURL = provider.config.baseUrl || existingOptions.baseURL;
            const apiKey = provider.config.apiKey;
            const entry = {
                name: existing?.name || provider.name,
                env: existing?.env || [this.deriveEnvVar(provider.name || provider.id)],
                npm: existing?.npm || provider.config.npm || '@ai-sdk/openai-compatible',
                options: {
                    ...existingOptions,
                    ...(baseURL ? { baseURL } : {}),
                    ...(apiKey ? { apiKey: apiKey } : {}),
                },
            };
            // Models for this provider
            const modelMap = {};
            for (const model of config.models) {
                if (model.providerId !== provider.id)
                    continue;
                const existingModel = existing?.models?.[model.id] || {};
                modelMap[model.id] = {
                    name: existingModel.name || model.name || model.id,
                    ...existingModel,
                    ...model.customOptions,
                };
            }
            if (Object.keys(modelMap).length > 0) {
                entry.models = modelMap;
            }
            providers[provider.id] = entry;
        }
        const mcp = {};
        for (const server of config.mcpServers) {
            const existing = raw.mcp?.[server.name] || {};
            if (server.type === 'stdio' && server.command) {
                mcp[server.name] = {
                    ...existing,
                    type: existing.type || 'local',
                    command: [server.command, ...(server.args || [])],
                    ...(server.env ? { environmentVariables: server.env } : {}),
                    enabled: server.enabled,
                    ...(server.tools ? { tools: server.tools } : {}),
                };
            }
            else if (server.url) {
                mcp[server.name] = {
                    ...existing,
                    type: server.type === 'sse' ? 'sse' : 'remote',
                    url: server.url,
                    ...(server.headers ? { headers: server.headers } : {}),
                    ...(server.env ? { environmentVariables: server.env } : {}),
                    enabled: server.enabled,
                    ...(server.tools ? { tools: server.tools } : {}),
                };
            }
        }
        const next = {
            ...raw,
            provider: providers,
            mcp,
            model: config.customSettings.model || raw.model,
            small_model: config.customSettings.smallModel || raw.small_model,
        };
        // Recompute disabled providers from unified state
        const disabled = config.modelProviders.filter((p) => !p.enabled).map((p) => p.id);
        if (disabled.length > 0) {
            next.disabled_providers = disabled;
        }
        else {
            delete next.disabled_providers;
        }
        return next;
    }
    deriveEnvVar(name) {
        const cleaned = name
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toUpperCase();
        return `${cleaned || 'PROVIDER'}_API_KEY`;
    }
    getDefaultConfig() {
        return {
            version: '1.0.0',
            lastModified: Date.now(),
            modelProviders: [],
            models: [],
            mcpServers: [],
            permissions: [],
            customSettings: {},
        };
    }
    // ============================================================================
    // Model Provider Operations
    // ============================================================================
    listModelProviders() {
        if (!this.configCache) {
            throw new Error('Config not loaded. Call readConfig() first.');
        }
        return this.configCache.modelProviders;
    }
    async addModelProvider(provider) {
        const config = await this.readConfig();
        const existing = config.modelProviders.find((p) => p.id === provider.id);
        if (existing) {
            throw new Error(`Provider with id "${provider.id}" already exists`);
        }
        config.modelProviders.push(provider);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async removeModelProvider(providerId) {
        const config = await this.readConfig();
        config.modelProviders = config.modelProviders.filter((p) => p.id !== providerId);
        config.models = config.models.filter((m) => m.providerId !== providerId);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async updateModelProvider(providerId, updates) {
        const config = await this.readConfig();
        const index = config.modelProviders.findIndex((p) => p.id === providerId);
        if (index === -1) {
            throw new Error(`Provider with id "${providerId}" not found`);
        }
        config.modelProviders[index] = { ...config.modelProviders[index], ...updates };
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    // ============================================================================
    // Model Operations
    // ============================================================================
    listModels() {
        if (!this.configCache) {
            throw new Error('Config not loaded. Call readConfig() first.');
        }
        return this.configCache.models;
    }
    async addModel(model) {
        const config = await this.readConfig();
        const existing = config.models.find((m) => m.id === model.id && m.providerId === model.providerId);
        if (existing) {
            throw new Error(`Model "${model.id}" already exists under provider "${model.providerId}"`);
        }
        config.models.push(model);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async removeModel(modelId) {
        const config = await this.readConfig();
        config.models = config.models.filter((m) => m.id !== modelId);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async updateModel(modelId, updates) {
        const config = await this.readConfig();
        const index = config.models.findIndex((m) => m.id === modelId);
        if (index === -1) {
            throw new Error(`Model with id "${modelId}" not found`);
        }
        config.models[index] = { ...config.models[index], ...updates };
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    // ============================================================================
    // MCP Server Operations
    // ============================================================================
    listMCPServers() {
        if (!this.configCache) {
            throw new Error('Config not loaded. Call readConfig() first.');
        }
        return this.configCache.mcpServers;
    }
    async addMCPServer(server) {
        const config = await this.readConfig();
        const existing = config.mcpServers.find((s) => s.name === server.name);
        if (existing) {
            throw new Error(`MCP server with name "${server.name}" already exists`);
        }
        config.mcpServers.push(server);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async removeMCPServer(serverName) {
        const config = await this.readConfig();
        config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async updateMCPServer(serverName, updates) {
        const config = await this.readConfig();
        const index = config.mcpServers.findIndex((s) => s.name === serverName);
        if (index === -1) {
            throw new Error(`MCP server with name "${serverName}" not found`);
        }
        config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    // ============================================================================
    // Permission Operations (not supported by this config schema)
    // ============================================================================
    listPermissions() {
        return this.configCache?.permissions || [];
    }
    async addPermission() {
        throw new Error(`${this.info.name} does not support permission rules in its config`);
    }
    async removePermission() {
        throw new Error(`${this.info.name} does not support permission rules in its config`);
    }
    async updatePermission() {
        throw new Error(`${this.info.name} does not support permission rules in its config`);
    }
    // ============================================================================
    // Utility
    // ============================================================================
    async backupConfig() {
        return (0, utils_1.backupFile)(this.configPath);
    }
    async restoreConfig(backupPath) {
        const content = await (0, utils_1.readFileSafe)(backupPath);
        if (!content) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }
        await (0, utils_1.writeFileSafe)(this.configPath, content);
        this.configCache = null;
        this.rawCache = null;
    }
}
exports.OpenCodeStyleAdapter = OpenCodeStyleAdapter;
// ============================================================================
// Factories
// ============================================================================
function createOpenCodeAdapter() {
    return new OpenCodeStyleAdapter({
        id: 'opencode',
        name: 'Code (OpenCode)',
        description: 'OpenCode CLI - open-source AI coding agent ("code" command)',
        binaries: ['opencode'],
        configPaths: {
            darwin: '~/.config/opencode/opencode.json',
            win32: '%APPDATA%\\opencode\\opencode.json',
            linux: '~/.config/opencode/opencode.json',
        },
    });
}
function createMimoAdapter() {
    return new OpenCodeStyleAdapter({
        id: 'mimo',
        name: 'MIMO',
        description: 'MIMO CLI (mimocode) - AI coding agent with project-local config',
        binaries: ['mimo'],
        isMimo: true,
        configPaths: {
            darwin: '~/.config/mimocode/mimocode.jsonc',
            win32: '%APPDATA%\\mimocode\\mimocode.jsonc',
            linux: '~/.config/mimocode/mimocode.jsonc',
        },
    });
}
//# sourceMappingURL=opencode-style.js.map