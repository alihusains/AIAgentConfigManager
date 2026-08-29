/**
 * Robust agent binary resolution.
 *
 * `which` alone only sees the process PATH, which is minimal for
 * GUI-launched processes (launchd) and misses nvm/bun/homebrew installs.
 * Resolution is layered:
 *   1. `which`/`where` on the current PATH
 *   2. the login shell's PATH (parsed once, cached)
 *   3. well-known install directories (~/.local/bin, ~/.bun/bin, brew, …)
 */

import { getCurrentPlatform, getHomeDir, fileExists, getCommandPath, runCommand } from '../utils';

export type BinaryFoundBy = 'path' | 'shell-env' | 'known-location';

export interface ResolvedBinary {
  path: string;
  foundBy: BinaryFoundBy;
}

let loginPathCache: string[] | null = null;
let loginPathPending: Promise<string[]> | null = null;

/** Split a PATH string into its components. */
function splitPath(p: string): string[] {
  return p
    .split(getCurrentPlatform() === 'win32' ? ';' : ':')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse the user's login shell PATH (darwin/linux: `$SHELL -lic 'echo $PATH'`,
 * win32: powershell PATH). Cached for the process lifetime; failures yield [].
 */
async function getLoginShellPaths(): Promise<string[]> {
  if (loginPathCache) return loginPathCache;
  if (loginPathPending) return loginPathPending;

  const platform = getCurrentPlatform();
  let command: string;
  let args: string[];
  if (platform === 'win32') {
    command = 'powershell';
    args = ['-NoProfile', '-Command', '$env:PATH'];
  } else {
    const shell = (typeof process !== 'undefined' && process.env?.SHELL) || '/bin/zsh';
    command = shell;
    args = ['-lic', 'echo $PATH'];
  }

  loginPathPending = (async () => {
    try {
      const result = await runCommand(command, args, 3000);
      const out = (result.stdout || result.stderr).trim();
      const paths = splitPath(out);
      loginPathCache = paths.length > 0 ? paths : [];
    } catch {
      loginPathCache = [];
    }
    loginPathPending = null;
    return loginPathCache;
  })();

  return loginPathPending;
}

/** Well-known install directories, home-relative first (resolved lazily). */
function knownDirs(): string[] {
  const home = getHomeDir();
  const dirs = [
    `${home}/.local/bin`,
    `${home}/.bun/bin`,
    `${home}/.npm-global/bin`,
    `${home}/.opencode/bin`,
    `${home}/.mimocode/bin`,
    `${home}/.cargo/bin`,
    `${home}/.deno/bin`,
    `${home}/.volta/bin`,
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  if (getCurrentPlatform() === 'win32') {
    const appdata =
      (typeof process !== 'undefined' && process.env?.APPDATA) || `${home}/AppData/Roaming`;
    dirs.push(`${appdata}\\npm`, `${home}\\.local\\bin`);
  }
  return dirs;
}

/**
 * Resolve an agent CLI binary. Returns null when not found via any layer.
 */
export async function resolveBinary(name: string): Promise<ResolvedBinary | null> {
  // Layer 1: current PATH
  const existing = await getCommandPath(name);
  if (existing) return { path: existing, foundBy: 'path' };

  // Layer 2: login shell PATH
  const shellPaths = await getLoginShellPaths();
  for (const dir of shellPaths) {
    const candidate = getCurrentPlatform() === 'win32' ? `${dir}\\${name}.exe` : `${dir}/${name}`;
    try {
      if (await fileExists(candidate)) return { path: candidate, foundBy: 'shell-env' };
    } catch {
      // keep looking
    }
  }

  // Layer 3: well-known install directories
  for (const dir of knownDirs()) {
    const candidate = getCurrentPlatform() === 'win32' ? `${dir}\\${name}.exe` : `${dir}/${name}`;
    try {
      if (await fileExists(candidate)) return { path: candidate, foundBy: 'known-location' };
    } catch {
      // keep looking
    }
  }

  return null;
}

/** Reset caches (test hook). */
export function _resetBinaryCaches(): void {
  loginPathCache = null;
  loginPathPending = null;
}
