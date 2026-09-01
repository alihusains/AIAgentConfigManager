/**
 * AI Agent Config Manager - Core Library
 * Main entry point exporting all public APIs
 */

// Types
export * from './types';

// Registry (single source of truth for providers + MCP servers)
export * from './registry';

// Utilities
export * from './utils';

// Skill management (shared library + assignment to skill-capable agents)
export * from './skills';

// Skill marketplace (browse/install from the public alihusains/enterprise-skills repo)
export * from './marketplace';

// Adapters
export * from './adapters';

// Maintained agent catalog (known agent CLIs + install/uninstall allow-list)
export * from './agent-catalog';

// Provider API verification (probe /models, /chat/completions, /responses)
export * from './provider-test';

// Environment variables (read, categorize, redact, edit user-level env vars)
export * from './env-vars';

// OS keychain access (Secrets)
export * from './keychain';

// MCP tool listing (exposure dashboard — per-server tool counts)
export * from './mcp-tools';

// Binary resolution (robust CLI detection)
export * from './detect/binary';
export * from './detect/version';

// CLI/environment tool detection (node, npm, pnpm, bun, git, …)
export * from './detect/tools';

// Main class for managing multiple agents
import type {
  AgentAdapter,
  AgentConfig,
  AgentInfo,
  AgentDetection,
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  PermissionConfig,
  Platform,
  OperationResult,
  Registry,
  RegistryState,
  RegistryProvider,
  RegistryMCPServer,
  MCPServerAgentOverride,
  MaterializeResult,
  CustomAgentDef,
  ProviderApiCapabilities,
  KeyLocationScanResult,
  KeyStorageLocation,
  ProviderKeyLocation,
} from './types';
import { listAvailableAdapters, resolveConfigPathForAgent, createGenericAdapter } from './adapters';
import {
  backupFile,
  fileExists,
  getCurrentPlatform,
  getCommandVersion,
  isSafeConfigPath,
  parseConfig,
  readFileSafe,
  resolveConfigPath,
  runCommand,
  writeFileSafe,
} from './utils';
import { resolveBinary } from './detect/binary';
import { getAgentCatalogEntry } from './agent-catalog';
import {
  resolveRegistryPath,
  loadRegistry,
  saveRegistry,
  emptyRegistry,
  migrateFromAgentConfigs,
  upsertProvider,
  upsertMCPServer,
  storeProviderApiKeyInKeychain,
  migrateProviderApiKeyToKeychain,
  deleteProviderKeychainSecret,
  resolveProviderApiKey,
  addProviderAgents,
  removeProviderAgent,
  addMCPServerAgents,
  removeMCPServerAgent,
  aggregateMaterialize,
  type MigrationInput,
} from './registry';

/**
 * An agent's static info merged with the runtime detection of whether its
 * CLI is actually installed on this machine.
 */
export interface DetectedAgent extends AgentInfo {
  detection: AgentDetection;
}

/**
 * Resolve the first existing candidate (or the first candidate as the
 * "would-be" path) from a per-platform candidate list. Returns null when
 * no candidates are declared.
 */
async function firstExistingPath(
  candidates: Partial<Record<Platform, string[]>> | undefined
): Promise<{ path: string; exists: boolean } | null> {
  const platform = (
    process.platform === 'win32' ? 'win32' : process.platform === 'linux' ? 'linux' : 'darwin'
  ) as Platform;
  const list = candidates?.[platform] || candidates?.darwin;
  if (!list || list.length === 0) return null;
  for (const template of list) {
    const resolved = resolveConfigPath(template, platform);
    try {
      if (await fileExists(resolved)) return { path: resolved, exists: true };
    } catch {
      // keep looking
    }
  }
  // None exist — report the first candidate as the would-be path.
  return { path: resolveConfigPath(list[0], platform), exists: false };
}

/**
 * Best-effort MCP server count from a config file. Returns 0 on parse
 * failure, undefined when the file is unreadable or the agent has no MCP
 * support.
 */
async function countMcpServers(path: string, configFormat: string): Promise<number | undefined> {
  try {
    const content = await readFileSafe(path);
    if (content === null || content === undefined) return undefined;
    let raw: unknown;
    try {
      raw = parseConfig(content, configFormat as never);
    } catch {
      return 0;
    }
    if (!raw || typeof raw !== 'object') return 0;
    const obj = raw as Record<string, unknown>;
    // Keyed map: { mcpServers: {...} } (claude, gemini, junie, freebuff, pi)
    const keyed = obj.mcpServers;
    if (keyed && typeof keyed === 'object' && !Array.isArray(keyed)) {
      return Object.keys(keyed as object).length;
    }
    // Same-file array: { mcp: [...] } (opencode, kilo, mimo)
    const arr = obj.mcp;
    if (Array.isArray(arr)) return arr.length;
    // TOML: [[plugins]] tables (reasonix) or mcp_servers key (codex)
    const plugins = obj.plugins;
    if (Array.isArray(plugins)) return plugins.length;
    const mcpServers = obj.mcp_servers;
    if (mcpServers && typeof mcpServers === 'object' && !Array.isArray(mcpServers)) {
      return Object.keys(mcpServers as object).length;
    }
    return 0;
  } catch {
    return undefined;
  }
}

/**
 * Pull the last semver-like token out of a version string — CLIs print
 * things like "codex-cli 0.149.1" or "omp/18.0.4"; the trailing
 * `\d+\.\d+(\.\d+)?` is what's comparable across an install command's own
 * "latest version" output (npm/brew print just the bare number).
 */
function extractVersionToken(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const matches = raw.match(/\d+\.\d+(?:\.\d+)?(?:[-.][\w.]+)?/g);
  return matches ? matches[matches.length - 1] : undefined;
}

/**
 * Cap on how many adapters are detected concurrently by `detectAgents()`.
 * Each detection spawns subprocesses (`which` + `--version`) and opens config
 * files; a low bound keeps peak fd/process pressure healthy while still
 * overlapping the slow `--version` probes that dominate wall-clock time.
 */
const DETECT_CONCURRENCY = 5;

