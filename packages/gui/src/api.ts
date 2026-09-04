/**
 * API client for the local config server.
 *
 * The GUI is a pure API client: every mutation goes through the REST API
 * served by the `ai-config gui` CLI command. No filesystem or core code is
 * ever imported here — only shared *types* from @ai-agent-config/core.
 *
 * Zod schemas are defined locally to validate payloads before sending to the
 * server, preventing malformed requests from reaching the backend.
 */
import { z } from 'zod';
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
  MarketplaceSkillSummary,
  EnvVarEntry,
  MutateEnvVarResult,
} from '@ai-agent-config/core';

// ============================================================================
// Transport
// ============================================================================

export const ModelProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['builtin', 'custom', 'openai-compatible', 'anthropic', 'google', 'azure', 'bedrock', 'vertex']),
  config: z.record(z.unknown()),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
});

export const ModelConfigSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  name: z.string(),
  displayName: z.string(),
  roles: z.array(z.enum(['chat', 'edit', 'apply', 'summarize', 'autocomplete', 'embed', 'rerank'])),
  contextLength: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  capabilities: z
    .array(z.enum(['tool_use', 'image_input', 'reasoning', 'vision', 'code_generation']))
    .optional(),
  customOptions: z.record(z.unknown()).optional(),
});

export const MCPServerConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['stdio', 'http', 'sse', 'streamable-http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().int().positive().optional(),
  enabled: z.boolean(),
  approvalMode: z.enum(['prompt', 'auto', 'never']).optional(),
  tools: z.array(z.string()).optional(),
});

