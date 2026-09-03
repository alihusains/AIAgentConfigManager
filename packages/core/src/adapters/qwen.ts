/**
 * Qwen Code Adapter
 *
 * Qwen Code (https://github.com/QwenLM/qwen-code) is Alibaba's terminal coding
 * agent. Its global config is at:
 *   - macOS/Linux: ~/.qwen/settings.json
 *   - Windows:     %APPDATA%\\qwen\\settings.json
 *
 * MCP servers live INSIDE settings.json under the `mcpServers` key as a keyed
 * object map (standard mcpServers shape).
 *
 * Model providers also live INSIDE settings.json, but in a DIFFERENT shape than
 * the unified provider/model arrays:
 *   - `modelProviders`: a keyed map `{ "<authType>": ModelConfig[] }` where each
 *     model entry is `{ id, name?, description?, envKey?, baseUrl?,
 *     generationConfig? }`.
 *   - `providerProtocol`: a keyed map `{ "<customId>": "<protocol>" }` that maps
 *     a custom provider id to a built-in protocol. A custom id with no mapping is
 *     skipped by Qwen at runtime, so the adapter always emits one alongside the
 *     provider's models.
 *   - `env`: a keyed map of environment-variable-name -> value. Qwen reads
 *     credentials from `process.env[<envKey>]` at runtime and never stores the
 *     key in the model entry, so the registry's apiKey is materialized into
 *     `env[<envKey>]` (the documented, non-deprecated credential path).
 *
 * Built-in auth types (`openai`, `anthropic`, `gemini`, `vertex-ai`) are routed
 * by Qwen automatically; the adapter uses `openai` for OpenAI-compatible
 * providers and `anthropic` for Anthropic-compatible ones, and a custom
 * `<id>` (mapped via `providerProtocol`) for anything else.
 *
 * Qwen's `modelProviders` merge strategy is REPLACE (the whole section is
 * rewritten), so the adapter rebuilds `modelProviders` + `providerProtocol` from
 * the unified provider/model lists on every write, and preserves any
 * agent-local entries the unified model cannot express (e.g. Qwen OAuth or
 * built-in auth types) via a raw side channel.
 *
 * Source: https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/model-providers.md
 */

import { createGenericAdapter } from './generic';
import type { AgentAdapter, AgentConfig, ModelProvider, ModelConfig } from '../types';

const QWEN_PATHS = {
  darwin: '~/.qwen/settings.json',
  win32: '%APPDATA%\\qwen\\settings.json',
  linux: '~/.qwen/settings.json',
} as const;

// Built-in auth types Qwen routes to their SDK automatically (no providerProtocol
// entry needed). Used to decide whether a custom provider id needs a protocol map.
const BUILTIN_AUTH_TYPES = new Set(['openai', 'anthropic', 'gemini', 'vertex-ai']);

interface QwenModelEntry {
  id?: string;
  name?: string;
  description?: string;
  envKey?: string;
  baseUrl?: string;
  generationConfig?: Record<string, unknown>;
  [key: string]: unknown;
}

