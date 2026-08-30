/**
 * Registry Store — the single source of truth for providers and MCP servers.
 *
 * The registry lives in ONE file on this machine:
 *   macOS/Linux : ~/.ai-agent-config/registry.json   (or $AI_CONFIG_HOME / $XDG_CONFIG_HOME)
 *   Windows     : %APPDATA%\ai-agent-config\registry.json
 *
 * Agent config files (~/.claude/settings.json, ~/.config/opencode/opencode.json, ...)
 * are MATERIALIZED from this registry: edits happen here, agents read their own
 * files as usual. One definition per provider / MCP server — no duplicates.
 */

import {
  type Registry,
  type RegistryProvider,
  RegistryMCPServer,
  type MCPServerConfig,
  type ModelProvider,
  type ModelConfig,
  type MaterializeResult,
} from './types';
import { fileExists, writeFileSafe, readFileSafe } from './utils';
import { getSecret, setSecret, deleteSecret, isKeychainAvailable } from './keychain';
import * as os from 'node:os';
import * as path from 'node:path';

export const REGISTRY_VERSION = 1;

/** Resolve the registry file path for the current OS. */
export function resolveRegistryPath(): string {
  if (process.env.AI_CONFIG_HOME) {
    return path.join(process.env.AI_CONFIG_HOME, 'registry.json');
  }
  const platform = process.platform;
  if (platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'ai-agent-config', 'registry.json');
  }
  if (platform === 'linux' && process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'ai-agent-config', 'registry.json');
  }
  return path.join(os.homedir(), '.ai-agent-config', 'registry.json');
}

export function emptyRegistry(): Registry {
  return {
    version: REGISTRY_VERSION,
    providers: [],
    mcpServers: [],
    customAgents: [],
    updatedAt: Date.now(),
  };
}

export function getRegistryDir(registryPath: string): string {
  return path.dirname(registryPath);
}

/** Read the registry from disk; returns null when it does not exist yet. */
export async function loadRegistry(registryPath: string): Promise<Registry | null> {
  const exists = await fileExists(registryPath);
  if (!exists) return null;
  const content = await readFileSafe(registryPath);
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Registry;
    parsed.providers = parsed.providers || [];
    parsed.mcpServers = parsed.mcpServers || [];
    parsed.customAgents = parsed.customAgents || [];
    // Heal legacy MCP entries that predate the transport-typed schema:
    // entries without `type` are inferred from their payload (command → stdio,
    // url → http). This keeps old registries valid for strict agent schemas.
    for (const entry of parsed.mcpServers) {
      const server = entry.server;
      if (server && !server.type) {
        server.type = server.url ? 'http' : 'stdio';
      }
    }
    return parsed;
  } catch {
    // A corrupt registry file must never brick the tool — treat as empty and
    // let the caller warn the user.
    const registry = emptyRegistry();
    (registry as { corrupt?: boolean }).corrupt = true;
    return registry;
  }
}

/** Persist the registry atomically (write temp file, then rename). */
export async function saveRegistry(registryPath: string, registry: Registry): Promise<void> {
  registry.updatedAt = Date.now();
  const tmp = `${registryPath}.tmp`;
  await writeFileSafe(tmp, JSON.stringify(registry, null, 2));
  const fs = await import('node:fs');
  fs.renameSync(tmp, registryPath);
}

// ============================================================================
// Merge / mutation helpers (immutable-ish: return updated registry copies)
// ============================================================================

/**
 * Upsert a provider definition + its models; returns the updated registry.
 * `keychainSecretRef` is passed through for existing entries (it is an
 * entry-level field, never derived from the provider payload).
 */
export function upsertProvider(
  registry: Registry,
  provider: ModelProvider,
  models: ModelConfig[],
  apiCapabilities?: RegistryProvider['apiCapabilities'],
  keychainSecretRef?: string
): Registry {
  const index = registry.providers.findIndex((p) => p.provider.id === provider.id);
  if (index === -1) {
    registry.providers.push({
      provider,
      models,
      agentIds: [],
      ...(apiCapabilities ? { apiCapabilities } : {}),
      ...(keychainSecretRef ? { keychainSecretRef } : {}),
    });
  } else {
    registry.providers[index] = {
      ...registry.providers[index],
      provider,
      models,
      ...(apiCapabilities ? { apiCapabilities } : {}),
      ...(keychainSecretRef !== undefined
        ? { keychainSecretRef }
        : registry.providers[index].keychainSecretRef
          ? { keychainSecretRef: registry.providers[index].keychainSecretRef }
          : {}),
    };
  }
  return registry;
}

