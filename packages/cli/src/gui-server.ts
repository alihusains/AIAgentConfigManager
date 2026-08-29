/**
 * GUI Server — serves the static dashboard and the REST API for the registry.
 *
 * Runs on 127.0.0.1 (loopback only) on a random, conflict-avoiding port, and
 * opens the browser. The API is guarded by a per-launch token carried in the
 * URL query string (the page re-sends it on every fetch).
 */

import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type { AgentConfigManager } from '@ai-agent-config/core';
import {
  probeProviderAPIs,
  getAgentCatalog,
  getAgentCatalogEntry,
  getAgentCatalogMeta,
  getAgentCommands,
  isSafeCommand,
  detectCatalogEntry,
  catalogEntryToDetected,
  detectCliTools,
  checkToolUpdates,
  getToolUpdateCommand,
  getSkillsSnapshot,
  assignSkillToAgent,
  removeSkillFromAgent,
  copySkillBetweenAgents,
  createSkill,
} from '@ai-agent-config/core';
import type {
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  CustomAgentDef,
  ProviderApiCapabilities,
  Platform,
  AgentJob,
  ToolUpdateStatus,
} from '@ai-agent-config/core';

// ============================================================================
// Port selection
// ============================================================================

/**
 * The dashboard always lives on this port so the URL is stable and
 * bookmarkable. When it is taken the server refuses to start with a clear
 * message instead of silently moving somewhere else.
 */
export const DEFAULT_GUI_PORT = 4321;

// ============================================================================
// Static file serving
// ============================================================================

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  distDir: string,
  token: string
): boolean {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  // Never allow traversal outside dist
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  let filePath = path.join(distDir, rel);
  if (!filePath.startsWith(distDir)) {
    res.writeHead(403).end('Forbidden');
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback
    filePath = path.join(distDir, 'index.html');
  }
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    let body: Buffer = content;
    if (isHtml) {
      // Hand the launch token to the page WITHOUT putting it in the URL:
      // the served HTML carries it in a global the API client reads. The
      // token never appears in the address bar, history, or shared links.
      const inject = `<script>window.__AI_CONFIG_TOKEN__=${JSON.stringify(token)};</script>`;
      const html = content.toString('utf8').replace('</head>', `${inject}</head>`);
      body = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
  return true;
}

// ============================================================================
// Open browser
// ============================================================================

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // Opening the browser is best-effort
  }
}

// ============================================================================
// Server
// ============================================================================

export interface GUIServerOptions {
  /** Port to bind (default: 4321 — fails with a clear message when busy) */
  port?: number;
  /** Override the GUI dist directory (default: <cli>/../../gui/dist) */
  distDir?: string;
  /** Open the browser automatically (default: true) */
  openBrowser?: boolean;
}

export interface GUIServerHandle {
  url: string;
  port: number;
  token: string;
  close(): Promise<void>;
}

function resolveDistDir(override?: string): string {
  if (override) return path.resolve(override);
  if (process.env.AI_CONFIG_DIST) return path.resolve(process.env.AI_CONFIG_DIST);
  // <cli>/dist/gui-server.js -> <repo>/packages/gui/dist
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../gui/dist');
}

// ============================================================================
// Agent install / uninstall jobs
//
// Commands run ONLY from the catalog allow-list (`getAgentCommands`), never
// from client input. Each job streams merged stdout/stderr into an in-memory
// store the dashboard polls. Jobs die with the server process — the UI treats
// a 404 on a job as "the server restarted".
// ============================================================================

const MAX_JOB_OUTPUT = 16 * 1024;
const JOB_TTL_MS = 10 * 60_000; // finished jobs are evicted after 10 min
const agentJobs = new Map<string, AgentJob>();

/** Evict finished jobs older than JOB_TTL_MS. Called on each new job. */
function evictStaleJobs(): void {
  const now = Date.now();
  for (const [id, job] of agentJobs) {
    if (
      job.status !== 'running' &&
      job.finishedAt &&
      now - new Date(job.finishedAt).getTime() > JOB_TTL_MS
    ) {
      agentJobs.delete(id);
    }
  }
}

