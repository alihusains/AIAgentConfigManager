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
} from '@ai-agent-config/core';

// ============================================================================
// Token
// ============================================================================

const TOKEN_KEY = 'ai-config-token';
let cachedToken: string | null = null;

/** The per-launch token arrives in the URL (?t=...); remember it for fetches. */
export function getToken(): string {
  if (cachedToken) return cachedToken;
  const fromUrl = new URLSearchParams(window.location.search).get('t');
  cachedToken = fromUrl || localStorage.getItem(TOKEN_KEY) || '';
  if (fromUrl) localStorage.setItem(TOKEN_KEY, fromUrl);
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
  body?: unknown,
): Promise<ApiEnvelope<T>> {
  const sep = path.includes('?') ? '&' : '?';
  let res: Response;
  try {
    res = await fetch(`${path}${sep}t=${encodeURIComponent(getToken())}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, error: 'Cannot reach the config server. Is `ai-config gui` still running?', status: 0 };
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
    return { ok: false, error: `Server returned HTTP ${res.status}`, status: res.status };
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

  // --- Registry import ---
  importRegistry: (registry: unknown) =>
    request<{ registry: RegistryState; warnings?: string[] }>(
      'POST',
      '/api/registry/import',
      { registry },
    ),

  // --- Providers ---
  addProvider: (
    provider: ModelProvider,
    models: ModelConfig[],
    agentIds: string[],
    apiCapabilities?: ProviderApiCapabilities,
  ) => request('POST', '/api/providers', { provider, models, agentIds, apiCapabilities }),
  updateProvider: (
    id: string,
    patch: {
      provider?: Partial<ModelProvider>;
      models?: ModelConfig[];
      apiCapabilities?: ProviderApiCapabilities;
    },
  ) => request('PUT', `/api/providers/${encodeURIComponent(id)}`, patch),
  /** Probe a candidate endpoint without saving (add/edit forms). */
  verifyProvider: (payload: { baseUrl: string; apiKey?: string }) =>
    request<ProviderVerificationResult>('POST', '/api/providers/verify', payload),
  /** Re-verify a registered provider (stored key, optional manual override). */
  testProvider: (id: string, apiKey?: string) =>
    request<ProviderVerificationResult>('POST', `/api/providers/${encodeURIComponent(id)}/test`, { apiKey }),
  addProviderAgents: (id: string, agentIds: string[]) =>
    request('POST', `/api/providers/${encodeURIComponent(id)}/agents`, { agentIds }),
  removeProviderAgent: (id: string, agentId: string) =>
    request('DELETE', `/api/providers/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`),
  deleteProvider: (id: string) =>
    request('DELETE', `/api/providers/${encodeURIComponent(id)}`),

  // --- MCP servers ---
  addMCP: (server: MCPServerConfig, agentIds: string[]) =>
    request('POST', '/api/mcp', { server, agentIds }),
  updateMCP: (name: string, server: Partial<MCPServerConfig>) =>
    request('PUT', `/api/mcp/${encodeURIComponent(name)}`, { server }),
  addMCPAgents: (name: string, agentIds: string[]) =>
    request('POST', `/api/mcp/${encodeURIComponent(name)}/agents`, { agentIds }),
  removeMCPAgent: (name: string, agentId: string) =>
    request('DELETE', `/api/mcp/${encodeURIComponent(name)}/agents/${encodeURIComponent(agentId)}`),
  deleteMCP: (name: string) =>
    request('DELETE', `/api/mcp/${encodeURIComponent(name)}`),

  // --- Custom agents ---
  addCustomAgent: (def: CustomAgentDef) => request('POST', '/api/agents/custom', def),
  updateCustomAgent: (
    id: string,
    updates: Partial<Pick<CustomAgentDef, 'name' | 'description' | 'configPath' | 'mcpPath' | 'format'>>,
  ) => request('PUT', `/api/agents/custom/${encodeURIComponent(id)}`, updates),
  deleteCustomAgent: (id: string) =>
    request('DELETE', `/api/agents/custom/${encodeURIComponent(id)}`),

  // --- Raw config / directory ---
  getAgentConfig: (id: string) =>
    request<RawConfigResult>('GET', `/api/agents/${encodeURIComponent(id)}/config`),
  revealAgent: (id: string) =>
    request<{ dir: string }>('POST', `/api/agents/${encodeURIComponent(id)}/reveal`),

  // --- Agent catalog + lifecycle (install / uninstall) ---
  getAgentCatalog: () => request<AgentCatalogResponse>('GET', '/api/agents/catalog'),
  installAgent: (id: string) =>
    request<{ jobId: string }>('POST', `/api/agents/${encodeURIComponent(id)}/install`, {}),
  uninstallAgent: (id: string) =>
    request<{ jobId: string }>('POST', `/api/agents/${encodeURIComponent(id)}/uninstall`, {}),
  getAgentJob: (jobId: string) =>
    request<AgentJob>('GET', `/api/agents/jobs/${encodeURIComponent(jobId)}`),
};