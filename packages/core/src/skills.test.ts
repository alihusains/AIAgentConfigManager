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
  readFileSafe,
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

  it('parses a representative Junie sample (extra flat keys ignored)', () => {
    // Shape verified against real files in ~/.junie/skills (e.g. tdd-workflow).
    const meta = parseSkillFrontmatter(
      [
        '---',
        'name: tdd-workflow',
        'description: Use this skill when writing new features, fixing bugs, or refactoring code.',
        'origin: ECC',
        '---',
        '',
        '# Test-Driven Development Workflow',
      ].join('\n')
    );
    expect(meta.name).toBe('tdd-workflow');
    expect(meta.description).toContain('writing new features');
  });

  it('parses a representative Pi sample (nested metadata block ignored)', () => {
    // Shape verified against real files in ~/.pi/agent/skills (e.g. archify).
    const meta = parseSkillFrontmatter(
      [
        '---',
        'name: archify',
        'description: Create polished, validated architecture diagrams as explorable standalone HTML.',
        'license: MIT',
        'metadata:',
        '  version: "2.12"',
        '  author: tt-a1i',
        '---',
        '',
        '# Archify',
      ].join('\n')
    );
    expect(meta.name).toBe('archify');
    expect(meta.description).toContain('architecture diagrams');
    expect(meta.version).toBeUndefined(); // nested under metadata: — flat keys only
  });

  it('parses a representative Qwen sample (quoted description)', () => {
    // Shape verified against Qwen Code docs (docs/users/features/skills.md)
    // and the real files in ~/.qwen/skills (flat name/description frontmatter).
    const meta = parseSkillFrontmatter(
      [
        '---',
        'name: cmux-cli',
        'description: "Comprehensive cmux CLI usage guide. Use when the user asks about cmux."',
        '---',
        '',
        '# cmux CLI',
      ].join('\n')
    );
    expect(meta.name).toBe('cmux-cli');
    expect(meta.description).toBe(
      'Comprehensive cmux CLI usage guide. Use when the user asks about cmux.'
    );
  });

  it('parses a representative Continue/Roo sample (argument-hint + metadata ignored)', () => {
    // Shape verified against real files in ~/.continue/skills and ~/.roo/skills
    // (e.g. design, banner-design).
    const meta = parseSkillFrontmatter(
      [
        '---',
        'name: banner-design',
        'description: "Design banners for social media, ads, website heroes."',
        'argument-hint: "[platform] [style]"',
        'license: MIT',
        'metadata:',
        '  author: claudekit',
        '  version: "1.0.0"',
        '---',
        '',
        '# Banner Design',
      ].join('\n')
    );
    expect(meta.name).toBe('banner-design');
    expect(meta.description).toContain('Design banners');
    expect(meta.version).toBeUndefined();
  });
});

