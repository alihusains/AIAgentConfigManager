/**
 * Core type definitions for AI Agent Config Manager
 * Provides a unified interface for managing configurations across different AI agents
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

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
  /**
   * Optional per-agent override of the version probe arguments.
   * Some CLIs only support `-V` or print the version to stderr.
   * Defaults to `["--version"]`.
   */
  versionArgs?: string[];
  /**
   * Candidate paths where model/provider config lives, per platform.
   * First existing file wins; if none exist the first candidate is
   * reported as the "would-be" path. Usually the main config file.
   */
  modelConfigPaths?: Partial<Record<Platform, string[]>>;
  /**
   * Where API keys / provider credentials are stored (distinct from the
   * model config), e.g. reasonix's `~/.reasonix/.env`.
   */
  modelCredentialPaths?: Partial<Record<Platform, string[]>>;
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
  /**
   * How the binary was located, when installed via PATH lookup:
   * 'path' = found on the process PATH, 'shell-env' = found after parsing
   * the login shell's PATH, 'known-location' = found in a well-known
   * install directory (nvm/bun/brew/home-grown bins).
   */
  detectedBy?: 'path' | 'shell-env' | 'known-location';
  /** Resolved absolute MCP config path (undefined when the agent has no MCP support). */
  mcpPath?: string;
  /** Whether the MCP config file exists on disk. */
  mcpConfigExists?: boolean;
  /** Number of MCP servers in the config (best-effort; 0 on parse failure, undefined when unreadable/no MCP). */
  mcpServerCount?: number;
  /** Where model/provider config lives (usually the main config file). */
  modelConfigPath?: string;
  /** Whether the model config file exists on disk. */
  modelConfigExists?: boolean;
  /** Where provider API keys / credentials are stored, when distinct from the model config. */
  modelCredentialPath?: string;
  /** Whether the credential file exists on disk. */
  modelCredentialExists?: boolean;
  /** Error encountered during detection, if any */
  error?: string;
}

export interface AgentCapabilities {
  modelProviders: boolean;
  mcpServers: boolean;
  permissions: boolean;
  projectConfig: boolean;
}

// ============================================================================
// Model Provider Types
// ============================================================================

export interface ModelProvider {
  id: string;
  name: string;
  type:
    | 'builtin'
    | 'custom'
    | 'openai-compatible'
    | 'anthropic'
    | 'google'
    | 'azure'
    | 'bedrock'
    | 'vertex';
  /**
   * Freeform per-provider settings (baseUrl, wireApi, ...). `apiKey` is the
   * well-known key: a plaintext string for legacy providers. For providers
   * that opted into OS-keychain storage (Phase 1 Secrets, see
   * `RegistryProvider.keychainSecretRef`) it is an empty string — the real
   * key lives in the keychain and is resolved via `resolveProviderApiKey()`.
   */
  config: Record<string, unknown> & { apiKey?: string };
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

export type ModelRole =
  | 'chat'
  | 'edit'
  | 'apply'
  | 'summarize'
  | 'autocomplete'
  | 'embed'
  | 'rerank';

export type ModelCapability =
  | 'tool_use'
  | 'image_input'
  | 'reasoning'
  | 'vision'
  | 'code_generation';

// ============================================================================
// MCP Server Types
// ============================================================================

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
  tools?: string[]; // specific tools to allow, empty = all
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

// ============================================================================
// Permission Types
// ============================================================================

export interface PermissionConfig {
  id: string;
  type: 'tool' | 'directory' | 'url' | 'command' | 'mcp' | 'custom';
  scope: 'global' | 'project';
  projectPath?: string;
  allowed: boolean;
  pattern: string; // tool name, directory path, URL pattern, command pattern
  description?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Configuration Schema
// ============================================================================

export interface AgentConfig {
  version: string;
  lastModified: number;
  modelProviders: ModelProvider[];
  models: ModelConfig[];
  mcpServers: MCPServerConfig[];
  permissions: PermissionConfig[];
  customSettings: Record<string, unknown>;
}

// ============================================================================
// Adapter Interface
// ============================================================================

export interface AgentAdapter {
  readonly info: AgentInfo;

