"use strict";
/**
 * Claude Code Adapter
 * Manages configuration for Anthropic's Claude Code CLI
 * Config file: ~/.claude/settings.json (JSON format)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeAdapter = void 0;
exports.createClaudeCodeAdapter = createClaudeCodeAdapter;
const utils_1 = require("../utils");
// ============================================================================
// Adapter Implementation
// ============================================================================
class ClaudeCodeAdapter {
    info = {
        id: 'claude-code',
        name: 'Claude Code',
        description: 'Anthropic\'s official CLI for Claude',
        configFormat: 'json',
        configPaths: {
            darwin: '~/.claude/settings.json',
            win32: '%USERPROFILE%\\.claude\\settings.json',
            linux: '~/.claude/settings.json',
        },
        binaries: ['claude'],
        supports: {
            modelProviders: true,
            mcpServers: true,
            permissions: true,
            projectConfig: false, // Claude Code uses global config only
        },
    };
    configCache = null;
    configPath = '';
    constructor() {
        this.configPath = this.getConfigPath();
    }
    getConfigPath(platform) {
        const template = this.info.configPaths[platform || process.platform];
        return (0, utils_1.resolveConfigPath)(template);
    }
    // ============================================================================
    // Config File Operations
    // ============================================================================
    async readConfig() {
        const content = await (0, utils_1.readFileSafe)(this.configPath);
        if (!content) {
            // Return default config if file doesn't exist
            const config = this.getDefaultConfig();
            this.configCache = config;
            return config;
        }
        try {
            const rawSettings = (0, utils_1.parseConfig)(content, 'json');
            const config = await this.transformFromClaudeCode(rawSettings);
            this.configCache = config;
            return config;
        }
        catch (error) {
            throw new Error(`Failed to parse Claude Code config: ${error}`);
        }
    }
    async writeConfig(config) {
        const validation = (0, utils_1.validateAgentConfig)(config);
        if (!validation.valid) {
            throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
        }
        const claudeSettings = this.transformToClaudeCode(config);
        const content = (0, utils_1.stringifyConfig)(claudeSettings, 'json');
        await (0, utils_1.writeFileSafe)(this.configPath, content);
        this.configCache = config;
    }
    validateConfig(config) {
        return (0, utils_1.validateAgentConfig)(config);
    }
    // ============================================================================
    // Transform Functions
    // ============================================================================
    async transformFromClaudeCode(settings) {
        const modelProviders = [];
        const models = [];
        const mcpServers = [];
        const permissions = [];
        // Extract model providers from env
        if (settings.env) {
            // Anthropic (default)
            if (settings.env.ANTHROPIC_API_KEY || settings.env.ANTHROPIC_AUTH_TOKEN) {
                modelProviders.push({
                    id: 'anthropic',
                    name: 'Anthropic',
                    type: 'anthropic',
                    config: {
                        apiKey: settings.env.ANTHROPIC_API_KEY || settings.env.ANTHROPIC_AUTH_TOKEN,
                        baseUrl: settings.env.ANTHROPIC_BASE_URL,
                    },
                    enabled: true,
                    priority: 0,
                });
            }
            // Bedrock
            if (settings.env.AWS_REGION || settings.env.AWS_PROFILE) {
                modelProviders.push({
                    id: 'bedrock',
                    name: 'AWS Bedrock',
                    type: 'bedrock',
                    config: {
                        region: settings.env.AWS_REGION,
                        profile: settings.env.AWS_PROFILE,
                    },
                    enabled: true,
                    priority: 1,
                });
            }
            // Vertex AI
            if (settings.env.GOOGLE_CLOUD_PROJECT || settings.env.VERTEX_AI_PROJECT) {
                modelProviders.push({
                    id: 'vertex',
                    name: 'Google Vertex AI',
                    type: 'vertex',
                    config: {
                        project: settings.env.GOOGLE_CLOUD_PROJECT || settings.env.VERTEX_AI_PROJECT,
                        region: settings.env.VERTEX_AI_REGION,
                    },
                    enabled: true,
                    priority: 2,
                });
            }
            // OpenAI-compatible
            if (settings.env.OPENAI_API_KEY && settings.env.OPENAI_API_BASE) {
                modelProviders.push({
                    id: 'openai-compatible',
                    name: 'OpenAI Compatible',
                    type: 'openai-compatible',
                    config: {
                        apiKey: settings.env.OPENAI_API_KEY,
                        baseUrl: settings.env.OPENAI_API_BASE,
                    },
                    enabled: true,
                    priority: 3,
                });
            }
        }
        // Extract models from settings
        if (settings.model) {
            models.push({
                id: 'default',
                providerId: 'anthropic', // default assumption
                name: settings.model,
                displayName: settings.model,
                roles: ['chat', 'edit', 'apply', 'summarize'],
                capabilities: ['tool_use'],
            });
        }
        // Extract MCP servers
        if (settings.mcpServers) {
            for (const [name, server] of Object.entries(settings.mcpServers)) {
                mcpServers.push({
                    ...server,
                    name,
                    enabled: !settings.disabledMcpServers?.includes(name),
                });
            }
        }
        // Merge MCP servers from ~/.claude/mcp.json (Claude Code also reads this file)
        const mcpConfigPath = this.configPath.replace(/settings\.json$/i, 'mcp.json');
        if (mcpConfigPath !== this.configPath) {
            const mcpContent = await (0, utils_1.readFileSafe)(mcpConfigPath);
            if (mcpContent) {
                try {
                    const rawMcp = (0, utils_1.parseConfig)(mcpContent, 'json');
                    for (const [name, server] of Object.entries(rawMcp.mcpServers || {})) {
                        if (!mcpServers.some((s) => s.name === name)) {
                            mcpServers.push({ ...server, name, enabled: true });
                        }
                    }
                }
                catch {
                    // Ignore malformed mcp.json - settings.json remains the source of truth
                }
            }
        }
        // Extract permissions
        if (settings.permissions) {
            let permId = 0;
            for (const pattern of settings.permissions.allow || []) {
                permissions.push({
                    id: `allow-${permId++}`,
                    type: 'tool',
                    scope: 'global',
                    allowed: true,
                    pattern,
                });
            }
            for (const pattern of settings.permissions.deny || []) {
                permissions.push({
                    id: `deny-${permId++}`,
                    type: 'tool',
                    scope: 'global',
                    allowed: false,
                    pattern,
                });
            }
        }
        return {
            version: '1.0.0',
            lastModified: Date.now(),
            modelProviders,
            models,
            mcpServers,
            permissions,
            customSettings: {
                autoUpdatesChannel: settings.autoUpdatesChannel,
                minimumVersion: settings.minimumVersion,
                apiKeyHelper: settings.apiKeyHelper,
            },
        };
    }
    transformToClaudeCode(config) {
        const settings = {
            autoUpdatesChannel: config.customSettings.autoUpdatesChannel,
            minimumVersion: config.customSettings.minimumVersion,
            apiKeyHelper: config.customSettings.apiKeyHelper,
            env: {},
            mcpServers: {},
            disabledMcpServers: [],
            permissions: { allow: [], deny: [], ask: [] },
        };
        // Build env from model providers
        for (const provider of config.modelProviders) {
            if (!provider.enabled)
                continue;
            switch (provider.type) {
                case 'anthropic':
                    if (provider.config.apiKey)
                        settings.env.ANTHROPIC_API_KEY = provider.config.apiKey;
                    if (provider.config.baseUrl)
                        settings.env.ANTHROPIC_BASE_URL = provider.config.baseUrl;
                    break;
                case 'bedrock':
                    if (provider.config.region)
                        settings.env.AWS_REGION = provider.config.region;
                    if (provider.config.profile)
                        settings.env.AWS_PROFILE = provider.config.profile;
                    break;
                case 'vertex':
                    if (provider.config.project)
                        settings.env.GOOGLE_CLOUD_PROJECT = provider.config.project;
                    if (provider.config.region)
                        settings.env.VERTEX_AI_REGION = provider.config.region;
                    break;
                case 'openai-compatible':
                    if (provider.config.apiKey)
                        settings.env.OPENAI_API_KEY = provider.config.apiKey;
                    if (provider.config.baseUrl)
                        settings.env.OPENAI_API_BASE = provider.config.baseUrl;
                    break;
            }
        }
        // Build MCP servers
        for (const server of config.mcpServers) {
            settings.mcpServers[server.name] = server;
            if (!server.enabled) {
                settings.disabledMcpServers.push(server.name);
            }
        }
        // Build permissions
        const permissions = {
            allow: settings.permissions?.allow || [],
            deny: settings.permissions?.deny || [],
            ask: settings.permissions?.ask || [],
        };
        for (const perm of config.permissions) {
            if (perm.allowed) {
                permissions.allow.push(perm.pattern);
            }
            else {
                permissions.deny.push(perm.pattern);
            }
        }
        settings.permissions = permissions;
        // Set default model
        const defaultModel = config.models.find(m => m.id === 'default') || config.models[0];
        if (defaultModel) {
            settings.model = defaultModel.name;
        }
        return settings;
    }
    getDefaultConfig() {
        return {
            version: '1.0.0',
            lastModified: Date.now(),
            modelProviders: [],
            models: [],
            mcpServers: [],
            permissions: [],
            customSettings: {
                autoUpdatesChannel: 'latest',
            },
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
        const existing = config.modelProviders.find(p => p.id === provider.id);
        if (existing) {
            throw new Error(`Provider with id "${provider.id}" already exists`);
        }
        config.modelProviders.push(provider);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async removeModelProvider(providerId) {
        const config = await this.readConfig();
        config.modelProviders = config.modelProviders.filter(p => p.id !== providerId);
        // Also remove models using this provider
        config.models = config.models.filter(m => m.providerId !== providerId);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async updateModelProvider(providerId, updates) {
        const config = await this.readConfig();
        const index = config.modelProviders.findIndex(p => p.id === providerId);
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
        const existing = config.models.find(m => m.id === model.id);
        if (existing) {
            throw new Error(`Model with id "${model.id}" already exists`);
        }
        config.models.push(model);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async removeModel(modelId) {
        const config = await this.readConfig();
        config.models = config.models.filter(m => m.id !== modelId);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async updateModel(modelId, updates) {
        const config = await this.readConfig();
        const index = config.models.findIndex(m => m.id === modelId);
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
        const existing = config.mcpServers.find(s => s.name === server.name);
        if (existing) {
            throw new Error(`MCP server with name "${server.name}" already exists`);
        }
        config.mcpServers.push(server);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async removeMCPServer(serverName) {
        const config = await this.readConfig();
        config.mcpServers = config.mcpServers.filter(s => s.name !== serverName);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async updateMCPServer(serverName, updates) {
        const config = await this.readConfig();
        const index = config.mcpServers.findIndex(s => s.name === serverName);
        if (index === -1) {
            throw new Error(`MCP server with name "${serverName}" not found`);
        }
        config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    // ============================================================================
    // Permission Operations
    // ============================================================================
    listPermissions() {
        if (!this.configCache) {
            throw new Error('Config not loaded. Call readConfig() first.');
        }
        return this.configCache.permissions;
    }
    async addPermission(permission) {
        const config = await this.readConfig();
        const existing = config.permissions.find(p => p.id === permission.id);
        if (existing) {
            throw new Error(`Permission with id "${permission.id}" already exists`);
        }
        config.permissions.push(permission);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async removePermission(permissionId) {
        const config = await this.readConfig();
        config.permissions = config.permissions.filter(p => p.id !== permissionId);
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    async updatePermission(permissionId, updates) {
        const config = await this.readConfig();
        const index = config.permissions.findIndex(p => p.id === permissionId);
        if (index === -1) {
            throw new Error(`Permission with id "${permissionId}" not found`);
        }
        config.permissions[index] = { ...config.permissions[index], ...updates };
        config.lastModified = Date.now();
        await this.writeConfig(config);
    }
    // ============================================================================
    // Utility
    // ============================================================================
    async backupConfig() {
        return (0, utils_1.backupFile)(this.configPath);
    }
    async restoreConfig(backupPath) {
        await (0, utils_1.restoreBackup)(backupPath, this.configPath);
        this.configCache = null; // Clear cache
    }
}
exports.ClaudeCodeAdapter = ClaudeCodeAdapter;
// ============================================================================
// Factory Function
// ============================================================================
function createClaudeCodeAdapter() {
    return new ClaudeCodeAdapter();
}
//# sourceMappingURL=claude-code.js.map