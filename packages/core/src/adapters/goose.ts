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
 * Model providers ARE file-configurable (docs: guides/config-files +
 * getting-started/providers). The canonical shape (goose >= 1.x, YAML):
 *
 *   config.yaml:
 *     active_provider: custom_corp_api
 *     providers:
 *       custom_corp_api:
 *         enabled: true
 *         model: gpt-4o
 *         configured: true
 *     GOOSE_PLANNER_PROVIDER: "custom_corp_api"
 *     GOOSE_PLANNER_MODEL: "gpt-4o"
 *
 *   ~/.config/goose/custom_providers/custom_corp_api.json:
 *     {
 *       "name": "custom_corp_api",
 *       "engine": "openai",            // openai | anthropic | ollama
 *       "display_name": "Corporate API",
 *       "api_key_env": "CUSTOM_CORP_API_API_KEY",
 *       "base_url": "https://api.company.com/v1/chat/completions",
 *       "models": [{ "name": "gpt-4o", "context_limit": 128000 }],
 *       "headers": {},
 *       "supports_streaming": true,
 *       "requires_auth": true
 *     }
 *
 * The API key NEVER goes into config.yaml (goose ignores it) — the provider
 * JSON carries `api_key_env` and the literal key (when the registry has one)
 * is written to ~/.config/goose/secrets.yaml under that env name (goose's
 * file-based secret store; harmless when the keyring is active instead).
 * base_url in the provider JSON is the FULL chat-completions URL; the unified
 * config.baseUrl stores the root and /chat/completions is appended on write.
 *
 * Source: https://goose-docs.ai/docs/guides/config-files/
 *         https://goose-docs.ai/docs/getting-started/providers/
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
import * as fs from 'node:fs/promises';
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
      modelProviders: true,
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

    // Custom providers: one JSON file per provider in custom_providers/.
    const { modelProviders, models } = await this.decodeCustomProviders();

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

    const raw: Record<string, unknown> = this.rawCache
      ? JSON.parse(JSON.stringify(this.rawCache))
      : {};
    raw.extensions = this.encodeExtensions(config.mcpServers);
    // Keep active_provider pointing at a managed provider when one exists —
    // must run BEFORE the file write (it mutates `raw`).
    await this.encodeCustomProviders(raw, config.modelProviders, config.models);
    await backupFile(this.configPathFor()).catch(() => undefined);
    await writeFileSafe(this.configPathFor(), stringifyConfig(raw, 'yaml'));
    this.rawCache = raw;
    this.configCache = config;
  }

  validateConfig(config: unknown): { valid: boolean; errors: string[] } {
    return validateAgentConfig(config);
  }

  /**
   * Drift projection: provider JSONs express base_url/api_key_env/engine/
   * headers. The literal apiKey (kept in secrets.yaml) round-trips through
   * the registry.
   */
  expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKeyEnv !== undefined) out.apiKeyEnv = config.apiKeyEnv;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    if (config.headers !== undefined) out.headers = config.headers;
    return out;
  };

  // ============================================================================
  // Custom provider conversion (unified <-> config.yaml + custom_providers/*.json)
  // ============================================================================

  private customProvidersDir(): string {
    // config.yaml lives at ~/.config/goose/config.yaml; provider JSONs sit
    // next to it under custom_providers/.
    const configPath = this.configPathFor();
    const sep = configPath.includes('\\') ? '\\' : '/';
    return `${configPath.substring(0, configPath.lastIndexOf(sep))}${sep}custom_providers`;
  }

  private async decodeCustomProviders(): Promise<{
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  }> {
    const dir = this.customProvidersDir();
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    let entries: string[] = [];
    try {
      entries = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    } catch {
      return { modelProviders, models };
    }
    for (const file of entries) {
      try {
        const content = await readFileSafe(`${dir}/${file}`);
        if (!content) continue;
        const raw = JSON.parse(content) as Record<string, unknown>;
        const name = typeof raw.name === 'string' ? raw.name : file.replace(/\.json$/, '');
        const engine = typeof raw.engine === 'string' ? raw.engine : 'openai';
        let baseUrl = typeof raw.base_url === 'string' ? raw.base_url : '';
        // The provider JSON stores the FULL chat-completions URL; unify to
        // the root so the registry form matches every other adapter.
        baseUrl = baseUrl.replace(/\/chat\/completions$/i, '');
        modelProviders.push({
          id: name,
          name: typeof raw.display_name === 'string' ? raw.display_name : name,
          type: engine === 'anthropic' ? 'anthropic' : 'openai-compatible',
          enabled: raw.enabled !== false,
          priority: 0,
          config: {
            ...(baseUrl ? { baseUrl } : {}),
            // Only the env-var NAME is stored — the key itself lives in the
            // goose secret store, never in this config.
            ...(typeof raw.api_key_env === 'string' ? { apiKeyEnv: raw.api_key_env } : {}),
            ...(engine !== 'openai' && engine !== 'anthropic' ? { gooseEngine: engine } : {}),
            ...(this.isRecord(raw.headers) ? { headers: raw.headers } : {}),
          },
        } as ModelProvider);
        if (Array.isArray(raw.models)) {
          for (const m of raw.models) {
            if (!this.isRecord(m)) continue;
            const id = typeof m.name === 'string' ? m.name : '';
            if (!id) continue;
            models.push({
              id,
              providerId: name,
              name: id,
              displayName: id,
              roles: ['chat', 'edit', 'apply', 'summarize'],
              capabilities: ['tool_use'],
              contextLength: typeof m.context_limit === 'number' ? m.context_limit : undefined,
            } as ModelConfig);
          }
        }
      } catch {
        // Malformed provider file: skip rather than fail the whole read.
      }
    }
    return { modelProviders, models };
  }

  private async encodeCustomProviders(
    configRaw: Record<string, unknown>,
    providers: ModelProvider[],
    models: ModelConfig[]
  ): Promise<void> {
    const dir = this.customProvidersDir();
    // Snapshot existing files so providers removed from the registry are
    // dropped from disk too.
    let existing: string[] = [];
    try {
      existing = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    } catch {
      existing = [];
    }
    const keep = new Set<string>();
    for (const p of providers) {
      const cfg = (p.config || {}) as Record<string, unknown>;
      const engine =
        typeof cfg.gooseEngine === 'string'
          ? cfg.gooseEngine
          : p.type === 'anthropic'
            ? 'anthropic'
            : 'openai';
      // api_key_env: reuse the configured name, or derive a deterministic one.
      const apiKeyEnv =
        typeof cfg.apiKeyEnv === 'string' && cfg.apiKeyEnv
          ? cfg.apiKeyEnv
          : `${p.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
      const baseUrl = String(cfg.baseUrl || '').replace(/\/+$/, '');
      const providerModels = models.filter((m) => m.providerId === p.id);
      const json: Record<string, unknown> = {
        name: p.id,
        engine,
        display_name: p.name || p.id,
        api_key_env: apiKeyEnv,
        // goose expects the FULL chat-completions URL for openai engines.
        base_url:
          engine === 'openai' && baseUrl
            ? `${baseUrl.replace(/\/chat\/completions$/i, '')}/chat/completions`
            : baseUrl,
        models: providerModels.map((m) => ({
          name: m.name || m.id,
          ...(m.contextLength ? { context_limit: m.contextLength } : {}),
        })),
        supports_streaming: true,
        requires_auth: Boolean(cfg.apiKey || cfg.apiKeyEnv),
      };
      keep.add(`${p.id}.json`);
      const filePath = `${dir}/${p.id}.json`;
      await writeFileSafe(filePath, `${JSON.stringify(json, null, 2)}\n`).catch(() => undefined);
      // Persist the literal key into goose's file-based secret store when the
      // registry holds one (goose ignores keys in config.yaml by design).
      if (typeof cfg.apiKey === 'string' && cfg.apiKey) {
        await this.writeGooseSecret(apiKeyEnv, cfg.apiKey).catch(() => undefined);
      }
    }
    for (const file of existing) {
      if (!keep.has(file)) {
        await fs.rm(`${dir}/${file}`, { force: true }).catch(() => undefined);
      }
    }
    // Point active_provider at the first managed provider when the current
    // value dangles or is absent.
    if (providers.length > 0) {
      const first = providers[0].id;
      const current = typeof configRaw.active_provider === 'string' ? configRaw.active_provider : '';
      if (!current || !providers.some((p) => p.id === current)) {
        configRaw.active_provider = first;
      }
    }
  }

  /** Merge one key into ~/.config/goose/secrets.yaml (goose file-secret store). */
  private async writeGooseSecret(key: string, value: string): Promise<void> {
    const secretsPath = `${this.configPathFor().replace(/config\.yaml$/, '')}secrets.yaml`;
    let raw: Record<string, unknown> = {};
    const content = await readFileSafe(secretsPath);
    if (content) {
      try {
        const parsed = parseConfig(content, 'yaml');
        if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>;
      } catch {
        raw = {};
      }
    }
    raw[key] = value;
    await writeFileSafe(secretsPath, stringifyConfig(raw, 'yaml'));
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
