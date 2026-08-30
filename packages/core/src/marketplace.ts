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
import path from 'node:path';
import {
  getSkillsLibraryDir,
  parseSkillFrontmatter,
  type SkillsDirOptions,
} from './skills';
import { fileExists } from './utils';

/** The single marketplace source (verified public repo). */
export const MARKETPLACE_SOURCE_REPO = 'alihusains/enterprise-skills';

/** Skills live under this path in the source repo. */
const SKILLS_ROOT = 'skills';

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
  listCache = null;
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

let listCache: { data: MarketplaceSkillSummary[]; expiresAt: number } | null = null;
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
export async function listMarketplaceSkills(opts?: {
  force?: boolean;
}): Promise<MarketplaceSkillSummary[]> {
  if (!opts?.force && listCache && Date.now() < listCache.expiresAt) {
    return listCache.data;
  }

  const manifestUrl = `https://raw.githubusercontent.com/${MARKETPLACE_SOURCE_REPO}/main/.skills-manifest.json`;
  const res = await httpGet(manifestUrl);
  if (!res.ok) throw await toError(res);
  const manifest: unknown = await res.json().catch(() => {
    throw new Error(
      `Marketplace manifest is not valid JSON (${MARKETPLACE_SOURCE_REPO}/.skills-manifest.json)`
    );
  });
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    throw new Error('Unexpected marketplace manifest shape (expected a JSON object)');
  }

  const skills: MarketplaceSkillSummary[] = [];
  for (const [id, entry] of Object.entries(manifest as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' && e.name ? e.name : id;
    const description = typeof e.description === 'string' ? e.description : undefined;
    const department = typeof e.department === 'string' ? e.department : undefined;
    const sourcePath = `${SKILLS_ROOT}/${department ?? ''}/${id}`.replace(/\/{2,}/g, '/');
    skills.push({
      id,
      name,
      description,
      sourceRepo: MARKETPLACE_SOURCE_REPO,
      sourcePath,
      htmlUrl: `https://github.com/${MARKETPLACE_SOURCE_REPO}/tree/main/${sourcePath}`,
    });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));

  if (!opts?.force) {
    listCache = { data: skills, expiresAt: Date.now() + LIST_CACHE_TTL_MS };
  }
  return skills;
}

/**
 * Fetch the full file contents of one skill folder (SKILL.md plus any
 * companion files) for preview or install. Returns null when the skill id is
 * not in the marketplace. File contents are cached in memory (no TTL — a
 * refresh of the listing is what invalidates them via __clearMarketplaceCache).
 */
export async function fetchMarketplaceSkillContent(
  id: string
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
  const skills = await listMarketplaceSkills();
  const summary = skills.find((s) => s.id === id);
  if (!summary) return null;

  const dirUrl = `https://api.github.com/repos/${MARKETPLACE_SOURCE_REPO}/contents/${summary.sourcePath}`;
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
  opts?: SkillsDirOptions & { overwrite?: boolean }
): Promise<{ targetPath: string }> {
  const { overwrite = false, ...skillOpts } = opts ?? {};
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

  const { files } = (await fetchMarketplaceSkillContent(id)) ?? {};
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
  for (const file of files) {
    // Belt and braces: fetchMarketplaceSkillContent already filtered to flat,
    // safe relative paths; re-check before touching the filesystem.
    if (!file.path || file.path.includes('/') || file.path.includes('..')) {
      throw new Error(`Refusing to write unsafe path from marketplace: ${file.path}`);
    }
    await fs.writeFile(path.join(targetPath, file.path), file.content, 'utf8');
  }
  return { targetPath };
}
