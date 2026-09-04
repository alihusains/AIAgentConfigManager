import { describe, it, expect } from 'vitest';
import {
  parseSkillFrontmatterSpec,
  validateSkillSpec,
  SKILL_NAME_MAX,
  SKILL_DESCRIPTION_MAX,
} from './skill-spec';

describe('parseSkillFrontmatterSpec', () => {
  it('parses the minimal spec example', () => {
    const md = `---
name: skill-name
description: A description of what this skill does and when to use it.
---
# Body`;
    const fm = parseSkillFrontmatterSpec(md);
    expect(fm.name).toBe('skill-name');
    expect(fm.description).toBe('A description of what this skill does and when to use it.');
  });

  it('parses all spec fields including a metadata map', () => {
    const md = `---
name: pdf-processing
description: Extract PDF text, fill forms, merge files.
license: Apache-2.0
compatibility: Requires git, docker, jq, and access to the internet
metadata:
  author: example-org
  version: "1.0"
allowed-tools: Bash(git:*) Bash(jq:*) Read
---
body`;
    const fm = parseSkillFrontmatterSpec(md);
    expect(fm.name).toBe('pdf-processing');
    expect(fm.license).toBe('Apache-2.0');
    expect(fm.compatibility).toContain('docker');
    expect(fm.metadata).toEqual({ author: 'example-org', version: '1.0' });
    expect(fm.allowedTools).toEqual(['Bash(git:*)', 'Bash(jq:*)', 'Read']);
  });

  it('tolerates unquoted colons in values (spec lenient-parsing guidance)', () => {
    const md = `---
name: colon-skill
description: Use this skill when: the task looks ambiguous
---
x`;
    const fm = parseSkillFrontmatterSpec(md);
    expect(fm.description).toBe('Use this skill when: the task looks ambiguous');
  });

  it('returns {} for files without frontmatter', () => {
    expect(parseSkillFrontmatterSpec('just markdown')).toEqual({});
    expect(parseSkillFrontmatterSpec('')).toEqual({});
  });

  it('captures unknown keys as extras', () => {
    const md = `---
name: extra
description: d
custom-field: hello
---
`;
    const fm = parseSkillFrontmatterSpec(md);
    expect(fm.extras?.['custom-field']).toBe('hello');
  });
});

describe('validateSkillSpec', () => {
  it('ok for a fully valid skill', () => {
    const v = validateSkillSpec(
      { name: 'pdf-processing', description: 'Extracts PDF text.' },
      'pdf-processing'
    );
    expect(v).toEqual({ ok: true, loadable: true, diagnostics: [] });
  });

  it('error (skip) when description is missing', () => {
    const v = validateSkillSpec({ name: 'a-valid-name' }, 'a-valid-name');
    expect(v.loadable).toBe(false);
    expect(v.diagnostics[0]).toMatchObject({ level: 'error', code: 'missing-description' });
  });

  it('error (skip) when name is missing', () => {
    const v = validateSkillSpec({ description: 'd' }, 'folder');
    expect(v.loadable).toBe(false);
    expect(v.diagnostics[0].code).toBe('missing-name');
  });

  it('warn (load anyway) on name/folder mismatch', () => {
    const v = validateSkillSpec(
      { name: 'wrong-name', description: 'd' },
      'right-name'
    );
    expect(v.loadable).toBe(true);
    expect(v.diagnostics.map((d) => d.code)).toContain('name-mismatch');
  });

  it('warn on name pattern violations (uppercase, edge hyphens, consecutive hyphens)', () => {
    for (const [name, code] of [
      ['PDF-Processing', 'name-invalid-chars'],
      ['-pdf', 'name-edge-hyphen'],
      ['pdf--processing', 'name-consecutive-hyphens'],
    ] as const) {
      const v = validateSkillSpec({ name, description: 'd' }, name);
      expect(v.loadable).toBe(true);
      expect(v.diagnostics.map((d) => d.code)).toContain(code);
    }
  });

  it('warn when name exceeds 64 chars', () => {
    const name = 'a'.repeat(SKILL_NAME_MAX + 1);
    const v = validateSkillSpec({ name, description: 'd' }, name);
    expect(v.diagnostics.map((d) => d.code)).toContain('name-too-long');
  });

  it('warn when description exceeds 1024 chars', () => {
    const v = validateSkillSpec(
      { name: 'ok-name', description: 'x'.repeat(SKILL_DESCRIPTION_MAX + 1) },
      'ok-name'
    );
    expect(v.diagnostics.map((d) => d.code)).toContain('description-too-long');
  });

  it('warn when compatibility exceeds 500 chars', () => {
    const v = validateSkillSpec(
      { name: 'ok-name', description: 'd', compatibility: 'y'.repeat(501) },
      'ok-name'
    );
    expect(v.diagnostics.map((d) => d.code)).toContain('compatibility-too-long');
  });
});
