/**
 * CLI/environment tool detection.
 *
 * Detects the important CLIs on this machine (node, npm, pnpm, bun, git, …)
 * with version + resolved path, reusing the layered binary resolution from
 * `./binary` (process PATH → login shell PATH → well-known dirs) so
 * GUI-launched processes still see nvm/bun/homebrew installs.
 *
 * The tool list is a static, curated definition — no client input reaches
 * the shell here: name, display name and version args are all fixed data,
 * and probing goes through the same execFile-based `runCommand` path used
 * for agent detection.
 */

import { resolveBinary, type BinaryFoundBy, type ResolvedBinary } from './binary';
import { probeVersion } from './version';

export interface CliToolDef {
  /** Binary name probed on the system (e.g. "npm"). */
  name: string;
  /** Human-friendly label for the UI (e.g. "Node.js"). */
  label: string;
  /** Short description shown in the UI. */
  description: string;
  /** Tool group for UI grouping (e.g. "runtime", "package-manager", "vcs"). */
  group: string;
  /** Version probe argument forms to try, in order. Defaults to ["--version"]. */
  versionArgs?: string[];
}

/** One detected (or missing) CLI tool, as returned to the dashboard. */
export interface CliToolStatus {
  name: string;
  label: string;
  description: string;
  group: string;
  installed: boolean;
  /** Absolute path of the binary, when installed. */
  path?: string;
  /** How the binary was located (PATH / login shell / well-known dir). */
  foundBy?: BinaryFoundBy;
  /** Raw first line of the version probe, when it could be read. */
  version?: string;
}

/**
 * The curated list of important CLIs. Kept in core so the catalog stays the
 * single source of truth and the GUI stays a pure API client.
 */
export const CLI_TOOLS: CliToolDef[] = [
  {
    name: 'node',
    label: 'Node.js',
    description: 'JavaScript runtime',
    group: 'runtime',
    versionArgs: ['--version'],
  },
  {
    name: 'deno',
    label: 'Deno',
    description: 'Secure TypeScript/JavaScript runtime',
    group: 'runtime',
    versionArgs: ['--version'],
  },
  {
    name: 'bun',
    label: 'Bun',
    description: 'Fast all-in-one JS runtime & package manager',
    group: 'runtime',
    versionArgs: ['--version'],
  },
  {
    name: 'npm',
    label: 'npm',
    description: 'Node.js package manager',
    group: 'package-manager',
    versionArgs: ['--version'],
  },
  {
    name: 'pnpm',
    label: 'pnpm',
    description: 'Fast, disk-efficient package manager',
    group: 'package-manager',
    versionArgs: ['--version'],
  },
  {
    name: 'yarn',
    label: 'Yarn',
    description: 'Package manager for JavaScript',
    group: 'package-manager',
    versionArgs: ['--version'],
  },
  {
    name: 'git',
    label: 'Git',
    description: 'Distributed version control',
    group: 'vcs',
    versionArgs: ['--version'],
  },
  {
    name: 'cargo',
    label: 'Cargo',
    description: 'Rust package manager & build tool',
    group: 'language-toolchain',
    versionArgs: ['--version'],
  },
  {
    name: 'rustc',
    label: 'Rustc',
    description: 'Rust compiler',
    group: 'language-toolchain',
    versionArgs: ['--version'],
  },
  {
    name: 'python3',
    label: 'Python 3',
    description: 'Python interpreter',
    group: 'language-toolchain',
    versionArgs: ['--version'],
  },
  {
    name: 'go',
    label: 'Go',
    description: 'Go toolchain',
    group: 'language-toolchain',
    versionArgs: ['version'],
  },
  {
    name: 'uv',
    label: 'uv',
    description: 'Fast Python package manager',
    group: 'language-toolchain',
    versionArgs: ['--version'],
  },
];

/**
 * Detect all curated CLI tools in parallel. Each probe is bounded
 * (resolveBinary is cached; probeVersion has a 15s per-attempt cap and the
 * binary must exist to be probed), so a full pass stays cheap.
 */
export async function detectCliTools(tools: CliToolDef[] = CLI_TOOLS): Promise<CliToolStatus[]> {
  const results = await Promise.all(
    tools.map(async (tool): Promise<CliToolStatus> => {
      const base: CliToolStatus = {
        name: tool.name,
        label: tool.label,
        description: tool.description,
        group: tool.group,
        installed: false,
      };
      let found: ResolvedBinary | null = null;
      try {
        found = await resolveBinary(tool.name);
      } catch {
        found = null;
      }
      if (!found) return base;

      let version: string | undefined;
      try {
        version = (await probeVersion(tool.name, tool.versionArgs)) ?? undefined;
      } catch {
        version = undefined;
      }
      return {
        ...base,
        installed: true,
        path: found.path,
        foundBy: found.foundBy,
        version,
      };
    })
  );
  return results;
}