/**
 * Map over `items` with at most `concurrency` async workers running at once.
 * Results are returned in the same order as `items`. A worker that rejects
 * propagates that rejection (callers that want per-item isolation should
 * catch inside the worker function).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  };
  const workers: Promise<void>[] = [];
  for (let w = 0; w < workerCount; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

export class AgentConfigManager {
  private adapters: Map<string, AgentAdapter> = new Map();
  private configs: Map<string, AgentConfig> = new Map();

  constructor() {
    // Auto-load all available adapters
    for (const adapter of listAvailableAdapters()) {
      this.adapters.set(adapter.info.id, adapter);
    }
  }

  // Agent management
  getAvailableAgents(): AgentInfo[] {
    return Array.from(this.adapters.values()).map((a) => a.info);
  }

  getAgent(agentId: string): AgentAdapter | undefined {
    return this.adapters.get(agentId);
  }

  getAgentInfo(agentId: string): AgentInfo | undefined {
    return this.adapters.get(agentId)?.info;
  }

  // ============================================================================
  // Agent CLI Detection
  // ============================================================================

  /**
   * Detect which agent CLIs are actually installed on this machine.
   * Checks each adapter's binary names on PATH and whether its config exists.
   */
  async detectAgent(agentId: string): Promise<DetectedAgent | null> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) return null;

    const info = adapter.info;
    const detection: AgentDetection = {
      installed: false,
      configExists: false,
      method: 'assumed',
    };

    for (const binary of info.binaries) {
      try {
        const resolved = await resolveBinary(binary);
        if (resolved) {
          detection.installed = true;
          detection.binaryPath = resolved.path;
          detection.detectedBy = resolved.foundBy;
          detection.method = 'command';
          try {
            const version = await getCommandVersion(binary, info.versionArgs, resolved.path);
            if (version) detection.version = version;
          } catch {
            // Version query is best-effort
          }
          break;
        }
      } catch {
        // Try the next binary name
      }
    }

    try {
      const configPath = adapter.getConfigPath();
      detection.configExists = await fileExists(configPath);
      if (detection.configExists && !detection.installed) {
        detection.method = 'config';
      }
    } catch {
      detection.configExists = false;
    }

    // MCP config surface (same-file or separate, per adapter)
    try {
      const mcpPath = adapter.getMCPConfigPath?.() ?? null;
      if (mcpPath) {
        detection.mcpPath = mcpPath;
        detection.mcpConfigExists = await fileExists(mcpPath);
        if (detection.mcpConfigExists) {
          detection.mcpServerCount = await countMcpServers(mcpPath, info.configFormat);
        }
      }
    } catch {
      // best-effort
    }

    // Model/provider config surface
    try {
      const modelPath = await firstExistingPath(info.modelConfigPaths);
      if (modelPath) {
        detection.modelConfigPath = modelPath.path;
        detection.modelConfigExists = modelPath.exists;
      }
    } catch {
      // best-effort
    }

    // Separate credential store (e.g. reasonix's ~/.reasonix/.env)
    try {
      const credPath = await firstExistingPath(info.modelCredentialPaths);
      if (credPath) {
        detection.modelCredentialPath = credPath.path;
        detection.modelCredentialExists = credPath.exists;
      }
    } catch {
      // best-effort
    }

    if (!detection.installed && !detection.configExists) {
      detection.method = 'assumed';
    }

    return { ...info, detection };
  }

  /**
   * Detect all registered agents and return their info merged with
   * installation status. Installed agents come first.
   *
   * Detection runs in parallel, but is bounded to {@link DETECT_CONCURRENCY}
   * in-flight agents at a time. Each `detectAgent()` spawns subprocesses
   * (`which` + `--version` probes) and opens config files; an unbounded
   * `Promise.all` over 24+ agents would burst dozens of concurrent processes
   * and file descriptors. The pool keeps the parallel speedup while capping
   * peak pressure. A single adapter failing is isolated by `detectAgent()`
   * itself and never aborts the scan.
   */
  async detectAgents(): Promise<DetectedAgent[]> {
    const ids = Array.from(this.adapters.keys());
    const results = await mapWithConcurrency(ids, DETECT_CONCURRENCY, (id) =>
      this.detectAgent(id).catch(() => null)
    );
    const detected = results.filter((r): r is DetectedAgent => r !== null);
    detected.sort((a, b) => {
      if (a.detection.installed !== b.detection.installed) {
        return a.detection.installed ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return detected;
  }

  // Config operations
  async loadConfig(agentId: string): Promise<OperationResult<AgentConfig>> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }

    try {
      const config = await adapter.readConfig();
      this.configs.set(agentId, config);
      return { success: true, data: config };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async loadAllConfigs(): Promise<OperationResult<Record<string, AgentConfig>>> {
    const results: Record<string, AgentConfig> = {};
    const errors: string[] = [];

    for (const [id, adapter] of this.adapters) {
      try {
        const config = await adapter.readConfig();
        results[id] = config;
        this.configs.set(id, config);
      } catch (error) {
        errors.push(`${id}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      data: results,
      warnings: errors.length > 0 ? errors : undefined,
    };
  }

  async saveConfig(agentId: string, config: AgentConfig): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }

    try {
      await adapter.writeConfig(config);
      this.configs.set(agentId, config);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  getCachedConfig(agentId: string): AgentConfig | undefined {
    return this.configs.get(agentId);
  }

  // Model Provider operations (single agent)
  async addModelProvider(agentId: string, provider: ModelProvider): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.addModelProvider(provider);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async removeModelProvider(agentId: string, providerId: string): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.removeModelProvider(providerId);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Model operations (single agent)
  async addModel(agentId: string, model: ModelConfig): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.addModel(model);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async removeModel(agentId: string, modelId: string): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.removeModel(modelId);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // MCP operations (single agent)
  async addMCPServer(agentId: string, server: MCPServerConfig): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.addMCPServer(server);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async removeMCPServer(agentId: string, serverName: string): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.removeMCPServer(serverName);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Permission operations (single agent)
  async addPermission(agentId: string, permission: PermissionConfig): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.addPermission(permission);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async removePermission(agentId: string, permissionId: string): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.removePermission(permissionId);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Batch operations (Select All functionality)
  async addModelProviderToAll(
    provider: ModelProvider,
    agentIds?: string[]
  ): Promise<OperationResult> {
    const targets = agentIds || Array.from(this.adapters.keys());
    const results: OperationResult[] = [];

    for (const id of targets) {
      const result = await this.addModelProvider(id, provider);
      results.push(result);
    }

    return this.summarizeResults(results);
  }

  async addModelToAll(model: ModelConfig, agentIds?: string[]): Promise<OperationResult> {
    const targets = agentIds || Array.from(this.adapters.keys());
    const results: OperationResult[] = [];

    for (const id of targets) {
      const adapter = this.adapters.get(id);
      if (adapter?.info.supports.modelProviders) {
        const result = await this.addModel(id, model);
        results.push(result);
      } else {
        results.push({
          success: false,
          error: `Agent "${id}" doesn't support model configs`,
        });
      }
    }

    return this.summarizeResults(results);
  }

  /**
   * Install a provider and its model configurations into one or more agents.
   * This is the "Add Provider" flow: pick the target agents, install the
   * provider, then add the model configurations to each agent's config file
   * in the agent's required format.
   */
  async installProvider(
    provider: ModelProvider,
    models: ModelConfig[] = [],
    agentIds?: string[]
  ): Promise<OperationResult> {
    const targets = agentIds || Array.from(this.adapters.keys());
    const results: OperationResult[] = [];

    for (const id of targets) {
      const adapter = this.adapters.get(id);
      if (!adapter) {
        results.push({ success: false, error: `Agent "${id}" not found` });
        continue;
      }
      if (!adapter.info.supports.modelProviders) {
        results.push({
          success: false,
          error: `Agent "${id}" doesn't support model providers`,
        });
        continue;
      }

      try {
        await adapter.addModelProvider({ ...provider });
        for (const model of models) {
          try {
            await adapter.addModel({ ...model });
          } catch (error) {
            results.push({
              success: false,
              error: `Agent "${id}": model "${model.name}": ${error}`,
            });
          }
        }
        await this.reloadConfig(id);
        results.push({ success: true });
      } catch (error) {
        results.push({ success: false, error: `Agent "${id}": ${error}` });
      }
    }

    return this.summarizeResults(results);
  }

  async addMCPServerToAll(server: MCPServerConfig, agentIds?: string[]): Promise<OperationResult> {
    const targets = agentIds || Array.from(this.adapters.keys());
    const results: OperationResult[] = [];

    for (const id of targets) {
      // Skip agents that don't support MCP
      const adapter = this.adapters.get(id);
      if (adapter?.info.supports.mcpServers) {
        const result = await this.addMCPServer(id, server);
        results.push(result);
      } else {
        results.push({
          success: false,
          error: `Agent "${id}" doesn't support MCP servers`,
        });
      }
    }

    return this.summarizeResults(results);
  }

  async addPermissionToAll(
    permission: PermissionConfig,
    agentIds?: string[]
  ): Promise<OperationResult> {
    const targets = agentIds || Array.from(this.adapters.keys());
    const results: OperationResult[] = [];

    for (const id of targets) {
      const adapter = this.adapters.get(id);
      if (adapter?.info.supports.permissions) {
        const result = await this.addPermission(id, permission);
        results.push(result);
      } else {
        results.push({
          success: false,
          error: `Agent "${id}" doesn't support permissions`,
        });
      }
    }

    return this.summarizeResults(results);
  }

  // Registry state (single source of truth)
  private registry: Registry | null = null;
  private registryFilePath = '';

  /**
   * Load the registry (creating it on first run by absorbing the current
   * content of every agent's config file). Safe to call multiple times.
   *
   * On every load the current agent configs are merge-migrated into the
   * registry, so providers/MCP servers added manually inside an agent
   * (e.g. a provider added via Pi's own auth flow) are detected and
   * absorbed. The merge is additive — first-seen definitions win and
   * registry-managed entries are never overwritten.
   */
  async initRegistry(): Promise<OperationResult<RegistryState>> {
    this.registryFilePath = resolveRegistryPath();
    let registry = await loadRegistry(this.registryFilePath);

    const collectInputs = async (): Promise<{
      inputs: MigrationInput[];
      warnings: string[];
    }> => {
      const inputs: MigrationInput[] = [];
      const warnings: string[] = [];
      for (const [id, adapter] of this.adapters) {
        try {
          const config = await adapter.readConfig();
          inputs.push({ agentId: id, config });
        } catch (error) {
          warnings.push(`${id}: ${error}`);
        }
      }
      return { inputs, warnings };
    };

    if (!registry) {
      // First run: migrate existing agent configs into the registry
      const { inputs, warnings } = await collectInputs();
      const migrated = await migrateFromAgentConfigs(inputs, emptyRegistry());
      registry = migrated.registry;
      registry.migrationWarnings = [...migrated.warnings, ...warnings];
      await saveRegistry(this.registryFilePath, registry);
    } else {
      // Self-heal: absorb entries added manually to agent configs since the
      // last run. Only persist when the merge actually changed something.
      const { inputs, warnings } = await collectInputs();
      const before = JSON.stringify([registry.providers, registry.mcpServers]);
      const migrated = await migrateFromAgentConfigs(inputs, registry);
      const after = JSON.stringify([migrated.registry.providers, migrated.registry.mcpServers]);
      if (after !== before) {
        registry = migrated.registry;
        if (warnings.length > 0) {
          registry.migrationWarnings = [...(registry.migrationWarnings || []), ...warnings];
        }
        await saveRegistry(this.registryFilePath, registry);
      }
    }

    if ((registry as { corrupt?: boolean }).corrupt) {
      registry.migrationWarnings = registry.migrationWarnings || [];
      registry.migrationWarnings.push(
        'registry.json was unreadable and was replaced with an empty registry'
      );
      await saveRegistry(this.registryFilePath, registry);
    }

    this.registry = registry;
    this.registerCustomAdapters();
    return { success: true, data: await this.getRegistryState() };
  }

  /** Create adapters for user-defined agents stored in the registry. */
  private customAdapterIds: Set<string> = new Set();

  private registerCustomAdapters(): void {
    // Drop previously-registered custom adapters (built-ins are never touched)
    for (const id of this.customAdapterIds) {
      if (!this.registry?.customAgents.some((a) => a.id === id)) {
        this.adapters.delete(id);
        this.configs.delete(id);
      }
    }
    this.customAdapterIds.clear();
    if (!this.registry) return;
    for (const def of this.registry.customAgents) {
      this.adapters.set(
        def.id,
        createGenericAdapter({
          id: def.id,
          name: def.name,
          description: def.description,
          configPath: def.configPath,
          mcpPath: def.mcpPath,
          format: def.format,
        })
      );
      this.customAdapterIds.add(def.id);
    }
  }

  async getRegistryState(): Promise<RegistryState> {
    const registry = await this.requireRegistry();
    return {
      path: this.registryFilePath,
      providers: registry.providers,
      mcpServers: registry.mcpServers,
      customAgents: registry.customAgents,
      updatedAt: registry.updatedAt,
    };
  }

  /**
   * Replace the registry content wholesale (Settings → Import). The file is
   * validated first; custom agents are re-registered so their adapters exist.
   */
  async importRegistry(data: unknown): Promise<OperationResult<RegistryState>> {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Registry file must be a JSON object' };
    }
    const candidate = data as Partial<Registry>;
    if (!Array.isArray(candidate.providers) || !Array.isArray(candidate.mcpServers)) {
      return {
        success: false,
        error: 'Registry file must have providers[] and mcpServers[]',
      };
    }
    if (candidate.customAgents && !Array.isArray(candidate.customAgents)) {
      return { success: false, error: 'customAgents must be an array' };
    }
    // Minimal shape checks so a malformed file cannot wedge the app
    const allHaveAgentIds = (entries: unknown[]): boolean =>
      entries.every(
        (e) => e && typeof e === 'object' && Array.isArray((e as { agentIds?: unknown }).agentIds)
      );
    if (!allHaveAgentIds(candidate.providers) || !allHaveAgentIds(candidate.mcpServers)) {
      return {
        success: false,
        error: 'Registry entries must carry agentIds[]',
      };
    }
    const providers = candidate.providers as RegistryProvider[];
    const customAgents = Array.isArray(candidate.customAgents)
      ? (candidate.customAgents as CustomAgentDef[])
      : [];
    const next: Registry = {
      version: 1,
      providers,
      mcpServers: candidate.mcpServers as RegistryMCPServer[],
      customAgents,
      updatedAt: Date.now(),
    };
    // Portability warnings: a keychain-backed key never travels with the
    // export, and an absolute config path from another OS is stale here.
    // Neither blocks the import — the user fixes the flagged entries after.
    const warnings: string[] = [];
    for (const entry of providers) {
      if (entry.keychainSecretRef) {
        warnings.push(
          `Provider '${entry.provider.name}' was exported with a keychain-stored key. The real key does not travel with the export; you'll need to re-enter it.`
        );
      }
    }
    const platform = getCurrentPlatform();
    for (const agent of customAgents) {
      const p = agent.configPath;
      const looksForeign =
        platform === 'win32' ? p.startsWith('/') : p.startsWith('C:\\') || p.includes('\\');
      if (looksForeign) {
        warnings.push(
          `Custom agent '${agent.name}'s config path looks like it's from a different OS. Update it before it's used.`
        );
      }
    }
    this.registry = next;
    this.registerCustomAdapters();
    await saveRegistry(this.registryFilePath, next);
    const materialize = await this.syncAgents(Array.from(this.adapters.keys()));
    const state = await this.getRegistryState();
    const allWarnings = [...warnings, ...materialize.errors];
    return {
      // The registry itself is authoritative and has been replaced; sync
      // problems are surfaced as warnings, not as an import failure.
      success: true,
      data: state,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  }

  // ============================================================================
  // Registry: Custom agents (user-defined config paths)
  // ============================================================================

  /**
   * Register a user-defined agent with explicit config + MCP paths. The agent
   * becomes a first-class target: providers and MCP servers from the registry
   * can be installed into it, materialized via the generic JSON adapter.
   */
  async addCustomAgent(def: CustomAgentDef): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    // Guard before any .trim(): a missing id/configPath used to crash with an
    // unhandled TypeError (QA finding M1) instead of a clean validation error.
    if (!def || typeof def.id !== 'string' || !def.id.trim()) {
      return { success: false, error: 'Agent id is required' };
    }
    if (typeof def.configPath !== 'string' || !def.configPath.trim()) {
      return { success: false, error: 'Config path is required' };
    }
    const id = def.id.trim();
    if (!id) return { success: false, error: 'Agent id is required' };
    // Reject path-traversal-style ids: they would be stored decoded in the
    // registry yet addressable only percent-encoded in URLs, making them
    // permanently undeletable via the API (QA finding C1).
    if (id.includes('/') || id.includes('\\') || id === '.' || id === '..' || id.includes('\0')) {
      return { success: false, error: `Invalid agent id: ${JSON.stringify(id)}` };
    }
    if (!def.configPath.trim()) return { success: false, error: 'Config path is required' };
    // Reject foreign-OS drive paths (e.g. `C:\...` imported from a Windows
    // registry onto a POSIX host) BEFORE any write: an unvalidated path would
    // become a literal `C:\Users\...` file in the current working directory.
    if (!isSafeConfigPath(def.configPath)) {
      return {
        success: false,
        error: `Config path "${def.configPath}" is not a valid absolute path on this OS — update it before the agent can be used.`,
      };
    }
    if (registry.customAgents.some((a) => a.id === id) || this.adapters.has(id)) {
      return { success: false, error: `Agent "${id}" already exists` };
    }
    const entry: CustomAgentDef = {
      id,
      name: def.name.trim() || id,
      description: def.description?.trim() || undefined,
      configPath: def.configPath.trim(),
      mcpPath: def.mcpPath?.trim() || undefined,
      format: def.format || 'json',
    };
    registry.customAgents.push(entry);
    this.adapters.set(
      id,
      createGenericAdapter({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        configPath: entry.configPath,
        mcpPath: entry.mcpPath,
        format: entry.format,
      })
    );
    this.customAdapterIds.add(id);
    await saveRegistry(this.registryFilePath, registry);
    // Create the config files (if missing) so the paths are proven to work
    const materialize = await this.syncAgents([id]);
    const data = await this.getRegistryState();
    return {
      success: materialize.ok,
      data,
      warnings: materialize.errors.length > 0 ? materialize.errors : undefined,
    };
  }

  /** Update a custom agent's paths / name; re-registers its adapter. */
  async updateCustomAgent(
    id: string,
    updates: Partial<
      Pick<CustomAgentDef, 'name' | 'description' | 'configPath' | 'mcpPath' | 'format'>
    >
  ): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    const entry = registry.customAgents.find((a) => a.id === id);
    if (!entry) return { success: false, error: `Agent "${id}" not found` };
    if (updates.name !== undefined) entry.name = updates.name.trim() || entry.name;
    if (updates.description !== undefined)
      entry.description = updates.description?.trim() || undefined;
    if (updates.configPath !== undefined) {
      if (!updates.configPath.trim()) return { success: false, error: 'Config path is required' };
      // Same foreign-OS guard as addCustomAgent: a `C:\...` path imported from
      // another machine would otherwise become a literal file in the cwd when
      // the adapter re-materializes below.
      if (!isSafeConfigPath(updates.configPath)) {
        return {
          success: false,
          error: `Config path "${updates.configPath}" is not a valid absolute path on this OS — update it before the agent can be used.`,
        };
      }
      entry.configPath = updates.configPath.trim();
    }
    if (updates.mcpPath !== undefined) entry.mcpPath = updates.mcpPath.trim() || undefined;
    if (updates.format !== undefined) entry.format = updates.format;
    this.adapters.set(
      id,
      createGenericAdapter({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        configPath: entry.configPath,
        mcpPath: entry.mcpPath,
        format: entry.format,
      })
    );
    await saveRegistry(this.registryFilePath, registry);
    const materialize = await this.syncAgents([id]);
    const data = await this.getRegistryState();
    return {
      success: materialize.ok,
      data,
      warnings: materialize.errors.length > 0 ? materialize.errors : undefined,
    };
  }

  /** Remove a custom agent from the registry (its files are left untouched). */
  async removeCustomAgent(id: string): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    const entry = registry.customAgents.find((a) => a.id === id);
    if (!entry) return { success: false, error: `Agent "${id}" not found` };
    registry.customAgents = registry.customAgents.filter((a) => a.id !== id);
    // Clean every registry reference to the removed agent
    for (const p of registry.providers) {
      p.agentIds = p.agentIds.filter((aid) => aid !== id);
    }
    for (const m of registry.mcpServers) {
      m.agentIds = m.agentIds.filter((aid) => aid !== id);
      if (m.agentOverrides) delete m.agentOverrides[id];
    }
    this.adapters.delete(id);
    this.configs.delete(id);
    this.customAdapterIds.delete(id);
    await saveRegistry(this.registryFilePath, registry);
    return { success: true, data: await this.getRegistryState() };
  }

  private async requireRegistry(): Promise<Registry> {
    if (this.registry) return this.registry;
    const result = await this.initRegistry();
    if (!result.success || !this.registry) {
      throw new Error('Registry unavailable');
    }
    return this.registry;
  }

  /**
   * Materialize the registry-managed providers + MCP servers into one agent's
   * config file. Entries the agent does not manage (agent-local providers,
   * permissions, custom settings) are left untouched.
   *
   * CRITICAL: resolves keychain-backed API keys before writing so agents
   * receive the real credentials (Phase 1 Secrets M048).
   */
  private async materializeAgent(
    agentId: string,
    staleProviderIds: ReadonlySet<string> = new Set(),
    staleServerNames: ReadonlySet<string> = new Set()
  ): Promise<{ agentId: string; ok: boolean; error?: string; warning?: string }> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) return { agentId, ok: false, error: 'Agent not found' };
    // Detect-only agents (e.g. OMP) have their own YAML config and inherit
    // MCP servers from other agents — never materialize registry entries
    // into them, and never rewrite their files.
    if (!adapter.info.supports.modelProviders && !adapter.info.supports.mcpServers) {
      return { agentId, ok: true };
    }
    try {
      const registry = await this.requireRegistry();
      const current = await adapter.readConfig();

      const target = await this.computeMaterializedState(
        registry,
        current,
        agentId,
        staleProviderIds,
        staleServerNames
      );

      // The unified model cannot express malformed entries that the adapter
      // preserved on disk (QA H4): surface them explicitly instead of a bare
      // ok that leaves the file unverifiable.
      const preserved = adapter.getPreservedRawEntries?.() ?? [];
      if (preserved.length > 0) {
        const names = preserved.map((e) => e.name).join(', ');
        return {
          agentId,
          ok: true,
          warning: `${agentId}: preserved unrecognized raw config entries: ${names}`,
        };
      }

      const merged: AgentConfig = {
        ...current,
        ...target,
        lastModified: Date.now(),
      };
      await adapter.writeConfig(merged);
      return { agentId, ok: true };
    } catch (error) {
      return { agentId, ok: false, error: String(error) };
    }
  }

  /**
   * Compute what the registry SHOULD materialize into one agent's config
   * file — the exact target state `materializeAgent` writes. Shared with
   * `detectDrift` so drift detection compares against the same computation
   * without duplicating the provider/server assembly logic.
   *
   * Phase 1 (Secrets M048): resolves keychain-backed API keys so materialized
   * providers have the real credentials (not empty strings). Keychain-backed
   * entries carry keychainSecretRef but empty config.apiKey; this method
   * fetches the real key before returning so adapters can write working config.
   */
  private async computeMaterializedState(
    registry: Registry,
    current: AgentConfig,
    agentId: string,
    staleProviderIds: ReadonlySet<string> = new Set(),
    staleServerNames: ReadonlySet<string> = new Set()
  ): Promise<{ modelProviders: ModelProvider[]; models: ModelConfig[]; mcpServers: MCPServerConfig[] }> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) return { modelProviders: [], models: [], mcpServers: [] };
    const targetedProviders = registry.providers.filter((p) => p.agentIds.includes(agentId));
    const alternateProviders = targetedProviders.flatMap(
      (rp) => adapter.deriveAlternateProviders?.(rp) ?? []
    );
    const registryProviderIds = new Set([
      ...registry.providers.map((p) => p.provider.id),
      ...alternateProviders.map((d) => d.provider.id),
      ...staleProviderIds,
    ]);
    const targetedServers = registry.mcpServers.filter((s) => s.agentIds.includes(agentId));
    const registryServerNames = new Set([
      ...registry.mcpServers.map((s) => s.server.name),
      ...staleServerNames,
    ]);

    // Drop registry-managed entries that do NOT target this agent; upsert
    // those that do; leave everything else (agent-local) untouched.
    // Phase 1 (Secrets M048): resolve keychain keys before materializing.
    const registryProvidersList: ModelProvider[] = [];
    for (const rp of targetedProviders) {
      const resolved = await resolveProviderApiKey(rp);
      const provider = { ...rp.provider };
      if (resolved !== null) {
        provider.config = { ...provider.config, apiKey: resolved };
      }
      registryProvidersList.push(provider);
    }

    const modelProviders: ModelProvider[] = current.modelProviders
      .filter((p) => !registryProviderIds.has(p.id))
      .concat(registryProvidersList)
      .concat(alternateProviders.map((d) => ({ ...d.provider })));

    const models: ModelConfig[] = current.models
      .filter((m) => !registryProviderIds.has(m.providerId))
      .concat(targetedProviders.flatMap((rp) => rp.models.map((m) => ({ ...m }))))
      .concat(alternateProviders.flatMap((d) => d.models.map((m) => ({ ...m }))));

    const mcpServers: MCPServerConfig[] = current.mcpServers
      .filter((s) => !registryServerNames.has(s.name))
      .concat(
        targetedServers.map((rs) => {
          const override = rs.agentOverrides?.[agentId];
          return {
            ...rs.server,
            ...(override?.env ? { env: override.env } : {}),
            ...(override?.args ? { args: override.args } : {}),
            ...(override?.timeout !== undefined ? { timeout: override.timeout } : {}),
            ...(override?.tools ? { tools: override.tools } : {}),
            ...(override?.approvalMode ? { approvalMode: override.approvalMode } : {}),
            enabled: override?.enabled ?? rs.server.enabled,
          };
        })
      );

    return { modelProviders, models, mcpServers };
  }

  /**
   * M071: re-sync one agent: push the registry's version of its
   * registry-managed providers/servers back over the on-disk config file.
   * `materializeAgent` already rewrites exactly those entries (agent-local
   * entries are preserved), so this is a targeted re-materialization — the
   * inverse of the out-of-band edit drift detection flags.
   */
  async resyncAgent(agentId: string): Promise<OperationResult<RegistryState>> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) return { success: false, error: `Agent "${agentId}" not found` };
    const materialize = await this.syncAgents([agentId]);
    const data = await this.getRegistryState();
    return {
      success: materialize.ok,
      data,
      warnings: materialize.errors.length > 0 ? materialize.errors : undefined,
    };
  }

  /**
   * M071: detect out-of-band edits to one agent's registry-managed entries.
   * Read-only — compares the registry's target state (same computation
   * `materializeAgent` writes) against the agent's actual on-disk config,
   * scoped to providers/servers the registry believes it owns for this
   * agent. Agent-local entries never trigger drift. Detect-only agents
   * (never materialized) always report no drift.
   */
  async detectDrift(agentId: string): Promise<{
    agentId: string;
    drifted: boolean;
    changedProviders: string[];
    changedServers: string[];
    error?: string;
  }> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return {
        agentId,
        drifted: false,
        changedProviders: [],
        changedServers: [],
        error: 'Agent not found',
      };
    }
    if (!adapter.info.supports.modelProviders && !adapter.info.supports.mcpServers) {
      // Detect-only agents are never materialized — nothing can drift.
      return { agentId, drifted: false, changedProviders: [], changedServers: [] };
    }
    try {
      const registry = await this.requireRegistry();
      const current = await adapter.readConfig();
      const target = await this.computeMaterializedState(registry, current, agentId);

      // Registry-managed ids/names for THIS agent only (targeted entries +
      // their alternate-wire siblings); stale sets are empty — drift about
      // already-deleted entries is not this feature's concern.
      const targetedProviders = registry.providers.filter((p) => p.agentIds.includes(agentId));
      const alternateProviders = targetedProviders.flatMap(
        (rp) => adapter.deriveAlternateProviders?.(rp) ?? []
      );
      const managedProviderIds = new Set([
        ...targetedProviders.map((rp) => rp.provider.id),
        ...alternateProviders.map((d) => d.provider.id),
      ]);
      const managedServerNames = new Set(
        registry.mcpServers.filter((s) => s.agentIds.includes(agentId)).map((s) => s.server.name)
      );

      // Key-order-insensitive deep equality: sort object keys recursively
      // (JSON.stringify's replacer array is a property allow-list, so it must
      // be a replacer function, not a sorted key list).
      const stable = (v: unknown): string =>
        JSON.stringify(v, (_key, value) =>
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(
                Object.keys(value as Record<string, unknown>)
                  .sort()
                  .map((k) => [k, (value as Record<string, unknown>)[k]])
              )
            : value
        ) ?? 'undefined';
      // Normalize empty/absent values so `undefined`, `null`, `{}` and `[]`
      // compare equal — adapters omit empty keys their wire format drops
      // (e.g. `env: {}` never survives an OpenCode round-trip).
      const norm = (v: unknown): string | null => {
        if (v === undefined || v === null) return null;
        if (Array.isArray(v) && v.length === 0) return null;
        if (typeof v === 'object' && Object.keys(v as object).length === 0) return null;
        return stable(v);
      };

      // Projection comparison — drift = the registry-managed fields differ.
      // A raw deep-equal against the registry entry can NEVER clear for
      // adapters that inject wire-format-required keys the registry entry
      // does not carry (OpenCode adds a provider `env` list on every write)
      // or re-derive fields from file position (`priority`). Compare only
      // what the registry itself defines; extra on-disk keys are
      // adapter-managed, not out-of-band edits.
      const providerMatches = (disk: ModelProvider, target: ModelProvider): boolean => {
        if (disk.name !== target.name || disk.type !== target.type) return false;
        if (disk.enabled !== target.enabled) return false;
        // Project through the adapter's wire-format lens first: registry
        // entries are shared across agents and may carry fields this agent's
        // format cannot express (phantom-drift guard, M071).
        const project = adapter.expressibleProviderConfig?.bind(adapter);
        const targetConfig = project
          ? project((target.config ?? {}) as Record<string, unknown>)
          : ((target.config ?? {}) as Record<string, unknown>);
        const diskConfig = project
          ? project((disk.config ?? {}) as Record<string, unknown>)
          : ((disk.config ?? {}) as Record<string, unknown>);
        return Object.keys(targetConfig).every(
          (key) => norm(diskConfig[key]) === norm(targetConfig[key])
        );
      };
      const serverMatches = (
        disk: MCPServerConfig | undefined,
        target: MCPServerConfig
      ): boolean => {
        if (!disk) return false;
        if (disk.type !== target.type) return false;
        if ((disk.enabled ?? true) !== (target.enabled ?? true)) return false;
        return (Object.keys(target) as (keyof MCPServerConfig)[]).every((key) => {
          if (key === 'name' || key === 'type' || key === 'enabled') return true;
          return norm(disk[key]) === norm(target[key]);
        });
      };

      const targetProviderById = new Map(target.modelProviders.map((p) => [p.id, p]));
      const currentProviderById = new Map(current.modelProviders.map((p) => [p.id, p]));
      const changedProviders = [...managedProviderIds].filter((id) => {
        const disk = currentProviderById.get(id);
        const tgt = targetProviderById.get(id);
        return !(disk && tgt && providerMatches(disk, tgt));
      });

      const targetServerByName = new Map(target.mcpServers.map((s) => [s.name, s]));
      const currentServerByName = new Map(current.mcpServers.map((s) => [s.name, s]));
      const changedServers = [...managedServerNames].filter((name) => {
        const disk = currentServerByName.get(name);
        const tgt = targetServerByName.get(name);
        return !(disk && tgt && serverMatches(disk, tgt));
      });

      return {
        agentId,
        drifted: changedProviders.length > 0 || changedServers.length > 0,
        changedProviders,
        changedServers,
      };
    } catch (error) {
      return {
        agentId,
        drifted: false,
        changedProviders: [],
        changedServers: [],
        error: String(error),
      };
    }
  }

  /** Materialize the registry into the given agents' config files. */
  async syncAgents(
    agentIds: string[],
    staleProviderIds: ReadonlySet<string> = new Set(),
    staleServerNames: ReadonlySet<string> = new Set()
  ): Promise<MaterializeResult> {
    const results = await Promise.all(
      agentIds.map((id) => this.materializeAgent(id, staleProviderIds, staleServerNames))
    );
    const aggregate = aggregateMaterialize(results);
    for (const id of aggregate.written) {
      await this.reloadConfig(id).catch(() => undefined);
    }
    return aggregate;
  }

  private async registryMutation(
    mutate: (registry: Registry) => void,
    affectedAgents: string[],
    staleProviderIds: ReadonlySet<string> = new Set(),
    staleServerNames: ReadonlySet<string> = new Set()
  ): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    mutate(registry);
    await saveRegistry(this.registryFilePath, registry);
    this.registry = registry;
    const materialize = await this.syncAgents(affectedAgents, staleProviderIds, staleServerNames);
    const data = await this.getRegistryState();
    return {
      success: materialize.ok,
      data,
      warnings: materialize.errors.length > 0 ? materialize.errors : undefined,
    };
  }

  // ============================================================================
  // Registry: Provider operations
  // ============================================================================

  /**
   * Agents whose config format cannot hold model providers (Pi, Junie,
   * FreeBuff, OMP manage their own model lists). They may be listed in
   * agentIds, but materialization never writes to their files — callers get
   * a warning instead of silent success.
   */
  private modelProviderWarnings(agentIds: string[]): string[] {
    const unsupported = agentIds.filter((id) => {
      const adapter = this.adapters.get(id);
      return adapter ? !adapter.info.supports.modelProviders : false;
    });
    return unsupported.length > 0
      ? [
          `${unsupported.join(', ')} cannot store model providers in their config format — registered in the registry only, no config files were written`,
        ]
      : [];
  }

  /**
   * Register (or update) a provider with its models and install it into the
   * given agents. The registry holds ONE definition; agent files are rewritten
   * from it.
   */
  /**
   * Stamp the confirmed wire protocol onto an OpenAI-compatible provider's
   * config from live verification results (the Codex adapter writes it as
   * TOML `wire_api`). An explicitly configured wireApi always wins; nothing
   * is stamped before a successful verification. "responses" is preferred —
   * it is the native protocol of ChatGPT/Codex accounts and newer gateways.
   */
  private applyWireApiPreference(
    provider: ModelProvider,
    apiCapabilities?: ProviderApiCapabilities
  ): ModelProvider {
    if (provider.type !== 'openai-compatible') return provider;
    const supported = apiCapabilities?.supported ?? [];
    if (supported.length === 0) return provider;
    const cfg = { ...(provider.config || {}) } as Record<string, unknown>;
    if (cfg.wireApi) return provider;
    const preferred = supported.includes('responses')
      ? 'responses'
      : supported.includes('chat')
        ? 'chat'
        : undefined;
    if (!preferred) return provider;
    cfg.wireApi = preferred;
    return { ...provider, config: cfg };
  }

  /**
   * Register (or update) a provider, with an optional opt-in to OS-keychain
   * storage of its API key (Phase 1 Secrets). Pass
   * `keychainStorage: true` ONLY for a NEW provider: the real key is written
   * to the keychain, `registry.json` stores an empty `apiKey` plus a
   * `keychainSecretRef`, and a keychain failure fails the registration
   * cleanly (no silent plaintext fallback). Omitting the option — or
   * registering an existing provider — behaves exactly as before.
   */
  async registerProvider(
    provider: ModelProvider,
    models: ModelConfig[] = [],
    agentIds: string[] = [],
    apiCapabilities?: ProviderApiCapabilities,
    keychainStorage?: boolean
  ): Promise<OperationResult<RegistryState>> {
    let keychainSecretRef: string | undefined;
    if (keychainStorage) {
      const registry = await this.requireRegistry();
      if (registry.providers.some((p) => p.provider.id === provider.id)) {
        return {
          success: false,
          error:
            `Keychain storage is opt-in for NEW providers only — "${provider.id}" is already registered. ` +
            'Re-register without keychain storage (or delete and re-add the provider) to change its key storage.',
        };
      }
      if (
        typeof provider.config.apiKey !== 'string' ||
        (provider.config.apiKey as string).length === 0
      ) {
        return {
          success: false,
          error: `Keychain storage requires the provider's API key (config.apiKey) — none supplied for "${provider.id}".`,
        };
      }
      try {
        const stored = await storeProviderApiKeyInKeychain(provider);
        provider = stored.provider;
        keychainSecretRef = stored.keychainSecretRef;
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    const registry = await this.requireRegistry();
    upsertProvider(
      registry,
      this.applyWireApiPreference(provider, apiCapabilities),
      models,
      apiCapabilities,
      keychainSecretRef
    );
    const added = addProviderAgents(registry, provider.id, agentIds);
    if (!added.ok) return { success: false, error: added.error };
    const result = await this.registryMutation(() => {}, agentIds);
    const warnings = [...(result.warnings || []), ...this.modelProviderWarnings(agentIds)];
    return { ...result, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /** Install an existing registry provider into additional agents. */
  async addProviderToAgents(
    providerId: string,
    agentIds: string[]
  ): Promise<OperationResult<RegistryState>> {
    const result = await this.registryMutation((registry) => {
      addProviderAgents(registry, providerId, agentIds);
    }, agentIds);
    const warnings = [...(result.warnings || []), ...this.modelProviderWarnings(agentIds)];
    return { ...result, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /** Remove a provider from ONE agent's config (definition stays in registry). */
  async removeProviderFromAgent(
    providerId: string,
    agentId: string
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation(
      (registry) => {
        removeProviderAgent(registry, providerId, agentId);
      },
      [agentId]
    );
  }

  /**
   * Update a provider's definition + models. Coverage is unchanged; every
   * covered agent's config is rewritten.
   */
  async updateProvider(
    providerId: string,
    updates: {
      provider?: Partial<ModelProvider>;
      models?: ModelConfig[];
      apiCapabilities?: ProviderApiCapabilities;
    }
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation(
      (registry) => {
        const entry = registry.providers.find((p) => p.provider.id === providerId);
        if (!entry) return;
        if (updates.provider) {
          entry.provider = {
            ...entry.provider,
            ...updates.provider,
            id: providerId,
          };
        }
        if (updates.models) entry.models = updates.models;
        if (updates.apiCapabilities !== undefined) entry.apiCapabilities = updates.apiCapabilities;
        // Re-stamp the wire preference from the latest verification.
        entry.provider = this.applyWireApiPreference(entry.provider, entry.apiCapabilities);
      },
      this.registry?.providers.find((p) => p.provider.id === providerId)?.agentIds || []
    );
  }

  /**
   * Persist the live API-verification result for a provider WITHOUT rewriting
   * any agent config (registry-metadata only). Used by POST /api/providers/:id/test.
   */
  async recordProviderCapabilities(
    providerId: string,
    apiCapabilities: ProviderApiCapabilities
  ): Promise<OperationResult<boolean>> {
    const registry = await this.requireRegistry();
    const entry = registry.providers.find((p) => p.provider.id === providerId);
    if (!entry)
      return {
        success: false,
        error: `Provider "${providerId}" not found in registry`,
      };
    entry.apiCapabilities = apiCapabilities;
    await saveRegistry(this.registryFilePath, registry);
    this.registry = registry;
    return { success: true, data: true };
  }

  /**
   * Migrate an EXISTING provider's plaintext API key into the OS keychain
   * (Phase 1 Secrets) — one provider at a time, explicit action only. The
   * keychain write happens BEFORE any registry change: on a keychain failure
   * the registry is left byte-for-byte unchanged and the plaintext key stays
   * in place. No agent configs are touched (the resolved key is unchanged by
   * the move, so nothing needs re-materializing).
   */
  async migrateProviderApiKeyToKeychain(
    providerId: string
  ): Promise<OperationResult<RegistryState>> {
    await this.requireRegistry();
    const result = await migrateProviderApiKeyToKeychain(this.registryFilePath, providerId);
    if ('error' in result) return { success: false, error: result.error };
    // The registry file was rewritten by the migration; refresh the in-memory
    // copy so subsequent reads see the new keychainSecretRef.
    this.registry = await loadRegistry(this.registryFilePath);
    const data = await this.getRegistryState();
    return { success: true, data };
  }

  /** Delete a provider from the registry and from every agent config. */
  async deleteProvider(providerId: string): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    const entry = registry.providers.find((p) => p.provider.id === providerId);
    const affected = entry ? [...entry.agentIds] : [];
    // Materialization strips every provider id under "registry management".
    // Once the entry is removed from the registry those ids are no longer
    // discoverable, so capture them *before* mutation via the stale set: the
    // parent id plus any alternate-wire siblings derived from it.
    const staleProviderIds = new Set<string>();
    if (entry) {
      staleProviderIds.add(entry.provider.id);
      for (const agentId of affected) {
        const adapter = this.adapters.get(agentId);
        for (const alt of adapter?.deriveAlternateProviders?.(entry) ?? []) {
          staleProviderIds.add(alt.provider.id);
        }
      }
      // Phase 1 (Secrets): a keychain-backed key must not outlive its
      // registry entry. Best-effort — a keychain-deletion failure only warns
      // and never blocks the registry deletion itself.
      await deleteProviderKeychainSecret(entry);
    }
    return this.registryMutation(
      (r) => {
        r.providers = r.providers.filter((p) => p.provider.id !== providerId);
      },
      affected,
      staleProviderIds
    );
  }

  // ============================================================================
  // Registry: MCP Server operations
  // ============================================================================

  /**
   * Register (or update) an MCP server definition ONCE and install it into the
   * given agents. There is never more than one definition per server name.
   */
  async registerMCPServer(
    server: MCPServerConfig,
    agentIds: string[] = []
  ): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    upsertMCPServer(registry, server);
    const added = addMCPServerAgents(registry, server.name, agentIds);
    if (!added.ok) return { success: false, error: added.error };
    return this.registryMutation(() => {}, agentIds);
  }

  /** Install an existing registry MCP server into additional agents. */
  async addMCPServerToAgents(
    serverName: string,
    agentIds: string[]
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      addMCPServerAgents(registry, serverName, agentIds);
    }, agentIds);
  }

  /** Remove an MCP server from ONE agent's config (definition stays in registry). */
  async removeMCPServerFromAgent(
    serverName: string,
    agentId: string
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation(
      (registry) => {
        removeMCPServerAgent(registry, serverName, agentId);
      },
      [agentId]
    );
  }

  /** Update an MCP server's shared definition; every covered agent is rewritten. */
  async updateMCPServer(
    serverName: string,
    updates: Partial<MCPServerConfig>
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation(
      (registry) => {
        const entry = registry.mcpServers.find((s) => s.server.name === serverName);
        if (entry) {
          entry.server = { ...entry.server, ...updates, name: serverName };
        }
      },
      this.registry?.mcpServers.find((s) => s.server.name === serverName)?.agentIds || []
    );
  }

  /**
   * Per-agent override for an MCP server (e.g. a different env for one agent).
   * Merges with the shared definition at materialization time.
   */
  async setMCPServerAgentOverride(
    serverName: string,
    agentId: string,
    override: MCPServerAgentOverride
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation(
      (registry) => {
        const entry = registry.mcpServers.find((s) => s.server.name === serverName);
        if (entry) {
          entry.agentOverrides = entry.agentOverrides || {};
          entry.agentOverrides[agentId] = {
            ...entry.agentOverrides[agentId],
            ...override,
          };
          if (!entry.agentIds.includes(agentId)) entry.agentIds.push(agentId);
        }
      },
      [agentId]
    );
  }

  /** Delete an MCP server from the registry and from every agent config. */
  async deleteMCPServer(serverName: string): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    const entry = registry.mcpServers.find((s) => s.server.name === serverName);
    const affected = entry ? [...entry.agentIds] : [];
    // Same cascade as deleteProvider: once the server is dropped from the
    // registry its name is no longer discoverable, so force materialize to
    // strip it from every affected agent config too.
    return this.registryMutation(
      (r) => {
        r.mcpServers = r.mcpServers.filter((s) => s.server.name !== serverName);
      },
      affected,
      new Set(),
      new Set([serverName])
    );
  }

  /** Read the raw config file of an agent (for directory checking / review). */
  async readRawConfig(
    agentId: string
  ): Promise<OperationResult<{ path: string; content: string; exists: boolean }>> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) return { success: false, error: `Agent "${agentId}" not found` };
    try {
      const configPath = adapter.getConfigPath();
      const exists = await fileExists(configPath);
      const content = exists ? (await readFileSafe(configPath)) || '' : '';
      return { success: true, data: { path: configPath, content, exists } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Read an agent's raw config file or its separate MCP file (when it has
   * one) as plain text, for the in-browser editor.
   */
  async readAgentFile(
    agentId: string,
    kind: 'config' | 'mcp'
  ): Promise<OperationResult<{ path: string; content: string; exists: boolean }>> {
    const targetPath = await this.resolveAgentFilePath(agentId, kind);
    if (!targetPath.success) return { success: false, error: targetPath.error };
    const target = targetPath.data as string;
    try {
      const exists = await fileExists(target);
      const content = exists ? (await readFileSafe(target)) || '' : '';
      return { success: true, data: { path: target, content, exists } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Overwrite an agent's raw config file or its separate MCP file with new
   * content, taking a timestamped backup of the previous content first (if
   * the file already existed). Content is written exactly as given — no
   * parsing, validation, or reformatting; the caller (GUI editor) is
   * responsible for the file being well-formed for its format.
   */
  async writeAgentFile(
    agentId: string,
    kind: 'config' | 'mcp',
    content: string
  ): Promise<OperationResult<{ path: string; backupPath: string | null }>> {
    const targetPath = await this.resolveAgentFilePath(agentId, kind);
    if (!targetPath.success) return { success: false, error: targetPath.error };
    const target = targetPath.data as string;
    // Final write-side guard: a foreign-OS drive path (e.g. from an imported
    // registry) would otherwise be written as a literal file in the cwd.
    if (!isSafeConfigPath(target)) {
      return {
        success: false,
        error: `Refusing to write to "${target}": not a valid absolute path on this OS`,
      };
    }
    try {
      const existed = await fileExists(target);
      const backupPath = existed ? await backupFile(target) : null;
      await writeFileSafe(target, content);
      return { success: true, data: { path: target, backupPath } };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /** Shared path resolution for readAgentFile/writeAgentFile — mirrors the
   * kind resolution already used by the `reveal` endpoint in gui-server.ts. */
  private async resolveAgentFilePath(
    agentId: string,
    kind: 'config' | 'mcp'
  ): Promise<OperationResult<string>> {
    if (kind === 'config') {
      const path = this.getConfigPath(agentId);
      if (!path)
        return { success: false, error: `Agent "${agentId}" not found or has no config path` };
      return { success: true, data: path };
    }
    const detected = await this.detectAgent(agentId);
    const mcpPath = detected?.detection.mcpPath;
    if (!mcpPath) {
      return { success: false, error: 'This agent has no separate MCP file on this machine' };
    }
    return { success: true, data: mcpPath };
  }

  // ============================================================================
  // Update checking (npm/bun/pnpm/yarn and Homebrew installs only)
  // ============================================================================

  /**
   * Best-effort "is a newer version available" check, derived from the
   * catalog's `install` command. Supports package-manager installs that
   * publish to the npm registry (npm/bun/pnpm/yarn `install -g`/`add -g`)
   * and Homebrew formulae; any other install method (curl installers,
   * pipx, etc.) reports `method: 'unsupported'` rather than guessing.
   */
  async checkAgentUpdate(agentId: string): Promise<
    OperationResult<{
      method: 'npm' | 'brew' | 'unsupported';
      currentVersion?: string;
      latestVersion?: string;
      updateAvailable: boolean;
      reason?: string;
    }>
  > {
    const entry = getAgentCatalogEntry(agentId);
    const installCmd = entry?.install;
    if (!installCmd) {
      return {
        success: true,
        data: {
          method: 'unsupported',
          updateAvailable: false,
          reason: 'No known install command for this agent',
        },
      };
    }

    const detected = await this.detectAgent(agentId);
    const currentVersion = extractVersionToken(detected?.detection.version);

    const npmMatch = installCmd.match(/^(?:npm|bun|pnpm|yarn)\s+(?:install|add)\s+-g\s+(\S+)/);
    const brewMatch = installCmd.match(/^brew\s+install\s+(\S+)/);

    if (npmMatch) {
      const pkg = npmMatch[1];
      try {
        const result = await runCommand('npm', ['view', pkg, 'version'], 15000);
        const latestVersion = extractVersionToken(result.stdout.trim());
        if (!latestVersion) {
          return {
            success: true,
            data: {
              method: 'npm',
              currentVersion,
              updateAvailable: false,
              reason: 'Could not parse the latest version from npm',
            },
          };
        }
        return {
          success: true,
          data: {
            method: 'npm',
            currentVersion,
            latestVersion,
            updateAvailable: Boolean(currentVersion) && currentVersion !== latestVersion,
          },
        };
      } catch (error) {
        return {
          success: true,
          data: { method: 'npm', currentVersion, updateAvailable: false, reason: String(error) },
        };
      }
    }

    if (brewMatch) {
      const formula = brewMatch[1];
      try {
        const result = await runCommand('brew', ['info', '--json=v2', formula], 15000);
        const parsed = JSON.parse(result.stdout) as {
          formulae?: { versions?: { stable?: string } }[];
        };
        const latestVersion = extractVersionToken(parsed.formulae?.[0]?.versions?.stable);
        if (!latestVersion) {
          return {
            success: true,
            data: {
              method: 'brew',
              currentVersion,
              updateAvailable: false,
              reason: 'Could not parse the latest version from Homebrew',
            },
          };
        }
        return {
          success: true,
          data: {
            method: 'brew',
            currentVersion,
            latestVersion,
            updateAvailable: Boolean(currentVersion) && currentVersion !== latestVersion,
          },
        };
      } catch (error) {
        return {
          success: true,
          data: { method: 'brew', currentVersion, updateAvailable: false, reason: String(error) },
        };
      }
    }

    return {
      success: true,
      data: {
        method: 'unsupported',
        currentVersion,
        updateAvailable: false,
        reason: 'This agent installs via a script/pipx, not a package registry this tool can query',
      },
    };
  }

  /**
   * The shell command that upgrades an agent in place, or `undefined` when
   * `checkAgentUpdate` reports `method: 'unsupported'`. For npm-family
   * installs this is the same command as `install` (npm/bun/pnpm/yarn
   * always fetch latest); for Homebrew it's `brew upgrade <formula>`
   * instead of `install`, since `brew install` on an already-installed
   * formula is a no-op.
   */
  getAgentUpdateCommand(agentId: string): string | undefined {
    const installCmd = getAgentCatalogEntry(agentId)?.install;
    if (!installCmd) return undefined;
    if (/^(?:npm|bun|pnpm|yarn)\s+(?:install|add)\s+-g\s+\S+/.test(installCmd)) {
      return installCmd;
    }
    const brewMatch = installCmd.match(/^brew\s+install\s+(\S+)/);
    if (brewMatch) return `brew upgrade ${brewMatch[1]}`;
    return undefined;
  }

  // Utility
  async backupConfig(agentId: string): Promise<OperationResult<string>> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      const backupPath = await adapter.backupConfig();
      return { success: true, data: backupPath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async restoreConfig(agentId: string, backupPath: string): Promise<OperationResult> {
    const adapter = this.adapters.get(agentId);
    if (!adapter) {
      return { success: false, error: `Agent "${agentId}" not found` };
    }
    try {
      await adapter.restoreConfig(backupPath);
      await this.reloadConfig(agentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  getConfigPath(agentId: string, platform?: Platform): string | null {
    return resolveConfigPathForAgent(agentId, platform);
  }

  private async reloadConfig(agentId: string): Promise<void> {
    const adapter = this.adapters.get(agentId);
    if (adapter) {
      const config = await adapter.readConfig();
      this.configs.set(agentId, config);
    }
  }

  /**
   * T4: Scan where provider keys are stored — registry (keychain refs or
   * plaintext) and agent configs (plaintext). Returns a comprehensive report
   * of each provider's key locations and a risk assessment.
   */
  async scanKeyLocations(): Promise<OperationResult<KeyLocationScanResult>> {
    try {
      const registry = await this.requireRegistry();
      const registryPath = this.registryFilePath;
      const result: KeyLocationScanResult = {
        scannedAt: new Date().toISOString(),
        providers: [],
        summary: {
          totalProviders: 0,
          keychainBacked: 0,
          plaintextOnly: 0,
          mixed: 0,
        },
      };

      // Map to deduplicate providers when they appear in multiple agents
      const providerMap = new Map<
        string,
        { entry: RegistryProvider; agentIds: Set<string> }
      >();

      // Step 1: Collect registry providers
      for (const entry of registry.providers) {
        providerMap.set(entry.provider.id, {
          entry,
          agentIds: new Set(entry.agentIds),
        });
      }

      // Step 2: Scan each provider's keys
      for (const [providerId, { entry, agentIds }] of providerMap) {
        const locations: KeyStorageLocation[] = [];

        // Registry keychain reference
        if (entry.keychainSecretRef) {
          locations.push({
            type: 'keychain',
            reference: entry.keychainSecretRef,
          });
        } else if (entry.provider.config.apiKey) {
          // Registry plaintext
          locations.push({
            type: 'registry-plaintext',
            path: registryPath,
          });
        }

        // Step 3: Scan agent configs for plaintext keys
        for (const agentId of agentIds) {
          try {
            const adapter = this.adapters.get(agentId);
            if (!adapter) continue;
            const config = await adapter.readConfig();
            const providerInAgent = config.modelProviders.find(
              (p: ModelProvider) => p.id === providerId
            );
            if (providerInAgent?.config?.apiKey) {
              locations.push({
                type: 'agent-plaintext',
                agentId,
                configPath: adapter.getConfigPath(getCurrentPlatform()),
              });
            }
          } catch {
            // Agent config unreadable; skip it
          }
        }

        // If no locations found, record as missing
        if (locations.length === 0) {
          locations.push({ type: 'missing' });
        }

        // Assess risk level
        const hasKeychain = locations.some((l: KeyStorageLocation) => l.type === 'keychain');
        const plaintextCount = locations.filter(
          (l: KeyStorageLocation) => l.type === 'registry-plaintext' || l.type === 'agent-plaintext'
        ).length;
        const riskLevel: 'high' | 'medium' | 'low' =
          plaintextCount >= 2 ? 'high' : plaintextCount === 1 ? 'medium' : 'low';

        result.providers.push({
          providerId,
          providerName: entry.provider.name,
          locations,
          isKeychain: hasKeychain,
          isPlaintext: plaintextCount > 0,
          riskLevel,
        });
      }

      // Step 4: Calculate summary
      result.summary.totalProviders = result.providers.length;
      result.summary.keychainBacked = result.providers.filter(
        (p: ProviderKeyLocation) => p.isKeychain && !p.isPlaintext
      ).length;
      result.summary.plaintextOnly = result.providers.filter(
        (p: ProviderKeyLocation) => !p.isKeychain && p.isPlaintext
      ).length;
      result.summary.mixed = result.providers.filter(
        (p: ProviderKeyLocation) => p.isKeychain && p.isPlaintext
      ).length;

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private summarizeResults(results: OperationResult[]): OperationResult {
    const failed = results.filter((r) => !r.success).length;
    const errors = results
      .filter((r) => !r.success)
      .map((r) => r.error)
      .filter((e): e is string => Boolean(e));

    return {
      success: failed === 0,
      data: undefined,
      error: failed > 0 ? `${failed} of ${results.length} operations failed` : undefined,
      warnings: errors.length > 0 ? errors : undefined,
    };
  }
}

// Default export
export default AgentConfigManager;
