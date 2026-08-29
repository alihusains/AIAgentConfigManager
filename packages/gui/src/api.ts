/**
 * API client for the local config server.
 *
 * The GUI is a pure API client: every mutation goes through the REST API
 * served by the `ai-config gui` CLI command. No filesystem or core code is
 * ever imported here — only shared *types* from @ai-agent-config/core.
 */
import type {
  DetectedAgent,
  RegistryState,
  CustomAgentDef,
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  ProviderVerificationResult,
  ProviderApiCapabilities,
  AgentJob,
  AgentCatalogEntry,
  Platform,
  CliToolStatus,
  ToolUpdateStatus,
  SkillDef,
  SkillsSnapshot,
  EnvVarEntry,
  MutateEnvVarResult,
} from '@ai-agent-config/core';

// ============================================================================
// Token
// ============================================================================

const TOKEN_KEY = 'ai-config-token';
let cachedToken: string | null = null;

declare global {
  interface Window {
    /** Injected into index.html by the local config server at serve time. */
    __AI_CONFIG_TOKEN__?: string;
  }
}

/**
 * The per-launch token arrives injected in the served HTML
 * (window.__AI_CONFIG_TOKEN__) so it never appears in the URL. Legacy ?t=
 * links are still honored and persisted for the session.
 */
export function getToken(): string {
  const injected = typeof window !== 'undefined' ? window.__AI_CONFIG_TOKEN__ : undefined;
  if (injected) {
    cachedToken = injected;
    try {
      localStorage.setItem(TOKEN_KEY, injected);
    } catch {
      /* ignore */
    }
    return cachedToken;
  }
  if (cachedToken) return cachedToken;
  const fromUrl = new URLSearchParams(window.location.search).get('t');
  cachedToken = fromUrl || localStorage.getItem(TOKEN_KEY) || '';
  if (fromUrl) {
    try {
      localStorage.setItem(TOKEN_KEY, fromUrl);
    } catch {
      /* ignore */
    }
    // Clean the token out of the address bar.
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }
  return cachedToken;
}

// ============================================================================
// Transport
// ============================================================================

export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  /** HTTP status of the response (0 when the server is unreachable) */
  status?: number;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiEnvelope<T>> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        // Token travels in a header — the address bar stays clean.
        ...(token ? { 'x-config-token': token } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return {
      ok: false,
      error: 'Cannot reach the config server. Is `ai-config gui` still running?',
      status: 0,
    };
  }
  // A 401 means the token this browser holds is stale or missing entirely.
  // Drop the cached copy so a next launch with a fresh ?t= URL works again.
  if (res.status === 401) {
    cachedToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
  try {
    const json = (await res.json()) as ApiEnvelope<T>;
    // Server responses always carry `ok`; attach the status for auth handling.
    return { ...json, status: json.status ?? res.status };
  } catch {
    return {
      ok: false,
      error: `Server returned HTTP ${res.status}`,
      status: res.status,
    };
  }
}

// ============================================================================
// State / types
// ============================================================================

export interface FullState {
  agents: DetectedAgent[];
  registry: RegistryState;
  platform: string;
}

export interface RawConfigResult {
  path: string;
  content: string;
  exists: boolean;
}

/** Catalog entry merged with live detection (from GET /api/agents/catalog). */
export interface CatalogAgent extends AgentCatalogEntry {
  known: boolean;
  installed: boolean;
  /** Live detection data — present for installed agents. */
  detected?: DetectedAgent;
}

export interface AgentCatalogResponse {
  platform: Platform;
  agents: CatalogAgent[];
  meta: { version: number; updatedAt: string };
}

// ============================================================================
// API surface
// ============================================================================

