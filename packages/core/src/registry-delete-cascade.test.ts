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
    name: 'Test Provider',
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

describe('provider / MCP delete cascade', () => {
  let manager: AgentConfigManager;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-cascade-'));
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

  async function addDemoAgent(configPath: string) {
    const added = await manager.addCustomAgent({
      id: 'demo',
      name: 'Demo Agent',
      configPath,
      format: 'json',
    });
    expect(added.success).toBe(true);
  }

  it('removes a deleted provider from every affected agent on-disk config', async () => {
    const configPath = path.join(tmpHome, 'demo', 'settings.json');
    await addDemoAgent(configPath);

    const registered = await manager.registerProvider(
      makeProvider('p1'),
      [makeModel('p1')],
      ['demo']
    );
    expect(registered.success).toBe(true);

    // Provider (and its models) are materialized into the agent's on-disk config.
    let cfg = readConfig(configPath);
    expect(cfg.modelProviders?.map((p: any) => p.id)).toContain('p1');
    expect(cfg.models?.map((m: any) => m.providerId)).toContain('p1');

    const deleted = await manager.deleteProvider('p1');
    expect(deleted.success).toBe(true);

    // The provider must be stripped from the on-disk config too, not just the registry.
    cfg = readConfig(configPath);
    expect(cfg.modelProviders?.map((p: any) => p.id)).not.toContain('p1');
    expect(cfg.models?.map((m: any) => m.providerId)).not.toContain('p1');
  });

  it('does not strip an agent-local provider that was never registry-managed', async () => {
    const configPath = path.join(tmpHome, 'demo', 'settings.json');
    await addDemoAgent(configPath);

    // Seed a provider that exists ONLY in the agent config (not in the registry).
    const cfg0 = readConfig(configPath);
    cfg0.modelProviders = cfg0.modelProviders || [];
    cfg0.modelProviders.push(makeProvider('local'));
    cfg0.models = cfg0.models || [];
    cfg0.models.push(makeModel('local'));
    fs.writeFileSync(configPath, JSON.stringify(cfg0, null, 2));

    const registered = await manager.registerProvider(
      makeProvider('p1'),
      [makeModel('p1')],
      ['demo']
    );
    expect(registered.success).toBe(true);

    const deleted = await manager.deleteProvider('p1');
    expect(deleted.success).toBe(true);

    const cfg = readConfig(configPath);
    // Registry-managed provider removed...
    expect(cfg.modelProviders?.map((p: any) => p.id)).not.toContain('p1');
    // ...but the agent-local provider preserved.
    expect(cfg.modelProviders?.map((p: any) => p.id)).toContain('local');
  });

  it('removes a deleted MCP server from every affected agent on-disk config', async () => {
    const configPath = path.join(tmpHome, 'demo', 'settings.json');
    await addDemoAgent(configPath);

    const reg = await manager.registerMCPServer(
      {
        name: 'mcp-files',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: {},
        enabled: true,
      },
      ['demo']
    );
    expect(reg.success).toBe(true);

    const before = readConfig(configPath);
    expect(before.mcpServers?.map((s: any) => s.name)).toContain('mcp-files');

    const deleted = await manager.deleteMCPServer('mcp-files');
    expect(deleted.success).toBe(true);

    const after = readConfig(configPath);
    expect(after.mcpServers?.map((s: any) => s.name)).not.toContain('mcp-files');
  });
});

describe('QA finding M1: addCustomAgent input guards', () => {
  let manager: AgentConfigManager;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-cascade-'));
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

  it('returns a clean error (not a TypeError) when the id is missing', async () => {
    const result = await manager.addCustomAgent({
      name: 'x',
      configPath: path.join(tmpHome, 'x.json'),
    } as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Agent id is required');
  });

  it('returns a clean error when the id is blank', async () => {
    const result = await manager.addCustomAgent({
      id: '   ',
      configPath: path.join(tmpHome, 'x.json'),
    } as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Agent id is required');
  });

  it('returns a clean error when the configPath is missing', async () => {
    const result = await manager.addCustomAgent({
      id: 'demo-m1',
      name: 'Demo',
    } as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Config path is required');
  });
});
