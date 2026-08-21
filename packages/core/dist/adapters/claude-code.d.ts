/**
 * Claude Code Adapter
 * Manages configuration for Anthropic's Claude Code CLI
 * Config file: ~/.claude/settings.json (JSON format)
 */
import { AgentAdapter, AgentInfo, AgentConfig, ModelProvider, ModelConfig, MCPServerConfig, PermissionConfig, Platform } from '../types';
export declare class ClaudeCodeAdapter implements AgentAdapter {
    readonly info: AgentInfo;
    private configCache;
    private configPath;
    constructor();
    getConfigPath(platform?: Platform): string;
    readConfig(): Promise<AgentConfig>;
    writeConfig(config: AgentConfig): Promise<void>;
    validateConfig(config: unknown): {
        valid: boolean;
        errors: string[];
    };
    private transformFromClaudeCode;
    private transformToClaudeCode;
    private getDefaultConfig;
    listModelProviders(): ModelProvider[];
    addModelProvider(provider: ModelProvider): Promise<void>;
    removeModelProvider(providerId: string): Promise<void>;
    updateModelProvider(providerId: string, updates: Partial<ModelProvider>): Promise<void>;
    listModels(): ModelConfig[];
    addModel(model: ModelConfig): Promise<void>;
    removeModel(modelId: string): Promise<void>;
    updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void>;
    listMCPServers(): MCPServerConfig[];
    addMCPServer(server: MCPServerConfig): Promise<void>;
    removeMCPServer(serverName: string): Promise<void>;
    updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void>;
    listPermissions(): PermissionConfig[];
    addPermission(permission: PermissionConfig): Promise<void>;
    removePermission(permissionId: string): Promise<void>;
    updatePermission(permissionId: string, updates: Partial<PermissionConfig>): Promise<void>;
    backupConfig(): Promise<string>;
    restoreConfig(backupPath: string): Promise<void>;
}
export declare function createClaudeCodeAdapter(): ClaudeCodeAdapter;
//# sourceMappingURL=claude-code.d.ts.map