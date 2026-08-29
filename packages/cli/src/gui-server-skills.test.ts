// Regression tests for the skills routes on the gui-server, driven over real
// HTTP against a temp AI_CONFIG_HOME so no real agent directories are touched.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentConfigManager, getSkillsLibraryDir } from '@ai-agent-config/core';
import { startGuiServer, type GUIServerHandle } from './gui-server';

let tmpHome: string;
let manager: AgentConfigManager;
let handle: GUIServerHandle;

beforeAll(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'acm-gui-skills-'));
  process.env.HOME = tmpHome;
  process.env.AI_CONFIG_HOME = path.join(tmpHome, '.ai-agent-config');

  manager = new AgentConfigManager();
  await manager.initRegistry();

  // Seed the shared library with a skill.
  const libraryDir = getSkillsLibraryDir();
  fs.mkdirSync(path.join(libraryDir, 'demo-skill'), { recursive: true });
  fs.writeFileSync(
    path.join(libraryDir, 'demo-skill', 'SKILL.md'),
    '---\nname: Demo Skill\n---\nBody\n',
    'utf8'
  );

  handle = await startGuiServer(manager, { port: 0, openBrowser: false });
});

afterAll(async () => {
  if (handle) await handle.close();
  delete process.env.HOME;
  delete process.env.AI_CONFIG_HOME;
  if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
});

async function api(method: string, urlPath: string, body?: unknown) {
  const res = await fetch(`http://127.0.0.1:${handle.port}${urlPath}?t=${handle.token}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

describe('skills routes through the gui-server', () => {
  it('GET /api/skills lists the library skill', async () => {
    const { status, json } = await api('GET', '/api/skills');
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.skills.map((s: any) => s.id)).toContain('demo-skill');
  });

  it('POST /api/skills/:id/copy copies an installed skill between agents', async () => {
    // Assign the library skill to claude-code first so it is installed.
    const assign = await api('POST', '/api/skills/demo-skill/assign', { agentId: 'claude-code' });
    expect(assign.status).toBe(200);
    expect(assign.json.ok).toBe(true);

    const { status, json } = await api('POST', '/api/skills/demo-skill/copy', {
      sourceAgentId: 'claude-code',
      targetAgentId: 'opencode',
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.targetPath).toBe(
      path.join(process.env.HOME!, '.config', 'opencode', 'skills', 'demo-skill')
    );
    const copied = fs.readFileSync(
      path.join(process.env.HOME!, '.config', 'opencode', 'skills', 'demo-skill', 'SKILL.md'),
      'utf8'
    );
    expect(copied).toContain('name: Demo Skill');
  });

  it('POST /api/skills/:id/copy rejects when the skill is not installed on the source agent', async () => {
    const { status, json } = await api('POST', '/api/skills/demo-skill/copy', {
      sourceAgentId: 'aion-cli',
      targetAgentId: 'chatgpt',
    });
    expect(status).toBe(500);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain('not assigned');
  });

  it('POST /api/skills/:id/copy rejects same source and target agent', async () => {
    const { status, json } = await api('POST', '/api/skills/demo-skill/copy', {
      sourceAgentId: 'claude-code',
      targetAgentId: 'claude-code',
    });
    expect(status).toBe(500);
    expect(json.ok).toBe(false);
    expect(String(json.error)).toContain('same');
  });
});
