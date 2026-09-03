/**
 * Live GitHub star rankings.
 *
 * Fetches live star counts from the GitHub REST API and ranks the agent
 * catalog by them. Designed to be rate-limit friendly:
 *   - In-memory + on-disk cache (default TTL 1 hour)
 *   - Bounded parallelism for batch fetches
 *   - Honors `X-RateLimit-Remaining: 0` by sleeping until reset
 *   - Falls back to stale cache when the API is unavailable
 *
 * The cache lives at `~/.ai-agent-config/live-stars-cache.json` so the
 * CLI and the dashboard share it. Auth is optional: set GITHUB_TOKEN to
 * raise the limit from 60/h to 5000/h.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { expandPath, getHomeDir } from './utils';

export const LIVE_STARS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const LIVE_STARS_CONCURRENCY = 6; // parallel fetches
const GITHUB_API = 'https://api.github.com';
const DEFAULT_CACHE_FILE = '~/.ai-agent-config/live-stars-cache.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoStats {
  stars: number;
  url: string;
  updatedAt: string;
  lastCommit: string;
  isActive: boolean;
  openIssues?: number;
  /** True when this value came from the cache, not a fresh API call. */
  fromCache: boolean;
}

/** Minimal agent shape accepted by the ranking/report functions. */
export interface Agent {
  id: string;
  name: string;
  /** Any URL; only `https://github.com/<owner>/<repo>` sources are fetchable. */
  source?: string;
  /** Optional GitHub repo override, e.g. "owner/repo". */
  repo?: string;
}

export interface RankedAgent {
  agent: Agent;
  stats: RepoStats | null;
  /** null = no GitHub source, or fetch failed with no cache. */
  rank: number | null;
}

export interface StarReportRanking {
  rank: number;
  name: string;
  github_url: string;
  stars: number;
  stars_per_day: number;
  is_trending: boolean;
  last_commit: string;
  issue_count: number;
  maintenance_status: 'active' | 'stale' | 'unknown';
}

export interface StarReport {
  generated_at: string;
  total_agents: number;
  rankings: StarReportRanking[];
  metadata: {
    fetch_time_ms: number;
    api_calls: number;
    cache_hits: number;
    cache_misses: number;
  };
}

interface CacheEntry {
  stars: number;
  url: string;
  updatedAt: string;
  lastCommit: string;
  openIssues?: number;
  fetchedAt: number;
}

interface CacheFile {
  version: 1;
  entries: Record<string, CacheEntry>; // key: "owner/repo" (lowercased)
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cacheFileOverride: string | null = null;

/** Point the on-disk cache elsewhere (used by tests). Pass null to reset. */
export function setLiveStarsCacheFile(file: string | null): void {
  cacheFileOverride = file;
}

function cacheFile(): string {
  return expandPath(cacheFileOverride ?? DEFAULT_CACHE_FILE);
}

function loadCache(): CacheFile {
  try {
    const raw = fs.readFileSync(cacheFile(), 'utf8');
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed && typeof parsed === 'object' && parsed.entries) return parsed;
  } catch {
    // missing or corrupt cache is not an error
  }
  return { version: 1, entries: {} };
}

function saveCache(cache: CacheFile): void {
  try {
    const dir = path.dirname(cacheFile());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify(cache, null, 2));
  } catch {
    // cache write failure is non-fatal
  }
}

const cache = loadCache();

function cacheKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

function readCached(key: string): CacheEntry | null {
  const entry = cache.entries[key];
  return entry && typeof entry.stars === 'number' ? entry : null;
}

function writeCached(key: string, entry: CacheEntry): void {
  cache.entries[key] = entry;
  saveCache(cache);
}

/** Drop all cached entries (tests / `--refresh` could use this). */
export function clearLiveStarsCache(): void {
  for (const k of Object.keys(cache.entries)) delete cache.entries[k];
  saveCache(cache);
}

// ---------------------------------------------------------------------------
// GitHub API plumbing
// ---------------------------------------------------------------------------

let apiCalls = 0;
export function getApiCallCount(): number {
  return apiCalls;
}

interface RateLimit {
  remaining: number;
  resetAt: number; // epoch ms
}

