
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  listMarketplaceSources,
  addMarketplaceSource,
  removeMarketplaceSource,
  getMarketplaceSourcesPath,
  __setMarketplaceFetch,
  __clearMarketplaceCache,
  listMarketplaceSkills,
  checkMarketplaceUpdates,
  MARKETPLACE_SOURCE_REPO,
} from './marketplace.js';

let home: string;
const registryPath = () => path.join(home, 'registry.json');

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'mkt-p3-'));
  __clearMarketplaceCache();
});

afterEach(async () => {
  __setMarketplaceFetch(null);
  __clearMarketplaceCache();
  await fs.rm(home, { recursive: true, force: true });
});

const json = (v: unknown) =>
  new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('marketplace sources persistence', () => {
  it('defaults to the built-in source with no file', async () => {
    const { sources } = await listMarketplaceSources(registryPath());
    expect(sources.map((s) => s.repo)).toEqual([MARKETPLACE_SOURCE_REPO]);
  });

  it('adds and removes user sources', async () => {
    await addMarketplaceSource('acme/skills-monorepo', { registryPath: registryPath(), subdir: 'library' });
    let { sources } = await listMarketplaceSources(registryPath());
    expect(sources.map((s) => s.repo)).toContain('acme/skills-monorepo');
    expect(sources.find((s) => s.repo === 'acme/skills-monorepo')?.subdir).toBe('library');

    await removeMarketplaceSource('acme/skills-monorepo', registryPath());
    ({ sources } = await listMarketplaceSources(registryPath()));
    expect(sources.map((s) => s.repo)).not.toContain('acme/skills-monorepo');
  });

  it('rejects malformed repos and duplicates', async () => {
    await expect(addMarketplaceSource('no-slash', { registryPath: registryPath() })).rejects.toThrow(
      /Invalid repo/
    );
    await addMarketplaceSource('acme/dup', { registryPath: registryPath() });
    await expect(addMarketplaceSource('acme/dup', { registryPath: registryPath() })).rejects.toThrow(
      /already configured/
    );
  });
});

describe('per-source listing', () => {
  it('reads the manifest of the requested source', async () => {
    const urls: string[] = [];
    __setMarketplaceFetch(((url: string) => {
      urls.push(String(url));
      return json({ 'some-skill': { name: 'some-skill', description: 'd', version: '2.0.0' } });
    }) as never);
    const skills = await listMarketplaceSkills({ source: 'acme/other', subdir: 'library' });
    expect(skills[0].sourceRepo).toBe('acme/other');
    expect(skills[0].sourcePath).toBe('library//some-skill'.replace('//', '/'));
    expect(skills[0].version).toBe('2.0.0');
    expect(urls[0]).toContain('githubusercontent.com/acme/other/');
  });
});

describe('update checks', () => {
  it('flags installed skills whose source-version differs', async () => {
    // Install an "old" skill manually into the library.
    const lib = path.join(home, 'library');
    await fs.mkdir(path.join(lib, 'skill-a'), { recursive: true });
    await fs.writeFile(
      path.join(lib, 'skill-a', 'SKILL.md'),
      '---\nname: skill-a\ndescription: d\nmetadata:\n  source-repo: "acme/other"\n  source-version: "1.0.0"\n---\nbody',
      'utf8'
    );
    __setMarketplaceFetch(((url: string) => {
      if (String(url).includes('acme/other')) {
        return json({ 'skill-a': { name: 'skill-a', version: '2.0.0' } });
      }
      return json({});
    }) as never);
    const updates = await checkMarketplaceUpdates({ libraryDir: lib });
    const a = updates.find((u) => u.skillId === 'skill-a');
    expect(a?.hasUpdate).toBe(true);
    expect(a?.latestVersion).toBe('2.0.0');
  });
});
