/**
 * MCP tool listing — connect to a single MCP server and report how many tools
 * it exposes.
 *
 * This powers the "MCP exposure dashboard" (v0.4): per-server tool counts plus
 * an overload warning when one server exposes >= 30 tools. The registry only
 * stores a *whitelist* (`MCPServerConfig.tools` — "specific tools to allow,
 * empty = all"), NOT a full tool list, so the authoritative count requires
 * actually connecting to the server and running MCP `tools/list`.
 *
 * Honesty contract (mirrors keychain.ts): this function NEVER throws and NEVER
 * fabricates a number. On any failure — unsupported transport, missing command,
 * server down, timeout, protocol error — it returns `{ tools: [], count: 0,
 * error }`. The UI must render that as "unknown / failed to list", never a
 * made-up count.
 *
 * Transports:
 *  - stdio:          spawn the command, JSON-RPC 2.0 over stdio (newline-
 *                    framed). initialize → notifications/initialized →
 *                    tools/list → shutdown.
 *  - http /
 *    streamable-http: POST JSON-RPC to the URL (Content-Type
 *                    application/json), read the `Mcp-Session-Id` header,
 *                    repeat.
 *  - sse:            the legacy GET /sse event-stream handshake, which is
 *                    environment-dependent (needs a live event stream + a
 *                    message endpoint). We do NOT attempt it here — it returns
 *                    an honest "unsupported for listing" error rather than a
 *                    flaky, non-deterministic connection.
 *
 * No new runtime dependencies: node builtins (child_process) + global fetch.
 */

import { spawn } from 'node:child_process';
import type { MCPServerConfig } from './types';

/** Hard cap on the whole listing operation. */
const DEFAULT_TIMEOUT_MS = 15_000;

export interface ListMCPToolsResult {
  /** Tool names as reported by the server (empty on failure). */
  tools: string[];
  /** tools.length — 0 on failure. Never a fabricated number. */
  count: number;
  /** Present iff the listing could not complete. */
  error?: string;
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * List the tools exposed by a single MCP server.
 *
 * @param server  The registry MCP server definition.
 * @param timeoutMs Hard timeout for the whole operation (default 15s). The
 *                  child / fetch is aborted and cleaned up on timeout.
 * @returns A `ListMCPToolsResult`. Never throws.
 */
export async function listMCPTools(
  server: MCPServerConfig,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ListMCPToolsResult> {
  try {
    switch (server.type) {
      case 'stdio':
        return await listStdioTools(server, timeoutMs);
      case 'http':
      case 'streamable-http':
        return await listHttpTools(server, timeoutMs);
      case 'sse':
        return fail('SSE transport is not supported for tool listing in this build');
      default:
        return fail(`Unsupported MCP transport for tool listing: ${String(server.type)}`);
    }
  } catch (err) {
    return fail(describe(err));
  }
}

// ---------------------------------------------------------------------------
// stdio transport
// ---------------------------------------------------------------------------

type PendingEntry = {
  resolve: (msg: JsonRpcMessage) => void;
  reject: (err: Error) => void;
};

async function listStdioTools(
  server: MCPServerConfig,
  timeoutMs: number
): Promise<ListMCPToolsResult> {
  const command = server.command;
  if (!command) return fail('stdio server has no command configured');

  const args = server.args ?? [];
  const env: NodeJS.ProcessEnv = { ...process.env, ...(server.env ?? {}) };
  const cwd = server.cwd;

  const child = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
    ...(cwd ? { cwd } : {}),
  });

  let settled = false;
  let stderrTail = '';
  const pending = new Map<number, PendingEntry>();
  let nextId = 1;
  let buffer = '';

