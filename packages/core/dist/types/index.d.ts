/**
 * Core type definitions for AI Agent Config Manager
 * Provides a unified interface for managing configurations across different AI agents
 */
import { z } from 'zod';
export type ConfigFormat = 'json' | 'jsonc' | 'yaml' | 'toml';
export type Platform = 'darwin' | 'win32' | 'linux';
export interface AgentInfo {
    id: string;
    name: string;
    description: string;
    configFormat: ConfigFormat;
    configPaths: Record<Platform, string>;
    supports: AgentCapabilities;
    /** CLI binary name(s) used to detect whether this agent is installed (e.g. ["claude"], ["codex", "chatgpt"]) */
    binaries: string[];
    /**
     * Optional per-platform path(s) of the file holding MCP server config.
     * Same as configPaths when MCP servers live inside the main config file
     * (e.g. Gemini, OpenCode); a separate file otherwise (e.g. Junie's
     * ~/.junie/mcp/mcp.json). Used by the GUI to surface where MCP servers
     * are written.
     */
    mcpConfigPaths?: Record<Platform, string>;
}
/**
 * Runtime detection result for an agent CLI.
 * Filled in by AgentConfigManager.detectAgents() / detectAgent().
 */
export interface AgentDetection {
    /** Whether the agent's CLI binary was found on PATH */
    installed: boolean;
    /** Whether the agent's config file exists on disk */
    configExists: boolean;
    /** Where the binary was found (e.g. /usr/local/bin/claude), if any */
    binaryPath?: string;
    /** Version string reported by the CLI, if it could be queried */
    version?: string;
    /** How detection was performed */
    method: 'command' | 'config' | 'assumed';
    /** Error encountered during detection, if any */
    error?: string;
}
export interface AgentCapabilities {
    modelProviders: boolean;
    mcpServers: boolean;
    permissions: boolean;
    projectConfig: boolean;
}
export interface ModelProvider {
    id: string;
    name: string;
    type: 'builtin' | 'custom' | 'openai-compatible' | 'anthropic' | 'google' | 'azure' | 'bedrock' | 'vertex';
    config: Record<string, unknown>;
    enabled: boolean;
    priority: number;
}
export interface ModelConfig {
    id: string;
    providerId: string;
    name: string;
    displayName: string;
    roles: ModelRole[];
    contextLength?: number;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    capabilities?: ModelCapability[];
    customOptions?: Record<string, unknown>;
}
export type ModelRole = 'chat' | 'edit' | 'apply' | 'summarize' | 'autocomplete' | 'embed' | 'rerank';
export type ModelCapability = 'tool_use' | 'image_input' | 'reasoning' | 'vision' | 'code_generation';
export interface MCPServerConfig {
    name: string;
    type: 'stdio' | 'http' | 'sse' | 'streamable-http';
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    cwd?: string;
    timeout?: number;
    enabled: boolean;
    approvalMode?: 'prompt' | 'auto' | 'never';
    tools?: string[];
}
export interface MCPServerStatus {
    name: string;
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    tools?: MCPTool[];
    error?: string;
}
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    annotations?: MCPToolAnnotations;
}
export interface MCPToolAnnotations {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}
export interface PermissionConfig {
    id: string;
    type: 'tool' | 'directory' | 'url' | 'command' | 'mcp' | 'custom';
    scope: 'global' | 'project';
    projectPath?: string;
    allowed: boolean;
    pattern: string;
    description?: string;
    metadata?: Record<string, unknown>;
}
export interface AgentConfig {
    version: string;
    lastModified: number;
    modelProviders: ModelProvider[];
    models: ModelConfig[];
    mcpServers: MCPServerConfig[];
    permissions: PermissionConfig[];
    customSettings: Record<string, unknown>;
}
export interface AgentAdapter {
    readonly info: AgentInfo;
    getConfigPath(platform?: Platform): string;
    readConfig(): Promise<AgentConfig>;
    writeConfig(config: AgentConfig): Promise<void>;
    validateConfig(config: unknown): {
        valid: boolean;
        errors: string[];
    };
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
export interface OperationResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
    warnings?: string[];
}
export interface BatchOperationResult {
    results: OperationResult[];
    summary: {
        total: number;
        succeeded: number;
        failed: number;
    };
}
export interface CLICommand {
    name: string;
    description: string;
    args: CLIArg[];
    options: CLIOption[];
    handler: (args: Record<string, string>, options: Record<string, unknown>) => Promise<OperationResult>;
}
export interface CLIArg {
    name: string;
    description: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean';
}
export interface CLIOption {
    name: string;
    alias?: string;
    description: string;
    type: 'string' | 'number' | 'boolean';
    default?: unknown;
}
export interface GUIState {
    selectedAgent: string | null;
    selectedAgents: string[];
    agents: AgentInfo[];
    config: AgentConfig | null;
    isLoading: boolean;
    error: string | null;
    view: 'dashboard' | 'models' | 'mcp' | 'permissions' | 'settings';
}
export interface GUINotification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    action?: {
        label: string;
        handler: () => void;
    };
}
export declare const ModelProviderSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["builtin", "custom", "openai-compatible", "anthropic", "google", "azure", "bedrock", "vertex"]>;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    enabled: z.ZodBoolean;
    priority: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    config: Record<string, unknown>;
    id: string;
    name: string;
    type: "builtin" | "custom" | "openai-compatible" | "anthropic" | "google" | "azure" | "bedrock" | "vertex";
    enabled: boolean;
    priority: number;
}, {
    config: Record<string, unknown>;
    id: string;
    name: string;
    type: "builtin" | "custom" | "openai-compatible" | "anthropic" | "google" | "azure" | "bedrock" | "vertex";
    enabled: boolean;
    priority: number;
}>;
export declare const ModelConfigSchema: z.ZodObject<{
    id: z.ZodString;
    providerId: z.ZodString;
    name: z.ZodString;
    displayName: z.ZodString;
    roles: z.ZodArray<z.ZodEnum<["chat", "edit", "apply", "summarize", "autocomplete", "embed", "rerank"]>, "many">;
    contextLength: z.ZodOptional<z.ZodNumber>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    capabilities: z.ZodOptional<z.ZodArray<z.ZodEnum<["tool_use", "image_input", "reasoning", "vision", "code_generation"]>, "many">>;
    customOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    providerId: string;
    displayName: string;
    roles: ("chat" | "edit" | "apply" | "summarize" | "autocomplete" | "embed" | "rerank")[];
    contextLength?: number | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    capabilities?: ("tool_use" | "image_input" | "reasoning" | "vision" | "code_generation")[] | undefined;
    customOptions?: Record<string, unknown> | undefined;
}, {
    id: string;
    name: string;
    providerId: string;
    displayName: string;
    roles: ("chat" | "edit" | "apply" | "summarize" | "autocomplete" | "embed" | "rerank")[];
    contextLength?: number | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    topP?: number | undefined;
    capabilities?: ("tool_use" | "image_input" | "reasoning" | "vision" | "code_generation")[] | undefined;
    customOptions?: Record<string, unknown> | undefined;
}>;
export declare const MCPServerConfigSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["stdio", "http", "sse", "streamable-http"]>;
    command: z.ZodOptional<z.ZodString>;
    args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    url: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    cwd: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodNumber>;
    enabled: z.ZodBoolean;
    approvalMode: z.ZodOptional<z.ZodEnum<["prompt", "auto", "never"]>>;
    tools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "stdio" | "http" | "sse" | "streamable-http";
    enabled: boolean;
    command?: string | undefined;
    url?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    cwd?: string | undefined;
    timeout?: number | undefined;
    approvalMode?: "prompt" | "auto" | "never" | undefined;
    tools?: string[] | undefined;
}, {
    name: string;
    type: "stdio" | "http" | "sse" | "streamable-http";
    enabled: boolean;
    command?: string | undefined;
    url?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    cwd?: string | undefined;
    timeout?: number | undefined;
    approvalMode?: "prompt" | "auto" | "never" | undefined;
    tools?: string[] | undefined;
}>;
export declare const PermissionConfigSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["tool", "directory", "url", "command", "mcp", "custom"]>;
    scope: z.ZodEnum<["global", "project"]>;
    projectPath: z.ZodOptional<z.ZodString>;
    allowed: z.ZodBoolean;
    pattern: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "command" | "custom" | "tool" | "directory" | "url" | "mcp";
    scope: "global" | "project";
    allowed: boolean;
    pattern: string;
    projectPath?: string | undefined;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    id: string;
    type: "command" | "custom" | "tool" | "directory" | "url" | "mcp";
    scope: "global" | "project";
    allowed: boolean;
    pattern: string;
    projectPath?: string | undefined;
    description?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const AgentConfigSchema: z.ZodObject<{
    version: z.ZodString;
    lastModified: z.ZodNumber;
    modelProviders: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["builtin", "custom", "openai-compatible", "anthropic", "google", "azure", "bedrock", "vertex"]>;
        config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        enabled: z.ZodBoolean;
        priority: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        config: Record<string, unknown>;
        id: string;
        name: string;
        type: "builtin" | "custom" | "openai-compatible" | "anthropic" | "google" | "azure" | "bedrock" | "vertex";
        enabled: boolean;
        priority: number;
    }, {
        config: Record<string, unknown>;
        id: string;
        name: string;
        type: "builtin" | "custom" | "openai-compatible" | "anthropic" | "google" | "azure" | "bedrock" | "vertex";
        enabled: boolean;
        priority: number;
    }>, "many">;
    models: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        providerId: z.ZodString;
        name: z.ZodString;
        displayName: z.ZodString;
        roles: z.ZodArray<z.ZodEnum<["chat", "edit", "apply", "summarize", "autocomplete", "embed", "rerank"]>, "many">;
        contextLength: z.ZodOptional<z.ZodNumber>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
        temperature: z.ZodOptional<z.ZodNumber>;
        topP: z.ZodOptional<z.ZodNumber>;
        capabilities: z.ZodOptional<z.ZodArray<z.ZodEnum<["tool_use", "image_input", "reasoning", "vision", "code_generation"]>, "many">>;
        customOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        providerId: string;
        displayName: string;
        roles: ("chat" | "edit" | "apply" | "summarize" | "autocomplete" | "embed" | "rerank")[];
        contextLength?: number | undefined;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
        topP?: number | undefined;
        capabilities?: ("tool_use" | "image_input" | "reasoning" | "vision" | "code_generation")[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }, {
        id: string;
        name: string;
        providerId: string;
        displayName: string;
        roles: ("chat" | "edit" | "apply" | "summarize" | "autocomplete" | "embed" | "rerank")[];
        contextLength?: number | undefined;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
        topP?: number | undefined;
        capabilities?: ("tool_use" | "image_input" | "reasoning" | "vision" | "code_generation")[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }>, "many">;
    mcpServers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["stdio", "http", "sse", "streamable-http"]>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        url: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        timeout: z.ZodOptional<z.ZodNumber>;
        enabled: z.ZodBoolean;
        approvalMode: z.ZodOptional<z.ZodEnum<["prompt", "auto", "never"]>>;
        tools: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "stdio" | "http" | "sse" | "streamable-http";
        enabled: boolean;
        command?: string | undefined;
        url?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        cwd?: string | undefined;
        timeout?: number | undefined;
        approvalMode?: "prompt" | "auto" | "never" | undefined;
        tools?: string[] | undefined;
    }, {
        name: string;
        type: "stdio" | "http" | "sse" | "streamable-http";
        enabled: boolean;
        command?: string | undefined;
        url?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        cwd?: string | undefined;
        timeout?: number | undefined;
        approvalMode?: "prompt" | "auto" | "never" | undefined;
        tools?: string[] | undefined;
    }>, "many">;
    permissions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["tool", "directory", "url", "command", "mcp", "custom"]>;
        scope: z.ZodEnum<["global", "project"]>;
        projectPath: z.ZodOptional<z.ZodString>;
        allowed: z.ZodBoolean;
        pattern: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "command" | "custom" | "tool" | "directory" | "url" | "mcp";
        scope: "global" | "project";
        allowed: boolean;
        pattern: string;
        projectPath?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        id: string;
        type: "command" | "custom" | "tool" | "directory" | "url" | "mcp";
        scope: "global" | "project";
        allowed: boolean;
        pattern: string;
        projectPath?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">;
    customSettings: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    models: {
        id: string;
        name: string;
        providerId: string;
        displayName: string;
        roles: ("chat" | "edit" | "apply" | "summarize" | "autocomplete" | "embed" | "rerank")[];
        contextLength?: number | undefined;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
        topP?: number | undefined;
        capabilities?: ("tool_use" | "image_input" | "reasoning" | "vision" | "code_generation")[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }[];
    permissions: {
        id: string;
        type: "command" | "custom" | "tool" | "directory" | "url" | "mcp";
        scope: "global" | "project";
        allowed: boolean;
        pattern: string;
        projectPath?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    version: string;
    lastModified: number;
    modelProviders: {
        config: Record<string, unknown>;
        id: string;
        name: string;
        type: "builtin" | "custom" | "openai-compatible" | "anthropic" | "google" | "azure" | "bedrock" | "vertex";
        enabled: boolean;
        priority: number;
    }[];
    mcpServers: {
        name: string;
        type: "stdio" | "http" | "sse" | "streamable-http";
        enabled: boolean;
        command?: string | undefined;
        url?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        cwd?: string | undefined;
        timeout?: number | undefined;
        approvalMode?: "prompt" | "auto" | "never" | undefined;
        tools?: string[] | undefined;
    }[];
    customSettings: Record<string, unknown>;
}, {
    models: {
        id: string;
        name: string;
        providerId: string;
        displayName: string;
        roles: ("chat" | "edit" | "apply" | "summarize" | "autocomplete" | "embed" | "rerank")[];
        contextLength?: number | undefined;
        maxTokens?: number | undefined;
        temperature?: number | undefined;
        topP?: number | undefined;
        capabilities?: ("tool_use" | "image_input" | "reasoning" | "vision" | "code_generation")[] | undefined;
        customOptions?: Record<string, unknown> | undefined;
    }[];
    permissions: {
        id: string;
        type: "command" | "custom" | "tool" | "directory" | "url" | "mcp";
        scope: "global" | "project";
        allowed: boolean;
        pattern: string;
        projectPath?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    version: string;
    lastModified: number;
    modelProviders: {
        config: Record<string, unknown>;
        id: string;
        name: string;
        type: "builtin" | "custom" | "openai-compatible" | "anthropic" | "google" | "azure" | "bedrock" | "vertex";
        enabled: boolean;
        priority: number;
    }[];
    mcpServers: {
        name: string;
        type: "stdio" | "http" | "sse" | "streamable-http";
        enabled: boolean;
        command?: string | undefined;
        url?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        cwd?: string | undefined;
        timeout?: number | undefined;
        approvalMode?: "prompt" | "auto" | "never" | undefined;
        tools?: string[] | undefined;
    }[];
    customSettings: Record<string, unknown>;
}>;
/**
 * Per-agent tweaks applied on top of the shared server definition when it is
 * materialized into an agent's config file. Agents read real files, so the
 * shared definition must be adapted per agent when formats differ.
 */
export interface MCPServerAgentOverride {
    enabled?: boolean;
    env?: Record<string, string>;
    args?: string[];
    timeout?: number;
    approvalMode?: MCPServerConfig['approvalMode'];
    tools?: string[];
}
/**
 * The two OpenAI-style wire protocols a provider gateway may expose:
 * - "chat"      → POST {base}/chat/completions (the classic Chat Completions API)
 * - "responses" → POST {base}/responses (the newer Responses API)
 *
 * Some providers — e.g. ChatGPT accounts — have removed chat completions and
 * answer only on the responses route. Verification records which kinds an
 * endpoint really supports so the dashboard can say "Chat ✓ / Responses ✗".
 */
export type ProviderApiKind = 'chat' | 'responses';
/** Outcome of probing one endpoint (GET /models, POST /chat/completions, POST /responses). */
export interface ProviderProbeDetail {
    api: 'models' | ProviderApiKind;
    /** HTTP 2xx response was received */
    ok: boolean;
    /** Network-level reachability — the server answered at all */
    reached: boolean;
    /** Credentials accepted (false on 401/403) */
    authenticated: boolean;
    /** The route exists (false on 404/405/501 → the API is not offered here) */
    endpoint: boolean;
    /** HTTP status of the response, when one arrived */
    httpStatus?: number;
    /** The exact curl command for this probe (API key masked) */
    curl: string;
    /** Raw response body, truncated for display */
    body?: string;
    /** Network / timeout error message */
    error?: string;
}
/** Full live-verification result for a provider endpoint. */
export interface ProviderVerificationResult {
    /** The base URL actually probed (version segment resolved, if any) */
    baseUrl: string;
    /** Model ids returned by GET /models (empty when the endpoint has none) */
    modelIds: string[];
    models: ProviderProbeDetail;
    chat: ProviderProbeDetail;
    responses: ProviderProbeDetail;
    /** API kinds confirmed working: 'chat', 'responses' — or both */
    supported: ProviderApiKind[];
    verifiedAt: string;
}
/** Compact verification summary persisted on a registry provider entry. */
export interface ProviderApiCapabilities {
    supported: ProviderApiKind[];
    /** Model ids returned by GET /models at verification time */
    models: string[];
    verifiedAt: string;
}
/**
 * A provider registered once in the registry, with the exact set of agents
 * its definition + models are materialized into.
 */
export interface RegistryProvider {
    provider: ModelProvider;
    models: ModelConfig[];
    /** Agent ids this provider is currently installed into */
    agentIds: string[];
    /** True if this entry was merged from existing agent configs at migration */
    migrated?: boolean;
    /** Live API verification (probed when the provider was added or on demand) */
    apiCapabilities?: ProviderApiCapabilities;
}
/**
 * An MCP server defined ONCE in the registry and installed into N agents.
 * There is never more than one definition per server name — "no two servers".
 */
export interface RegistryMCPServer {
    server: MCPServerConfig;
    agentIds: string[];
    /** Per-agent tweaks (enabled / env / args) keyed by agent id */
    agentOverrides?: Record<string, MCPServerAgentOverride>;
    migrated?: boolean;
}
/**
 * A user-defined agent: where its config file lives (providers/models) and
 * optionally a separate path for MCP servers. Both use the unified JSON
 * schema, with unknown keys in existing files preserved on write.
 */
export interface CustomAgentDef {
    id: string;
    name: string;
    description?: string;
    /** Path where modelProviders + models are written */
    configPath: string;
    /** Optional separate path where MCP servers are written */
    mcpPath?: string;
    format?: 'json' | 'jsonc';
}
/** On-disk registry file format (JSON at <configHome>/registry.json) */
export interface Registry {
    version: 1;
    providers: RegistryProvider[];
    mcpServers: RegistryMCPServer[];
    /** User-defined agents with explicit config paths */
    customAgents: CustomAgentDef[];
    /** Paths of agent config files that failed to parse during migration */
    migrationWarnings?: string[];
    updatedAt: number;
}
/** Snapshot sent to the GUI / API consumers */
export interface RegistryState {
    path: string;
    providers: RegistryProvider[];
    mcpServers: RegistryMCPServer[];
    customAgents: CustomAgentDef[];
    updatedAt: number;
}
/** Result of materializing a registry entry into agent config files */
export interface MaterializeResult {
    ok: boolean;
    written: string[];
    errors: string[];
    warnings: string[];
}
//# sourceMappingURL=index.d.ts.map