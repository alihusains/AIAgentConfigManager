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
import type { ProviderApiCapabilities, ProviderVerificationResult } from './types';
export interface ProbeProviderOptions {
    /** e.g. https://api.openai.com/v1 or https://ic-chat.devenv.icm/api/v1 */
    baseUrl: string;
    apiKey?: string;
    timeoutMs?: number;
}
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
export declare function probeProviderAPIs(options: ProbeProviderOptions): Promise<ProviderVerificationResult>;
/** Shrink a verification result into the registry-stored capabilities record. */
export declare function toApiCapabilities(result: ProviderVerificationResult): ProviderApiCapabilities;
//# sourceMappingURL=provider-test.d.ts.map