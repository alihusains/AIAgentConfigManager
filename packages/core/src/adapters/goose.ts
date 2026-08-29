/**
 * Goose Adapter
 *
 * Goose (https://github.com/aaif-goose/goose, formerly block/goose) keeps its
 * global config at:
 *   - macOS/Linux: ~/.config/goose/config.yaml   (YAML)
 *   - Windows:     %APPDATA%\Block\goose\config\config.yaml
 *
 * MCP servers are called "extensions" and live INSIDE config.yaml under the
 * `extensions:` key as a KEYED map (not a list). The on-disk shape uses
 * non-standard field names (verified against the serde `ExtensionConfig`):
 *
 *   extensions:
 *     filesystem:            # name = map key
 *       type: stdio          # discriminator
 *       cmd: npx             # NOT "command"
 *       args: ["-y", "pkg"]
 *       envs: { K: "v" }     # NOT "env"
 *       timeout: 300
 *       enabled: true
 *     remote-tools:
 *       type: streamable_http
 *       uri: "https://example.com/mcp"   # NOT "url"
 *       headers: {}
 *       enabled: true
 *
 * This adapter reads/writes config.yaml with js-yaml and maps the unified
 * MCPServerConfig (command/args/env/url) onto Goose's cmd/envs/uri. Unknown
 * top-level and per-extension keys are preserved on write.
 *
 * Source: https://goose-docs.ai (Using Extensions) + crates/goose/src/agents/extension.rs
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

const GOOSE_CONFIG_PATHS = {
  darwin: '~/.config/goose/config.yaml',
  win32: '%APPDATA%\\Block\\goose\\config\\config.yaml',
  linux: '~/.config/goose/config.yaml',
} as const;

/** A single Goose extension entry on disk. */
interface GooseExtension {
  type?: string;
  name?: string;
  description?: string;
  cmd?: string;
  args?: string[];
  envs?: Record<string, string>;
  env?: Record<string, string>;
  env_keys?: string[];
  uri?: string;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
  cwd?: string | null;
  available_tools?: string[];
  enabled?: boolean;
  [key: string]: unknown;
}

