/**
 * Kimi Code Adapter (Moonshot AI)
 *
 * Kimi Code (https://moonshotai.github.io/kimi-cli/) stores its global config
 * at:
 *   - macOS/Linux: ~/.kimi/config.toml   (TOML)
 *   - Windows:     %APPDATA%\kimi\config.toml
 *
 * MCP servers live in a SEPARATE JSON file:
 *   - ~/.kimi/mcp.json   ({ mcpServers: { "<name>": { command, args, env } } })
 *
 * This is the one new agent whose MAIN config is TOML while its MCP file is
 * JSON, so it cannot be expressed with the generic (single-format) adapter.
 * Provider credentials live in ~/.kimi/credentials/<provider>.json, so
 * supports.modelProviders = false and config.toml is never polluted with
 * provider/model keys.
 *
 * Source: https://moonshotai.github.io/kimi-cli/
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

const KIMI_CONFIG_PATHS = {
  darwin: '~/.kimi/config.toml',
  win32: '%APPDATA%\\kimi\\config.toml',
  linux: '~/.kimi/config.toml',
} as const;

const KIMI_MCP_PATHS = {
  darwin: '~/.kimi/mcp.json',
  win32: '%APPDATA%\\kimi\\mcp.json',
  linux: '~/.kimi/mcp.json',
} as const;

/**
 * Create a Kimi Code adapter.
 */
export class KimiAdapter implements AgentAdapter {
  readonly info: AgentInfo = {
    id: 'kimi',
    name: 'Kimi Code',
    description: "Kimi Code — Moonshot AI's terminal coding agent (TOML config + mcp.json).",
    configFormat: 'toml' as ConfigFormat,
    configPaths: { ...KIMI_CONFIG_PATHS },
    binaries: ['kimi'],
    mcpConfigPaths: { ...KIMI_MCP_PATHS },
    modelConfigPaths: {
      darwin: [KIMI_CONFIG_PATHS.darwin],
      win32: [KIMI_CONFIG_PATHS.win32],
      linux: [KIMI_CONFIG_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.kimi/credentials'],
      win32: ['%APPDATA%\\kimi\\credentials'],
      linux: ['~/.kimi/credentials'],
    },
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };

  protected configCache: AgentConfig | null = null;
  protected mainRawCache: Record<string, unknown> | null = null;
  protected mcpRawCache: Record<string, unknown> | null = null;

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
    return resolveConfigPath(KIMI_CONFIG_PATHS[current] || KIMI_CONFIG_PATHS.darwin);
  }

  private mcpPathFor(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    return resolveConfigPath(KIMI_MCP_PATHS[current] || KIMI_MCP_PATHS.darwin);
  }

  getConfigPath(platform?: Platform): string {
    return this.configPathFor(platform);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    return this.mcpPathFor(platform);
  }

  // ============================================================================
  // Config File Operations
  // ============================================================================