// ============================================================================
// Phase 1 (Secrets): opt-in OS-keychain-backed provider API keys
//
// A NEW provider may opt into keychain storage: the real key goes to the OS
// keychain (account `provider:<providerId>`), the registry entry carries
// `keychainSecretRef`, and `provider.config.apiKey` in registry.json is an
// empty string — the real key never lands in the JSON file. Existing
// plaintext providers are untouched: every path below is additive and only
// active when a caller explicitly opts in (or an entry already carries a
// `keychainSecretRef`).
// ============================================================================

/** Deterministic keychain account reference for a provider's API key. */
export function keychainRefForProvider(providerId: string): string {
  return `provider:${providerId}`;
}

/**
 * Resolve a provider's real API key.
 *
 * - With `keychainSecretRef`: fetches the value from the OS keychain. Returns
 *   `null` (never throws) when the entry is missing or the keychain is
 *   unavailable — the caller decides how to surface that.
 * - Without: returns the plaintext `provider.config.apiKey` unchanged
 *   (full backward compatibility).
 */
export async function resolveProviderApiKey(
  provider: RegistryProvider
): Promise<string | null> {
  if (provider.keychainSecretRef) {
    return getSecret(provider.keychainSecretRef);
  }
  const value = provider.provider.config.apiKey as unknown;
  return typeof value === 'string' ? value : null;
}

/**
 * Opt-in keychain storage for a NEW provider's API key.
 *
 * Stores `realKey` in the OS keychain under `provider:<providerId>`, blanks
 * `provider.config.apiKey` (the real key must never be persisted in
 * registry.json on this path) and returns the secret reference to stamp on
 * the registry entry.
 *
 * Fails cleanly — with a clear error — when the keychain is unavailable or
 * the write throws. It NEVER falls back to plaintext storage: silently
 * degrading would be a security regression, not a UX convenience.
 */
