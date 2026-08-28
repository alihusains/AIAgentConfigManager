/**
 * Round-trip tests for the newly added adapters (Ticket 07).
 *
 * Each test writes a realistic on-disk config into a temp dir, points the
 * adapter at it (via HOME override), reads it back, mutates MCP servers,
 * writes back, and re-reads to assert the shape survived. Real fs is used —
 * no mocking — so the actual parse/stringify (json/yaml/toml) code paths run.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAdapter } from './index';
import { parseConfig } from '../utils';
import type { MCPServerConfig } from '../types';

function stdioServer(
  name: string,
  command: string,
  args?: string[],
  env?: Record<string, string>
): MCPServerConfig {
  return { name, type: 'stdio', command, args, env, enabled: true };
}
function httpServer(name: string, url: string): MCPServerConfig {
  return { name, type: 'http', url, enabled: true };
}

// A single fixed temp home shared by all tests in this file. A fixed path
// avoids the per-test mkdtemp churn that races with vitest's threads pool.
const HOME = path.join(os.tmpdir(), 'aicm-adapter-roundtrip-home');
let prevHome: string | undefined;

beforeAll(() => {
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.mkdirSync(HOME, { recursive: true });
  prevHome = process.env.HOME;
  process.env.HOME = HOME;
});

afterAll(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  fs.rmSync(HOME, { recursive: true, force: true });
});

/** Wipe the shared home between tests. */
function resetHome(): void {
  fs.rmSync(HOME, { recursive: true, force: true });
  fs.mkdirSync(HOME, { recursive: true });
}

