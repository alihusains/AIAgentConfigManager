import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  getCrossClientSkillsDirs,
  resolveSkillDir,
  getAllKnownSkills,
  detectShadowedSkills,
  adoptSkillToLibrary,
  createSkill,
  assignSkillToAgent,
  removeSkillFromLibrary,
  clearSkillsCache,
  getSkillsSnapshot,
} from './skills.js';

let home: string;
let projectRoot: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-p1-home-'));
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-p1-proj-'));
});

afterAll(async () => {
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

const userSkillsDir = () => path.join(home, 'cross-client-user');
const opts = () => ({ libraryDir: path.join(home, 'library'), projectRoot, crossClientUserDir: userSkillsDir() });
const mkSkill = async (dir: string, id: string, name: string, description: string) => {
  await fs.mkdir(path.join(dir, id), { recursive: true });
  await fs.writeFile(
    path.join(dir, id, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`,
    'utf8'
  );
};

describe('cross-client discovery (agentskills.io convention)', () => {
  it('resolveSkillDir maps the location labels', () => {
    const dirs = getCrossClientSkillsDirs(projectRoot, userSkillsDir());
    expect(resolveSkillDir('agents-dir', opts())).toBe(dirs.user);
    expect(resolveSkillDir('project-agents-dir', opts())).toBe(dirs.project);
    expect(resolveSkillDir('library', opts())).toBe(opts().libraryDir);
  });

  it('getAllKnownSkills finds skills in both cross-client dirs and agent dirs', async () => {
    const dirs = getCrossClientSkillsDirs(projectRoot, userSkillsDir());
    await mkSkill(dirs.user, 'user-only-skill', 'user-only-skill', 'Lives in the user dir');
    await mkSkill(dirs.project, 'project-only-skill', 'project-only-skill', 'Lives in the project dir');
    await mkSkill(dirs.user, 'shadowed-skill', 'shadowed-skill', 'user copy');
    await mkSkill(dirs.project, 'shadowed-skill', 'shadowed-skill', 'project copy');

    const all = await getAllKnownSkills(opts());
    const ids = all.map((s) => s.id);
    expect(ids).toContain('user-only-skill');
    expect(ids).toContain('project-only-skill');

    const shadowed = all.find((s) => s.id === 'shadowed-skill');
    expect(shadowed?.foundOn).toContain('agents-dir');
    expect(shadowed?.foundOn).toContain('project-agents-dir');
  });

  it('detectShadowedSkills warns when project + user share an id', async () => {
    const warnings = await detectShadowedSkills(opts());
    const ids = warnings.map((w) => w.skillId);
    expect(ids).toContain('shadowed-skill');
    expect(ids).not.toContain('user-only-skill');
  });
});

describe('adoptSkillToLibrary', () => {
  it('copies a cross-client skill into the library without touching the source', async () => {
    const dirs = getCrossClientSkillsDirs(projectRoot, userSkillsDir());
    await adoptSkillToLibrary('user-only-skill', 'agents-dir', opts());
    const libraryDir = opts().libraryDir;
    await expect(
      fs.access(path.join(libraryDir, 'user-only-skill', 'SKILL.md'))
    ).resolves.toBeUndefined();
    // Source untouched
    await expect(
      fs.access(path.join(dirs.user, 'user-only-skill', 'SKILL.md'))
    ).resolves.toBeUndefined();
  });

  it('rejects adopting an id that already exists in the library (no overwrite)', async () => {
    await expect(
      adoptSkillToLibrary('user-only-skill', 'agents-dir', opts())
    ).rejects.toThrow(/already exists/);
    await expect(
      adoptSkillToLibrary('user-only-skill', 'agents-dir', { ...opts(), overwrite: true })
    ).resolves.toHaveProperty('targetPath');
  });

  it('rejects unknown locations and missing skills', async () => {
    await expect(adoptSkillToLibrary('nope', 'no-such-agent', opts())).rejects.toThrow(
      /Unknown skill location/
    );
  });

  it('adopts an agent-installed skill by agent id', async () => {
    await createSkill(
      { name: 'agent-native-skill', description: 'Created in library, assigned to an agent.' },
      opts()
    );
    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const agentDir = path.join(home, 'agents-dir');
    // Use the test seam: any location string resolves via opts.agentSkillsDirs
    await assignSkillToAgent('agent-native-skill', 'claude-code', {
      ...opts(),
      skillsDir: agentDir,
      platform,
    });
    const adopted = await adoptSkillToLibrary('agent-native-skill', 'claude-code', {
      ...opts(),
      overwrite: true,
      agentSkillsDirs: { 'claude-code': agentDir },
    });
    expect(adopted.targetPath).toContain('agent-native-skill');
  });
});

describe('snapshot surface', () => {
  it('exposes crossClientDirs + shadow warnings', async () => {
    const snap = await getSkillsSnapshot({ ...opts(), force: true });
    expect(snap.crossClientDirs.user).toBe(userSkillsDir());
    expect(snap.crossClientDirs.projectExists).toBe(true);
    expect(snap.warnings.map((w) => w.skillId)).toContain('shadowed-skill');
  });
});

describe('cleanup', () => {
  it('removes the adopted skills', async () => {
    await removeSkillFromLibrary('user-only-skill', opts());
    await removeSkillFromLibrary('agent-native-skill', opts());
    clearSkillsCache();
  });
});
