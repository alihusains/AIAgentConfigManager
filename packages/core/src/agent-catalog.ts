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

import catalogJson from './agent-catalog.json';
import {
  expandPath,
  fileExists,
  getCommandVersion,
  getCurrentPlatform,
  parseConfig,
  readFileSafe,
} from './utils';
import { resolveBinary, type BinaryFoundBy, type ResolvedBinary } from './detect/binary';
import { listAvailableAdapters } from './adapters';
import type { Platform, ProviderApiKind } from './types';
import type { DetectedAgent } from './index'; // eslint-disable-line import/no-cycle

export type AgentCatalogStatus = 'stable' | 'beta' | 'upcoming';

export interface AgentCatalogEntry {
  /**
   * Agent id — matches the core adapter id (e.g. "claude-code", "opencode")
   * when an adapter exists. Entries WITHOUT an adapter (e.g. reasonix,
   * freebuff) are still listed: the dashboard probes `binaries` and
   * `settingsPaths` directly to decide Installed vs Available.
   */
  id: string;
  name: string;
  description: string;
  /** stable = proven & maintained, beta = newer entrant, upcoming = known but not shipping a CLI yet. */
  status: AgentCatalogStatus;
  /** Project homepage / docs URL. */
  source?: string;
  /** ISO date the entry was added to the catalog. */
  addedAt: string;
  /** CLI binary name(s) probed on PATH to decide whether this agent is installed. */
  binaries?: string[];
  /**
   * Per-platform config/settings files used as an additional installed
   * footprint for entries that have no core adapter (adapter-backed entries
   * get their paths from the adapter instead). Paths may contain `~`.
   */
  settingsPaths?: Partial<Record<Platform, string[]>>;
  /** Shell command that installs the agent CLI (absent = no automated install). */
  install?: string;
  /** Platforms the install command is known to work on. Absent = all platforms. */
  installPlatforms?: Platform[];
  /** Shell command that removes the agent CLI (absent = no automated uninstall). */
  uninstall?: string;
  /** Platforms the uninstall command is known to work on. Absent = all platforms. */
  uninstallPlatforms?: Platform[];
  /**
   * Version probe argument forms to try, in order. Defaults to
   * `["--version"]`; use `["--version", "-V"]` for CLIs that only
   * accept the short form.
   */
  versionArgs?: string[];
  /** Candidate paths where model/provider config lives (see AgentInfo). */
  modelConfigPaths?: Partial<Record<Platform, string[]>>;
  /**
   * Where MCP servers are configured, per platform. When present the entry
   * is MCP-capable (catalogEntryToDetected sets supports.mcpServers=true).
   * Usually the same file as settingsPaths (reasonix's [[plugins]]).
   */
  mcpPaths?: Partial<Record<Platform, string[]>>;
  /** Where provider API keys are stored, when distinct from the settings file.
   *  e.g. reasonix keeps its DEEPSEEK_API_KEY in ~/.reasonix/.env. */
  modelCredentialPaths?: Partial<Record<Platform, string[]>>;
  /** Shown in the UI under the command — explains alternatives or warns. */
  note?: string;
  /**
   * Lucide icon name to render for this agent in the UI (e.g. "Bot", "Zap").
   * Absent = fall back to a generic bot glyph. Kept as a string so the
   * catalog JSON stays framework-agnostic; the GUI maps name → icon component.
   */
  icon?: string;
  /**
   * API/wire protocols this agent's provider config can express, drawn from the
   * `ProviderApiKind` vocabulary:
   *   - 'chat'      = OpenAI Chat Completions / OpenAI-compatible chat endpoint
   *   - 'responses' = OpenAI Responses API
   *   - 'anthropic' = Anthropic Messages API
   * Drives the api-capability badges shown in the dashboard. Absent = unknown.
   */
  apiTypes?: ProviderApiKind[];
  /**
   * Per-platform directories where the agent loads user skills from (each
   * skill = a folder containing a SKILL.md with YAML frontmatter). Presence
   * for the current platform marks the entry as "skill capable" — see
   * skills.ts for assign/remove. Paths may contain `~`.
   */
  skillsPaths?: Partial<Record<Platform, string>>;
}

/** Platform-filtered view of a catalog entry's lifecycle commands. */
export interface AgentCommands {
  install?: string;
  uninstall?: string;
  note?: string;
}

