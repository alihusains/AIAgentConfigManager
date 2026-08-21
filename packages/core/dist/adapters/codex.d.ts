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
import { AgentAdapter, AgentInfo, AgentConfig, ModelProvider, ModelConfig, MCPServerConfig, PermissionConfig, Platform } from '../types';
interface CodexModelProvider {
    name?: string;
    base_url?: string;
    env_key?: string;
    wire_api?: 'chat' | 'responses';
    requires_openai_auth?: boolean;
    strip_trailing_slash_from_base_url?: boolean;
    http_headers?: Record<string, string>;
    [key: string]: unknown;
}
interface CodexMCPServer {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    http_headers?: Record<string, string>;
    enabled?: boolean;
    enabled_tools?: string[];
    disabled_tools?: string[];
    cwd?: string;
    [key: string]: unknown;
}
interface CodexConfig {
    model?: string;
    model_provider?: string;
    small_model?: string;
    model_providers?: Record<string, CodexModelProvider>;
    mcp_servers?: Record<string, CodexMCPServer>;
    [key: string]: unknown;
}
export declare class CodexAdapter implements AgentAdapter {
    readonly info: AgentInfo;
    protected configPath: string;
    protected configCache: AgentConfig | null;
    protected rawCache: CodexConfig | null;
    constructor();
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
export declare function createCodexAdapter(): CodexAdapter;
export {};
//# sourceMappingURL=codex.d.ts.map