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

// Adapters
export * from './adapters';

// Maintained agent catalog (known agent CLIs + install/uninstall allow-list)
export * from './agent-catalog';

// Provider API verification (probe /models, /chat/completions, /responses)
export * from './provider-test';

// Main class for managing multiple agents
import { AgentAdapter, AgentConfig, AgentInfo, AgentDetection, ModelProvider, ModelConfig, MCPServerConfig, PermissionConfig, Platform, OperationResult, Registry, RegistryState, RegistryProvider, RegistryMCPServer, MCPServerAgentOverride, MaterializeResult, CustomAgentDef, ProviderApiCapabilities } from './types';
import { getAdapter, listAvailableAdapters, getAdapterInfo, resolveConfigPathForAgent, createGenericAdapter } from './adapters';
import { getCommandPath, getCommandVersion, fileExists, readFileSafe } from './utils';
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
  MigrationInput,
} from './registry';

/**
 * An agent's static info merged with the runtime detection of whether its
 * CLI is actually installed on this machine.
 */
export interface DetectedAgent extends AgentInfo {
  detection: AgentDetection;
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
    return Array.from(this.adapters.values()).map(a => a.info);
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
        const binaryPath = await getCommandPath(binary);
        if (binaryPath) {
          detection.installed = true;
          detection.binaryPath = binaryPath;
          detection.method = 'command';
          try {
            const version = await getCommandVersion(binary);
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
      Array.from(this.adapters.keys()).map((id) => this.detectAgent(id)),
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
  async addModelProviderToAll(provider: ModelProvider, agentIds?: string[]): Promise<OperationResult> {
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
        results.push({ success: false, error: `Agent "${id}" doesn't support model configs` });
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
    agentIds?: string[],
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
        results.push({ success: false, error: `Agent "${id}" doesn't support model providers` });
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
        results.push({ success: false, error: `Agent "${id}" doesn't support MCP servers` });
      }
    }

    return this.summarizeResults(results);
  }

