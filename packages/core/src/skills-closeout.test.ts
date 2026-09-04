import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createSkill,
  scaffoldSkillDirs,
  createSkillFile,
  listSkillFiles,
  SKILL_CONVENTION_DIRS,
} from './skills.js';
import {
  listMarketplaceSources,
  enableBuiltinSource,
  disableBuiltinSource,
  MARKETPLACE_OFFICIAL_REPO,
  MARKETPLACE_SOURCE_REPO,
} from './marketplace.js';

let home: string;
const opts = () => ({ libraryDir: path.join(home, 'library'), projectRoot: home });

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-closeout-'));
});

afterAll(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

describe('scaffold + createSkillFile', () => {
  it('creates the conventional folders once', async () => {
    await createSkill({ name: 'scaffold-me', description: 'use when testing scaffolds' }, opts());
    const first = await scaffoldSkillDirs('scaffold-me', 'library', opts());
    expect(first.created.sort()).toEqual([...SKILL_CONVENTION_DIRS].sort());
    const second = await scaffoldSkillDirs('scaffold-me', 'library', opts());
    expect(second.created).toEqual([]);
    const names = (await listSkillFiles('scaffold-me', 'library', opts())).map((f) => f.relPath);
    for (const dir of SKILL_CONVENTION_DIRS) expect(names).toContain(dir);
  });

  it('creates a new file and rejects duplicates', async () => {
    await createSkillFile('scaffold-me', 'library', 'scripts/new.sh', '#!/bin/sh\n', opts());
    const content = await fs.readFile(
      path.join(opts().libraryDir!, 'scaffold-me', 'scripts/new.sh'),
      'utf8'
    );
    expect(content).toContain('#!/bin/sh');
    await expect(
      createSkillFile('scaffold-me', 'library', 'scripts/new.sh', '', opts())
    ).rejects.toThrow(/already exists/);
  });
});

describe('official source toggle', () => {
  it('enables and disables anthropics/skills', async () => {
    const registryPath = path.join(home, 'registry.json');
    let { sources } = await listMarketplaceSources(registryPath);
    expect(sources.some((s) => s.repo === MARKETPLACE_OFFICIAL_REPO)).toBe(false);

    ({ sources } = await enableBuiltinSource(registryPath));
    expect(sources.some((s) => s.repo === MARKETPLACE_OFFICIAL_REPO)).toBe(true);
    expect(sources.some((s) => s.repo === MARKETPLACE_SOURCE_REPO)).toBe(true);

    ({ sources } = await disableBuiltinSource(registryPath));
    expect(sources.some((s) => s.repo === MARKETPLACE_OFFICIAL_REPO)).toBe(false);
    // Idempotent disable
    await disableBuiltinSource(registryPath);
    ({ sources } = await listMarketplaceSources(registryPath));
    expect(sources.map((s) => s.repo)).toEqual([MARKETPLACE_SOURCE_REPO]);
  });
});
