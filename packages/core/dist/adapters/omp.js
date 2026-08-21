"use strict";
/**
 * OMP (Oh My Pi) Adapter — detect-only
 *
 * OMP (https://omp.sh, @oh-my-pi/pi-coding-agent) stores config under
 * ~/.omp/agent/:
 *   - config.yml    modelRoles, defaultThinkingLevel, setupVersion
 *   - models.yml    provider/model routing (YAML)
 *   - settings.yml  tool defaults, rules, extensions
 *
 * All three are YAML. The core's unified materializer speaks JSON/JSONC —
 * writing YAML would mangle anchors/comments — and OMP additionally
 * INHERITS rules/skills/MCP servers from other agents' configs on first run.
 * So this adapter is detect-only:
 *   - binaries: ['omp'] → PATH detection
 *   - readConfig: parses config.yml into customSettings (read-only view)
 *   - writeConfig: throws — AgentConfigManager skips materialization when
 *     neither modelProviders nor mcpServers are supported.
 *
 * Source: https://github.com/can1357/oh-my-pi#readme
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOmpAdapter = createOmpAdapter;
const utils_1 = require("../utils");
const OMP_CONFIG_PATHS = {
    darwin: '~/.omp/agent/config.yml',
    win32: '%USERPROFILE%\\.omp\\agent\\config.yml',
    linux: '~/.omp/agent/config.yml',
};
function createOmpAdapter() {
    const info = {
        id: 'omp',
        name: 'OMP (Oh My Pi)',
        description: 'OMP (Oh My Pi) — battery-included Pi fork (Rust core); YAML config, MCP inherited from other agents.',
        configFormat: 'yaml',
        configPaths: { ...OMP_CONFIG_PATHS },
        supports: {
            modelProviders: false,
            mcpServers: false,
            permissions: false,
            projectConfig: false,
        },
        binaries: ['omp'],
    };
    return {
        info,
        getConfigPath(platform = 'darwin') {
            return (0, utils_1.resolveConfigPath)(info.configPaths[platform], platform);
        },
        async readConfig() {
            const configPath = this.getConfigPath();
            const raw = await (0, utils_1.readFileSafe)(configPath);
            if (raw === null) {
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
            const parsed = (0, utils_1.parseConfig)(raw, 'yaml');
            const config = {
                version: '1.0.0',
                lastModified: Date.now(),
                modelProviders: [],
                models: [],
                mcpServers: [],
                permissions: [],
                customSettings: parsed && typeof parsed === 'object' ? parsed : {},
            };
            const validation = (0, utils_1.validateAgentConfig)(config);
            if (!validation.valid) {
                // YAML config.yml is not the unified schema — never fail reads
                // because of shape drift; surface the config as-is.
                return config;
            }
            return validation.data || config;
        },
        async writeConfig() {
            throw new Error('OMP stores YAML config and inherits MCP servers from other agents — materialization is not supported for this agent (detect-only).');
        },
        validateConfig(config) {
            return (0, utils_1.validateAgentConfig)(config);
        },
        // No managed content for this agent: every operation is a no-op with a
        // clear error, and the manager filters by supports.* before calling.
        listModelProviders() {
            return [];
        },
        async addModelProvider() {
            throw new Error('OMP does not support model provider config (detect-only).');
        },
        async removeModelProvider() {
            throw new Error('OMP does not support model provider config (detect-only).');
        },
        async updateModelProvider() {
            throw new Error('OMP does not support model provider config (detect-only).');
        },
        listModels() {
            return [];
        },
        async addModel() {
            throw new Error('OMP does not support model config (detect-only).');
        },
        async removeModel() {
            throw new Error('OMP does not support model config (detect-only).');
        },
        async updateModel() {
            throw new Error('OMP does not support model config (detect-only).');
        },
        listMCPServers() {
            return [];
        },
        async addMCPServer() {
            throw new Error('OMP inherits MCP servers from other agents (detect-only).');
        },
        async removeMCPServer() {
            throw new Error('OMP inherits MCP servers from other agents (detect-only).');
        },
        async updateMCPServer() {
            throw new Error('OMP inherits MCP servers from other agents (detect-only).');
        },
        listPermissions() {
            return [];
        },
        async addPermission() {
            throw new Error('OMP does not support permission rules (detect-only).');
        },
        async removePermission() {
            throw new Error('OMP does not support permission rules (detect-only).');
        },
        async updatePermission() {
            throw new Error('OMP does not support permission rules (detect-only).');
        },
        async backupConfig() {
            throw new Error('OMP is detect-only; backups are not supported.');
        },
        async restoreConfig() {
            throw new Error('OMP is detect-only; restores are not supported.');
        },
    };
}
//# sourceMappingURL=omp.js.map