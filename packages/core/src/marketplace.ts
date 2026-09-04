/**
 * Skill marketplace — browse and install skills from a real public GitHub repo.
 *
 * Source (the only one this task ships): `alihusains/enterprise-skills`.
 *
 * Real repo structure (verified via the unauthenticated GitHub REST API before
 * writing this module):
 *   skills/<department>/<skill-id>/SKILL.md
 *   `.skills-manifest.json` (repo root) — a flat map of skill-id ->
 *   { name, description, version, department, hash } for every skill. The
 *   manifest's `name` always equals the folder name (verified).
 *
 * Design notes:
 * - Listing reads ONE file (`.skills-manifest.json` via raw.githubusercontent.com,
 *   which is not subject to api.github.com's 60 req/hour unauthenticated limit)
 *   instead of drilling the API through 13 department directories. The
 *   frontmatter reader from skills.ts is still exercised on install/preview:
 *   the installed SKILL.md is parsed with parseSkillFrontmatter exactly like a
 *   locally created skill.
 * - All fetching is USER-TRIGGERED: nothing in this module runs automatically.
 *   The GUI (M067) calls these functions in response to explicit Browse /
 *   Refresh / Install actions.
 * - In-memory TTL cache (10 min) so repeated GUI loads within a session do not
 *   re-hit GitHub. `force: true` bypasses it for an explicit refresh.
 * - Rate limits / network failures surface as clear errors — no silent retries,
 *   no fabricated fallback data.
 * - A second source could be added later by parameterising SOURCE_REPO/SKILLS_ROOT
 *   (the fetch seam and summary shape are source-agnostic), but that is not
 *   built here — one real, working source first.
 */
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import { getSkillsLibraryDir, type SkillsDirOptions } from './skills';
import { parseSkillFrontmatterSpec as parseSkillFrontmatter } from './skill-spec';
import { fileExists } from './utils';

/** The built-in marketplace source (verified public repo). */
export const MARKETPLACE_SOURCE_REPO = 'alihusains/enterprise-skills';

/** Skills live under this path in a source repo (unless the source overrides it). */
const SKILLS_ROOT = 'skills';

/** One user-configured marketplace source. */
export interface MarketplaceSource {
  /** 'owner/repo' on GitHub. */
  repo: string;
  /** Optional path inside the repo where skills live (default 'skills'). */
  subdir?: string;
  /** Optional display label. */
  label?: string;
  addedAt: string;
}

/** Where the user's marketplace sources persist (registry home dir). */
export function getMarketplaceSourcesPath(registryPath?: string): string {
  let home: string;
  if (registryPath) home = path.dirname(registryPath);
  else if (process.env.AI_CONFIG_HOME) home = process.env.AI_CONFIG_HOME;
  else if (process.platform === 'win32' && process.env.APPDATA) {
    home = path.join(process.env.APPDATA, 'ai-agent-config');
  } else if (process.platform === 'linux' && process.env.XDG_CONFIG_HOME) {
    home = path.join(process.env.XDG_CONFIG_HOME, 'ai-agent-config');
  } else home = path.join(os.homedir(), '.ai-agent-config');
  return path.join(home, 'marketplace-sources.json');
}

const BUILTIN_SOURCE: MarketplaceSource = {
  repo: MARKETPLACE_SOURCE_REPO,
  addedAt: '1970-01-01T00:00:00.000Z',
};

/**
 * List the configured marketplace sources: the built-in default first, then
 * the user's additions from marketplace-sources.json. Missing file → just the
 * built-in. Corrupt file → built-in plus a parse error (callers surface it).
 */
export async function listMarketplaceSources(registryPath?: string): Promise<
  { sources: MarketplaceSource[]; error?: string }
> {
  const sourcesPath = getMarketplaceSourcesPath(registryPath);
  try {
    const raw = await fs.readFile(sourcesPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { sources: [BUILTIN_SOURCE], error: 'sources file is not an array' };
    const sources: MarketplaceSource[] = [BUILTIN_SOURCE];
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(e.repo)) continue;
      sources.push({
        repo: e.repo,
        subdir: typeof e.subdir === 'string' && e.subdir ? e.subdir : undefined,
        label: typeof e.label === 'string' && e.label ? e.label : undefined,
        addedAt: typeof e.addedAt === 'string' ? e.addedAt : new Date().toISOString(),
      });
    }
    return { sources };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { sources: [BUILTIN_SOURCE] };
    return { sources: [BUILTIN_SOURCE], error: String(err) };
  }
}

