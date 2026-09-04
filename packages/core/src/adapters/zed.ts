/**
 * Zed Editor Adapter
 *
 * Zed (https://zed.dev) keeps its user settings at:
 *   - macOS/Linux: ~/.config/zed/settings.json
 *   - Windows:     %APPDATA%\Zed\settings.json
 *
 * MCP servers live INSIDE settings.json under the `context_servers` key as a
 * keyed map (NOT `mcpServers`):
 *
 *   "context_servers": {
 *     "local":  { "command": "some-command", "args": ["arg-1"], "env": {} },
 *     "remote": { "url": "https://example.com/mcp", "headers": { ... } }
 *   }
 *
 * Zed has no per-server enabled flag — a server exists in the map or it does
 * not. This adapter subclasses the generic (keyed) adapter only to alias
 * `context_servers` onto the base adapter's `mcpServers` seam:
 *   - read:  after super.readConfig(), copy context_servers → mcpServers in
 *            mainRawCache so decodeMCPRaw and encodeMCP's merge see it.
 *   - write: after super.writeConfig(), move the encoded mcpServers map back
 *            onto context_servers and rewrite the file.
 * Every other settings.json key is preserved by the base adapter.
 *
 * Source: https://zed.dev/docs/ai/mcp
 */

import { GenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter, AgentConfig, ModelProvider, ModelConfig } from '../types';
import { writeFileSafe, stringifyConfig } from '../utils';

// Custom OpenAI-compatible providers live in the SAME settings.json under
// language_models.openai_compatible.<id> (api_url / custom_headers /
// available_models[]); API keys go in the <ID>_API_KEY env var or Zed's
// keychain — never in settings.json (docs: zed.dev/docs/ai/use-api-access).

const ZED_CONFIG_PATHS = {
  darwin: '~/.config/zed/settings.json',
  win32: '%APPDATA%\\Zed\\settings.json',
  linux: '~/.config/zed/settings.json',
} as const;

class ZedAdapter extends GenericAdapter {
  /**
   * After the base read, alias context_servers → mcpServers in mainRawCache
   * so the keyed decoder and the encodeMCP merge both see the right key.
   */
  override async readConfig(): Promise<AgentConfig> {
    const config = await super.readConfig();
    // SAFETY: mainRawCache is a private GenericAdapter field of exactly
    // this type; the cast only bypasses the access modifier, not the type.
    const self = this as unknown as { mainRawCache: Record<string, unknown> | null };
    const main = self.mainRawCache;
    if (main && main.context_servers !== undefined) {
      // The base read decoded mcpServers from main.mcpServers (absent for
      // Zed), so config.mcpServers is stale — re-decode from the alias.
      main.mcpServers = main.context_servers;
      // Re-decode: the base already ran decodeMCPRaw on the (absent)
      // mcpServers key, so we re-decode from the aliased key here.
      config.mcpServers = this.decodeFromRaw(main.context_servers);
    }
    // Decode language_models.openai_compatible.* into the unified lists.
    const { modelProviders, models } = this.decodeZedProviders(main);
    config.modelProviders = modelProviders;
    config.models = models;
    return config;
  }

  /**
   * After the base write, move the encoded mcpServers map back onto
   * context_servers and rewrite the file (the base wrote mcpServers).
   */
  override async writeConfig(config: AgentConfig): Promise<void> {
    await super.writeConfig(config);
    // SAFETY: same private-field access as in readConfig — modifier bypass only.
    const self = this as unknown as { mainRawCache: Record<string, unknown> | null };
    const main = self.mainRawCache;
    if (!main) return;
    if (main.mcpServers !== undefined) {
      main.context_servers = main.mcpServers;
      delete main.mcpServers;
      self.mainRawCache = main;
    }
    this.encodeZedProviders(main, config.modelProviders, config.models);
    // The generic base writes the unified lists straight into the main
    // file — Zed's schema has no such keys; drop them (the real provider
    // data lives in language_models.openai_compatible).
    delete main.modelProviders;
    delete main.models;
    // Rewrite the file with context_servers (not mcpServers)
    const filePath = this.getConfigPath();
    await writeFileSafe(filePath, stringifyConfig(main, 'json'));
  }

  // ==========================================================================
  // language_models.openai_compatible conversion (unified <-> settings.json)
  //
  // Zed stores custom OpenAI-compatible providers under
  // language_models.openai_compatible.<provider-id>:
  //   { "api_url": "https://example.com/v1",
  //     "custom_headers": {},
  //     "available_models": [{ "name", "display_name", "max_tokens",
  //                            "max_output_tokens", "capabilities" }] }
  //
  // API keys NEVER live in settings.json — they go in the provider env var
  // derived from the id (<ID>_API_KEY) or Zed's keychain. The adapter keeps
  // the env-var NAME in provider.config.apiKeyEnv for reference.
  // (https://zed.dev/docs/ai/use-api-access)
  // ==========================================================================

