/**
 * Provider API verification.
 *
 * When a provider is registered (or on demand), we probe the endpoints every
 * OpenAI-style gateway exposes — GET /models, POST /chat/completions and
 * POST /responses — and record which wire protocols the endpoint really
 * supports. A gateway may support both, or only one; e.g. ChatGPT accounts
 * have deprecated the chat completions route and answer only on /responses.
 *
 * Each probe also carries the exact curl equivalent (API key masked) and the
 * raw response body so a human can inspect the output directly.
 */

import type {
  ProviderApiKind,
  ProviderApiCapabilities,
  ProviderProbeDetail,
  ProviderVerificationResult,
} from './types';

export interface ProbeProviderOptions {
  /** e.g. https://api.openai.com/v1 or https://ic-chat.devenv.icm/api/v1 */
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Cap raw bodies at a readable size for the UI. */
const BODY_LIMIT = 1500;

// ============================================================================
// Helpers
// ============================================================================

/** Mask a key for display purposes (e.g. `sk-a3…9z`) without revealing it. */
function maskKey(key?: string): string {
  if (!key) return '<no-api-key>';
  if (key.length <= 8) return '***';
  return `${key.slice(0, 4)}…${key.slice(-2)}`;
}

/** Build a readable, re-runnable curl command for one probe (key masked). */
function buildCurl(method: string, url: string, apiKey: string | undefined, body?: unknown): string {
  const parts = [`curl -sS -X ${method} '${url}'`];
  if (apiKey) parts.push(`-H 'Authorization: Bearer ${maskKey(apiKey)}'`);
  if (body !== undefined) parts.push(`-H 'Content-Type: application/json' -d '${JSON.stringify(body)}'`);
  return parts.join(' \\\n  ');
}

/** Normalize a pasted base URL; tolerate a full endpoint path being pasted. */
function normalizeBaseUrl(raw: string): string {
  let base = raw.trim();
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(`baseUrl must start with http(s):// (got "${raw.slice(0, 40)}")`);
  }
  base = base.replace(/\/+$/, '');
  // Accept a pasted full route and derive the root from it.
  base = base.replace(/\/chat\/completions$/i, '').replace(/\/responses$/i, '');
  return base;
}

/**
 * A bare host (e.g. https://api.example.com) usually needs a version segment
 * (/v1). Probe the root first; if /models 404s there, retry under /v1.
 */
function endpointCandidates(base: string): string[] {
  const path = new URL(base).pathname;
  if (!path || path === '/') return [base, `${base}/v1`];
  return [base];
}

