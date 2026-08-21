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
import { Registry, RegistryProvider, MCPServerConfig, ModelProvider, ModelConfig, MaterializeResult } from './types';
export declare const REGISTRY_VERSION = 1;
/** Resolve the registry file path for the current OS. */
export declare function resolveRegistryPath(): string;
export declare function emptyRegistry(): Registry;
export declare function getRegistryDir(registryPath: string): string;
/** Read the registry from disk; returns null when it does not exist yet. */
export declare function loadRegistry(registryPath: string): Promise<Registry | null>;
/** Persist the registry atomically (write temp file, then rename). */
export declare function saveRegistry(registryPath: string, registry: Registry): Promise<void>;
/** Upsert a provider definition + its models; returns the updated registry. */
export declare function upsertProvider(registry: Registry, provider: ModelProvider, models: ModelConfig[], apiCapabilities?: RegistryProvider['apiCapabilities']): Registry;
/** Upsert an MCP server definition; returns the updated registry. */
export declare function upsertMCPServer(registry: Registry, server: MCPServerConfig): Registry;
/** Add agent ids to a registry provider's coverage (deduped). */
export declare function addProviderAgents(registry: Registry, providerId: string, agentIds: string[]): {
    ok: boolean;
    error?: string;
};
/** Remove an agent from a provider's coverage. */
export declare function removeProviderAgent(registry: Registry, providerId: string, agentId: string): Registry;
/** Add agent ids to an MCP server's coverage (deduped). */
export declare function addMCPServerAgents(registry: Registry, serverName: string, agentIds: string[]): {
    ok: boolean;
    error?: string;
};
/** Remove an agent from an MCP server's coverage. */
export declare function removeMCPServerAgent(registry: Registry, serverName: string, agentId: string): Registry;
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
export declare function migrateFromAgentConfigs(inputs: MigrationInput[], existing: Registry): Promise<{
    registry: Registry;
    warnings: string[];
}>;
/** Aggregate per-agent write results into a MaterializeResult. */
export declare function aggregateMaterialize(results: {
    agentId: string;
    ok: boolean;
    error?: string;
}[]): MaterializeResult;
//# sourceMappingURL=registry.d.ts.map