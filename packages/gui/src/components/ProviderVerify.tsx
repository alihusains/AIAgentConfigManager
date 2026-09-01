/**
 * ApiVerifier — shared live-verification panel.
 *
 * Used in three places:
 * - Add Provider modal   (mode="probe")  → probes the entered base URL + key
 * - Edit Provider modal  (mode="probe")  → same, against the edited values
 * - Provider details     (mode="test")   → re-verifies a registered provider
 *   against its stored base URL; the API key input is optional and overrides
 *   the stored key for that one test.
 *
 * Every probe runs the actual network call (GET /models, POST
 * /chat/completions, POST /responses), shows its curl equivalent and the raw
 * response body, and reports whether each OpenAI-style API is available.
 */
import { useState } from 'react';
import { api } from '../api';
import type {
  ProviderApiKind,
  ProviderVerificationResult,
  ProviderProbeDetail,
  ProviderApiCapabilities,
} from '@ai-agent-config/core';
import { Zap, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import { Tooltip } from '../ui';

// ---------------------------------------------------------------------------
// API-kind display helpers (shared with ProvidersView)
// ---------------------------------------------------------------------------

export function providerApiLabel(kind: ProviderApiKind): string {
  switch (kind) {
    case 'chat':
      return 'Chat Completions';
    case 'responses':
      return 'Responses';
    case 'anthropic':
      return 'Anthropic Messages';
  }
}

export function providerApiBadgeClass(kind: ProviderApiKind): string {
  switch (kind) {
    case 'chat':
      return 'badge-chat';
    case 'responses':
      return 'badge-responses';
    case 'anthropic':
      return 'badge-anthropic';
  }
}

/**
 * Compact per-protocol ✓/✗ ticks.
 *
 * Unlike the supported-only badge row, this renders all three wire protocols
 * and marks each as verified (✓) or not confirmed (✗), so a reader can tell at
 * a glance which protocols a provider definitely does *not* speak. Only render
 * it when a verification result exists — an unverified provider is "unknown",
 * not "failed".
 */
const ALL_KINDS: ProviderApiKind[] = ['chat', 'responses', 'anthropic'];

export function ProtocolTicks({
  supported,
}: {
  supported: ProviderApiKind[];
}) {
  const set = new Set(supported);
  return (
    <span className="proto-ticks">
      {ALL_KINDS.map((k) => {
        const ok = set.has(k);
        return (
          <Tooltip key={k} content={`${providerApiLabel(k)}: ${ok ? 'verified' : 'not confirmed'}`}>
          <span
            className={`proto-tick ${ok ? 'is-ok' : 'is-fail'}`}
          >
            {ok ? '✓' : '✗'} {k}
          </span>
          </Tooltip>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Probe card
// ---------------------------------------------------------------------------

/**
 * Mirror of core's probeConfirmsApi (this package imports only types from
 * core — the core barrel pulls in Node built-ins). A 4xx validation rejection
 * proves the route exists; a structured 403 while /models authenticated the
 * key is an entitlement denial, not an auth failure.
 */
function probeConfirmed(d: ProviderProbeDetail, credentialsProven: boolean): boolean {
  if (d.ok) return true;
  if (!d.reached || !d.endpoint) return false;
  if (d.authenticated) {
    return d.httpStatus !== undefined && d.httpStatus >= 400 && d.httpStatus < 500;
  }
  if (!credentialsProven || d.httpStatus !== 403 || !d.body) return false;
  try {
    const json = JSON.parse(d.body) as unknown;
    return Boolean(
      json && typeof json === 'object' && 'error' in (json as Record<string, unknown>)
    );
  } catch {
    return false;
  }
}

const TONES = {
  success: {
    bg: 'color-mix(in srgb, var(--accent-success) 14%, transparent)',
    color: 'var(--accent-success)',
  },
  warning: {
    bg: 'color-mix(in srgb, var(--accent-warning) 14%, transparent)',
    color: 'var(--accent-warning)',
  },
  error: {
    bg: 'color-mix(in srgb, var(--accent-error) 14%, transparent)',
    color: 'var(--accent-error)',
  },
} as const;

function ProbeCard({
  probe,
  label,
  endpoint,
  credentialsProven,
}: {
  probe: ProviderProbeDetail;
  label: string;
  endpoint: string;
  /** GET /models authenticated the key — lets structured 403s read as entitlement denials */
  credentialsProven?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const status = probe.ok
    ? { tone: 'success' as const, text: `OK · HTTP ${probe.httpStatus ?? '—'}` }
    : probeConfirmed(probe, credentialsProven ?? false)
      ? {
          tone: 'success' as const,
          text: `Confirmed · HTTP ${probe.httpStatus} · request rejected by API`,
        }
      : !probe.reached
        ? { tone: 'error' as const, text: 'Unreachable' }
        : !probe.authenticated
          ? {
              tone: 'warning' as const,
              text: `Auth rejected · HTTP ${probe.httpStatus}`,
            }
          : !probe.endpoint
            ? {
                tone: 'error' as const,
                text: `API not offered · HTTP ${probe.httpStatus}`,
              }
            : {
                tone: 'warning' as const,
                text: `Request rejected · HTTP ${probe.httpStatus}`,
              };

  const copyOutput = async (e: React.MouseEvent) => {
    e.preventDefault();
    const text = `${probe.curl}\n\n${probe.body ?? probe.error ?? '(no response body)'}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-tertiary font-mono break-all mt-0.5">{endpoint}</p>
        </div>
        <span className="badge flex-shrink-0" style={TONES[status.tone]}>
          {status.text}
        </span>
      </div>
      {probe.reached && !probe.authenticated && !probe.ok && (
        <p className="text-xs text-warning mt-1">The API key was rejected — double-check it.</p>
      )}
      <details className="mt-2">
        <summary className="text-xs text-secondary cursor-pointer select-none flex items-center gap-2">
          <span>curl + raw output</span>
          <Tooltip content="Copy curl command and raw output">
          <button
            className="btn-ghost btn-icon btn-sm"
            onClick={copyOutput}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          </Tooltip>
        </summary>
        <pre className="code-block mt-2">{`${probe.curl}\n\n${probe.body ?? probe.error ?? '(no response body)'}`}</pre>
        {copyFailed && (
          <p className="form-help text-error mt-1">
            Copy failed — clipboard is not available in this browser.
          </p>
        )}
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

interface ApiVerifierProps {
  mode: 'probe' | 'test';
  /** mode="probe": the base URL to test (from the form) */
  baseUrl?: string;
  /** mode="probe": the API key to test (from the form) */
  apiKey?: string;
  /** mode="test": the registered provider to re-verify */
  providerId?: string;
  /** Called with the compact capabilities whenever a verification completes */
  onVerified?: (capabilities: ProviderApiCapabilities) => void;
  /** Called with the live model ids (used to auto-fill the model list) */
  onModels?: (modelIds: string[]) => void;
}

export function ApiVerifier({
  mode,
  baseUrl,
  apiKey,
  providerId,
  onVerified,
  onModels,
}: ApiVerifierProps) {
  const [keyOverride, setKeyOverride] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProviderVerificationResult | null>(null);

  const canRun = mode === 'test' ? Boolean(providerId) : Boolean(baseUrl);

  const run = async () => {
    if (!canRun || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res =
        mode === 'test'
          ? await api.testProvider(providerId as string, keyOverride.trim() || undefined)
          : await api.verifyProvider({
              baseUrl: baseUrl as string,
              apiKey: apiKey?.trim() || undefined,
            });
      if (!res.ok) {
        setError(res.error || 'Verification failed');
      } else if (res.data) {
        setResult(res.data);
        onVerified?.({
          supported: res.data.supported,
          models: res.data.modelIds,
          verifiedAt: res.data.verifiedAt,
        });
        if (res.data.modelIds.length > 0) onModels?.(res.data.modelIds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Zap size={14} className="text-accent" />
          Verify connection
        </p>
        <button className="btn-secondary btn-sm" onClick={run} disabled={!canRun || running}>
          {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {mode === 'test' ? 'Test connection' : 'Verify APIs'}
        </button>
      </div>

      {mode === 'test' && (
        <input
          type="password"
          className="input mt-2"
          placeholder="Manual API key (optional — leave empty to use the stored key)"
          value={keyOverride}
          onChange={(e) => setKeyOverride(e.target.value)}
        />
      )}

      {mode === 'probe' && !baseUrl && (
        <p className="text-xs text-tertiary mt-2">
          Enter a base URL above to test the connection and list available models.
        </p>
      )}

      {error && <p className="form-help text-error mt-2">{error}</p>}

      {result && (
        <div className="mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            {result.supported.length === 0 ? (
              <span
                className="badge"
                style={{ background: TONES.error.bg, color: TONES.error.color }}
              >
                No compatible API confirmed
              </span>
            ) : (
              result.supported.map((k) => (
                <span key={k} className={`badge ${providerApiBadgeClass(k)}`}>
                  {providerApiLabel(k)}
                </span>
              ))
            )}
            <span className="text-xs text-secondary ml-1">
              {result.modelIds.length} model
              {result.modelIds.length === 1 ? '' : 's'} available via API
            </span>
            {result.modelIds.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => onModels?.(result.modelIds)}>
                Use all {result.modelIds.length} model
                {result.modelIds.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
          {result.modelIds.length > 0 && (
            <p className="text-xs text-tertiary truncate mt-1" title={result.modelIds.join(', ')}>
              {result.modelIds.slice(0, 5).join(', ')}
              {result.modelIds.length > 5 ? ` … (+${result.modelIds.length - 5} more)` : ''}
            </p>
          )}
          <div className="mt-2">
            <ProbeCard
              probe={result.models}
              label="Models catalog"
              endpoint={`GET ${result.baseUrl}/models`}
            />
          </div>
          <div className="mt-2">
            <ProbeCard
              probe={result.chat}
              label="Chat Completions API (OpenAI)"
              endpoint={`POST ${result.baseUrl}/chat/completions`}
              credentialsProven={result.models.ok}
            />
          </div>
          <div className="mt-2">
            <ProbeCard
              probe={result.responses}
              label="Responses API (OpenAI)"
              endpoint={`POST ${result.baseUrl}/responses`}
              credentialsProven={result.models.ok}
            />
          </div>
          <div className="mt-2">
            <ProbeCard
              probe={result.anthropic}
              label="Messages API (Anthropic-compatible)"
              endpoint={`POST ${result.baseUrl}/messages`}
              credentialsProven={result.models.ok}
            />
          </div>
        </div>
      )}
    </div>
  );
}
