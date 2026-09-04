/**
 * Skill management — a shared local skill library plus assignment to skill-capable agents.
 *
 * A "skill" is a folder containing a SKILL.md file with YAML frontmatter
 * (`name`, `description`, optional `version`). This is the de-facto skill format
 * shared by Claude Code, OpenAI Codex CLI, OpenCode, AionUi, Pi, Continue, Roo
 * Code, Qwen Code and JetBrains Junie — verified on disk in ~/.claude/skills,
 * ~/.codex/skills, ~/.config/opencode/skills, ~/.aionui/skills, ~/.pi/agent/skills,
 * ~/.continue/skills, ~/.roo/skills, ~/.qwen/skills and ~/.junie/skills.
 *
 * Layout:
 *   Library (source of truth): <config home>/skills/<skill-id>/SKILL.md
 *     (same config home as registry.json — see registry.ts resolveRegistryPath)
 *   Agent targets: per-agent skills directories declared in agent-catalog.json
 *     via `skillsPaths`. An entry with `skillsPaths` for the current platform is
 *     "skill capable".
 *
 * Assigning a skill copies the library folder into the agent's skills directory
 * (registry stays the source of truth; agent dirs are generated output — the same
 * philosophy as provider configs). Removing deletes only the copied folder.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Platform } from './types';
import { getAgentCatalog, getAgentCatalogEntry } from './agent-catalog';
import {
  parseSkillFrontmatterSpec,
  validateSkillSpec,
  type SkillDiagnostic,
  type SkillFrontmatter,
} from './skill-spec';
import { resolveRegistryPath } from './registry';
import { expandPath, fileExists, getCurrentPlatform, readFileSafe } from './utils';

/** A skill discovered in a skills directory (library or agent). */
export interface SkillDef {
  /** Folder name — the stable id used for assignment. */
  id: string;
  /** Display name from SKILL.md frontmatter (falls back to the folder name). */
  name: string;
  description?: string;
  version?: string;
  /** Spec: license name or bundled-license pointer. */
  license?: string;
  /** Spec: free-text environment requirements (≤500 chars). */
  compatibility?: string;
  /** Spec: metadata map (version/author/…). */
  metadata?: Record<string, string>;
  /** Spec: space-separated pre-approved tools (experimental). */
  allowedTools?: string[];
  /** agentskills.io validation result (see skill-spec.ts). */
  validation: { ok: boolean; loadable: boolean; diagnostics: SkillDiagnostic[] };
  /** Absolute path to the skill folder. */
  path: string;
  /**
   * Number of files directly inside the skill folder (shallow count —
   * immediate entries only, no recursion into subdirectories). The GUI shows
   * this as a small "N files" label on each list row; the expensive recursive
   * count is only available on demand via countSkillFiles (M060 — the full
   * recursive walk across 560+ skill folders on every refresh caused a RAM/CPU
   * spike, so the list-load path pays for one readdir per skill instead).
   */
  fileCount: number;
}

/** A skill-capable agent and the skills currently installed for it. */
export interface SkillCapableAgent {
  agentId: string;
  name: string;
  /** Expanded skills directory for the current platform. */
  skillsDir: string;
  /** Whether the agent's skills directory already exists on disk. */
  installed: boolean;
  /** Ids of skills present in the agent's skills directory. */
  skillIds: string[];
}

/** Everything the Skills tab needs in one round-trip. */
export interface SkillsSnapshot {
  libraryDir: string;
  skills: SkillDef[];
  agents: SkillCapableAgent[];
  /** Cross-client (agentskills.io) skills dirs scanned for discovery. */
  crossClientDirs: { user: string; project: string; userExists: boolean; projectExists: boolean };
  /** Spec shadowing warnings (same id in project + user cross-client dirs). */
  warnings: { skillId: string; message: string }[];
  /** skillId -> agentIds that currently have that skill installed. */
  assignments: Record<string, string[]>;
  /**
   * Aggregated cross-agent view: every skill id known anywhere (shared library
   * plus every skill-capable agent's own directory), with `foundOn` listing
   * each location. Lets the GUI browse and copy skills that are installed
   * directly on an agent without a library copy (see getAllKnownSkills).
   */
  allSkills: AggregatedSkill[];
}

/**
 * A skill id known anywhere on this machine — in the shared library and/or on
 * any skill-capable agent. Metadata prefers the library copy when present,
 * otherwise the first agent copy read. Copies with the same id but different
 * content are intentionally merged into one entry (no content diffing).
 */
export interface AggregatedSkill extends SkillDef {
  /** Locations the skill currently exists: agent ids, plus 'library'. */
  foundOn: string[];
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  /** Markdown body after the frontmatter. A starter template is used when omitted. */
  body?: string;
  /** Spec: license name or pointer to a bundled license file. */
  license?: string;
  /** Spec: free-text environment requirements (≤500 chars). */
  compatibility?: string;
  /** Spec: metadata map (version, author, …). */
  metadata?: Record<string, string>;
  /** Spec: space-separated pre-approved tools (experimental). */
  allowedTools?: string[];
}

