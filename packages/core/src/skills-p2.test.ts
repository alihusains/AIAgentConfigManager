
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createSkill,
  listSkillFiles,
  readSkillFile,
  saveSkillFile,
  deleteSkillFile,
  renameSkill,
  duplicateSkill,
  exportSkillZip,
  importSkillZip,
  assertSafeRelPath,
} from './skills.js';

let home: string;
let opts: () => Parameters<typeof createSkill>[1];

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-p2-'));
  opts = () => ({ libraryDir: path.join(home, 'library'), projectRoot: home });
});

afterAll(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

describe('skill file CRUD', () => {
  it('lists, reads, writes and deletes files inside a skill folder', async () => {
    await createSkill({ name: 'crud-skill', description: 'CRUD test skill.' }, opts());
    await saveSkillFile('crud-skill', 'library', 'scripts/run.sh', '#!/bin/sh\necho hi\n', opts());

    const files = await listSkillFiles('crud-skill', 'library', opts());
    const names = files.map((f) => f.relPath);
    expect(names).toContain('SKILL.md');
    expect(names).toContain('scripts/run.sh');

    const content = await readSkillFile('crud-skill', 'library', 'scripts/run.sh', opts());
    expect(content).toContain('echo hi');

    await deleteSkillFile('crud-skill', 'library', 'scripts/run.sh', opts());
    const after = await listSkillFiles('crud-skill', 'library', opts());
    expect(after.map((f) => f.relPath)).not.toContain('scripts/run.sh');
  });

  it('rejects traversal and SKILL.md deletion', async () => {
    expect(() => assertSafeRelPath('../escape.md')).toThrow(/Unsafe/);
    expect(() => assertSafeRelPath('/etc/passwd')).toThrow(/Absolute/);
    expect(() => assertSafeRelPath('a/../../b')).toThrow(/Unsafe/);
    await expect(deleteSkillFile('crud-skill', 'library', 'SKILL.md', opts())).rejects.toThrow(
      /cannot be deleted/
    );
    await expect(
      readSkillFile('crud-skill', 'library', '../../outside.md', opts())
    ).rejects.toThrow();
  });
});

describe('rename + duplicate', () => {
  it('renames the folder and rewrites the frontmatter name', async () => {
    const r = await renameSkill('crud-skill', 'crud-skill-renamed', opts());
    expect(r.newId).toBe('crud-skill-renamed');
    const md = await readSkillFile('crud-skill-renamed', 'library', 'SKILL.md', opts());
    expect(md).toContain('crud-skill-renamed');
    await expect(fs.access(path.join(opts().libraryDir!, 'crud-skill'))).rejects.toThrow();
  });

  it('duplicates with a -copy suffix and Copy display name', async () => {
    const r = await duplicateSkill('crud-skill-renamed', opts());
    expect(r.newId).toBe('crud-skill-renamed-copy');
    const md = await readSkillFile(r.newId, 'library', 'SKILL.md', opts());
    expect(md).toContain('Copy');
  });
});

describe('zip export + import', () => {
  it('round-trips a skill through a zip buffer', async () => {
    const buf = await exportSkillZip('crud-skill-renamed', opts());
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    const tmp = path.join(os.tmpdir(), 'crud-skill-renamed.zip');
    await fs.writeFile(tmp, buf);
    // Same id already in library → conflict...
    await expect(importSkillZip(tmp, opts())).rejects.toThrow(/already exists/);
    // ...and overwrite replaces it cleanly.
    const imported = await importSkillZip(tmp, { ...opts(), overwrite: true });
    expect(imported.newId).toBe('crud-skill-renamed');
    const md = await readSkillFile(imported.newId, 'library', 'SKILL.md', opts());
    expect(md.length).toBeGreaterThan(0);
    await fs.rm(tmp, { force: true });
  });

  it('rejects a zip without SKILL.md', async () => {
    const AdmZip = (await import('adm-zip')).default;
    const bad = new AdmZip();
    bad.addFile('random.txt', Buffer.from('nope'));
    const tmp = path.join(os.tmpdir(), 'bad.zip');
    await fs.writeFile(tmp, bad.toBuffer());
    await expect(importSkillZip(tmp, opts())).rejects.toThrow(/SKILL.md/);
    await fs.rm(tmp, { force: true });
  });
});