function seed(rel: string, content: string): void {
  const abs = path.join(HOME, rel.replace(/^~\//, ''));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function readBack(rel: string): string {
  const abs = path.join(HOME, rel.replace(/^~\//, ''));
  return fs.readFileSync(abs, 'utf-8');
}

// ---------------------------------------------------------------------------
// Claude Code — JSON settings.json + separate mcp.json
// ---------------------------------------------------------------------------
describe('claude-code adapter (settings.json + mcp.json)', () => {
  it('preserves env vars, disabledMcpServers, permissions.ask, and unknown keys on write', async () => {
    resetHome();
    seed(
      '~/.claude/settings.json',
      JSON.stringify(
        {
          env: { ANTHROPIC_API_KEY: 'sk-ant-test', CUSTOM_VAR: 'keep-me' },
          mcpServers: {
            local: {
              command: 'node',
              args: ['s.js'],
              name: 'local',
              enabled: true,
              type: 'stdio',
            },
          },
          disabledMcpServers: ['local'],
          permissions: {
            allow: ['mcp__codegraph__codegraph_search'],
            deny: [],
            ask: ['mcp__drawio__create_diagram'],
          },
          model: 'sonnet',
          inputNeededNotifEnabled: true,
          agentPushNotifEnabled: false,
        },
        null,
        2
      )
    );
    seed(
      '~/.claude/mcp.json',
      JSON.stringify({
        mcpServers: {
          atlassian: {
            command: 'npx',
            args: ['-y', 'atlassian-mcp'],
            type: 'stdio',
            enabled: true,
          },
        },
      })
    );

    const a = getAdapter('claude-code')!;
    const cfg = await a.readConfig();
    // Reads from both settings.json and mcp.json
    expect(cfg.mcpServers.map((s) => s.name).sort()).toEqual(['atlassian', 'local']);

    // Simulate a no-op syncAgents write (read → write, no mutation)
    await a.writeConfig(cfg);
    const written = JSON.parse(readBack('~/.claude/settings.json'));

    // env vars preserved (CUSTOM_VAR is not a known provider var)
    expect(written.env.ANTHROPIC_API_KEY).toBe('sk-ant-test');
    expect(written.env.CUSTOM_VAR).toBe('keep-me');

    // disabledMcpServers preserved (Claude Code's own list, not rebuilt)
    expect(written.disabledMcpServers).toEqual(['local']);

    // permissions.ask preserved (not wiped by the unified permission model)
    expect(written.permissions.ask).toEqual(['mcp__drawio__create_diagram']);
    expect(written.permissions.allow).toContain('mcp__codegraph__codegraph_search');

    // Unknown top-level keys preserved
    expect(written.inputNeededNotifEnabled).toBe(true);
    expect(written.agentPushNotifEnabled).toBe(false);

    // model preserved
    expect(written.model).toBe('sonnet');

    // mcp.json is untouched (separate file, not rewritten by settings.json write)
    const mcpJson = JSON.parse(readBack('~/.claude/mcp.json'));
    expect(mcpJson.mcpServers.atlassian.command).toBe('npx');
  });

  it('adds an MCP server to settings.json without clobbering existing entries', async () => {
    resetHome();
    seed(
      '~/.claude/settings.json',
      JSON.stringify(
        {
          env: {},
          mcpServers: {
            existing: {
              command: 'node',
              args: ['s.js'],
              name: 'existing',
              enabled: true,
              type: 'stdio',
            },
          },
          disabledMcpServers: [],
          permissions: { allow: [], deny: [], ask: [] },
          model: 'sonnet',
        },
        null,
        2
      )
    );

    const a = getAdapter('claude-code')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('new-server', 'npx', ['-y', 'new-mcp'], { KEY: 'val' }));
    const written = JSON.parse(readBack('~/.claude/settings.json'));

    // Existing server preserved with all its fields
    expect(written.mcpServers.existing.command).toBe('node');
    expect(written.mcpServers.existing.args).toEqual(['s.js']);
    expect(written.mcpServers.existing.name).toBe('existing');

    // New server added
    expect(written.mcpServers['new-server'].command).toBe('npx');
    expect(written.mcpServers['new-server'].args).toEqual(['-y', 'new-mcp']);
    expect(written.mcpServers['new-server'].env).toEqual({ KEY: 'val' });
  });
});

// ---------------------------------------------------------------------------
// OpenCode — JSONC config with provider + mcp keys
// ---------------------------------------------------------------------------
describe('opencode adapter (JSONC provider + mcp keys)', () => {
  it('preserves all MCP servers and provider entries on no-op write', async () => {
    resetHome();
    seed(
      '~/.config/opencode/opencode.json',
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          provider: {
            myprovider: {
              name: 'My Provider',
              env: ['MY_KEY'],
              npm: '@ai-sdk/openai-compatible',
              options: { baseURL: 'https://api.example.com/v1' },
              models: { 'my-model': { name: 'My Model' } },
            },
          },
          model: 'myprovider/my-model',
          mcp: {
            drawio: {
              type: 'local',
              command: ['npx', 'drawio-mcp'],
              enabled: true,
            },
            codegraph: {
              type: 'local',
              command: ['codegraph', 'serve', '--mcp'],
              enabled: true,
            },
          },
        },
        null,
        2
      )
    );

    const a = getAdapter('opencode')!;
    const cfg = await a.readConfig();
    expect(cfg.modelProviders.length).toBe(1);
    expect(cfg.mcpServers.length).toBe(2);

    // No-op write (simulates syncAgents with no registry changes)
    await a.writeConfig(cfg);
    const written = JSON.parse(readBack('~/.config/opencode/opencode.json'));

    // All MCP servers preserved
    expect(Object.keys(written.mcp).sort()).toEqual(['codegraph', 'drawio']);
    expect(written.mcp.drawio.command).toEqual(['npx', 'drawio-mcp']);
    expect(written.mcp.codegraph.command).toEqual(['codegraph', 'serve', '--mcp']);

    // Provider preserved
    expect(written.provider.myprovider.name).toBe('My Provider');
    expect(written.provider.myprovider.options.baseURL).toBe('https://api.example.com/v1');
    expect(written.provider.myprovider.models['my-model'].name).toBe('My Model');

    // $schema preserved
    expect(written.$schema).toBe('https://opencode.ai/config.json');

    // model preserved
    expect(written.model).toBe('myprovider/my-model');
  });

  it('adds an MCP server without losing existing ones', async () => {
    resetHome();
    seed(
      '~/.config/opencode/opencode.json',
      JSON.stringify(
        {
          provider: {},
          mcp: {
            existing: {
              type: 'local',
              command: ['node', 's.js'],
              enabled: true,
            },
          },
        },
        null,
        2
      )
    );

    const a = getAdapter('opencode')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('new-mcp', 'npx', ['-y', 'new-mcp']));
    const written = JSON.parse(readBack('~/.config/opencode/opencode.json'));

    // Both servers present
    expect(Object.keys(written.mcp).sort()).toEqual(['existing', 'new-mcp']);
    expect(written.mcp.existing.command).toEqual(['node', 's.js']);
    expect(written.mcp['new-mcp'].command).toEqual(['npx', '-y', 'new-mcp']);
  });

  it('removes an MCP server without losing others', async () => {
    resetHome();
    seed(
      '~/.config/opencode/opencode.json',
      JSON.stringify(
        {
          provider: {},
          mcp: {
            keep: { type: 'local', command: ['keep'], enabled: true },
            remove: { type: 'local', command: ['remove'], enabled: true },
          },
        },
        null,
        2
      )
    );

    const a = getAdapter('opencode')!;
    await a.readConfig();
    await a.removeMCPServer('remove');
    const written = JSON.parse(readBack('~/.config/opencode/opencode.json'));

    expect(written.mcp.keep).toBeDefined();
    expect(written.mcp.remove).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Qwen — JSON, same-file `mcpServers` keyed
// ---------------------------------------------------------------------------
describe('qwen adapter (JSON mcpServers keyed)', () => {
  it('reads, adds, removes, round-trips mcpServers and preserves other keys', async () => {
    resetHome();
    seed(
      '~/.qwen/settings.json',
      JSON.stringify(
        {
          telemetry: { enabled: false },
          mcpServers: { existing: { command: 'node', args: ['s.js'] } },
        },
        null,
        2
      )
    );
    const a = getAdapter('qwen')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['existing']);

    await a.addMCPServer(stdioServer('github', 'npx', ['-y', 'gh-mcp'], { TOKEN: 'x' }));
    await a.addMCPServer(httpServer('remote', 'https://example.com/mcp'));
    const written = JSON.parse(readBack('~/.qwen/settings.json'));
    expect(written.telemetry.enabled).toBe(false);
    expect(written.mcpServers.github.command).toBe('npx');
    expect(written.mcpServers.github.args).toEqual(['-y', 'gh-mcp']);
    expect(written.mcpServers.github.env).toEqual({ TOKEN: 'x' });
    expect(written.mcpServers.remote.url).toBe('https://example.com/mcp');

    await a.removeMCPServer('github');
    const after = JSON.parse(readBack('~/.qwen/settings.json'));
    expect(after.mcpServers.github).toBeUndefined();
    expect(after.mcpServers.existing.command).toBe('node');
  });
});

// ---------------------------------------------------------------------------
// Cursor CLI — JSON, separate mcp.json (keyed), config at cli-config.json
// ---------------------------------------------------------------------------
describe('cursor-cli adapter (separate mcp.json)', () => {
  it('writes MCP into mcp.json, leaves cli-config.json untouched', async () => {
    resetHome();
    seed('~/.cursor/cli-config.json', JSON.stringify({ theme: 'dark' }));
    seed('~/.cursor/mcp.json', JSON.stringify({ mcpServers: { keep: { command: 'k' } } }));
    const a = getAdapter('cursor-cli')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('fs', 'npx', ['-y', 'fs-mcp']));
    const mcp = JSON.parse(readBack('~/.cursor/mcp.json'));
    expect(mcp.mcpServers.keep.command).toBe('k');
    expect(mcp.mcpServers.fs.command).toBe('npx');
    expect(JSON.parse(readBack('~/.cursor/cli-config.json'))).toEqual({
      theme: 'dark',
    });
  });
});

// ---------------------------------------------------------------------------
// Cline — JSON, separate mcp.json (keyed)
// ---------------------------------------------------------------------------
describe('cline adapter (separate mcp.json)', () => {
  it('round-trips mcpServers in ~/.cline/mcp.json', async () => {
    resetHome();
    seed('~/.cline/settings.json', JSON.stringify({ yolo: true }));
    seed('~/.cline/mcp.json', JSON.stringify({ mcpServers: {} }));
    const a = getAdapter('cline')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('local', 'node', ['/srv.js'], { KEY: 'v' }));
    const mcp = JSON.parse(readBack('~/.cline/mcp.json'));
    expect(mcp.mcpServers.local.command).toBe('node');
    expect(mcp.mcpServers.local.args).toEqual(['/srv.js']);
    expect(mcp.mcpServers.local.env).toEqual({ KEY: 'v' });
    expect(JSON.parse(readBack('~/.cline/settings.json')).yolo).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Droid — JSON, same-file mcp.json (keyed)
// ---------------------------------------------------------------------------
describe('droid adapter (same-file mcp.json)', () => {
  it('round-trips mcpServers in ~/.factory/mcp.json', async () => {
    resetHome();
    seed('~/.factory/mcp.json', JSON.stringify({ mcpServers: { x: { command: 'x' } } }));
    const a = getAdapter('droid')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['x']);
    await a.addMCPServer(httpServer('remote', 'https://r.example/mcp'));
    const mcp = JSON.parse(readBack('~/.factory/mcp.json'));
    expect(mcp.mcpServers.x.command).toBe('x');
    expect(mcp.mcpServers.remote.url).toBe('https://r.example/mcp');
  });
});

// ---------------------------------------------------------------------------
// Kimi — TOML main config + separate JSON mcp.json (keyed)
// ---------------------------------------------------------------------------
describe('kimi adapter (TOML config + JSON mcp.json)', () => {
  it('reads TOML config, writes MCP to mcp.json, preserves TOML keys', async () => {
    resetHome();
    seed('~/.kimi/config.toml', 'theme = "dark"\n\n[general]\nverbose = true\n');
    seed('~/.kimi/mcp.json', JSON.stringify({ mcpServers: { keep: { command: 'k' } } }));
    const a = getAdapter('kimi')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    const mcp = JSON.parse(readBack('~/.kimi/mcp.json'));
    expect(mcp.mcpServers.keep.command).toBe('k');
    expect(mcp.mcpServers.gh.command).toBe('npx');
    expect(mcp.mcpServers.gh.env).toEqual({ T: '1' });
    const toml = readBack('~/.kimi/config.toml');
    expect(toml).toContain('theme = "dark"');
    expect(toml).toContain('verbose = true');
  });
});

// ---------------------------------------------------------------------------
// Goose — YAML config, `extensions` keyed map (cmd/args/envs or uri)
// ---------------------------------------------------------------------------
describe('goose adapter (YAML extensions keyed map)', () => {
  it('reads extensions, adds stdio + remote, round-trips cmd/envs/uri', async () => {
    resetHome();
    seed(
      '~/.config/goose/config.yaml',
      [
        'model: "claude-3"',
        'extensions:',
        '  keep:',
        '    type: stdio',
        '    cmd: k',
        '    enabled: true',
      ].join('\n')
    );
    const a = getAdapter('goose')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);
    expect(cfg.mcpServers[0].command).toBe('k');

    await a.addMCPServer(stdioServer('fs', 'npx', ['-y', 'fs'], { A: 'b' }));
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));
    const yaml = readBack('~/.config/goose/config.yaml');
    expect(yaml).toContain('cmd: npx');
    expect(yaml).toContain('envs:');
    expect(yaml).toContain('uri: https://ex.com/mcp');

    await a.readConfig();
    const names = a
      .listMCPServers()
      .map((s) => s.name)
      .sort();
    expect(names).toEqual(['fs', 'keep', 'remote']);
    const fs2 = a.listMCPServers().find((s) => s.name === 'fs')!;
    expect(fs2.command).toBe('npx');
    expect(fs2.args).toEqual(['-y', 'fs']);
    const remote = a.listMCPServers().find((s) => s.name === 'remote')!;
    expect(remote.url).toBe('https://ex.com/mcp');
  });
});

// ---------------------------------------------------------------------------
// Continue — YAML config, `mcpServers` LIST (name field, command/args/env/url/type)
// ---------------------------------------------------------------------------
describe('continue adapter (YAML mcpServers list)', () => {
  it('reads mcpServers list, adds stdio + remote, preserves models', async () => {
    resetHome();
    seed(
      '~/.continue/config.yaml',
      [
        'name: "My Config"',
        'schema: "v1"',
        'models:',
        '  - name: "gpt-4"',
        '    provider: "openai"',
        'mcpServers:',
        '  - name: existing',
        '    command: node',
        '    args: ["s.js"]',
      ].join('\n')
    );
    const a = getAdapter('continue')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['existing']);
    expect(cfg.mcpServers[0].command).toBe('node');

    await a.addMCPServer(stdioServer('sqlite', 'npx', ['-y', 'mcp-sqlite'], { DB: '/x' }));
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));
    const yaml = readBack('~/.continue/config.yaml');
    expect(yaml).toContain('name: sqlite');
    expect(yaml).toContain('command: npx');
    expect(yaml).toContain('url: https://ex.com/mcp');
    expect(yaml).toContain('name: gpt-4');

    await a.readConfig();
    const names = a
      .listMCPServers()
      .map((s) => s.name)
      .sort();
    expect(names).toEqual(['existing', 'remote', 'sqlite']);
  });
});

