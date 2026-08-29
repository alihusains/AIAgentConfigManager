/**
 * Robust CLI version probing.
 *
 * Some CLIs only accept `-V`, print the version to stderr, or print an error
 * message instead of a version (e.g. Junie: "[Junie] Error: No version
 * found."). This module normalizes all of that into a clean version string
 * or null.
 */

import { runCommand } from '../utils';

/**
 * Probe a CLI's version string. Tries each argument set in order
 * (default: `--version` then `-V`), merges stdout+stderr, and rejects
 * output that is clearly an error message.
 */
export async function probeVersion(
  command: string,
  versionArgs: string[] = ['--version']
): Promise<string | null> {
  const attempts = versionArgs.length > 0 ? versionArgs : ['--version'];
  for (const args of attempts) {
    try {
      const result = await runCommand(command, [args], 15000);
      const raw = (`${result.stdout || ''}\n${result.stderr || ''}`).trim();
      const firstLine = raw.split(/\r?\n/)[0].trim();
      if (firstLine && !looksLikeError(firstLine)) {
        return firstLine;
      }
    } catch {
      // try the next argument form
    }
  }
  return null;
}

/** Heuristic: is this "version" output actually an error message? */
function looksLikeError(line: string): boolean {
  return /\b(error|failed|failure|not found|no version)\b/i.test(line) && !/\d/.test(line);
}
