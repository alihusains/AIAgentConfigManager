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

import type {
  AgentAdapter,
  AgentInfo,
  AgentConfig,
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  PermissionConfig,
  Platform,
  ConfigFormat,
  AgentCapabilities,
} from '../types';
import {
  resolveConfigPath,
  readFileSafe,
  writeFileSafe,
  parseConfig,
  stringifyConfig,
  validateAgentConfig,
  backupFile,
} from '../utils';
import * as path from 'node:path';

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
  /** Candidate paths where model/provider config lives (see AgentInfo). */
  modelConfigPaths?: Partial<Record<Platform, string[]>>;
  /** Where provider credentials are stored, when distinct (see AgentInfo). */
  modelCredentialPaths?: Partial<Record<Platform, string[]>>;
  /**
   * Optional separate file (supports ~/ and %ENV% templates) where the
   * agent's providers/models live — e.g. Pi's ~/.pi/agent/models.json.
   * When set, providers/models are read from and written to this file and
   * are never embedded in the main config file.
   */
  providerStorePath?: string;
  /** Optional per-platform overrides for providerStorePath */
  providerStorePaths?: Record<Platform, string>;
  /** Decode a provider-store file's raw content into unified providers/models. */
  decodeProviderStore?: (raw: Record<string, unknown>) => {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } | null;
  /** Serialize unified providers/models into the provider-store file shape. */
  encodeProviderStore?: (
    config: AgentConfig,
    raw: Record<string, unknown> | null
  ) => Record<string, unknown>;
}

export class GenericAdapter implements AgentAdapter {
  readonly info: AgentInfo;
  private readonly configTemplate: string;
  private readonly mcpTemplate: string | null;
  private readonly providerStoreTemplate: string | null;
  private readonly providerStorePaths: Record<Platform, string> | undefined;
  private readonly fileFormat: 'json' | 'jsonc';
  private readonly mcpShape: MCPShape;
  private readonly decodeProviderStoreFn: GenericAdapterOptions['decodeProviderStore'];
  private readonly encodeProviderStoreFn: GenericAdapterOptions['encodeProviderStore'];
  protected configCache: AgentConfig | null = null;
  private mainRawCache: Record<string, unknown> | null = null;
  private mcpRawCache: Record<string, unknown> | null = null;
  private providerStoreRawCache: Record<string, unknown> | null = null;

  constructor(options: GenericAdapterOptions) {
    this.configTemplate = options.configPath;
    this.mcpTemplate = options.mcpPath || null;
    this.providerStoreTemplate = options.providerStorePath || null;
    this.providerStorePaths = options.providerStorePaths;
    this.fileFormat = options.format || 'json';
    this.mcpShape = options.mcpShape || 'array';
    this.decodeProviderStoreFn = options.decodeProviderStore;
    this.encodeProviderStoreFn = options.encodeProviderStore;

    const configPaths: Record<Platform, string> = {
      darwin: options.configPath,
      win32: options.configPath,
      linux: options.configPath,
      ...(options.configPaths || {}),
    };
    const mcpPaths: Record<Platform, string> | undefined = options.mcpPath
      ? {
          darwin: options.mcpPath,
          win32: options.mcpPath,
          linux: options.mcpPath,
          ...(options.mcpConfigPaths || {}),
        }
      : undefined;

    const supports: AgentCapabilities = {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
      ...(options.supports || {}),
    };

    this.info = {
      id: options.id,
      name: options.name,
      description: options.description || 'Custom agent (user-defined config path)',
      configFormat: this.fileFormat as ConfigFormat,
      configPaths,
      binaries: options.binaries || [],
      supports,
      // Same-file MCP mode: the MCP file IS the main config file
      mcpConfigPaths: mcpPaths || configPaths,
      modelConfigPaths: options.modelConfigPaths,
      modelCredentialPaths: options.modelCredentialPaths,
    };
  }

  getConfigPath(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    const template = this.info.configPaths[current] || this.info.configPaths.darwin;
    return resolveConfigPath(template);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    if (!this.info.supports.mcpServers) return null;
    const current = platform || this.detectPlatform();
    const template =
      this.info.mcpConfigPaths?.[current] ||
      this.info.configPaths[current] ||
      this.info.configPaths.darwin;
    return resolveConfigPath(template, current);
  }

  getProviderStorePath(platform?: Platform): string | null {
    if (!this.providerStoreTemplate) return null;
    const current = platform || this.detectPlatform();
    const template = this.providerStorePaths?.[current] || this.providerStoreTemplate;
    return resolveConfigPath(template, current);
  }

