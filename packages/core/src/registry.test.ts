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
  return { provider, models: [], agentIds: [], ...(keychainSecretRef ? { keychainSecretRef } : {}) };
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
    const entry = makeEntry(
      makeProvider('p1', ''),
      'provider:p1'
    );
    store.set('provider:p1', 'sk-from-keychain');
    const resolved = await resolveProviderApiKey(entry);
    expect(resolved).toBe('sk-from-keychain');
    expect(keychain.getSecret).toHaveBeenCalledWith('provider:p1');
  });

  it('returns null (no throw) when the keychain entry is missing or unavailable', async () => {
    const entry = makeEntry(makeProvider('p1', ''), 'provider:missing');
    expect(await resolveProviderApiKey(entry)).toBeNull();
    keychainAvailable = false;
    expect(await resolveProviderApiKey(makeEntry(makeProvider('p2', ''), 'provider:p2'))).toBeNull();
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
    const result = await manager.registerProvider(
      makeProvider('p-plain', 'sk-plain-123'),
      [],
      []
    );
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
    expect(readRegistryFile().providers.find((p: any) => p.provider.id === 'p-del')).toBeUndefined();

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
    expect(readRegistryFile().providers.find((p: any) => p.provider.id === 'p-del2')).toBeUndefined();
    expect(keychain.deleteSecret).toHaveBeenCalledWith('provider:p-del2');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