  async readConfig(): Promise<AgentConfig> {
    const mainContent = await readFileSafe(this.configPathFor());
    this.mainRawCache = null;
    if (mainContent) {
      try {
        this.mainRawCache = parseConfig(mainContent, 'toml') as Record<string, unknown>;
      } catch {
        this.mainRawCache = {};
      }
    }

    let mcpServers: MCPServerConfig[] = [];
    const mcpContent = await readFileSafe(this.mcpPathFor());
    this.mcpRawCache = null;
    if (mcpContent) {
      try {
        const raw = parseConfig(mcpContent, 'json') as Record<string, unknown>;
        this.mcpRawCache = raw;
        mcpServers = this.decodeMCPRaw(raw.mcpServers);
      } catch {
        this.mcpRawCache = null;
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

    // 1) Main TOML config: preserve unknown keys, drop managed provider/model keys.
    const mainRaw: Record<string, unknown> = this.mainRawCache
      ? JSON.parse(JSON.stringify(this.mainRawCache))
      : {};
    delete mainRaw.modelProviders;
    delete mainRaw.models;
    await backupFile(this.configPathFor()).catch(() => undefined);
    await writeFileSafe(this.configPathFor(), stringifyConfig(mainRaw, 'toml'));
    this.mainRawCache = mainRaw;

    // 2) Separate MCP JSON file.
    const mcpRaw: Record<string, unknown> = this.mcpRawCache
      ? JSON.parse(JSON.stringify(this.mcpRawCache))
      : {};
    delete mcpRaw.mcpServers;
    const mcpFile: Record<string, unknown> = {
      ...mcpRaw,
      mcpServers: this.encodeMCP(config.mcpServers),
    };
    await backupFile(this.mcpPathFor()).catch(() => undefined);
    await writeFileSafe(this.mcpPathFor(), stringifyConfig(mcpFile, 'json'));
    this.mcpRawCache = mcpFile;

    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  // ============================================================================
  // MCP shape conversion (unified array <-> keyed map)
  // ============================================================================

  private isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  }

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
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const out: MCPServerConfig[] = [];
    for (const [name, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (!this.isRecord(entry)) continue;
      const command = entry.command;
      out.push({
        name,
        type:
          typeof entry.type === 'string'
            ? this.mapTransport(entry.type)
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
        headers: this.isRecord(entry.headers)
          ? (entry.headers as Record<string, string>)
          : undefined,
        enabled: entry.enabled !== false,
      } as MCPServerConfig);
    }
    return out;
  }

  private encodeMCP(servers: MCPServerConfig[]): Record<string, unknown> {
    const existing = (this.mcpRawCache?.mcpServers || {}) as Record<
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
          ...(s.enabled === false ? { enabled: false } : {}),
        };
      } else if (s.url) {
        out[s.name] = {
          ...prior,
          url: s.url,
          ...(s.headers ? { headers: s.headers } : {}),
          ...(s.env ? { env: s.env } : {}),
          ...(s.type === 'sse' ? { type: 'sse' } : {}),
          ...(s.enabled === false ? { enabled: false } : {}),
        };
      } else if (Object.keys(prior).length > 0) {
        out[s.name] = prior;
      }
    }
    return out;
  }

  // ============================================================================
  // Mutate helper + operations
  // ============================================================================

  private async mutate<T = void>(fn: (config: AgentConfig) => T): Promise<T> {
    const config = await this.readConfig();
    const result = fn(config);
    config.lastModified = Date.now();
    await this.writeConfig(config);
    return result;
  }

  listModelProviders(): ModelProvider[] {
    return [];
  }

  async addModelProvider(): Promise<void> {
    throw new Error('Kimi Code manages providers via its own credentials — not editable here');
  }

  async removeModelProvider(): Promise<void> {
    throw new Error('Kimi Code manages providers via its own credentials — not editable here');
  }

  async updateModelProvider(): Promise<void> {
    throw new Error('Kimi Code manages providers via its own credentials — not editable here');
  }

  listModels(): ModelConfig[] {
    return [];
  }

  async addModel(): Promise<void> {
    throw new Error('Kimi Code does not expose a model list in its config');
  }

  async removeModel(): Promise<void> {
    throw new Error('Kimi Code does not expose a model list in its config');
  }

  async updateModel(): Promise<void> {
    throw new Error('Kimi Code does not expose a model list in its config');
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

  listPermissions(): PermissionConfig[] {
    return [];
  }

  async addPermission(): Promise<void> {
    throw new Error('Kimi Code does not support permission rules in its config');
  }

  async removePermission(): Promise<void> {
    throw new Error('Kimi Code does not support permission rules in its config');
  }

  async updatePermission(): Promise<void> {
    throw new Error('Kimi Code does not support permission rules in its config');
  }

  async backupConfig(): Promise<string> {
    return backupFile(this.configPathFor());
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const content = await readFileSafe(backupPath);
    if (!content) throw new Error(`Backup file not found: ${backupPath}`);
    await writeFileSafe(this.configPathFor(), content);
    this.configCache = null;
    this.mainRawCache = null;
    this.mcpRawCache = null;
  }
}

export function createKimiAdapter(): KimiAdapter {
  return new KimiAdapter();
}