describe('catalog skill capability (real machine, read-only)', () => {
  // The 5 M041 agents are expected to have real skills directories on the
  // machine this suite was authored on. These tests are read-only and skip
  // gracefully when a directory is absent (CI, other machines).
  const realDirs: Record<string, string> = {
    pi: path.join(os.homedir(), '.pi', 'agent', 'skills'),
    continue: path.join(os.homedir(), '.continue', 'skills'),
    roo: path.join(os.homedir(), '.roo', 'skills'),
    qwen: path.join(os.homedir(), '.qwen', 'skills'),
    junie: path.join(os.homedir(), '.junie', 'skills'),
  };

  it("reads real skills from each agent's directory on this machine", async () => {
    const results = new Map<string, string[]>();
    for (const [agentId, dir] of Object.entries(realDirs)) {
      let entries: import('node:fs').Dirent[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue; // not installed on this machine — skip
      }
      const withSkillMd = entries.filter((e) => e.isDirectory() || e.isSymbolicLink());
      const parsed: string[] = [];
      for (const entry of withSkillMd) {
        const content = await readFileSafe(path.join(dir, entry.name, 'SKILL.md'));
        if (content == null) continue;
        const meta = parseSkillFrontmatter(content);
        if (meta.name) parsed.push(meta.name);
      }
      if (parsed.length > 0) results.set(agentId, parsed);
    }
    if (results.size === 0) {
      console.log('real-machine skill dirs not present — skipping');
      return;
    }
    // On the authoring machine at least pi must be present with >0 skills.
    expect(results.has('pi')).toBe(true);
    expect(results.get('pi')!.length).toBeGreaterThan(0);
    for (const [agentId, names] of results) {
      console.log(
        `  ${agentId}: ${names.length} skills parsed (sample: ${names.slice(0, 3).join(', ')})`
      );
    }
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

  it('includes the M041-verified agents on every platform', () => {
    // Verified per-agent (folder + SKILL.md with flat name/description frontmatter):
    //   pi       — ~/.pi/agent/skills (pi docs: docs/skills.md; config dir is
    //              ~/.pi/agent on all platforms, override PI_CODING_AGENT_DIR)
    //   continue — $CONTINUE_HOME/skills, default ~/.continue/skills
    //   roo      — ~/.roo/skills (Roo Code docs: features/skills)
    //   qwen     — ~/.qwen/skills (Qwen Code docs: Agent Skills)
    //   junie    — ~/.junie/skills (Junie docs: agent-skills)
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      const ids = getSkillCapableAgentIds(platform);
      for (const id of ['pi', 'continue', 'roo', 'qwen', 'junie']) {
        expect(ids, `${id} must be skill-capable on ${platform}`).toContain(id);
      }
    }
  });

  it('resolves M041-verified agents to their documented skills dirs', () => {
    expect(getAgentSkillsDir('pi', 'darwin')).toMatch(/\.pi[\\/]agent[\\/]skills$/);
    expect(getAgentSkillsDir('continue', 'darwin')).toMatch(/\.continue[\\/]skills$/);
    expect(getAgentSkillsDir('roo', 'darwin')).toMatch(/\.roo[\\/]skills$/);
    expect(getAgentSkillsDir('qwen', 'darwin')).toMatch(/\.qwen[\\/]skills$/);
    expect(getAgentSkillsDir('junie', 'darwin')).toMatch(/\.junie[\\/]skills$/);
  });

  it('claude-code resolves to ~/.claude/skills', () => {
    const dir = getAgentSkillsDir('claude-code', 'darwin');
    expect(dir).toBeTruthy();
    expect(dir!.endsWith(path.join('.claude', 'skills'))).toBe(true);
  });

  it('agents without skillsPaths resolve to null', () => {
    expect(getAgentSkillsDir('gemini', 'darwin')).toBeNull();
  });

  it('resolves M041-verified agents to their documented skills dirs (per-platform)', () => {
    const expectedDirs: Record<string, [string, string, string]> = {
      pi: ['~/.pi/agent/skills', '~/.pi/agent/skills', '%USERPROFILE%\\.pi\\agent\\skills'],
      continue: ['~/.continue/skills', '~/.continue/skills', '%USERPROFILE%\\.continue\\skills'],
      roo: ['~/.roo/skills', '~/.roo/skills', '%USERPROFILE%\\.roo\\skills'],
      qwen: ['~/.qwen/skills', '~/.qwen/skills', '%USERPROFILE%\\.qwen\\skills'],
      junie: ['~/.junie/skills', '~/.junie/skills', '%USERPROFILE%\\.junie\\skills'],
    };
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      const ids = getSkillCapableAgentIds(platform);
      for (const agentId of Object.keys(expectedDirs)) {
        expect(ids, `${agentId} on ${platform}`).toContain(agentId);
        const dir = getAgentSkillsDir(agentId, platform);
        expect(dir, `${agentId} on ${platform}`).not.toBeNull();
        // On darwin/linux the ~ template expands to the real home dir, so the
        // expanded path must end with the skills subdirectory. (win32 templates
        // use %USERPROFILE%, which only expands on Windows hosts.)
        if (platform !== 'win32') {
          const template = expectedDirs[agentId][platform === 'darwin' ? 0 : 1];
          const tail = template.replace(/^~/, '').split('/').join(path.sep);
          expect(dir!.endsWith(tail), `${agentId} on ${platform}`).toBe(true);
        }
      }
    }
  });

  it('parses representative SKILL.md frontmatter samples for each M041 agent', () => {
    // Samples mirror the real SKILL.md files found on disk under each agent's
    // skills directory (extra keys like license/argument-hint/metadata/origin
    // must be ignored by the flat-key parser).
    const cases: Array<[string, string, { name: string; description: string }]> = [
      [
        'pi',
        '---\nname: archify\ndescription: Create polished diagrams.\nlicense: MIT\nmetadata:\n  version: "2.12"\n---\nBody',
        { name: 'archify', description: 'Create polished diagrams.' },
      ],
      [
        'continue',
        '---\nname: design\ndescription: "Comprehensive design skill: brand identity."\nargument-hint: "[design-type]"\nlicense: MIT\n---\nBody',
        { name: 'design', description: 'Comprehensive design skill: brand identity.' },
      ],
      [
        'roo',
        '---\nname: slides\ndescription: Create strategic HTML presentations.\nargument-hint: "[topic]"\nmetadata:\n  author: claudekit\n  version: "1.0.0"\n---\nBody',
        { name: 'slides', description: 'Create strategic HTML presentations.' },
      ],
      [
        'qwen',
        '---\nname: cmux-cli\ndescription: "Comprehensive cmux CLI usage guide."\n---\nBody',
        { name: 'cmux-cli', description: 'Comprehensive cmux CLI usage guide.' },
      ],
      [
        'junie',
        '---\nname: agent-sort\ndescription: Build an evidence-backed install plan.\norigin: ECC\n---\nBody',
        { name: 'agent-sort', description: 'Build an evidence-backed install plan.' },
      ],
    ];
    for (const [agentId, content, expected] of cases) {
      const meta = parseSkillFrontmatter(content);
      expect(meta.name, agentId).toBe(expected.name);
      expect(meta.description, agentId).toBe(expected.description);
    }
  });
});
