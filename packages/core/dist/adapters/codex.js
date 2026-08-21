"use strict";
/**
 * Codex CLI Adapter (ChatGPT family)
 * Manages configuration for OpenAI's Codex CLI / ChatGPT CLI.
 *
 * Config file: ~/.codex/config.toml (TOML format)
 * The directory can be overridden with the CODEX_HOME environment variable.
 *
 * Schema (TOML):
 *   model = "gpt-5-codex"
 *   model_provider = "provider-id"
 *
 *   [model_providers."provider-id"]
 *   name = "Provider Name"
 *   base_url = "https://api.example.com"
 *   env_key = "PROVIDER_API_KEY"
 *   wire_api = "chat" | "responses"
 *   requires_openai_auth = false
 *   http_headers = { Header = "value" }
 *
 *   [mcp_servers."server-id"]
 *   command = "npx"
 *   args = ["-y", "pkg"]
 *   env = { KEY = "value" }
 *   url = "https://mcp.example.com/mcp"
 *   http_headers = { Header = "value" }
 *   enabled = true
 *   enabled_tools = ["tool1"]
 *   disabled_tools = []
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexAdapter = void 0;
exports.createCodexAdapter = createCodexAdapter;
const utils_1 = require("../utils");
// ============================================================================
// Adapter Implementation
// ============================================================================
class CodexAdapter {
    info = {
        id: 'chatgpt',
        name: 'ChatGPT / Codex',
        description: 'OpenAI Codex CLI (ChatGPT family) - terminal coding agent from OpenAI',
        configFormat: 'toml',
        configPaths: {
            darwin: '~/.codex/config.toml',
            win32: '%USERPROFILE%\\.codex\\config.toml',
            linux: '~/.codex/config.toml',
        },
        binaries: ['codex', 'chatgpt'],
        supports: {
            modelProviders: true,
            mcpServers: true,
            permissions: false,
            projectConfig: false,
        },
    };
    configPath;
    configCache = null;
    rawCache = null;
    constructor() {
        this.configPath = this.getConfigPath();
    }
    getConfigPath(platform) {
        // CODEX_HOME overrides the config directory
        if (typeof process !== 'undefined' && process.env?.CODEX_HOME) {
            const base = process.env.CODEX_HOME;
            const isWin = platform === 'win32' ||
                (typeof process !== 'undefined' && process.platform === 'win32');
            return `${base}${isWin ? '\\' : '/'}config.toml`;
        }
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
            const raw = (0, utils_1.parseConfig)(content, 'toml');
            const config = this.transformFromRaw(raw);
            this.configCache = config;
            this.rawCache = raw;
            return config;
        }
        catch (error) {
            throw new Error(`Failed to parse Codex config: ${error}`);
        }
    }
    async writeConfig(config) {
        const validation = (0, utils_1.validateAgentConfig)(config);
        if (!validation.valid) {
            throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
        }
        try {
            await (0, utils_1.backupFile)(this.configPath);
        }
        catch {
            // Ignore backup failures (e.g. file doesn't exist yet)
        }
        const raw = this.transformToRaw(config);
        const content = (0, utils_1.stringifyConfig)(raw, 'toml');
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
        let priority = 0;
        for (const [id, entry] of Object.entries(raw.model_providers || {})) {
            modelProviders.push({
                id,
                name: entry.name || id,
                type: 'openai-compatible',
                config: {
                    baseUrl: entry.base_url,
                    apiKeyEnvVar: entry.env_key,
                    wireApi: entry.wire_api,
                    requiresOpenaiAuth: entry.requires_openai_auth,
                    httpHeaders: entry.http_headers,
                    provider: entry,
                },
                enabled: true,
                priority: priority++,
            });
        }
        // Codex does not declare model lists in the config; the `model` and
        // `small_model` keys name (possibly qualified) models directly.
        const defaultProviderId = raw.model_provider ||
            (modelProviders.length > 0 ? modelProviders[0].id : 'openai');
        if (raw.model) {
            models.push({
                id: 'default',
                providerId: defaultProviderId,
                name: raw.model,
                displayName: raw.model,
                roles: ['chat', 'edit', 'apply', 'summarize'],
            });
        }
        if (raw.small_model) {
            models.push({
                id: 'small',
                providerId: defaultProviderId,
                name: raw.small_model,
                displayName: raw.small_model,
                roles: ['autocomplete', 'summarize'],
            });
        }
        const mcpServers = [];
        for (const [name, server] of Object.entries(raw.mcp_servers || {})) {
            const unified = {
                name,
                type: server.url ? 'http' : 'stdio',
                command: server.command,
                args: server.args,
                env: server.env,
                url: server.url,
                headers: server.http_headers,
                cwd: server.cwd,
                enabled: server.enabled !== false,
                tools: server.enabled_tools || (server.disabled_tools ? [] : undefined),
            };
            // Keep the raw entry on a side channel so unknown keys survive a round-trip
            unified._raw = server;
            mcpServers.push(unified);
        }
        return {
            version: '1.0.0',
            lastModified: Date.now(),
            modelProviders,
            models,
            mcpServers,
            permissions: [],
            customSettings: {
                approvalPolicy: raw.approval_policy,
                sandboxMode: raw.sandbox_mode,
                disableSandbox: raw.disable_sandbox,
                notifications: raw.notifications,
            },
        };
    }
    transformToRaw(config) {
        const raw = this.rawCache
            ? JSON.parse(JSON.stringify(this.rawCache))
            : {};
        // Rebuild model_providers from the unified list (merging unknown keys)
        const model_providers = {};
        for (const provider of config.modelProviders) {
            const existing = this.rawCache?.model_providers?.[provider.id];
            const entry = {
                ...existing,
                name: existing?.name || provider.name,
            };
            const cfg = provider.config;
            const baseUrl = cfg.baseUrl || existing?.base_url;
            const envKey = cfg.apiKeyEnvVar || existing?.env_key;
            const wireApi = cfg.wireApi || existing?.wire_api;
            const requiresAuth = cfg.requiresOpenaiAuth ?? existing?.requires_openai_auth;
            const headers = cfg.httpHeaders || existing?.http_headers;
            if (baseUrl)
                entry.base_url = baseUrl;
            if (envKey)
                entry.env_key = envKey;
            if (wireApi)
                entry.wire_api = wireApi;
            if (typeof requiresAuth === 'boolean')
                entry.requires_openai_auth = requiresAuth;
            if (headers)
                entry.http_headers = headers;
            model_providers[provider.id] = entry;
        }
        // Default model + provider selection
        const defaultModel = config.models.find((m) => m.id === 'default') || config.models[0];
        const smallModel = config.models.find((m) => m.id === 'small');
        const defaultProviderId = config.models
            .find((m) => m.id === 'default')
            ?.providerId || config.modelProviders[0]?.id || raw.model_provider;
        const mcp_servers = {};
        for (const server of config.mcpServers) {
            const existing = this.rawCache?.mcp_servers?.[server.name] ||
                server._raw;
            const entry = { ...existing };
            if (server.type === 'stdio' && server.command) {
                entry.command = server.command;
                if (server.args)
                    entry.args = server.args;
            }
            if (server.url)
                entry.url = server.url;
            if (server.env)
                entry.env = server.env;
            if (server.headers)
                entry.http_headers = server.headers;
            if (server.cwd)
                entry.cwd = server.cwd;
            entry.enabled = server.enabled;
            if (server.tools)
                entry.enabled_tools = server.tools;
            // Strip internal side channel
            delete entry._raw;
            mcp_servers[server.name] = entry;
        }
        const next = {
            ...raw,
            ...(defaultModel ? { model: defaultModel.name } : {}),
            ...(defaultProviderId ? { model_provider: defaultProviderId } : {}),
            ...(smallModel ? { small_model: smallModel.name } : {}),
            model_providers,
            mcp_servers,
        };
        // Canonical key order so the TOML serializer emits scalars before tables
        return sortForTOML(next);
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
        const existing = config.models.find((m) => m.id === model.id);
        if (existing) {
            throw new Error(`Model with id "${model.id}" already exists`);
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
    // Permission Operations (not supported by Codex config)
    // ============================================================================
    listPermissions() {
        return this.configCache?.permissions || [];
    }
    async addPermission() {
        throw new Error('Codex CLI does not support permission rules in its config file');
    }
    async removePermission() {
        throw new Error('Codex CLI does not support permission rules in its config file');
    }
    async updatePermission() {
        throw new Error('Codex CLI does not support permission rules in its config file');
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
exports.CodexAdapter = CodexAdapter;
// ============================================================================
// Factory
// ============================================================================
function createCodexAdapter() {
    return new CodexAdapter();
}
// ============================================================================
// TOML key ordering helper
// ============================================================================
/**
 * Reorders object keys so plain (nested) objects are emitted AFTER scalars
 * and arrays. The simple TOML serializer writes nested objects as `[section]`
 * headers; emitting a section header before a sibling scalar key would make the
 * scalar land inside the wrong section.
 */
function sortForTOML(value) {
    if (Array.isArray(value)) {
        return value.map(sortForTOML);
    }
    if (value && typeof value === 'object') {
        const obj = value;
        const entries = Object.entries(obj).map(([k, v]) => [k, sortForTOML(v)]);
        const isPlainSection = entries.some(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
        if (!isPlainSection)
            return value;
        const scalars = entries.filter(([, v]) => !v || typeof v !== 'object' || Array.isArray(v));
        const sections = entries.filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
        const sortedEntries = [...scalars, ...sections];
        const out = {};
        for (const [k, v] of sortedEntries)
            out[k] = v;
        return out;
    }
    return value;
}
//# sourceMappingURL=codex.js.map