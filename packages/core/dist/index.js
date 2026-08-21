"use strict";
/**
 * AI Agent Config Manager - Core Library
 * Main entry point exporting all public APIs
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentConfigManager = void 0;
// Types
__exportStar(require("./types"), exports);
// Registry (single source of truth for providers + MCP servers)
__exportStar(require("./registry"), exports);
// Utilities
__exportStar(require("./utils"), exports);
// Adapters
__exportStar(require("./adapters"), exports);
// Maintained agent catalog (known agent CLIs + install/uninstall allow-list)
__exportStar(require("./agent-catalog"), exports);
// Provider API verification (probe /models, /chat/completions, /responses)
__exportStar(require("./provider-test"), exports);
const adapters_1 = require("./adapters");
const utils_1 = require("./utils");
const registry_1 = require("./registry");
class AgentConfigManager {
    adapters = new Map();
    configs = new Map();
    constructor() {
        // Auto-load all available adapters
        for (const adapter of (0, adapters_1.listAvailableAdapters)()) {
            this.adapters.set(adapter.info.id, adapter);
        }
    }
    // Agent management
    getAvailableAgents() {
        return Array.from(this.adapters.values()).map(a => a.info);
    }
    getAgent(agentId) {
        return this.adapters.get(agentId);
    }
    getAgentInfo(agentId) {
        return this.adapters.get(agentId)?.info;
    }
    // ============================================================================
    // Agent CLI Detection
    // ============================================================================
    /**
     * Detect which agent CLIs are actually installed on this machine.
     * Checks each adapter's binary names on PATH and whether its config exists.
     */
    async detectAgent(agentId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter)
            return null;
        const info = adapter.info;
        const detection = {
            installed: false,
            configExists: false,
            method: 'assumed',
        };
        for (const binary of info.binaries) {
            try {
                const binaryPath = await (0, utils_1.getCommandPath)(binary);
                if (binaryPath) {
                    detection.installed = true;
                    detection.binaryPath = binaryPath;
                    detection.method = 'command';
                    try {
                        const version = await (0, utils_1.getCommandVersion)(binary);
                        if (version)
                            detection.version = version;
                    }
                    catch {
                        // Version query is best-effort
                    }
                    break;
                }
            }
            catch {
                // Try the next binary name
            }
        }
        try {
            const configPath = adapter.getConfigPath();
            detection.configExists = await (0, utils_1.fileExists)(configPath);
            if (detection.configExists && !detection.installed) {
                detection.method = 'config';
            }
        }
        catch {
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
    async detectAgents() {
        const results = await Promise.all(Array.from(this.adapters.keys()).map((id) => this.detectAgent(id)));
        const detected = results.filter((r) => r !== null);
        detected.sort((a, b) => {
            if (a.detection.installed !== b.detection.installed) {
                return a.detection.installed ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        return detected;
    }
    // Config operations
    async loadConfig(agentId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            const config = await adapter.readConfig();
            this.configs.set(agentId, config);
            return { success: true, data: config };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async loadAllConfigs() {
        const results = {};
        const errors = [];
        for (const [id, adapter] of this.adapters) {
            try {
                const config = await adapter.readConfig();
                results[id] = config;
                this.configs.set(id, config);
            }
            catch (error) {
                errors.push(`${id}: ${error}`);
            }
        }
        return {
            success: errors.length === 0,
            data: results,
            warnings: errors.length > 0 ? errors : undefined,
        };
    }
    async saveConfig(agentId, config) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.writeConfig(config);
            this.configs.set(agentId, config);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    getCachedConfig(agentId) {
        return this.configs.get(agentId);
    }
    // Model Provider operations (single agent)
    async addModelProvider(agentId, provider) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.addModelProvider(provider);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async removeModelProvider(agentId, providerId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.removeModelProvider(providerId);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // Model operations (single agent)
    async addModel(agentId, model) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.addModel(model);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async removeModel(agentId, modelId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.removeModel(modelId);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // MCP operations (single agent)
    async addMCPServer(agentId, server) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.addMCPServer(server);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async removeMCPServer(agentId, serverName) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.removeMCPServer(serverName);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // Permission operations (single agent)
    async addPermission(agentId, permission) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.addPermission(permission);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async removePermission(agentId, permissionId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.removePermission(permissionId);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // Batch operations (Select All functionality)
    async addModelProviderToAll(provider, agentIds) {
        const targets = agentIds || Array.from(this.adapters.keys());
        const results = [];
        for (const id of targets) {
            const result = await this.addModelProvider(id, provider);
            results.push(result);
        }
        return this.summarizeResults(results);
    }
    async addModelToAll(model, agentIds) {
        const targets = agentIds || Array.from(this.adapters.keys());
        const results = [];
        for (const id of targets) {
            const adapter = this.adapters.get(id);
            if (adapter?.info.supports.modelProviders) {
                const result = await this.addModel(id, model);
                results.push(result);
            }
            else {
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
    async installProvider(provider, models = [], agentIds) {
        const targets = agentIds || Array.from(this.adapters.keys());
        const results = [];
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
                    }
                    catch (error) {
                        results.push({
                            success: false,
                            error: `Agent "${id}": model "${model.name}": ${error}`,
                        });
                    }
                }
                await this.reloadConfig(id);
                results.push({ success: true });
            }
            catch (error) {
                results.push({ success: false, error: `Agent "${id}": ${error}` });
            }
        }
        return this.summarizeResults(results);
    }
    async addMCPServerToAll(server, agentIds) {
        const targets = agentIds || Array.from(this.adapters.keys());
        const results = [];
        for (const id of targets) {
            // Skip agents that don't support MCP
            const adapter = this.adapters.get(id);
            if (adapter?.info.supports.mcpServers) {
                const result = await this.addMCPServer(id, server);
                results.push(result);
            }
            else {
                results.push({ success: false, error: `Agent "${id}" doesn't support MCP servers` });
            }
        }
        return this.summarizeResults(results);
    }
    async addPermissionToAll(permission, agentIds) {
        const targets = agentIds || Array.from(this.adapters.keys());
        const results = [];
        for (const id of targets) {
            const adapter = this.adapters.get(id);
            if (adapter?.info.supports.permissions) {
                const result = await this.addPermission(id, permission);
                results.push(result);
            }
            else {
                results.push({ success: false, error: `Agent "${id}" doesn't support permissions` });
            }
        }
        return this.summarizeResults(results);
    }
    // Registry state (single source of truth)
    registry = null;
    registryFilePath = '';
    /**
     * Load the registry (creating it on first run by absorbing the current
     * content of every agent's config file). Safe to call multiple times.
     */
    async initRegistry() {
        this.registryFilePath = (0, registry_1.resolveRegistryPath)();
        let registry = await (0, registry_1.loadRegistry)(this.registryFilePath);
        if (!registry) {
            // First run: migrate existing agent configs into the registry
            const inputs = [];
            const warnings = [];
            for (const [id, adapter] of this.adapters) {
                try {
                    const config = await adapter.readConfig();
                    inputs.push({ agentId: id, config });
                }
                catch (error) {
                    warnings.push(`${id}: ${error}`);
                }
            }
            const migrated = await (0, registry_1.migrateFromAgentConfigs)(inputs, (0, registry_1.emptyRegistry)());
            registry = migrated.registry;
            registry.migrationWarnings = [...(migrated.warnings), ...warnings];
            await (0, registry_1.saveRegistry)(this.registryFilePath, registry);
        }
        if (registry.corrupt) {
            registry.migrationWarnings = registry.migrationWarnings || [];
            registry.migrationWarnings.push('registry.json was unreadable and was replaced with an empty registry');
            await (0, registry_1.saveRegistry)(this.registryFilePath, registry);
        }
        this.registry = registry;
        this.registerCustomAdapters();
        return { success: true, data: await this.getRegistryState() };
    }
    /** Create adapters for user-defined agents stored in the registry. */
    customAdapterIds = new Set();
    registerCustomAdapters() {
        // Drop previously-registered custom adapters (built-ins are never touched)
        for (const id of this.customAdapterIds) {
            if (!this.registry?.customAgents.some((a) => a.id === id)) {
                this.adapters.delete(id);
                this.configs.delete(id);
            }
        }
        this.customAdapterIds.clear();
        if (!this.registry)
            return;
        for (const def of this.registry.customAgents) {
            this.adapters.set(def.id, (0, adapters_1.createGenericAdapter)({
                id: def.id,
                name: def.name,
                description: def.description,
                configPath: def.configPath,
                mcpPath: def.mcpPath,
                format: def.format,
            }));
            this.customAdapterIds.add(def.id);
        }
    }
    async getRegistryState() {
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
    async importRegistry(data) {
        const registry = await this.requireRegistry();
        if (!data || typeof data !== 'object') {
            return { success: false, error: 'Registry file must be a JSON object' };
        }
        const candidate = data;
        if (!Array.isArray(candidate.providers) || !Array.isArray(candidate.mcpServers)) {
            return { success: false, error: 'Registry file must have providers[] and mcpServers[]' };
        }
        if (candidate.customAgents && !Array.isArray(candidate.customAgents)) {
            return { success: false, error: 'customAgents must be an array' };
        }
        // Minimal shape checks so a malformed file cannot wedge the app
        const allHaveAgentIds = (entries) => entries.every((e) => e && typeof e === 'object' && Array.isArray(e.agentIds));
        if (!allHaveAgentIds(candidate.providers) || !allHaveAgentIds(candidate.mcpServers)) {
            return { success: false, error: 'Registry entries must carry agentIds[]' };
        }
        const next = {
            version: 1,
            providers: candidate.providers,
            mcpServers: candidate.mcpServers,
            customAgents: Array.isArray(candidate.customAgents)
                ? candidate.customAgents
                : [],
            updatedAt: Date.now(),
        };
        this.registry = next;
        this.registerCustomAdapters();
        await (0, registry_1.saveRegistry)(this.registryFilePath, next);
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
    async addCustomAgent(def) {
        const registry = await this.requireRegistry();
        const id = def.id.trim();
        if (!id)
            return { success: false, error: 'Agent id is required' };
        if (!def.configPath.trim())
            return { success: false, error: 'Config path is required' };
        if (registry.customAgents.some((a) => a.id === id) || this.adapters.has(id)) {
            return { success: false, error: `Agent "${id}" already exists` };
        }
        const entry = {
            id,
            name: def.name.trim() || id,
            description: def.description?.trim() || undefined,
            configPath: def.configPath.trim(),
            mcpPath: def.mcpPath?.trim() || undefined,
            format: def.format || 'json',
        };
        registry.customAgents.push(entry);
        this.adapters.set(id, (0, adapters_1.createGenericAdapter)({
            id: entry.id,
            name: entry.name,
            description: entry.description,
            configPath: entry.configPath,
            mcpPath: entry.mcpPath,
            format: entry.format,
        }));
        this.customAdapterIds.add(id);
        await (0, registry_1.saveRegistry)(this.registryFilePath, registry);
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
    async updateCustomAgent(id, updates) {
        const registry = await this.requireRegistry();
        const entry = registry.customAgents.find((a) => a.id === id);
        if (!entry)
            return { success: false, error: `Agent "${id}" not found` };
        if (updates.name !== undefined)
            entry.name = updates.name.trim() || entry.name;
        if (updates.description !== undefined)
            entry.description = updates.description?.trim() || undefined;
        if (updates.configPath !== undefined) {
            if (!updates.configPath.trim())
                return { success: false, error: 'Config path is required' };
            entry.configPath = updates.configPath.trim();
        }
        if (updates.mcpPath !== undefined)
            entry.mcpPath = updates.mcpPath.trim() || undefined;
        if (updates.format !== undefined)
            entry.format = updates.format;
        this.adapters.set(id, (0, adapters_1.createGenericAdapter)({
            id: entry.id,
            name: entry.name,
            description: entry.description,
            configPath: entry.configPath,
            mcpPath: entry.mcpPath,
            format: entry.format,
        }));
        await (0, registry_1.saveRegistry)(this.registryFilePath, registry);
        const materialize = await this.syncAgents([id]);
        const data = await this.getRegistryState();
        return {
            success: materialize.ok,
            data,
            warnings: materialize.errors.length > 0 ? materialize.errors : undefined,
        };
    }
    /** Remove a custom agent from the registry (its files are left untouched). */
    async removeCustomAgent(id) {
        const registry = await this.requireRegistry();
        const entry = registry.customAgents.find((a) => a.id === id);
        if (!entry)
            return { success: false, error: `Agent "${id}" not found` };
        registry.customAgents = registry.customAgents.filter((a) => a.id !== id);
        // Clean every registry reference to the removed agent
        for (const p of registry.providers) {
            p.agentIds = p.agentIds.filter((aid) => aid !== id);
        }
        for (const m of registry.mcpServers) {
            m.agentIds = m.agentIds.filter((aid) => aid !== id);
            if (m.agentOverrides)
                delete m.agentOverrides[id];
        }
        this.adapters.delete(id);
        this.configs.delete(id);
        this.customAdapterIds.delete(id);
        await (0, registry_1.saveRegistry)(this.registryFilePath, registry);
        return { success: true, data: await this.getRegistryState() };
    }
    async requireRegistry() {
        if (this.registry)
            return this.registry;
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
    async materializeAgent(agentId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter)
            return { agentId, ok: false, error: 'Agent not found' };
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
            const modelProviders = current.modelProviders
                .filter((p) => !registryProviderIds.has(p.id))
                .concat(targetedProviders.map((rp) => ({ ...rp.provider })));
            const models = current.models
                .filter((m) => !registryProviderIds.has(m.providerId))
                .concat(targetedProviders.flatMap((rp) => rp.models.map((m) => ({ ...m }))));
            const mcpServers = current.mcpServers
                .filter((s) => !registryServerNames.has(s.name))
                .concat(targetedServers.map((rs) => {
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
            }));
            const merged = {
                ...current,
                modelProviders,
                models,
                mcpServers,
                lastModified: Date.now(),
            };
            await adapter.writeConfig(merged);
            return { agentId, ok: true };
        }
        catch (error) {
            return { agentId, ok: false, error: String(error) };
        }
    }
    /** Materialize the registry into the given agents' config files. */
    async syncAgents(agentIds) {
        const results = await Promise.all(agentIds.map((id) => this.materializeAgent(id)));
        const aggregate = (0, registry_1.aggregateMaterialize)(results);
        for (const id of aggregate.written) {
            await this.reloadConfig(id).catch(() => undefined);
        }
        return aggregate;
    }
    async registryMutation(mutate, affectedAgents) {
        const registry = await this.requireRegistry();
        mutate(registry);
        await (0, registry_1.saveRegistry)(this.registryFilePath, registry);
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
    async registerProvider(provider, models = [], agentIds = [], apiCapabilities) {
        const registry = await this.requireRegistry();
        (0, registry_1.upsertProvider)(registry, provider, models, apiCapabilities);
        const added = (0, registry_1.addProviderAgents)(registry, provider.id, agentIds);
        if (!added.ok)
            return { success: false, error: added.error };
        return this.registryMutation(() => { }, agentIds);
    }
    /** Install an existing registry provider into additional agents. */
    async addProviderToAgents(providerId, agentIds) {
        return this.registryMutation((registry) => {
            (0, registry_1.addProviderAgents)(registry, providerId, agentIds);
        }, agentIds);
    }
    /** Remove a provider from ONE agent's config (definition stays in registry). */
    async removeProviderFromAgent(providerId, agentId) {
        return this.registryMutation((registry) => {
            (0, registry_1.removeProviderAgent)(registry, providerId, agentId);
        }, [agentId]);
    }
    /**
     * Update a provider's definition + models. Coverage is unchanged; every
     * covered agent's config is rewritten.
     */
    async updateProvider(providerId, updates) {
        return this.registryMutation((registry) => {
            const entry = registry.providers.find((p) => p.provider.id === providerId);
            if (!entry)
                return;
            if (updates.provider) {
                entry.provider = { ...entry.provider, ...updates.provider, id: providerId };
            }
            if (updates.models)
                entry.models = updates.models;
            if (updates.apiCapabilities !== undefined)
                entry.apiCapabilities = updates.apiCapabilities;
        }, this.registry?.providers.find((p) => p.provider.id === providerId)?.agentIds || []);
    }
    /**
     * Persist the live API-verification result for a provider WITHOUT rewriting
     * any agent config (registry-metadata only). Used by POST /api/providers/:id/test.
     */
    async recordProviderCapabilities(providerId, apiCapabilities) {
        const registry = await this.requireRegistry();
        const entry = registry.providers.find((p) => p.provider.id === providerId);
        if (!entry)
            return { success: false, error: `Provider "${providerId}" not found in registry` };
        entry.apiCapabilities = apiCapabilities;
        await (0, registry_1.saveRegistry)(this.registryFilePath, registry);
        this.registry = registry;
        return { success: true, data: true };
    }
    /** Delete a provider from the registry and from every agent config. */
    async deleteProvider(providerId) {
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
    async registerMCPServer(server, agentIds = []) {
        const registry = await this.requireRegistry();
        (0, registry_1.upsertMCPServer)(registry, server);
        const added = (0, registry_1.addMCPServerAgents)(registry, server.name, agentIds);
        if (!added.ok)
            return { success: false, error: added.error };
        return this.registryMutation(() => { }, agentIds);
    }
    /** Install an existing registry MCP server into additional agents. */
    async addMCPServerToAgents(serverName, agentIds) {
        return this.registryMutation((registry) => {
            (0, registry_1.addMCPServerAgents)(registry, serverName, agentIds);
        }, agentIds);
    }
    /** Remove an MCP server from ONE agent's config (definition stays in registry). */
    async removeMCPServerFromAgent(serverName, agentId) {
        return this.registryMutation((registry) => {
            (0, registry_1.removeMCPServerAgent)(registry, serverName, agentId);
        }, [agentId]);
    }
    /** Update an MCP server's shared definition; every covered agent is rewritten. */
    async updateMCPServer(serverName, updates) {
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
    async setMCPServerAgentOverride(serverName, agentId, override) {
        return this.registryMutation((registry) => {
            const entry = registry.mcpServers.find((s) => s.server.name === serverName);
            if (entry) {
                entry.agentOverrides = entry.agentOverrides || {};
                entry.agentOverrides[agentId] = { ...entry.agentOverrides[agentId], ...override };
                if (!entry.agentIds.includes(agentId))
                    entry.agentIds.push(agentId);
            }
        }, [agentId]);
    }
    /** Delete an MCP server from the registry and from every agent config. */
    async deleteMCPServer(serverName) {
        const registry = await this.requireRegistry();
        const entry = registry.mcpServers.find((s) => s.server.name === serverName);
        const affected = entry ? [...entry.agentIds] : [];
        return this.registryMutation((r) => {
            r.mcpServers = r.mcpServers.filter((s) => s.server.name !== serverName);
        }, affected);
    }
    /** Read the raw config file of an agent (for directory checking / review). */
    async readRawConfig(agentId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter)
            return { success: false, error: `Agent "${agentId}" not found` };
        try {
            const configPath = adapter.getConfigPath();
            const exists = await (0, utils_1.fileExists)(configPath);
            const content = exists ? (await (0, utils_1.readFileSafe)(configPath)) || '' : '';
            return { success: true, data: { path: configPath, content, exists } };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    // Utility
    async backupConfig(agentId) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            const backupPath = await adapter.backupConfig();
            return { success: true, data: backupPath };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    async restoreConfig(agentId, backupPath) {
        const adapter = this.adapters.get(agentId);
        if (!adapter) {
            return { success: false, error: `Agent "${agentId}" not found` };
        }
        try {
            await adapter.restoreConfig(backupPath);
            await this.reloadConfig(agentId);
            return { success: true };
        }
        catch (error) {
            return { success: false, error: String(error) };
        }
    }
    getConfigPath(agentId, platform) {
        return (0, adapters_1.resolveConfigPathForAgent)(agentId, platform);
    }
    async reloadConfig(agentId) {
        const adapter = this.adapters.get(agentId);
        if (adapter) {
            const config = await adapter.readConfig();
            this.configs.set(agentId, config);
        }
    }
    summarizeResults(results) {
        const succeeded = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const errors = results
            .filter(r => !r.success)
            .map(r => r.error)
            .filter((e) => Boolean(e));
        return {
            success: failed === 0,
            data: undefined,
            error: failed > 0 ? `${failed} of ${results.length} operations failed` : undefined,
            warnings: errors.length > 0 ? errors : undefined,
        };
    }
}
exports.AgentConfigManager = AgentConfigManager;
// Default export
exports.default = AgentConfigManager;
//# sourceMappingURL=index.js.map