// ---------------------------------------------------------------------------
// Crush — JSON config, `mcp` keyed map (NOT mcpServers)
// ---------------------------------------------------------------------------
describe('crush adapter (JSON mcp keyed map)', () => {
  it('reads mcp map, adds servers, preserves other keys', async () => {
    resetHome();
    seed(
      '~/.config/crush/crush.json',
      JSON.stringify({
        theme: 'dracula',
        mcp: { keep: { command: 'k' } },
      })
    );
    const a = getAdapter('crush')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);

    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));
    const json = JSON.parse(readBack('~/.config/crush/crush.json'));
    expect(json.theme).toBe('dracula');
    expect(json.mcp.keep.command).toBe('k');
    expect(json.mcp.gh.command).toBe('npx');
    expect(json.mcp.gh.env).toEqual({ T: '1' });
    expect(json.mcp.remote.url).toBe('https://ex.com/mcp');
    expect(json.mcpServers).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Windsurf — JSON, separate mcp_config.json (keyed, serverUrl for remote)
// ---------------------------------------------------------------------------
describe('windsurf adapter (separate mcp_config.json, serverUrl)', () => {
  it('round-trips mcpServers, decoding/encoding serverUrl, preserving keys', async () => {
    resetHome();
    seed(
      '~/.codeium/windsurf/mcp_config.json',
      JSON.stringify({
        mcpServers: {
          existing: { command: 'node', args: ['s.js'], env: { KEY: 'v' } },
          remote: { serverUrl: 'https://ex.com/mcp' },
        },
        customKey: 'keep-me',
      })
    );
    const a = getAdapter('windsurf')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name).sort()).toEqual(['existing', 'remote']);
    // serverUrl decodes into the unified url field
    expect(cfg.mcpServers.find((s) => s.name === 'remote')!.url).toBe('https://ex.com/mcp');

    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    const mcp = JSON.parse(readBack('~/.codeium/windsurf/mcp_config.json'));
    expect(mcp.customKey).toBe('keep-me');
    expect(mcp.mcpServers.existing.command).toBe('node');
    expect(mcp.mcpServers.existing.env).toEqual({ KEY: 'v' });
    expect(mcp.mcpServers.gh.command).toBe('npx');
    expect(mcp.mcpServers.gh.args).toEqual(['-y', 'gh-mcp']);
    // remote keeps its serverUrl form
    expect(mcp.mcpServers.remote.serverUrl).toBe('https://ex.com/mcp');

    await a.removeMCPServer('existing');
    const after = JSON.parse(readBack('~/.codeium/windsurf/mcp_config.json'));
    expect(after.mcpServers.existing).toBeUndefined();
    expect(after.mcpServers.gh).toBeDefined();
    expect(after.mcpServers.remote.serverUrl).toBe('https://ex.com/mcp');
  });
});

