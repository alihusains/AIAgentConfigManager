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
import { AgentAdapter, AgentInfo, AgentConfig, ModelProvider, ModelConfig, MCPServerConfig, PermissionConfig, Platform } from '../types';
interface OpenCodeStyleOptions {
    baseURL?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    [key: string]: unknown;
}
interface OpenCodeStyleModel {
    name?: string;
    attachment?: boolean;
    limit?: {
        context?: number;
        output?: number;
    };
    modalities?: {
        input?: string[];
        output?: string[];
    };
    reasoning?: Record<string, unknown>;
    [key: string]: unknown;
}
interface OpenCodeStyleProvider {
    name?: string;
    env?: string[];
    npm?: string;
    options?: OpenCodeStyleOptions;
    models?: Record<string, OpenCodeStyleModel>;
    [key: string]: unknown;
}
interface OpenCodeStyleMCPServer {
    type?: 'local' | 'remote' | 'http' | 'sse';
    command?: string[];
    url?: string;
    enabled?: boolean;
    environmentVariables?: Record<string, string>;
    headers?: Record<string, string>;
    tools?: string[];
    [key: string]: unknown;
}
interface OpenCodeStyleConfig {
    $schema?: string;
    provider?: Record<string, OpenCodeStyleProvider>;
    model?: string;
    small_model?: string;
    disabled_providers?: string[];
    mcp?: Record<string, OpenCodeStyleMCPServer>;
    [key: string]: unknown;
}
export declare class OpenCodeStyleAdapter implements AgentAdapter {
    readonly info: AgentInfo;
    protected configPath: string;
    protected configCache: AgentConfig | null;
    protected rawCache: OpenCodeStyleConfig | null;
    private readonly isMimo;
    constructor(options: {
        id: string;
        name: string;
        description: string;
        binaries: string[];
        configPaths: Record<Platform, string>;
        isMimo?: boolean;
    });
    getConfigPath(platform?: Platform): string;
    private detectPlatform;
    readConfig(): Promise<AgentConfig>;
    writeConfig(config: AgentConfig): Promise<void>;
    validateConfig(config: unknown): {
        valid: boolean;
        errors: string[];
    };
    private transformFromRaw;
    private transformToRaw;
    private deriveEnvVar;
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
    addPermission(): Promise<void>;
    removePermission(): Promise<void>;
    updatePermission(): Promise<void>;
    backupConfig(): Promise<string>;
    restoreConfig(backupPath: string): Promise<void>;
}
export declare function createOpenCodeAdapter(): OpenCodeStyleAdapter;
export declare function createMimoAdapter(): OpenCodeStyleAdapter;
export {};
//# sourceMappingURL=opencode-style.d.ts.map