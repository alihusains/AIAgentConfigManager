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
import { maskKey as maskKeySrc } from './utils';

export interface ProbeProviderOptions {
  /** e.g. https://api.openai.com/v1 or https://ic-chat.devenv.icm/api/v1 */
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
/** Cap raw bodies at a readable size for the UI. */
const BODY_LIMIT = 1500;
/** How many /models ids to try on POST probes before giving up. */
const MAX_PROBE_MODELS = 6;
/** Anthropic-version header value for the Messages API probe. */
const ANTHROPIC_VERSION = '2023-06-01';

// ============================================================================
// Helpers
// ============================================================================

/** Mask a key for display purposes (e.g. `sk-a3…9z12`) in curl commands. */
function maskKey(key?: string): string {
  return maskKeySrc(key);
}

/** Build a readable, re-runnable curl command for one probe (key masked). */
function buildCurl(
  method: string,
  url: string,
  apiKey: string | undefined,
  body?: unknown
): string {
  const parts = [`curl -sS -X ${method} '${url}'`];
  if (apiKey) parts.push(`-H 'Authorization: Bearer ${maskKey(apiKey)}'`);
  if (body !== undefined)
    parts.push(`-H 'Content-Type: application/json' -d '${JSON.stringify(body)}'`);
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
    const list = Array.isArray(obj.data) ? obj.data : Array.isArray(obj.models) ? obj.models : null;
    if (!list) return [];
    const ids: string[] = [];
    for (const item of list) {
      if (typeof item === 'string') {
        ids.push(item);
      } else if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const id =
          typeof o.id === 'string'
            ? o.id
            : typeof o.model_name === 'string'
              ? o.model_name
              : typeof o.name === 'string'
                ? o.name
                : undefined;
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
  /** Truncated body for display */
  body?: string;
  /** Full body — needed to parse large /models catalogs reliably */
  rawBody?: string;
  error?: string;
}

/** One HTTP probe with a hard timeout; never throws. */
async function probe(url: string, init: RequestInit & { timeoutMs: number }): Promise<WireResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
    });
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
      rawBody: text,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      reached: false,
      authenticated: false,
      endpoint: false,
      ok: false,
      error: aborted
        ? `Timed out after ${init.timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Does this probe prove the API kind exists on the endpoint?
 *
 * - 2xx is the strongest proof.
 * - Other 4xx with accepted credentials (e.g. "max_tokens must be greater
 *   than 2", unknown model id) also proves the route exists and processed
 *   our request — the gateway only objected to the payload.
 * - 401/403 normally mean the key was rejected… unless GET /models already
 *   succeeded with the SAME key and the POST answer is HTTP 403 with a
 *   structured JSON API error (e.g. per-model entitlements like "Deposit
 *   required to unlock premium models"). Then the credentials are fine and
 *   the request clearly reached the gateway's API layer, so the capability
 *   is still confirmed. HTML block pages / proxy denials never parse as
 *   `{error: …}` and stay unconfirmed. (401 stays an auth failure: gateways
 *   whose catch-all middleware 401s routes they do not offer must NOT have
 *   those routes reported as supported.)
 *
 * Auth rejections without proof of valid credentials, missing routes
 * (404/405/501), network failures and server faults (5xx) never confirm.
 */
export function probeConfirmsApi(d: ProviderProbeDetail, credentialsProven = false): boolean {
  if (d.ok) return true;
  if (!d.reached || !d.endpoint) return false;
  if (d.authenticated) {
    return d.httpStatus !== undefined && d.httpStatus >= 400 && d.httpStatus < 500;
  }
  // 403 despite a proven-valid key: only structured API errors count.
  return credentialsProven && d.httpStatus === 403 && isStructuredApiErrorBody(d.body);
}

/** True when the body is a structured JSON API error (`{ "error": … }`). */
function isStructuredApiErrorBody(body?: string): boolean {
  if (!body) return false;
  try {
    const json = JSON.parse(body) as unknown;
    return Boolean(
      json && typeof json === 'object' && 'error' in (json as Record<string, unknown>)
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Probe a provider endpoint and report which wire APIs it supports.
 *
 * 1. GET  {base}/models           → reachability, auth, model list
 * 2. POST {base}/chat/completions → is the OpenAI Chat Completions API up?
 * 3. POST {base}/responses        → is the OpenAI Responses API up?
 * 4. POST {base}/messages         → is the Anthropic Messages API up?
 *
 * The POST probes need a model id; gateways reject model-less pings. We take
 * ids from /models and try several in turn (catalogs often list premium
 * models the key cannot use — e.g. "Deposit required" walls) until one
 * answers, so a working API is never misreported as broken because the first
 * catalog entry happened to be locked.
 *
 * Interpretation:
 * - 2xx on a route           → the API works end to end.
 * - 400/422 (etc.)           → the API is CONFIRMED: the route exists,
 *   credentials were accepted and the request was processed — only our
 *   minimal ping payload was rejected by request validation.
 * - 404/405/501 on a route  → the API is not offered (e.g. ChatGPT without
 *   chat completions) and the provider can only serve the other protocol.
 * - 401/403                  → reachable, but the API key was rejected
 *   (unless /models proved the same key valid and a structured JSON error
 *   came back — see probeConfirmsApi).
 * - network failure / timeout → unreachable.
 */
export async function probeProviderAPIs(
  options: ProbeProviderOptions
): Promise<ProviderVerificationResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = normalizeBaseUrl(options.baseUrl);
  const apiKey = options.apiKey || undefined;
  const authHeaders: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  // 1) GET /models — resolve the API root first (bare host → try /v1).
  let modelsProbe: ProviderProbeDetail | undefined;
  let modelIds: string[] = [];
  let apiRoot = base;
  for (const candidate of endpointCandidates(base)) {
    const url = `${candidate}/models`;
    const raw = await probe(url, {
      method: 'GET',
      headers: { ...authHeaders },
      timeoutMs,
    });
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
      // Parse from the FULL body — truncating first would cut large model
      // catalogs mid-JSON and silently yield an empty list.
      modelIds = parseModelIds(raw.rawBody ?? raw.body);
      apiRoot = candidate;
      break;
    }
  }

  /** Model ids to cycle through when a gateway rejects specific models. */
  const candidates = (modelIds.length > 0 ? modelIds : [undefined]).slice(0, MAX_PROBE_MODELS);

  /**
   * Run a POST probe once per candidate model id until one returns 2xx.
   * The last attempt's detail is kept otherwise (confirmation rules still
   * apply to it). Single-shot when there are no model ids at all.
   */
  const probeWithModels = async (
    kind: ProviderApiKind | 'models',
    path: string,
    buildBody: (model?: string) => unknown,
    buildHeaders: () => Record<string, string>
  ): Promise<{ detail: ProviderProbeDetail; body: unknown }> => {
    let last: { detail: ProviderProbeDetail; body: unknown } | undefined;
    for (const model of candidates) {
      const body = buildBody(model);
      const url = `${apiRoot}${path}`;
      const raw = await probe(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(body),
        timeoutMs,
      });
      last = {
        detail: {
          api: kind,
          ok: raw.ok,
          reached: raw.reached,
          authenticated: raw.authenticated,
          endpoint: raw.endpoint,
          httpStatus: raw.status,
          curl: buildCurl('POST', url, apiKey, body),
          body: raw.body,
          error: raw.error,
        },
        body,
      };
      if (raw.ok) break;
    }
    return last as { detail: ProviderProbeDetail; body: unknown };
  };

  // 2) POST /chat/completions (OpenAI shape)
  const chat = await probeWithModels(
    'chat',
    '/chat/completions',
    (model) => ({
      ...(model ? { model } : {}),
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8,
    }),
    () => ({ 'Content-Type': 'application/json', ...authHeaders })
  );

  // 3) POST /responses (OpenAI Responses shape) — single shot with the first
  // model; this route is usually either present or absent outright.
  const responsesModel = modelIds[0];
  const responsesUrl = `${apiRoot}/responses`;
  const responsesBody = {
    ...(responsesModel ? { model: responsesModel } : {}),
    input: 'ping',
    max_output_tokens: 8,
  };
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

  // 4) POST /messages (Anthropic Messages shape). Auth via x-api-key plus
  // anthropic-version per the Anthropic spec; the Bearer header is repeated
  // because many multi-protocol gateways only implement bearer auth.
  const anthropic = await probeWithModels(
    'anthropic',
    '/messages',
    (model) => ({
      ...(model ? { model } : {}),
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8,
    }),
    () => ({
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      ...authHeaders,
    })
  );

  // A valid key (proven by GET /models with the same credentials) lets a
  // structured 403 on the POST routes be read as an entitlement denial
  // rather than an auth failure.
  const credentialsProven = modelsProbe?.ok ?? false;

  const supported: ProviderApiKind[] = [];
  const apiAvailability: ProviderVerificationResult['apiAvailability'] = {
    chat: 'rejected',
    responses: 'rejected',
    anthropic: 'rejected',
  };
  const classify = (kind: ProviderApiKind, d: ProviderProbeDetail): boolean => {
    const confirmed = probeConfirmsApi(d, credentialsProven);
    apiAvailability[kind] = !d.reached ? 'unreached' : confirmed ? 'confirmed' : 'rejected';
    if (confirmed) supported.push(kind);
    return confirmed;
  };
  classify('chat', chat.detail);
  classify('responses', responses);
  classify('anthropic', anthropic.detail);

  return {
    baseUrl: apiRoot,
    modelIds,
    models: modelsProbe as ProviderProbeDetail,
    chat: chat.detail,
    responses,
    anthropic: anthropic.detail,
    supported,
    apiAvailability,
    verifiedAt: new Date().toISOString(),
  };
}

/** Shrink a verification result into the registry-stored capabilities record. */
export function toApiCapabilities(result: ProviderVerificationResult): ProviderApiCapabilities {
  return {
    supported: result.supported,
    models: result.modelIds,
    apiAvailability: result.apiAvailability,
    verifiedAt: result.verifiedAt,
  };
}
