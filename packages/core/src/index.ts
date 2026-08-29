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

// Adapters
export * from './adapters';

// Maintained agent catalog (known agent CLIs + install/uninstall allow-list)
export * from './agent-catalog';

// Provider API verification (probe /models, /chat/completions, /responses)
export * from './provider-test';

// Environment variables (read, categorize, redact, edit user-level env vars)
export * from './env-vars';

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
} from './types';
import {
  getAdapter,
  listAvailableAdapters,
  getAdapterInfo,
  resolveConfigPathForAgent,
  createGenericAdapter,
} from './adapters';
import {
  backupFile,
  fileExists,
  getCommandVersion,
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
   */
  async detectAgents(): Promise<DetectedAgent[]> {
    const results = await Promise.all(
      Array.from(this.adapters.keys()).map((id) => this.detectAgent(id))
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
    const _registry = await this.requireRegistry();
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
    const next: Registry = {
      version: 1,
      providers: candidate.providers as RegistryProvider[],
      mcpServers: candidate.mcpServers as RegistryMCPServer[],
      customAgents: Array.isArray(candidate.customAgents)
        ? (candidate.customAgents as CustomAgentDef[])
        : [],
      updatedAt: Date.now(),
    };
    this.registry = next;
    this.registerCustomAdapters();
    await saveRegistry(this.registryFilePath, next);
    const materialize = await this.syncAgents(Array.from(this.adapters.keys()));
    const state = await this.getRegistryState();
    return {
      // The registry itself is authoritative and has been replaced; sync
      // problems are surfaced as warnings, not as an import failure.
      success: true,
      data: state,
      warnings: materialize.errors.length > 0 ? materialize.errors : undefined,
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
    const id = def.id.trim();
    if (!id) return { success: false, error: 'Agent id is required' };
    // Reject path-traversal-style ids: they would be stored decoded in the
    // registry yet addressable only percent-encoded in URLs, making them
    // permanently undeletable via the API (QA finding C1).
    if (id.includes('/') || id.includes('\\') || id === '.' || id === '..' || id.includes('\0')) {
      return { success: false, error: `Invalid agent id: ${JSON.stringify(id)}` };
    }
    if (!def.configPath.trim()) return { success: false, error: 'Config path is required' };
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

      const targetedProviders = registry.providers.filter((p) => p.agentIds.includes(agentId));
      // Alternate-wire siblings (e.g. "<id>-anthropic" on OpenCode-style
      // agents) are registry-managed too: they must refresh with the parent
      // entry and disappear when it does.
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
      const modelProviders: ModelProvider[] = current.modelProviders
        .filter((p) => !registryProviderIds.has(p.id))
        .concat(targetedProviders.map((rp) => ({ ...rp.provider })))
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
        modelProviders,
        models,
        mcpServers,
        lastModified: Date.now(),
      };
      await adapter.writeConfig(merged);
      return { agentId, ok: true };
    } catch (error) {
      return { agentId, ok: false, error: String(error) };
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

  async registerProvider(
    provider: ModelProvider,
    models: ModelConfig[] = [],
    agentIds: string[] = [],
    apiCapabilities?: ProviderApiCapabilities
  ): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    upsertProvider(
      registry,
      this.applyWireApiPreference(provider, apiCapabilities),
      models,
      apiCapabilities
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

  private summarizeResults(results: OperationResult[]): OperationResult {
    const _succeeded = results.filter((r) => r.success).length;
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