// ---------------------------------------------------------------------------
// Roo Code — JSON, separate mcp_settings.json (keyed, Cline-fork shape)
// ---------------------------------------------------------------------------
describe('roo adapter (separate mcp_settings.json)', () => {
  it('round-trips mcpServers, leaves cli-settings.json untouched', async () => {
    resetHome();
    seed('~/.roo/cli-settings.json', JSON.stringify({ onboardingProviderChoice: 'openrouter' }));
    seed(
      '~/.vscode-mock/global-storage/mcp_settings.json',
      JSON.stringify({
        mcpServers: {
          keep: { type: 'stdio', command: 'k', timeout: 90, alwaysAllow: [] },
        },
      })
    );
    const a = getAdapter('roo')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);

    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));
    const mcp = JSON.parse(readBack('~/.vscode-mock/global-storage/mcp_settings.json'));
    // Roo-specific per-server keys preserved on merge
    expect(mcp.mcpServers.keep.command).toBe('k');
    expect(mcp.mcpServers.keep.timeout).toBe(90);
    expect(mcp.mcpServers.gh.command).toBe('npx');
    expect(mcp.mcpServers.gh.args).toEqual(['-y', 'gh-mcp']);
    expect(mcp.mcpServers.remote.url).toBe('https://ex.com/mcp');
    expect(JSON.parse(readBack('~/.roo/cli-settings.json')).onboardingProviderChoice).toBe(
      'openrouter'
    );

    await a.removeMCPServer('keep');
    const after = JSON.parse(readBack('~/.vscode-mock/global-storage/mcp_settings.json'));
    expect(after.mcpServers.keep).toBeUndefined();
    expect(after.mcpServers.gh).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// OMP / Oh My Pi — YAML config.yml + models.yml, JSON mcp.json (keyed)
// ---------------------------------------------------------------------------
describe('omp adapter (YAML config + models, JSON mcp)', () => {
  it('round-trips models, MCP servers, and permissions, preserving keys', async () => {
    resetHome();
    seed(
      '~/.omp/agent/config.yml',
      [
        'theme: dark',
        'tools:',
        '  approvalMode: write',
        '  approval:',
        '    bash: prompt',
        '  tools:',
        '    read: allow',
        'bash:',
        '  patterns:',
        '    - match: "git push"',
        '      approval: prompt',
      ].join('\n')
    );
    seed(
      '~/.omp/agent/models.yml',
      [
        'providers:',
        '  openai:',
        '    baseUrl: https://api.openai.com/v1',
        '    api: openai-completions',
        '    models:',
        '      - id: gpt-4o',
        '        name: GPT-4o',
        '        reasoning: true',
        '        input: [text, image]',
        '        contextWindow: 128000',
        '        maxTokens: 16384',
      ].join('\n')
    );
    seed(
      '~/.omp/agent/mcp.json',
      JSON.stringify({
        mcpServers: {
          existing: { command: 'node', args: ['s.js'], env: { KEY: 'v' } },
          remote: { type: 'http', url: 'https://ex.com/mcp' },
        },
        customKey: 'keep-me',
      })
    );

    const a = getAdapter('omp')!;
    const cfg = await a.readConfig();

    // Models decoded from models.yml
    expect(cfg.modelProviders).toHaveLength(1);
    expect(cfg.modelProviders[0].id).toBe('openai');
    expect(cfg.models).toHaveLength(1);
    expect(cfg.models[0].id).toBe('gpt-4o');
    expect(cfg.models[0].capabilities).toContain('reasoning');
    expect(cfg.models[0].capabilities).toContain('vision');

    // MCP servers decoded from mcp.json
    expect(cfg.mcpServers.map((s) => s.name).sort()).toEqual(['existing', 'remote']);
    expect(cfg.mcpServers.find((s) => s.name === 'remote')!.url).toBe('https://ex.com/mcp');

    // Permissions decoded from config.yml
    expect(cfg.permissions.some((p) => p.id === 'omp-approval-bash' && !p.allowed)).toBe(true);
    expect(cfg.permissions.some((p) => p.id === 'omp-tool-read' && p.allowed)).toBe(true);

    // Add a model provider + model
    await a.addModelProvider({
      id: 'anthropic',
      providerId: 'anthropic',
      name: 'Anthropic',
      type: 'custom',
      config: { baseUrl: 'https://api.anthropic.com/v1', api: 'anthropic-messages' },
      enabled: true,
      priority: 1,
    });
    await a.addModel('anthropic', {
      id: 'claude-sonnet-4-6',
      providerId: 'anthropic',
      name: 'Claude Sonnet 4.6',
      displayName: 'Claude Sonnet 4.6',
      roles: ['chat', 'apply', 'edit'],
      contextLength: 200000,
      maxTokens: 64000,
    });

    const modelsYaml = parseConfig(readBack('~/.omp/agent/models.yml'), 'yaml') as Record<string, unknown>;
    const providers = modelsYaml.providers as Record<string, Record<string, unknown>>;
    expect(providers.openai.baseUrl).toBe('https://api.openai.com/v1');
    expect(providers.openai.models).toHaveLength(1);
    expect(providers.anthropic.baseUrl).toBe('https://api.anthropic.com/v1');
    expect(providers.anthropic.models).toHaveLength(1);

    // Add an MCP server
    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    const mcp = JSON.parse(readBack('~/.omp/agent/mcp.json'));
    expect(mcp.customKey).toBe('keep-me');
    expect(mcp.mcpServers.existing.command).toBe('node');
    expect(mcp.mcpServers.gh.command).toBe('npx');
    expect(mcp.mcpServers.gh.args).toEqual(['-y', 'gh-mcp']);
    expect(mcp.mcpServers.remote.url).toBe('https://ex.com/mcp');

    // Add a permission
    await a.addPermission({
      id: 'omp-approval-write',
      type: 'tool',
      pattern: 'write',
      allowed: true,
      description: 'Allow write tool',
    });
    const configYaml = parseConfig(readBack('~/.omp/agent/config.yml'), 'yaml') as Record<string, unknown>;
    const tools = configYaml.tools as Record<string, unknown>;
    const approval = tools.approval as Record<string, unknown>;
    expect(approval.bash).toBe('prompt');
    expect(approval.write).toBe('allow');
    // bash.patterns preserved
    const bash = configYaml.bash as Record<string, unknown>;
    expect(bash.patterns).toBeDefined();
    // theme preserved
    expect(configYaml.theme).toBe('dark');

    // Remove MCP server
    await a.removeMCPServer('existing');
    const after = JSON.parse(readBack('~/.omp/agent/mcp.json'));
    expect(after.mcpServers.existing).toBeUndefined();
    expect(after.mcpServers.gh).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Zed — JSON settings.json, MCP under `context_servers` (NOT mcpServers)
// ---------------------------------------------------------------------------
describe('zed adapter (context_servers keyed map)', () => {
  it('reads context_servers, adds stdio + remote, preserves other keys', async () => {
    resetHome();
    seed(
      '~/.config/zed/settings.json',
      JSON.stringify({
        theme: 'one-dark',
        context_servers: {
          keep: { command: 'k', args: ['serve'] },
        },
      })
    );
    const a = getAdapter('zed')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);

    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));
    const json = JSON.parse(readBack('~/.config/zed/settings.json'));
    expect(json.theme).toBe('one-dark');
    // MCP lives under context_servers, never mcpServers
    expect(json.context_servers.keep.command).toBe('k');
    expect(json.context_servers.gh.command).toBe('npx');
    expect(json.context_servers.gh.args).toEqual(['-y', 'gh-mcp']);
    expect(json.context_servers.remote.url).toBe('https://ex.com/mcp');
    expect(json.mcpServers).toBeUndefined();

    await a.removeMCPServer('keep');
    const after = JSON.parse(readBack('~/.config/zed/settings.json'));
    expect(after.context_servers.keep).toBeUndefined();
    expect(after.context_servers.gh).toBeDefined();
    expect(after.mcpServers).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Amazon Q Developer CLI — JSON, separate mcp.json (keyed)
// ---------------------------------------------------------------------------
describe('amazonq adapter (separate mcp.json)', () => {
  it('round-trips mcpServers in ~/.aws/amazonq/mcp.json', async () => {
    resetHome();
    seed('~/.aws/amazonq/mcp.json', JSON.stringify({ mcpServers: { keep: { command: 'k' } } }));
    const a = getAdapter('amazonq')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);
    await a.addMCPServer(stdioServer('ivs', 'node', ['/srv.js'], { K: 'v' }));
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));
    const mcp = JSON.parse(readBack('~/.aws/amazonq/mcp.json'));
    expect(mcp.mcpServers.keep.command).toBe('k');
    expect(mcp.mcpServers.ivs.command).toBe('node');
    expect(mcp.mcpServers.ivs.args).toEqual(['/srv.js']);
    expect(mcp.mcpServers.ivs.env).toEqual({ K: 'v' });
    expect(mcp.mcpServers.remote.url).toBe('https://ex.com/mcp');
  });
});

// ---------------------------------------------------------------------------
// GitHub Copilot CLI — JSONC settings.json + separate mcp-config.json (keyed)
// ---------------------------------------------------------------------------
describe('copilot-cli adapter (separate mcp-config.json)', () => {
  it('writes MCP into mcp-config.json, leaves settings.json untouched', async () => {
    resetHome();
    seed('~/.copilot/settings.json', '// user settings\n{\n  "theme": "dark"\n}');
    seed('~/.copilot/mcp-config.json', JSON.stringify({ mcpServers: { keep: { command: 'k' } } }));
    const a = getAdapter('copilot-cli')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('fs', 'npx', ['-y', 'fs-mcp']));
    const mcp = JSON.parse(readBack('~/.copilot/mcp-config.json'));
    expect(mcp.mcpServers.keep.command).toBe('k');
    expect(mcp.mcpServers.fs.command).toBe('npx');
    // settings.json untouched (comment + theme preserved)
    const settings = readBack('~/.copilot/settings.json');
    expect(settings).toContain('"theme": "dark"');
  });
});

// ---------------------------------------------------------------------------
// Aider — detect-only (no native MCP; YAML config read into customSettings)
// ---------------------------------------------------------------------------
describe('aider adapter (detect-only)', () => {
  it('reads .aider.conf.yml into customSettings and refuses writes', async () => {
    resetHome();
    seed('~/.aider.conf.yml', 'model: gpt-4o\nedit-format: wholefile\n');
    const a = getAdapter('aider')!;
    const cfg = await a.readConfig();
    expect(cfg.customSettings.model).toBe('gpt-4o');
    expect(cfg.customSettings['edit-format']).toBe('wholefile');
    expect(cfg.mcpServers).toEqual([]);
    expect(a.info.supports.mcpServers).toBe(false);
    expect(a.getMCPConfigPath()).toBeNull();
    await expect(a.writeConfig(cfg)).rejects.toThrow(/detect-only/);
  });
});

// ---------------------------------------------------------------------------
// Pi — settings.json main + separate provider store (models.json) + mcp.json
// ---------------------------------------------------------------------------
describe('pi adapter (provider store models.json)', () => {
  it('detects providers added manually in pi and round-trips them', async () => {
    resetHome();
    seed(
      '~/.pi/agent/settings.json',
      JSON.stringify({
        defaultProvider: 'icmarket',
        theme: 'dark',
      })
    );
    seed(
      '~/.pi/agent/models.json',
      [
        '{',
        '  "version": 2,',
        '  "providers": {',
        '    "b.ai": {',
        '      "baseUrl": "https://api.b.ai/v1",',
        '      "api": "openai-completions",',
        '      "apiKey": "sk-test",',
        '      "authHeader": true,',
        '      "models": [{',
        '        "id": "deepseek-v4-flash",',
        '        "name": "deepseek-v4-flash",',
        '        "reasoning": false,',
        '        "input": ["text", "image"],',
        // pi writes lenient JSON — trailing commas must not break parsing
        '        "contextWindow": 128000,',
        '      }]',
        '    }',
        '  }',
        '}',
      ].join('\n')
    );
    seed(
      '~/.pi/agent/mcp.json',
      JSON.stringify({
        mcpServers: { keep: { command: 'k' } },
        imports: ['./extra.json'],
      })
    );

    const a = getAdapter('pi')!;
    const cfg = await a.readConfig();
    // Providers added inside Pi are detected
    expect(cfg.modelProviders.map((p) => p.id)).toEqual(['b.ai']);
    expect(cfg.models.map((m) => m.id)).toEqual(['deepseek-v4-flash']);
    expect(cfg.models[0].contextLength).toBe(128000);
    expect(cfg.models[0].capabilities).toContain('vision');
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);

    // A manager-side edit reaches pi's models.json in pi's own shape
    await a.updateModelProvider('b.ai', {
      name: 'b.ai',
      config: {
        baseUrl: 'https://api2.b.ai/v1',
        apiKey: 'sk-new',
        authHeader: true,
      },
    });
    const written = JSON.parse(readBack('~/.pi/agent/models.json'));
    expect(written.version).toBe(2); // unknown top-level keys preserved
    expect(written.providers['b.ai'].baseUrl).toBe('https://api2.b.ai/v1');
    expect(written.providers['b.ai'].apiKey).toBe('sk-new');
    expect(written.providers['b.ai'].authHeader).toBe(true);
    expect(written.providers['b.ai'].api).toBe('openai-completions');
    expect(written.providers['b.ai'].models[0].contextWindow).toBe(128000); // raw model fields preserved
    expect(written.providers['b.ai'].models[0].input).toEqual(['text', 'image']);
    // settings.json is never polluted with provider keys
    const settings = JSON.parse(readBack('~/.pi/agent/settings.json'));
    expect(settings.defaultProvider).toBe('icmarket');
    expect(settings.modelProviders).toBeUndefined();
    // mcp.json unknown keys preserved on the MCP write
    expect(JSON.parse(readBack('~/.pi/agent/mcp.json')).imports).toEqual(['./extra.json']);

    // A registry provider without an `api` field defaults to chat completions
    await a.addModelProvider({
      id: 'newp',
      name: 'New',
      type: 'openai-compatible',
      config: { baseUrl: 'https://x/v1', apiKey: 'k' },
      enabled: true,
      priority: 0,
    });
    const after = JSON.parse(readBack('~/.pi/agent/models.json'));
    expect(after.providers.newp.api).toBe('openai-completions');
    expect(after.providers.newp.models).toEqual([]);
  });
});