function startAgentJob(
  agentId: string,
  action: AgentJob['action'],
  command: string,
  options?: { timeoutMs?: number }
): AgentJob {
  const id = randomBytes(8).toString('hex');
  const job: AgentJob = {
    id,
    agentId,
    action,
    command,
    status: 'running',
    output: '',
    startedAt: new Date().toISOString(),
  };
  agentJobs.set(id, job);
  evictStaleJobs();

  const append = (chunk: Buffer) => {
    if (job.output.length >= MAX_JOB_OUTPUT && job.output.endsWith('\n…(output truncated)…\n')) {
      return;
    }
    const next = job.output + chunk.toString('utf8');
    job.output =
      next.length > MAX_JOB_OUTPUT
        ? `…(output truncated)…\n${next.slice(next.length - MAX_JOB_OUTPUT)}`
        : next;
  };

  // Windows runs commands via cmd.exe; everything else via /bin/sh. The JSON
  // string is under our control and pre-filtered (see isSafeCommand).
  const shell =
    process.platform === 'win32'
      ? { cmd: 'cmd.exe' as const, args: ['/d', '/s', '/c', `"${command}"`] }
      : { cmd: '/bin/sh' as const, args: ['-c', command] };
  const child = spawn(shell.cmd, shell.args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);

  const timeoutMs = options?.timeoutMs ?? (action === 'install' ? 10 * 60_000 : 5 * 60_000);
  const timer = setTimeout(() => {
    if (job.status !== 'running') return;
    job.status = 'failed';
    job.error = `Killed after ${Math.round(timeoutMs / 60_000)} min (timeout)`;
    job.finishedAt = new Date().toISOString();
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5000);
  }, timeoutMs);

  child.on('error', (err) => {
    clearTimeout(timer);
    if (job.status !== 'running') return;
    job.status = 'failed';
    job.error = err.message;
    job.finishedAt = new Date().toISOString();
  });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (job.status !== 'running') return;
    job.status = code === 0 ? 'success' : 'failed';
    job.exitCode = code ?? undefined;
    job.finishedAt = new Date().toISOString();
  });

  return job;
}

export { startAgentJob };

