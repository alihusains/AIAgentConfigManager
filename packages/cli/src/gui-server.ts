/**
 * GUI Server — serves the static dashboard and the REST API for the registry.
 *
 * Runs on 127.0.0.1 (loopback only) on a random, conflict-avoiding port, and
 * opens the browser. Loopback binding is the security boundary: only local
 * processes can reach the API, so no session token is required.
 */

import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type { AgentConfigManager } from './core-shim.js';
import {
  isKeychainAvailable,
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
  clearSkillsCache,
  assignSkillToAgent,
  removeSkillFromAgent,
  removeSkillFromLibrary,
  copySkillBetweenAgents,
  createSkill,
  readSkillContent,
  saveSkillContent,
  listMarketplaceSkills,
  fetchMarketplaceSkillContent,
  installMarketplaceSkill,
  MarketplaceRateLimitError,
  listEnvVars,
  setEnvVar,
  removeEnvVar,
  revealEnvVar,
  listMCPTools,
} from './core-shim.js';
import type {
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  CustomAgentDef,
  ProviderApiCapabilities,
  Platform,
  AgentJob,
} from './core-shim.js';

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
  distDir: string
): boolean {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  // Never allow traversal outside dist
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  let filePath = path.join(distDir, rel);
  if (filePath !== distDir && !filePath.startsWith(distDir + path.sep)) {
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
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(content);
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
  close(): Promise<void>;
}

function resolveDistDir(override?: string): string {
  if (override) return path.resolve(override);
  if (process.env.AI_CONFIG_DIST) return path.resolve(process.env.AI_CONFIG_DIST);
  const here = path.dirname(fileURLToPath(import.meta.url));
  // 1. Standalone npm install: the packed tarball bundles the built GUI at
  //    <package>/vendor/gui-dist (created by scripts/prepare-pack.mjs).
  const vendored = path.resolve(here, '../vendor/gui-dist');
  if (fs.existsSync(path.join(vendored, 'index.html'))) return vendored;
  // 2. Monorepo dev: <repo>/packages/cli/dist -> <repo>/packages/gui/dist
  const monorepo = path.resolve(here, '../../gui/dist');
  if (fs.existsSync(path.join(monorepo, 'index.html'))) return monorepo;
  // 3. Fallback: the monorepo path, so the "GUI build not found" error
  //    still points at the expected location inside this repo.
  return monorepo;
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
/**
 * Default kill switch for install/uninstall jobs (QA finding M3). A hung
 * install (stalled npm download, …) must not hold a child-process slot
 * forever. The tool-update job passes its own shorter 120s explicitly.
 */
const AGENT_JOB_TIMEOUT_MS = 5 * 60_000;
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

  const timeoutMs = options?.timeoutMs ?? AGENT_JOB_TIMEOUT_MS;
  const timer = setTimeout(() => {
    if (job.status !== 'running') return;
    job.status = 'failed';
    job.error = `Killed after ${Math.round(timeoutMs / 1000)}s (timeout)`;
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

  const bodyLimit = 10 * 1024 * 1024;

  const server = http.createServer(async (req, res) => {
    // No session-token gate: the server binds to 127.0.0.1 only, so only
    // local processes can reach it. /api/health stays open as the liveness
    // probe used by `acm health`.
    const isApi = req.url?.startsWith('/api');

    // ---- Static ----
    if (!isApi) {
      serveStatic(req, res, distDir);
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

    // ---- CSRF guard (state-changing methods) ----
    // The server is loopback-only, so a malicious local page can still reach it.
    // A cross-origin browser request always carries an Origin/Referer that does
    // NOT match this server's own origin; the GUI (same-origin fetch) does.
    // GETs stay open (read-only; /api/health must remain probeable). A direct
    // non-browser curl/CLI call has no Origin header and is allowed.
    const isMutation = method === 'POST' || method === 'PUT' || method === 'DELETE';
    if (isMutation) {
      const origin = req.headers.origin;
      const referer = req.headers.referer;
      // Same-origin check against the request's own Host header (works for any
      // port, including the ephemeral port tests use). A same-origin GUI fetch
      // has Origin/Referer matching Host; a cross-origin page's does not. A
      // non-browser curl/CLI call sends neither, so it passes.
      const host = req.headers.host;
      const isSameOrigin = (value: string | undefined): boolean => {
        if (!value || !host) return true; // no header / no host → not cross-origin
        try {
          const u = new URL(value);
          return u.host === host;
        } catch {
          return true; // unparseable → don't reject
        }
      };
      if (!isSameOrigin(origin) || !isSameOrigin(referer)) {
        return send(403, { ok: false, error: 'Cross-origin request rejected (CSRF guard)' });
      }
    }

    // ================= REST routes =================
    if (parts[0] !== 'api') return serveStatic(req, res, distDir);

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
        // Served from a short TTL cache (M060): refreshes/polls within the
        // window are free; every mutation below invalidates the cache.
        if (method === 'GET' && parts.length === 2) {
          return handle(async () => ({ data: await getSkillsSnapshot() }));
        }
        // GET /api/skills/all — aggregated cross-agent view: every skill id
        // known anywhere (shared library + every skill-capable agent's own
        // directory), each with `foundOn` listing where it exists. Consumed by
        // the M045 Skills view rework to browse/copy agent-installed skills.
        // Reads the same TTL-cached snapshot so a refresh is a single scan.
        if (method === 'GET' && parts.length === 3 && parts[2] === 'all') {
          return handle(async () => {
            const snapshot = await getSkillsSnapshot();
            return { data: { allSkills: snapshot.allSkills } };
          });
        }
        // GET /api/skills/:id/content?location=library|agentId — read the
        // SKILL.md content for a skill from a given location (M073).
        if (method === 'GET' && parts.length === 4 && parts[3] === 'content') {
          const location =
            new URL(req.url || '', 'http://localhost').searchParams.get('location') ?? 'library';
          return handle(async () => {
            const content = await readSkillContent(decodeURIComponent(parts[2]), location);
            if (content == null) {
              return { error: 'Skill not found at that location', status: 404 };
            }
            return { data: { content } };
          });
        }
        // PUT /api/skills/:id/content?location=library|agentId — save the
        // SKILL.md content for a skill at a given location (M073).
        if (method === 'PUT' && parts.length === 4 && parts[3] === 'content') {
          const location =
            new URL(req.url || '', 'http://localhost').searchParams.get('location') ?? 'library';
          const body = await readBody();
          const content =
            body && typeof body === 'object' && 'content' in body
              ? (body as { content?: unknown }).content
              : undefined;
          if (typeof content !== 'string') {
            return { error: 'Body must be { content: string }', status: 400 };
          }
          return handle(async () => {
            await saveSkillContent(decodeURIComponent(parts[2]), location, content);
            return { data: { ok: true } };
          });
        }
        // POST /api/skills { name, description?, body? } — create a skill in the library.
        if (method === 'POST' && parts.length === 2) {
          const body = await readBody();
          return handle(async () => {
            // QA finding H2: creation failures are client-input problems
            // (bad name, duplicate skill) — 400, or 409 when the skill already
            // exists. Genuine server errors still 500 via the handle() catch.
            try {
              const skill = await createSkill({
                name: String(body.name ?? ''),
                description: typeof body.description === 'string' ? body.description : undefined,
                body: typeof body.body === 'string' ? body.body : undefined,
              });
              clearSkillsCache();
              return { data: { skill } };
            } catch (error) {
              const message = String(error);
              const status = message.includes('already exists') ? 409 : 400;
              return { error: message.replace(/^Error: /, ''), status };
            }
          });
        }
        // POST /api/skills/:id/assign { agentId } — copy a library skill to an agent.
        if (method === 'POST' && parts.length === 4 && parts[3] === 'assign') {
          const body = await readBody();
          return handle(async () => {
            // QA finding H2: invalid/unknown agent ids are client-input
            // problems — 400, not 500.
            let result: Awaited<ReturnType<typeof assignSkillToAgent>>;
            try {
              result = await assignSkillToAgent(
                decodeURIComponent(parts[2]),
                String(body.agentId ?? '')
              );
            } catch (error) {
              return { error: String(error).replace(/^Error: /, ''), status: 400 };
            }
            clearSkillsCache();
            return { data: result };
          });
        }
        // POST /api/skills/:id/unassign { agentId } — remove the copy from an agent.
        if (method === 'POST' && parts.length === 4 && parts[3] === 'unassign') {
          const body = await readBody();
          return handle(async () => {
            await removeSkillFromAgent(decodeURIComponent(parts[2]), String(body.agentId ?? ''));
            clearSkillsCache();
            return { data: { ok: true } };
          });
        }
        // DELETE /api/skills/:id — delete the skill's folder from the shared
        // library. Agent copies are independent (assignment is a copy), so
        // they are intentionally left untouched (QA finding H1).
        if (method === 'DELETE' && parts.length === 3) {
          return handle(async () => {
            // QA finding H2: validation/state failures are client problems —
            // 400 for an invalid id, 404 when there is no library copy.
            try {
              await removeSkillFromLibrary(decodeURIComponent(parts[2]));
            } catch (error) {
              const message = String(error);
              const status = message.includes('not found in library') ? 404 : 400;
              return { error: message.replace(/^Error: /, ''), status };
            }
            clearSkillsCache();
            return { data: { ok: true } };
          });
        }
        // POST /api/skills/:id/copy { sourceAgentId, targetAgentId } — copy an
        // installed skill from one agent to another (agent A -> agent B).
        if (method === 'POST' && parts.length === 4 && parts[3] === 'copy') {
          const body = await readBody();
          return handle(async () => {
            // QA finding H2: validation failures are client-input problems —
            // 400. "Not assigned" is a state conflict — 409.
            let result: Awaited<ReturnType<typeof copySkillBetweenAgents>>;
            try {
              result = await copySkillBetweenAgents(
                decodeURIComponent(parts[2]),
                String(body.sourceAgentId ?? ''),
                String(body.targetAgentId ?? '')
              );
            } catch (error) {
              const message = String(error);
              const status = message.includes('not assigned') ? 409 : 400;
              return { error: message.replace(/^Error: /, ''), status };
            }
            clearSkillsCache();
            return { data: result };
          });
        }
      }

      // ---- Skill marketplace ----
      // Browse/install skills from the public alihusains/enterprise-skills repo.
      // Every call here is user-triggered (the GUI fires these on explicit
      // Browse/Refresh/Install actions); the core module caches the listing so
      // repeated loads don't re-hit GitHub's unauthenticated rate limit.
      if (parts[1] === 'marketplace' && parts[2] === 'skills') {
        // GET /api/marketplace/skills — list available marketplace skills.
        // ?force=1 bypasses the in-memory cache for an explicit refresh.
        if (method === 'GET' && parts.length === 3) {
          const force =
            new URL(req.url || '', 'http://localhost').searchParams.get('force') === '1';
          return handle(async () => {
            try {
              return { data: { skills: await listMarketplaceSkills({ force }) } };
            } catch (error) {
              return {
                error: String(error).replace(/^Error: /, ''),
                // Rate limits are a transient external condition, not a client
                // or server bug — 429 says "try again later" honestly.
                status: error instanceof MarketplaceRateLimitError ? 429 : 502,
              };
            }
          });
        }
        // GET /api/marketplace/skills/:id — one skill's files for preview.
        if (method === 'GET' && parts.length === 4) {
          return handle(async () => {
            try {
              const content = await fetchMarketplaceSkillContent(decodeURIComponent(parts[3]));
              if (!content) {
                return { error: `Skill not found in marketplace: ${parts[3]}`, status: 404 };
              }
              return { data: content };
            } catch (error) {
              const status = error instanceof MarketplaceRateLimitError ? 429 : 400;
              return { error: String(error).replace(/^Error: /, ''), status };
            }
          });
        }
        // POST /api/marketplace/skills/:id/install { overwrite? } — copy a
        // marketplace skill into the shared library. Never overwrites silently:
        // an existing skill is 409 unless the client sends overwrite: true.
        if (method === 'POST' && parts.length === 5 && parts[4] === 'install') {
          const body = await readBody();
          return handle(async () => {
            try {
              const result = await installMarketplaceSkill(decodeURIComponent(parts[3]), {
                overwrite: body.overwrite === true,
              });
              clearSkillsCache();
              return { data: result };
            } catch (error) {
              const message = String(error).replace(/^Error: /, '');
              const status =
                error instanceof MarketplaceRateLimitError
                  ? 429
                  : message.includes('already exists')
                    ? 409
                    : 400;
              return { error: message, status };
            }
          });
        }
      }

      // ---- Environment variables ----
      // GET /api/env — list env vars (sensitive-looking values redacted).
      if (method === 'GET' && parts.length === 2 && parts[1] === 'env') {
        return handle(async () => {
          const vars = await listEnvVars();
          return { data: { platform: process.platform, vars } };
        });
      }
      // POST /api/env { name, value } — set a user-level env var.
      if (method === 'POST' && parts.length === 2 && parts[1] === 'env') {
        const body = await readBody();
        return handle(async () => {
          const name = String(body.name ?? '');
          const value = String(body.value ?? '');
          if (!name) return { error: 'name is required', status: 400 };
          const result = await setEnvVar(name, value);
          return { data: result };
        });
      }
      // POST /api/env/:name/reveal — deliberate, per-variable unredaction.
      if (method === 'POST' && parts.length === 4 && parts[1] === 'env' && parts[3] === 'reveal') {
        return handle(async () => {
          const name = decodeURIComponent(parts[2]);
          const value = await revealEnvVar(name);
          if (value === null)
            return { error: `Environment variable "${name}" not found`, status: 404 };
          return { data: { name, value } };
        });
      }
      // DELETE /api/env/:name — remove a user-level env var.
      if (method === 'DELETE' && parts.length === 3 && parts[1] === 'env') {
        return handle(async () => {
          const name = decodeURIComponent(parts[2]);
          const result = await removeEnvVar(name);
          return { data: result };
        });
      }

      // ---- Permissions ----
      // GET /api/permissions/audit — P2-T2: scan all adapters for permission
      // rules and flag contradictions (e.g., "Cursor allows bash but Claude
      // forbids it"). Returns per-agent summaries, global contradictions, and
      // risk scores (LOW/MEDIUM/HIGH).
      if (
        method === 'GET' &&
        parts.length === 3 &&
        parts[1] === 'permissions' &&
        parts[2] === 'audit'
      ) {
        return handle(async () => {
          const result = await manager.auditPermissions();
          if (!result.success) return { error: result.error, status: 500 };
          return { data: result.data };
        });
      }

      // ---- Registry import/export ----
      // GET /api/registry/export — the server's authoritative registry (QA
      // finding M2): the GUI's export button downloads this instead of
      // serializing its possibly-stale in-memory copy.
      if (
        method === 'GET' &&
        parts.length === 3 &&
        parts[1] === 'registry' &&
        parts[2] === 'export'
      ) {
        return handle(async () => {
          const registry = await manager.getRegistryState();
          return { data: registry };
        });
      }
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
        // GET /api/providers/keychain — Phase 1 (Secrets) capability probe:
        // is the OS keychain usable in this environment? The Add Provider
        // form calls this BEFORE submitting with keychain storage opted in,
        // so the user gets immediate feedback instead of a failed submission.
        if (method === 'GET' && parts.length === 3 && parts[2] === 'keychain') {
          return handle(async () => ({ data: { available: await isKeychainAvailable() } }));
        }
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
            // QA finding H3: the envelope's top-level `ok` means "this request
            // succeeded" — it reads as "provider is fine" when every probe
            // failed. The data payload carries the real reachability signal:
            // `completed` = the checks ran, `reachable` = at least one API
            // answered.
            return {
              data: {
                ...result,
                completed: true,
                reachable: result.models.ok || result.chat.ok,
              },
            };
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
            // Same H3 clarification as /api/providers/verify.
            return {
              data: {
                ...result,
                completed: true,
                reachable: result.models.ok || result.chat.ok,
              },
            };
          });
        }
        if (method === 'POST' && parts.length === 2) {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.registerProvider(
              body.provider as ModelProvider,
              (body.models as ModelConfig[]) || [],
              (body.agentIds as string[]) || [],
              body.apiCapabilities as ProviderApiCapabilities | undefined,
              body.keychainStorage === true
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
        // POST /api/providers/:id/migrate-to-keychain — Phase 1 (Secrets): move an
        // EXISTING provider's plaintext API key into the OS keychain (one
        // provider at a time, explicit action only). The keychain write
        // happens before any registry change, so a keychain failure leaves
        // registry.json byte-for-byte unchanged.
        if (method === 'POST' && parts.length === 4 && parts[3] === 'migrate-to-keychain') {
          return handle(async () => {
            const providerId = decodeURIComponent(parts[2]);
            const result = await manager.migrateProviderApiKeyToKeychain(providerId);
            if (!result.success) return { error: result.error, status: 400 };
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
        // GET /api/mcp/:name/tools — live tool listing for one server
        // (MCP exposure dashboard). Connects to the server and runs
        // tools/list. Honest on failure: count 0 + error, never fabricated.
        if (method === 'GET' && parts.length === 4 && parts[3] === 'tools') {
          const name = decodeURIComponent(parts[2]);
          return handle(async () => {
            const state = await manager.getRegistryState();
            const entry = state.mcpServers.find((s) => s.server.name === name);
            if (!entry) {
              return { error: `MCP server "${name}" not found in registry`, status: 404 };
            }
            const result = await listMCPTools(entry.server);
            return { data: { name: entry.server.name, ...result } };
          });
        }
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
            // SAFETY: body is the raw JSON POST body; addCustomAgent validates
            // every required field (id, configPath) and returns an error result
            // on shape mismatch instead of throwing, so the cast cannot hide
            // a malformed request.
            const result = await manager.addCustomAgent(body as unknown as CustomAgentDef);
            if (!result.success) return { error: result.error, status: 400 };
            return { data: result.data };
          });
        }
        if (method === 'PUT' && parts.length === 4) {
          const body = await readBody();
          return handle(async () => {
            const result = await manager.updateCustomAgent(decodeURIComponent(parts[3]), body);
            if (!result.success) return { error: result.error, status: 400 };
            // QA finding M4: an empty body `{}` is a no-op — say so explicitly
            // (`changed: false`) instead of a bare ok:true that is
            // indistinguishable from a real update. We return 200 (not 400)
            // because the request itself was well-formed; the client should
            // not treat a no-op as an error.
            const changed = Object.values(body).some((v) => v !== undefined);
            return { data: { ...result.data, changed } };
          });
        }
        if (method === 'DELETE' && parts.length === 4) {
          return handle(async () => {
            const result = await manager.removeCustomAgent(decodeURIComponent(parts[3]));
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
          // Detection and the catalog-only probes are mutually independent —
          // run them as one parallel batch instead of a sequential loop.
          const catalog = getAgentCatalog();
          const [detected, probes] = await Promise.all([
            manager.detectAgents(),
            Promise.all(
              catalog
                .filter((e) => !manager.getAgent(e.id))
                .map((entry) => detectCatalogEntry(entry))
            ),
          ]);
          const byId = new Map(detected.map((d) => [d.id, d]));
          let probeIndex = 0;
          const agents = [];
          for (const entry of catalog) {
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
            // No core adapter (e.g. reasonix, freebuff): use the pre-computed
            // probe so installed CLIs are not offered as "Available to Install".
            const probe = probes[probeIndex++];
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

      // ---- Drift detection (M071) — read-only: has anything edited this
      // agent's registry-managed providers/servers out-of-band? ----
      // GET /api/agents/:id/drift
      if (parts[1] === 'agents' && method === 'GET' && parts.length === 4 && parts[3] === 'drift') {
        return handle(async () => {
          const drift = await manager.detectDrift(parts[2]);
          if (drift.error) return { error: drift.error, status: 404 };
          return { data: drift };
        });
      }

      // ---- Drift re-sync (M071) — push the registry's version of this
      // agent's registry-managed providers/servers back over its config
      // file (the inverse of the out-of-band edit drift detection flags).
      // POST /api/agents/:id/resync
      if (
        parts[1] === 'agents' &&
        method === 'POST' &&
        parts.length === 4 &&
        parts[3] === 'resync'
      ) {
        return handle(async () => {
          const result = await manager.resyncAgent(parts[2]);
          if (!result.success) return { error: result.error, status: 400 };
          return { data: result.data };
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
  const url = `http://127.0.0.1:${actualPort}/`;

  if (options.openBrowser !== false) {
    setTimeout(() => openBrowser(url), 150);
  }

  return {
    url,
    port: actualPort,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Force-close lingering keep-alive sockets
        server.closeAllConnections?.();
      }),
  };
}