  const cleanup = (): void => {
    if (settled) return;
    settled = true;
    // Reject any in-flight calls so their awaiters can proceed to the catch.
    for (const entry of pending.values()) {
      entry.reject(new Error('MCP connection closed before a response arrived'));
    }
    pending.clear();
    // Best-effort shutdown so we never leak a spawned process.
    try {
      child.kill('SIGTERM');
    } catch {
      /* already dead */
    }
    setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already dead */
      }
    }, 1000).unref?.();
  };

  const timer = setTimeout(() => cleanup(), timeoutMs);
  timer.unref?.();

  child.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2000);
  });
  child.on('error', () => cleanup());
  child.on('close', () => cleanup());

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    for (;;) {
      const nl = buffer.indexOf('\n');
      if (nl < 0) break;
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg: JsonRpcMessage;
      try {
        msg = JSON.parse(line) as JsonRpcMessage;
      } catch {
        continue; // ignore non-JSON stdout noise
      }
      if (typeof msg.id === 'number' && pending.has(msg.id)) {
        const entry = pending.get(msg.id)!;
        pending.delete(msg.id);
        entry.resolve(msg);
      }
    }
  });

  const sendNotification = (method: string, params: unknown): void => {
    const msg: JsonRpcMessage = { jsonrpc: '2.0', method, params };
    child.stdin?.write(JSON.stringify(msg) + '\n');
  };

  const call = (method: string, params: unknown): Promise<JsonRpcMessage> => {
    const id = nextId++;
    return new Promise<JsonRpcMessage>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const msg: JsonRpcMessage = { jsonrpc: '2.0', id, method, params };
      child.stdin?.write(JSON.stringify(msg) + '\n');
    });
  };

  try {
    // 1) initialize
    const init = await call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ai-agent-config', version: '0.1.0' },
    });
    if (init.error) {
      return cleanupResult(init.error.message, init, stderrTail, cleanup);
    }
    // 2) notifications/initialized (no id, no response expected)
    sendNotification('notifications/initialized', {});
    // 3) tools/list
    const list = await call('tools/list', {});
    if (list.error) {
      return cleanupResult(list.error.message, list, stderrTail, cleanup);
    }
    const tools = extractToolNames(list.result);
    // 4) best-effort graceful shutdown (not awaited — cleanup kills anyway)
    sendNotification('notifications/cancelled', { requestId: 'shutdown' });
    cleanup();
    return { tools, count: tools.length };
  } catch (err) {
    return cleanupResult(describe(err), undefined, stderrTail, cleanup);
  }

  function cleanupResult(
    error: string,
    _msg: JsonRpcMessage | undefined,
    stderr: string,
    clean: () => void
  ): ListMCPToolsResult {
    const detail = trim(stderr.trim());
    clean();
    const suffix = detail ? ` (server stderr: ${detail})` : '';
    return fail(`${error}${suffix}`);
  }
}

// ---------------------------------------------------------------------------
// http / streamable-http transport
// ---------------------------------------------------------------------------

async function listHttpTools(
  server: MCPServerConfig,
  timeoutMs: number
): Promise<ListMCPToolsResult> {
  const url = server.url;
  if (!url) return fail('http server has no url configured');

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(server.headers ?? {}),
  };

  // Track the session id across the three RPC calls (MCP streamable-http).
  let sessionId: string | undefined;

  const rpc = async (method: string, params: unknown, id: number): Promise<JsonRpcMessage> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal,
      });
      // Capture the session id from the initialize response.
      const sid = res.headers.get('mcp-session-id');
      if (sid) sessionId = sid;
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: `HTTP ${res.status} from server` },
        };
      }
      // The response may be application/json or an SSE stream (text/event-stream)
      // with a single `data:` line. Parse both.
      const parsed = parseJsonRpcBody(text);
      if (!parsed) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32000, message: 'Empty or unparseable response from server' },
        };
      }
      return parsed;
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: aborted ? `Timed out after ${timeoutMs}ms` : describe(err),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  };

  const init = await rpc(
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ai-agent-config', version: '0.1.0' },
    },
    1
  );
  if (init.error) return fail(init.error.message);

  // notifications/initialized (no id; some servers 202, some 200 — ignore body)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    await fetch(url, {
      method: 'POST',
      headers: { ...baseHeaders, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      signal: controller.signal,
    }).catch(() => undefined);
  } finally {
    clearTimeout(timer);
  }

  const list = await rpc('tools/list', {}, 2);
  if (list.error) return fail(list.error.message);
  const tools = extractToolNames(list.result);
  return { tools, count: tools.length };
}

/**
 * Parse a JSON-RPC response body that may be plain JSON or a single-event SSE
 * stream (`data: {...}\n\n`). Returns null when nothing parseable is found.
 */
function parseJsonRpcBody(text: string): JsonRpcMessage | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // Plain JSON object.
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as JsonRpcMessage;
    } catch {
      return null;
    }
  }
  // SSE: take the last `data:` payload.
  const dataLines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  if (dataLines.length === 0) return null;
  const payload = dataLines[dataLines.length - 1];
  if (!payload) return null;
  try {
    return JSON.parse(payload) as JsonRpcMessage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Pull tool names out of a `tools/list` result of the form `{ tools: [...] }`. */
function extractToolNames(result: unknown): string[] {
  if (!result || typeof result !== 'object') return [];
  const obj = result as Record<string, unknown>;
  if (!Array.isArray(obj.tools)) return [];
  const names: string[] = [];
  for (const t of obj.tools) {
    if (t && typeof t === 'object' && typeof (t as Record<string, unknown>).name === 'string') {
      names.push((t as Record<string, unknown>).name as string);
    }
  }
  return names;
}

/** Build a failure result. Never throws. */
function fail(error: string): ListMCPToolsResult {
  return { tools: [], count: 0, error };
}

/** Trim a string to a readable length for error messages. */
function trim(s: string, max = 300): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Human-readable one-line summary of an error, for messages. */
function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
