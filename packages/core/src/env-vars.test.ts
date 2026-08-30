/**
 * Tests for the environment-variables module (env-vars.ts):
 * shell-profile parsing, redaction, and safe non-destructive profile edits.
 *
 * ALL filesystem work happens in a temp directory — no real dotfiles are ever
 * read or written. The module resolves the home directory at call time via
 * `os.homedir()`, which honors $HOME on this platform, so pointing HOME at a
 * temp dir fully isolates the tests.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isSensitiveName,
  maskSecret,
  parseShellProfile,
  updateProfileContent,
  removeProfileContent,
  defaultProfileFile,
  listEnvVars,
  revealEnvVar,
  setEnvVar,
  removeEnvVar,
} from './env-vars';

let tmpHome: string;
let prevHome: string | undefined;
let prevZshrc: string | undefined;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'acm-envvars-'));
  prevHome = process.env.HOME;
  prevZshrc = process.env.MY_TEST_VAR;
  process.env.HOME = tmpHome;
});

afterEach(async () => {
  if (prevHome !== undefined) process.env.HOME = prevHome;
  else delete process.env.HOME;
  if (prevZshrc !== undefined) process.env.MY_TEST_VAR = prevZshrc;
  else delete process.env.MY_TEST_VAR;
  await fs.rm(tmpHome, { recursive: true, force: true });
});

async function writeZshrc(content: string): Promise<string> {
  const file = path.join(tmpHome, '.zshrc');
  await fs.writeFile(file, content, 'utf-8');
  return file;
}

const REALISTIC_ZSHRC = [
  '# ~/.zshrc — user shell config',
  '',
  'export PATH="$HOME/bin:$PATH"',
  'export EDITOR=vim',
  'MY_TEST_VAR=plain-value',
  '# a comment that looks like an assignment: export FAKE=comment',
  'export MY_SECRET_KEY=sk-supersecret123ab12',
  '',
  'alias ll="ls -la"',
  'function hello() { echo hi; }',
  'eval "$(starship init zsh)"',
  '',
].join('\n');

describe('parseShellProfile', () => {
  it('parses export and bare assignments, skips comments and shell code', () => {
    const vars = parseShellProfile('/fake/.zshrc', REALISTIC_ZSHRC);
    expect(vars.get('PATH')).toBe('$HOME/bin:$PATH');
    expect(vars.get('EDITOR')).toBe('vim');
    expect(vars.get('MY_TEST_VAR')).toBe('plain-value');
    expect(vars.get('MY_SECRET_KEY')).toBe('sk-supersecret123ab12');
    // Comments, aliases, functions, and eval lines are not assignments.
    expect(vars.has('FAKE')).toBe(false);
    expect(vars.has('ll')).toBe(false);
    expect(vars.has('hello')).toBe(false);
    expect(vars.has('eval')).toBe(false);
  });

  it('strips matching surrounding quotes', () => {
    const vars = parseShellProfile(
      '/fake/.zshrc',
      ['export A="quoted value"', "B='single'"].join('\n')
    );
    expect(vars.get('A')).toBe('quoted value');
    expect(vars.get('B')).toBe('single');
  });

  it('skips values with command substitution (not safely re-emittable)', () => {
    const vars = parseShellProfile('/fake/.zshrc', 'C=$(pwd)\nD=`date`\nE=ok\n');
    expect(vars.has('C')).toBe(false);
    expect(vars.has('D')).toBe(false);
    expect(vars.get('E')).toBe('ok');
  });
});

describe('isSensitiveName / maskSecret', () => {
  it('flags secret-looking names case-insensitively', () => {
    expect(isSensitiveName('OPENAI_API_KEY')).toBe(true);
    expect(isSensitiveName('gh_token')).toBe(true);
    expect(isSensitiveName('DB_PASSWORD')).toBe(true);
    expect(isSensitiveName('aws_secret_access_key')).toBe(true);
    expect(isSensitiveName('MY_CREDENTIALS')).toBe(true);
    expect(isSensitiveName('PATH')).toBe(false);
    expect(isSensitiveName('EDITOR')).toBe(false);
  });

  it('masks long values as first 3 + last 4', () => {
    expect(maskSecret('sk-supersecret123ab12')).toBe('sk-...ab12');
  });

  it('fully hides short values', () => {
    expect(maskSecret('abc')).toBe('••••••••');
    expect(maskSecret('12345678')).toBe('••••••••');
  });
});

describe('updateProfileContent', () => {
  it('appends a new variable without disturbing existing content', async () => {
    const file = await writeZshrc(REALISTIC_ZSHRC);
    const before = await fs.readFile(file, 'utf-8');
    const updated = updateProfileContent(before, 'NEW_VAR', 'new-value');
    // Pure append: the original bytes are a strict prefix.
    expect(updated.startsWith(before)).toBe(true);
    expect(parseShellProfile(file, updated)).toEqual(
      new Map([...parseShellProfile(file, before), ['NEW_VAR', 'new-value']])
    );
  });

  it('updates an existing line in place', async () => {
    const original = [
      'export EDITOR=vim',
      'export OTHER=stay',
      'export EDITOR=nano', // last assignment wins
    ].join('\n');
    const updated = updateProfileContent(original, 'EDITOR', 'code');
    const lines = updated.split('\n');
    expect(lines[0]).toBe('export EDITOR=vim'); // first occurrence untouched
    expect(lines[1]).toBe('export OTHER=stay');
    expect(lines[2]).toBe("export EDITOR='code'"); // last occurrence updated
    expect(lines.length).toBe(3);
  });

  it('appends a newline to files that do not end with one', () => {
    const updated = updateProfileContent('export A=1', 'B', '2');
    expect(updated).toBe("export A=1\nexport B='2'\n");
  });

  it('escapes single quotes in the value', () => {
    const updated = updateProfileContent('', 'Q', "it's");
    expect(updated).toBe("export Q='it'\\''s'\n");
  });
});

describe('removeProfileContent', () => {
  it('removes only the targeted line', () => {
    const { content, removed } = removeProfileContent(REALISTIC_ZSHRC, 'MY_SECRET_KEY');
    expect(removed).toBe(true);
    expect(content).toContain('export EDITOR=vim');
    expect(content).toContain('MY_TEST_VAR=plain-value');
    expect(content).not.toContain('MY_SECRET_KEY');
  });

  it('reports removed=false when the name is absent', () => {
    const { content, removed } = removeProfileContent(REALISTIC_ZSHRC, 'NO_SUCH_VAR');
    expect(removed).toBe(false);
    expect(content).toBe(REALISTIC_ZSHRC);
  });
});

describe('defaultProfileFile', () => {
  it('picks .zshrc for zsh shells', () => {
    expect(defaultProfileFile('/h', '/bin/zsh').endsWith('.zshrc')).toBe(true);
    expect(defaultProfileFile('/h', '/usr/local/bin/zsh').endsWith('.zshrc')).toBe(true);
  });
  it('picks .bashrc for bash shells', () => {
    expect(defaultProfileFile('/h', '/bin/bash').endsWith('.bashrc')).toBe(true);
  });
  it('falls back to $SHELL when no shell argument is given', () => {
    const shell = process.env.SHELL || '';
    const expected = shell.toLowerCase().includes('bash') ? '.bashrc' : '.zshrc';
    expect(defaultProfileFile('/h', undefined)).toBe(path.join('/h', expected));
  });
});

describe('listEnvVars (macOS/Linux, temp HOME)', () => {
  it('merges process env and profile vars, preferring the profile source', async () => {
    await writeZshrc('export MERGED_VAR=from-profile\nexport PROFILE_ONLY=pp\n');
    process.env.MERGED_VAR = 'from-process';
    const entries = await listEnvVars({ platform: 'linux' });
    const byName = new Map(entries.map((e) => [e.name, e]));

    const merged = byName.get('MERGED_VAR');
    expect(merged).toBeDefined();
    expect(merged!.source).toBe('shell-profile');
    expect(merged!.sourceFile).toBe(path.join(tmpHome, '.zshrc'));
    // Sensitive? No — but value is the profile one, unredacted.
    expect(merged!.value).toBe('from-profile');
    expect(merged!.editable).toBe(true);

    const profileOnly = byName.get('PROFILE_ONLY');
    expect(profileOnly!.source).toBe('shell-profile');
    expect(profileOnly!.value).toBe('pp');
  });

  it('marks process-only vars as non-editable with an explanatory note', async () => {
    await writeZshrc('export PROFILE_ONLY=pp\n');
    // MY_TEST_VAR is in the real environment (set by this test runner's env
    // or inherited) but not in the temp profile.
    process.env.PROCESS_ONLY_TEST = 'proc';
    const entries = await listEnvVars({ platform: 'linux' });
    const e = entries.find((x) => x.name === 'PROCESS_ONLY_TEST');
    expect(e).toBeDefined();
    expect(e!.source).toBe('process');
    expect(e!.editable).toBe(false);
    expect(e!.note).toMatch(/not in any shell profile/i);
    delete process.env.PROCESS_ONLY_TEST;
  });

  it('redacts sensitive-looking values by default', async () => {
    await writeZshrc('export MY_SECRET_KEY=sk-supersecret123ab12\n');
    const entries = await listEnvVars({ platform: 'linux' });
    const e = entries.find((x) => x.name === 'MY_SECRET_KEY');
    expect(e).toBeDefined();
    expect(e!.looksSensitive).toBe(true);
    expect(e!.value).toBe('sk-...ab12');
    expect(e!.value).not.toContain('supersecret');
  });

  it('leaves non-sensitive values unredacted', async () => {
    await writeZshrc('export EDITOR=vim\n');
    const entries = await listEnvVars({ platform: 'linux' });
    const e = entries.find((x) => x.name === 'EDITOR');
    expect(e!.value).toBe('vim');
  });
});

describe('revealEnvVar (macOS/Linux, temp HOME)', () => {
  it('returns the real value for a redacted variable', async () => {
    await writeZshrc('export MY_SECRET_KEY=sk-supersecret123ab12\n');
    const revealed = await revealEnvVar('MY_SECRET_KEY', { platform: 'linux' });
    expect(revealed).toBe('sk-supersecret123ab12');
  });

  it('falls back to the process environment', async () => {
    process.env.REVEAL_PROC_ONLY = 'proc-value';
    const revealed = await revealEnvVar('REVEAL_PROC_ONLY', { platform: 'linux' });
    expect(revealed).toBe('proc-value');
    delete process.env.REVEAL_PROC_ONLY;
  });

  it('returns null for unknown names', async () => {
    const revealed = await revealEnvVar('DEFINITELY_NOT_SET_XYZ', { platform: 'linux' });
    expect(revealed).toBeNull();
  });
});

describe('setEnvVar (macOS/Linux, temp HOME)', () => {
  it('appends a new line without disturbing existing content', async () => {
    const file = await writeZshrc(REALISTIC_ZSHRC);
    const before = await fs.readFile(file, 'utf-8');
    const result = await setEnvVar('ADDED_VAR', 'added-value', { platform: 'linux' });
    expect(result.ok).toBe(true);
    const after = await fs.readFile(file, 'utf-8');
    // The variable must land in the shell-appropriate default profile for
    // brand-new vars (this machine's $SHELL decides zsh vs bash).
    const shell = (process.env.SHELL || '').toLowerCase();
    const target = path.join(tmpHome, shell.includes('bash') ? '.bashrc' : '.zshrc');
    const targetContent = target === file ? after : await fs.readFile(target, 'utf-8');
    expect(targetContent).toContain("export ADDED_VAR='added-value'");
    const vars = parseShellProfile(target, targetContent);
    expect(vars.get('ADDED_VAR')).toBe('added-value');
    // The pre-existing profile file is byte-for-byte untouched.
    if (target !== file) {
      expect(after).toBe(before);
    } else {
      expect(after.startsWith(before)).toBe(true);
    }
    expect(parseShellProfile(file, after).get('EDITOR')).toBe('vim');
  });

  it('updates an existing line in place', async () => {
    const file = await writeZshrc('export EDITOR=vim\nexport OTHER=stay\n');
    const result = await setEnvVar('EDITOR', 'code', { platform: 'linux' });
    expect(result.ok).toBe(true);
    const after = await fs.readFile(file, 'utf-8');
    expect(after).toBe("export EDITOR='code'\nexport OTHER=stay\n");
  });

  it('rejects invalid names without touching any file', async () => {
    const file = await writeZshrc('export A=1\n');
    const before = await fs.readFile(file, 'utf-8');
    const result = await setEnvVar('BAD NAME!', 'x', { platform: 'linux' });
    expect(result.ok).toBe(false);
    expect(await fs.readFile(file, 'utf-8')).toBe(before);
  });

  it('writes a brand-new var to the shell-appropriate default profile', async () => {
    // No profiles exist yet; SHELL is zsh on this machine (or defaults to zsh).
    const result = await setEnvVar('FRESH_VAR', 'fresh', { platform: 'linux' });
    expect(result.ok).toBe(true);
    const shell = (process.env.SHELL || '').toLowerCase();
    const expected = path.join(tmpHome, shell.includes('bash') ? '.bashrc' : '.zshrc');
    const content = await fs.readFile(expected, 'utf-8');
    expect(content).toContain("export FRESH_VAR='fresh'");
  });

  // M058: a variable that exists ONLY in process.env (no shell profile backs
  // it) is reported read-only by listEnvVars, but setEnvVar adopts it into the
  // default profile file — after which listEnvVars reports it as
  // shell-profile-backed and editable. This exercises the exact "Edit
  // anyway (add to profile)" path the GUI offers for process-only rows.
  it('adopts a process-only var into the default profile (M058)', async () => {
    await writeZshrc('export PROFILE_ONLY=pp\n');
    process.env.PROCESS_ONLY_ADOPT = 'proc-value';

    // Before the write: process-only, not editable.
    const before = await listEnvVars({ platform: 'linux' });
    const beforeEntry = before.find((e) => e.name === 'PROCESS_ONLY_ADOPT');
    expect(beforeEntry).toBeDefined();
    expect(beforeEntry!.source).toBe('process');
    expect(beforeEntry!.editable).toBe(false);

    // The adopt write: appends an export line to the shell-appropriate
    // default profile (same file-selection logic as a brand-new var).
    const result = await setEnvVar('PROCESS_ONLY_ADOPT', 'adopted-value', {
      platform: 'linux',
    });
    expect(result.ok).toBe(true);
    const shell = (process.env.SHELL || '').toLowerCase();
    const target = path.join(tmpHome, shell.includes('bash') ? '.bashrc' : '.zshrc');
    const content = await fs.readFile(target, 'utf-8');
    expect(content).toContain("export PROCESS_ONLY_ADOPT='adopted-value'");

    // After the write: the same name is now shell-profile-backed and
    // editable — no signature change, purely a state transition.
    const after = await listEnvVars({ platform: 'linux' });
    const afterEntry = after.find((e) => e.name === 'PROCESS_ONLY_ADOPT');
    expect(afterEntry).toBeDefined();
    expect(afterEntry!.source).toBe('shell-profile');
    expect(afterEntry!.sourceFile).toBe(target);
    expect(afterEntry!.editable).toBe(true);
    // Sensitive-looking? No — the unredacted value is the profile one.
    expect(afterEntry!.value).toBe('adopted-value');

    delete process.env.PROCESS_ONLY_ADOPT;
  });
});

describe('removeEnvVar (macOS/Linux, temp HOME)', () => {
  it('removes only the targeted line', async () => {
    const file = await writeZshrc(REALISTIC_ZSHRC);
    const result = await removeEnvVar('MY_SECRET_KEY', { platform: 'linux' });
    expect(result.ok).toBe(true);
    const after = await fs.readFile(file, 'utf-8');
    expect(after).not.toContain('MY_SECRET_KEY');
    expect(after).toContain('export EDITOR=vim');
    expect(after).toContain('MY_TEST_VAR=plain-value');
    expect(after).toContain('alias ll="ls -la"');
  });

  it('fails cleanly when the var is not in any profile', async () => {
    await writeZshrc('export EDITOR=vim\n');
    const result = await removeEnvVar('NOT_IN_PROFILE_XYZ', { platform: 'linux' });
    expect(result.ok).toBe(false);
    expect(result.warning).toMatch(/not set in any shell profile/i);
  });
});