/** How a tool can be updated. */
export type ToolUpdateMethod = 'npm' | 'unsupported';

/** Result of an update check for one installed CLI tool. */
export interface ToolUpdateStatus {
  name: string;
  /** Installed version, when known. */
  currentVersion?: string;
  /** Latest published version from the npm registry, when the tool is npm-checkable. */
  latestVersion?: string;
  /** True when a newer version is available and the check succeeded. */
  updateAvailable: boolean;
  method: ToolUpdateMethod;
  /** Safe command that runs the update (present only for npm-checkable tools). */
  command?: string;
  /** Why no auto-update is available / why the check failed. */
  reason?: string;
}

export interface CheckToolUpdatesOptions {
  /** Resolve the latest published version of an npm package. Override in tests. */
  npmLatest?: (npmPackage: string) => Promise<string>;
}

/**
 * npm-published tools we can safely check + update via the registry.
 * Names must match `CliToolDef.name` exactly.
 */
const NPM_PACKAGE_MAP: Record<string, string> = {
  npm: 'npm',
  pnpm: 'pnpm',
  yarn: 'yarn',
  bun: 'bun',
};

/** Allow-listed, server-trusted update command per tool (never client input). */
const TOOL_UPDATE_COMMANDS: Record<string, string> = {
  npm: 'npm install -g npm@latest',
  pnpm: 'pnpm add -g pnpm@latest',
  yarn: 'npm install -g yarn@latest',
  bun: 'npm install -g bun@latest',
};

const defaultNpmLatest = async (npmPackage: string): Promise<string> => {
  const { execFile } = await import('node:child_process');
  return new Promise<string>((resolve, reject) => {
    execFile(
      'npm',
      ['view', npmPackage, 'version'],
      { timeout: 20000, encoding: 'utf8' },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim().split(/\r?\n/)[0].trim());
      }
    );
  });
};

/** Loose semver compare: returns true when `a` is a newer version than `b`. */
function versionGt(a: string, b: string): boolean {
  const parse = (v: string) =>
    (v || '')
      .trim()
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((x) => Number.parseInt(x, 10) || 0)
      .slice(0, 3);
  const aa = parse(a);
  const bb = parse(b);
  for (let i = 0; i < 3; i++) {
    const x = aa[i] ?? 0;
    const y = bb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Check every installed tool for a newer version.
 *
 * npm/pnpm/yarn/bun are npm-published, so their "latest" is queried from the
 * npm registry (`npm view <pkg> version`). Everything else returns
 * `method: 'unsupported'` — we do not guess an update path for system/toolchain
 * managed CLIs (git, cargo, rustc, python3, go, uv, …).
 */
export async function checkToolUpdates(
  tools: CliToolStatus[],
  opts: CheckToolUpdatesOptions = {}
): Promise<ToolUpdateStatus[]> {
  const npmLatest = opts.npmLatest ?? defaultNpmLatest;

  const installed = tools.filter((tool) => tool.installed);
  return Promise.all(
    installed.map(async (tool): Promise<ToolUpdateStatus> => {
      const npmPackage = NPM_PACKAGE_MAP[tool.name];
      const command = TOOL_UPDATE_COMMANDS[tool.name];
      const base: ToolUpdateStatus = {
        name: tool.name,
        currentVersion: tool.version,
        updateAvailable: false,
        method: 'unsupported',
      };

      if (!npmPackage || !command) {
        return {
          ...base,
          reason: 'Auto-update is not supported for this tool — it is installed or managed externally.',
        };
      }

      let latestVersion: string | undefined;
      try {
        latestVersion = (await npmLatest(npmPackage)) || undefined;
      } catch {
        latestVersion = undefined;
      }

      const currentVersion = tool.version;
      const updateAvailable = !!(currentVersion && latestVersion && versionGt(latestVersion, currentVersion));
      return {
        name: tool.name,
        currentVersion,
        latestVersion,
        updateAvailable,
        method: 'npm',
        command,
        ...(latestVersion ? {} : { reason: 'Could not determine the latest version from the npm registry.' }),
      };
    })
  );
}

/** Return the allow-listed update command for a tool, or undefined. */
export function getToolUpdateCommand(name: string): string | undefined {
  return TOOL_UPDATE_COMMANDS[name];
}