  async addPermissionToAll(permission: PermissionConfig, agentIds?: string[]): Promise<OperationResult> {
    const targets = agentIds || Array.from(this.adapters.keys());
    const results: OperationResult[] = [];

    for (const id of targets) {
      const adapter = this.adapters.get(id);
      if (adapter?.info.supports.permissions) {
        const result = await this.addPermission(id, permission);
        results.push(result);
      } else {
        results.push({ success: false, error: `Agent "${id}" doesn't support permissions` });
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
   */
  async initRegistry(): Promise<OperationResult<RegistryState>> {
    this.registryFilePath = resolveRegistryPath();
    let registry = await loadRegistry(this.registryFilePath);

    if (!registry) {
      // First run: migrate existing agent configs into the registry
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
      const migrated = await migrateFromAgentConfigs(inputs, emptyRegistry());
      registry = migrated.registry;
      registry.migrationWarnings = [...(migrated.warnings), ...warnings];
      await saveRegistry(this.registryFilePath, registry);
    }

    if ((registry as { corrupt?: boolean }).corrupt) {
      registry.migrationWarnings = registry.migrationWarnings || [];
      registry.migrationWarnings.push(
        'registry.json was unreadable and was replaced with an empty registry',
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
        }),
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
    const registry = await this.requireRegistry();
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Registry file must be a JSON object' };
    }
    const candidate = data as Partial<Registry>;
    if (!Array.isArray(candidate.providers) || !Array.isArray(candidate.mcpServers)) {
      return { success: false, error: 'Registry file must have providers[] and mcpServers[]' };
    }
    if (candidate.customAgents && !Array.isArray(candidate.customAgents)) {
      return { success: false, error: 'customAgents must be an array' };
    }
    // Minimal shape checks so a malformed file cannot wedge the app
    const allHaveAgentIds = (entries: unknown[]): boolean =>
      entries.every(
        (e) => e && typeof e === 'object' && Array.isArray((e as { agentIds?: unknown }).agentIds),
      );
    if (!allHaveAgentIds(candidate.providers) || !allHaveAgentIds(candidate.mcpServers)) {
      return { success: false, error: 'Registry entries must carry agentIds[]' };
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
      }),
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
    updates: Partial<Pick<CustomAgentDef, 'name' | 'description' | 'configPath' | 'mcpPath' | 'format'>>,
  ): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    const entry = registry.customAgents.find((a) => a.id === id);
    if (!entry) return { success: false, error: `Agent "${id}" not found` };
    if (updates.name !== undefined) entry.name = updates.name.trim() || entry.name;
    if (updates.description !== undefined) entry.description = updates.description?.trim() || undefined;
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
      }),
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
  private async materializeAgent(agentId: string): Promise<{ agentId: string; ok: boolean; error?: string }> {
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
      const registryProviderIds = new Set(registry.providers.map((p) => p.provider.id));
      const targetedServers = registry.mcpServers.filter((s) => s.agentIds.includes(agentId));
      const registryServerNames = new Set(registry.mcpServers.map((s) => s.server.name));

      // Drop registry-managed entries that do NOT target this agent; upsert
      // those that do; leave everything else (agent-local) untouched.
      const modelProviders: ModelProvider[] = current.modelProviders
        .filter((p) => !registryProviderIds.has(p.id))
        .concat(targetedProviders.map((rp) => ({ ...rp.provider })));

      const models: ModelConfig[] = current.models
        .filter((m) => !registryProviderIds.has(m.providerId))
        .concat(targetedProviders.flatMap((rp) => rp.models.map((m) => ({ ...m }))));

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
          }),
        );

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
  async syncAgents(agentIds: string[]): Promise<MaterializeResult> {
    const results = await Promise.all(agentIds.map((id) => this.materializeAgent(id)));
    const aggregate = aggregateMaterialize(results);
    for (const id of aggregate.written) {
      await this.reloadConfig(id).catch(() => undefined);
    }
    return aggregate;
  }

  private async registryMutation(
    mutate: (registry: Registry) => void,
    affectedAgents: string[],
  ): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    mutate(registry);
    await saveRegistry(this.registryFilePath, registry);
    this.registry = registry;
    const materialize = await this.syncAgents(affectedAgents);
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
   * Register (or update) a provider with its models and install it into the
   * given agents. The registry holds ONE definition; agent files are rewritten
   * from it.
   */
  async registerProvider(
    provider: ModelProvider,
    models: ModelConfig[] = [],
    agentIds: string[] = [],
    apiCapabilities?: ProviderApiCapabilities,
  ): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    upsertProvider(registry, provider, models, apiCapabilities);
    const added = addProviderAgents(registry, provider.id, agentIds);
    if (!added.ok) return { success: false, error: added.error };
    return this.registryMutation(() => {}, agentIds);
  }

  /** Install an existing registry provider into additional agents. */
  async addProviderToAgents(
    providerId: string,
    agentIds: string[],
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      addProviderAgents(registry, providerId, agentIds);
    }, agentIds);
  }

  /** Remove a provider from ONE agent's config (definition stays in registry). */
  async removeProviderFromAgent(
    providerId: string,
    agentId: string,
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      removeProviderAgent(registry, providerId, agentId);
    }, [agentId]);
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
    },
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      const entry = registry.providers.find((p) => p.provider.id === providerId);
      if (!entry) return;
      if (updates.provider) {
        entry.provider = { ...entry.provider, ...updates.provider, id: providerId };
      }
      if (updates.models) entry.models = updates.models;
      if (updates.apiCapabilities !== undefined) entry.apiCapabilities = updates.apiCapabilities;
    }, this.registry?.providers.find((p) => p.provider.id === providerId)?.agentIds || []);
  }

  /**
   * Persist the live API-verification result for a provider WITHOUT rewriting
   * any agent config (registry-metadata only). Used by POST /api/providers/:id/test.
   */
  async recordProviderCapabilities(
    providerId: string,
    apiCapabilities: ProviderApiCapabilities,
  ): Promise<OperationResult<boolean>> {
    const registry = await this.requireRegistry();
    const entry = registry.providers.find((p) => p.provider.id === providerId);
    if (!entry) return { success: false, error: `Provider "${providerId}" not found in registry` };
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
    return this.registryMutation((r) => {
      r.providers = r.providers.filter((p) => p.provider.id !== providerId);
    }, affected);
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
    agentIds: string[] = [],
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
    agentIds: string[],
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      addMCPServerAgents(registry, serverName, agentIds);
    }, agentIds);
  }

  /** Remove an MCP server from ONE agent's config (definition stays in registry). */
  async removeMCPServerFromAgent(
    serverName: string,
    agentId: string,
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      removeMCPServerAgent(registry, serverName, agentId);
    }, [agentId]);
  }

  /** Update an MCP server's shared definition; every covered agent is rewritten. */
  async updateMCPServer(
    serverName: string,
    updates: Partial<MCPServerConfig>,
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      const entry = registry.mcpServers.find((s) => s.server.name === serverName);
      if (entry) {
        entry.server = { ...entry.server, ...updates, name: serverName };
      }
    }, this.registry?.mcpServers.find((s) => s.server.name === serverName)?.agentIds || []);
  }

  /**
   * Per-agent override for an MCP server (e.g. a different env for one agent).
   * Merges with the shared definition at materialization time.
   */
  async setMCPServerAgentOverride(
    serverName: string,
    agentId: string,
    override: MCPServerAgentOverride,
  ): Promise<OperationResult<RegistryState>> {
    return this.registryMutation((registry) => {
      const entry = registry.mcpServers.find((s) => s.server.name === serverName);
      if (entry) {
        entry.agentOverrides = entry.agentOverrides || {};
        entry.agentOverrides[agentId] = { ...entry.agentOverrides[agentId], ...override };
        if (!entry.agentIds.includes(agentId)) entry.agentIds.push(agentId);
      }
    }, [agentId]);
  }

  /** Delete an MCP server from the registry and from every agent config. */
  async deleteMCPServer(serverName: string): Promise<OperationResult<RegistryState>> {
    const registry = await this.requireRegistry();
    const entry = registry.mcpServers.find((s) => s.server.name === serverName);
    const affected = entry ? [...entry.agentIds] : [];
    return this.registryMutation((r) => {
      r.mcpServers = r.mcpServers.filter((s) => s.server.name !== serverName);
    }, affected);
  }

  /** Read the raw config file of an agent (for directory checking / review). */
  async readRawConfig(agentId: string): Promise<OperationResult<{ path: string; content: string; exists: boolean }>> {
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
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const errors = results
      .filter(r => !r.success)
      .map(r => r.error)
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