export class GooseAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'goose',
    name: 'Goose',
    description:
      'Goose — Block’s open-source extensible coding agent (MCP via extensions in config.yaml).',
    configFormat: 'yaml' as ConfigFormat,
    configPaths: { ...GOOSE_CONFIG_PATHS },
    binaries: ['goose'],
    // MCP servers (extensions) live inside config.yaml
    mcpConfigPaths: { ...GOOSE_CONFIG_PATHS },
    modelConfigPaths: {
      darwin: [GOOSE_CONFIG_PATHS.darwin],
      win32: [GOOSE_CONFIG_PATHS.win32],
      linux: [GOOSE_CONFIG_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.config/goose/credentials'],
      win32: ['%APPDATA%\\Block\\goose\\credentials'],
      linux: ['~/.config/goose/credentials'],
    },
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };

  protected configCache: AgentConfig | null = null;
  protected rawCache: Record<string, unknown> | null = null;

  private detectPlatform(): Platform {
    if (typeof process !== 'undefined' && process.platform) {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'win32') return 'win32';
      return 'linux';
    }
    return 'darwin';
  }

  private configPathFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(GOOSE_CONFIG_PATHS[current] || GOOSE_CONFIG_PATHS.darwin);
  }

  getConfigPath(platform?: Platform): string {
    return this.configPathFor(platform);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    return this.configPathFor(platform);
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    const content = await readFileSafe(this.configPathFor());
    this.rawCache = null;

    let mcpServers: MCPServerConfig[] = [];
    if (content) {
      try {
        const raw = parseConfig(content, 'yaml') as Record<string, unknown> | null;
        this.rawCache = raw && typeof raw === 'object' ? raw : {};
        mcpServers = this.decodeExtensions(this.rawCache.extensions);
      } catch {
        this.rawCache = {};
      }
    }

    const config: AgentConfig = {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders: [],
      models: [],
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

    const raw: Record<string, unknown> = this.rawCache
      ? JSON.parse(JSON.stringify(this.rawCache))
      : {};
    raw.extensions = this.encodeExtensions(config.mcpServers);
    await backupFile(this.configPathFor()).catch(() => undefined);
    await writeFileSafe(this.configPathFor(), stringifyConfig(raw, 'yaml'));
    this.rawCache = raw;
    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  // ============================================================================
  // Extension (MCP) shape conversion
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

  private decodeExtensions(raw: unknown): MCPServerConfig[] {
    if (!this.isRecord(raw)) return [];
    const out: MCPServerConfig[] = [];
    for (const [name, entry] of Object.entries(raw)) {
      if (!this.isRecord(entry)) continue;
      const env = this.isRecord(entry.envs)
        ? entry.envs
        : this.isRecord(entry.env)
          ? entry.env
          : undefined;
      const url =
        typeof entry.uri === 'string'
          ? entry.uri
          : typeof entry.url === 'string'
            ? entry.url
            : undefined;
      const type = (entry.type || (url ? 'streamable_http' : 'stdio')) as string;
      const isRemote =
        type === 'streamable_http' || type === 'http' || type === 'sse' || type === 'remote';
      out.push({
        name,
        type: isRemote ? (type === 'sse' ? 'sse' : 'http') : 'stdio',
        command: isRemote ? undefined : entry.cmd,
        args: Array.isArray(entry.args) ? entry.args : undefined,
        env,
        url: isRemote ? url : undefined,
        headers: this.isRecord(entry.headers) ? entry.headers : undefined,
        timeout: typeof entry.timeout === 'number' ? entry.timeout : undefined,
        enabled: entry.enabled !== false,
        tools:
          Array.isArray(entry.available_tools) && entry.available_tools.length
            ? entry.available_tools
            : undefined,
      } as MCPServerConfig);
    }
    return out;
  }

  private encodeExtensions(servers: MCPServerConfig[]): Record<string, GooseExtension> {
    const existing = (
      this.rawCache && this.isRecord(this.rawCache.extensions) ? this.rawCache.extensions : {}
    ) as Record<string, GooseExtension>;
    const out: Record<string, GooseExtension> = {};
    for (const s of servers) {
      const prior: GooseExtension = { ...existing[s.name] };
      delete prior._raw;
      if (s.type === 'stdio' && s.command) {
        out[s.name] = {
          ...prior,
          type: prior.type || 'stdio',
          name: prior.name || s.name,
          cmd: s.command,
          ...(s.args?.length ? { args: s.args } : {}),
          ...(s.env ? { envs: s.env } : {}),
          ...(s.cwd ? { cwd: s.cwd } : {}),
          ...(s.timeout !== undefined ? { timeout: s.timeout } : {}),
          ...(s.tools?.length ? { available_tools: s.tools } : {}),
          enabled: s.enabled,
        };
      } else if (s.url) {
        out[s.name] = {
          ...prior,
          type: prior.type || (s.type === 'sse' ? 'sse' : 'streamable_http'),
          name: prior.name || s.name,
          uri: s.url,
          ...(s.headers ? { headers: s.headers } : {}),
          ...(s.env ? { envs: s.env } : {}),
          ...(s.timeout !== undefined ? { timeout: s.timeout } : {}),
          enabled: s.enabled,
        };
      } else if (Object.keys(prior).length > 0) {
        out[s.name] = prior;
      }
    }
    return out;
  }

  // ============================================================================
  // Model / Provider Operations (not managed in Goose config)
  // ============================================================================

  listModelProviders(): ModelProvider[] {
    return [];
  }
  async addModelProvider(): Promise<void> {
    throw new Error('Goose manages providers via its own auth/secret store, not config.yaml');
  }
  async removeModelProvider(): Promise<void> {
    throw new Error('Goose manages providers via its own auth/secret store, not config.yaml');
  }
  async updateModelProvider(): Promise<void> {
    throw new Error('Goose manages providers via its own auth/secret store, not config.yaml');
  }
  listModels(): ModelConfig[] {
    return [];
  }
  async addModel(): Promise<void> {
    throw new Error('Goose does not declare a model list in config.yaml');
  }
  async removeModel(): Promise<void> {
    throw new Error('Goose does not declare a model list in config.yaml');
  }
  async updateModel(): Promise<void> {
    throw new Error('Goose does not declare a model list in config.yaml');
  }

  // ============================================================================
  // MCP Server Operations
  // ============================================================================

  listMCPServers(): MCPServerConfig[] {
    if (!this.configCache) throw new Error('Config not loaded. Call readConfig() first.');
    return this.configCache.mcpServers;
  }

  async addMCPServer(server: MCPServerConfig): Promise<void> {
    const config = await this.readConfig();
    if (config.mcpServers.some((s) => s.name === server.name)) {
      throw new Error(`MCP server with name "${server.name}" already exists`);
    }
    config.mcpServers.push(server);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async removeMCPServer(serverName: string): Promise<void> {
    const config = await this.readConfig();
    config.mcpServers = config.mcpServers.filter((s) => s.name !== serverName);
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  async updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<void> {
    const config = await this.readConfig();
    const index = config.mcpServers.findIndex((s) => s.name === serverName);
    if (index === -1) throw new Error(`MCP server with name "${serverName}" not found`);
    config.mcpServers[index] = { ...config.mcpServers[index], ...updates };
    config.lastModified = Date.now();
    await this.writeConfig(config);
  }

  // ============================================================================
  // Permission Operations (not supported)
  // ============================================================================

  listPermissions(): PermissionConfig[] {
    return this.configCache?.permissions || [];
  }
  async addPermission(): Promise<void> {
    throw new Error('Goose does not support permission rules in its config file');
  }
  async removePermission(): Promise<void> {
    throw new Error('Goose does not support permission rules in its config file');
  }
  async updatePermission(): Promise<void> {
    throw new Error('Goose does not support permission rules in its config file');
  }

  // ============================================================================
  // Utility
  // ============================================================================

  async backupConfig(): Promise<string> {
    return backupFile(this.configPathFor());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.configPathFor(), content);
    this.configCache = null;
    this.rawCache = null;
  }
}

export function createGooseAdapter(): GooseAdapter {
  return new GooseAdapter();
}