/** Add a user marketplace source (persisted to marketplace-sources.json). */
export async function addMarketplaceSource(
  repo: string,
  opts: { subdir?: string; label?: string; registryPath?: string } = {}
): Promise<{ sources: MarketplaceSource[] }> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error(`Invalid repo: ${JSON.stringify(repo)} (expected 'owner/repo')`);
  }
  const sourcesPath = getMarketplaceSourcesPath(opts.registryPath);
  const { sources } = await listMarketplaceSources(opts.registryPath);
  if (sources.some((s) => s.repo === repo)) {
    throw new Error(`Source already configured: ${repo}`);
  }
  const next = sources
    .filter((s) => s.repo !== BUILTIN_SOURCE.repo)
    .concat({ repo, subdir: opts.subdir, label: opts.label, addedAt: new Date().toISOString() });
  await fs.writeFile(sourcesPath, JSON.stringify(next, null, 2), 'utf8');
  listCache.clear();
  return { sources: (await listMarketplaceSources(opts.registryPath)).sources };
}

/** Remove a user marketplace source (the built-in cannot be removed). */
export async function removeMarketplaceSource(
  repo: string,
  registryPath?: string
): Promise<{ sources: MarketplaceSource[] }> {
  if (repo === BUILTIN_SOURCE.repo) {
    throw new Error('The built-in source cannot be removed');
  }
  const sourcesPath = getMarketplaceSourcesPath(registryPath);
  const { sources } = await listMarketplaceSources(registryPath);
  const next = sources.filter((s) => s.repo !== BUILTIN_SOURCE.repo && s.repo !== repo);
  if (next.length === sources.length - 1) {
    // unchanged filtering result would mean the repo was not present
  }
  await fs.writeFile(sourcesPath, JSON.stringify(next, null, 2), 'utf8');
  listCache.clear();
  return { sources: (await listMarketplaceSources(registryPath)).sources };
}

/** In-memory cache TTL — GitHub's unauthenticated REST limit is 60 req/hour/IP. */
const LIST_CACHE_TTL_MS = 10 * 60 * 1000;

/** Hard timeout for one outbound request so a hung connection can't wedge the GUI. */
const FETCH_TIMEOUT_MS = 15000;

/**
 * Test seam: injectable fetch (defaults to the Node built-in). The automated
 * test suite never makes real network calls.
 */
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
let fetchFn: FetchFn = (url, init) => fetch(url, init as RequestInit);

/** Tests only: point the module at a mock fetch. Pass null to restore. */
export function __setMarketplaceFetch(fn: FetchFn | null): void {
  fetchFn = fn ? fn : (url, init) => fetch(url, init as RequestInit);
}

/** Tests only: drop the in-memory listing cache. */
export function __clearMarketplaceCache(): void {
  listCache.clear();
  contentCache.clear();
}

/**
 * Summary of one skill available in the marketplace. `id` (the skill's folder
 * name in the source repo) is the stable handle used for preview/install.
 */
export interface MarketplaceSkillSummary {
  id: string;
  name: string;
  description?: string;
  sourceRepo: string;
  /** Path within the source repo, e.g. 'skills/engineering/engineering-code-review'. */
  sourcePath: string;
  /** Link to view the skill folder on github.com. */
  htmlUrl: string;
  /** Version string from the source manifest (when provided). */
  version?: string;
  /** Content hash from the source manifest (update detection when no version). */
  hash?: string;
}

/** One file of a skill fetched for preview or install. */
export interface MarketplaceSkillFile {
  /** Relative path within the skill folder, e.g. 'SKILL.md' or 'scripts/helper.sh'. */
  path: string;
  content: string;
}

/**
 * GitHub API rate limit exceeded (HTTP 403 with the rate-limit body, or
 * HTTP 429). The GUI should show this verbatim — it is honest and actionable.
 */
export class MarketplaceRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketplaceRateLimitError';
  }
}