  // Configuration file operations
  getConfigPath(platform?: Platform): string;
  /**
   * Absolute path of the file where MCP servers are configured.
   * Returns null for agents without MCP support (e.g. detect-only omp).
   * In same-file mode this is the main config file.
   */
  getMCPConfigPath?(platform?: Platform): string | null;
  readConfig(): Promise<AgentConfig>;
  writeConfig(config: AgentConfig): Promise<void>;
  validateConfig(config: unknown): { valid: boolean; errors: string[] };

  /**
   * Providers derived from one registry entry for alternate wire protocols
   * this agent's format can express (e.g. an OpenCode-style agent getting a
   * `<id>-anthropic` sibling backed by @ai-sdk/anthropic when verification
   * confirmed the Anthropic Messages API). Adapters that cannot represent
   * alternate wires simply don't implement this. Derived ids MUST be treated
   * as registry-managed so they are cleaned up with their parent.
   */
  deriveAlternateProviders?(
    entry: RegistryProvider
  ): { provider: ModelProvider; models: ModelConfig[] }[];

  /**
   * Raw config entries the unified model cannot express, preserved on disk
   * as-is (QA H4). Adapters report them here so materialization can surface
   * an explicit warning instead of a bare ok that leaves the file
   * unverifiable.
   */
  getPreservedRawEntries?(): { key: string; name: string }[];

  /**
   * Project a unified provider down to the fields this agent's wire format
   * can actually express, for drift comparison. Registry entries are shared
   * across agents and may carry fields another agent's format cannot
   * represent (e.g. `wireApi` is a Codex TOML field that OpenCode-style
   * JSONC cannot express). Without this projection, comparing the shared
   * registry entry against the on-disk state yields permanent phantom drift
   * that no re-sync can ever clear. Adapters that can express every unified
   * field do not implement this; the default is identity.
   */
  expressibleProviderConfig?: (config: Record<string, unknown>) => Record<string, unknown>;

  // Model/Provider operations
  listModelProviders(): ModelProvider[];
  addModelProvider(provider: ModelProvider): Promise<void>;
  removeModelProvider(providerId: string): Promise<void>;
  updateModelProvider(providerId: string, updates: Partial<ModelProvider>): Promise<void>;

  // Model operations
  listModels(): ModelConfig[];
  addModel(model: ModelConfig): Promise<void>;
  /**
   * Remove a model. `providerId` disambiguates when the same model id exists
   * under multiple providers; omit it to remove every model with that id.
   */
  removeModel(modelId: string, providerId?: string): Promise<void>;
  /**
   * Update a model. `providerId` disambiguates when the same model id exists
   * under multiple providers; omit it to update the first match.
   */
  updateModel(modelId: string, updates: Partial<ModelConfig>, providerId?: string): Promise<void>;

  // MCP operations
  listMCPServers(): MCPServerConfig[];
  addMCPServer(server: MCPServerConfig): Promise<void>;
  removeMCPServer(serverName: string): Promise<void>;
  updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void>;

  // Permission operations
  listPermissions(): PermissionConfig[];
  addPermission(permission: PermissionConfig): Promise<void>;
  removePermission(permissionId: string): Promise<void>;
  updatePermission(permissionId: string, updates: Partial<PermissionConfig>): Promise<void>;

  // Utility
  backupConfig(): Promise<string>; // returns backup path
  restoreConfig(backupPath: string): Promise<void>;
}

// ============================================================================
// Operation Result Types
// ============================================================================

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

// ============================================================================
// CLI Types
// ============================================================================

export interface CLICommand {
  name: string;
  description: string;
  args: CLIArg[];
  options: CLIOption[];
  handler: (
    args: Record<string, string>,
    options: Record<string, unknown>
  ) => Promise<OperationResult>;
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

// ============================================================================
// GUI Types
// ============================================================================

export interface GUIState {
  selectedAgent: string | null;
  selectedAgents: string[]; // for "Select All" functionality
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

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const ModelProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'builtin',
    'custom',
    'openai-compatible',
    'anthropic',
    'google',
    'azure',
    'bedrock',
    'vertex',
  ]),
  config: z.record(z.unknown()),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
});

