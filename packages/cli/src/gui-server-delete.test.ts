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
  const res = await fetch(`http://127.0.0.1:${handle.port}${urlPath}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** Registry providers as the server's own /api/state sees them (same registry
 *  source, read via the manager so we skip the unrelated detectAgents() scan
 *  that /api/state bundles — that scan is slow and irrelevant to the delete
 *  regression, and it is what pushed the suite over vitest's timeout under
 *  load). The DELETE calls still go over HTTP as the dashboard sends them. */
async function dashboardProviders(): Promise<any[]> {
  const state = await manager.getRegistryState();
  return state.providers;
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

  handle = await startGuiServer(manager, { port: 0, openBrowser: false });
});

afterAll(async () => {
  if (handle) await handle.close();
  delete process.env.HOME;
  delete process.env.AI_CONFIG_HOME;
  if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('provider delete through the gui-server', () => {
  it('control: delete of a clean-id provider in two agents cascades everywhere', async () => {
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
  }, 15000);

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

describe('custom agent delete with percent-encoded ids (QA finding C1)', () => {
  it('the exact QA repro: create ../evil, percent-encoded delete is rejected at creation', async () => {
    // QA repro step 1: POST /api/agents/custom with a traversal id.
    const created = await api('POST', '/api/agents/custom', {
      id: '../evil',
      name: 'x',
      configPath: path.join(tmpHome, 'evil.json'),
    });
    // Creation-time validation now rejects the id, so the zombie entry is
    // never created in the first place.
    expect(created.status).toBe(400);
    expect(created.json.ok).toBe(false);
    expect(String(created.json.error)).toContain('Invalid agent id');

    // The registry (in-memory AND on-disk) holds no trace of it.
    const state = await manager.getRegistryState();
    expect(state.customAgents.some((a) => a.id === '../evil')).toBe(false);

    // QA repro step 2: the GUI-style percent-encoded DELETE cannot 400 with
    // a misleading "not found" for a stored entry — nothing was stored.
    const del = await api('DELETE', `/api/agents/custom/${encodeURIComponent('../evil')}`);
    expect(del.status).toBe(400);
    expect(del.json.ok).toBe(false);
  });

  it('well-formed but special-character ids (spaces) round-trip: create, delete via encoded URL', async () => {
    const id = 'my custom agent';
    const created = await api('POST', '/api/agents/custom', {
      id,
      name: 'My Custom Agent',
      configPath: path.join(tmpHome, 'my-custom-agent.json'),
    });
    expect(created.status).toBe(200);
    expect(created.json.ok).toBe(true);

    // GUI-style delete: encodeURIComponent('my custom agent') === 'my%20custom%20agent'.
    const del = await api('DELETE', `/api/agents/custom/${encodeURIComponent(id)}`);
    expect(del.status).toBe(200);
    expect(del.json.ok).toBe(true);

    const state = await manager.getRegistryState();
    expect(state.customAgents.some((a) => a.id === id)).toBe(false);
  });

  // QA finding M1: missing `name`/`id` must be a clean 400, not a 500 TypeError.
  it('QA M1: POST /api/agents/custom without an id returns 400 with a clean error (exact QA repro)', async () => {
    const { status, json } = await api('POST', '/api/agents/custom', {
      configPath: path.join(tmpHome, 'x.json'),
      mcpPath: path.join(tmpHome, 'x-mcp.json'),
      format: 'yaml',
    });
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toBe('Agent id is required');
    expect(String(json.error)).not.toContain('TypeError');
  });

  // CSRF guard: a state-changing request carrying a cross-origin Origin must be
  // rejected with 403, even though the server is loopback-only. A same-origin
  // request (Origin matching the Host) and a headerless CLI/curl call both pass.
  it('CSRF: a cross-origin POST is rejected with 403', async () => {
    const res = await fetch(`http://127.0.0.1:${handle.port}/api/agents/custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://evil.example.com',
      },
      body: JSON.stringify({ id: 'hax', configPath: path.join(tmpHome, 'hax.json') }),
    });
    expect(res.status).toBe(403);
    const json: any = await res.json();
    expect(json.ok).toBe(false);
    expect(String(json.error)).toMatch(/CSRF/);
  });

  it('CSRF: a same-origin POST passes the guard (reaches the route)', async () => {
    const host = `127.0.0.1:${handle.port}`;
    const res = await fetch(`http://127.0.0.1:${handle.port}/api/agents/custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: `http://${host}`,
      },
      body: JSON.stringify({}),
    });
    // Not a CSRF 403 — it reaches the route and fails validation (400, 'Agent id is required').
    expect(res.status).toBe(400);
  });

  // QA finding M4: a no-op PUT must say so explicitly (`changed: false`).
  it('QA M4: PUT /api/agents/custom/:id with an empty body reports changed:false', async () => {
    const { status, json } = await api('PUT', '/api/agents/custom/agent-a', {});
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.changed).toBe(false);
  });

  it('QA M4: PUT /api/agents/custom/:id with a real field reports changed:true', async () => {
    const { status, json } = await api('PUT', '/api/agents/custom/agent-a', {
      name: 'Agent A (renamed)',
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.changed).toBe(true);

    const state = await manager.getRegistryState();
    expect(state.customAgents.find((a) => a.id === 'agent-a')?.name).toBe('Agent A (renamed)');
  });

  // QA finding M2: the export endpoint must return the server's authoritative
  // registry, including entries the GUI has not seen.
  it('QA M2: GET /api/registry/export returns the server-side registry', async () => {
    // Mutate the registry through the API (the "server state") ...
    const added = await api('POST', '/api/agents/custom', {
      id: 'export-check',
      name: 'Export Check',
      configPath: path.join(tmpHome, 'export-check.json'),
    });
    expect(added.status).toBe(200);

    const { status, json } = await api('GET', '/api/registry/export');
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data.providers)).toBe(true);
    expect(Array.isArray(json.data.mcpServers)).toBe(true);
    expect(json.data.customAgents.some((a: any) => a.id === 'export-check')).toBe(true);
    // Must match the manager's own view of the authoritative state.
    const expected = await manager.getRegistryState();
    expect(json.data.customAgents).toEqual(expected.customAgents);
  });
});
