/**
 * Tests for Phase 1 (Secrets) M048: keychain wiring into registry materialization.
 *
 * Validates the full roundtrip:
 * 1. Register provider with keychain opt-in → key stored in keychain
 * 2. registry.json has keychainSecretRef but empty apiKey
 * 3. Materialize into agent config → resolves key from keychain
 * 4. Agent adapter receives the real key (not empty string)
 * 5. Agent config file has the working credential
 *
 * The keychain is MOCKED here (vi.mock of ./keychain); the manager's
 * actual materialization logic is tested against temp registry.json and
 * agent config files.
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
  getSecret: vi.fn(async (account: string) => {
    // When keychain is unavailable, act like nothing is stored (null response)
    if (!keychainAvailable) return null;
    return store.has(account) ? store.get(account)! : null;
  }),
  deleteSecret: vi.fn(async (account: string) => {
    store.delete(account);
    return keychainAvailable;
  }),
}));

import { AgentConfigManager } from './index';
import type { ModelProvider, ModelConfig } from './types';

let tmpHome: string;

function makeProvider(id: string, apiKey: string): ModelProvider {
  return {
    id,
    name: `Provider ${id}`,
    type: 'openai-compatible',
    config: {
      baseUrl: 'https://api.example.com/v1',
      apiKey,
    },
    enabled: true,
    priority: 10,
  };
}

function makeModel(id: string, providerId: string): ModelConfig {
  return {
    id,
    providerId,
    name: `Model ${id}`,
    displayName: `Model ${id}`,
    roles: ['chat'],
  };
}

describe('Phase 1 (Secrets) M048: Registry Materialization with Keychain', () => {
  let manager: AgentConfigManager;
  let configPath: string;

  beforeEach(async () => {
    store.clear();
    keychainAvailable = true;
    vi.clearAllMocks();
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aion-m048-'));
    process.env.HOME = tmpHome;
    process.env.AI_CONFIG_HOME = path.join(tmpHome, '.ai-agent-config');

    // Create a test agent config file (generic JSON adapter)
    configPath = path.join(tmpHome, 'test-agent.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          version: '1.0',
          lastModified: Date.now(),
          modelProviders: [],
          models: [],
          mcpServers: [],
          permissions: [],
          customSettings: {},
        },
        null,
        2
      )
    );

    manager = new AgentConfigManager();
    await manager.initRegistry();

    // Register a custom agent with the test config path
    await manager.addCustomAgent({
      id: 'test-agent',
      name: 'Test Agent',
      configPath,
    });
  });

  afterEach(() => {
    delete process.env.HOME;
    delete process.env.AI_CONFIG_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('M048: roundtrip — keychain-backed provider → materialized with real key', async () => {
    const realKey = `sk-m048-roundtrip-${Date.now()}`;
    const provider = makeProvider('openai-m048', realKey);
    const models = [makeModel('gpt-4-m048', 'openai-m048')];

    // Step 1: Register with keychain opt-in
    // Note: registerProvider calls syncAgents at the end, so step 5 happens automatically
    const registerResult = await manager.registerProvider(
      provider,
      models,
      ['test-agent'],
      undefined,
      true // keychainStorage: true
    );
    expect(registerResult.success).toBe(true);

    // Step 2: Verify registry.json has the reference but NOT the real key
    const registryPath = path.join(process.env.AI_CONFIG_HOME!, 'registry.json');
    const registryContent = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const entry = registryContent.providers.find((p: any) => p.provider.id === 'openai-m048');

    expect(entry).toBeDefined();
    expect(entry.keychainSecretRef).toBe('provider:openai-m048');
    expect(entry.provider.config.apiKey).toBe(''); // Empty string, not the real key
    expect(JSON.stringify(registryContent)).not.toContain(realKey); // Raw key absent from file

    // Step 3: Verify the real key is in the (mocked) keychain
    expect(store.get('provider:openai-m048')).toBe(realKey);

    // Step 4 & 5 (combined): registerProvider already materialized into the agent config
    // Verify the agent config has the REAL key (resolved from keychain during materialization)
    const agentConfigAfter = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(agentConfigAfter.modelProviders).toHaveLength(1);
    const materializedProvider = agentConfigAfter.modelProviders[0];

    expect(materializedProvider.id).toBe('openai-m048');
    expect(materializedProvider.config.apiKey).toBe(realKey);
    expect(materializedProvider.config.baseUrl).toBe('https://api.example.com/v1');

    // Step 6: Verify models were also materialized
    expect(agentConfigAfter.models).toHaveLength(1);
    const materializedModel = agentConfigAfter.models[0];
    expect(materializedModel.id).toBe('gpt-4-m048');
    expect(materializedModel.providerId).toBe('openai-m048');
  });

  it('M048: plaintext provider (no keychain) still materializes with its original key', async () => {
    const plainKey = 'sk-m048-plaintext-old-style';
    const provider = makeProvider('openai-plain', plainKey);
    const models = [makeModel('gpt-4-plain', 'openai-plain')];

    // Register WITHOUT keychain opt-in (keychainStorage: false or omitted)
    const registerResult = await manager.registerProvider(provider, models, ['test-agent']);
    expect(registerResult.success).toBe(true);

    // Verify registry has plaintext key (no keychainSecretRef)
    const registryPath = path.join(process.env.AI_CONFIG_HOME!, 'registry.json');
    const registryContent = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const entry = registryContent.providers.find((p: any) => p.provider.id === 'openai-plain');

    expect(entry.keychainSecretRef).toBeUndefined();
    expect(entry.provider.config.apiKey).toBe(plainKey);

    // Materialize
    await (manager as any).syncAgents(['test-agent']);

    // Agent config should have the plaintext key (unchanged path)
    const agentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const materializedProvider = agentConfig.modelProviders[0];
    expect(materializedProvider.config.apiKey).toBe(plainKey);
  });

  it('M048: keychain-backed provider with missing entry returns null key gracefully', async () => {
    const provider = makeProvider('openai-missing', 'sk-initial');
    const models = [makeModel('gpt-4-missing', 'openai-missing')];

    // Register with keychain
    const registerResult = await manager.registerProvider(
      provider,
      models,
      ['test-agent'],
      undefined,
      true
    );
    expect(registerResult.success).toBe(true);

    // Manually delete the keychain entry (simulate missing key scenario)
    store.delete('provider:openai-missing');

    // Materialize should degrade gracefully: the entry exists in the registry
    // but the keychain entry is missing. The resolveProviderApiKey returns null,
    // and the key remains empty in the materialized config.
    await (manager as any).syncAgents(['test-agent']);

    const agentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const materializedProvider = agentConfig.modelProviders[0];
    // When resolution returns null, the key stays empty (was never set in the provider)
    expect(materializedProvider.config.apiKey).toBe('');
  });

  it('M048: keychain-backed provider still materializes even when keychain becomes unavailable', async () => {
    const realKey = `sk-m048-unavailable-${Date.now()}`;
    const provider = makeProvider('openai-unavail', realKey);
    const models = [makeModel('gpt-4-unavail', 'openai-unavail')];

    // Register with keychain
    const registerResult = await manager.registerProvider(
      provider,
      models,
      ['test-agent'],
      undefined,
      true
    );
    expect(registerResult.success).toBe(true);
    expect(store.get('provider:openai-unavail')).toBe(realKey);

    // Simulate keychain becoming unavailable (e.g., locked, CI environment, etc.)
    keychainAvailable = false;

    // Materialize should degrade gracefully: getSecret returns null (not error)
    await (manager as any).syncAgents(['test-agent']);

    const agentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const materializedProvider = agentConfig.modelProviders[0];
    // Resolution returned null (unavailable), key stays empty
    expect(materializedProvider.config.apiKey).toBe('');
  });

  it('M048: multiple keychain-backed providers materialize independently', async () => {
    const key1 = `sk-m048-provider1-${Date.now()}`;
    const key2 = `sk-m048-provider2-${Date.now()}`;

    const provider1 = makeProvider('openai-multi-1', key1);
    const provider2 = makeProvider('anthropic-multi-1', key2);

    const models1 = [makeModel('gpt-4', 'openai-multi-1')];
    const models2 = [makeModel('claude-3', 'anthropic-multi-1')];

    // Register both with keychain
    let result = await manager.registerProvider(provider1, models1, ['test-agent'], undefined, true);
    expect(result.success).toBe(true);

    result = await manager.registerProvider(provider2, models2, ['test-agent'], undefined, true);
    expect(result.success).toBe(true);

    // Verify both keys are in the keychain
    expect(store.get('provider:openai-multi-1')).toBe(key1);
    expect(store.get('provider:anthropic-multi-1')).toBe(key2);

    // Materialize
    await (manager as any).syncAgents(['test-agent']);

    const agentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(agentConfig.modelProviders).toHaveLength(2);

    const p1 = agentConfig.modelProviders.find((p: any) => p.id === 'openai-multi-1');
    const p2 = agentConfig.modelProviders.find((p: any) => p.id === 'anthropic-multi-1');

    expect(p1.config.apiKey).toBe(key1);
    expect(p2.config.apiKey).toBe(key2);
  });
});