/** A running (or finished) install/uninstall command launched by the dashboard. */
export interface AgentJob {
  id: string;
  agentId: string;
  action: 'install' | 'uninstall' | 'update';
  command: string;
  status: 'running' | 'success' | 'failed';
  exitCode?: number;
  /** Merged stdout+stderr, kept as a tail (oldest bytes dropped past the cap). */
  output: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

const CATALOG_JSON = catalogJson as {
  version: number;
  updatedAt: string;
  agents: AgentCatalogEntry[];
};

const entries: AgentCatalogEntry[] = CATALOG_JSON.agents;

/** Human-readable catalog metadata (version + last update), for the UI footer. */
export function getAgentCatalogMeta(): { version: number; updatedAt: string } {
  return { version: CATALOG_JSON.version, updatedAt: CATALOG_JSON.updatedAt };
}

export function getAgentCatalog(): AgentCatalogEntry[] {
  // Adapter-backed entries: derive binaries from the adapter so the catalog
  // JSON never drifts from the adapter's own binary list. JSON fields remain
  // as fallbacks for non-adapter entries only.
  const adapters = new Map(listAvailableAdapters().map((a) => [a.info.id, a.info]));
  return entries.map((entry) => {
    const adapterInfo = adapters.get(entry.id);
    if (adapterInfo?.binaries?.length) {
      return { ...entry, binaries: adapterInfo.binaries };
    }
    return entry;
  });
}

export function getAgentCatalogEntry(id: string): AgentCatalogEntry | undefined {
  return getAgentCatalog().find((e) => e.id === id);
}

function appliesTo(platforms: Platform[] | undefined, platform: Platform): boolean {
  return !platforms || platforms.length === 0 || platforms.includes(platform);
}

/**
 * The install/uninstall commands the dashboard is allowed to run for an agent,
 * filtered to the current platform. Returns undefined for agents that have no
 * catalogued command (manual install/uninstall only).
 */
export function getAgentCommands(agentId: string, platform: Platform): AgentCommands | undefined {
  const entry = getAgentCatalogEntry(agentId);
  if (!entry) return undefined;
  const commands: AgentCommands = {};
  if (entry.install && appliesTo(entry.installPlatforms, platform)) {
    commands.install = entry.install;
  }
  if (entry.uninstall && appliesTo(entry.uninstallPlatforms, platform)) {
    commands.uninstall = entry.uninstall;
  }
  if (entry.note) commands.note = entry.note;
  if (!commands.install && !commands.uninstall && !commands.note) return undefined;
  return commands;
}

// ============================================================================
// Catalog-driven detection (for entries with NO core adapter)
// ============================================================================

/** Live probe result for a catalog entry that has no core adapter. */
export interface CatalogEntryDetection {
  /** True when one of the entry's binaries was found on PATH. */
  installed: boolean;
  /** Absolute path of the first binary found (e.g. /usr/local/bin/reasonix). */
  binaryPath?: string;
  /** How the binary was located. */
  detectedBy?: BinaryFoundBy;
  /** Version string reported by the CLI, if it could be queried. */
  version?: string;
  settingsExist: boolean;
  /** Expanded (home-resolved) candidate settings paths, for the GUI. */
  settingsPaths: string[];
  /** Resolved MCP config path (from entry.mcpPaths), if declared. */
  mcpPath?: string;
  /** Whether the MCP config file exists on disk. */
  mcpConfigExists?: boolean;
  /** Number of MCP servers in the config (best-effort). */
  mcpServerCount?: number;
  /** Where model/provider config lives (from settingsPaths). */
  modelConfigPath?: string;
  /** Whether the model config file exists on disk. */
  modelConfigExists?: boolean;
  /** Where provider credentials are stored, when distinct. */
  modelCredentialPath?: string;
  /** Whether the credential file exists on disk. */
  modelCredentialExists?: boolean;
}

/**
 * Best-effort MCP server count for a catalog-only entry. Reuses the
 * same shape heuristics as the core's countMcpServers.
 */
async function countCatalogMcpServers(path: string, _entry: AgentCatalogEntry): Promise<number> {
  try {
    const content = await readFileSafe(path);
    if (!content) return 0;
    let raw: unknown;
    try {
      raw = parseConfig(content, 'toml');
    } catch {
      try {
        raw = parseConfig(content, 'json');
      } catch {
        return 0;
      }
    }
    if (!raw || typeof raw !== 'object') return 0;
    const obj = raw as Record<string, unknown>;
    const plugins = obj.plugins;
    if (Array.isArray(plugins)) return plugins.length;
    const keyed = obj.mcpServers;
    if (keyed && typeof keyed === 'object' && !Array.isArray(keyed)) {
      return Object.keys(keyed as object).length;
    }
    const arr = obj.mcp;
    if (Array.isArray(arr)) return arr.length;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Lightweight detection for catalog entries that have no core adapter:
 * probes the entry's `binaries` on PATH and, if configured, its
 * `settingsPaths` on disk. Used by the dashboard so catalog-only agents
 * (reasonix, freebuff) show as Installed instead of "Available to Install".
 */
export async function detectCatalogEntry(entry: AgentCatalogEntry): Promise<CatalogEntryDetection> {
  const binaries = entry.binaries?.length ? entry.binaries : [entry.id];

  // Probe all candidate binaries in parallel (independent lookups); the
  // first name that resolves wins, same as the sequential order before.
  const found = (await Promise.all(binaries.map((b) => resolveBinary(b).catch(() => null)))).find(
    (f): f is ResolvedBinary => f !== null
  );
  const installed = found !== undefined;
  const binaryPath = found?.path;
  const detectedBy = found?.foundBy;

  let version: string | undefined;
  if (installed) {
    for (const binary of binaries) {
      try {
        const v = await getCommandVersion(binary, entry.versionArgs);
        if (v) {
          version = v;
          break;
        }
      } catch {
        // Version probing is best-effort.
      }
    }
  }

  const settingsPaths = (entry.settingsPaths?.[getCurrentPlatform()] ?? []).map(expandPath);
  let settingsExist = false;
  for (const p of settingsPaths) {
    try {
      if (await fileExists(p)) {
        settingsExist = true;
        break;
      }
    } catch {
      // Best-effort: an unreadable path is treated as missing.
    }
  }

  // Model config: the first existing settings path (or the first candidate).
  const modelConfigPath = settingsPaths[0];
  const modelConfigExists = settingsExist;

  // MCP surface: from entry.mcpPaths (catalog-only entries).
  let mcpPath: string | undefined;
  let mcpConfigExists: boolean | undefined;
  let mcpServerCount: number | undefined;
  const mcpCandidates = (entry.mcpPaths?.[getCurrentPlatform()] ?? []).map(expandPath);
  if (mcpCandidates.length > 0) {
    mcpPath = mcpCandidates[0];
    for (const p of mcpCandidates) {
      try {
        if (await fileExists(p)) {
          mcpPath = p;
          mcpConfigExists = true;
          mcpServerCount = await countCatalogMcpServers(p, entry);
          break;
        }
      } catch {
        // keep looking
      }
    }
    if (mcpConfigExists === undefined) mcpConfigExists = false;
  }

  // Credential store: from entry.modelCredentialPaths.
  let modelCredentialPath: string | undefined;
  let modelCredentialExists: boolean | undefined;
  const credCandidates = (entry.modelCredentialPaths?.[getCurrentPlatform()] ?? []).map(expandPath);
  if (credCandidates.length > 0) {
    for (const p of credCandidates) {
      try {
        if (await fileExists(p)) {
          modelCredentialPath = p;
          modelCredentialExists = true;
          break;
        }
      } catch {
        // keep looking
      }
    }
    if (modelCredentialExists === undefined) {
      modelCredentialPath = credCandidates[0];
      modelCredentialExists = false;
    }
  }

  return {
    installed,
    binaryPath,
    detectedBy,
    version,
    settingsExist,
    settingsPaths,
    mcpPath,
    mcpConfigExists,
    mcpServerCount,
    modelConfigPath,
    modelConfigExists,
    modelCredentialPath,
    modelCredentialExists,
  };
}

/**
 * Synthesizes a `DetectedAgent` for a catalog-only entry so the dashboard's
 * Installed table has everything it renders (binary path, version, config
 * existence, config path). The entry has no adapter, so reading/writing its
 * config is NOT supported — all capabilities are false.
 */
export function catalogEntryToDetected(
  entry: AgentCatalogEntry,
  probe: CatalogEntryDetection
): DetectedAgent {
  const cfg = (entry.settingsPaths ?? {}) as Partial<Record<Platform, string[]>>;
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
      mcpServers: entry.mcpPaths !== undefined,
      permissions: false,
      projectConfig: false,
    },
    binaries: entry.binaries?.length ? entry.binaries : [entry.id],
    detection: {
      installed: probe.installed,
      configExists: probe.settingsExist,
      binaryPath: probe.binaryPath,
      version: probe.version,
      detectedBy: probe.detectedBy,
      method: probe.installed ? 'command' : probe.settingsExist ? 'config' : 'assumed',
      mcpPath: probe.mcpPath,
      mcpConfigExists: probe.mcpConfigExists,
      mcpServerCount: probe.mcpServerCount,
      modelConfigPath: probe.modelConfigPath,
      modelConfigExists: probe.modelConfigExists,
      modelCredentialPath: probe.modelCredentialPath,
      modelCredentialExists: probe.modelCredentialExists,
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

export function isSafeCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (trimmed.length > 500) return false;
  return !FORBIDDEN_TOKENS.some((tok) => trimmed.includes(tok));
}

/** Re-exported for the GUI: the catalog entry merged with live detection. */
export interface CatalogAgent extends AgentCatalogEntry {
  /** False when the agent was discovered on the machine but has no catalog entry yet. */
  known: boolean;
  installed: boolean;
  /** Live detection data for installed agents. */
  detected?: DetectedAgent;
}
