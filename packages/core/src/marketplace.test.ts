/**
 * Tests for the skill marketplace (marketplace.ts): listing, caching,
 * install safety and rate-limit errors. All GitHub calls go through an
 * injected mock fetch — no real network access in the automated suite.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  __setMarketplaceFetch,
  __clearMarketplaceCache,
  listMarketplaceSkills,
  fetchMarketplaceSkillContent,
  installMarketplaceSkill,
  MarketplaceRateLimitError,
} from './marketplace';

const SKILL_MD = [
  '---',
  'name: engineering-code-review',
  'version: 1.0.0',
  'description: "A prioritised code review procedure."',
  '---',
  '',
  '# Code review',
  '',
  'Body text.',
].join('\n');

const MANIFEST = {
  'engineering-code-review': {
    name: 'engineering-code-review',
    department: 'engineering',
    description: 'A prioritised code review procedure.',
    version: '1.0.0',
    hash: 'c85b3d37b25f',
  },
  'data-analytics-sql-review': {
    name: 'data-analytics-sql-review',
    department: 'data-analytics',
    description: 'Reviews analytical SQL for correctness and cost.',
    version: '1.0.0',
    hash: '9cc2a12c2f71',
  },
};

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Mock fetch matching the real endpoints the module uses:
 *   - raw.githubusercontent.com/.../.skills-manifest.json (listing)
 *   - api.github.com/repos/.../contents/<sourcePath> (skill folder listing)
 *   - raw.githubusercontent.com/.../<sourcePath>/<file> (file contents)
 */
function makeFetch(overrides?: { rateLimitContents?: boolean }) {
  const calls: string[] = [];
  const fn = async (url: string): Promise<Response> => {
    calls.push(url);
    if (url.includes('.skills-manifest.json')) {
      return new Response(jsonBody(MANIFEST), { status: 200 });
    }
    if (url.includes('/contents/')) {
      if (overrides?.rateLimitContents) {
        return new Response(jsonBody({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: { 'x-ratelimit-reset': '1900000000' },
        });
      }
      const sourcePath = decodeURIComponent(url.split('/contents/')[1]);
      const entries = [
        {
          name: 'SKILL.md',
          path: `${sourcePath}/SKILL.md`,
          type: 'file',
          download_url: `https://raw.githubusercontent.com/alihusains/enterprise-skills/main/${sourcePath}/SKILL.md`,
        },
        {
          name: 'example.md',
          path: `${sourcePath}/example.md`,
          type: 'file',
          download_url: `https://raw.githubusercontent.com/alihusains/enterprise-skills/main/${sourcePath}/example.md`,
        },
        { name: 'subdir', path: `${sourcePath}/subdir`, type: 'dir', download_url: null },
      ];
      return new Response(jsonBody(entries), { status: 200 });
    }
    // raw file content
    if (url.endsWith('/SKILL.md')) {
      return new Response(SKILL_MD, { status: 200 });
    }
    return new Response('# Example\n\nCompanion file contents.', { status: 200 });
  };
  return { fn, calls };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acm-marketplace-'));
  __clearMarketplaceCache();
});