  private detectPlatform(): Platform {
    if (typeof process !== 'undefined' && process.platform) {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'win32') return 'win32';
      return 'linux';
    }
    return 'darwin';
  }

  // ============================================================================
  // MCP shape conversion (unified array schema <-> per-tool keyed maps)
  // ============================================================================

  private mapTransport(type?: string): MCPServerConfig['type'] {
    switch ((type || 'stdio').toLowerCase()) {
      case 'sse':
        return 'sse';
      case 'http':
      case 'stream-http':
      case 'streamable-http':
      case 'remote':
        return 'http';
      default:
        return 'stdio';
    }
  }

  private decodeMCPRaw(raw: unknown): MCPServerConfig[] {
    if (this.mcpShape === 'array') {
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === 'object')
        .map((entry) => {
          const { name, ...rest } = entry;
          return {
            name: (name as string) || 'unnamed',
            ...this.mapToMCPServer(rest),
          } as MCPServerConfig;
        });
    }

    // keyed: { "<name>": { command, args, env, ... } }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const out: MCPServerConfig[] = [];
    for (const [name, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      out.push({
        name,
        ...this.mapToMCPServer(entry as Record<string, unknown>),
      } as MCPServerConfig);
    }
    return out;
  }

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private mapToMCPServer(entry: Record<string, unknown>): Partial<MCPServerConfig> {
    const command = entry.command;
    const rawType = entry.type;
    return {
      // URL-only entries (pi's drawio/miro/rezi) carry no type — treat them
      // as http transports so the unified model is consistent.
      type:
        typeof rawType === 'string'
          ? this.mapTransport(rawType)
          : typeof entry.url === 'string'
            ? 'http'
            : 'stdio',
      command: Array.isArray(command)
        ? typeof command[0] === 'string'
          ? command[0]
          : undefined
        : typeof command === 'string'
          ? command
          : undefined,
      args: Array.isArray(command)
        ? (command.slice(1) as string[])
        : Array.isArray(entry.args)
          ? (entry.args as string[])
          : undefined,
      env: this.isRecord(entry.env) ? (entry.env as Record<string, string>) : undefined,
      url: typeof entry.url === 'string' ? entry.url : undefined,
      headers: this.isRecord(entry.headers) ? (entry.headers as Record<string, string>) : undefined,
      cwd: typeof entry.cwd === 'string' ? entry.cwd : undefined,
      timeout: typeof entry.timeout === 'number' ? entry.timeout : undefined,
      enabled: entry.enabled !== false,
      approvalMode:
        entry.approvalMode === 'prompt' ||
        entry.approvalMode === 'auto' ||
        entry.approvalMode === 'never'
          ? entry.approvalMode
          : undefined,
      tools: Array.isArray(entry.tools) ? (entry.tools as string[]) : undefined,
    };
  }

  private encodeMCP(servers: MCPServerConfig[]): unknown {
    if (this.mcpShape === 'array') {
      return servers.map(({ name, ...rest }) => ({ name, ...rest }));
    }

    // keyed per-tool map: { "<name>": {...} }. Existing entries are MERGED
    // so tool-specific keys survive (pi's `directTools`, junie's `type`
    // field) and brand-new servers use the intersection-safe minimal shape:
    // string command + separate args[]; URL entries without a type — every
    // tool in this family (pi/junie/gemini) defaults URL entries to remote.
    const existing = (this.getRawMCPServersObject() || {}) as Record<
      string,
      Record<string, unknown>
    >;
    const out: Record<string, unknown> = {};
    for (const s of servers) {
      const prior = existing[s.name] || {};
      if (s.type === 'stdio' && s.command) {
        out[s.name] = {
          ...prior,
          command: s.command,
          ...(s.args?.length ? { args: s.args } : {}),
          ...(s.env ? { env: s.env } : {}),
          ...(s.cwd ? { cwd: s.cwd } : {}),
          ...(s.timeout !== undefined ? { timeout: s.timeout } : {}),
          ...(s.tools?.length ? { tools: s.tools } : {}),
          ...(s.enabled === false ? { enabled: false } : {}),
        };
      } else if (s.url) {
        out[s.name] = {
          ...prior,
          url: s.url,
          ...(s.headers ? { headers: s.headers } : {}),
          ...(s.env ? { env: s.env } : {}),
          // SSE is the one transport these tools need an explicit type for
          ...(s.type === 'sse' ? { type: 'sse' } : {}),
          ...(s.enabled === false ? { enabled: false } : {}),
        };
      } else if (Object.keys(prior).length > 0) {
        // No managed fields for this server but it exists on disk — keep it
        // untouched (e.g. a server the tool owns itself).
        out[s.name] = prior;
      }
    }
    return out;
  }

  /**
   * The raw `mcpServers` value on disk (same-file mode reads the main file,
   * separate-file mode reads the MCP file). Used by encodeMCP to merge
   * tool-specific keys without clobbering them.
   */
  private getRawMCPServersObject(): Record<string, unknown> | null {
    const raw = this.mcpTemplate ? this.mcpRawCache : this.mainRawCache;
    if (!raw) return null;
    const mcp = raw.mcpServers;
    return mcp && typeof mcp === 'object' && !Array.isArray(mcp)
      ? (mcp as Record<string, unknown>)
      : null;
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  private async ensureDir(filePath: string): Promise<void> {
    await import('node:fs/promises').then(async ({ mkdir }) => {
      const dir = path.dirname(filePath);
      await mkdir(dir, { recursive: true }).catch(() => undefined);
    });
  }

  async readConfig(): Promise<AgentConfig> {
    const configPath = this.getConfigPath();
    const mainContent = await readFileSafe(configPath);
    let modelProviders: ModelProvider[] = [];
    let models: ModelConfig[] = [];
    this.mainRawCache = null;
    this.providerStoreRawCache = null;

    if (mainContent) {
      const raw = parseConfig(mainContent, this.fileFormat) as Record<string, unknown>;
      this.mainRawCache = raw;
      if (Array.isArray(raw.modelProviders)) modelProviders = raw.modelProviders as ModelProvider[];
      if (Array.isArray(raw.models)) models = raw.models as ModelConfig[];
    }

    // Separate provider-store file (e.g. Pi's models.json) takes precedence
    // over any provider keys in the main config file.
    const psPath = this.getProviderStorePath();
    if (psPath && this.decodeProviderStoreFn) {
      const psContent = await readFileSafe(psPath);
      if (psContent) {
        const psRaw = parseConfig(psContent, this.fileFormat) as Record<string, unknown>;
        this.providerStoreRawCache = psRaw;
        const decoded = this.decodeProviderStoreFn(psRaw);
        if (decoded) {
          modelProviders = decoded.modelProviders;
          models = decoded.models;
        }
      }
    }

    let mcpServers: MCPServerConfig[] = [];
    const mcpPath = this.getMCPConfigPath();
    if (mcpPath) {
      const mcpContent = await readFileSafe(mcpPath);
      if (mcpContent) {
        const raw = parseConfig(mcpContent, this.fileFormat) as Record<string, unknown>;
        this.mcpRawCache = raw;
        mcpServers = this.decodeMCPRaw(raw.mcpServers);
      }
    } else if (this.mainRawCache) {
      // Same-file mode: MCP servers live under `mcpServers` in the main file
      mcpServers = this.decodeMCPRaw(this.mainRawCache.mcpServers);
    }

    const config: AgentConfig = {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders,
      models,
      mcpServers,
      permissions: [] as PermissionConfig[],
      customSettings: {},
    };
    this.configCache = config;
    return config;
  }

  async writeConfig(config: AgentConfig): Promise<void> {
    const validation = validateAgentConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }

    const configPath = this.getConfigPath();
    await this.ensureDir(configPath);

    const mainRaw: Record<string, unknown> = this.mainRawCache
      ? JSON.parse(JSON.stringify(this.mainRawCache))
      : {};
    // Keep unknown keys, drop the managed ones (rebuilt below)
    delete mainRaw.modelProviders;
    delete mainRaw.models;
    const main: Record<string, unknown> = { ...mainRaw };
    // Only write provider/model keys when the agent's config actually holds
    // them (Pi/Junie/Gemini keep providers managed by their own auth flows —
    // writing empty arrays would pollute their settings files). Agents with a
    // separate provider-store file get their providers written there instead.
    if (this.info.supports.modelProviders && !this.providerStoreTemplate) {
      main.modelProviders = config.modelProviders;
      main.models = config.models;
    }

    const mcpPath = this.getMCPConfigPath();
    const sameFileMCP = mcpPath !== null && mcpPath === configPath;
    if (mcpPath && !sameFileMCP) {
      // Separate MCP file: never write mcpServers into the main config
      await this.ensureDir(mcpPath);
      const mcpRaw: Record<string, unknown> = this.mcpRawCache
        ? JSON.parse(JSON.stringify(this.mcpRawCache))
        : {};
      delete mcpRaw.mcpServers;
      const mcpFile: Record<string, unknown> = {
        ...mcpRaw,
        mcpServers: this.encodeMCP(config.mcpServers),
      };
      await backupFile(mcpPath).catch(() => undefined);
      await writeFileSafe(mcpPath, stringifyConfig(mcpFile, this.fileFormat as 'json' | 'jsonc'));
      this.mcpRawCache = mcpFile;
    } else if (this.info.supports.mcpServers) {
      // Same-file mode: MCP servers persist inside the main config file
      main.mcpServers = this.encodeMCP(config.mcpServers);
    }

    await backupFile(configPath).catch(() => undefined);
    await writeFileSafe(configPath, stringifyConfig(main, this.fileFormat as 'json' | 'jsonc'));
    this.mainRawCache = main;

    // Separate provider-store file: write providers/models there
    const psPath = this.getProviderStorePath();
    if (psPath && this.encodeProviderStoreFn) {
      await this.ensureDir(psPath);
      const psFile = this.encodeProviderStoreFn(config, this.providerStoreRawCache);
      await backupFile(psPath).catch(() => undefined);
      await writeFileSafe(psPath, stringifyConfig(psFile, this.fileFormat as 'json' | 'jsonc'));
      this.providerStoreRawCache = psFile;
    }

    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  // ============================================================================
  // Generic read-mutate-write ops
  // ============================================================================

  private async mutate<T = void>(fn: (config: AgentConfig) => T): Promise<T> {
    const config = await this.readConfig();
    const result = fn(config);
    config.lastModified = Date.now();
    await this.writeConfig(config);
    return result;
  }

  listModelProviders(): ModelProvider[] {
    if (!this.configCache) throw new Error('Config not loaded. Call readConfig() first.');
    return this.configCache.modelProviders;
  }

  addModelProvider(provider: ModelProvider): Promise<void> {
    return this.mutate((config) => {
      if (config.modelProviders.some((p) => p.id === provider.id)) {
        throw new Error(`Provider with id "${provider.id}" already exists`);
      }
      config.modelProviders.push(provider);
    }).then(() => undefined);
  }

  removeModelProvider(providerId: string): Promise<void> {
    return this.mutate((config) => {
      config.modelProviders = config.modelProviders.filter((p) => p.id !== providerId);
      config.models = config.models.filter((m) => m.providerId !== providerId);
    }).then(() => undefined);
  }

  updateModelProvider(providerId: string, updates: Partial<ModelProvider>): Promise<void> {
    return this.mutate((config) => {
      const index = config.modelProviders.findIndex((p) => p.id === providerId);
      if (index === -1) throw new Error(`Provider with id "${providerId}" not found`);
      config.modelProviders[index] = {
        ...config.modelProviders[index],
        ...updates,
      };
    }).then(() => undefined);
  }

  listModels(): ModelConfig[] {
    if (!this.configCache) throw new Error('Config not loaded. Call readConfig() first.');
    return this.configCache.models;
  }

  addModel(model: ModelConfig): Promise<void> {
    return this.mutate((config) => {
      if (config.models.some((m) => m.id === model.id && m.providerId === model.providerId)) {
        throw new Error(`Model "${model.id}" already exists under provider "${model.providerId}"`);
      }
      config.models.push(model);
    }).then(() => undefined);
  }

  removeModel(modelId: string): Promise<void> {
    return this.mutate((config) => {
      config.models = config.models.filter((m) => m.id !== modelId);
    }).then(() => undefined);
  }

  updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    return this.mutate((config) => {
      const index = config.models.findIndex((m) => m.id === modelId);
      if (index === -1) throw new Error(`Model with id "${modelId}" not found`);
      config.models[index] = { ...config.models[index], ...updates };
    }).then(() => undefined);
  }

  listMCPServers(): MCPServerConfig[] {
    if (!this.configCache) throw new Error('Config not loaded. Call readConfig() first.');
    return this.configCache.mcpServers;
  }

  addMCPServer(server: MCPServerConfig): Promise<void> {
    return this.mutate((config) => {
      if (config.mcpServers.some((s) => s.name === server.name)) {
        throw new Error(`MCP server with name "${server.name}" already exists`);
      }
      config.mcpServers.push(server);
    }).then(() => undefined);
  }

  removeMCPServer(serverName: string): Promise<void> {
    return this.mutate((config) => {
      config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
    }).then(() => undefined);
  }

  updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void> {
    return this.mutate((config) => {
      const index = config.mcpServers.findIndex((s) => s.name === serverName);
      if (index === -1) throw new Error(`MCP server with name "${serverName}" not found`);
      config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
    }).then(() => undefined);
  }

  // Permissions are not supported for custom agents (unified schema has none)
  listPermissions(): PermissionConfig[] {
    return this.configCache?.permissions || [];
  }

  async addPermission(): Promise<void> {
    throw new Error(`${this.info.name} does not support permission rules`);
  }

  async removePermission(): Promise<void> {
    throw new Error(`${this.info.name} does not support permission rules`);
  }

  async updatePermission(): Promise<void> {
    throw new Error(`${this.info.name} does not support permission rules`);
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async backupConfig(): Promise<string> {
    return backupFile(this.getConfigPath());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.getConfigPath(), content);
    this.configCache = null;
    this.mainRawCache = null;
    this.providerStoreRawCache = null;
  }
}

/** Factory for a custom agent adapter bound to explicit paths. */
export function createGenericAdapter(options: GenericAdapterOptions): GenericAdapter {
  return new GenericAdapter(options);
}