export const ModelConfigSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  name: z.string(),
  displayName: z.string(),
  roles: z.array(z.enum(['chat', 'edit', 'apply', 'summarize', 'autocomplete', 'embed', 'rerank'])),
  contextLength: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  capabilities: z
    .array(z.enum(['tool_use', 'image_input', 'reasoning', 'vision', 'code_generation']))
    .optional(),
  customOptions: z.record(z.unknown()).optional(),
});

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['stdio', 'http', 'sse', 'streamable-http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().int().positive().optional(),
  enabled: z.boolean(),
  approvalMode: z.enum(['prompt', 'auto', 'never']).optional(),
  tools: z.array(z.string()).optional(),
});

export const PermissionConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['tool', 'directory', 'url', 'command', 'mcp', 'custom']),
  scope: z.enum(['global', 'project']),
  projectPath: z.string().optional(),
  allowed: z.boolean(),
  pattern: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentConfigSchema = z.object({
  version: z.string(),
  lastModified: z.number(),
  modelProviders: z.array(ModelProviderSchema),
  models: z.array(ModelConfigSchema),
  mcpServers: z.array(MCPServerConfigSchema),
  permissions: z.array(PermissionConfigSchema),
  customSettings: z.record(z.unknown()),
});

// ============================================================================
// Registry Types (single source of truth)
// ============================================================================

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
 * The wire protocols a provider gateway may expose:
 * - "chat"      → POST {base}/chat/completions (OpenAI Chat Completions API)
 * - "responses" → POST {base}/responses (the newer OpenAI Responses API)
 * - "anthropic" → POST {base}/messages (Anthropic Messages API; many
 *   multi-protocol gateways serve both OpenAI and Anthropic shapes)
 *
 * Some providers — e.g. ChatGPT accounts — have removed chat completions and
 * answer only on the responses route. Verification records which kinds an
 * endpoint really supports so the dashboard can say "Chat ✓ / Responses ✗".
 */
export type ProviderApiKind = 'chat' | 'responses' | 'anthropic';

/** Outcome of probing one endpoint (GET /models, POST /chat/completions, POST /responses, POST /messages). */
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
  anthropic: ProviderProbeDetail;
  /** API kinds confirmed working: any of 'chat', 'responses', 'anthropic' */
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
  /**
   * Phase 1 (Secrets): present when this provider's API key is stored in the
   * OS keychain instead of plaintext in `provider.config.apiKey`. The value is
   * the keychain account reference (e.g. `provider:<providerId>`); the service
   * namespace is fixed by the keychain module. Additive/optional — legacy
   * entries without this field keep working exactly as before. Resolution
   * (fetching the real key from the keychain) is wired in a later task.
   */
  keychainSecretRef?: string;
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

// ============================================================================
// Key Location Scanning (T4: "Where do my keys live" feature)
// ============================================================================

/** Where a provider's API key is stored */
export type KeyStorageLocation =
  | { type: 'keychain'; reference: string }
  | { type: 'registry-plaintext'; path: string }
  | { type: 'agent-plaintext'; agentId: string; configPath: string }
  | { type: 'missing' };

/** Per-provider key location report */
export interface ProviderKeyLocation {
  providerId: string;
  providerName: string;
  locations: KeyStorageLocation[];
  isKeychain: boolean; // true if any location is keychain
  isPlaintext: boolean; // true if any location is plaintext (registry or agent)
  riskLevel: 'high' | 'medium' | 'low'; // high = plaintext in multiple places, medium = one plaintext, low = keychain only
}

/** Result of scanning all key locations */
export interface KeyLocationScanResult {
  scannedAt: string;
  providers: ProviderKeyLocation[];
  summary: {
    totalProviders: number;
    keychainBacked: number;
    plaintextOnly: number;
    mixed: number;
  };
}
