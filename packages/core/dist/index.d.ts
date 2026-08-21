/**
 * AI Agent Config Manager - Core Library
 * Main entry point exporting all public APIs
 */
export * from './types';
export * from './registry';
export * from './utils';
export * from './adapters';
export * from './agent-catalog';
export * from './provider-test';
import { AgentAdapter, AgentConfig, AgentInfo, AgentDetection, ModelProvider, ModelConfig, MCPServerConfig, PermissionConfig, Platform, OperationResult, RegistryState, MCPServerAgentOverride, MaterializeResult, CustomAgentDef, ProviderApiCapabilities } from './types';
/**
 * An agent's static info merged with the runtime detection of whether its
 * CLI is actually installed on this machine.
 */
export interface DetectedAgent extends AgentInfo {
    detection: AgentDetection;
}
export declare class AgentConfigManager {
    private adapters;
    private configs;
    constructor();
    getAvailableAgents(): AgentInfo[];
    getAgent(agentId: string): AgentAdapter | undefined;
    getAgentInfo(agentId: string): AgentInfo | undefined;
    /**
     * Detect which agent CLIs are actually installed on this machine.
     * Checks each adapter's binary names on PATH and whether its config exists.
     */
    detectAgent(agentId: string): Promise<DetectedAgent | null>;
    /**
     * Detect all registered agents and return their info merged with
     * installation status. Installed agents come first.
     */
    detectAgents(): Promise<DetectedAgent[]>;
    loadConfig(agentId: string): Promise<OperationResult<AgentConfig>>;
    loadAllConfigs(): Promise<OperationResult<Record<string, AgentConfig>>>;
    saveConfig(agentId: string, config: AgentConfig): Promise<OperationResult>;
    getCachedConfig(agentId: string): AgentConfig | undefined;
    addModelProvider(agentId: string, provider: ModelProvider): Promise<OperationResult>;
    removeModelProvider(agentId: string, providerId: string): Promise<OperationResult>;
    addModel(agentId: string, model: ModelConfig): Promise<OperationResult>;
    removeModel(agentId: string, modelId: string): Promise<OperationResult>;
    addMCPServer(agentId: string, server: MCPServerConfig): Promise<OperationResult>;
    removeMCPServer(agentId: string, serverName: string): Promise<OperationResult>;
    addPermission(agentId: string, permission: PermissionConfig): Promise<OperationResult>;
    removePermission(agentId: string, permissionId: string): Promise<OperationResult>;
    addModelProviderToAll(provider: ModelProvider, agentIds?: string[]): Promise<OperationResult>;
    addModelToAll(model: ModelConfig, agentIds?: string[]): Promise<OperationResult>;
    /**
     * Install a provider and its model configurations into one or more agents.
     * This is the "Add Provider" flow: pick the target agents, install the
     * provider, then add the model configurations to each agent's config file
     * in the agent's required format.
     */
    installProvider(provider: ModelProvider, models?: ModelConfig[], agentIds?: string[]): Promise<OperationResult>;
    addMCPServerToAll(server: MCPServerConfig, agentIds?: string[]): Promise<OperationResult>;
    addPermissionToAll(permission: PermissionConfig, agentIds?: string[]): Promise<OperationResult>;
    private registry;
    private registryFilePath;
    /**
     * Load the registry (creating it on first run by absorbing the current
     * content of every agent's config file). Safe to call multiple times.
     */
    initRegistry(): Promise<OperationResult<RegistryState>>;
    /** Create adapters for user-defined agents stored in the registry. */
    private customAdapterIds;
    private registerCustomAdapters;
    getRegistryState(): Promise<RegistryState>;
    /**
     * Replace the registry content wholesale (Settings → Import). The file is
     * validated first; custom agents are re-registered so their adapters exist.
     */
    importRegistry(data: unknown): Promise<OperationResult<RegistryState>>;
    /**
     * Register a user-defined agent with explicit config + MCP paths. The agent
     * becomes a first-class target: providers and MCP servers from the registry
     * can be installed into it, materialized via the generic JSON adapter.
     */
    addCustomAgent(def: CustomAgentDef): Promise<OperationResult<RegistryState>>;
    /** Update a custom agent's paths / name; re-registers its adapter. */
    updateCustomAgent(id: string, updates: Partial<Pick<CustomAgentDef, 'name' | 'description' | 'configPath' | 'mcpPath' | 'format'>>): Promise<OperationResult<RegistryState>>;
    /** Remove a custom agent from the registry (its files are left untouched). */
    removeCustomAgent(id: string): Promise<OperationResult<RegistryState>>;
    private requireRegistry;
    /**
     * Materialize the registry-managed providers + MCP servers into one agent's
     * config file. Entries the agent does not manage (agent-local providers,
     * permissions, custom settings) are left untouched.
     */
    private materializeAgent;
    /** Materialize the registry into the given agents' config files. */
    syncAgents(agentIds: string[]): Promise<MaterializeResult>;
    private registryMutation;
    /**
     * Register (or update) a provider with its models and install it into the
     * given agents. The registry holds ONE definition; agent files are rewritten
     * from it.
     */
    registerProvider(provider: ModelProvider, models?: ModelConfig[], agentIds?: string[], apiCapabilities?: ProviderApiCapabilities): Promise<OperationResult<RegistryState>>;
    /** Install an existing registry provider into additional agents. */
    addProviderToAgents(providerId: string, agentIds: string[]): Promise<OperationResult<RegistryState>>;
    /** Remove a provider from ONE agent's config (definition stays in registry). */
    removeProviderFromAgent(providerId: string, agentId: string): Promise<OperationResult<RegistryState>>;
    /**
     * Update a provider's definition + models. Coverage is unchanged; every
     * covered agent's config is rewritten.
     */
    updateProvider(providerId: string, updates: {
        provider?: Partial<ModelProvider>;
        models?: ModelConfig[];
        apiCapabilities?: ProviderApiCapabilities;
    }): Promise<OperationResult<RegistryState>>;
    /**
     * Persist the live API-verification result for a provider WITHOUT rewriting
     * any agent config (registry-metadata only). Used by POST /api/providers/:id/test.
     */
    recordProviderCapabilities(providerId: string, apiCapabilities: ProviderApiCapabilities): Promise<OperationResult<boolean>>;
    /** Delete a provider from the registry and from every agent config. */
    deleteProvider(providerId: string): Promise<OperationResult<RegistryState>>;
    /**
     * Register (or update) an MCP server definition ONCE and install it into the
     * given agents. There is never more than one definition per server name.
     */
    registerMCPServer(server: MCPServerConfig, agentIds?: string[]): Promise<OperationResult<RegistryState>>;
    /** Install an existing registry MCP server into additional agents. */
    addMCPServerToAgents(serverName: string, agentIds: string[]): Promise<OperationResult<RegistryState>>;
    /** Remove an MCP server from ONE agent's config (definition stays in registry). */
    removeMCPServerFromAgent(serverName: string, agentId: string): Promise<OperationResult<RegistryState>>;
    /** Update an MCP server's shared definition; every covered agent is rewritten. */
    updateMCPServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<OperationResult<RegistryState>>;
    /**
     * Per-agent override for an MCP server (e.g. a different env for one agent).
     * Merges with the shared definition at materialization time.
     */
    setMCPServerAgentOverride(serverName: string, agentId: string, override: MCPServerAgentOverride): Promise<OperationResult<RegistryState>>;
    /** Delete an MCP server from the registry and from every agent config. */
    deleteMCPServer(serverName: string): Promise<OperationResult<RegistryState>>;
    /** Read the raw config file of an agent (for directory checking / review). */
    readRawConfig(agentId: string): Promise<OperationResult<{
        path: string;
        content: string;
        exists: boolean;
    }>>;
    backupConfig(agentId: string): Promise<OperationResult<string>>;
    restoreConfig(agentId: string, backupPath: string): Promise<OperationResult>;
    getConfigPath(agentId: string, platform?: Platform): string | null;
    private reloadConfig;
    private summarizeResults;
}
export default AgentConfigManager;
//# sourceMappingURL=index.d.ts.map