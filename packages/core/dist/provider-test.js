"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeProviderAPIs = probeProviderAPIs;
exports.toApiCapabilities = toApiCapabilities;
const DEFAULT_TIMEOUT_MS = 10_000;
/** Cap raw bodies at a readable size for the UI. */
const BODY_LIMIT = 1500;
// ============================================================================
// Helpers
// ============================================================================
/** Mask a key for display purposes (e.g. `sk-a3…9z`) without revealing it. */
function maskKey(key) {
    if (!key)
        return '<no-api-key>';
    if (key.length <= 8)
        return '***';
    return `${key.slice(0, 4)}…${key.slice(-2)}`;
}
/** Build a readable, re-runnable curl command for one probe (key masked). */
function buildCurl(method, url, apiKey, body) {
    const parts = [`curl -sS -X ${method} '${url}'`];
    if (apiKey)
        parts.push(`-H 'Authorization: Bearer ${maskKey(apiKey)}'`);
    if (body !== undefined)
        parts.push(`-H 'Content-Type: application/json' -d '${JSON.stringify(body)}'`);
    return parts.join(' \\\n  ');
}
/** Normalize a pasted base URL; tolerate a full endpoint path being pasted. */
function normalizeBaseUrl(raw) {
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
function endpointCandidates(base) {
    const path = new URL(base).pathname;
    if (!path || path === '/')
        return [base, `${base}/v1`];
    return [base];
}
/** Extract model ids from a /models response (OpenAI, LiteLLM, routers…). */
function parseModelIds(body) {
    if (!body)
        return [];
    try {
        const json = JSON.parse(body);
        const obj = json && typeof json === 'object' ? json : {};
        let list = Array.isArray(obj.data) ? obj.data : Array.isArray(obj.models) ? obj.models : null;
        if (!list)
            return [];
        const ids = [];
        for (const item of list) {
            if (typeof item === 'string') {
                ids.push(item);
            }
            else if (item && typeof item === 'object') {
                const o = item;
                const id = typeof o.id === 'string' ? o.id : typeof o.model_name === 'string' ? o.model_name : typeof o.name === 'string' ? o.name : undefined;
                if (id)
                    ids.push(id);
            }
        }
        return ids;
    }
    catch {
        return [];
    }
}
/** One HTTP probe with a hard timeout; never throws. */
async function probe(url, init) {
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
    }
    catch (err) {
        const aborted = err instanceof Error && err.name === 'AbortError';
        return {
            reached: false,
            authenticated: false,
            endpoint: false,
            ok: false,
            error: aborted ? `Timed out after ${init.timeoutMs}ms` : err instanceof Error ? err.message : String(err),
        };
    }
    finally {
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
async function probeProviderAPIs(options) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const base = normalizeBaseUrl(options.baseUrl);
    const apiKey = options.apiKey || undefined;
    const authHeaders = apiKey
        ? { Authorization: `Bearer ${apiKey}` }
        : {};
    // 1) GET /models — resolve the API root first (bare host → try /v1).
    let modelsProbe;
    let modelIds = [];
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
    const chat = {
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
    const responses = {
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
    const supported = [];
    if (chat.ok)
        supported.push('chat');
    if (responses.ok)
        supported.push('responses');
    return {
        baseUrl: apiRoot,
        modelIds,
        models: modelsProbe,
        chat,
        responses,
        supported,
        verifiedAt: new Date().toISOString(),
    };
}
/** Shrink a verification result into the registry-stored capabilities record. */
function toApiCapabilities(result) {
    return {
        supported: result.supported,
        models: result.modelIds,
        verifiedAt: result.verifiedAt,
    };
}
//# sourceMappingURL=provider-test.js.map