export interface SkillsDirOptions {
  /** Override the skills library directory (tests). */
  libraryDir?: string;
  /** Project root for the cross-client `.agents/skills` dir (tests; default cwd). */
  projectRoot?: string;
  /** Override the cross-client USER skills dir (tests; default ~/.agents/skills). */
  crossClientUserDir?: string;
  /** Override the current platform (tests). */
  platform?: Platform;
  /** Override the target agent skills directory (tests). */
  skillsDir?: string;
  /** Override the source agent skills directory (tests, agent-to-agent copy). */
  sourceSkillsDir?: string;
  /**
   * Per-agent skills dir overrides (tests): agentId -> directory. Only used by
   * getAllKnownSkills/getSkillsSnapshot; when provided, the catalog's real
   * per-agent directories are NOT read for the overridden agents.
   */
  agentSkillsDirs?: Record<string, string>;
  /**
   * Bypass the getSkillsSnapshot TTL cache (tests): read the cache neither
   * nor write it, so a test that wrote files directly still sees a fresh
   * scan. Mutations clear the cache themselves (clearSkillsCache).
   */
  force?: boolean;
}

/**
 * Directory that holds the shared skill library — next to registry.json, so it
 * follows the same config-home rules ($AI_CONFIG_HOME / platform defaults).
 */
export function getSkillsLibraryDir(): string {
  return path.join(path.dirname(resolveRegistryPath()), 'skills');
}

/** Guard against path traversal in user-supplied ids. */
function assertSafeId(id: string, label: string): void {
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
    throw new Error(`Invalid ${label}: ${JSON.stringify(id)}`);
  }
}

/**
 * Minimal YAML frontmatter reader for SKILL.md: a leading `---` block with
 * `key: value` lines. Deliberately dependency-free — only flat scalar keys
 * (name/description/version) are needed.
 */
export function parseSkillFrontmatter(content: string): {
  name?: string;
  description?: string;
  version?: string;
} {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return {};
  const out: { name?: string; description?: string; version?: string } = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (key !== 'name' && key !== 'description' && key !== 'version') continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    }
    if (value.length > 0) out[key as 'name' | 'description' | 'version'] = value;
  }
  return out;
}

/** Count files directly inside a directory (one readdir, no recursion). */
async function countFilesShallow(dir: string): Promise<number> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let count = 0;
  for (const entry of entries) {
    if (entry.isFile()) count++;
  }
  return count;
}

/**
 * Count files under a directory recursively (capped to stay cheap). This is
 * the expensive path — do NOT call it for every skill in a list scan (M060);
 * it exists for on-demand exact counts when a caller genuinely needs them.
 */
export async function countSkillFiles(dir: string, cap = 500): Promise<number> {
  let count = 0;
  const stack = [dir];
  while (stack.length > 0 && count < cap) {
    const current = stack.pop();
    if (!current) break;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (count >= cap) break;
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      } else if (entry.isFile()) {
        count++;
      }
    }
  }
  return count;
}

/** Read one skill folder (`<dir>/<id>/SKILL.md`). Returns null when absent. */
export async function readSkillDef(dir: string, id: string): Promise<SkillDef | null> {
  const skillDir = path.join(dir, id);
  const content = await readFileSafe(path.join(skillDir, 'SKILL.md'));
  if (content == null) return null;
  const meta: SkillFrontmatter = parseSkillFrontmatterSpec(content);
  const validation = validateSkillSpec(meta, id);
  return {
    id,
    name: meta.name ?? id,
    description: meta.description,
    version: (meta.extras?.version ?? meta.metadata?.version) as string | undefined,
    license: meta.license,
    compatibility: meta.compatibility,
    metadata: meta.metadata,
    allowedTools: meta.allowedTools,
    validation,
    path: skillDir,
    fileCount: await countFilesShallow(skillDir),
  };
}

