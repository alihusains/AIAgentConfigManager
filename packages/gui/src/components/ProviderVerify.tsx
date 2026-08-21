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
  ProviderVerificationResult,
  ProviderProbeDetail,
  ProviderApiCapabilities,
} from '@ai-agent-config/core';
import { Zap, RefreshCw, Loader2, Copy, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Probe card
// ---------------------------------------------------------------------------

const TONES = {
  success: { bg: 'color-mix(in srgb, var(--accent-success) 14%, transparent)', color: 'var(--accent-success)' },
  warning: { bg: 'color-mix(in srgb, var(--accent-warning) 14%, transparent)', color: 'var(--accent-warning)' },
  error: { bg: 'color-mix(in srgb, var(--accent-error) 14%, transparent)', color: 'var(--accent-error)' },
} as const;

function ProbeCard({ probe, label, endpoint }: { probe: ProviderProbeDetail; label: string; endpoint: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const status = probe.ok
    ? { tone: 'success' as const, text: `OK · HTTP ${probe.httpStatus ?? '—'}` }
    : !probe.reached
      ? { tone: 'error' as const, text: 'Unreachable' }
      : !probe.authenticated
        ? { tone: 'warning' as const, text: `Auth rejected · HTTP ${probe.httpStatus}` }
        : !probe.endpoint
          ? { tone: 'error' as const, text: `API not offered · HTTP ${probe.httpStatus}` }
          : { tone: 'warning' as const, text: `Request rejected · HTTP ${probe.httpStatus}` };

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
          <button
            className="btn-ghost btn-icon btn-sm"
            title="Copy curl command and raw output"
            onClick={copyOutput}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </summary>
        <pre className="code-block mt-2">{`${probe.curl}\n\n${probe.body ?? probe.error ?? '(no response body)'}`}</pre>
        {copyFailed && (
          <p className="form-help text-error mt-1">Copy failed — clipboard is not available in this browser.</p>
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

export function ApiVerifier({ mode, baseUrl, apiKey, providerId, onVerified, onModels }: ApiVerifierProps) {
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
        <p className="text-xs text-tertiary mt-2">Enter a base URL above to test the connection and list available models.</p>
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
                No OpenAI-style API confirmed
              </span>
            ) : (
              result.supported.map((k) => (
                <span key={k} className={`badge ${k === 'chat' ? 'badge-chat' : 'badge-responses'}`}>
                  {k === 'chat' ? 'Chat Completions' : 'Responses'}
                </span>
              ))
            )}
            <span className="text-xs text-secondary ml-1">
              {result.modelIds.length} model{result.modelIds.length === 1 ? '' : 's'} available via API
            </span>
            {result.modelIds.length > 0 && (
              <button className="btn-ghost btn-sm" onClick={() => onModels?.(result.modelIds)}>
                Use all {result.modelIds.length} model{result.modelIds.length === 1 ? '' : 's'}
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
            <ProbeCard probe={result.models} label="Models catalog" endpoint={`GET ${result.baseUrl}/models`} />
          </div>
          <div className="mt-2">
            <ProbeCard probe={result.chat} label="Chat Completions API" endpoint={`POST ${result.baseUrl}/chat/completions`} />
          </div>
          <div className="mt-2">
            <ProbeCard probe={result.responses} label="Responses API" endpoint={`POST ${result.baseUrl}/responses`} />
          </div>
        </div>
      )}
    </div>
  );
}