afterEach(async () => {
  __setMarketplaceFetch(null);
  __clearMarketplaceCache();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('listMarketplaceSkills', () => {
  it('parses the manifest into summaries with correct paths and urls', async () => {
    const { fn, calls } = makeFetch();
    __setMarketplaceFetch(fn as never);

    const skills = await listMarketplaceSkills();
    expect(skills.map((s) => s.id).sort()).toEqual([
      'data-analytics-sql-review',
      'engineering-code-review',
    ]);
    const codeReview = skills.find((s) => s.id === 'engineering-code-review')!;
    expect(codeReview.name).toBe('engineering-code-review');
    expect(codeReview.description).toBe('A prioritised code review procedure.');
    expect(codeReview.sourceRepo).toBe('alihusains/enterprise-skills');
    expect(codeReview.sourcePath).toBe(
      'skills/engineering/engineering-code-review'
    );
    expect(codeReview.htmlUrl).toBe(
      'https://github.com/alihusains/enterprise-skills/tree/main/skills/engineering/engineering-code-review'
    );
    // Listing is one manifest fetch — no per-skill API drilling.
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('.skills-manifest.json');
  });

  it('caches within the TTL — a second call does not re-fetch', async () => {
    const { fn, calls } = makeFetch();
    __setMarketplaceFetch(fn as never);

    await listMarketplaceSkills();
    await listMarketplaceSkills();
    expect(calls.length).toBe(1);
  });

  it('force: true bypasses the cache', async () => {
    const { fn, calls } = makeFetch();
    __setMarketplaceFetch(fn as never);

    await listMarketplaceSkills();
    await listMarketplaceSkills({ force: true });
    expect(calls.length).toBe(2);
  });

  it('a rate-limited manifest fetch produces a clear rate-limit error', async () => {
    __setMarketplaceFetch(
      (async () =>
        new Response(jsonBody({ message: 'API rate limit exceeded' }), {
          status: 403,
          headers: { 'x-ratelimit-reset': '1900000000' },
        })) as never
    );
    await expect(listMarketplaceSkills()).rejects.toBeInstanceOf(
      MarketplaceRateLimitError
    );
    await expect(listMarketplaceSkills()).rejects.toThrow(/rate limit reached/i);
  });

  it('a network failure produces a clear error, not a crash or fabricated list', async () => {
    __setMarketplaceFetch(
      (async () => {
        throw new TypeError('fetch failed');
      }) as never
    );
    await expect(listMarketplaceSkills()).rejects.toThrow(/network unreachable/i);
  });
});

describe('fetchMarketplaceSkillContent', () => {
  it('returns the skill files for a known id', async () => {
    const { fn } = makeFetch();
    __setMarketplaceFetch(fn as never);

    const result = await fetchMarketplaceSkillContent('engineering-code-review');
    expect(result).not.toBeNull();
    const paths = result!.files.map((f) => f.path).sort();
    expect(paths).toEqual(['SKILL.md', 'example.md']);
    expect(result!.files.find((f) => f.path === 'SKILL.md')!.content).toBe(SKILL_MD);
  });

  it('returns null for an unknown id', async () => {
    const { fn } = makeFetch();
    __setMarketplaceFetch(fn as never);
    expect(await fetchMarketplaceSkillContent('nope')).toBeNull();
  });

  it('rejects unsafe ids before any fetch', async () => {
    const { fn, calls } = makeFetch();
    __setMarketplaceFetch(fn as never);
    await expect(fetchMarketplaceSkillContent('../escape')).rejects.toThrow(
      /Invalid skill id/
    );
    expect(calls.length).toBe(0);
  });

  it('a rate-limited contents response produces a rate-limit error, not a retry loop', async () => {
    const { fn, calls } = makeFetch({ rateLimitContents: true });
    __setMarketplaceFetch(fn as never);

    await expect(
      fetchMarketplaceSkillContent('engineering-code-review')
    ).rejects.toBeInstanceOf(MarketplaceRateLimitError);
    // Exactly one attempt — no silent retries.
    const contentsCalls = calls.filter((c) => c.includes('/contents/'));
    expect(contentsCalls.length).toBe(1);
  });
});

describe('installMarketplaceSkill', () => {
  it('writes the skill folder into the library and parses it like a local skill', async () => {
    const { fn } = makeFetch();
    __setMarketplaceFetch(fn as never);

    const { targetPath } = await installMarketplaceSkill('engineering-code-review', {
      libraryDir: tmpDir,
    });
    expect(targetPath).toBe(path.join(tmpDir, 'engineering-code-review'));
    const written = await fs.readFile(path.join(targetPath, 'SKILL.md'), 'utf8');
    expect(written).toBe(SKILL_MD);
    const example = await fs.readFile(path.join(targetPath, 'example.md'), 'utf8');
    expect(example).toContain('Companion file contents.');
  });

  it('refuses to silently overwrite an existing local skill', async () => {
    const { fn } = makeFetch();
    __setMarketplaceFetch(fn as never);

    const existingDir = path.join(tmpDir, 'engineering-code-review');
    await fs.mkdir(existingDir, { recursive: true });
    await fs.writeFile(
      path.join(existingDir, 'SKILL.md'),
      '---\nname: Local Version\n---\nLocal body\n',
      'utf8'
    );

    await expect(
      installMarketplaceSkill('engineering-code-review', { libraryDir: tmpDir })
    ).rejects.toThrow(/already exists/);
    // The local copy is untouched.
    const untouched = await fs.readFile(
      path.join(existingDir, 'SKILL.md'),
      'utf8'
    );
    expect(untouched).toContain('Local Version');
  });

  it('overwrite: true replaces the existing skill', async () => {
    const { fn } = makeFetch();
    __setMarketplaceFetch(fn as never);

    const existingDir = path.join(tmpDir, 'engineering-code-review');
    await fs.mkdir(existingDir, { recursive: true });
    await fs.writeFile(path.join(existingDir, 'SKILL.md'), '---\nname: Local\n---\n', 'utf8');

    const { targetPath } = await installMarketplaceSkill('engineering-code-review', {
      libraryDir: tmpDir,
      overwrite: true,
    });
    const written = await fs.readFile(path.join(targetPath, 'SKILL.md'), 'utf8');
    expect(written).toBe(SKILL_MD);
  });

  it('rejects unknown ids with a clear error', async () => {
    const { fn } = makeFetch();
    __setMarketplaceFetch(fn as never);
    await expect(
      installMarketplaceSkill('nope', { libraryDir: tmpDir })
    ).rejects.toThrow(/not found in marketplace/);
  });

  it('rejects unsafe ids before any fetch', async () => {
    const { fn, calls } = makeFetch();
    __setMarketplaceFetch(fn as never);
    await expect(
      installMarketplaceSkill('../escape', { libraryDir: tmpDir })
    ).rejects.toThrow(/Invalid skill id/);
    expect(calls.length).toBe(0);
  });
});