/** List all skills in a skills directory (library or agent), sorted by name. */
async function listSkillsInDir(dir: string): Promise<SkillDef[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const defs = await Promise.all(dirs.map((name) => readSkillDef(dir, name)));
  const skills = defs.filter((d): d is SkillDef => d !== null);
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

/** List skills in the shared library. */
export async function listSkills(opts: SkillsDirOptions = {}): Promise<SkillDef[]> {
  return listSkillsInDir(opts.libraryDir ?? getSkillsLibraryDir());
}

/** List skills installed for one agent. */
export async function listAgentSkills(
  agentId: string,
  opts: SkillsDirOptions = {}
): Promise<SkillDef[]> {
  const dir = opts.skillsDir ?? getAgentSkillsDir(agentId, opts.platform);
  if (!dir) return [];
  return listSkillsInDir(dir);
}

/**
 * Expanded skills directory for an agent on a platform, or null when the agent
 * does not support skills there.
 */
export function getAgentSkillsDir(
  agentId: string,
  platform: Platform = getCurrentPlatform()
): string | null {
  const entry = getAgentCatalogEntry(agentId);
  const template = entry?.skillsPaths?.[platform];
  return template ? expandPath(template) : null;
}

/** Catalog ids that support skills on a platform. */
export function getSkillCapableAgentIds(platform: Platform = getCurrentPlatform()): string[] {
  return getAgentCatalog()
    .filter((agent) => agent.skillsPaths?.[platform])
    .map((agent) => agent.id);
}

/**
 * In-memory TTL cache for getSkillsSnapshot (M060). A Skills-page refresh or
 * background poll within the TTL reuses the previous scan instead of re-walking
 * every skill folder; any mutation (assign/unassign/copy/create/delete) calls
 * clearSkillsCache() so the UI never shows stale data after a change.
 */
const SNAPSHOT_TTL_MS = 5000;
let snapshotCache: { data: SkillsSnapshot; expiresAt: number } | null = null;

/**
 * Drop the cached snapshot — called by every skill mutation (assign/unassign/
 * copy/create/delete) so the next read sees the change.
 */
export function clearSkillsCache(): void {
  snapshotCache = null;
}

/** One-shot snapshot for the Skills tab: library + capable agents + assignments. */
export async function getSkillsSnapshot(opts: SkillsDirOptions = {}): Promise<SkillsSnapshot> {
  // TTL cache: within the window a repeated read (page reload, poll) is free.
  // `opts.force` skips both cache read and write (test seam).
  if (!opts.force && snapshotCache && Date.now() < snapshotCache.expiresAt) {
    return snapshotCache.data;
  }
  const snapshot = await buildSkillsSnapshot(opts);
  if (!opts.force) {
    snapshotCache = { data: snapshot, expiresAt: Date.now() + SNAPSHOT_TTL_MS };
  }
  return snapshot;
}

/** The uncached scan that getSkillsSnapshot wraps with its TTL cache. */
async function buildSkillsSnapshot(opts: SkillsDirOptions = {}): Promise<SkillsSnapshot> {
  const platform = opts.platform ?? getCurrentPlatform();
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();
  const skills = await listSkillsInDir(libraryDir);

  const agents: SkillCapableAgent[] = [];
  for (const entry of getAgentCatalog()) {
    const template = entry.skillsPaths?.[platform];
    if (!template) continue;
    const skillsDir = expandPath(template);
    const installed = await fileExists(skillsDir);
    const agentSkills = await listSkillsInDir(skillsDir);
    agents.push({
      agentId: entry.id,
      name: entry.name,
      skillsDir,
      installed,
      skillIds: agentSkills.map((skill) => skill.id),
    });
  }

  const assignments: Record<string, string[]> = {};
  for (const skill of skills) assignments[skill.id] = [];
  for (const agent of agents) {
    for (const skillId of agent.skillIds) {
      if (!assignments[skillId]) assignments[skillId] = [];
      assignments[skillId].push(agent.agentId);
    }
  }

  const allSkills = await getAllKnownSkills(opts, skills);
  const dirs = getCrossClientSkillsDirs(opts.projectRoot, opts.crossClientUserDir);
  const crossClientDirs = {
    user: dirs.user,
    project: dirs.project,
    userExists: await fileExists(dirs.user),
    projectExists: await fileExists(dirs.project),
  };
  const warnings = await detectShadowedSkills(opts);

  return { libraryDir, skills, agents, assignments, allSkills, crossClientDirs, warnings };
}

/**
 * The cross-client skills directories from the agentskills.io convention —
 * scanned by ~45 agents regardless of vendor: `~/.agents/skills/` (user scope)
 * and `<project>/.agents/skills/` (project scope, resolved from the process
 * cwd). Locations 'agents-dir' and 'project-agents-dir' refer to these.
 */
export function getCrossClientSkillsDirs(
  projectRoot?: string,
  userDirOverride?: string
): { user: string; project: string } {
  const user = userDirOverride ?? path.join(os.homedir(), '.agents', 'skills');
  const root = projectRoot ?? process.cwd();
  const project = path.join(root, '.agents', 'skills');
  return { user, project };
}

/**
 * Resolve a skill location to its directory:
 *   'library'            → the shared library
 *   'agents-dir'         → ~/.agents/skills (user cross-client convention)
 *   'project-agents-dir' → <cwd>/.agents/skills (project cross-client convention)
 *   any other string     → that agent id's catalogued skills dir
 */
export function resolveSkillDir(
  location: string,
  opts: SkillsDirOptions = {}
): string | null {
  if (location === 'library') return opts.libraryDir ?? getSkillsLibraryDir();
  if (location === 'agents-dir' || location === 'project-agents-dir') {
    const dirs = getCrossClientSkillsDirs(opts.projectRoot, opts.crossClientUserDir);
    return location === 'agents-dir' ? dirs.user : dirs.project;
  }
  return opts.agentSkillsDirs?.[location] ?? getAgentSkillsDir(location, opts.platform);
}

/**
 * Discover every skill known on this machine: the shared library, every
 * skill-capable agent's skills dir, AND the cross-client `.agents/skills`
 * directories (user + project scope) from the agentskills.io convention.
 * Merged by skill id (folder name); each entry's `foundOn` lists every
 * location it exists in ('library', agent ids, 'agents-dir',
 * 'project-agents-dir'). Metadata prefers the library copy, otherwise the
 * first copy read. Known limitation: same id with different content on two
 * locations is merged as one entry (no content diffing).
 */
export async function getAllKnownSkills(
  opts: SkillsDirOptions = {},
  preloadedLibrarySkills?: SkillDef[]
): Promise<AggregatedSkill[]> {
  const platform = opts.platform ?? getCurrentPlatform();
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();

  const byId = new Map<string, AggregatedSkill>();
  const add = (def: SkillDef, location: string): void => {
    const existing = byId.get(def.id);
    if (existing) {
      existing.foundOn.push(location);
    } else {
      byId.set(def.id, { ...def, foundOn: [location] });
    }
  };

  // Library first so its metadata wins when the same id is also on an agent.
  const librarySkills = preloadedLibrarySkills ?? (await listSkillsInDir(libraryDir));
  for (const def of librarySkills) add(def, 'library');
  for (const agentId of getSkillCapableAgentIds(platform)) {
    const dir = opts.agentSkillsDirs?.[agentId] ?? getAgentSkillsDir(agentId, platform);
    if (!dir) continue;
    for (const def of await listSkillsInDir(dir)) add(def, agentId);
  }
  // Cross-client convention dirs (agentskills.io) — project scope last so the
  // user-scope copy is what non-precedence-aware callers see first.
  for (const location of ['agents-dir', 'project-agents-dir'] as const) {
    const dir = resolveSkillDir(location, opts);
    if (!dir) continue;
    for (const def of await listSkillsInDir(dir)) add(def, location);
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Detect shadowing per the spec convention ("project-level skills override
 * user-level skills"): the same skill id present in BOTH cross-client scopes.
 * Returns one warning per shadowed skill id.
 */
export async function detectShadowedSkills(opts: SkillsDirOptions = {}): Promise<
  { skillId: string; message: string }[]
> {
  const dirs = getCrossClientSkillsDirs(opts.projectRoot, opts.crossClientUserDir);
  const [user, project] = await Promise.all([listSkillsInDir(dirs.user), listSkillsInDir(dirs.project)]);
  const userIds = new Set(user.map((s) => s.id));
  return project
    .filter((s) => userIds.has(s.id))
    .map((s) => ({
      skillId: s.id,
      message: `"${s.id}" exists in both the project and user cross-client dirs — project-level overrides user-level.`,
    }));
}

/**
 * Assign (copy) a library skill to a skill-capable agent. Overwrites any existing
 * copy so the library stays the source of truth.
 */
export async function assignSkillToAgent(
  skillId: string,
  agentId: string,
  opts: SkillsDirOptions = {}
): Promise<{ targetPath: string }> {
  assertSafeId(skillId, 'skill id');
  assertSafeId(agentId, 'agent id');
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();
  const source = path.join(libraryDir, skillId);
  if (!(await fileExists(path.join(source, 'SKILL.md')))) {
    throw new Error(`Skill not found in library: ${skillId}`);
  }
  const targetDir = opts.skillsDir ?? getAgentSkillsDir(agentId, opts.platform);
  if (!targetDir) {
    throw new Error(`Agent does not support skills: ${agentId}`);
  }
  const targetPath = path.join(targetDir, skillId);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.cp(source, targetPath, { recursive: true });
  clearSkillsCache();
  return { targetPath };
}

/**
 * Adopt a skill discovered at any location (an agent's dir, the cross-client
 * `.agents/skills` dirs, …) into the shared library — the inverse of assign.
 * The source copy is left untouched; the library becomes the assignable hub
 * copy. Pass `overwrite: true` to replace an existing library skill.
 */
export async function adoptSkillToLibrary(
  skillId: string,
  location: string,
  opts: SkillsDirOptions & { overwrite?: boolean } = {}
): Promise<{ targetPath: string }> {
  const { overwrite = false, ...dirOpts } = opts;
  assertSafeId(skillId, 'skill id');
  const sourceDir = resolveSkillDir(location, dirOpts);
  if (!sourceDir) throw new Error(`Unknown skill location: ${location}`);
  const sourcePath = path.join(sourceDir, skillId);
  if (!(await fileExists(path.join(sourcePath, 'SKILL.md')))) {
    throw new Error(`Skill not found at that location: ${skillId} -> ${location}`);
  }
  const libraryDir = dirOpts.libraryDir ?? getSkillsLibraryDir();
  const targetPath = path.join(libraryDir, skillId);
  if ((await fileExists(path.join(targetPath, 'SKILL.md'))) && !overwrite) {
    throw new Error(`Skill already exists in the library: ${skillId} (pass overwrite: true to replace)`);
  }
  await fs.mkdir(libraryDir, { recursive: true });
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.cp(sourcePath, targetPath, { recursive: true });
  // Re-validate the adopted copy and surface loadable-but-warned skills.
  const def = await readSkillDef(libraryDir, skillId);
  if (def && !def.validation.loadable) {
    // Spec guidance: keep the files but tell the user the skill is invalid.
    clearSkillsCache();
    throw new Error(
      `Adopted, but the skill is invalid per the agentskills spec: ${def.validation.diagnostics
        .filter((d) => d.level === 'error')
        .map((d) => d.message)
        .join(' ')}`
    );
  }
  clearSkillsCache();
  return { targetPath };
}

/**
 * Copy a skill already installed on one agent to a different agent
 * (agent A -> agent B). The source agent keeps its copy.
 */
export async function copySkillBetweenAgents(
  skillId: string,
  sourceAgentId: string,
  targetAgentId: string,
  opts: SkillsDirOptions = {}
): Promise<{ targetPath: string }> {
  assertSafeId(skillId, 'skill id');
  assertSafeId(sourceAgentId, 'agent id');
  assertSafeId(targetAgentId, 'agent id');
  if (sourceAgentId === targetAgentId) {
    throw new Error(`Source and target agent are the same: ${sourceAgentId}`);
  }
  const sourceDir = opts.sourceSkillsDir ?? getAgentSkillsDir(sourceAgentId, opts.platform);
  if (!sourceDir) {
    throw new Error(`Agent does not support skills: ${sourceAgentId}`);
  }
  const targetDir = opts.skillsDir ?? getAgentSkillsDir(targetAgentId, opts.platform);
  if (!targetDir) {
    throw new Error(`Agent does not support skills: ${targetAgentId}`);
  }
  const sourcePath = path.join(sourceDir, skillId);
  if (!(await fileExists(path.join(sourcePath, 'SKILL.md')))) {
    throw new Error(`Skill is not assigned to this agent: ${skillId} -> ${sourceAgentId}`);
  }
  const targetPath = path.join(targetDir, skillId);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.cp(sourcePath, targetPath, { recursive: true });
  clearSkillsCache();
  return { targetPath };
}

/** Remove a previously assigned skill from an agent (deletes only the copy). */
export async function removeSkillFromAgent(
  skillId: string,
  agentId: string,
  opts: SkillsDirOptions = {}
): Promise<void> {
  assertSafeId(skillId, 'skill id');
  assertSafeId(agentId, 'agent id');
  const targetDir = opts.skillsDir ?? getAgentSkillsDir(agentId, opts.platform);
  if (!targetDir) {
    throw new Error(`Agent does not support skills: ${agentId}`);
  }
  const targetPath = path.join(targetDir, skillId);
  if (!(await fileExists(path.join(targetPath, 'SKILL.md')))) {
    throw new Error(`Skill is not assigned to this agent: ${skillId} -> ${agentId}`);
  }
  await fs.rm(targetPath, { recursive: true, force: true });
  clearSkillsCache();
}

/**
 * Delete a skill's folder from the shared library.
 *
 * This only removes the library copy. Agents that already had the skill
 * assigned keep their own copies — assignment is a copy, and agent dirs are
 * generated output (see the file header), so deleting the source of truth
 * must not silently cascade into every agent. Use removeSkillFromAgent to
 * clean up individual agent copies.
 */
export async function removeSkillFromLibrary(
  skillId: string,
  opts: SkillsDirOptions = {}
): Promise<void> {
  assertSafeId(skillId, 'skill id');
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();
  const skillDir = path.join(libraryDir, skillId);
  if (!(await fileExists(path.join(skillDir, 'SKILL.md')))) {
    throw new Error(`Skill not found in library: ${skillId}`);
  }
  await fs.rm(skillDir, { recursive: true, force: true });
  clearSkillsCache();
}

/**
 * Read the SKILL.md content for a skill from a given location.
 *
 * @param skillId - the skill folder name
 * @param location - 'library' for the shared library, or an agent id for that agent's skills dir
 * @returns the raw SKILL.md text, or null when not found
 */
export async function readSkillContent(
  skillId: string,
  location: string,
  opts: SkillsDirOptions = {}
): Promise<string | null> {
  assertSafeId(skillId, 'skill id');
  const dir =
    location === 'library'
      ? opts.libraryDir ?? getSkillsLibraryDir()
      : opts.agentSkillsDirs?.[location] ?? getAgentSkillsDir(location, opts.platform);
  if (!dir) return null;
  return readFileSafe(path.join(dir, skillId, 'SKILL.md'));
}

/**
 * Save (overwrite) the SKILL.md content for a skill at a given location.
 *
 * @param skillId - the skill folder name
 * @param location - 'library' for the shared library, or an agent id for that agent's skills dir
 * @param content - the new raw SKILL.md text
 */
export async function saveSkillContent(
  skillId: string,
  location: string,
  content: string,
  opts: SkillsDirOptions = {}
): Promise<void> {
  assertSafeId(skillId, 'skill id');
  const dir =
    location === 'library'
      ? opts.libraryDir ?? getSkillsLibraryDir()
      : opts.agentSkillsDirs?.[location] ?? getAgentSkillsDir(location, opts.platform);
  if (!dir) throw new Error(`Location not found: ${location}`);
  const skillDir = path.join(dir, skillId);
  if (!(await fileExists(path.join(skillDir, 'SKILL.md')))) {
    throw new Error(`Skill not found at that location: ${skillId} -> ${location}`);
  }
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8');
  clearSkillsCache();
}

/** Escape a scalar for double-quoted YAML output. */
function yamlScalar(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Slug used as the skill folder name / id. */
export function skillSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug;
}

/** Create a new skill in the shared library. */
export async function createSkill(
  input: CreateSkillInput,
  opts: SkillsDirOptions = {}
): Promise<SkillDef> {
  const name = (input.name ?? '').trim();
  if (!name) throw new Error('Skill name is required');
  // Validate the RAW name first: slugification strips path separators, so a
  // name like "../escape-test" would otherwise survive slug validation while
  // the raw value reaches path.join (QA finding C2 — path traversal).
  assertSafeId(name, 'skill name');
  const id = skillSlug(name);
  assertSafeId(id, 'skill name');
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();
  const skillDir = path.join(libraryDir, id);
  if (await fileExists(path.join(skillDir, 'SKILL.md'))) {
    throw new Error(`Skill already exists: ${id}`);
  }
  const description = (input.description ?? '').trim();
  const body =
    input.body && input.body.trim().length > 0
      ? input.body.trim()
      : `# ${name}\n\nDescribe when and how to use this skill.\n\n## Instructions\n\n1. Step one\n2. Step two\n`;
  const lines = ['---', `name: ${yamlScalar(name)}`];
  if (description) lines.push(`description: ${yamlScalar(description)}`);
  if (input.license?.trim()) lines.push(`license: ${yamlScalar(input.license.trim())}`);
  if (input.compatibility?.trim()) {
    lines.push(`compatibility: ${yamlScalar(input.compatibility.trim())}`);
  }
  const metadata = { ...input.metadata };
  if (Object.keys(metadata).length > 0) {
    lines.push('metadata:');
    for (const [k, v] of Object.entries(metadata)) {
      lines.push(`  ${k}: ${yamlScalar(String(v))}`);
    }
  }
  if (input.allowedTools && input.allowedTools.length > 0) {
    lines.push(`allowed-tools: ${input.allowedTools.join(' ')}`);
  }
  lines.push('---', '', `${body.trim()}`, '');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), lines.join('\n'), 'utf8');
  const def = await readSkillDef(libraryDir, id);
  if (!def) throw new Error(`Failed to create skill: ${id}`);
  clearSkillsCache();
  return def;
}

// ---------------------------------------------------------------------------
// P2 — Full CRUD on skill folders: file browser, per-file read/write/delete,
// rename, duplicate, zip export/import. All paths are resolved through
// resolveSkillDir and guarded against traversal (no .., no absolute, must
// stay inside the skill folder).
// ---------------------------------------------------------------------------

/** One file in a skill folder (relative to the skill folder). */
export interface SkillFileEntry {
  /** Path relative to the skill folder, e.g. 'SKILL.md' or 'scripts/run.sh'. */
  relPath: string;
  size: number;
  isDir: boolean;
}

/** Max entries returned by listSkillFiles (UI safety cap). */
export const SKILL_FILES_MAX = 500;

/**
 * List every file (recursively, capped) in a skill folder at a location.
 * Directories are included as entries so the UI can render a tree.
 */
export async function listSkillFiles(
  skillId: string,
  location: string,
  opts: SkillsDirOptions = {}
): Promise<SkillFileEntry[]> {
  assertSafeId(skillId, 'skill id');
  const dir = resolveSkillDir(location, opts);
  if (!dir) throw new Error(`Unknown skill location: ${location}`);
  const skillDir = path.join(dir, skillId);
  if (!(await fileExists(path.join(skillDir, 'SKILL.md')))) {
    throw new Error(`Skill not found at that location: ${skillId} -> ${location}`);
  }
  const out: SkillFileEntry[] = [];
  const walk = async (rel: string): Promise<void> => {
    if (out.length >= SKILL_FILES_MAX) return;
    const abs = path.join(skillDir, rel);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    for (const entry of entries) {
      if (out.length >= SKILL_FILES_MAX) return;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push({ relPath: childRel, size: 0, isDir: true });
        await walk(childRel);
      } else if (entry.isFile()) {
        const stat = await fs.stat(path.join(skillDir, childRel));
        out.push({ relPath: childRel, size: stat.size, isDir: false });
      }
    }
  };
  await walk('');
  out.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return out;
}

/**
 * Guard a client-supplied relative path: no traversal, no absolute paths,
 * no empty segments. Returns the cleaned posix-style relPath.
 */
export function assertSafeRelPath(relPath: string): string {
  const cleaned = relPath.replace(/\\/g, '/');
  if (cleaned.startsWith('/') || /^[A-Za-z]:/.test(cleaned)) {
    throw new Error(`Absolute paths are not allowed: ${relPath}`);
  }
  const parts = cleaned.split('/');
  for (const part of parts) {
    if (part === '..' || part === '' || part === '.') {
      throw new Error(`Unsafe path segment in: ${relPath}`);
    }
    if (part.includes('\\0')) throw new Error('Invalid path');
  }
  if (parts.length === 0) throw new Error('Empty path');
  return parts.join('/');
}

/**
 * Read one file from a skill folder. Text files come back decoded (utf8);
 * anything else raises (binary editing is out of scope for the browser UI).
 */
export async function readSkillFile(
  skillId: string,
  location: string,
  relPath: string,
  opts: SkillsDirOptions = {}
): Promise<string> {
  assertSafeId(skillId, 'skill id');
  const safe = assertSafeRelPath(relPath);
  const dir = resolveSkillDir(location, opts);
  if (!dir) throw new Error(`Unknown skill location: ${location}`);
  const abs = path.join(dir, skillId, safe);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isFile()) throw new Error(`File not found: ${relPath}`);
  if (stat.size > 512 * 1024) {
    throw new Error('File is larger than 512 KiB — edit it on disk instead');
  }
  const buf = await fs.readFile(abs);
  if (buf.includes(0)) throw new Error('Binary files cannot be edited here');
  return buf.toString('utf8');
}

