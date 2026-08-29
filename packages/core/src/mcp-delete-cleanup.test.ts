// M053 regression tests: MCP server deletion must clean up the agent's real
// config file, and must not report success when it cannot be verified.
//
// QA finding H4 (docs/audits/qa-pass.md): after DELETE /api/mcp/:name returned
// ok:true, the server entry remained in ~/.claude/settings.json mcpServers.
// The claude-code adapter's writeConfig starts from its cached RAW settings
// (to preserve unknown keys) and only MERGES the unified mcpServers list on
// top — it never removes names that are no longer in the list. Materialize
// filters the unified list, so the deleted name was dropped from the unified
// model but the stale raw entry survived the write.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentConfigManager } from './index';
import type { MCPServerConfig } from './types';

let tmpHome: string;

function makeServer(name: string): MCPServerConfig {
  return {
    name,
    type: 'stdio',
    command: 'npx',
    args: ['-y', `@modelcontextprotocol/server-${name}`],
    env: {},
    enabled: true,
  };
}

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

describe('M053: MCP delete cleans up agent config files (QA H4)', () => {
  let manager: AgentConfigManager;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-m053-'));
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

  it('QA H4 repro: deleting a server installed in claude-code removes it from the real settings.json', async () => {
    const claudeDir = path.join(tmpHome, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const settingsPath = path.join(claudeDir, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          env: {},
          mcpServers: {
            'qa-fake-mcp': {
              type: 'stdio',
              command: 'node',
              args: ['/opt/qa-fake-mcp/server.js'],
            },
          },
        },
        null,
        2
      )
    );

    // The server is installed on claude-code (registry + materialized file).
    const reg = await manager.registerMCPServer(
      {
        name: 'qa-fake-mcp',
        type: 'stdio',
        command: 'node',
        args: ['/opt/qa-fake-mcp/server.js'],
        env: {},
        enabled: true,
      },
      ['claude-code']
    );
    expect(reg.success).toBe(true);
    expect(readJson(settingsPath).mcpServers['qa-fake-mcp']).toBeDefined();

    const deleted = await manager.deleteMCPServer('qa-fake-mcp');
    expect(deleted.success).toBe(true);
    expect(deleted.warnings).toBeUndefined();

    // Registry: gone.
    const state = await manager.getRegistryState();
    expect(state.mcpServers.find((s) => s.server.name === 'qa-fake-mcp')).toBeUndefined();
    // Real agent file: gone from mcpServers (the QA H4 symptom).
    expect(JSON.stringify(readJson(settingsPath).mcpServers || {})).not.toContain('qa-fake-mcp');
  });

  it('deleting a server installed in a keyed-shape agent (pi) removes it from the real file', async () => {
    const piDir = path.join(tmpHome, '.pi', 'agent');
    fs.mkdirSync(piDir, { recursive: true });
    // Pi keeps MCP servers in a separate keyed file: ~/.pi/agent/mcp.json
    const mcpPath = path.join(piDir, 'mcp.json');
    fs.writeFileSync(
      mcpPath,
      JSON.stringify(
        {
          mcpServers: {
            'mcp-files': {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
              directTools: true,
            },
          },
        },
        null,
        2
      )
    );

    const reg = await manager.registerMCPServer(
      {
        name: 'mcp-files',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: {},
        enabled: true,
      },
      ['pi']
    );
    expect(reg.success).toBe(true);
    expect(readJson(mcpPath).mcpServers['mcp-files']).toBeDefined();

    const deleted = await manager.deleteMCPServer('mcp-files');
    expect(deleted.success).toBe(true);
    expect(deleted.warnings).toBeUndefined();

    const mcp = readJson(mcpPath).mcpServers || {};
    expect(mcp['mcp-files']).toBeUndefined();
  });

  it('materialization surfaces a warning when the config file cannot be verified clean', async () => {
    // A claude-code settings.json with a syntactically invalid mcpServers value:
    // the adapter can read the file (JSON parses) but the entry cannot be
    // expressed in the unified model, so materialization must surface an
    // explicit warning instead of a bare ok.
    const claudeDir = path.join(tmpHome, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const settingsPath = path.join(claudeDir, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        mcpServers: { 'qa-fake-mcp': 'not-an-object' },
      })
    );

    const result = await manager.syncAgents(['claude-code'], new Set(), new Set(['qa-fake-mcp']));
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.warnings)).toContain('qa-fake-mcp');
  });

  it('a custom-agent (array shape) delete still strips the server from the on-disk config', async () => {
    const configPath = path.join(tmpHome, 'demo', 'settings.json');
    await addDemoAgent(configPath);

    const reg = await manager.registerMCPServer(makeServer('mcp-files'), ['demo']);
    expect(reg.success).toBe(true);
    expect(readJson(configPath).mcpServers?.map((s: any) => s.name)).toContain('mcp-files');

    const deleted = await manager.deleteMCPServer('mcp-files');
    expect(deleted.success).toBe(true);
    expect(deleted.warnings).toBeUndefined();

    const after = readJson(configPath);
    expect(after.mcpServers?.map((s: any) => s.name)).not.toContain('mcp-files');
  });
});
