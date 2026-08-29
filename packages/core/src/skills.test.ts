/**
 * Tests for the skill management platform (skills.ts):
 * frontmatter parsing, library listing, assign/remove round-trip,
 * slug/safety rules and createSkill.
 *
 * All filesystem work happens in a temp directory — no real home dirs touched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseSkillFrontmatter,
  skillSlug,
  listSkills,
  readSkillDef,
  createSkill,
  assignSkillToAgent,
  removeSkillFromAgent,
  copySkillBetweenAgents,
  getSkillsSnapshot,
  getSkillCapableAgentIds,
  getAgentSkillsDir,
} from './index';

async function writeSkill(dir: string, id: string, frontmatter: string, body = 'Body text.\n') {
  const skillDir = path.join(dir, id);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), `${frontmatter}\n${body}`, 'utf8');
  return skillDir;
}

describe('parseSkillFrontmatter', () => {
  it('parses name/description/version from a leading --- block', () => {
    const meta = parseSkillFrontmatter(
      [
        '---',
        'name: My Skill',
        'description: Does things',
        'version: 1.2.3',
        '---',
        '',
        'Body',
      ].join('\n')
    );
    expect(meta.name).toBe('My Skill');
    expect(meta.description).toBe('Does things');
    expect(meta.version).toBe('1.2.3');
  });

  it('strips surrounding quotes', () => {
    const meta = parseSkillFrontmatter('---\nname: "Quoted Name"\ndescription: \'single\'\n---\n');
    expect(meta.name).toBe('Quoted Name');
    expect(meta.description).toBe('single');
  });

  it('returns empty object when there is no frontmatter', () => {
    expect(parseSkillFrontmatter('# Just markdown\n')).toEqual({});
  });

  it('ignores unknown keys', () => {
    const meta = parseSkillFrontmatter('---\nname: X\nlicense: MIT\n---\n');
    expect(meta.name).toBe('X');
    expect((meta as Record<string, unknown>).license).toBeUndefined();
  });
});

describe('skillSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(skillSlug('My Cool Skill!')).toBe('my-cool-skill');
  });
  it('trims leading/trailing hyphens', () => {
    expect(skillSlug('  --Weird-- Name--  ')).toBe('weird-name');
  });
});

describe('skill library (temp dir)', () => {
  let libraryDir: string;
  let agentDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));
    libraryDir = path.join(tmp, 'library');
    agentDir = path.join(tmp, 'agent-skills');
    await fs.mkdir(libraryDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(path.dirname(libraryDir), { recursive: true, force: true });
  });

  it('lists skills sorted by display name and skips non-skill folders', async () => {
    await writeSkill(libraryDir, 'zeta', '---\nname: Alpha Skill\n---');
    await writeSkill(libraryDir, 'alpha', '---\nname: Zeta Skill\n---');
    await fs.mkdir(path.join(libraryDir, 'not-a-skill'), { recursive: true });
    const skills = await listSkills({ libraryDir });
    expect(skills.map((s) => s.id)).toEqual(['zeta', 'alpha']); // sorted by name: Alpha, Zeta
    expect(skills[0].name).toBe('Alpha Skill');
    expect(skills[0].fileCount).toBe(1);
  });

  it('readSkillDef returns null for a missing skill', async () => {
    expect(await readSkillDef(libraryDir, 'nope')).toBeNull();
  });

  it('createSkill writes a parseable SKILL.md and rejects duplicates', async () => {
    const def = await createSkill(
      { name: 'Test Skill', description: 'A "quoted" description', body: '# Hello' },
      { libraryDir }
    );
    expect(def.id).toBe('test-skill');
    expect(def.name).toBe('Test Skill');
    expect(def.description).toBe('A "quoted" description');
    const content = await fs.readFile(path.join(libraryDir, 'test-skill', 'SKILL.md'), 'utf8');
    expect(content).toContain('name: "Test Skill"');
    expect(content).toContain('# Hello');
    await expect(createSkill({ name: 'Test Skill' }, { libraryDir })).rejects.toThrow(
      /already exists/
    );
  });

  it('assign copies the skill into the agent dir (overwrite safe)', async () => {
    await writeSkill(libraryDir, 'deploy', '---\nname: Deploy\n---', 'v1\n');
    const { targetPath } = await assignSkillToAgent('deploy', 'any-agent', {
      libraryDir,
      skillsDir: agentDir,
    });
    expect(targetPath).toBe(path.join(agentDir, 'deploy'));
    expect(await fs.readFile(path.join(agentDir, 'deploy', 'SKILL.md'), 'utf8')).toContain('v1');

    // Update the library copy and re-assign: agent copy must be replaced.
    await fs.writeFile(path.join(libraryDir, 'deploy', 'SKILL.md'), '---\nname: Deploy\n---\nv2\n');
    await assignSkillToAgent('deploy', 'any-agent', { libraryDir, skillsDir: agentDir });
    expect(await fs.readFile(path.join(agentDir, 'deploy', 'SKILL.md'), 'utf8')).toContain('v2');
  });

  it('assign copies nested files too', async () => {
    const skillDir = await writeSkill(libraryDir, 'rich', '---\nname: Rich\n---');
    await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(skillDir, 'scripts', 'run.sh'), 'echo hi\n');
    await assignSkillToAgent('rich', 'any-agent', { libraryDir, skillsDir: agentDir });
    const nested = await fs.readFile(path.join(agentDir, 'rich', 'scripts', 'run.sh'), 'utf8');
    expect(nested).toBe('echo hi\n');
  });

  it('assign rejects unknown skills and unsafe ids', async () => {
    await expect(
      assignSkillToAgent('missing', 'any-agent', { libraryDir, skillsDir: agentDir })
    ).rejects.toThrow(/not found/i);
    await expect(
      assignSkillToAgent('../escape', 'any-agent', { libraryDir, skillsDir: agentDir })
    ).rejects.toThrow(/invalid skill id/i);
    await expect(
      assignSkillToAgent('ok', 'a/b', { libraryDir, skillsDir: agentDir })
    ).rejects.toThrow(/invalid agent id/i);
  });

  it('remove deletes only the assigned copy', async () => {
    await writeSkill(libraryDir, 'temp', '---\nname: Temp\n---');
    await assignSkillToAgent('temp', 'any-agent', { libraryDir, skillsDir: agentDir });
    await removeSkillFromAgent('temp', 'any-agent', { libraryDir, skillsDir: agentDir });
    await expect(fs.access(path.join(agentDir, 'temp'))).rejects.toThrow();
    // Library copy untouched.
    expect(await fs.readFile(path.join(libraryDir, 'temp', 'SKILL.md'), 'utf8')).toBeTruthy();
    // Removing again is an error (not assigned).
    await expect(
      removeSkillFromAgent('temp', 'any-agent', { libraryDir, skillsDir: agentDir })
    ).rejects.toThrow(/not assigned/i);
  });

  it('snapshot reports library, agents and assignments together', async () => {
    await writeSkill(libraryDir, 'shared', '---\nname: Shared\n---');
    await assignSkillToAgent('shared', 'any-agent', { libraryDir, skillsDir: agentDir });

    // Point the snapshot at a fake capable agent by monkey-free means:
    // use a real catalog agent but override its dir via listAgentSkills is not
    // possible here, so assert on the library + assignments shape instead.
    const snapshot = await getSkillsSnapshot({ libraryDir });
    expect(snapshot.libraryDir).toBe(libraryDir);
    expect(snapshot.skills.map((s) => s.id)).toContain('shared');
    expect(Array.isArray(snapshot.agents)).toBe(true);
    expect(typeof snapshot.assignments).toBe('object');
  });
});

describe('copySkillBetweenAgents (temp dirs)', () => {
  let sourceDir: string;
  let targetDir: string;

  beforeEach(async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-copy-test-'));
    sourceDir = path.join(tmp, 'agent-a-skills');
    targetDir = path.join(tmp, 'agent-b-skills');
    await fs.mkdir(sourceDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(path.dirname(sourceDir), { recursive: true, force: true });
  });

  it('copies an installed skill from one agent to another and leaves the source untouched', async () => {
    await writeSkill(sourceDir, 'shared', '---\nname: Shared\n---', 'source body\n');
    const { targetPath } = await copySkillBetweenAgents('shared', 'agent-a', 'agent-b', {
      sourceSkillsDir: sourceDir,
      skillsDir: targetDir,
    });
    expect(targetPath).toBe(path.join(targetDir, 'shared'));
    // Target now has the same SKILL.md content.
    const sourceContent = await fs.readFile(path.join(sourceDir, 'shared', 'SKILL.md'), 'utf8');
    const targetContent = await fs.readFile(path.join(targetDir, 'shared', 'SKILL.md'), 'utf8');
    expect(targetContent).toBe(sourceContent);
    // Source copy untouched.
    expect(await fs.readFile(path.join(sourceDir, 'shared', 'SKILL.md'), 'utf8')).toBe(
      sourceContent
    );
  });

  it('copies nested files too', async () => {
    const skillDir = await writeSkill(sourceDir, 'rich', '---\nname: Rich\n---');
    await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(skillDir, 'scripts', 'run.sh'), 'echo hi\n');
    await copySkillBetweenAgents('rich', 'agent-a', 'agent-b', {
      sourceSkillsDir: sourceDir,
      skillsDir: targetDir,
    });
    expect(await fs.readFile(path.join(targetDir, 'rich', 'scripts', 'run.sh'), 'utf8')).toBe(
      'echo hi\n'
    );
  });

  it('rejects when the source agent does not support skills', async () => {
    await writeSkill(sourceDir, 'shared', '---\nname: Shared\n---');
    await expect(
      copySkillBetweenAgents('shared', 'gemini', 'agent-b', {
        sourceSkillsDir: undefined,
        skillsDir: targetDir,
      })
    ).rejects.toThrow('Agent does not support skills: gemini');
  });

  it('rejects when the target agent does not support skills', async () => {
    await writeSkill(sourceDir, 'shared', '---\nname: Shared\n---');
    await expect(
      copySkillBetweenAgents('shared', 'agent-a', 'gemini', {
        sourceSkillsDir: sourceDir,
        skillsDir: undefined,
      })
    ).rejects.toThrow('Agent does not support skills: gemini');
  });

  it('rejects when the skill is not installed on the source agent', async () => {
    await expect(
      copySkillBetweenAgents('missing', 'agent-a', 'agent-b', {
        sourceSkillsDir: sourceDir,
        skillsDir: targetDir,
      })
    ).rejects.toThrow('Skill is not assigned to this agent: missing -> agent-a');
  });

  it('rejects when source and target agent are the same', async () => {
    await writeSkill(sourceDir, 'shared', '---\nname: Shared\n---');
    await expect(
      copySkillBetweenAgents('shared', 'agent-a', 'agent-a', {
        sourceSkillsDir: sourceDir,
        skillsDir: targetDir,
      })
    ).rejects.toThrow('Source and target agent are the same: agent-a');
  });

  it('rejects unsafe ids', async () => {
    await expect(
      copySkillBetweenAgents('../escape', 'agent-a', 'agent-b', {
        sourceSkillsDir: sourceDir,
        skillsDir: targetDir,
      })
    ).rejects.toThrow(/invalid skill id/i);
  });
});

describe('catalog skill capability', () => {
  it('exposes at least one skill-capable agent', () => {
    expect(getSkillCapableAgentIds('darwin').length).toBeGreaterThan(0);
    expect(getSkillCapableAgentIds('linux').length).toBeGreaterThan(0);
  });

  it('claude-code resolves to ~/.claude/skills', () => {
    const dir = getAgentSkillsDir('claude-code', 'darwin');
    expect(dir).toBeTruthy();
    expect(dir!.endsWith(path.join('.claude', 'skills'))).toBe(true);
  });

  it('agents without skillsPaths resolve to null', () => {
    expect(getAgentSkillsDir('gemini', 'darwin')).toBeNull();
  });
});
