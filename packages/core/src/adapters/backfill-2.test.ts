/**
 * Unit tests for the Kilo, FreeBuff, OMP, and Generic adapters (Ticket:
 * backfill tests for untested adapters).
 *
 * Mirrors adapter-roundtrip.test.ts conventions (real fs, fixed temp HOME,
 * seed/readBack helpers, AAA pattern).
 *
 * - Kilo and FreeBuff are thin parameterizations (OpenCode-style and
 *   GenericAdapter respectively): a kill test on one exercises its shape.
 * - GenericAdapter is tested directly as a custom agent, covering both the
 *   'array' and 'keyed' MCP shapes plus the read-mutate-write ops.
 * - OMP is covered explicitly in adapter-roundtrip.test.ts and is being
 *   reworked by a parallel task (detect-only gap fix); these tests capture a
 *   couple of OMP-specific behaviors against its CURRENT committed shape and
 *   may need updating once that task lands.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAdapter } from './index';
import { createGenericAdapter } from './generic';
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

const HOME = path.join(os.tmpdir(), 'aicm-adapter-backfill-2-home');
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

beforeEach(() => {
  resetHome();
});

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

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readBack(rel));
}

// ---------------------------------------------------------------------------
// Kilo — OpenCode-style JSONC, `provider` + `mcp` keys
// ---------------------------------------------------------------------------
describe('kilo adapter (OpenCode-style provider + mcp)', () => {
  it('resolves the config path and reports OpenCode-style capabilities', () => {
    const a = getAdapter('kilo')!;
    expect(a.info.id).toBe('kilo');
    expect(a.info.configFormat).toBe('jsonc');
    expect(a.getConfigPath()).toBe(path.join(HOME, '.config', 'kilo', 'kilo.jsonc'));
    expect(a.info.supports.modelProviders).toBe(true);
    expect(a.info.supports.mcpServers).toBe(true);
    expect(a.info.supports.permissions).toBe(false);
  });

  it('reads providers/models and MCP servers from the config', async () => {
    seed(
      '~/.config/kilo/kilo.jsonc',
      JSON.stringify({
        $schema: 'https://kilo.ai/config.json',
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
          drawio: { type: 'local', command: ['npx', 'drawio-mcp'], enabled: true },
        },
      })
    );

    const a = getAdapter('kilo')!;
    const cfg = await a.readConfig();
    expect(cfg.modelProviders).toHaveLength(1);
    expect(cfg.modelProviders[0].id).toBe('myprovider');
    expect(cfg.modelProviders[0].config.baseUrl).toBe('https://api.example.com/v1');
    expect(cfg.models).toHaveLength(1);
    expect(cfg.models[0].id).toBe('my-model');
    expect(cfg.mcpServers).toHaveLength(1);
    expect(cfg.mcpServers[0].name).toBe('drawio');
    expect(cfg.mcpServers[0].command).toBe('npx');
    expect(cfg.mcpServers[0].args).toEqual(['drawio-mcp']);
  });

  it('creates a provider + model and adds/removes an MCP server, preserving keys', async () => {
    seed('~/.config/kilo/kilo.jsonc', JSON.stringify({ $schema: 'https://kilo.ai/config.json' }));

    const a = getAdapter('kilo')!;
    await a.addModelProvider({
      id: 'anthropic',
      name: 'Anthropic',
      type: 'openai-compatible',
      config: { baseUrl: 'https://api.anthropic.com/v1', npm: '@ai-sdk/anthropic' },
      enabled: true,
      priority: 1,
    });
    await a.addModel({
      id: 'claude-sonnet',
      providerId: 'anthropic',
      name: 'claude-sonnet',
      displayName: 'Claude Sonnet',
      roles: ['chat', 'edit'],
    });
    await a.addMCPServer(stdioServer('fs', 'npx', ['-y', 'fs-mcp'], { K: 'v' }));

    const written = readJson('~/.config/kilo/kilo.jsonc');
    expect(written.$schema).toBe('https://kilo.ai/config.json');
    const providers = written.provider as Record<string, Record<string, unknown>>;
    expect(providers.anthropic.name).toBe('Anthropic');
    expect((providers.anthropic.options as Record<string, unknown>).baseURL).toBe(
      'https://api.anthropic.com/v1'
    );
    expect(providers.anthropic.npm).toBe('@ai-sdk/anthropic');
    const mcp = written.mcp as Record<string, Record<string, unknown>>;
    expect(mcp.fs.command).toEqual(['npx', '-y', 'fs-mcp']);
    expect(mcp.fs.environmentVariables).toEqual({ K: 'v' });

    // Read back: added model + server detected
    const cfg = await a.readConfig();
    expect(cfg.models.map((m) => m.id)).toContain('claude-sonnet');
    expect(cfg.mcpServers.map((s) => s.name)).toContain('fs');

    await a.removeMCPServer('fs');
    const after = readJson('~/.config/kilo/kilo.jsonc');
    expect((after.mcp as Record<string, unknown>).fs).toBeUndefined();

    // Permissions unsupported
    await expect(a.addPermission({} as never)).rejects.toThrow(/does not support/);
  });

  it('throws on malformed JSONC config', async () => {
    seed('~/.config/kilo/kilo.jsonc', '{ provider: { broken: true }');
    const a = getAdapter('kilo')!;
    await expect(a.readConfig()).rejects.toThrow(/Failed to parse Kilo Code config/);
  });
});

// ---------------------------------------------------------------------------
// FreeBuff — separate keyed mcp.json, modelProviders=false
// ---------------------------------------------------------------------------
describe('freebuff adapter (separate keyed mcp.json)', () => {
  it('resolves paths and routes MCP to mcp.json, leaving settings.json untouched', async () => {
    seed('~/.config/manicode/settings.json', JSON.stringify({ mode: 'free', adsEnabled: false }));
    seed('~/.agents/mcp.json', JSON.stringify({ mcpServers: { keep: { command: 'k' } } }));

    const a = getAdapter('freebuff')!;
    expect(a.info.id).toBe('freebuff');
    expect(a.getConfigPath()).toBe(path.join(HOME, '.config', 'manicode', 'settings.json'));
    expect(a.getMCPConfigPath()).toBe(path.join(HOME, '.agents', 'mcp.json'));
    expect(a.info.supports.modelProviders).toBe(false);

    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);
    expect(cfg.modelProviders).toEqual([]);

    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    const mcp = readJson('~/.agents/mcp.json');
    expect((mcp.mcpServers as Record<string, Record<string, unknown>>).keep.command).toBe('k');
    const gh = (mcp.mcpServers as Record<string, Record<string, unknown>>).gh;
    expect(gh.command).toBe('npx');
    expect(gh.args).toEqual(['-y', 'gh-mcp']);
    expect(gh.env).toEqual({ T: '1' });

    // settings.json never gets MCP/provider keys
    const settings = readJson('~/.config/manicode/settings.json');
    expect(settings.mode).toBe('free');
    expect(settings.mcpServers).toBeUndefined();

    // No-op write preserves unknown settings keys
    await a.writeConfig(cfg);
    expect(readJson('~/.config/manicode/settings.json').adsEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GenericAdapter — custom agent, unified JSON schema (array MCP shape)
// ---------------------------------------------------------------------------
describe('generic adapter (custom agent, array MCP shape)', () => {
  function customAgent() {
    return createGenericAdapter({
      id: 'myagent',
      name: 'My Agent',
      description: 'A user-defined agent',
      binaries: ['myagent'],
      configPath: '~/.myagent/config.json',
      format: 'json',
    });
  }

  it('resolves path, reports capabilities, and permits permissions', () => {
    const a = customAgent();
    expect(a.getConfigPath()).toBe(path.join(HOME, '.myagent', 'config.json'));
    expect(a.getMCPConfigPath()).toBe(a.getConfigPath());
    // Custom agents default to all-supported (incl. modelProviders)
    expect(a.info.supports.modelProviders).toBe(true);
    expect(a.info.supports.mcpServers).toBe(true);
  });

  it('writes providers, models, and MCP servers to a fresh config', async () => {
    resetHome();
    const a = customAgent();
    // No config on disk → defaults
    const cfg = await a.readConfig();
    expect(cfg.modelProviders).toEqual([]);

    await a.addModelProvider({
      id: 'openai',
      name: 'OpenAI',
      type: 'openai-compatible',
      config: { baseUrl: 'https://api.openai.com/v1' },
      enabled: true,
      priority: 0,
    });
    await a.addModel({
      id: 'gpt-4o',
      providerId: 'openai',
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      roles: ['chat', 'edit'],
    });
    await a.addMCPServer(stdioServer('fs', 'npx', ['-y', 'fs-mcp'], { K: 'v' }));

    const written = readJson('~/.myagent/config.json');
    expect(written.modelProviders).toHaveLength(1);
    expect(written.models).toHaveLength(1);
    expect((written.models as Array<Record<string, unknown>>)[0].id).toBe('gpt-4o');
    const servers = written.mcpServers as Array<Record<string, unknown>>;
    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe('fs');
    expect(servers[0].command).toBe('npx');

    // Round-trip round: read back and add a remote server
    const cfg2 = await a.readConfig();
    expect(cfg2.mcpServers.map((s) => s.name)).toEqual(['fs']);
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));
    const after = readJson('~/.myagent/config.json');
    expect((after.mcpServers as Array<Record<string, unknown>>).length).toBe(2);
  });

  it('preserves unknown top-level keys and supports backup/restore', async () => {
    resetHome();
    seed('~/.myagent/config.json', JSON.stringify({ customTop: 'keep-me', mcpServers: [] }));
    const a = customAgent();
    await a.readConfig();
    await a.addMCPServer(stdioServer('local', 'node', ['/srv.js']));

    const written = readJson('~/.myagent/config.json');
    expect(written.customTop).toBe('keep-me');
    const servers = written.mcpServers as Array<Record<string, unknown>>;
    expect(servers[0].name).toBe('local');

    const backup = await a.backupConfig();
    expect(fs.existsSync(backup)).toBe(true);
    seed('~/.myagent/config.json', JSON.stringify({ customTop: 'BAD' }));
    await a.restoreConfig(backup);
    expect(readJson('~/.myagent/config.json').customTop).toBe('keep-me');
  });

  it('adds and removes MCP servers and rejects duplicates', async () => {
    resetHome();
    const a = customAgent();
    await a.addMCPServer(stdioServer('a', 'node', ['a.js']));
    await expect(a.addMCPServer(stdioServer('a', 'node', ['a.js']))).rejects.toThrow(
      /already exists/
    );
    await a.removeMCPServer('a');
    const written = readJson('~/.myagent/config.json');
    expect(written.mcpServers).toEqual([]);
  });

  it('errors on malformed config and unsupported permission ops', async () => {
    resetHome();
    seed('~/.myagent/config.json', '{ bad json }');
    const a = customAgent();
    await expect(a.readConfig()).rejects.toThrow();
    // Permissions are not supported for custom agents
    await expect(a.addPermission({} as never)).rejects.toThrow(/does not support/);
  });
});

// ---------------------------------------------------------------------------
// GenericAdapter — keyed MCP shape (same as Pi/Junie/Gemini code path)
// ---------------------------------------------------------------------------
describe('generic adapter (keyed MCP shape)', () => {
  function keyedAgent() {
    return createGenericAdapter({
      id: 'keyed-agent',
      name: 'Keyed Agent',
      binaries: ['keyed-agent'],
      configPath: '~/.keyed/config.json',
      format: 'json',
      mcpShape: 'keyed',
      supports: { modelProviders: false },
    });
  }

  it('reads a keyed mcpServers map and writes back with string commands', async () => {
    resetHome();
    seed(
      '~/.keyed/config.json',
      JSON.stringify({
        theme: 'dark',
        mcpServers: {
          existing: { command: 'node', args: ['s.js'], env: { K: 'v' } },
          remote: { type: 'http', url: 'https://ex.com/mcp' },
        },
      })
    );
    const a = keyedAgent();
    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name).sort()).toEqual(['existing', 'remote']);
    const existing = cfg.mcpServers.find((s) => s.name === 'existing')!;
    expect(existing.command).toBe('node');
    expect(existing.args).toEqual(['s.js']);
    expect(existing.type).toBe('stdio');
    const remote = cfg.mcpServers.find((s) => s.name === 'remote')!;
    expect(remote.url).toBe('https://ex.com/mcp');
    expect(remote.type).toBe('http');

    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));
    const written = readJson('~/.keyed/config.json');
    expect(written.theme).toBe('dark');
    const servers = written.mcpServers as Record<string, Record<string, unknown>>;
    expect(servers.existing.command).toBe('node');
    // Keyed shape: string command + separate args array (never a command array)
    expect(servers.gh.command).toBe('npx');
    expect(servers.gh.args).toEqual(['-y', 'gh-mcp']);
    expect(servers.remote.url).toBe('https://ex.com/mcp');

    await a.removeMCPServer('existing');
    expect((readJson('~/.keyed/config.json').mcpServers as Record<string, unknown>).existing).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// OMP — detected current-shape behaviors (being reworked in a parallel task)
// ---------------------------------------------------------------------------
describe('omp adapter (detect-only)', () => {
  it('reports OMP as detect-only with no config read/write support', () => {
    const a = getAdapter('omp')!;
    expect(a.info.supports.permissions).toBe(false);
    expect(a.info.supports.modelProviders).toBe(false);
    expect(a.info.supports.mcpServers).toBe(false);
    expect(a.info.supports.projectConfig).toBe(false);
    expect(a.info.binaries).toEqual(['omp']);
  });

  it('backupConfig throws when the config file does not exist', async () => {
    const a = getAdapter('omp')!;
    await expect(a.backupConfig()).rejects.toThrow(/No OMP config file found/);
  });

  it('rejects all config write operations with detect-only error', async () => {
    const a = getAdapter('omp')!;
    await expect(
      a.writeConfig({
        version: '1.0.0',
        lastModified: Date.now(),
        modelProviders: [],
        models: [],
        mcpServers: [],
        permissions: [],
        customSettings: {},
      })
    ).rejects.toThrow(/detect-only/);
    await expect(a.addMCPServer(stdioServer('test', 'node', ['x.js']))).rejects.toThrow(
      /detect-only/
    );
    await expect(
      a.addPermission({
        id: 'test-perm',
        type: 'tool',
        scope: 'global',
        pattern: 'bash',
        allowed: false,
      })
    ).rejects.toThrow(/detect-only/);
    await expect(a.addModelProvider({ id: 'test', name: 'Test', type: 'custom', config: {}, enabled: true, priority: 1 })).rejects.toThrow(
      /detect-only/
    );
  });
});
