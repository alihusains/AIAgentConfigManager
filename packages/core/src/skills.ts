/**
 * Skill management — a shared local skill library plus assignment to skill-capable agents.
 *
 * A "skill" is a folder containing a SKILL.md file with YAML frontmatter
 * (`name`, `description`, optional `version`). This is the de-facto skill format
 * shared by Claude Code, OpenAI Codex CLI, OpenCode and AionUi — verified on disk
 * in ~/.claude/skills, ~/.codex/skills, ~/.config/opencode/skills and ~/.aionui/skills.
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
import path from 'node:path';
import type { Platform } from './types';
import { getAgentCatalog, getAgentCatalogEntry } from './agent-catalog';
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
  /** Absolute path to the skill folder. */
  path: string;
  /** Number of files inside the skill folder (including SKILL.md). */
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
  /** skillId -> agentIds that currently have that skill installed. */
  assignments: Record<string, string[]>;
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  /** Markdown body after the frontmatter. A starter template is used when omitted. */
  body?: string;
}

export interface SkillsDirOptions {
  /** Override the skills library directory (tests). */
  libraryDir?: string;
  /** Override the current platform (tests). */
  platform?: Platform;
  /** Override the target agent skills directory (tests). */
  skillsDir?: string;
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

/** Count files under a directory recursively (capped to stay cheap). */
async function countFiles(dir: string, cap = 500): Promise<number> {
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
  const meta = parseSkillFrontmatter(content);
  return {
    id,
    name: meta.name ?? id,
    description: meta.description,
    version: meta.version,
    path: skillDir,
    fileCount: await countFiles(skillDir),
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
  const skills: SkillDef[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const def = await readSkillDef(dir, entry.name);
    if (def) skills.push(def);
  }
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
  opts: SkillsDirOptions = {},
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
  platform: Platform = getCurrentPlatform(),
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

/** One-shot snapshot for the Skills tab: library + capable agents + assignments. */
export async function getSkillsSnapshot(opts: SkillsDirOptions = {}): Promise<SkillsSnapshot> {
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

  return { libraryDir, skills, agents, assignments };
}

/**
 * Assign (copy) a library skill to a skill-capable agent. Overwrites any existing
 * copy so the library stays the source of truth.
 */
export async function assignSkillToAgent(
  skillId: string,
  agentId: string,
  opts: SkillsDirOptions = {},
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
  return { targetPath };
}

/** Remove a previously assigned skill from an agent (deletes only the copy). */
export async function removeSkillFromAgent(
  skillId: string,
  agentId: string,
  opts: SkillsDirOptions = {},
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
  opts: SkillsDirOptions = {},
): Promise<SkillDef> {
  const name = (input.name ?? '').trim();
  if (!name) throw new Error('Skill name is required');
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
  lines.push('---', '', `${body.trim()}`, '');
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), lines.join('\n'), 'utf8');
  const def = await readSkillDef(libraryDir, id);
  if (!def) throw new Error(`Failed to create skill: ${id}`);
  return def;
}
