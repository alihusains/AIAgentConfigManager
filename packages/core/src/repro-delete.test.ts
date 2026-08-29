import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentConfigManager } from './index';
import type { ModelProvider, ModelConfig } from './types';

let tmpHome: string;

function makeProvider(id = 'p1'): ModelProvider {
  return {
    id,
    name: 'icm llm router',
    type: 'openai-compatible',
    config: { baseUrl: 'https://example.com/v1' },
    enabled: true,
    priority: 10,
  };
}

function makeModel(providerId = 'p1'): ModelConfig {
  return {
    id: `${providerId}-model`,
    providerId,
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    roles: ['chat'],
  };
}

function readConfig(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('REPRO: provider delete cascade (multi-agent + remove-from-agent)', () => {
  let manager: AgentConfigManager;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-repro-'));
    process.env.HOME = tmpHome;
    process.env.AI_CONFIG_HOME = path.join(tmpHome, '.ai-agent-config');
    manager = new AgentConfigManager();
    await manager.initRegistry();
  });

  afterEach(() => {
    delete process.env.HOME;
    delete process.env.AI_CONFIG_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  async function addAgent(id: string) {
    const configPath = path.join(tmpHome, `${id}.json`);
    const added = await manager.addCustomAgent({
      id,
      name: `${id} agent`,
      configPath,
      format: 'json',
    });
    expect(added.success).toBe(true);
    return configPath;
  }

  it('SYMPTOM 1: deleteProvider installed in MULTIPLE agents removes it from all', async () => {
    const cfgA = await addAgent('agent-a');
    const cfgB = await addAgent('agent-b');

    const registered = await manager.registerProvider(
      makeProvider('p1'),
      [makeModel('p1')],
      ['agent-a', 'agent-b']
    );
    expect(registered.success).toBe(true);

    // Sanity: provider materialized into BOTH agents.
    expect(readConfig(cfgA).modelProviders?.map((p: any) => p.id)).toContain('p1');
    expect(readConfig(cfgB).modelProviders?.map((p: any) => p.id)).toContain('p1');
    let reg = await manager.getRegistryState();
    expect(reg.providers.find((p) => p.provider.id === 'p1')?.agentIds).toEqual([
      'agent-a',
      'agent-b',
    ]);

    const deleted = await manager.deleteProvider('p1');
    expect(deleted.success).toBe(true);

    // Provider gone from registry.
    reg = await manager.getRegistryState();
    expect(reg.providers.find((p) => p.provider.id === 'p1')).toBeUndefined();
    // Provider stripped from BOTH agents' on-disk configs.
    expect(readConfig(cfgA).modelProviders?.map((p: any) => p.id)).not.toContain('p1');
    expect(readConfig(cfgB).modelProviders?.map((p: any) => p.id)).not.toContain('p1');
  });

  it('SYMPTOM 2: removeProviderFromAgent updates registry agentIds + agent config', async () => {
    const cfgA = await addAgent('agent-solo');

    const registered = await manager.registerProvider(
      makeProvider('icm-llm-router'),
      [makeModel('icm-llm-router')],
      ['agent-solo']
    );
    expect(registered.success).toBe(true);
    expect(readConfig(cfgA).modelProviders?.map((p: any) => p.id)).toContain('icm-llm-router');

    const removed = await manager.removeProviderFromAgent('icm-llm-router', 'agent-solo');
    expect(removed.success).toBe(true);

    // Registry entry still exists but no longer lists agent-solo.
    const reg = await manager.getRegistryState();
    const entry = reg.providers.find((p) => p.provider.id === 'icm-llm-router');
    expect(entry).toBeDefined();
    expect(entry?.agentIds).not.toContain('agent-solo');
    expect(entry?.agentIds).toEqual([]);

    // And the on-disk agent config no longer has the provider.
    expect(readConfig(cfgA).modelProviders?.map((p: any) => p.id)).not.toContain(
      'icm-llm-router'
    );
  });

  it('registry persists removal across a fresh manager instance (saveRegistry wrote)', async () => {
    const _cfgA = await addAgent('agent-solo');
    await manager.registerProvider(makeProvider('icm'), [makeModel('icm')], ['agent-solo']);

    const removed = await manager.removeProviderFromAgent('icm', 'agent-solo');
    expect(removed.success).toBe(true);

    // Re-load from disk with a brand-new manager to prove saveRegistry persisted.
    const fresh = new AgentConfigManager();
    await fresh.initRegistry();
    const reg = await fresh.getRegistryState();
    const entry = reg.providers.find((p) => p.provider.id === 'icm');
    expect(entry?.agentIds ?? []).not.toContain('agent-solo');
  });
});
