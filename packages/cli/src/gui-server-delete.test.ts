// Regression tests for the user-reported broken provider delete.
//
// These drive the REAL gui-server over HTTP with the exact URLs the GUI
// generates (packages/gui/src/api.ts uses encodeURIComponent on ids), so the
// full path is covered: GUI-style request -> server route -> core cascade.
//
// Symptom 1: Delete on a provider installed in MULTIPLE agents does nothing
//            at all (no removal, no error) when any affected agent fails to
//            materialize — the server returns a 4xx and the GUI swallowed it.
// Symptom 2: Delete on a provider in exactly ONE agent shows a success toast
//            but nothing changes — percent-encoded ids were passed to the
//            core undecoded, and the core no-ops successfully on unknown ids.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentConfigManager } from '@ai-agent-config/core';
import type { ModelConfig, ModelProvider } from '@ai-agent-config/core';
import { startGuiServer, type GUIServerHandle } from './gui-server';

const PORT = 42117;

let tmpHome: string;
let manager: AgentConfigManager;
let handle: GUIServerHandle;

function makeProvider(id: string): ModelProvider {
  return {
    id,
    name: id,
    type: 'openai-compatible',
    config: { baseUrl: 'https://example.com/v1', apiKey: 'sk-test' },
    enabled: true,
    priority: 0,
  };
}

function makeModel(providerId: string): ModelConfig {
  return {
    id: `${providerId}-model`,
    name: `${providerId} model`,
    providerId,
    displayName: `${providerId} model`,
    roles: ['chat'],
    capabilities: ['tool_use'],
  };
}

/** Issue a request exactly the way packages/gui/src/api.ts does. */
async function api(method: string, urlPath: string, body?: unknown) {
  const res = await fetch(`http://127.0.0.1:${PORT}${urlPath}?t=${handle.token}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** Registry providers as the dashboard sees them (GET /api/state). */
async function dashboardProviders(): Promise<any[]> {
  const { json } = await api('GET', '/api/state');
  return json.data.registry.providers;
}

beforeAll(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'acm-gui-delete-'));
  process.env.HOME = tmpHome;
  process.env.AI_CONFIG_HOME = path.join(tmpHome, '.ai-agent-config');

  manager = new AgentConfigManager();
  await manager.initRegistry();
  for (const id of ['agent-a', 'agent-b']) {
    const added = await manager.addCustomAgent({
      id,
      name: id,
      configPath: path.join(tmpHome, `${id}.json`),
      format: 'json',
    });
    expect(added.success).toBe(true);
  }

  handle = await startGuiServer(manager, { port: PORT, openBrowser: false });
});

afterAll(async () => {
  if (handle) await handle.close();
  delete process.env.HOME;
  delete process.env.AI_CONFIG_HOME;
  if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('provider delete through the gui-server', () => {
  it(
    'control: delete of a clean-id provider in two agents cascades everywhere',
    async () => {
      const reg = await manager.registerProvider(
        makeProvider('clean-provider'),
        [makeModel('clean-provider')],
        ['agent-a', 'agent-b']
      );
      expect(reg.success).toBe(true);

      const { status, json } = await api('DELETE', '/api/providers/clean-provider');
      expect(status).toBe(200);
      expect(json.ok).toBe(true);

      const providers = await dashboardProviders();
      expect(providers.find((p) => p.provider.id === 'clean-provider')).toBeUndefined();
    },
    15000
  );

  it('SYMPTOM 2: remove-from-agent with a spaced id (GUI-encoded URL) actually removes', async () => {
    const id = 'icm llm router';
    const reg = await manager.registerProvider(makeProvider(id), [makeModel(id)], ['agent-a']);
    expect(reg.success).toBe(true);

    // Exactly what packages/gui/src/api.ts#removeProviderAgent sends.
    const { status, json } = await api(
      'DELETE',
      `/api/providers/${encodeURIComponent(id)}/agents/agent-a`
    );
    expect(status).toBe(200);
    expect(json.ok).toBe(true);

    const providers = await dashboardProviders();
    const entry = providers.find((p) => p.provider.id === id);
    expect(entry).toBeDefined();
    expect(entry.agentIds).not.toContain('agent-a');
  });

  it('SYMPTOM 2b: full delete with a spaced id (GUI-encoded URL) actually removes', async () => {
    const id = 'icm llm router';
    const providers0 = await dashboardProviders();
    expect(providers0.find((p) => p.provider.id === id)).toBeDefined();

    // Exactly what packages/gui/src/api.ts#deleteProvider sends.
    const { status, json } = await api('DELETE', `/api/providers/${encodeURIComponent(id)}`);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);

    const providers = await dashboardProviders();
    expect(providers.find((p) => p.provider.id === id)).toBeUndefined();
  });

  it('SYMPTOM 1: multi-agent delete with one unreadable agent config fails loudly (never silent, never false success)', async () => {
    const reg = await manager.registerProvider(
      makeProvider('blocked-provider'),
      [makeModel('blocked-provider')],
      ['agent-a', 'agent-b']
    );
    expect(reg.success).toBe(true);

    // Simulate agent-b's config becoming unreadable after install (corrupt /
    // half-written file, uninstalled app, ...).
    fs.writeFileSync(path.join(tmpHome, 'agent-b.json'), '{ not valid json');

    const { status, json } = await api('DELETE', '/api/providers/blocked-provider');

    // The write to agent-b genuinely failed: the response must NOT claim
    // success (that is the toast-on-failed-write the user report warns about),
    // and the error must name the blocking agent so the UI can surface it.
    expect(json.ok).toBe(false);
    expect(status).toBeGreaterThanOrEqual(400);
    expect(String(json.error)).toContain('agent-b');
  });
});
