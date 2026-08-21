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
import { AgentAdapter, AgentInfo, AgentConfig, ModelProvider, ModelConfig, MCPServerConfig, PermissionConfig, Platform, AgentCapabilities } from '../types';
export type MCPShape = 'array' | 'keyed';
export interface GenericAdapterOptions {
    id: string;
    name: string;
    description?: string;
    /** CLI binary name(s) used to detect whether this agent is installed */
    binaries?: string[];
    /** Path (supports ~/ and %ENV% templates) for the main config file */
    configPath: string;
    /** Optional per-platform overrides for configPath (defaults to configPath) */
    configPaths?: Record<Platform, string>;
    /** Optional separate path (supports templates) for MCP servers */
    mcpPath?: string;
    /** Optional per-platform overrides for mcpPath */
    mcpConfigPaths?: Record<Platform, string>;
    format?: 'json' | 'jsonc';
    /**
     * On-disk shape of `mcpServers`. 'array' = unified array schema (custom
     * agents). 'keyed' = per-tool object map `{ "<name>": { command, args,
     * env } }` with string commands (Pi, Junie, Gemini).
     */
    mcpShape?: MCPShape;
    /** Capability overrides; defaults to all supported (custom agent). */
    supports?: Partial<AgentCapabilities>;
}
export declare class GenericAdapter implements AgentAdapter {
    readonly info: AgentInfo;
    private readonly configTemplate;
    private readonly mcpTemplate;
    private readonly fileFormat;
    private readonly mcpShape;
    protected configCache: AgentConfig | null;
    private mainRawCache;
    private mcpRawCache;
    constructor(options: GenericAdapterOptions);
    getConfigPath(platform?: Platform): string;
    getMCPConfigPath(): string | null;
    private detectPlatform;
    private mapTransport;
    private decodeMCPRaw;
    private isRecord;
    private mapToMCPServer;
    private encodeMCP;
    /**
     * The raw `mcpServers` value on disk (same-file mode reads the main file,
     * separate-file mode reads the MCP file). Used by encodeMCP to merge
     * tool-specific keys without clobbering them.
     */
    private getRawMCPServersObject;
    private ensureDir;
    readConfig(): Promise<AgentConfig>;
    writeConfig(config: AgentConfig): Promise<void>;
    validateConfig(config: unknown): {
        valid: boolean;
        errors: string[];
    };
    private mutate;
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
/** Factory for a custom agent adapter bound to explicit paths. */
export declare function createGenericAdapter(options: GenericAdapterOptions): GenericAdapter;
//# sourceMappingURL=generic.d.ts.map