/** Extract model ids from a /models response (OpenAI, LiteLLM, routers…). */
function parseModelIds(body?: string): string[] {
  if (!body) return [];
  try {
    const json = JSON.parse(body) as unknown;
    const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
    let list = Array.isArray(obj.data) ? obj.data : Array.isArray(obj.models) ? obj.models : null;
    if (!list) return [];
    const ids: string[] = [];
    for (const item of list) {
      if (typeof item === 'string') {
        ids.push(item);
      } else if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const id =
          typeof o.id === 'string' ? o.id : typeof o.model_name === 'string' ? o.model_name : typeof o.name === 'string' ? o.name : undefined;
        if (id) ids.push(id);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

interface WireResult {
  reached: boolean;
  authenticated: boolean;
  endpoint: boolean;
  status?: number;
  ok: boolean;
  body?: string;
  error?: string;
}

/** One HTTP probe with a hard timeout; never throws. */
async function probe(
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<WireResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    const text = await res.text().catch(() => '');
    const status = res.status;
    const ok = status >= 200 && status < 300;
    const authenticated = status !== 401 && status !== 403;
    const endpoint = status !== 404 && status !== 405 && status !== 501;
    return {
      reached: true,
      authenticated,
      endpoint,
      status,
      ok,
      body: text.slice(0, BODY_LIMIT),
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      reached: false,
      authenticated: false,
      endpoint: false,
      ok: false,
      error: aborted ? `Timed out after ${init.timeoutMs}ms` : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Probe a provider endpoint and report which OpenAI-style APIs it supports.
 *
 * 1. GET  {base}/models          → reachability, auth, model list
 * 2. POST {base}/chat/completions→ is the Chat Completions API available?
 * 3. POST {base}/responses       → is the Responses API available?
 *
 * Interpretation:
 * - 404/405/501 on a route  → the API is not offered (e.g. ChatGPT without
 *   chat completions) and the provider can only serve the other protocol.
 * - 401/403                  → reachable, but the API key was rejected.
 * - 400/422                  → the route exists (endpoint present) but the
 *   probe request was rejected (e.g. unknown model id).
 * - network failure / timeout → unreachable.
 */
export async function probeProviderAPIs(
  options: ProbeProviderOptions,
): Promise<ProviderVerificationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = normalizeBaseUrl(options.baseUrl);
  const apiKey = options.apiKey || undefined;
  const authHeaders: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};

  // 1) GET /models — resolve the API root first (bare host → try /v1).
  let modelsProbe: ProviderProbeDetail | undefined;
  let modelIds: string[] = [];
  let apiRoot = base;
  for (const candidate of endpointCandidates(base)) {
    const url = `${candidate}/models`;
    const raw = await probe(url, { method: 'GET', headers: { ...authHeaders }, timeoutMs });
    modelsProbe = {
      api: 'models',
      ok: raw.ok,
      reached: raw.reached,
      authenticated: raw.authenticated,
      endpoint: raw.endpoint,
      httpStatus: raw.status,
      curl: buildCurl('GET', url, apiKey),
      body: raw.body,
      error: raw.error,
    };
    if (raw.ok) {
      modelIds = parseModelIds(raw.body);
      apiRoot = candidate;
      break;
    }
  }

  // 2) POST /chat/completions — use a verified model id when we have one.
  const probeModel = modelIds[0];
  const chatBody = {
    ...(probeModel ? { model: probeModel } : {}),
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
  };
  const chatUrl = `${apiRoot}/chat/completions`;
  const chatRaw = await probe(chatUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(chatBody),
    timeoutMs,
  });
  const chat: ProviderProbeDetail = {
    api: 'chat',
    ok: chatRaw.ok,
    reached: chatRaw.reached,
    authenticated: chatRaw.authenticated,
    endpoint: chatRaw.endpoint,
    httpStatus: chatRaw.status,
    curl: buildCurl('POST', chatUrl, apiKey, chatBody),
    body: chatRaw.body,
    error: chatRaw.error,
  };

  // 3) POST /responses
  const responsesBody = {
    ...(probeModel ? { model: probeModel } : {}),
    input: 'ping',
    max_output_tokens: 1,
  };
  const responsesUrl = `${apiRoot}/responses`;
  const responsesRaw = await probe(responsesUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(responsesBody),
    timeoutMs,
  });
  const responses: ProviderProbeDetail = {
    api: 'responses',
    ok: responsesRaw.ok,
    reached: responsesRaw.reached,
    authenticated: responsesRaw.authenticated,
    endpoint: responsesRaw.endpoint,
    httpStatus: responsesRaw.status,
    curl: buildCurl('POST', responsesUrl, apiKey, responsesBody),
    body: responsesRaw.body,
    error: responsesRaw.error,
  };

  const supported: ProviderApiKind[] = [];
  if (chat.ok) supported.push('chat');
  if (responses.ok) supported.push('responses');

  return {
    baseUrl: apiRoot,
    modelIds,
    models: modelsProbe as ProviderProbeDetail,
    chat,
    responses,
    supported,
    verifiedAt: new Date().toISOString(),
  };
}

/** Shrink a verification result into the registry-stored capabilities record. */
export function toApiCapabilities(result: ProviderVerificationResult): ProviderApiCapabilities {
  return {
    supported: result.supported,
    models: result.modelIds,
    verifiedAt: result.verifiedAt,
  };
}