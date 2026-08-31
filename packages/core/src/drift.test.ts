// M071: drift detection — registry-managed entries edited out-of-band in an
// agent's own config file must be detected (named), and agent-local changes
// must never trigger a false positive.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentConfigManager } from './index';
import type { ModelProvider, ModelConfig } from './types';

let tmpHome: string;

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function makeProvider(id: string, baseUrl: string): ModelProvider {
  return {
    id,
    name: id,
    type: 'openai-compatible',
    config: { baseUrl },
    enabled: true,
    priority: 0,
  };
}

function makeModel(id: string, providerId: string): ModelConfig {
  return { id, providerId, name: id, displayName: id, roles: ['chat'] };
}

describe('M071: drift detection (detectDrift)', () => {
  let manager: AgentConfigManager;
  let configPath: string;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-m071-'));
    process.env.HOME = tmpHome;
    process.env.AI_CONFIG_HOME = path.join(tmpHome, '.ai-agent-config');
    manager = new AgentConfigManager();
    await manager.initRegistry();
    configPath = path.join(tmpHome, 'demo', 'settings.json');
    const added = await manager.addCustomAgent({
      id: 'demo',
      name: 'Demo Agent',
      configPath,
      format: 'json',
    });
    expect(added.success).toBe(true);
  });

  afterEach(() => {
    delete process.env.HOME;
    delete process.env.AI_CONFIG_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  async function registerProvider(baseUrl = 'https://api.example.com/v1') {
    const res = await manager.registerProvider(
      makeProvider('acme', baseUrl),
      [makeModel('acme-1', 'acme')],
      ['demo']
    );
    expect(res.success).toBe(true);
  }

  it('no drift when the agent file matches the registry', async () => {
    await registerProvider();
    const drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(false);
    expect(drift.changedProviders).toEqual([]);
    expect(drift.changedServers).toEqual([]);
    expect(drift.error).toBeUndefined();
  });

  it('detects drift when a registry-managed provider is edited in the agent file', async () => {
    await registerProvider();
    const cfg = readJson(configPath);
    cfg.modelProviders[0].config.baseUrl = 'https://evil.example.com/v1';
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    const drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(true);
    expect(drift.changedProviders).toEqual(['acme']);
    expect(drift.changedServers).toEqual([]);
  });

  it('detects drift when a registry-managed provider disappears from the agent file', async () => {
    await registerProvider();
    const cfg = readJson(configPath);
    cfg.modelProviders = [];
    cfg.models = [];
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    const drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(true);
    expect(drift.changedProviders).toEqual(['acme']);
  });

  it('does NOT report drift for agent-local (non-registry-managed) changes', async () => {
    await registerProvider();
    const cfg = readJson(configPath);
    // Add a provider the registry does not manage.
    cfg.modelProviders.push(makeProvider('local-only', 'https://local.example.com/v1'));
    cfg.models.push(makeModel('local-1', 'local-only'));
    // Edit an agent-local top-level key.
    cfg.customSettings = { theme: 'dark' };
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    const drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(false);
    expect(drift.changedProviders).toEqual([]);
    expect(drift.changedServers).toEqual([]);
  });

  it('detects drift when a registry-managed MCP server is edited in the agent file', async () => {
    const reg = await manager.registerMCPServer(
      { name: 'acme-mcp', type: 'stdio', command: 'npx', args: ['-y', 'acme'], env: {}, enabled: true },
      ['demo']
    );
    expect(reg.success).toBe(true);
    const cfg = readJson(configPath);
    cfg.mcpServers[0].command = 'some-other-binary';
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    const drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(true);
    expect(drift.changedServers).toEqual(['acme-mcp']);
    expect(drift.changedProviders).toEqual([]);
  });

  it('detects drift when a registry-managed MCP server disappears from the agent file', async () => {
    const reg = await manager.registerMCPServer(
      { name: 'acme-mcp', type: 'stdio', command: 'npx', args: ['-y', 'acme'], env: {}, enabled: true },
      ['demo']
    );
    expect(reg.success).toBe(true);
    const cfg = readJson(configPath);
    cfg.mcpServers = [];
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    const drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(true);
    expect(drift.changedServers).toEqual(['acme-mcp']);
  });

  it('detect-only agents always report no drift', async () => {
    // omp is the detect-only adapter (no modelProviders / mcpServers support).
    const drift = await manager.detectDrift('omp');
    expect(drift.drifted).toBe(false);
    expect(drift.changedProviders).toEqual([]);
    expect(drift.changedServers).toEqual([]);
    expect(drift.error).toBeUndefined();
  });

  it('reports an error for an unknown agent', async () => {
    const drift = await manager.detectDrift('nope');
    expect(drift.drifted).toBe(false);
    expect(drift.error).toBeDefined();
  });

  it('drift clears after re-materialization (syncAgents)', async () => {
    await registerProvider();
    const cfg = readJson(configPath);
    cfg.modelProviders[0].config.baseUrl = 'https://hacked.example.com/v1';
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

    let drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(true);

    const sync = await manager.syncAgents(['demo']);
    expect(sync.ok).toBe(true);

    drift = await manager.detectDrift('demo');
    expect(drift.drifted).toBe(false);
    const restored = readJson(configPath);
    expect(restored.modelProviders[0].config.baseUrl).toBe('https://api.example.com/v1');
  });
});