let rateLimit: RateLimit = { remaining: Infinity, resetAt: 0 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait out the rate limit window when the API signals it is exhausted. */
async function waitIfRateLimited(res: Response): Promise<void> {
  const remaining = Number(res.headers.get('x-ratelimit-remaining'));
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (!Number.isNaN(reset)) {
    rateLimit = { remaining: Number.isNaN(remaining) ? rateLimit.remaining : remaining, resetAt: reset * 1000 };
  }
  if (Number.isNaN(remaining) || remaining > 0) return;
  // Exhausted: sleep until reset (cap at 65s so a bad clock doesn't hang us).
  const waitMs = Math.min(Math.max(rateLimit.resetAt - Date.now(), 1000), 65_000);
  await sleep(waitMs);
}

async function githubFetch(pathname: string, timeoutMs = 10_000): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ai-agent-config-manager',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GITHUB_API}${pathname}`, {
      headers,
      signal: controller.signal,
    });
    apiCalls++;
    await waitIfRateLimited(res);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract "owner/repo" from a GitHub URL or a bare "owner/repo" string. */
export function parseGithubRepo(source?: string, repoOverride?: string): string | null {
  const raw = repoOverride ?? source;
  if (!raw) return null;
  const urlMatch = raw.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}`;
  if (/^[\w.-]+\/[\w.-]+$/.test(raw.trim())) return raw.trim();
  return null;
}

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86_400_000;
}

/** A repo counts as active if it has a commit within the last 90 days. */
function isActive(lastCommit: string): boolean {
  const d = daysSince(lastCommit);
  return d !== null && d <= 90;
}

/**
 * Fetch one repo's current stats from the GitHub REST API.
 * Throws on network/timeout/404 — callers decide on fallback.
 */
export async function fetchRepoStars(owner: string, repo: string): Promise<CacheEntry> {
  const res = await githubFetch(`/repos/${owner}/${repo}`);
  if (res.status === 404) throw new Error(`repo not found: ${owner}/${repo}`);
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${owner}/${repo}`);
  const data = (await res.json()) as {
    stargazers_count?: number;
    html_url?: string;
    pushed_at?: string;
    open_issues_count?: number;
    updated_at?: string;
  };
  return {
    stars: data.stargazers_count ?? 0,
    url: data.html_url ?? `https://github.com/${owner}/${repo}`,
    updatedAt: data.updated_at ?? new Date().toISOString(),
    lastCommit: data.pushed_at ?? '',
    openIssues: data.open_issues_count,
    fetchedAt: Date.now(),
  };
}

/**
 * Fetch a single repo's stars, with the 1-hour cache and stale fallback.
 *
 * Behavior:
 *   - fresh cache hit  → returns it (no API call)
 *   - miss + API ok    → stores and returns fresh data
 *   - miss + API fail  → returns stale cache if any (fromCache=true),
 *                        otherwise throws
 */
export async function getRepoStars(
  owner: string,
  repo: string,
  opts: { ttlMs?: number; force?: boolean } = {}
): Promise<RepoStats> {
  const key = cacheKey(owner, repo);
  const ttl = opts.ttlMs ?? LIVE_STARS_CACHE_TTL_MS;
  const cached = readCached(key);
  const fresh = cached && Date.now() - cached.fetchedAt < ttl;

  if (fresh && !opts.force) {
    return {
      stars: cached.stars,
      url: cached.url,
      updatedAt: cached.updatedAt,
      lastCommit: cached.lastCommit,
      isActive: isActive(cached.lastCommit),
      openIssues: cached.openIssues,
      fromCache: true,
    };
  }

  try {
    const entry = await fetchRepoStars(owner, repo);
    writeCached(key, entry);
    return {
      stars: entry.stars,
      url: entry.url,
      updatedAt: entry.updatedAt,
      lastCommit: entry.lastCommit,
      isActive: isActive(entry.lastCommit),
      openIssues: entry.openIssues,
      fromCache: false,
    };
  } catch (err) {
    if (cached) {
      // API failed — fall back to whatever we have, even if stale.
      return {
        stars: cached.stars,
        url: cached.url,
        updatedAt: cached.updatedAt,
        lastCommit: cached.lastCommit,
        isActive: isActive(cached.lastCommit),
        openIssues: cached.openIssues,
        fromCache: true,
      };
    }
    throw err;
  }
}