export async function storeProviderApiKeyInKeychain(
  provider: ModelProvider
): Promise<{ keychainSecretRef: string; provider: ModelProvider }> {
  const available = await isKeychainAvailable();
  if (!available) {
    throw new Error(
      'OS keychain is unavailable in this environment — cannot store the API key in the keychain. '
        + 'Registration was NOT saved with a plaintext key. '
        + 'Unlock the keychain (or run on a machine with a keychain) and retry, '
        + 'or register without keychain storage.'
    );
  }
  const keychainSecretRef = keychainRefForProvider(provider.id);
  try {
    await setSecret(keychainSecretRef, provider.config.apiKey as string);
  } catch (err) {
    throw new Error(
      `Failed to write the API key to the OS keychain for provider "${provider.id}": ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        + 'No plaintext copy was written to the registry.'
    );
  }
  // The real key never lands in registry.json on this path.
  const config = { ...provider.config };
  config.apiKey = '';
  return { keychainSecretRef, provider: { ...provider, config } };
}

/**
 * Best-effort keychain cleanup for a deleted provider. A keychain-deletion
 * failure must NOT block the registry deletion (the registry is the source
 * of truth for what exists) — it only logs a warning about the orphaned
 * entry. Returns `true` when the entry was deleted (or already absent).
 */
export async function deleteProviderKeychainSecret(
  provider: RegistryProvider
): Promise<boolean> {
  if (!provider.keychainSecretRef) return true;
  const deleted = await deleteSecret(provider.keychainSecretRef);
  if (!deleted) {
    console.warn(
      `[registry] warning: could not delete keychain entry "${provider.keychainSecretRef}" ` +
        `for provider "${provider.provider.id}" — the credential may be orphaned in the OS keychain. ` +
        + 'Registry deletion proceeded.'
    );
  }
  return deleted;
}

/** Upsert an MCP server definition; returns the updated registry. */
export function upsertMCPServer(registry: Registry, server: MCPServerConfig): Registry {
  const index = registry.mcpServers.findIndex((s) => s.server.name === server.name);
  if (index === -1) {
    registry.mcpServers.push({ server, agentIds: [] });
  } else {
    registry.mcpServers[index] = { ...registry.mcpServers[index], server };
  }
  return registry;
}

/** Add agent ids to a registry provider's coverage (deduped). */
export function addProviderAgents(
  registry: Registry,
  providerId: string,
  agentIds: string[]
): { ok: boolean; error?: string } {
  const entry = registry.providers.find((p) => p.provider.id === providerId);
  if (!entry) return { ok: false, error: `Provider "${providerId}" not found in registry` };
  const set = new Set(entry.agentIds);
  for (const id of agentIds) set.add(id);
  entry.agentIds = Array.from(set);
  return { ok: true };
}

/** Remove an agent from a provider's coverage. */
export function removeProviderAgent(
  registry: Registry,
  providerId: string,
  agentId: string
): Registry {
  const entry = registry.providers.find((p) => p.provider.id === providerId);
  if (entry) {
    entry.agentIds = entry.agentIds.filter((id) => id !== agentId);
  }
  return registry;
}

/** Add agent ids to an MCP server's coverage (deduped). */
export function addMCPServerAgents(
  registry: Registry,
  serverName: string,
  agentIds: string[]
): { ok: boolean; error?: string } {
  const entry = registry.mcpServers.find((s) => s.server.name === serverName);
  if (!entry) return { ok: false, error: `MCP server "${serverName}" not found in registry` };
  const set = new Set(entry.agentIds);
  for (const id of agentIds) set.add(id);
  entry.agentIds = Array.from(set);
  return { ok: true };
}

/** Remove an agent from an MCP server's coverage. */
export function removeMCPServerAgent(
  registry: Registry,
  serverName: string,
  agentId: string
): Registry {
  const entry = registry.mcpServers.find((s) => s.server.name === serverName);
  if (entry) {
    entry.agentIds = entry.agentIds.filter((id) => id !== agentId);
    if (entry.agentOverrides) {
      delete entry.agentOverrides[agentId];
    }
  }
  return registry;
}

// ============================================================================
// Migration — absorb existing agent configs into the registry on first run
// ============================================================================

export interface MigrationInput {
  agentId: string;
  config: {
    modelProviders: ModelProvider[];
    models: ModelConfig[];
    mcpServers: MCPServerConfig[];
  };
}

/**
 * Build a registry from the current state of every agent's config file.
 * Providers and MCP servers found on disk become registry entries with the
 * agent recorded as covered. First-seen definition wins for merges.
 */
export async function migrateFromAgentConfigs(
  inputs: MigrationInput[],
  existing: Registry
): Promise<{ registry: Registry; warnings: string[] }> {
  const registry = {
    ...existing,
    providers: [...existing.providers],
    mcpServers: [...existing.mcpServers],
  };
  const warnings: string[] = [];

  for (const input of inputs) {
    for (const provider of input.config.modelProviders) {
      const entry = registry.providers.find((p) => p.provider.id === provider.id);
      if (entry) {
        // Same provider across agents: record coverage, keep first definition
        if (!entry.agentIds.includes(input.agentId)) entry.agentIds.push(input.agentId);
        continue;
      }
      const models = input.config.models.filter((m) => m.providerId === provider.id);
      registry.providers.push({
        provider,
        models,
        agentIds: [input.agentId],
        migrated: true,
      });
    }

    for (const server of input.config.mcpServers) {
      const entry = registry.mcpServers.find((s) => s.server.name === server.name);
      if (entry) {
        if (!entry.agentIds.includes(input.agentId)) entry.agentIds.push(input.agentId);
        continue;
      }
      registry.mcpServers.push({
        server,
        agentIds: [input.agentId],
        migrated: true,
      });
    }
  }

  return { registry, warnings };
}

/** Aggregate per-agent write results into a MaterializeResult. */
export function aggregateMaterialize(
  results: {
    agentId: string;
    ok: boolean;
    error?: string;
    warning?: string;
  }[]
): MaterializeResult {
  const written: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const r of results) {
    if (r.ok) written.push(r.agentId);
    else errors.push(`${r.agentId}: ${r.error || 'unknown error'}`);
    if (r.warning) warnings.push(r.warning);
  }
  return {
    ok: errors.length === 0,
    written,
    errors,
    warnings,
  };
}
