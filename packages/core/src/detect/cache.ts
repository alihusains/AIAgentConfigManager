/**
 * Detection result caching to avoid re-running expensive probes on every startup.
 *
 * Agent detection involves:
 * 1. Spawning `which` to check if a binary exists
 * 2. Running `--version` to extract the version string
 * 3. Stat'ing config files
 *
 * These operations are deterministic in the short term (minutes to hours) and
 * expensive to repeat 24 times per session. The cache lives in memory for the
 * process lifetime and is optional (fails gracefully when the cache is stale
 * or missing).
 *
 * Cache is NEVER persisted to disk (detection is fast enough with concurrency
 * that we get good parallelization anyway). It's purely for per-process speedup.
 */

import type { AgentDetection } from '../types';
import * as fs from 'node:fs/promises';

/**
 * In-memory detection cache with per-entry TTL.
 * Entries expire after 5 minutes (300,000 ms) of inactivity.
 */
class DetectionCache {
  private cache: Map<string, { result: AgentDetection; expiresAt: number }> = new Map();
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes

  get(agentId: string): AgentDetection | null {
    const entry = this.cache.get(agentId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(agentId);
      return null;
    }
    return entry.result;
  }

  set(agentId: string, result: AgentDetection): void {
    this.cache.set(agentId, {
      result: structuredClone(result),
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  has(agentId: string): boolean {
    return this.get(agentId) !== null;
  }
}

export const detectionCache = new DetectionCache();

/**
 * Check if a file's modification time is recent (within 5 seconds).
 * Used to detect when config files have changed and cache should be invalidated.
 */
export async function isFileRecent(filePath: string, withinMs = 5000): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs < withinMs;
  } catch {
    return false;
  }
}

/**
 * Build a cache invalidation key from a list of watched files.
 * Returns a string representation of the file modification times.
 * Used to detect when cache should be cleared based on external file changes.
 */
export async function getFileWatchKey(
  filePaths: (string | null | undefined)[]
): Promise<string> {
  const validPaths = filePaths.filter((p): p is string => typeof p === 'string');
  if (validPaths.length === 0) return '';

  const mtimes: string[] = [];
  for (const path of validPaths) {
    try {
      const stat = await fs.stat(path);
      mtimes.push(`${path}:${stat.mtimeMs}`);
    } catch {
      mtimes.push(`${path}:missing`);
    }
  }
  return mtimes.join('|');
}
