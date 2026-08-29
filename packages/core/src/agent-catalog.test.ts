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
        expect((dir as string).trim().length, `${entry.id} skillsPaths.${platform}`).toBeGreaterThan(0);
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

describe('AgentConfigManager readAgentFile', () => {
  it('returns an OperationResult shape for config and mcp kinds without throwing', async () => {
    const manager = new AgentConfigManager();
    const configResult = await manager.readAgentFile('claude-code', 'config');
    expect(typeof configResult.success).toBe('boolean');
    const mcpResult = await manager.readAgentFile('claude-code', 'mcp');
    expect(typeof mcpResult.success).toBe('boolean');
  });
});
