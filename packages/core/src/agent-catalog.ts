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
  getCommandPath,
  getCommandVersion,
  getCurrentPlatform,
} from './utils';
import type { Platform } from './types';
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
  /** Shown in the UI under the command — explains alternatives or warns. */
  note?: string;
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
  action: 'install' | 'uninstall';
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
  return entries;
}

export function getAgentCatalogEntry(id: string): AgentCatalogEntry | undefined {
  return entries.find((e) => e.id === id);
}

function appliesTo(platforms: Platform[] | undefined, platform: Platform): boolean {
  return !platforms || platforms.length === 0 || platforms.includes(platform);
}

/**
 * The install/uninstall commands the dashboard is allowed to run for an agent,
 * filtered to the current platform. Returns undefined for agents that have no
 * catalogued command (manual install/uninstall only).
 */
export function getAgentCommands(
  agentId: string,
  platform: Platform,
): AgentCommands | undefined {
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
  /** Version string reported by the CLI, if it could be queried. */
  version?: string;
  /** True when at least one of the entry's settingsPaths exists on disk. */
  settingsExist: boolean;
  /** Expanded (home-resolved) candidate settings paths, for the GUI. */
  settingsPaths: string[];
}

/**
 * Lightweight detection for catalog entries that have no core adapter:
 * probes the entry's `binaries` on PATH and, if configured, its
 * `settingsPaths` on disk. Used by the dashboard so catalog-only agents
 * (reasonix, freebuff) show as Installed instead of "Available to Install".
 */
export async function detectCatalogEntry(
  entry: AgentCatalogEntry,
): Promise<CatalogEntryDetection> {
  const binaries = entry.binaries?.length ? entry.binaries : [entry.id];

  let installed = false;
  let binaryPath: string | undefined;
  for (const binary of binaries) {
    try {
      const found = await getCommandPath(binary);
      if (found) {
        installed = true;
        binaryPath = found;
        break;
      }
    } catch {
      // Probe the next binary — an uncooperative PATH lookup shouldn't fail the whole entry.
    }
  }

  let version: string | undefined;
  if (installed) {
    for (const binary of binaries) {
      try {
        const v = await getCommandVersion(binary);
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

  return { installed, binaryPath, version, settingsExist, settingsPaths };
}

/**
 * Synthesizes a `DetectedAgent` for a catalog-only entry so the dashboard's
 * Installed table has everything it renders (binary path, version, config
 * existence, config path). The entry has no adapter, so reading/writing its
 * config is NOT supported — all capabilities are false.
 */
export function catalogEntryToDetected(
  entry: AgentCatalogEntry,
  probe: CatalogEntryDetection,
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