/** Write one file inside a skill folder (creates parent dirs). */
export async function saveSkillFile(
  skillId: string,
  location: string,
  relPath: string,
  content: string,
  opts: SkillsDirOptions = {}
): Promise<void> {
  assertSafeId(skillId, 'skill id');
  const safe = assertSafeRelPath(relPath);
  const dir = resolveSkillDir(location, opts);
  if (!dir) throw new Error(`Unknown skill location: ${location}`);
  const abs = path.join(dir, skillId, safe);
  if (!abs.startsWith(path.join(dir, skillId) + path.sep)) {
    throw new Error(`Unsafe path: ${relPath}`);
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf8');
  clearSkillsCache();
}

/** Delete one file from a skill folder (SKILL.md cannot be deleted). */
export async function deleteSkillFile(
  skillId: string,
  location: string,
  relPath: string,
  opts: SkillsDirOptions = {}
): Promise<void> {
  assertSafeId(skillId, 'skill id');
  const safe = assertSafeRelPath(relPath);
  if (safe === 'SKILL.md') throw new Error('SKILL.md cannot be deleted');
  const dir = resolveSkillDir(location, opts);
  if (!dir) throw new Error(`Unknown skill location: ${location}`);
  await fs.rm(path.join(dir, skillId, safe), { recursive: true, force: true });
  clearSkillsCache();
}

/**
 * Rename a library skill: moves the folder and rewrites the frontmatter name.
 * Agents that already have the old copy keep it (assignment is a copy);
 * re-assign after renaming to update them.
 */
export async function renameSkill(
  skillId: string,
  newName: string,
  opts: SkillsDirOptions = {}
): Promise<{ newId: string }> {
  assertSafeId(skillId, 'skill id');
  assertSafeId(newName, 'skill name');
  const newId = skillSlug(newName);
  assertSafeId(newId, 'skill name');
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();
  const from = path.join(libraryDir, skillId);
  const to = path.join(libraryDir, newId);
  if (!(await fileExists(path.join(from, 'SKILL.md')))) {
    throw new Error(`Skill not found in library: ${skillId}`);
  }
  if (await fileExists(path.join(to, 'SKILL.md'))) {
    throw new Error(`A skill named ${newId} already exists`);
  }
  await fs.rename(from, to);
  // Rewrite the frontmatter name so agents see the new display name.
  const mdPath = path.join(to, 'SKILL.md');
  const md = (await fs.readFile(mdPath, 'utf8')).replace(
    /^(name:\s*).*$/m,
    `name: ${JSON.stringify(newName)}`
  );
  await fs.writeFile(mdPath, md, 'utf8');
  clearSkillsCache();
  return { newId };
}

/**
 * Duplicate a library skill into `${id}-copy` (numbered when taken).
 * The frontmatter name gets " Copy"/" Copy 2" suffixes.
 */
export async function duplicateSkill(
  skillId: string,
  opts: SkillsDirOptions = {}
): Promise<{ newId: string }> {
  assertSafeId(skillId, 'skill id');
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();
  const from = path.join(libraryDir, skillId);
  if (!(await fileExists(path.join(from, 'SKILL.md')))) {
    throw new Error(`Skill not found in library: ${skillId}`);
  }
  let newId = `${skillId}-copy`;
  let n = 2;
  while (await fileExists(path.join(libraryDir, newId, 'SKILL.md'))) {
    newId = `${skillId}-copy-${n}`;
    n++;
  }
  await fs.cp(from, path.join(libraryDir, newId), { recursive: true });
  const mdPath = path.join(libraryDir, newId, 'SKILL.md');
  const md = (await fs.readFile(mdPath, 'utf8')).replace(
    /^(name:\s*)(.*)$/m,
    (_m, prefix: string, value: string) => {
      const base = value.replace(/^"|"$/g, '');
      return `${prefix}${JSON.stringify(n === 2 ? `${base} Copy` : `${base} Copy ${n - 1}`)}`;
    }
  );
  await fs.writeFile(mdPath, md, 'utf8');
  clearSkillsCache();
  return { newId };
}

/**
 * Export a library skill as a .zip buffer (skill folder zipped at its root —
 * unzip into <skillsDir>/<id>/ produces the skill).
 */
export async function exportSkillZip(
  skillId: string,
  opts: SkillsDirOptions = {}
): Promise<Buffer> {
  assertSafeId(skillId, 'skill id');
  const libraryDir = opts.libraryDir ?? getSkillsLibraryDir();
  const skillDir = path.join(libraryDir, skillId);
  if (!(await fileExists(path.join(skillDir, 'SKILL.md')))) {
    throw new Error(`Skill not found in library: ${skillId}`);
  }
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip();
  zip.addLocalFolder(skillDir);
  return zip.toBuffer();
}

/**
 * Import a skill from a .zip buffer into the library. The zip must contain
 * the skill folder (SKILL.md at root or one level down). An existing library
 * skill with the same id is only replaced when overwrite is set.
 */
export async function importSkillZip(
  zipPath: string,
  opts: SkillsDirOptions & { overwrite?: boolean } = {}
): Promise<{ newId: string }> {
  const { overwrite = false, ...dirOpts } = opts;
  const libraryDir = dirOpts.libraryDir ?? getSkillsLibraryDir();
  const tmpExtract = path.join(
    os.tmpdir(),
    `acm-skill-import-${Date.now()}-${path.basename(zipPath, '.zip')}`
  );
  await fs.mkdir(tmpExtract, { recursive: true });
  try {
    const AdmZip = (await import('adm-zip')).default;
    new AdmZip(zipPath).extractAllTo(tmpExtract, true);
    // Locate SKILL.md (root or nested one level).
    let skillDir: string | null = null;
    const candidates = [tmpExtract, ...(await fs.readdir(tmpExtract, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => path.join(tmpExtract, e.name))];
    for (const candidate of candidates) {
      if (await fileExists(path.join(candidate, 'SKILL.md'))) {
        skillDir = candidate;
        break;
      }
    }
    if (!skillDir) throw new Error('The zip does not contain a SKILL.md at its root or one level down');
    // When SKILL.md sits at the zip ROOT (our export layout), the folder name is
    // the temp filename — fall back to the exporting skill's id.
    const skillId = path.basename(skillDir) === path.basename(tmpExtract)
      ? path.basename(zipPath).replace(/\.zip$/i, '')
      : path.basename(skillDir);
    assertSafeId(skillId, 'skill id');
    const target = path.join(libraryDir, skillId);
    if ((await fileExists(path.join(target, 'SKILL.md'))) && !overwrite) {
      throw new Error(`Skill already exists in the library: ${skillId} (pass overwrite: true to replace)`);
    }
    await fs.mkdir(libraryDir, { recursive: true });
    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(skillDir, target, { recursive: true });
    const def = await readSkillDef(libraryDir, skillId);
    if (def && !def.validation.loadable) {
      clearSkillsCache();
      throw new Error(
        `Imported, but the skill is invalid per the agentskills spec: ${def.validation.diagnostics
          .filter((d) => d.level === 'error')
          .map((d) => d.message)
          .join(' ')}`
      );
    }
    clearSkillsCache();
    return { newId: skillId };
  } finally {
    await fs.rm(tmpExtract, { recursive: true, force: true });
  }
}
