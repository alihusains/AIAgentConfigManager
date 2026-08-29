/**
 * Pi Coding Agent Adapter
 *
 * Pi (https://pi.dev, @earendil-works/pi-coding-agent) stores its runtime
 * state under ~/.pi/agent/ (override: $PI_CODING_AGENT_DIR):
 *   - settings.json  app settings (main config; arbitrary keys preserved)
 *   - models.json    provider/model store — the file Pi's own auth flow
 *                    writes when the user adds a provider inside Pi
 *   - mcp.json       MCP servers — written by the pi-mcp-adapter extension:
 *                    { mcpServers: { "<name>": { command, args, env } },
 *                      imports: [...] }
 *
 * Providers live in models.json as a keyed map:
 *   { providers: { "<id>": { baseUrl, api, apiKey, authHeader,
 *                            models: [{ id, name, reasoning, input,
 *                                       contextWindow, maxTokens }] } } }
 * `api` is "openai-completions" or "anthropic-messages".
 *
 * This adapter treats models.json as its provider store: providers added
 * manually inside Pi are detected on scan, and registry changes are
 * materialized back into the same file (unknown keys preserved), so the
 * manager and Pi's own auth flow stay interoperable.
 *
 * MCP servers are NOT a core Pi feature: they arrive via the
 * `pi-mcp-adapter` extension, which reads ~/.pi/agent/mcp.json. This adapter
 * declares that file as its mcpPath so the registry can install/manage MCP
 * servers there while preserving the `imports` key via unknown-key
 * preservation.
 *
 * Source: https://github.com/earendil-works/pi-coding-agent
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter, AgentConfig, ModelProvider, ModelConfig } from '../types';

const PI_PATHS = {
  darwin: '~/.pi/agent',
  win32: '%USERPROFILE%\\.pi\\agent',
  linux: '~/.pi/agent',
} as const;

// ============================================================================
// models.json (provider store) shapes
// ============================================================================

interface PiModelEntry {
  id?: string;
  name?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

interface PiProviderEntry {
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  authHeader?: boolean;
  models?: PiModelEntry[];
  [key: string]: unknown;
}

const DEFAULT_PI_ROLES: ModelConfig['roles'] = ['chat', 'edit', 'apply', 'summarize'];

/** Map a pi `api` value to a unified provider type (default: openai-compatible). */
function piApiToProviderType(api?: string): ModelProvider['type'] {
  return api === 'anthropic-messages' ? 'anthropic' : 'openai-compatible';
}

function decodePiProviderStore(raw: Record<string, unknown>): {
  modelProviders: ModelProvider[];
  models: ModelConfig[];
} | null {
  const providers = raw.providers;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) return null;

  const modelProviders: ModelProvider[] = [];
  const models: ModelConfig[] = [];
  let priority = 0;

  for (const [id, value] of Object.entries(providers as Record<string, PiProviderEntry>)) {
    const entry = value && typeof value === 'object' ? value : {};
    modelProviders.push({
      id,
      name: id,
      type: piApiToProviderType(entry.api),
      config: {
        baseUrl: entry.baseUrl,
        apiKey: entry.apiKey,
        authHeader: entry.authHeader,
        api: entry.api,
        // Keep the raw entry on a side channel so unknown keys survive a round-trip
        provider: entry,
      },
      enabled: true,
      priority: priority++,
    });

    for (const m of entry.models || []) {
      if (!m || typeof m !== 'object' || !m.id) continue;
      const capabilities: NonNullable<ModelConfig['capabilities']> = [];
      if (m.reasoning) capabilities.push('reasoning');
      if (m.input?.includes('image')) capabilities.push('vision');
      models.push({
        id: m.id,
        providerId: id,
        name: m.name || m.id,
        displayName: m.name || m.id,
        roles: [...DEFAULT_PI_ROLES],
        contextLength: m.contextWindow,
        maxTokens: m.maxTokens,
        capabilities,
        // Raw model entry side channel for round-trip fidelity
        customOptions: { _raw: m },
      });
    }
  }

  return { modelProviders, models };
}