interface QwenGenerationConfig {
  contextWindowSize?: number;
  samplingParams?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Map a unified provider type to a Qwen wire protocol (a `providerProtocol` value).
 * Every custom provider id is mapped to one of these; Qwen routes the request to
 * the matching SDK. `openai` is the protocol for any OpenAI-compatible endpoint.
 */
function qwenProtocolFor(provider: ModelProvider): string {
  if (provider.type === 'anthropic') return 'anthropic';
  if (provider.type === 'google') return 'gemini';
  return 'openai';
}

/**
 * The Qwen provider id (the `modelProviders` key) for a unified provider.
 *
 * Qwen addresses providers by a custom id mapped via `providerProtocol`. We use
 * the unified provider's own `id` as that key — this is exactly the documented
 * pattern for OpenAI/Anthropic-compatible providers (a custom id + baseUrl +
 * envKey + a protocol mapping). Using the provider's own id (rather than the
 * `openai` built-in) is what makes the custom `baseUrl` + `envKey` take effect;
 * the `openai` built-in would instead read `OPENAI_API_KEY` and hit OpenAI's
 * endpoint, which is wrong for a gateway.
 */
function qwenProviderIdFor(provider: ModelProvider): string {
  return provider.id;
}

/**
 * Decode a Qwen settings.json into unified providers + models.
 * Returns null when there is no `modelProviders` section (nothing to manage).
 * Agent-local entries (built-in auth types, Qwen OAuth, etc.) that the unified
 * model cannot express are preserved verbatim on the provider's `config._raw`.
 */
export function decodeQwenSettings(
  raw: Record<string, unknown>
): { modelProviders: ModelProvider[]; models: ModelConfig[] } | null {
  const modelProvidersRaw = raw.modelProviders;
  if (
    !modelProvidersRaw ||
    typeof modelProvidersRaw !== 'object' ||
    Array.isArray(modelProvidersRaw)
  ) {
    return null;
  }
  const protocolRaw =
    raw.providerProtocol &&
    typeof raw.providerProtocol === 'object' &&
    !Array.isArray(raw.providerProtocol)
      ? (raw.providerProtocol as Record<string, unknown>)
      : {};
  const envRaw =
    raw.env && typeof raw.env === 'object' && !Array.isArray(raw.env)
      ? (raw.env as Record<string, unknown>)
      : {};

  const modelProviders: ModelProvider[] = [];
  const models: ModelConfig[] = [];
  let priority = 0;

  for (const [authType, value] of Object.entries(modelProvidersRaw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const entries = value.filter((e): e is QwenModelEntry => Boolean(e) && typeof e === 'object');

    const isBuiltin = BUILTIN_AUTH_TYPES.has(authType);
    // Provider-level baseUrl/apiKey for drift comparison: Qwen stores these per
    // model, so take them from the first model entry (the registry target also
    // carries a single provider-level baseUrl/apiKey). The credential value
    // lives in env[envKey], not in the model entry.
    const firstEntry = entries.find((e) => e.id);
    const firstEnvKey = typeof firstEntry?.envKey === 'string' ? firstEntry.envKey : undefined;
    const provider: ModelProvider = {
      id: authType,
      name: authType,
      type: authType === 'anthropic' ? 'anthropic' : 'openai-compatible',
      config: {
        ...(firstEntry?.baseUrl ? { baseUrl: firstEntry.baseUrl } : {}),
        ...(firstEnvKey && typeof envRaw[firstEnvKey] === 'string'
          ? { apiKey: envRaw[firstEnvKey] }
          : {}),
        // Built-in auth types carry no baseUrl at the provider level; custom ids
        // may. Preserve the raw protocol mapping on a side channel for round-trip.
        ...(isBuiltin ? {} : { _protocol: protocolRaw[authType] }),
        _authType: authType,
      },
      enabled: true,
      priority: priority++,
    };
    modelProviders.push(provider);

    for (const entry of entries) {
      if (!entry.id) continue;
      const gen = entry.generationConfig as QwenGenerationConfig | undefined;
      const sampling = gen?.samplingParams as Record<string, unknown> | undefined;
      const envKey = typeof entry.envKey === 'string' ? entry.envKey : undefined;
      const capabilities: NonNullable<ModelConfig['capabilities']> = [];
      if (gen?.modalities && (gen.modalities as Record<string, unknown>).image)
        capabilities.push('vision');

      models.push({
        id: entry.id,
        providerId: authType,
        name: entry.name || entry.id,
        displayName: entry.name || entry.id,
        roles: ['chat', 'edit', 'apply', 'summarize'],
        contextLength:
          typeof gen?.contextWindowSize === 'number' ? gen.contextWindowSize : undefined,
        maxTokens: typeof sampling?.max_tokens === 'number' ? sampling.max_tokens : undefined,
        temperature: typeof sampling?.temperature === 'number' ? sampling.temperature : undefined,
        topP: typeof sampling?.top_p === 'number' ? sampling.top_p : undefined,
        capabilities: capabilities.length > 0 ? capabilities : undefined,
        customOptions: {
          // Side channel for round-trip fidelity: baseUrl, envKey, description,
          // and any raw generationConfig the unified model can't hold.
          _raw: {
            baseUrl: entry.baseUrl,
            envKey,
            description: entry.description,
            generationConfig: gen,
          },
          // The credential value lives in env[envKey], not here.
          apiKey: envKey
            ? typeof envRaw[envKey] === 'string'
              ? envRaw[envKey]
              : undefined
            : undefined,
        },
      });
    }
  }

  return { modelProviders, models };
}

/**
 * Serialize unified providers/models back into Qwen's settings.json shape.
 * Rebuilds `modelProviders` (keyed by auth type) and `providerProtocol` (for
 * custom ids), and merges each provider's apiKey into `env[<envKey>]`.
 * Agent-local entries preserved on `config._raw` are re-emitted verbatim.
 */
export function encodeQwenSettings(
  config: AgentConfig,
  raw: Record<string, unknown> | null
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(raw || {}) };

  // Qwen keeps MCP servers and model providers in the SAME settings.json. The
  // generic writeConfig writes the main file (MCP) first, then the provider
  // store (this function) to the same path — so this encode must re-emit the
  // MCP servers too, otherwise the provider-store write clobbers the MCP update.
  if (config.mcpServers.length > 0) {
    out.mcpServers = Object.fromEntries(
      config.mcpServers.map((s) => {
        const { name, ...rest } = s;
        return [name, rest];
      })
    );
  } else if (raw?.mcpServers !== undefined) {
    // Preserve the existing mcpServers object verbatim when there are none to
    // manage (e.g. a no-op provider write must not drop user's MCP servers).
    out.mcpServers = raw.mcpServers;
  }

  const modelProvidersOut: Record<string, QwenModelEntry[]> = {};
  const protocolOut: Record<string, string> = {};
  const envOut: Record<string, unknown> = {
    ...((raw?.env as Record<string, unknown> | undefined) || {}),
  };
  // Track which env keys are owned by registry providers so stale ones (from
  // removed providers) can be pruned without touching unrelated env vars.
  const managedEnvKeys = new Set<string>();

  for (const p of config.modelProviders) {
    const cfg = p.config as {
      _authType?: string;
      _protocol?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    // Use the provider's own id as the Qwen provider key so the custom baseUrl
    // + envKey take effect; fall back to a stored _authType (from a read) which
    // is already the Qwen key on disk.
    const providerId = cfg._authType ?? qwenProviderIdFor(p);
    const isBuiltin = BUILTIN_AUTH_TYPES.has(providerId);
    if (!modelProvidersOut[providerId]) modelProvidersOut[providerId] = [];
    const list = modelProvidersOut[providerId];

    const pModels = config.models.filter((m) => m.providerId === p.id);
    for (const m of pModels) {
      const side = m.customOptions as
        | {
            _raw?: {
              baseUrl?: string;
              envKey?: string;
              name?: string;
              description?: string;
              generationConfig?: QwenGenerationConfig;
            };
          }
        | undefined;
      const rawModel = side?._raw ?? {};
      const envKey =
        rawModel.envKey ?? `QWEN_${p.id.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}_KEY`;
      const gen: QwenGenerationConfig = { ...(rawModel.generationConfig ?? {}) };
      const sampling: Record<string, unknown> = { ...(gen.samplingParams ?? {}) };
      if (m.contextLength !== undefined) gen.contextWindowSize = m.contextLength;
      if (m.maxTokens !== undefined) sampling.max_tokens = m.maxTokens;
      if (m.temperature !== undefined) sampling.temperature = m.temperature;
      if (m.topP !== undefined) sampling.top_p = m.topP;
      if (Object.keys(sampling).length > 0) gen.samplingParams = sampling;

      const entry: QwenModelEntry = {
        id: m.id,
        ...(rawModel.name ? { name: rawModel.name } : {}),
        ...(rawModel.description ? { description: rawModel.description } : {}),
        envKey,
        ...((rawModel.baseUrl ?? (typeof cfg.baseUrl === 'string' ? cfg.baseUrl : undefined))
          ? { baseUrl: rawModel.baseUrl ?? cfg.baseUrl }
          : {}),
        ...(Object.keys(gen).length > 0 ? { generationConfig: gen } : {}),
      };
      list.push(entry);

      // Materialize the credential into env[envKey] so Qwen can read it at runtime.
      if (typeof cfg.apiKey === 'string' && cfg.apiKey.length > 0) {
        envOut[envKey] = cfg.apiKey;
      }
      managedEnvKeys.add(envKey);
    }

    // Custom (non-builtin) ids must be mapped to a protocol or Qwen skips them.
    if (!isBuiltin) {
      protocolOut[providerId] = cfg._protocol ?? qwenProtocolFor(p);
    }
  }

  out.modelProviders = modelProvidersOut;
  if (Object.keys(modelProvidersOut).length === 0 && !raw?.modelProviders) {
    // No providers to manage and none on disk — don't pollute the file with an
    // empty section (e.g. an MCP-only write must not add `modelProviders: {}`).
    delete out.modelProviders;
  }
  if (Object.keys(protocolOut).length > 0) out.providerProtocol = protocolOut;
  else delete out.providerProtocol;
  // Prune env keys that were referenced by models on the previous read but are
  // no longer referenced by any current model (their provider was removed).
  // User-set env vars not tied to any model are preserved.
  const previouslyManaged = new Set<string>();
  const rawMps = (raw?.modelProviders as Record<string, QwenModelEntry[]> | undefined) || {};
  for (const entries of Object.values(rawMps)) {
    for (const e of entries) if (typeof e.envKey === 'string') previouslyManaged.add(e.envKey);
  }
  for (const key of Object.keys(envOut)) {
    if (managedEnvKeys.has(key)) continue; // still referenced by a current model
    if (previouslyManaged.has(key)) delete envOut[key]; // was a managed key, now orphaned
  }
  if (Object.keys(envOut).length > 0) out.env = envOut;
  else delete out.env;
  return out;
}

/**
 * Create a Qwen Code adapter.
 */
export function createQwenAdapter(): AgentAdapter {
  const adapter = createGenericAdapter({
    id: 'qwen',
    name: 'Qwen Code',
    description: "Qwen Code — Alibaba's terminal coding agent (providers + MCP via settings.json).",
    binaries: ['qwen'],
    configPath: QWEN_PATHS.darwin,
    configPaths: {
      darwin: QWEN_PATHS.darwin,
      win32: QWEN_PATHS.win32,
      linux: QWEN_PATHS.linux,
    },
    format: 'json',
    mcpShape: 'keyed',
    // Model providers + models live in the same settings.json file, decoded/
    // encoded in Qwen's own shape (modelProviders keyed map + providerProtocol
    // + env credential map) rather than the unified arrays.
    providerStorePath: QWEN_PATHS.darwin,
    providerStorePaths: {
      darwin: QWEN_PATHS.darwin,
      win32: QWEN_PATHS.win32,
      linux: QWEN_PATHS.linux,
    },
    decodeProviderStore: decodeQwenSettings,
    encodeProviderStore: encodeQwenSettings,
    modelConfigPaths: {
      darwin: [QWEN_PATHS.darwin],
      win32: [QWEN_PATHS.win32],
      linux: [QWEN_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.qwen/mcp-oauth-tokens.json', '~/.qwen/.env'],
      win32: ['%APPDATA%\\qwen\\mcp-oauth-tokens.json', '%APPDATA%\\qwen\\.env'],
      linux: ['~/.qwen/mcp-oauth-tokens.json', '~/.qwen/.env'],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  });

  // Wire-format projection for drift comparison (M071): the registry-managed
  // fields are baseUrl + apiKey. The adapter-stamped side-channel keys
  // (_protocol, _authType) are Qwen's own bookkeeping and must not count as
  // out-of-band edits, otherwise every clean materialization reports phantom
  // drift that no resync can clear.
  adapter.expressibleProviderConfig = (config: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    if (config.baseUrl !== undefined) out.baseUrl = config.baseUrl;
    if (config.apiKey !== undefined) out.apiKey = config.apiKey;
    return out;
  };

  return adapter;
}