  private decodeZedProviders(main: Record<string, unknown> | null): {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
  } {
    const lm =
      main && main.language_models && typeof main.language_models === 'object'
        ? (main.language_models as Record<string, unknown>)
        : {};
    const compat =
      lm.openai_compatible && typeof lm.openai_compatible === 'object'
        ? (lm.openai_compatible as Record<string, unknown>)
        : {};
    const modelProviders: ModelProvider[] = [];
    const models: ModelConfig[] = [];
    for (const [id, entry] of Object.entries(compat)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      modelProviders.push({
        id,
        name: id,
        type: 'openai-compatible',
        enabled: true,
        priority: 0,
        config: {
          ...(typeof e.api_url === 'string' ? { baseUrl: e.api_url } : {}),
          ...(e.custom_headers && typeof e.custom_headers === 'object'
            ? { headers: e.custom_headers }
            : {}),
          apiKeyEnv: `${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`,
        },
      } as ModelProvider);
      if (Array.isArray(e.available_models)) {
        for (const m of e.available_models) {
          if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
          const me = m as Record<string, unknown>;
          const name = typeof me.name === 'string' ? me.name : '';
          if (!name) continue;
          models.push({
            id: name,
            providerId: id,
            name,
            displayName:
              typeof me.display_name === 'string' && me.display_name ? me.display_name : name,
            roles: ['chat', 'edit', 'apply', 'summarize'],
            capabilities: ['tool_use'],
            contextLength: typeof me.max_tokens === 'number' ? me.max_tokens : undefined,
            maxTokens:
              typeof me.max_output_tokens === 'number' ? me.max_output_tokens : undefined,
          } as ModelConfig);
        }
      }
    }
    return { modelProviders, models };
  }

  private encodeZedProviders(
    main: Record<string, unknown>,
    providers: ModelProvider[],
    models: ModelConfig[]
  ): void {
    const priorLM =
      main.language_models && typeof main.language_models === 'object'
        ? (main.language_models as Record<string, unknown>)
        : {};
    const priorCompat: Record<string, unknown> =
      priorLM.openai_compatible && typeof priorLM.openai_compatible === 'object'
        ? (priorLM.openai_compatible as Record<string, unknown>)
        : {};
    const compat: Record<string, unknown> = {};
    for (const p of providers) {
      if (p.type !== 'openai-compatible' && p.type !== 'custom') continue;
      const prior = priorCompat[p.id];
      const priorObj =
        prior && typeof prior === 'object' && !Array.isArray(prior)
          ? (prior as Record<string, unknown>)
          : {};
      const cfg = (p.config || {}) as Record<string, unknown>;
      const mine = models.filter((m) => m.providerId === p.id);
      // Skip providers with no models — zed requires available_models.
      if (mine.length === 0 && !priorObj.available_models) continue;
      compat[p.id] = {
        ...priorObj,
        ...(cfg.baseUrl ? { api_url: cfg.baseUrl } : {}),
        ...(cfg.headers && typeof cfg.headers === 'object'
          ? { custom_headers: cfg.headers }
          : {}),
        available_models: mine.map((m) => ({
          name: m.name || m.id,
          display_name: m.displayName || m.name || m.id,
          ...(m.contextLength ? { max_tokens: m.contextLength } : {}),
          ...(m.maxTokens ? { max_output_tokens: m.maxTokens } : {}),
        })),
      };
    }
    // Only write the block when there is content — an empty map would wipe
    // hand-written providers if fed an empty list.
    if (Object.keys(compat).length > 0 || Object.keys(priorCompat).length > 0) {
      main.language_models = { ...priorLM, openai_compatible: compat };
    }
  }

  /**
   * Decode a keyed MCP map from raw JSON (mirrors the base decodeMCPRaw for
   * the keyed shape). Extracted here so readConfig can re-decode after
   * aliasing context_servers → mcpServers.
   */
  private decodeFromRaw(raw: unknown): AgentConfig['mcpServers'] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const out: AgentConfig['mcpServers'] = [];
    for (const [name, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      const command = e.command;
      const isUrl = typeof e.url === 'string';
      out.push({
        name,
        type: isUrl ? 'http' : 'stdio',
        command:
          Array.isArray(command) && typeof command[0] === 'string'
            ? command[0]
            : typeof command === 'string'
              ? command
              : undefined,
        args: Array.isArray(command)
          ? (command.slice(1) as string[])
          : Array.isArray(e.args)
            ? (e.args as string[])
            : undefined,
        env:
          e.env && typeof e.env === 'object' && !Array.isArray(e.env)
            ? (e.env as Record<string, string>)
            : undefined,
        url: typeof e.url === 'string' ? e.url : undefined,
        headers:
          e.headers && typeof e.headers === 'object' && !Array.isArray(e.headers)
            ? (e.headers as Record<string, string>)
            : undefined,
        enabled: e.enabled !== false,
      });
    }
    return out;
  }
}

/**
 * Create a Zed adapter.
 */
export function createZedAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'zed',
    name: 'Zed',
    description:
      'Zed — high-performance editor with a built-in AI agent (MCP via context_servers).',
    binaries: ['zed'],
    configPath: ZED_CONFIG_PATHS.darwin,
    configPaths: { ...ZED_CONFIG_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [ZED_CONFIG_PATHS.darwin],
      win32: [ZED_CONFIG_PATHS.win32],
      linux: [ZED_CONFIG_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.local/share/zed/auth.json'],
      win32: ['%APPDATA%\\Zed\\auth.json'],
      linux: ['~/.local/share/zed/auth.json'],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  const adapter = new ZedAdapter(options);
  /**
   * Drift projection: language_models.openai_compatible expresses api_url +
   * custom_headers. The apiKey env-var name is registry bookkeeping (the
   * actual key lives in Zed's keychain/env, never settings.json).
   */
  adapter.expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.headers !== undefined) out.headers = config.headers;
    return out;
  };
  return adapter;
}