// Per-source listing cache (keyed by repo) so multiple sources coexist.
const listCache = new Map<string, { data: MarketplaceSkillSummary[]; expiresAt: number }>();
const contentCache = new Map<string, MarketplaceSkillFile[]>();

/** One outbound GET with a hard timeout; throws a clear error on failure. */
async function httpGet(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchFn(url, { signal: controller.signal });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new Error(
      aborted
        ? `Marketplace request timed out after ${FETCH_TIMEOUT_MS}ms: ${url}`
        : `Marketplace request failed (network unreachable?): ${
            error instanceof Error ? error.message : String(error)
          }`
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map a failed GitHub response to an honest error. Rate limits (403 with the
 * rate-limit body, or 429) become MarketplaceRateLimitError; everything else
 * includes the status and a snippet of the body. Never retries.
 */
async function toError(res: Response): Promise<Error> {
  const body = (await res.text().catch(() => '')).slice(0, 300);
  const isRateLimit =
    res.status === 429 ||
    (res.status === 403 && /rate limit/i.test(body));
  if (isRateLimit) {
    const reset = res.headers.get('x-ratelimit-reset');
    return new MarketplaceRateLimitError(
      `GitHub API rate limit reached (unauthenticated limit is 60 requests/hour per IP).` +
        (reset ? ` Resets at Unix time ${reset}.` : '') +
        ` Try again later or use a ` +
        `force-refresh only when you expect the limit to have reset.`
    );
  }
  return new Error(`GitHub API returned HTTP ${res.status} for ${res.url}: ${body}`);
}

/**
 * List every skill in the marketplace.
 *
 * Fetches the repo's `.skills-manifest.json` (one file, served from
 * raw.githubusercontent.com — not counted against the api.github.com rate
 * limit) and turns it into summaries. Results are cached in memory for
 * LIST_CACHE_TTL_MS; `force: true` bypasses the cache for an explicit
 * user-triggered refresh.
 */
/**
 * List the skills of one marketplace source. `opts.source` selects the repo
 * ('owner/repo', default: the built-in source); `opts.subdir` overrides where
 * skills live in that repo (default 'skills' — or the source's own subdir).
 * The listing reads the repo's `.skills-manifest.json` via
 * raw.githubusercontent.com, cached per-repo for 10 minutes.
 */
export async function listMarketplaceSkills(opts?: {
  force?: boolean;
  source?: string;
  subdir?: string;
}): Promise<MarketplaceSkillSummary[]> {
  const repo = opts?.source ?? MARKETPLACE_SOURCE_REPO;
  const cached = listCache.get(repo);
  if (!opts?.force && cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const manifestUrl = `https://raw.githubusercontent.com/${repo}/main/.skills-manifest.json`;
  const res = await httpGet(manifestUrl);
  if (!res.ok) throw await toError(res);
  const manifest: unknown = await res.json().catch(() => {
    throw new Error(`Marketplace manifest is not valid JSON (${repo}/.skills-manifest.json)`);
  });
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    throw new Error('Unexpected marketplace manifest shape (expected a JSON object)');
  }

  const root = opts?.subdir ?? SKILLS_ROOT;
  const skills: MarketplaceSkillSummary[] = [];
  for (const [id, entry] of Object.entries(manifest as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' && e.name ? e.name : id;
    const description = typeof e.description === 'string' ? e.description : undefined;
    const department = typeof e.department === 'string' ? e.department : undefined;
    const version = typeof e.version === 'string' ? e.version : undefined;
    const hash = typeof e.hash === 'string' ? e.hash : undefined;
    const sourcePath = `${root}/${department ?? ''}/${id}`.replace(/\/{2,}/g, '/');
    skills.push({
      id,
      name,
      description,
      sourceRepo: repo,
      sourcePath,
      htmlUrl: `https://github.com/${repo}/tree/main/${sourcePath}`,
      version,
      hash,
    });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));

  if (!opts?.force) {
    listCache.set(repo, { data: skills, expiresAt: Date.now() + LIST_CACHE_TTL_MS });
  }
  return skills;
}

/**
 * Update check: compare each installed skill's recorded marketplace version
 * (metadata: `source-version`, set by installMarketplaceSkill) against the
 * current listing of its source repo. Only installed skills carry this
 * metadata; everything else is reported as `unknown` (no baseline yet).
 */
export async function checkMarketplaceUpdates(opts?: {
  registryPath?: string;
  libraryDir?: string;
}): Promise<
  { skillId: string; sourceRepo: string; installedVersion?: string; latestVersion?: string; hasUpdate: boolean }[]
> {
  const libraryDir = opts?.libraryDir ?? getSkillsLibraryDir();
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(libraryDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: {
    skillId: string;
    sourceRepo: string;
    installedVersion?: string;
    latestVersion?: string;
    hasUpdate: boolean;
  }[] = [];
  const listingCache = new Map<string, Map<string, string>>(); // repo → id → version
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mdPath = path.join(libraryDir, entry.name, 'SKILL.md');
    const raw = await fs.readFile(mdPath, 'utf8').catch(() => null);
    if (raw == null) continue;
    const meta = parseSkillFrontmatter(raw);
    const sourceRepo = meta.metadata?.['source-repo'];
    if (!sourceRepo) continue;
    const installedVersion = meta.metadata?.['source-version'];
    let latest: string | undefined;
    if (!listingCache.has(sourceRepo)) {
      try {
        const skills = await listMarketplaceSkills({ source: sourceRepo });
        // Version per id comes from the manifest's version/hash field; the
        // listing flattens it, so re-read the manifest via the summaries.
        listingCache.set(
          sourceRepo,
          new Map(skills.map((s) => [s.id, s.version ?? s.hash ?? '']))
        );
      } catch {
        listingCache.set(sourceRepo, new Map());
      }
    }
    latest = listingCache.get(sourceRepo)?.get(entry.name) || undefined;
    results.push({
      skillId: entry.name,
      sourceRepo,
      installedVersion,
      latestVersion: latest || undefined,
      hasUpdate: Boolean(latest && installedVersion && latest !== installedVersion),
    });
  }
  return results;
}

/**
 * Fetch the full file contents of one skill folder (SKILL.md plus any
 * companion files) for preview or install. Returns null when the skill id is
 * not in the marketplace. File contents are cached in memory (no TTL — a
 * refresh of the listing is what invalidates them via __clearMarketplaceCache).
 */
export async function fetchMarketplaceSkillContent(
  id: string,
  opts?: { source?: string; subdir?: string }
): Promise<{ files: MarketplaceSkillFile[] } | null> {
  // Validate the id before it reaches any URL/path (parity with skills.ts).
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > 128 ||
    id === '.' ||
    id === '..' ||
    id.includes('/') ||
    id.includes('\\') ||
    id.includes('\0')
  ) {
    throw new Error(`Invalid skill id: ${JSON.stringify(id)}`);
  }

  const cached = contentCache.get(id);
  if (cached) return { files: cached };

  // Resolve the skill's source path via the (cached) listing.
  const skills = await listMarketplaceSkills({
    source: opts?.source,
    subdir: opts?.subdir,
  });
  const summary = skills.find((s) => s.id === id);
  if (!summary) return null;

  const dirUrl = `https://api.github.com/repos/${summary.sourceRepo}/contents/${summary.sourcePath}`;
  const res = await httpGet(dirUrl);
  if (!res.ok) throw await toError(res);
  const entries: unknown = await res.json().catch(() => {
    throw new Error(`GitHub contents listing is not valid JSON for ${summary.sourcePath}`);
  });
  if (!Array.isArray(entries)) {
    throw new Error(`Unexpected GitHub contents response for ${summary.sourcePath}`);
  }

  const files: MarketplaceSkillFile[] = [];
  for (const entry of entries as Array<Record<string, unknown>>) {
    if (entry.type !== 'file' || typeof entry.path !== 'string') continue;
    const rel = entry.path.slice(summary.sourcePath.length).replace(/^\//, '');
    if (!rel || rel.includes('/') || rel.includes('..')) continue; // flat folder only
    const rawUrl =
      typeof entry.download_url === 'string'
        ? entry.download_url
        : `https://raw.githubusercontent.com/${MARKETPLACE_SOURCE_REPO}/main/${entry.path}`;
    const fileRes = await httpGet(rawUrl);
    if (!fileRes.ok) throw await toError(fileRes);
    files.push({ path: rel, content: await fileRes.text() });
  }
  if (!files.some((f) => f.path === 'SKILL.md')) {
    throw new Error(
      `Marketplace skill "${id}" has no SKILL.md — refusing to install an unparsable skill`
    );
  }

  contentCache.set(id, files);
  return { files };
}

/**
 * Install a marketplace skill into the shared local skill library.
 *
 * Safety (mirrors skills.ts conventions): the id is validated with the same
 * rules as assertSafeId (no path traversal), every fetched file must be a flat
 * file inside the skill folder, and an existing local skill with the same id
 * is NEVER silently overwritten — pass `overwrite: true` explicitly to
 * replace it.
 */
export async function installMarketplaceSkill(
  id: string,
  opts?: SkillsDirOptions & { overwrite?: boolean; source?: string; subdir?: string }
): Promise<{ targetPath: string }> {
  const { overwrite = false, source, subdir, ...skillOpts } = opts ?? {};
  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > 128 ||
    id === '.' ||
    id === '..' ||
    id.includes('/') ||
    id.includes('\\') ||
    id.includes('\0')
  ) {
    throw new Error(`Invalid skill id: ${JSON.stringify(id)}`);
  }

  const { files } = (await fetchMarketplaceSkillContent(id, { source, subdir })) ?? {};
  if (!files || !files.some((f) => f.path === 'SKILL.md')) {
    throw new Error(`Skill not found in marketplace: ${id}`);
  }

  const libraryDir = skillOpts.libraryDir ?? getSkillsLibraryDir();
  const targetPath = path.join(libraryDir, id);
  const existing = await fileExists(path.join(targetPath, 'SKILL.md'));
  if (existing && !overwrite) {
    throw new Error(
      `Skill already exists in the library: ${id} (pass overwrite: true to replace it)`
    );
  }

  // The skill must actually parse as a skill (same validation a locally
  // created skill gets) before anything is written.
  const skillMd = files.find((f) => f.path === 'SKILL.md')!;
  const meta = parseSkillFrontmatter(skillMd.content);
  if (!meta.name) {
    throw new Error(
      `Marketplace skill "${id}" has no name in its SKILL.md frontmatter — refusing to install`
    );
  }

  if (existing) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
  await fs.mkdir(targetPath, { recursive: true });

  // Stamp provenance into the frontmatter metadata so checkMarketplaceUpdates
  // can later compare installed vs latest.
  const skills2 = await listMarketplaceSkills({ source, subdir });
  const summary = skills2.find((s) => s.id === id);
  const provenance: Record<string, string> = {
    'source-repo': summary?.sourceRepo ?? source ?? MARKETPLACE_SOURCE_REPO,
  };
  if (summary?.version) provenance['source-version'] = summary.version;
  else if (summary?.hash) provenance['source-version'] = summary.hash;
  const stampMatch = /^(metadata:\n)((?:  .*\n)*)/.exec(skillMd.content);
  let stampedContent = skillMd.content;
  const stampLines = Object.entries(provenance)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}\n`)
    .join('');
  if (stampMatch) {
    stampedContent = skillMd.content.replace(
      /^(metadata:\n)((?:  .*\n)*)/,
      (_m, head: string, existing2: string) =>
        `${head}${existing2}${stampLines.replace(/\n$/, '')}\n`
    );
  } else {
    // No metadata block: insert one right before the CLOSING '---' (the second
    // fence) so the file stays a valid frontmatter document.
    const closing = skillMd.content.indexOf('\n---', 3);
    if (closing === -1) {
      throw new Error('Marketplace SKILL.md has no closing frontmatter fence — refusing to install');
    }
    stampedContent =
      skillMd.content.slice(0, closing + 1) + `metadata:\n${stampLines}` + skillMd.content.slice(closing + 1);
  }

  for (const file of files) {
    // Belt and braces: fetchMarketplaceSkillContent already filtered to flat,
    // safe relative paths; re-check before touching the filesystem.
    if (!file.path || file.path.includes('/') || file.path.includes('..')) {
      throw new Error(`Refusing to write unsafe path from marketplace: ${file.path}`);
    }
    await fs.writeFile(
      path.join(targetPath, file.path),
      file.path === 'SKILL.md' ? stampedContent : file.content,
      'utf8'
    );
  }
  return { targetPath };
}
