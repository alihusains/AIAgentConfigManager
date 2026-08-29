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

/** Upsert a provider definition + its models; returns the updated registry. */
export function upsertProvider(
  registry: Registry,
  provider: ModelProvider,
  models: ModelConfig[],
  apiCapabilities?: RegistryProvider['apiCapabilities']
): Registry {
  const index = registry.providers.findIndex((p) => p.provider.id === provider.id);
  if (index === -1) {
    registry.providers.push({
      provider,
      models,
      agentIds: [],
      ...(apiCapabilities ? { apiCapabilities } : {}),
    });
  } else {
    registry.providers[index] = {
      ...registry.providers[index],
      provider,
      models,
      ...(apiCapabilities ? { apiCapabilities } : {}),
    };
  }
  return registry;
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
