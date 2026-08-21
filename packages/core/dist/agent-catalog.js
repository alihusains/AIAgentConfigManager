"use strict";
/**
 * Agent catalog — the maintained, versioned list of known AI coding agent CLIs.
 *
 * This module is the single source of truth for:
 *   1. What the dashboard shows under "Available to Install" (agents that are
 *      NOT on the machine yet but are known to exist).
 *   2. The install/uninstall commands the dashboard is ALLOWED to execute.
 *
 * IMPORTANT (security): the dashboard can run shell commands ONLY through
 * `getAgentCommands()` — the catalog is the allow-list. Never build commands
 * from client input. Commands are additionally filtered through
 * `isSafeCommand()` before execution.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentCatalogMeta = getAgentCatalogMeta;
exports.getAgentCatalog = getAgentCatalog;
exports.getAgentCatalogEntry = getAgentCatalogEntry;
exports.getAgentCommands = getAgentCommands;
exports.detectCatalogEntry = detectCatalogEntry;
exports.catalogEntryToDetected = catalogEntryToDetected;
exports.isSafeCommand = isSafeCommand;
const agent_catalog_json_1 = __importDefault(require("./agent-catalog.json"));
const utils_1 = require("./utils");
const CATALOG_JSON = agent_catalog_json_1.default;
const entries = CATALOG_JSON.agents;
/** Human-readable catalog metadata (version + last update), for the UI footer. */
function getAgentCatalogMeta() {
    return { version: CATALOG_JSON.version, updatedAt: CATALOG_JSON.updatedAt };
}
function getAgentCatalog() {
    return entries;
}
function getAgentCatalogEntry(id) {
    return entries.find((e) => e.id === id);
}
function appliesTo(platforms, platform) {
    return !platforms || platforms.length === 0 || platforms.includes(platform);
}
/**
 * The install/uninstall commands the dashboard is allowed to run for an agent,
 * filtered to the current platform. Returns undefined for agents that have no
 * catalogued command (manual install/uninstall only).
 */
function getAgentCommands(agentId, platform) {
    const entry = getAgentCatalogEntry(agentId);
    if (!entry)
        return undefined;
    const commands = {};
    if (entry.install && appliesTo(entry.installPlatforms, platform)) {
        commands.install = entry.install;
    }
    if (entry.uninstall && appliesTo(entry.uninstallPlatforms, platform)) {
        commands.uninstall = entry.uninstall;
    }
    if (entry.note)
        commands.note = entry.note;
    if (!commands.install && !commands.uninstall && !commands.note)
        return undefined;
    return commands;
}
/**
 * Lightweight detection for catalog entries that have no core adapter:
 * probes the entry's `binaries` on PATH and, if configured, its
 * `settingsPaths` on disk. Used by the dashboard so catalog-only agents
 * (reasonix, freebuff) show as Installed instead of "Available to Install".
 */
async function detectCatalogEntry(entry) {
    const binaries = entry.binaries?.length ? entry.binaries : [entry.id];
    let installed = false;
    let binaryPath;
    for (const binary of binaries) {
        try {
            const found = await (0, utils_1.getCommandPath)(binary);
            if (found) {
                installed = true;
                binaryPath = found;
                break;
            }
        }
        catch {
            // Probe the next binary — an uncooperative PATH lookup shouldn't fail the whole entry.
        }
    }
    let version;
    if (installed) {
        for (const binary of binaries) {
            try {
                const v = await (0, utils_1.getCommandVersion)(binary);
                if (v) {
                    version = v;
                    break;
                }
            }
            catch {
                // Version probing is best-effort.
            }
        }
    }
    const settingsPaths = (entry.settingsPaths?.[(0, utils_1.getCurrentPlatform)()] ?? []).map(utils_1.expandPath);
    let settingsExist = false;
    for (const p of settingsPaths) {
        try {
            if (await (0, utils_1.fileExists)(p)) {
                settingsExist = true;
                break;
            }
        }
        catch {
            // Best-effort: an unreadable path is treated as missing.
        }
    }
    return { installed, binaryPath, version, settingsExist, settingsPaths };
}
/**
 * Synthesizes a `DetectedAgent` for a catalog-only entry so the dashboard's
 * Installed table has everything it renders (binary path, version, config
 * existence, config path). The entry has no adapter, so reading/writing its
 * config is NOT supported — all capabilities are false.
 */
function catalogEntryToDetected(entry, probe) {
    const cfg = (entry.settingsPaths ?? {});
    return {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        configFormat: 'json',
        configPaths: {
            darwin: cfg.darwin?.[0] ?? '',
            win32: cfg.win32?.[0] ?? '',
            linux: cfg.linux?.[0] ?? '',
        },
        supports: {
            modelProviders: false,
            mcpServers: false,
            permissions: false,
            projectConfig: false,
        },
        binaries: entry.binaries?.length ? entry.binaries : [entry.id],
        detection: {
            installed: probe.installed,
            configExists: probe.settingsExist,
            binaryPath: probe.binaryPath,
            version: probe.version,
            method: probe.installed ? 'command' : probe.settingsExist ? 'config' : 'assumed',
        },
    };
}
/**
 * Defense-in-depth for the command allow-list. The catalog is already trusted,
 * but if a future entry is ever crafted carelessly this blocks destructive
 * patterns before they reach a shell.
 */
const FORBIDDEN_TOKENS = [
    'sudo',
    'su ',
    'rm -rf /',
    'mkfs.',
    'dd if=',
    '> /dev/sd',
    'shutdown',
    'reboot',
    ':(){',
];
function isSafeCommand(command) {
    const trimmed = command.trim();
    if (!trimmed)
        return false;
    if (trimmed.length > 500)
        return false;
    return !FORBIDDEN_TOKENS.some((tok) => trimmed.includes(tok));
}
//# sourceMappingURL=agent-catalog.js.map