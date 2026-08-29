/**
 * Unit tests for the ChatGPT/Codex, Gemini, and Junie adapters (Ticket: backfill
 * tests for untested adapters).
 *
 * Mirrors the conventions in adapter-roundtrip.test.ts: real fs, a fixed temp
 * HOME, seed/readBack helpers, and the AAA (arrange / act / assert) pattern.
 * The Gemini and Junie adapters are thin parameterizations of GenericAdapter
 * with a keyed MCP shape; Codex is a fully custom TOML adapter.
 *
 * Coverage targets: detect/path resolution, read/parse of existing config,
 * create/update of models and providers, add/remove MCP servers, permission
 * support (or lack thereof), backup/restore, and error cases (malformed
 * config, missing file).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

// A single fixed temp home shared by all tests in this file. Kept distinct
// from adapter-roundtrip.test.ts's HOME so the suites do not collide when
// vitest runs them in the same process pool.
const HOME = path.join(os.tmpdir(), 'aicm-adapter-backfill-1-home');
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
  // Never leak a CODEX_HOME override into other suites.
  delete process.env.CODEX_HOME;
  fs.rmSync(HOME, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env.CODEX_HOME;
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

// ---------------------------------------------------------------------------
// Codex — TOML config, model_providers + mcp_servers (custom adapter)
// ---------------------------------------------------------------------------
describe('chatgpt/codex adapter (TOML config)', () => {
  it('resolves the default config path and honors CODEX_HOME overrides', () => {
    resetHome();
    delete process.env.CODEX_HOME;
    const a = getAdapter('chatgpt')!;
    expect(a.info.id).toBe('chatgpt');
    expect(a.info.configFormat).toBe('toml');
    expect(a.getConfigPath()).toBe(path.join(HOME, '.codex', 'config.toml'));
    expect(a.getConfigPath('win32')).toBe(`${HOME}\\.codex\\config.toml`);

    // CODEX_HOME overrides the config directory
    process.env.CODEX_HOME = path.join(HOME, 'custom-codex');
    const b = getAdapter('chatgpt')!;
    expect(b.getConfigPath()).toBe(path.join(HOME, 'custom-codex', 'config.toml'));
  });

  it('reads model, provider, and MCP entries from a TOML config', async () => {
    resetHome();
    seed(
      '~/.codex/config.toml',
      [
        'model = "gpt-5-codex"',
        'model_provider = "provider-a"',
        '',
        '[model_providers."provider-a"]',
        'name = "Provider A"',
        'base_url = "https://api.example.com"',
        'env_key = "PROVIDER_API_KEY"',
        'wire_api = "chat"',
        'requires_openai_auth = false',
        '',
        '[mcp_servers."local"]',
        'command = "node"',
        'args = ["s.js"]',
        'env = { KEY = "val" }',
        'enabled = true',
      ].join('\n')
    );

    const a = getAdapter('chatgpt')!;
    const cfg = await a.readConfig();

    expect(cfg.models.map((m) => m.id)).toEqual(['default']);
    expect(cfg.models[0].name).toBe('gpt-5-codex');
    expect(cfg.models[0].providerId).toBe('provider-a');

    expect(cfg.modelProviders).toHaveLength(1);
    expect(cfg.modelProviders[0].id).toBe('provider-a');
    expect(cfg.modelProviders[0].name).toBe('Provider A');
    expect(cfg.modelProviders[0].config.baseUrl).toBe('https://api.example.com');
    expect(cfg.modelProviders[0].config.apiKeyEnvVar).toBe('PROVIDER_API_KEY');
    expect(cfg.modelProviders[0].config.wireApi).toBe('chat');
    expect(cfg.modelProviders[0].config.requiresOpenaiAuth).toBe(false);

    expect(cfg.mcpServers).toHaveLength(1);
    expect(cfg.mcpServers[0].name).toBe('local');
    expect(cfg.mcpServers[0].type).toBe('stdio');
    expect(cfg.mcpServers[0].command).toBe('node');
    expect(cfg.mcpServers[0].args).toEqual(['s.js']);
    expect(cfg.mcpServers[0].env).toEqual({ KEY: 'val' });
  });

  it('returns defaults and preserves unknown keys on a no-op write', async () => {
    resetHome();
    // Missing file → defaults
    const a = getAdapter('chatgpt')!;
    const cfg = await a.readConfig();
    expect(cfg.modelProviders).toEqual([]);
    expect(cfg.models).toEqual([]);
    expect(cfg.mcpServers).toEqual([]);

    // Seed with an unknown top-level key + a model_provider and round-trip
    seed(
      '~/.codex/config.toml',
      [
        'model = "gpt-5-codex"',
        'custom_flag = "keep-me"',
        '',
        '[model_providers."provider-a"]',
        'name = "Provider A"',
        'base_url = "https://api.example.com"',
        '',
        '[mcp_servers."local"]',
        'command = "node"',
        'args = ["s.js"]',
      ].join('\n')
    );
    const a2 = getAdapter('chatgpt')!;
    const c2 = await a2.readConfig();
    await a2.writeConfig(c2);

    const written = readBack('~/.codex/config.toml');
    expect(written).toContain('model = "gpt-5-codex"');
    expect(written).toContain('custom_flag = "keep-me"');
    expect(written).toContain('base_url = "https://api.example.com"');
    expect(written).toContain('command = "node"');
    const parsed = parseConfig(written, 'toml') as Record<string, unknown>;
    expect(parsed.custom_flag).toBe('keep-me');
  });

  it('adds and updates a model provider, persisting into the TOML config', async () => {
    resetHome();
    seed(
      '~/.codex/config.toml',
      ['[model_providers."provider-a"]', 'name = "Provider A"', 'base_url = "https://a.example"'].join(
        '\n'
      )
    );

    const a = getAdapter('chatgpt')!;
    await a.addModelProvider({
      id: 'provider-b',
      name: 'Provider B',
      type: 'openai-compatible',
      config: { baseUrl: 'https://b.example', wireApi: 'responses' },
      enabled: true,
      priority: 1,
    });
    await a.updateModelProvider('provider-a', {
      name: 'Provider A Renamed',
    });

    const parsed = parseConfig(readBack('~/.codex/config.toml'), 'toml') as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const providers = parsed.model_providers as Record<string, Record<string, unknown>>;
    expect(providers['provider-b'].base_url).toBe('https://b.example');
    expect(providers['provider-b'].wire_api).toBe('responses');
    // The rename persists: provider-a was renamed to "Provider A Renamed",
    // and base_url updates are also persisted.
    expect(providers['provider-a'].name).toBe('Provider A Renamed');
    expect(providers['provider-a'].base_url).toBe('https://a.example');

    // Duplicate add throws
    await expect(
      a.addModelProvider({
        id: 'provider-a',
        name: 'Dup',
        type: 'openai-compatible',
        config: {},
        enabled: true,
        priority: 0,
      })
    ).rejects.toThrow(/already exists/);
  });

  it('rejects a rename that collides with another provider name', async () => {
    resetHome();
    seed(
      '~/.codex/config.toml',
      [
        '[model_providers."provider-a"]',
        'name = "Provider A"',
        '',
        '[model_providers."provider-b"]',
        'name = "Provider B"',
      ].join('\n')
    );
    const a = getAdapter('chatgpt')!;
    // Renaming A to B's name must error explicitly rather than silently
    // creating a duplicate display name.
    await expect(
      a.updateModelProvider('provider-a', { name: 'Provider B' })
    ).rejects.toThrow(/name "Provider B" already exists/);
    // Renaming A to a name no other provider holds succeeds.
    await a.updateModelProvider('provider-a', { name: 'Provider A Renamed' });
    const parsed = parseConfig(readBack('~/.codex/config.toml'), 'toml') as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const providers = parsed.model_providers as Record<string, Record<string, unknown>>;
    expect(providers['provider-a'].name).toBe('Provider A Renamed');
    expect(providers['provider-b'].name).toBe('Provider B');
  });

  it('adds and removes MCP servers without clobbering existing entries', async () => {
    resetHome();
    seed(
      '~/.codex/config.toml',
      [
        '[mcp_servers."existing"]',
        'command = "node"',
        'args = ["s.js"]',
        'enabled = true',
      ].join('\n')
    );

    const a = getAdapter('chatgpt')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('fs', 'npx', ['-y', 'fs-mcp'], { T: '1' }));
    await a.addMCPServer(httpServer('remote', 'https://ex.com/mcp'));

    const mcp = parseConfig(readBack('~/.codex/config.toml'), 'toml') as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const servers = mcp.mcp_servers as Record<string, Record<string, unknown>>;
    expect(servers.existing.command).toBe('node');
    expect(servers.fs.command).toBe('npx');
    expect(servers.fs.env).toEqual({ T: '1' });
    expect(servers.remote.url).toBe('https://ex.com/mcp');

    await a.removeMCPServer('existing');
    const after = parseConfig(readBack('~/.codex/config.toml'), 'toml') as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const afterServers = after.mcp_servers as Record<string, Record<string, unknown>>;
    expect(afterServers.existing).toBeUndefined();
    expect(afterServers.fs).toBeDefined();
  });

  it('rejects permission rules and throws on malformed TOML', async () => {
    resetHome();
    const a = getAdapter('chatgpt')!;
    // Permission ops are explicitly unsupported
    await expect(a.addPermission({} as never)).rejects.toThrow(/does not support/);
    await expect(a.removePermission('x')).rejects.toThrow(/does not support/);

    // Malformed TOML config
    seed('~/.codex/config.toml', 'model = [unterminated');
    const a2 = getAdapter('chatgpt')!;
    await expect(a2.readConfig()).rejects.toThrow(/Failed to parse Codex config/);
  });

  it('backs up and restores the config file', async () => {
    resetHome();
    seed('~/.codex/config.toml', 'model = "gpt-4"\n');
    const a = getAdapter('chatgpt')!;
    const backupPath = await a.backupConfig();
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(readBack(path.relative(HOME, backupPath).replace(/\\/g, '/'))).toContain('gpt-4');

    // Corrupt the live file, then restore
    seed('~/.codex/config.toml', 'model = "broken"\n');
    await a.restoreConfig(backupPath);
    expect(readBack('~/.codex/config.toml')).toContain('gpt-4');
  });
});

// ---------------------------------------------------------------------------
// Gemini — same-file JSON, keyed MCP shape (thin generic adapter)
// ---------------------------------------------------------------------------
describe('gemini adapter (same-file keyed MCP)', () => {
  it('resolves the settings.json path and reports capability flags', () => {
    resetHome();
    const a = getAdapter('gemini')!;
    expect(a.info.id).toBe('gemini');
    expect(a.info.configFormat).toBe('json');
    expect(a.getConfigPath()).toBe(path.join(HOME, '.gemini', 'settings.json'));
    // Same-file mode: the MCP path IS the config path
    expect(a.getMCPConfigPath()).toBe(a.getConfigPath());
    expect(a.info.supports.modelProviders).toBe(false);
    expect(a.info.supports.mcpServers).toBe(true);
    expect(a.info.supports.permissions).toBe(false);
  });

  it('reads keyed mcpServers from settings.json and preserves unknown keys', async () => {
    resetHome();
    seed(
      '~/.gemini/settings.json',
      JSON.stringify({
        theme: 'dark',
        mcpServers: {
          codegraph: { type: 'stdio', command: 'codegraph', args: ['serve', '--mcp'] },
          remote: { type: 'http', url: 'https://ex.com/mcp' },
        },
        customKey: 'keep-me',
      })
    );
    const a = getAdapter('gemini')!;
    const cfg = await a.readConfig();

    expect(cfg.mcpServers.map((s) => s.name).sort()).toEqual(['codegraph', 'remote']);
    const cg = cfg.mcpServers.find((s) => s.name === 'codegraph')!;
    expect(cg.command).toBe('codegraph');
    expect(cg.args).toEqual(['serve', '--mcp']);
    const remote = cfg.mcpServers.find((s) => s.name === 'remote')!;
    expect(remote.url).toBe('https://ex.com/mcp');
    expect(remote.type).toBe('http');

    // No provider/model pollution for agents with modelProviders=false
    expect(cfg.modelProviders).toEqual([]);
    expect(cfg.models).toEqual([]);

    // No-op write preserves unknown keys
    await a.writeConfig(cfg);
    const written = JSON.parse(readBack('~/.gemini/settings.json'));
    expect(written.theme).toBe('dark');
    expect(written.customKey).toBe('keep-me');
    expect(written.mcpServers.codegraph.command).toBe('codegraph');
    expect(written.mcpServers.remote.url).toBe('https://ex.com/mcp');
  });

  it('adds and removes MCP servers inside settings.json', async () => {
    resetHome();
    seed(
      '~/.gemini/settings.json',
      JSON.stringify({
        mcpServers: {
          existing: { command: 'node', args: ['s.js'] },
        },
      })
    );
    const a = getAdapter('gemini')!;
    await a.readConfig();
    await a.addMCPServer(stdioServer('gh', 'npx', ['-y', 'gh-mcp'], { T: '1' }));

    const written = JSON.parse(readBack('~/.gemini/settings.json'));
    expect(written.mcpServers.existing.command).toBe('node');
    expect(written.mcpServers.gh.command).toBe('npx');
    expect(written.mcpServers.gh.args).toEqual(['-y', 'gh-mcp']);
    expect(written.mcpServers.gh.env).toEqual({ T: '1' });

    await a.removeMCPServer('existing');
    const after = JSON.parse(readBack('~/.gemini/settings.json'));
    expect(after.mcpServers.existing).toBeUndefined();
    expect(after.mcpServers.gh).toBeDefined();
  });

  it('backs up and restores, and errors on missing backup file', async () => {
    resetHome();
    seed('~/.gemini/settings.json', JSON.stringify({ theme: 'light' }));
    const a = getAdapter('gemini')!;
    const backupPath = await a.backupConfig();
    expect(fs.existsSync(backupPath)).toBe(true);

    seed('~/.gemini/settings.json', JSON.stringify({ theme: 'dark' }));
    await a.restoreConfig(backupPath);
    expect(JSON.parse(readBack('~/.gemini/settings.json')).theme).toBe('light');

    await expect(a.restoreConfig(path.join(HOME, 'nope.backup'))).rejects.toThrow(/not found/);
  });
});

// ---------------------------------------------------------------------------
// Junie — separate mcp.json, keyed MCP shape (thin generic adapter)
// ---------------------------------------------------------------------------
describe('junie adapter (separate mcp.json)', () => {
  it('routes MCP to mcp.json and leaves config.json untouched', async () => {
    resetHome();
    seed('~/.junie/config.json', JSON.stringify({ model: 'junie-pro', hooks: [] }));
    seed('~/.junie/mcp/mcp.json', JSON.stringify({ mcpServers: { keep: { command: 'k' } } }));

    const a = getAdapter('junie')!;
    expect(a.getConfigPath()).toBe(path.join(HOME, '.junie', 'config.json'));
    expect(a.getMCPConfigPath()).toBe(path.join(HOME, '.junie', 'mcp', 'mcp.json'));

    const cfg = await a.readConfig();
    expect(cfg.mcpServers.map((s) => s.name)).toEqual(['keep']);
    // Junie's model is backend-fixed — no provider/model surface
    expect(cfg.modelProviders).toEqual([]);

    await a.addMCPServer(stdioServer('fs', 'npx', ['-y', 'fs-mcp'], { K: 'v' }));
    const mcp = JSON.parse(readBack('~/.junie/mcp/mcp.json'));
    expect(mcp.mcpServers.keep.command).toBe('k');
    expect(mcp.mcpServers.fs.command).toBe('npx');
    expect(mcp.mcpServers.fs.env).toEqual({ K: 'v' });

    // The main config file is never polluted with MCP keys
    const config = JSON.parse(readBack('~/.junie/config.json'));
    expect(config.mcpServers).toBeUndefined();
    expect(config.model).toBe('junie-pro');
    expect(config.hooks).toEqual([]);

    // No-op write preserves unknown config keys
    await a.writeConfig(cfg);
    expect(JSON.parse(readBack('~/.junie/config.json')).model).toBe('junie-pro');
  });

  it('returns defaults when the config file is missing', async () => {
    resetHome();
    const a = getAdapter('junie')!;
    const cfg = await a.readConfig();
    expect(cfg.mcpServers).toEqual([]);
    expect(cfg.modelProviders).toEqual([]);
  });
});