export async function startGuiServer(
  manager: AgentConfigManager,
  options: GUIServerOptions = {}
): Promise<GUIServerHandle> {
  const distDir = resolveDistDir(options.distDir);
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`GUI build not found at ${distDir}. Run "pnpm build" (or set AI_CONFIG_DIST).`);
  }

  // Warm up the registry before listening so /api/state is instant
  await manager.initRegistry();

  const token = randomBytes(16).toString('hex');
  const bodyLimit = 10 * 1024 * 1024;

  const server = http.createServer(async (req, res) => {
    // ---- Auth: every /api request must carry the launch token ----
    // /api/health is the exception: it is the liveness probe used by
    // `acm health` before any token exists on the machine.
    const isHealth = req.url?.startsWith('/api/health');
    const isApi = req.url?.startsWith('/api');
    if (isApi && !isHealth) {
      const q = new URL(req.url || '', 'http://localhost');
      const tokenOk = q.searchParams.get('t') === token || req.headers['x-config-token'] === token;
      if (!tokenOk) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
        return;
      }
    }

    // ---- Static ----
    if (!isApi) {
      serveStatic(req, res, distDir, token);
      return;
    }

    // ---- JSON helpers ----
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const readBody = (): Promise<Record<string, unknown>> =>
      new Promise((resolve, reject) => {
        let size = 0;
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > bodyLimit) {
            reject(new Error('Body too large'));
            req.destroy();
            return;
          }
          chunks.push(c);
        });
        req.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve(raw ? JSON.parse(raw) : {});
          } catch {
            reject(new Error('Invalid JSON body'));
          }
        });
        req.on('error', reject);
      });
    const handle = async (
      fn: () => Promise<{ status?: number; data?: unknown; error?: string }>
    ) => {
      try {
        const result = await fn();
        if (result.error !== undefined) {
          send(result.status || 400, { ok: false, error: result.error });
        } else {
          send(200, { ok: true, data: result.data });
        }
      } catch (error) {
        send(500, { ok: false, error: String(error) });
      }
    };

    // Read the JSON request body (empty object when there is none).
    const url = new URL(req.url || '', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ['api','providers','x','agents','y']
    const method = req.method || 'GET';

    // ================= REST routes =================
    if (parts[0] !== 'api') return serveStatic(req, res, distDir, token);

    const wrap = async (data: unknown, status = 200) => handle(async () => ({ status, data }));

    try {
      // ---- GET /api/health ----
      // Unauthenticated liveness probe for `acm health` / scripts.
      if (method === 'GET' && parts.length === 2 && parts[0] === 'api' && parts[1] === 'health') {
        return send(200, {
          ok: true,
          data: { pid: process.pid, uptimeSec: Math.round(process.uptime()) },
        });
      }

      // ---- GET /api/state ----
      if (method === 'GET' && parts.length === 2 && parts[1] === 'state') {
        const agents = await manager.detectAgents();
        const registry = await manager.getRegistryState();
        return wrap({ agents, registry, platform: process.platform });
      }

      // ---- GET /api/system/stats ----
      // Live process memory for the dashboard RAM meter. Cheap: one
      // process.memoryUsage() call, no allocations beyond the response.
      if (method === 'GET' && parts.length === 3 && parts[1] === 'system' && parts[2] === 'stats') {
        const mem = process.memoryUsage();
        return wrap({
          rssBytes: mem.rss,
          heapUsedBytes: mem.heapUsed,
          heapTotalBytes: mem.heapTotal,
          externalBytes: mem.external,
          uptimeSec: process.uptime(),
          processId: process.pid,
          startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        });
      }

      // ---- CLI/environment tools (node, npm, pnpm, bun, git, …) ----
      // GET /api/tools — live re-detection of the curated CLI list. Always
      // probes fresh (this IS the user's 'Check' action); detection itself is
      // cheap: parallel, bounded probes over a static list.
      if (method === 'GET' && parts.length === 2 && parts[1] === 'tools') {
        return handle(async () => {
          const tools = await detectCliTools();
          return {
            data: {
              platform: process.platform,
              checkedAt: new Date().toISOString(),
              tools,
            },
          };
        });
      }

      // GET /api/tools/update-check — live re-detection + npm-registry update
      // check for the npm-published environment tools (npm/pnpm/yarn/bun).
      // Returns both the fresh detection and a per-tool update status.
      if (
        method === 'GET' &&
        parts.length === 3 &&
        parts[1] === 'tools' &&
        parts[2] === 'update-check'
      ) {
        return handle(async () => {
          const tools = await detectCliTools();
          const updates = await checkToolUpdates(tools);
          return {
            data: {
              platform: process.platform,
              checkedAt: new Date().toISOString(),
              tools,
              updates,
            },
          };
        });
      }

      // POST /api/tools/:name/update — run an allow-listed update for an
      // environment tool. The command comes ONLY from the server-trusted
      // allow-list (`getToolUpdateCommand`), never from client input, and only
      // after an explicit user action (the Update button triggers this POST).
      if (
        method === 'POST' &&
        parts.length === 4 &&
        parts[1] === 'tools' &&
        parts[3] === 'update'
      ) {
        return handle(async () => {
          const toolName = decodeURIComponent(parts[2]);
          const command = getToolUpdateCommand(toolName);
          if (!command) {
            return {
              error: `No allow-listed update available for tool "${toolName}"`,
              status: 400,
            };
          }
          if (!isSafeCommand(command)) {
            return { error: 'Update command is not permitted.', status: 400 };
          }
          const job = startAgentJob(toolName, 'update', command, { timeoutMs: 120000 });
          return { data: { jobId: job.id, tool: toolName, command } };
        });
      }

      // ---- Skills ----
      if (parts[1] === 'skills') {
        // GET /api/skills — library + skill-capable agents + assignments in one shot.
        if (method === 'GET' && parts.length === 2) {
          return handle(async () => ({ data: await getSkillsSnapshot() }));
        }
        // POST /api/skills { name, description?, body? } — create a skill in the library.
        if (method === 'POST' && parts.length === 2) {
          const body = await readBody();
          return handle(async () => {
            const skill = await createSkill({
              name: String(body.name ?? ''),
              description: typeof body.description === 'string' ? body.description : undefined,
              body: typeof body.body === 'string' ? body.body : undefined,
            });
            return { data: { skill } };
          });
        }
        // POST /api/skills/:id/assign { agentId } — copy a library skill to an agent.
        if (method === 'POST' && parts.length === 4 && parts[3] === 'assign') {
          const body = await readBody();
          return handle(async () => {
            const result = await assignSkillToAgent(
              decodeURIComponent(parts[2]),
              String(body.agentId ?? '')
            );
            return { data: result };
          });
        }
        // POST /api/skills/:id/unassign { agentId } — remove the copy from an agent.
        if (method === 'POST' && parts.length === 4 && parts[3] === 'unassign') {
          const body = await readBody();
          return handle(async () => {
            await removeSkillFromAgent(decodeURIComponent(parts[2]), String(body.agentId ?? ''));
            return { data: { ok: true } };
          });
        }
        // POST /api/skills/:id/copy { sourceAgentId, targetAgentId } — copy an
        // installed skill from one agent to another (agent A -> agent B).
        if (method === 'POST' && parts.length === 4 && parts[3] === 'copy') {
          const body = await readBody();
          return handle(async () => {
            const result = await copySkillBetweenAgents(
              decodeURIComponent(parts[2]),
              String(body.sourceAgentId ?? ''),
              String(body.targetAgentId ?? '')
            );
            return { data: result };
          });
        }
      }

      // ---- Registry import/export ----
      if (
        method === 'POST' &&
        parts.length === 3 &&
        parts[1] === 'registry' &&
        parts[2] === 'import'
      ) {
        const body = await readBody();
        return handle(async () => {
          const result = await manager.importRegistry(body.registry);
          if (!result.success) return { error: result.error, status: 400 };
          return { data: { registry: result.data, warnings: result.warnings } };
        });
      }

      // ---- Providers ----
      if (parts[1] === 'providers') {
        // POST /api/providers/verify  { baseUrl, apiKey? } — probe a candidate
        // endpoint (models + chat completions + responses) WITHOUT touching
        // the registry. Used by the add/edit provider forms.
        if (method === 'POST' && parts.length === 3 && parts[2] === 'verify') {
          const body = await readBody();
          return handle(async () => {
            if (!body.baseUrl) return { error: 'baseUrl is required', status: 400 };
            const result = await probeProviderAPIs({
              baseUrl: String(body.baseUrl),
              apiKey: body.apiKey ? String(body.apiKey) : undefined,
            });
            return { data: result };
          });
        }
        // POST /api/providers/:id/test  { apiKey? } — re-verify a registered
        // provider against its stored base URL (the body key, when supplied,
        // overrides the stored one). The verified capabilities are persisted
        // to the registry entry so the dashboard badges stay fresh.
        if (method === 'POST' && parts.length === 4 && parts[3] === 'test') {
          const body = await readBody();
          return handle(async () => {
            const state = await manager.getRegistryState();
            const entry = state.providers.find((p) => p.provider.id === parts[2]);
            if (!entry)
              return {
                error: `Provider "${parts[2]}" not found in registry`,
                status: 404,
              };
            const config = (entry.provider.config || {}) as Record<string, unknown>;
            const baseUrl = String(config.baseUrl || '');
            if (!baseUrl)
              return {
                error: 'This provider has no base URL configured — add one first',
                status: 400,
              };
            const result = await probeProviderAPIs({
              baseUrl,
              apiKey: body.apiKey
                ? String(body.apiKey)
                : config.apiKey
                  ? String(config.apiKey)
                  : undefined,
            });
            const capabilities: ProviderApiCapabilities = {
              supported: result.supported,
              models: result.modelIds,
              verifiedAt: result.verifiedAt,
            };
            const saved = await manager.recordProviderCapabilities(parts[2], capabilities);
            if (!saved.success) return { error: saved.error, status: 500 };
            return { data: result };
          });
        }
        if (method === 'POST' && parts.length === 2) {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.registerProvider(
              body.provider as ModelProvider,
              (body.models as ModelConfig[]) || [],
              (body.agentIds as string[]) || [],
              body.apiCapabilities as ProviderApiCapabilities | undefined
            );
            if (!result.success) return { error: result.error, status: 400 };
            return {
              data: { registry: result.data, warnings: result.warnings },
            };
          });
        }
        if (method === 'PUT' && parts.length === 3) {
          const body = await readBody();
          return handle(async () => {
            const providerId = decodeURIComponent(parts[2]);
            const result = await manager.updateProvider(providerId, {
              provider: body.provider as Partial<ModelProvider> | undefined,
              models: body.models as ModelConfig[] | undefined,
              apiCapabilities: body.apiCapabilities as ProviderApiCapabilities | undefined,
            });
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        if (method === 'DELETE' && parts.length === 3) {
          return handle(async () => {
            const providerId = decodeURIComponent(parts[2]);
            const result = await manager.deleteProvider(providerId);
            if (!result.success)
              return {
                error: result.error ?? result.warnings?.join('; ') ?? 'Operation failed',
                status: 400,
              };
            return { data: result.data };
          });
        }
        // POST /api/providers/:id/agents  { agentIds }
        if (method === 'POST' && parts.length === 4 && parts[3] === 'agents') {
          const body = await readBody();
          return handle(async () => {
            const providerId = decodeURIComponent(parts[2]);
            const result = await manager.addProviderToAgents(
              providerId,
              (body.agentIds as string[]) || []
            );
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        // DELETE /api/providers/:id/agents/:agentId
        if (method === 'DELETE' && parts.length === 5 && parts[3] === 'agents') {
          return handle(async () => {
            const providerId = decodeURIComponent(parts[2]);
            const agentId = decodeURIComponent(parts[4]);
            const result = await manager.removeProviderFromAgent(providerId, agentId);
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
      }

      // ---- MCP servers ----
      if (parts[1] === 'mcp') {
        if (method === 'POST' && parts.length === 2) {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.registerMCPServer(
              body.server as MCPServerConfig,
              (body.agentIds as string[]) || []
            );
            if (!result.success) return { error: result.error, status: 400 };
            return {
              data: { registry: result.data, warnings: result.warnings },
            };
          });
        }
        if (method === 'PUT' && parts.length === 3) {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.updateMCPServer(
              parts[2],
              body.server as Partial<MCPServerConfig>
            );
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        if (method === 'DELETE' && parts.length === 3) {
          return handle(async () => {
            const result = await manager.deleteMCPServer(parts[2]);
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        if (method === 'POST' && parts.length === 4 && parts[3] === 'agents') {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.addMCPServerToAgents(
              parts[2],
              (body.agentIds as string[]) || []
            );
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        if (method === 'DELETE' && parts.length === 5 && parts[3] === 'agents') {
          return handle(async () => {
            const result = await manager.removeMCPServerFromAgent(parts[2], parts[4]);
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
      }

      // ---- Custom agents ----
      if (parts[1] === 'agents' && parts[2] === 'custom') {
        if (method === 'POST' && parts.length === 3) {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.addCustomAgent(body as unknown as CustomAgentDef);
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        if (method === 'PUT' && parts.length === 4) {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.updateCustomAgent(parts[3], body);
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        if (method === 'DELETE' && parts.length === 4) {
          return handle(async () => {
            const result = await manager.removeCustomAgent(parts[3]);
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
      }

      // ---- Agent catalog (maintained list of known agent CLIs) ----
      // GET /api/agents/catalog — the catalog merged with live detection so
      // the dashboard can split agents into Installed vs Available to Install.
      // NOTE: must be checked before the `:id` raw-config route below.
      if (method === 'GET' && parts.length === 3 && parts[2] === 'catalog') {
        return handle(async () => {
          const detected = await manager.detectAgents();
          const byId = new Map(detected.map((d) => [d.id, d]));
          const agents = [];
          for (const entry of getAgentCatalog()) {
            const det = byId.get(entry.id);
            if (det) {
              // Adapter-backed: use the full detection (binary + config paths).
              agents.push({
                ...entry,
                known: true,
                installed: det.detection.installed,
                detected: det,
              });
              continue;
            }
            // No core adapter (e.g. reasonix, freebuff): probe the entry's own
            // binaries + settingsPaths so installed CLIs are not offered as
            // "Available to Install".
            const probe = await detectCatalogEntry(entry);
            agents.push({
              ...entry,
              known: true,
              installed: probe.installed,
              detected: catalogEntryToDetected(entry, probe),
            });
          }
          // Anything discovered on the machine that has no catalog entry yet is
          // still surfaced (labelled `known: false`) so no agent goes missing.
          for (const det of detected) {
            if (!getAgentCatalogEntry(det.id)) {
              agents.push({
                id: det.id,
                name: det.name,
                description: det.description,
                status: 'upcoming',
                addedAt: '',
                known: false,
                installed: true,
                detected: det,
              });
            }
          }
          return {
            data: {
              platform: process.platform,
              agents,
              meta: getAgentCatalogMeta(),
            },
          };
        });
      }

      // ---- Raw agent config (directory checking) ----
      // GET /api/agents/:id  or  GET /api/agents/:id/config
      if (
        parts[1] === 'agents' &&
        method === 'GET' &&
        (parts.length === 3 || (parts.length === 4 && parts[3] === 'config'))
      ) {
        return handle(async () => {
          const result = await manager.readRawConfig(parts[2]);
          if (!result.success) return { error: result.error || 'Agent not found', status: 404 };
          return { data: result.data };
        });
      }

      // ---- Raw agent file (config or MCP) — read for the in-browser editor ----
      // GET /api/agents/:id/raw-file?kind=config|mcp
      if (
        parts[1] === 'agents' &&
        method === 'GET' &&
        parts.length === 4 &&
        parts[3] === 'raw-file'
      ) {
        return handle(async () => {
          const kind = url.searchParams.get('kind');
          if (kind !== 'config' && kind !== 'mcp') {
            return { error: `Invalid or missing kind (expected 'config' or 'mcp')`, status: 400 };
          }
          const result = await manager.readAgentFile(parts[2], kind);
          if (!result.success) return { error: result.error || 'Not found', status: 404 };
          return { data: result.data };
        });
      }

      // ---- Raw agent file (config or MCP) — save from the in-browser editor ----
      // PUT /api/agents/:id/raw-file?kind=config|mcp   Body: { content: string }
      if (
        parts[1] === 'agents' &&
        method === 'PUT' &&
        parts.length === 4 &&
        parts[3] === 'raw-file'
      ) {
        return handle(async () => {
          const kind = url.searchParams.get('kind');
          if (kind !== 'config' && kind !== 'mcp') {
            return { error: `Invalid or missing kind (expected 'config' or 'mcp')`, status: 400 };
          }
          const body = await readBody();
          const content =
            body && typeof body === 'object' && 'content' in body
              ? (body as { content?: unknown }).content
              : undefined;
          if (typeof content !== 'string') {
            return { error: 'Body must be { content: string }', status: 400 };
          }
          const result = await manager.writeAgentFile(parts[2], kind, content);
          if (!result.success) return { error: result.error || 'Write failed', status: 500 };
          return { data: result.data };
        });
      }

      // ---- Reveal config folder in file manager ----
      // Body: { kind?: 'config' | 'mcp' | 'model' } — defaults to 'config'.
      if (
        parts[1] === 'agents' &&
        method === 'POST' &&
        parts.length === 4 &&
        parts[3] === 'reveal'
      ) {
        return handle(async () => {
          const body = await readBody();
          const kind =
            body && typeof body === 'object' && 'kind' in body
              ? (body as { kind?: string }).kind
              : 'config';
          if (kind !== 'config' && kind !== 'mcp' && kind !== 'model') {
            return {
              error: `Invalid kind: ${String(kind)} (expected 'config', 'mcp', or 'model')`,
              status: 400,
            };
          }
          const det = await manager.detectAgent(parts[2]);
          if (!det) return { error: 'Agent not found', status: 404 };
          let target: string | undefined;
          if (kind === 'mcp') {
            target = det.detection.mcpPath;
          } else if (kind === 'model') {
            target = det.detection.modelConfigPath;
          } else {
            target = manager.getConfigPath(parts[2]) ?? undefined;
          }
          if (!target) {
            return {
              error: `This agent has no ${kind} path on this machine`,
              status: 404,
            };
          }
          if (kind !== 'config' && !fs.existsSync(target)) {
            return {
              error: `This agent's ${kind} file does not exist yet: ${target}`,
              status: 404,
            };
          }
          const dir = path.dirname(target);
          const platform = process.platform;
          const cmd =
            platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer' : 'xdg-open';
          const child = spawn(cmd, [dir], { stdio: 'ignore', detached: true });
          child.on('error', () => undefined);
          child.unref();
          return { data: { dir, path: target, kind } };
        });
      }

      // ---- Agent lifecycle: install / uninstall (catalog allow-list only) ----
      // GET /api/agents/jobs/:jobId — poll a launched job's live output.
      if (method === 'GET' && parts.length === 4 && parts[2] === 'jobs') {
        return handle(async () => {
          const job = agentJobs.get(parts[3]);
          if (!job) {
            return {
              error: 'Job not found — it may have finished and the server been restarted.',
              status: 404,
            };
          }
          return { data: job };
        });
      }
      // GET /api/agents/:id/update-check — best-effort "is a newer version
      // published" check, derived from the catalog's install command.
      if (
        method === 'GET' &&
        parts.length === 4 &&
        parts[1] === 'agents' &&
        parts[3] === 'update-check'
      ) {
        return handle(async () => {
          const result = await manager.checkAgentUpdate(parts[2]);
          if (!result.success) return { error: result.error || 'Update check failed', status: 500 };
          return { data: result.data };
        });
      }

      // POST /api/agents/:id/update — re-run the install/upgrade command.
      if (
        method === 'POST' &&
        parts.length === 4 &&
        parts[1] === 'agents' &&
        parts[3] === 'update'
      ) {
        return handle(async () => {
          const agentId = parts[2];
          const command = manager.getAgentUpdateCommand(agentId);
          if (!command) {
            return { error: `No update command is available for "${agentId}".`, status: 400 };
          }
          if (!isSafeCommand(command)) {
            return {
              error: `The update command for "${agentId}" was blocked by a safety rule.`,
              status: 400,
            };
          }
          if (
            [...agentJobs.values()].some((j) => j.agentId === agentId && j.status === 'running')
          ) {
            return {
              error: `A job is already running for "${agentId}" — wait for it to finish first.`,
              status: 409,
            };
          }
          const job = startAgentJob(agentId, 'install', command);
          return { data: { jobId: job.id, agentId, action: 'update', command } };
        });
      }

      // POST /api/agents/:id/install  |  /api/agents/:id/uninstall
      if (
        method === 'POST' &&
        parts.length === 4 &&
        (parts[3] === 'install' || parts[3] === 'uninstall')
      ) {
        return handle(async () => {
          const agentId = parts[2];
          const action = parts[3] as 'install' | 'uninstall';
          const commands = getAgentCommands(agentId, process.platform as Platform);
          const command = action === 'install' ? commands?.install : commands?.uninstall;
          if (!command) {
            return {
              error: `No automated ${action} command is catalogued for "${agentId}".${
                commands?.note ? ` ${commands.note}` : ' Install or uninstall it manually.'
              }`,
              status: 400,
            };
          }
          if (!isSafeCommand(command)) {
            return {
              error: `The catalogued ${action} command for "${agentId}" was blocked by a safety rule.`,
              status: 400,
            };
          }
          if (
            [...agentJobs.values()].some((j) => j.agentId === agentId && j.status === 'running')
          ) {
            return {
              error: `A ${action} is already running for "${agentId}" — wait for it to finish first.`,
              status: 409,
            };
          }
          const job = startAgentJob(agentId, action, command);
          return { data: { jobId: job.id, agentId, action, command } };
        });
      }

      return send(404, {
        ok: false,
        error: `No route: ${method} ${url.pathname}`,
      });
    } catch (error) {
      return send(500, { ok: false, error: String(error) });
    }
  });

  // ---- Bind: the dashboard owns port 4321 by default. Pass `port: 0` to get
  // an ephemeral loopback port (used by tests so a leaked/leftover server can
  // never collide with a later run). ----
  const preferred = options.port ?? DEFAULT_GUI_PORT;
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => {
        server.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        server.removeListener('error', onError);
        resolve();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(preferred, '127.0.0.1');
    });
  } catch {
    throw new Error(
      `Port ${preferred} is already in use — is the dashboard already running? Open http://127.0.0.1:${preferred} or stop it with \`acm stop\`${options.port ? '' : ' (or pass --port to pick a different one)'}.`
    );
  }

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : preferred;
  // Clean URL — no token in the query string; the served HTML carries it.
  const url = `http://127.0.0.1:${actualPort}/`;

  if (options.openBrowser !== false) {
    setTimeout(() => openBrowser(url), 150);
  }

  return {
    url,
    port: actualPort,
    token,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Force-close lingering keep-alive sockets
        server.closeAllConnections?.();
      }),
  };
}
