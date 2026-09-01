/**
 * Robust CLI version probing with optimized timeout handling.
 *
 * Some CLIs only accept `-V`, print the version to stderr, or print an error
 * message instead of a version (e.g. Junie: "[Junie] Error: No version
 * found."). This module normalizes all of that into a clean version string
 * or null.
 *
 * Optimization: Version probing is the primary bottleneck in agent detection
 * (some CLIs are very slow to respond to --version). We use adaptive timeouts:
 * - First attempt: 3s aggressive timeout (catches fast CLIs early)
 * - Retry: 8s for CLIs that are known slow
 * - Overall: bail out after trying all version args
 */

import { runCommand } from '../utils';

/**
 * Map of known slow CLIs to their recommended timeout (ms).
 * Helps avoid unnecessary waiting for CLIs that are known to be slow.
 */
const SLOW_CLI_TIMEOUTS: Record<string, number> = {
  gemini: 2000, // Google Gemini CLI can be slow to initialize
  mimo: 2000, // Mimocode is slow
  freebuff: 1500, // Freebuff is slower
  kilo: 1500, // Kilo is slower
};

/**
 * Probe a CLI's version string. Tries each argument set in order
 * (default: `--version` then `-V`), merges stdout+stderr, and rejects
 * output that is clearly an error message.
 *
 * Uses adaptive timeouts: first attempt is aggressive (3s), followed by a
 * longer timeout (8s) if the first fails, or a known-slow timeout if available.
 */
export async function probeVersion(
  command: string,
  versionArgs: string[] = ['--version']
): Promise<string | null> {
  const attempts = versionArgs.length > 0 ? versionArgs : ['--version'];

  // Extract the bare command name (e.g., "gemini" from "/path/to/gemini")
  const cmdName = command.split('/').pop()?.split('\\').pop() || command;
  const knownTimeout = SLOW_CLI_TIMEOUTS[cmdName];

  for (let i = 0; i < attempts.length; i++) {
    const args = attempts[i];
    // Progressive timeout strategy: first attempt is aggressive, then relaxed
    const timeout = knownTimeout || (i === 0 ? 3000 : 8000);

    try {
      const result = await runCommand(command, [args], timeout);
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