export const PermissionConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['tool', 'directory', 'url', 'command', 'mcp', 'custom']),
  scope: z.enum(['global', 'project']),
  projectPath: z.string().optional(),
  allowed: z.boolean(),
  pattern: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentConfigSchema = z.object({
  version: z.string(),
  lastModified: z.number(),
  modelProviders: z.array(ModelProviderSchema),
  models: z.array(ModelConfigSchema),
  mcpServers: z.array(MCPServerConfigSchema),
  permissions: z.array(PermissionConfigSchema),
  customSettings: z.record(z.unknown()),
});

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
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
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
  try {
    const json = (await res.json()) as ApiEnvelope<T>;
    // Server responses always carry `ok`; attach the status for callers.
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
   * Execute a system CLI command (npm, pnpm, git, docker, etc.)
   * Returns a job ID that can be polled via getAgentJob().
   */
  /** Trending coding agents (OpenRouter ranking) joined with catalog entries. */
  getExploreAgents: () =>
    request<{
      rank: number;
      name: string;
      description: string;
      website: string;
      kind: 'cli' | 'web' | 'desktop';
      catalogId?: string;
      install?: string;
      logo?: string;
      hasAdapter?: boolean;
      catalog: {
        id: string;
        name: string;
        apiTypes: string[];
        status: string;
        install?: string;
        installPlatforms?: string[];
        note?: string;
        github?: string;
        stars?: number;
      } | null;
    }[]>('GET', '/api/agents/explore'),
  /** Execute a canned CLI Manager command by id (the server owns the literal). */
  executeCli: (id: string) =>
    request<{ jobId: string; commandId: string; command: string }>(
      'POST',
      `/api/cli/${encodeURIComponent(id)}/execute`
    ),
  /** The canned command catalog (id, label, description, category, preview). */
  getCliCommands: () =>
    request<{ commands: { id: string; command: string; label: string; description: string; category: string }[] }>(
      'GET',
      '/api/cli/commands'
    ),
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
  createSkill: (input: {
    name: string;
    description?: string;
    body?: string;
    license?: string;
    compatibility?: string;
    allowedTools?: string[];
    metadata?: Record<string, string>;
  }) => request<{ skill: SkillDef }>('POST', '/api/skills', input),
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
  /** Read the SKILL.md content for a skill from a given location (M073). */
  getSkillContent: (skillId: string, location: string) =>
    request<{ content: string }>(
      'GET',
      `/api/skills/${encodeURIComponent(skillId)}/content?location=${encodeURIComponent(location)}`
    ),
  /** Save the SKILL.md content for a skill at a given location (M073). */
  saveSkillContent: (skillId: string, location: string, content: string) =>
    request<{ ok: boolean }>(
      'PUT',
      `/api/skills/${encodeURIComponent(skillId)}/content?location=${encodeURIComponent(location)}`,
      { content }
    ),

  // --- Skill marketplace (M066 backend; every call is user-triggered) ---
  /** List marketplace skills. `force` bypasses the server's 10-min cache. */
  listMarketplaceSkills: (force = false) =>
    request<{ skills: MarketplaceSkillSummary[] }>(
      'GET',
      `/api/marketplace/skills${force ? '?force=1' : ''}`
    ),
  /** Install a marketplace skill into the shared library (never overwrites silently). */
  installMarketplaceSkill: (skillId: string, overwrite = false) =>
    request<{ targetPath: string }>(
      'POST',
      `/api/marketplace/skills/${encodeURIComponent(skillId)}/install`,
      { overwrite }
    ),

  // --- Permissions ---
  /**
   * P2-T2: Audit permissions across all 24 adapters, flag contradictions
   * (e.g., "Cursor allows bash but Claude forbids it"), and compute per-agent
   * and global risk scores.
   */
  auditPermissions: () =>
    request<{
      scannedAt: string;
      totalAgents: number;
      agentsWithPermissions: number;
      perAgent: Array<{
        agentId: string;
        agentName: string;
        totalPermissions: number;
        allowedPatterns: number;
        deniedPatterns: number;
        contradictions: Array<{
          pattern: string;
          type: string;
          allowingAgents: string[];
          denyingAgents: string[];
          riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        }>;
      }>;
      globalContradictions: Array<{
        pattern: string;
        type: string;
        allowingAgents: string[];
        denyingAgents: string[];
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      }>;
      summary: {
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
      };
    }>('GET', '/api/permissions/audit'),

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
  /**
   * OS-keychain capability probe (Phase 1 Secrets). The Add Provider form
   * calls this BEFORE submitting with keychain storage opted in, so the user
   * gets immediate feedback when the keychain is unusable in this
   * environment instead of a failed submission.
   */
  getKeychainAvailability: () => request<{ available: boolean }>('GET', '/api/providers/keychain'),
  addProvider: (
    provider: ModelProvider,
    models: ModelConfig[],
    agentIds: string[],
    apiCapabilities?: ProviderApiCapabilities,
    keychainStorage?: boolean
  ) => {
    const validatedProvider = ModelProviderSchema.parse(provider);
    const validatedModels = models.map((m) => ModelConfigSchema.parse(m));
    return request('POST', '/api/providers', {
      provider: validatedProvider,
      models: validatedModels,
      agentIds,
      apiCapabilities,
      ...(keychainStorage ? { keychainStorage: true } : {}),
    });
  },
  updateProvider: (
    id: string,
    patch: {
      provider?: Partial<ModelProvider>;
      models?: ModelConfig[];
      apiCapabilities?: ProviderApiCapabilities;
    }
  ) => {
    const result: { provider?: ModelProvider; models?: ModelConfig[] } = {};
    if (patch.provider) {
      result.provider = ModelProviderSchema.parse(patch.provider);
    }
    if (patch.models) {
      result.models = patch.models.map((m) => ModelConfigSchema.parse(m));
    }
    return request('PUT', `/api/providers/${encodeURIComponent(id)}`, result);
  },
  /** Probe a candidate endpoint without saving (add/edit forms). */
  verifyProvider: (payload: { baseUrl: string; apiKey?: string }) =>
    request<ProviderVerificationResult>('POST', '/api/providers/verify', payload),
  /** Re-verify a registered provider (stored key, optional manual override). */
  testProvider: (id: string, apiKey?: string) =>
    request<ProviderVerificationResult>('POST', `/api/providers/${encodeURIComponent(id)}/test`, {
      apiKey,
    }),
  /**
   * Phase 1 (Secrets): move an EXISTING provider's plaintext API key into
   * the OS keychain (one provider at a time, explicit user action only).
   */
  migrateProviderToKeychain: (id: string) =>
    request<RegistryState>(
      'POST',
      `/api/providers/${encodeURIComponent(id)}/migrate-to-keychain`,
      {}
    ),
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
  /**
   * Re-probe every provider flagged "Only free models" (config.trackFreeModels),
   * diff the live /models list and push added/removed free models into every
   * agent config. Called once per dashboard open.
   */
  syncFreeModels: () =>
    request<{
      checked: number;
      changed: number;
      results: Array<{
        providerId: string;
        models: string[];
        added: string[];
        removed: string[];
        agentsWritten: string[];
        endpointOk: boolean;
        error?: string;
      }>;
    }>('POST', '/api/providers/sync-free-models', {}),
  /** Set (or clear) the "Only free models" tracking flag for one provider. */
  setProviderFreeModelTracking: (id: string, enabled: boolean) =>
    request(
      'POST',
      `/api/providers/${encodeURIComponent(id)}/free-model-tracking`,
      { enabled }
    ),

  // --- MCP servers ---
  addMCP: (server: MCPServerConfig, agentIds: string[]) => {
    const validatedServer = MCPServerConfigSchema.parse(server);
    return request('POST', '/api/mcp', { server: validatedServer, agentIds });
  },
  updateMCP: (name: string, server: Partial<MCPServerConfig>) =>
    request('PUT', `/api/mcp/${encodeURIComponent(name)}`, { server }),
  addMCPAgents: (name: string, agentIds: string[]) =>
    request('POST', `/api/mcp/${encodeURIComponent(name)}/agents`, {
      agentIds,
    }),
  removeMCPAgent: (name: string, agentId: string) =>
    request('DELETE', `/api/mcp/${encodeURIComponent(name)}/agents/${encodeURIComponent(agentId)}`),
  deleteMCP: (name: string) => request('DELETE', `/api/mcp/${encodeURIComponent(name)}`),
  /**
   * Live tool listing for one MCP server (MCP exposure dashboard). Connects
   * to the server and runs tools/list. Honest on failure: `count` is 0 with an
   * `error` — never a fabricated number. The UI renders that as
   * "unknown / failed to list".
   */
  getMcpTools: (name: string) =>
    request<{ name: string; count: number; tools: string[]; error?: string }>(
      'GET',
      `/api/mcp/${encodeURIComponent(name)}/tools`
    ),

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

  // --- Drift detection (M071) ---
  /**
   * Read-only: has anything edited this agent's registry-managed providers /
   * MCP servers out-of-band? Cheap (one config-file read per call, no
   * network) — safe to run on agent-page load.
   */
  checkAgentDrift: (id: string) =>
    request<{
      agentId: string;
      drifted: boolean;
      changedProviders: string[];
      changedServers: string[];
    }>('GET', `/api/agents/${encodeURIComponent(id)}/drift`),

  /**
   * Push the registry's version of this agent's registry-managed providers /
   * MCP servers back over its config file — the inverse of the out-of-band
   * edit drift detection flags. Agent-local entries are preserved.
   */
  resyncAgent: (id: string) =>
    request<RegistryState>('POST', `/api/agents/${encodeURIComponent(id)}/resync`),

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
