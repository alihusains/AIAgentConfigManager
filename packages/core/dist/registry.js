"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGISTRY_VERSION = void 0;
exports.resolveRegistryPath = resolveRegistryPath;
exports.emptyRegistry = emptyRegistry;
exports.getRegistryDir = getRegistryDir;
exports.loadRegistry = loadRegistry;
exports.saveRegistry = saveRegistry;
exports.upsertProvider = upsertProvider;
exports.upsertMCPServer = upsertMCPServer;
exports.addProviderAgents = addProviderAgents;
exports.removeProviderAgent = removeProviderAgent;
exports.addMCPServerAgents = addMCPServerAgents;
exports.removeMCPServerAgent = removeMCPServerAgent;
exports.migrateFromAgentConfigs = migrateFromAgentConfigs;
exports.aggregateMaterialize = aggregateMaterialize;
const utils_1 = require("./utils");
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
exports.REGISTRY_VERSION = 1;
/** Resolve the registry file path for the current OS. */
function resolveRegistryPath() {
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
function emptyRegistry() {
    return {
        version: exports.REGISTRY_VERSION,
        providers: [],
        mcpServers: [],
        customAgents: [],
        updatedAt: Date.now(),
    };
}
function getRegistryDir(registryPath) {
    return path.dirname(registryPath);
}
/** Read the registry from disk; returns null when it does not exist yet. */
async function loadRegistry(registryPath) {
    const exists = await (0, utils_1.fileExists)(registryPath);
    if (!exists)
        return null;
    const content = await (0, utils_1.readFileSafe)(registryPath);
    if (!content)
        return null;
    try {
        const parsed = JSON.parse(content);
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
    }
    catch {
        // A corrupt registry file must never brick the tool — treat as empty and
        // let the caller warn the user.
        const registry = emptyRegistry();
        registry.corrupt = true;
        return registry;
    }
}
/** Persist the registry atomically (write temp file, then rename). */
async function saveRegistry(registryPath, registry) {
    registry.updatedAt = Date.now();
    const tmp = `${registryPath}.tmp`;
    await (0, utils_1.writeFileSafe)(tmp, JSON.stringify(registry, null, 2));
    const fs = await import('node:fs');
    fs.renameSync(tmp, registryPath);
}
// ============================================================================
// Merge / mutation helpers (immutable-ish: return updated registry copies)
// ============================================================================
/** Upsert a provider definition + its models; returns the updated registry. */
function upsertProvider(registry, provider, models, apiCapabilities) {
    const index = registry.providers.findIndex((p) => p.provider.id === provider.id);
    if (index === -1) {
        registry.providers.push({
            provider,
            models,
            agentIds: [],
            ...(apiCapabilities ? { apiCapabilities } : {}),
        });
    }
    else {
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
function upsertMCPServer(registry, server) {
    const index = registry.mcpServers.findIndex((s) => s.server.name === server.name);
    if (index === -1) {
        registry.mcpServers.push({ server, agentIds: [] });
    }
    else {
        registry.mcpServers[index] = { ...registry.mcpServers[index], server };
    }
    return registry;
}
/** Add agent ids to a registry provider's coverage (deduped). */
function addProviderAgents(registry, providerId, agentIds) {
    const entry = registry.providers.find((p) => p.provider.id === providerId);
    if (!entry)
        return { ok: false, error: `Provider "${providerId}" not found in registry` };
    const set = new Set(entry.agentIds);
    for (const id of agentIds)
        set.add(id);
    entry.agentIds = Array.from(set);
    return { ok: true };
}
/** Remove an agent from a provider's coverage. */
function removeProviderAgent(registry, providerId, agentId) {
    const entry = registry.providers.find((p) => p.provider.id === providerId);
    if (entry) {
        entry.agentIds = entry.agentIds.filter((id) => id !== agentId);
    }
    return registry;
}
/** Add agent ids to an MCP server's coverage (deduped). */
function addMCPServerAgents(registry, serverName, agentIds) {
    const entry = registry.mcpServers.find((s) => s.server.name === serverName);
    if (!entry)
        return { ok: false, error: `MCP server "${serverName}" not found in registry` };
    const set = new Set(entry.agentIds);
    for (const id of agentIds)
        set.add(id);
    entry.agentIds = Array.from(set);
    return { ok: true };
}
/** Remove an agent from an MCP server's coverage. */
function removeMCPServerAgent(registry, serverName, agentId) {
    const entry = registry.mcpServers.find((s) => s.server.name === serverName);
    if (entry) {
        entry.agentIds = entry.agentIds.filter((id) => id !== agentId);
        if (entry.agentOverrides) {
            delete entry.agentOverrides[agentId];
        }
    }
    return registry;
}
/**
 * Build a registry from the current state of every agent's config file.
 * Providers and MCP servers found on disk become registry entries with the
 * agent recorded as covered. First-seen definition wins for merges.
 */
async function migrateFromAgentConfigs(inputs, existing) {
    const registry = { ...existing, providers: [...existing.providers], mcpServers: [...existing.mcpServers] };
    const warnings = [];
    for (const input of inputs) {
        for (const provider of input.config.modelProviders) {
            const entry = registry.providers.find((p) => p.provider.id === provider.id);
            if (entry) {
                // Same provider across agents: record coverage, keep first definition
                if (!entry.agentIds.includes(input.agentId))
                    entry.agentIds.push(input.agentId);
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
                if (!entry.agentIds.includes(input.agentId))
                    entry.agentIds.push(input.agentId);
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
function aggregateMaterialize(results) {
    const written = [];
    const errors = [];
    const warnings = [];
    for (const r of results) {
        if (r.ok)
            written.push(r.agentId);
        else
            errors.push(`${r.agentId}: ${r.error || 'unknown error'}`);
    }
    return {
        ok: errors.length === 0,
        written,
        errors,
        warnings,
    };
}
//# sourceMappingURL=registry.js.map