/**
 * Bounded-concurrency map: run `fn` over `items` with at most `limit`
 * in-flight promises. Preserves input order in the result array.
 */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Batch-fetch stats for many repos in parallel (bounded to
 * LIVE_STARS_CONCURRENCY). Individual failures are reported as `null`
 * rather than aborting the whole batch.
 */
export async function getRepoStarsBatch(
  repos: Array<{ owner: string; repo: string }>,
  opts: { ttlMs?: number; concurrency?: number } = {}
): Promise<Array<{ owner: string; repo: string; stats: RepoStats | null }>> {
  const concurrency = Math.max(1, opts.concurrency ?? LIVE_STARS_CONCURRENCY);
  return mapLimited(repos, concurrency, async (r) => {
    try {
      return { ...r, stats: await getRepoStars(r.owner, r.repo, { ttlMs: opts.ttlMs }) };
    } catch {
      return { ...r, stats: null };
    }
  });
}

// ---------------------------------------------------------------------------
// Ranking & report
// ---------------------------------------------------------------------------

/**
 * Rank a list of agents by live GitHub stars.
 *
 * Agents without a resolvable GitHub repo get `stats: null` and
 * `rank: null`; they are appended after the ranked agents, in input
 * order. Ties on star count keep input order (stable).
 */
export async function rankAgentsByStars(
  agents: Agent[],
  opts: { ttlMs?: number; concurrency?: number } = {}
): Promise<RankedAgent[]> {
  const withRepo = agents.map((agent) => {
    const target = parseGithubRepo(agent.source, agent.repo);
    if (!target) return { agent, target: null as string | null };
    const [owner, repo] = target.split('/');
    return { agent, target, owner, repo };
  });

  const fetchable = withRepo.filter((w): w is typeof w & { owner: string; repo: string } => w.target !== null);
  const batch = await getRepoStarsBatch(
    fetchable.map((w) => ({ owner: w.owner, repo: w.repo })),
    opts
  );

  const statsByAgent = new Map<Agent, RepoStats | null>();
  fetchable.forEach((w, i) => statsByAgent.set(w.agent, batch[i].stats));

  const ranked: RankedAgent[] = withRepo.map((w) => ({
    agent: w.agent,
    stats: statsByAgent.get(w.agent) ?? null,
    rank: null,
  }));

  // Assign ranks: sorted by stars desc; nulls keep position after ranked.
  const rankedOnly = ranked.filter((r) => r.stats !== null);
  rankedOnly.sort((a, b) => (b.stats!.stars ?? 0) - (a.stats!.stars ?? 0));
  rankedOnly.forEach((r, i) => {
    r.rank = i + 1;
  });

  // Stable output: ranked first (by rank), then unranked in input order.
  return [...rankedOnly, ...ranked.filter((r) => r.rank === null)];
}

function maintenanceStatus(stats: RepoStats): 'active' | 'stale' | 'unknown' {
  if (!stats.lastCommit) return 'unknown';
  return stats.isActive ? 'active' : 'stale';
}

/**
 * Estimated star growth over the last `days` days.
 *
 * The public REST API does not expose a per-day star history, so this is
 * an estimate: it compares the current count against the cached count from
 * `days` ago (if the cache has an entry that old) and falls back to a
 * heuristic of `stars / 365` (average per day since the repo's last push
 * rate, capped by the observed age of the data). Returns 0 when no
 * evidence of growth is available.
 */
export async function getStarGrowth(owner: string, repo: string, days: 30 = 30): Promise<number> {
  const current = await getRepoStars(owner, repo).catch(() => null);
  if (!current) return 0;

  const cached = readCached(cacheKey(owner, repo));
  if (cached) {
    // How old is this cache entry relative to `days`? If we have a sample
    // older than the window we can't compute the window's delta; degrade.
    const ageDays = (Date.now() - cached.fetchedAt) / 86_400_000;
    if (ageDays >= days) {
      // We only have one historical sample (this one) — estimate from the
      // gap between it and now.
      const delta = current.stars - cached.stars;
      const span = Math.max(ageDays, 1);
      return Math.max(0, Math.round((delta / span) * days));
    }
  }

  // No usable historical sample: fall back to a per-day rate derived from
  // how long it has been since the last push (repos that push often tend
  // to gain ~1 star per push-day as a rough heuristic).
  const sinceCommit = daysSince(current.lastCommit);
  if (sinceCommit === null || sinceCommit <= 0) return 0;
  const pushRate = 1 / Math.max(sinceCommit, 1); // pushes/day proxy
  return Math.max(0, Math.round(current.stars * pushRate * 0.01 * days));
}