export const api = {
  // --- State ---
  getState: () => request<FullState>('GET', '/api/state'),

  // --- System stats (live RAM meter) ---
  getSystemStats: () =>
    request<{
      rssBytes: number;
      heapUsedBytes: number;
      heapTotalBytes: number;
      externalBytes: number;
      uptimeSec: number;
      processId: number;
      startedAt: string;
    }>('GET', '/api/system/stats'),

  // --- CLI/environment tools (node, npm, pnpm, bun, git, …) ---
  /** Re-detect installed CLIs (the user's 'Check' action). */
  getTools: () =>
    request<{
      platform: string;
      checkedAt: string;
      tools: CliToolStatus[];
    }>('GET', '/api/tools'),
  /**
   * Re-detect tools AND compare installed versions against the npm registry
   * for the package managers (npm/pnpm/yarn/bun). User-triggered only —
   * never polled.
   */
  getToolUpdateCheck: () =>
    request<{
      platform: string;
      checkedAt: string;
      tools: CliToolStatus[];
      updates: ToolUpdateStatus[];
    }>('GET', '/api/tools/update-check'),
  /**
   * Run the update for ONE tool as a tracked job (explicit user action).
   * Poll the returned jobId via getAgentJob().
   */
  runToolUpdate: (name: string) =>
    request<{ jobId: string; tool: string; command: string }>(
      'POST',
      `/api/tools/${encodeURIComponent(name)}/update`,
      {}
    ),

  // --- Skills (shared library + assignment to skill-capable agents) ---
  /** Library + skill-capable agents + current assignments in one round-trip. */
  getSkills: () => request<SkillsSnapshot>('GET', '/api/skills'),
  /** Create a new skill in the shared library. */
  createSkill: (input: { name: string; description?: string; body?: string }) =>
    request<{ skill: SkillDef }>('POST', '/api/skills', input),
  /** Copy a library skill into an agent's skills directory. */
  assignSkill: (skillId: string, agentId: string) =>
    request<{ targetPath: string }>('POST', `/api/skills/${encodeURIComponent(skillId)}/assign`, {
      agentId,
    }),
  /** Remove a previously assigned skill copy from an agent. */
  unassignSkill: (skillId: string, agentId: string) =>
    request<{ ok: boolean }>('POST', `/api/skills/${encodeURIComponent(skillId)}/unassign`, {
      agentId,
    }),
  /** Copy an installed skill from one agent's skills dir to another's. */
  copySkillToAgent: (skillId: string, sourceAgentId: string, targetAgentId: string) =>
    request<{ targetPath: string }>('POST', `/api/skills/${encodeURIComponent(skillId)}/copy`, {
      sourceAgentId,
      targetAgentId,
    }),
  /** Delete a skill's folder from the shared library (agent copies are untouched). */
  deleteSkill: (skillId: string) =>
    request<{ ok: boolean }>('DELETE', `/api/skills/${encodeURIComponent(skillId)}`),

  // --- Registry import/export ---
  /**
   * Download the server's authoritative registry (QA finding M2: the export
   * used to serialize the GUI's in-memory copy, which can be stale).
   */
  exportRegistry: () => request<RegistryState>('GET', '/api/registry/export'),
  importRegistry: (registry: unknown) =>
    request<{ registry: RegistryState; warnings?: string[] }>('POST', '/api/registry/import', {
      registry,
    }),

  // --- Providers ---
  addProvider: (
    provider: ModelProvider,
    models: ModelConfig[],
    agentIds: string[],
    apiCapabilities?: ProviderApiCapabilities
  ) =>
    request('POST', '/api/providers', {
      provider,
      models,
      agentIds,
      apiCapabilities,
    }),
  updateProvider: (
    id: string,
    patch: {
      provider?: Partial<ModelProvider>;
      models?: ModelConfig[];
      apiCapabilities?: ProviderApiCapabilities;
    }
  ) => request('PUT', `/api/providers/${encodeURIComponent(id)}`, patch),
  /** Probe a candidate endpoint without saving (add/edit forms). */
  verifyProvider: (payload: { baseUrl: string; apiKey?: string }) =>
    request<ProviderVerificationResult>('POST', '/api/providers/verify', payload),
  /** Re-verify a registered provider (stored key, optional manual override). */
  testProvider: (id: string, apiKey?: string) =>
    request<ProviderVerificationResult>('POST', `/api/providers/${encodeURIComponent(id)}/test`, {
      apiKey,
    }),
  addProviderAgents: (id: string, agentIds: string[]) =>
    request('POST', `/api/providers/${encodeURIComponent(id)}/agents`, {
      agentIds,
    }),
  removeProviderAgent: (id: string, agentId: string) =>
    request(
      'DELETE',
      `/api/providers/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`
    ),
  deleteProvider: (id: string) => request('DELETE', `/api/providers/${encodeURIComponent(id)}`),

  // --- MCP servers ---
  addMCP: (server: MCPServerConfig, agentIds: string[]) =>
    request('POST', '/api/mcp', { server, agentIds }),
  updateMCP: (name: string, server: Partial<MCPServerConfig>) =>
    request('PUT', `/api/mcp/${encodeURIComponent(name)}`, { server }),
  addMCPAgents: (name: string, agentIds: string[]) =>
    request('POST', `/api/mcp/${encodeURIComponent(name)}/agents`, {
      agentIds,
    }),
  removeMCPAgent: (name: string, agentId: string) =>
    request('DELETE', `/api/mcp/${encodeURIComponent(name)}/agents/${encodeURIComponent(agentId)}`),
  deleteMCP: (name: string) => request('DELETE', `/api/mcp/${encodeURIComponent(name)}`),

  // --- Custom agents ---
  addCustomAgent: (def: CustomAgentDef) => request('POST', '/api/agents/custom', def),
  updateCustomAgent: (
    id: string,
    updates: Partial<
      Pick<CustomAgentDef, 'name' | 'description' | 'configPath' | 'mcpPath' | 'format'>
    >
  ) => request('PUT', `/api/agents/custom/${encodeURIComponent(id)}`, updates),
  deleteCustomAgent: (id: string) =>
    request('DELETE', `/api/agents/custom/${encodeURIComponent(id)}`),

  // --- Raw config / directory ---
  getAgentConfig: (id: string) =>
    request<RawConfigResult>('GET', `/api/agents/${encodeURIComponent(id)}/config`),
  revealAgent: (id: string, kind: 'config' | 'mcp' | 'model' = 'config') =>
    request<{ dir: string; path: string; kind: string }>(
      'POST',
      `/api/agents/${encodeURIComponent(id)}/reveal`,
      { kind }
    ),
  getAgentRawFile: (id: string, kind: 'config' | 'mcp') =>
    request<{ path: string; content: string; exists: boolean }>(
      'GET',
      `/api/agents/${encodeURIComponent(id)}/raw-file?kind=${kind}`
    ),
  saveAgentRawFile: (id: string, kind: 'config' | 'mcp', content: string) =>
    request<{ path: string; backupPath: string | null }>(
      'PUT',
      `/api/agents/${encodeURIComponent(id)}/raw-file?kind=${kind}`,
      { content }
    ),

  // --- Agent catalog + lifecycle (install / uninstall) ---
  getAgentCatalog: () => request<AgentCatalogResponse>('GET', '/api/agents/catalog'),
  installAgent: (id: string) =>
    request<{ jobId: string }>('POST', `/api/agents/${encodeURIComponent(id)}/install`, {}),
  uninstallAgent: (id: string) =>
    request<{ jobId: string }>('POST', `/api/agents/${encodeURIComponent(id)}/uninstall`, {}),
  getAgentJob: (jobId: string) =>
    request<AgentJob>('GET', `/api/agents/jobs/${encodeURIComponent(jobId)}`),

  // --- Environment variables (M048 backend: read/categorize/redact/edit) ---
  /** List env vars; sensitive-looking values arrive redacted by the server. */
  getEnvVars: () => request<{ platform: string; vars: EnvVarEntry[] }>('GET', '/api/env'),
  /** Set (create or update) a user-level env var. */
  setEnvVar: (name: string, value: string) =>
    request<MutateEnvVarResult>('POST', '/api/env', { name, value }),
  /** Deliberate, per-variable unredaction — the only path to a real value. */
  revealEnvVar: (name: string) =>
    request<{ name: string; value: string }>(
      'POST',
      `/api/env/${encodeURIComponent(name)}/reveal`,
      {}
    ),
  /** Remove a user-level env var. */
  removeEnvVar: (name: string) =>
    request<MutateEnvVarResult>('DELETE', `/api/env/${encodeURIComponent(name)}`),

  // --- Update checking ---
  checkAgentUpdate: (id: string) =>
    request<{
      method: 'npm' | 'brew' | 'unsupported';
      currentVersion?: string;
      latestVersion?: string;
      updateAvailable: boolean;
      reason?: string;
    }>('GET', `/api/agents/${encodeURIComponent(id)}/update-check`),
  updateAgent: (id: string) =>
    request<{ jobId: string }>('POST', `/api/agents/${encodeURIComponent(id)}/update`, {}),
};
