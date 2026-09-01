/**
 * Tests for the Phase 1 (Secrets) keychain wiring in the registry layer.
 *
 * The OS keychain itself is MOCKED here (vi.mock of ./keychain) — these tests
 * exercise the WIRING (resolution, opt-in registration, deletion cleanup),
 * not the keychain module (that is keychain.test.ts's job).
 *
 * The manager tests run against a temp AI_CONFIG_HOME so no real registry is
 * touched and the serialized registry.json can be asserted on directly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// In-memory fake keychain backing the mocked ./keychain module.
const store = new Map<string, string>();
let keychainAvailable = true;

vi.mock('./keychain', () => ({
  KEYCHAIN_SERVICE: 'ai-agent-config',
  isKeychainAvailable: vi.fn(async () => keychainAvailable),
  setSecret: vi.fn(async (account: string, value: string) => {
    if (!keychainAvailable) {
      const err = new Error(`Could not write to the OS keychain for account "${account}"`);
      err.name = 'KeychainError';
      throw err;
    }
    store.set(account, value);
  }),
  getSecret: vi.fn(async (account: string) => (store.has(account) ? store.get(account)! : null)),
  deleteSecret: vi.fn(async (account: string) => {
    store.delete(account);
    return keychainAvailable;
  }),
}));

import { AgentConfigManager } from './index';
import * as keychain from './keychain';
import {
  resolveProviderApiKey,
  keychainRefForProvider,
  storeProviderApiKeyInKeychain,
  migrateProviderApiKeyToKeychain,
} from './registry';
import type { ModelProvider, RegistryProvider } from './types';

let tmpHome: string;

function makeProvider(id = 'p1', apiKey?: string): ModelProvider {
  return {
    id,
    name: 'Test Provider',
    type: 'openai-compatible',
    config: { baseUrl: 'https://example.com/v1', ...(apiKey ? { apiKey } : {}) },
    enabled: true,
    priority: 10,
  };
}

function makeEntry(provider: ModelProvider, keychainSecretRef?: string): RegistryProvider {
  return {
    provider,
    models: [],
    agentIds: [],
    ...(keychainSecretRef ? { keychainSecretRef } : {}),
  };
}

describe('resolveProviderApiKey', () => {
  beforeEach(() => {
    store.clear();
    keychainAvailable = true;
    vi.clearAllMocks();
  });

  it('returns the plaintext config.apiKey unchanged when no keychainSecretRef is set', async () => {
    const entry = makeEntry(makeProvider('p1', 'sk-plaintext-123'));
    const resolved = await resolveProviderApiKey(entry);
    expect(resolved).toBe('sk-plaintext-123');
    expect(keychain.getSecret).not.toHaveBeenCalled();
  });

  it('returns null for a plaintext provider without any apiKey', async () => {
    const entry = makeEntry(makeProvider('p1'));
    expect(await resolveProviderApiKey(entry)).toBeNull();
  });

  it('fetches from the keychain when keychainSecretRef is set', async () => {
    const entry = makeEntry(makeProvider('p1', ''), 'provider:p1');
    store.set('provider:p1', 'sk-from-keychain');
    const resolved = await resolveProviderApiKey(entry);
    expect(resolved).toBe('sk-from-keychain');
    expect(keychain.getSecret).toHaveBeenCalledWith('provider:p1');
  });

  it('returns null (no throw) when the keychain entry is missing or unavailable', async () => {
    const entry = makeEntry(makeProvider('p1', ''), 'provider:missing');
    expect(await resolveProviderApiKey(entry)).toBeNull();
    keychainAvailable = false;
    expect(
      await resolveProviderApiKey(makeEntry(makeProvider('p2', ''), 'provider:p2'))
    ).toBeNull();
  });
});

describe('AgentConfigManager importRegistry portability warnings (M061)', () => {
  let manager: AgentConfigManager;

  beforeEach(async () => {
    store.clear();
    keychainAvailable = true;
    vi.clearAllMocks();
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-m061-'));
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

  it('warns for a keychain-backed provider but still succeeds the import', async () => {
    const result = await manager.importRegistry({
      providers: [
        {
          provider: makeProvider('p-kc', ''),
          models: [],
          agentIds: [],
          keychainSecretRef: 'provider:p-kc',
        },
      ],
      mcpServers: [],
      customAgents: [],
    });
    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      "Provider 'Test Provider' was exported with a keychain-stored key. The real key does not travel with the export; you'll need to re-enter it.",
    ]);
  });

  it('warns for a custom agent whose config path is from a different OS, but still succeeds', async () => {
    const foreignPath =
      process.platform === 'win32'
        ? '/Users/someone/.agent/config.json'
        : 'C:\\Users\\someone\\.agent\\config.json';
    const result = await manager.importRegistry({
      providers: [],
      mcpServers: [],
      customAgents: [{ id: 'foreign-agent', name: 'Foreign Agent', configPath: foreignPath }],
    });
    expect(result.success).toBe(true);
    // Two warnings: the portability notice, plus the materialization refusal
    // (the foreign path is never written to — no literal `C:\...` file).
    expect(result.warnings).toEqual([
      "Custom agent 'Foreign Agent's config path looks like it's from a different OS. Update it before it's used.",
      'foreign-agent: Error: Refusing to write config to "C:\\Users\\someone\\.agent\\config.json": not a valid absolute path on this OS',
    ]);
    // The guard must have prevented any literal file from being created in the cwd.
    expect(fs.existsSync(foreignPath)).toBe(false);
  });

  it('produces no portability warnings for a clean same-OS registry', async () => {
    // A path under the test's own tmp home: same-OS (no foreign-path warning)
    // AND writable (no materialize error), so the import is fully clean.
    const localPath = path.join(tmpHome, 'local-agent-config.json');
    const result = await manager.importRegistry({
      providers: [{ provider: makeProvider('p-plain', 'sk-plain'), models: [], agentIds: [] }],
      mcpServers: [],
      customAgents: [{ id: 'local-agent', name: 'Local Agent', configPath: localPath }],
    });
    expect(result.success).toBe(true);
    expect(result.warnings ?? []).toEqual([]);
  });
});

describe('keychainRefForProvider', () => {
  it('is deterministic and names the provider', () => {
    expect(keychainRefForProvider('openai-main')).toBe('provider:openai-main');
    expect(keychainRefForProvider('x')).toBe(keychainRefForProvider('x'));
  });
});

describe('storeProviderApiKeyInKeychain', () => {
  beforeEach(() => {
    store.clear();
    keychainAvailable = true;
    vi.clearAllMocks();
  });

  it('stores the key under provider:<id> and blanks config.apiKey', async () => {
    const { keychainSecretRef, provider } = await storeProviderApiKeyInKeychain(
      makeProvider('p1', 'sk-real-key')
    );
    expect(keychainSecretRef).toBe('provider:p1');
    expect(store.get('provider:p1')).toBe('sk-real-key');
    expect(provider.config.apiKey).toBe('');
    // The input provider object is not mutated.
    expect(makeProvider('p1', 'sk-real-key').config.apiKey).toBe('sk-real-key');
  });

  it('fails cleanly when the keychain is unavailable — never falling back to plaintext', async () => {
    keychainAvailable = false;
    const provider = makeProvider('p1', 'sk-real-key');
    await expect(storeProviderApiKeyInKeychain(provider)).rejects.toThrow(/keychain/i);
    expect(provider.config.apiKey).toBe('sk-real-key'); // untouched, not persisted anywhere
    expect(store.size).toBe(0);
  });
});

describe('migrateProviderApiKeyToKeychain', () => {
  let registryPath: string;

  function writeRegistryFile(entry: Record<string, unknown>): string {
    const registry = {
      version: 1,
      providers: [entry],
      mcpServers: [],
      customAgents: [],
      updatedAt: 0,
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    return registryPath;
  }

  function readRegistryFile(): any {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  }

  beforeEach(() => {
    store.clear();
    keychainAvailable = true;
    vi.clearAllMocks();
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-m068-'));
    registryPath = path.join(tmpHome, 'registry.json');
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('successful migration sets keychainSecretRef and empties config.apiKey', async () => {
    const realKey = `sk-m068-real-${Date.now()}`;
    writeRegistryFile({
      provider: makeProvider('m1', realKey),
      models: [],
      agentIds: [],
    });

    const result = await migrateProviderApiKeyToKeychain(registryPath, 'm1');
    expect('error' in result).toBe(false);
    if ('error' in result) throw new Error('expected success');
    expect(result.keychainSecretRef).toBe('provider:m1');

    // The real key went to the (mocked) keychain…
    expect(store.get('provider:m1')).toBe(realKey);
    // …and is GONE from the serialized registry file.
    const file = readRegistryFile();
    const entry = file.providers.find((p: any) => p.provider.id === 'm1');
    expect(entry.keychainSecretRef).toBe('provider:m1');
    expect(entry.provider.config.apiKey).toBe('');
    expect(JSON.stringify(file)).not.toContain(realKey);

    // Resolution now round-trips through the keychain.
    expect(await resolveProviderApiKey(entry)).toBe(realKey);
  });

  it('already-migrated returns a clear error and makes no changes', async () => {
    const key = 'sk-m068-already';
    const before = writeRegistryFile({
      provider: makeProvider('m2', key),
      models: [],
      agentIds: [],
      keychainSecretRef: 'provider:m2',
    });
    const beforeContent = fs.readFileSync(before, 'utf8');

    const result = await migrateProviderApiKeyToKeychain(registryPath, 'm2');
    expect(result).toEqual({
      error: expect.stringMatching(/already stored in the OS keychain/i),
    });
    // No keychain write, no registry change.
    expect(keychain.setSecret).not.toHaveBeenCalled();
    expect(fs.readFileSync(before, 'utf8')).toBe(beforeContent);
  });

  it('nothing-to-migrate (empty apiKey) returns a clear error and makes no changes', async () => {
    const before = writeRegistryFile({
      provider: makeProvider('m3', ''),
      models: [],
      agentIds: [],
    });
    const beforeContent = fs.readFileSync(before, 'utf8');

    const result = await migrateProviderApiKeyToKeychain(registryPath, 'm3');
    expect(result).toEqual({
      error: expect.stringMatching(/no plaintext API key to migrate/i),
    });
    expect(keychain.setSecret).not.toHaveBeenCalled();
    expect(fs.readFileSync(before, 'utf8')).toBe(beforeContent);
  });

  it('returns a clear error for an unknown provider id', async () => {
    writeRegistryFile({ provider: makeProvider('m4', 'sk-x'), models: [], agentIds: [] });
    const result = await migrateProviderApiKeyToKeychain(registryPath, 'nope');
    expect(result).toEqual({ error: expect.stringMatching(/not found in registry/i) });
  });

  it('a simulated keychain-write failure leaves the registry completely unchanged', async () => {
    keychainAvailable = false;
    const realKey = `sk-m068-fail-${Date.now()}`;
    const before = writeRegistryFile({
      provider: makeProvider('m5', realKey),
      models: [],
      agentIds: [],
    });
    const beforeContent = fs.readFileSync(before, 'utf8');

    const result = await migrateProviderApiKeyToKeychain(registryPath, 'm5');
    expect(result).toEqual({ error: expect.stringMatching(/keychain/i) });
    // The plaintext key is still in place — the key can never be gone from
    // both places — and the file is byte-for-byte unchanged (no partial state).
    const file = readRegistryFile();
    const entry = file.providers.find((p: any) => p.provider.id === 'm5');
    expect(entry.provider.config.apiKey).toBe(realKey);
    expect(entry.keychainSecretRef).toBeUndefined();
    expect(fs.readFileSync(before, 'utf8')).toBe(beforeContent);
    expect(store.size).toBe(0);
  });
});

describe('AgentConfigManager keychain opt-in registration', () => {
  let manager: AgentConfigManager;

  beforeEach(async () => {
    store.clear();
    keychainAvailable = true;
    vi.clearAllMocks();
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-m056-'));
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

  function readRegistryFile(): any {
    const p = path.join(process.env.AI_CONFIG_HOME!, 'registry.json');
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  it('opt-in registration never writes the real key to registry.json', async () => {
    const realKey = `sk-m056-real-${Date.now()}`;
    const result = await manager.registerProvider(
      makeProvider('p-keychain', realKey),
      [],
      [],
      undefined,
      true
    );
    expect(result.success).toBe(true);

    const file = readRegistryFile();
    const entry = file.providers.find((p: any) => p.provider.id === 'p-keychain');
    expect(entry).toBeDefined();
    // The ref IS persisted...
    expect(entry.keychainSecretRef).toBe('provider:p-keychain');
    // ...and the raw key string appears NOWHERE in the serialized file.
    expect(JSON.stringify(file)).not.toContain(realKey);
    // Documented shape: apiKey is stored as an empty string.
    expect(entry.provider.config.apiKey).toBe('');
    // The real key went to the (mocked) keychain.
    expect(store.get('provider:p-keychain')).toBe(realKey);

    // Resolution round-trips through the keychain.
    expect(await resolveProviderApiKey(entry)).toBe(realKey);
  });

  it('non-opt-in registration is byte-for-byte unchanged (no keychain calls, key stays plaintext)', async () => {
    const result = await manager.registerProvider(makeProvider('p-plain', 'sk-plain-123'), [], []);
    expect(result.success).toBe(true);
    const file = readRegistryFile();
    const entry = file.providers.find((p: any) => p.provider.id === 'p-plain');
    expect(entry.provider.config.apiKey).toBe('sk-plain-123');
    expect(entry.keychainSecretRef).toBeUndefined();
    expect(keychain.setSecret).not.toHaveBeenCalled();
    expect(keychain.isKeychainAvailable).not.toHaveBeenCalled();
  });

  it('a failed keychain write fails the registration cleanly with no plaintext fallback', async () => {
    keychainAvailable = false;
    const realKey = `sk-m056-fail-${Date.now()}`;
    const result = await manager.registerProvider(
      makeProvider('p-fail', realKey),
      [],
      [],
      undefined,
      true
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/keychain/i);
    // Nothing persisted: no registry entry, no plaintext key anywhere.
    const file = readRegistryFile();
    expect(file.providers.find((p: any) => p.provider.id === 'p-fail')).toBeUndefined();
    expect(JSON.stringify(file)).not.toContain(realKey);
    expect(store.size).toBe(0);
  });

  it('refuses keychain storage for an already-registered provider (new providers only)', async () => {
    const first = await manager.registerProvider(makeProvider('p-ex', 'sk-1'), [], []);
    expect(first.success).toBe(true);
    const second = await manager.registerProvider(
      makeProvider('p-ex', 'sk-2'),
      [],
      [],
      undefined,
      true
    );
    expect(second.success).toBe(false);
    expect(second.error).toMatch(/already registered/i);
  });

  it('deleteProvider removes the keychain entry and tolerates a keychain-deletion failure', async () => {
    const result = await manager.registerProvider(
      makeProvider('p-del', 'sk-del-key'),
      [],
      [],
      undefined,
      true
    );
    expect(result.success).toBe(true);
    expect(store.has('provider:p-del')).toBe(true);

    // Normal case: the keychain entry is cleaned up with the registry entry.
    const deleted = await manager.deleteProvider('p-del');
    expect(deleted.success).toBe(true);
    expect(keychain.deleteSecret).toHaveBeenCalledWith('provider:p-del');
    expect(store.has('provider:p-del')).toBe(false);
    expect(
      readRegistryFile().providers.find((p: any) => p.provider.id === 'p-del')
    ).toBeUndefined();

    // Failing keychain: the registry deletion still succeeds (warning only).
    const result2 = await manager.registerProvider(
      makeProvider('p-del2', 'sk-del-key-2'),
      [],
      [],
      undefined,
      true
    );
    expect(result2.success).toBe(true);
    keychainAvailable = false; // deleteSecret now reports failure
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deleted2 = await manager.deleteProvider('p-del2');
    expect(deleted2.success).toBe(true);
    expect(
      readRegistryFile().providers.find((p: any) => p.provider.id === 'p-del2')
    ).toBeUndefined();
    expect(keychain.deleteSecret).toHaveBeenCalledWith('provider:p-del2');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('M069: migrateProviderApiKeyToKeychain works as the FIRST registry call on a fresh manager', async () => {
    // The registry file already exists on disk with a plaintext-key provider,
    // but the manager instance has NOT called initRegistry/getRegistryState/
    // registerProvider yet — registryFilePath must be resolved lazily via
    // requireRegistry() inside the method itself.
    const realKey = `sk-m069-first-call-${Date.now()}`;
    const registryPath = path.join(process.env.AI_CONFIG_HOME!, 'registry.json');
    fs.writeFileSync(
      registryPath,
      JSON.stringify(
        {
          version: 1,
          providers: [
            {
              provider: makeProvider('p-m069', realKey),
              models: [],
              agentIds: [],
            },
          ],
          mcpServers: [],
          customAgents: [],
          updatedAt: 0,
        },
        null,
        2
      )
    );

    const freshManager = new AgentConfigManager();
    const result = await freshManager.migrateProviderApiKeyToKeychain('p-m069');

    // Before the M069 fix this returned { success: false, error:
    // "No registry found at  — nothing to migrate." } (empty path).
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('expected success');
    expect(
      result.data.providers.find((p: any) => p.provider.id === 'p-m069')?.keychainSecretRef
    ).toBe('provider:p-m069');
    expect(store.get('provider:p-m069')).toBe(realKey);

    const file = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const entry = file.providers.find((p: any) => p.provider.id === 'p-m069');
    expect(entry.keychainSecretRef).toBe('provider:p-m069');
    expect(entry.provider.config.apiKey).toBe('');
    expect(JSON.stringify(file)).not.toContain(realKey);
  });
});