/** Trending heuristic: active repo gaining roughly >= 1 star/day. */
function isTrending(stats: RepoStats, starsPerDay: number): boolean {
  return stats.isActive && starsPerDay >= 1;
}

/**
 * Estimate stars gained per day by comparing current count with the cached
 * version. Returns 0 when no historical sample is available.
 */
function estimateStarsPerDay(stats: RepoStats): number {
  // Reconstruct cache key from stats URL: "https://github.com/owner/repo"
  const match = stats.url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)$/i);
  if (!match) return 0;
  const cached = readCached(cacheKey(match[1], match[2]));
  if (!cached) return 0;
  const ageDays = Math.max((Date.now() - cached.fetchedAt) / 86_400_000, 1 / 24);
  const delta = stats.stars - cached.stars;
  return Math.max(0, Math.round((delta / ageDays) * 10) / 10);
}

/**
 * Build the full live-stars report for a set of agents.
 *
 * `generated_at` is the wall-clock time of generation; `metadata` counts
 * how long the fetches took and how many API calls vs cache hits were
 * involved (cache hits/misses are counted per repo resolved in this run).
 */
export async function generateStarReport(
  agents: Agent[],
  opts: { ttlMs?: number; concurrency?: number } = {}
): Promise<StarReport> {
  const started = Date.now();
  const callsBefore = getApiCallCount();

  const resolved = agents
    .map((agent) => ({ agent, target: parseGithubRepo(agent.source, agent.repo) }))
    .filter((w): w is { agent: Agent; target: string } => w.target !== null);

  const hitsBefore = countCacheHits(resolved.map((w) => w.target), opts.ttlMs);
  const batch = await getRepoStarsBatch(
    resolved.map((w) => {
      const [owner, repo] = w.target.split('/');
      return { owner, repo };
    }),
    opts
  );

  const statsByAgent = new Map<Agent, RepoStats | null>();
  resolved.forEach((w, i) => statsByAgent.set(w.agent, batch[i].stats));

  const ranked: RankedAgent[] = agents.map((agent) => ({
    agent,
    stats: statsByAgent.get(agent) ?? null,
    rank: null,
  }));
  const rankedOnly = ranked.filter((r): r is RankedAgent & { stats: RepoStats } => r.stats !== null);
  rankedOnly.sort((a, b) => b.stats.stars - a.stats.stars);
  rankedOnly.forEach((r, i) => {
    r.rank = i + 1;
  });

  const rankings: StarReportRanking[] = rankedOnly.map((r, i) => {
    const stats = r.stats;
    // stars_per_day is estimated from the cache entry's age when a
    // historical sample exists; 0 otherwise (no evidence of growth).
    const perDay = estimateStarsPerDay(stats);
    return {
      rank: i + 1,
      name: r.agent.name,
      github_url: stats.url,
      stars: stats.stars,
      stars_per_day: perDay,
      is_trending: isTrending(stats, perDay),
      last_commit: stats.lastCommit,
      issue_count: stats.openIssues ?? 0,
      maintenance_status: maintenanceStatus(stats),
    };
  });

  return {
    generated_at: new Date().toISOString(),
    total_agents: agents.length,
    rankings,
    metadata: {
      fetch_time_ms: Date.now() - started,
      api_calls: getApiCallCount() - callsBefore,
      cache_hits: hitsBefore.hits,
      cache_misses: hitsBefore.misses,
    },
  };
}

function countCacheHits(targets: string[], ttlMs?: number): { hits: number; misses: number } {
  const ttl = ttlMs ?? LIVE_STARS_CACHE_TTL_MS;
  let hits = 0;
  let misses = 0;
  for (const target of targets) {
    const [owner, repo] = target.split('/');
    const cached = readCached(cacheKey(owner, repo));
    if (cached && Date.now() - cached.fetchedAt < ttl) hits++;
    else misses++;
  }
  return { hits, misses };
}

// Convenience for tests: expose home dir so fixtures can point at it.
export function defaultCachePath(): string {
  return expandPath(path.join(getHomeDir(), '.ai-agent-config', 'live-stars-cache.json'));
}