function encodePiProviderStore(
  config: AgentConfig,
  raw: Record<string, unknown> | null
): Record<string, unknown> {
  const rawProviders =
    raw && typeof raw.providers === 'object' && raw.providers !== null
      ? (raw.providers as Record<string, PiProviderEntry>)
      : {};

  const providersOut: Record<string, PiProviderEntry> = {};
  for (const p of config.modelProviders) {
    const cfg = p.config as {
      baseUrl?: string;
      apiKey?: string;
      authHeader?: boolean;
      api?: string;
      provider?: PiProviderEntry;
    };
    // Prefer pi's own on-disk entry, fall back to the decoded side channel
    const prev: PiProviderEntry =
      rawProviders[p.id] ?? (cfg.provider && typeof cfg.provider === 'object' ? cfg.provider : {});
    const entry: PiProviderEntry = { ...prev };
    if (cfg.baseUrl !== undefined) entry.baseUrl = cfg.baseUrl;
    if (cfg.apiKey !== undefined) entry.apiKey = cfg.apiKey;
    if (cfg.authHeader !== undefined) entry.authHeader = cfg.authHeader;
    // pi needs an `api` discriminator; default to chat completions
    entry.api = cfg.api ?? prev.api ?? 'openai-completions';

    // Rebuild models from the unified list, merging unknown raw fields by id
    const rawModels = new Map<string, PiModelEntry>();
    for (const m of prev.models || []) {
      if (m?.id) rawModels.set(m.id, m);
    }
    entry.models = config.models
      .filter((m) => m.providerId === p.id)
      .map((m) => {
        const rawModel =
          rawModels.get(m.id) ??
          ((m.customOptions?._raw && typeof m.customOptions._raw === 'object'
            ? (m.customOptions._raw as PiModelEntry)
            : {}) as PiModelEntry);
        const out: PiModelEntry = {
          ...rawModel,
          id: m.id,
          name: m.name || m.id,
        };
        if (m.contextLength !== undefined) out.contextWindow = m.contextLength;
        if (m.maxTokens !== undefined) out.maxTokens = m.maxTokens;
        if (m.capabilities) {
          out.reasoning = m.capabilities.includes('reasoning');
          out.input =
            m.capabilities.includes('vision') || m.capabilities.includes('image_input')
              ? ['text', 'image']
              : ['text'];
        }
        return out;
      });
    delete (entry as { _raw?: unknown })._raw;
    providersOut[p.id] = entry;
  }

  return { ...(raw || {}), providers: providersOut };
}

/**
 * Create a Pi coding agent adapter.
 */
export function createPiAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'pi',
    name: 'Pi',
    description: 'Pi coding agent (earendil-works, pi.dev) — minimal extensible terminal harness.',
    binaries: ['pi'],
    configPath: `${PI_PATHS.darwin}/settings.json`,
    configPaths: {
      darwin: `${PI_PATHS.darwin}/settings.json`,
      win32: `${PI_PATHS.win32}\\settings.json`,
      linux: `${PI_PATHS.linux}/settings.json`,
    },
    mcpPath: `${PI_PATHS.darwin}/mcp.json`,
    mcpConfigPaths: {
      darwin: `${PI_PATHS.darwin}/mcp.json`,
      win32: `${PI_PATHS.win32}\\mcp.json`,
      linux: `${PI_PATHS.linux}/mcp.json`,
    },
    format: 'json',
    // Pi's MCP file is the keyed map written by pi-mcp-adapter
    mcpShape: 'keyed',
    // Providers/models live in pi's own provider store (models.json), the
    // same file pi's auth flow writes when a provider is added inside Pi.
    providerStorePath: `${PI_PATHS.darwin}/models.json`,
    providerStorePaths: {
      darwin: `${PI_PATHS.darwin}/models.json`,
      win32: `${PI_PATHS.win32}\\models.json`,
      linux: `${PI_PATHS.linux}/models.json`,
    },
    decodeProviderStore: decodePiProviderStore,
    encodeProviderStore: encodePiProviderStore,
    modelConfigPaths: {
      darwin: [`${PI_PATHS.darwin}/settings.json`, `${PI_PATHS.darwin}/models.json`],
      win32: [`${PI_PATHS.win32}\\settings.json`, `${PI_PATHS.win32}\\models.json`],
      linux: [`${PI_PATHS.linux}/settings.json`, `${PI_PATHS.linux}/models.json`],
    },
    supports: {
      modelProviders: true,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return createGenericAdapter(options);
}
