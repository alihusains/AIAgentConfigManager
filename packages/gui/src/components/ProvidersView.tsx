import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { AgentPicker } from './AgentPicker';
import { AgentIcon } from './AgentIcon';
import { ModelChecklist } from './ModelChecklist';
import { Status, Tooltip } from '../ui';
import { ApiVerifier, providerApiLabel, ProtocolTicks } from './ProviderVerify';
import type {
  ModelProvider,
  ModelConfig,
  DetectedAgent,
  RegistryProvider,
  ProviderApiCapabilities,
} from '@ai-agent-config/core';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Database,
  Zap,
  Globe,
  Cloud,
  Lock,
} from 'lucide-react';

/**
 * Provider types. Brand tinting is applied via `.ptype-<id>` CSS classes
 * (see index.css) so no brand hex lives in component code; the `id` is the
 * single key that drives icon, label and color.
 */
const PROVIDER_TYPES = [
  { id: 'anthropic', name: 'Anthropic', icon: Zap },
  { id: 'openai-compatible', name: 'OpenAI Compatible', icon: Globe },
  { id: 'bedrock', name: 'AWS Bedrock', icon: Cloud },
  { id: 'vertex', name: 'Google Vertex AI', icon: Cloud },
] as const;

const DEFAULT_ROLES: ModelConfig['roles'] = ['chat', 'edit', 'apply', 'summarize'];

/** How many agent circles render before the stack collapses to "+N". */
const AVATAR_STACK_MAX = 4;

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Compact avatar stack for the "Installed On" column: overlapping agent
 * icon circles (capped at AVATAR_STACK_MAX + a "+N" count) that expand to the
 * full, per-agent removable list on hover/focus. Replaces the old chip wall
 * one pill per agent (E3: pills → avatars). Dimmed agents use a config
 * format that cannot store model providers — they stay registered but their
 * files are never written, so they read as muted.
 */
function AgentAvatarStack({
  agentIds,
  agents,
  onToggle,
}: {
  agentIds: string[];
  agents: DetectedAgent[];
  onToggle: (agentId: string) => void;
}) {
  if (agentIds.length === 0) {
    return <span className="text-xs text-tertiary">none</span>;
  }
  const visible = agentIds.slice(0, AVATAR_STACK_MAX);
  const remaining = agentIds.length - visible.length;
  return (
    <div className="avatar-stack">
      {visible.map((id) => {
        const agent = agents.find((a) => a.id === id);
        const supported = agentTakesModels(agents, id);
        const name = agent?.name || id;
        return (
          <Tooltip
            key={id}
            content={
              supported
                ? name
                : `${name} — config format cannot store model providers (not written to its files)`
            }
          >
          <span
            className={`avatar${supported ? '' : ' avatar-dim'}`}
          >
            {agent ? (
              <AgentIcon id={agent.id} size={14} />
            ) : (
              <span className="avatar-initials">{initialsFor(name)}</span>
            )}
          </span>
          </Tooltip>
        );
      })}
      {remaining > 0 && (
        <Tooltip content={`${remaining} more agent(s)`}>
        <span className="avatar avatar-more">
          +{remaining}
        </span>
        </Tooltip>
      )}
      <div className="avatar-pop">
        {agentIds.map((id) => {
          const agent = agents.find((a) => a.id === id);
          const supported = agentTakesModels(agents, id);
          const name = agent?.name || id;
          return (
            <Tooltip
              key={id}
              content={
                supported
                  ? undefined
                  : `${name}'s config format cannot store model providers — nothing was written to its files`
              }
              disabled={supported}
            >
            <span
              className={`avatar-pop-row${supported ? '' : ' avatar-dim'}`}
            >
              {agent ? (
                <AgentIcon id={agent.id} size={14} />
              ) : (
                <span className="avatar-initials">{initialsFor(name)}</span>
              )}
              <span className="avatar-pop-name">{name}</span>
              <button
                className="avatar-pop-remove"
                aria-label={`Remove from ${name}`}
                onClick={() => onToggle(id)}
              >
                ×
              </button>
            </span>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Some agent config formats cannot store model providers at all (Pi, Junie,
 * FreeBuff, OMP manage their own model lists). Registry entries still record
 * them, but nothing is ever written to their files — surface that honestly
 * instead of showing them as normal installs.
 */
function agentTakesModels(agents: DetectedAgent[], id: string): boolean {
  return agents.find((a) => a.id === id)?.supports.modelProviders ?? true;
}

export function ProvidersView() {
  const { registry, agents, loading, toggleProviderAgent, deleteProvider } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ModelProvider | null>(null);
  const [details, setDetails] = useState<RegistryProvider | null>(null);

  // Phase 1 (Secrets): keychain availability for the per-row "Move to keychain"
  // action — probed once per view mount (the same capability the Add Provider
  // form probes before submit). null = not yet known.
  const [keychainAvailable, setKeychainAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Guard: tests may reset api mocks between render cycles, leaving
    // getKeychainAvailability returning undefined.
    const p = api.getKeychainAvailability();
    if (!p) {
      setKeychainAvailable(false);
      return;
    }
    p.then((res) => {
      if (!cancelled) setKeychainAvailable(res.ok ? (res.data?.available ?? false) : false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const providers = registry?.providers || [];

  /**
   * Phase 1 (Secrets): move ONE provider's plaintext API key into the OS
   * keychain (explicit click only — never automatic, never bulk). On success
   * the registry refreshes and the row shows the keychain lock badge; on
   * failure the REAL server error is surfaced (no generic fallback).
   */
  const migrateToKeychain = async (providerId: string) => {
    const res = await api.migrateProviderToKeychain(providerId);
    if (!res.ok) {
      useStore.getState().addToast({ type: 'error', title: 'Keychain Migration Failed', message: res.error || 'Unknown error' });
      return;
    }
    await useStore.getState().refreshAll();
    useStore.getState().addToast({
      type: 'success',
      title: 'Moved to Keychain',
      message: `"${providerId}"'s API key is now stored in the OS keychain`,
    });
  };

  const handleDelete = async (provider: ModelProvider) => {
    const installed =
      registry?.providers.find((p) => p.provider.id === provider.id)?.agentIds.length || 0;
    if (
      !confirm(
        `Delete provider "${provider.name}" from the registry?\n\nIt is currently installed on ${installed} agent(s) — those configs will be cleaned up.`
      )
    ) {
      return;
    }
    await deleteProvider(provider.id);
  };

  const handleToggleEnabled = async (provider: ModelProvider) => {
    await useStore.getState().updateProvider(provider.id, { enabled: !provider.enabled });
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Model Providers</h1>
          <p className="text-secondary text-sm mt-1">
            One definition per provider — the registry installs it into every agent listed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>
            <Plus size={16} />
            Add Provider
          </button>
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Database size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No Providers Registered</h3>
            <p className="empty-state-message">
              Add a model provider once, then pick which agents it gets installed into.
            </p>
            <button className="btn-primary mt-4" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Provider
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container providers-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>APIs</th>
                  <th>Models</th>
                  <th>Installed On</th>
                  <th>Status</th>
                  <th style={{ width: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {providers.map(
                  ({ provider, models, agentIds, apiCapabilities, keychainSecretRef }) => {
                    const typeInfo = PROVIDER_TYPES.find((t) => t.id === provider.type);
                    const Icon = typeInfo?.icon || Database;
                    const ptypeClass = `ptype-${typeInfo?.id ?? 'default'}`;
                    return (
                      <tr key={provider.id} className="provider-row">
                        <td>
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`p-2 rounded-lg flex-shrink-0 ptype-icon ${ptypeClass}`}
                            >
                              <Icon size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="provider-name truncate">
                                {provider.name}
                                {keychainSecretRef && (
                                  <Tooltip content="API key stored in OS keychain">
                                  <span
                                    className="badge badge-success ml-2 align-middle"
                                  >
                                    <Lock size={10} />
                                    keychain
                                  </span>
                                  </Tooltip>
                                )}
                              </p>
                              <p className="text-xs text-tertiary font-mono">{provider.id}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge type-badge ptype-badge ${ptypeClass}`}>
                            <Icon size={11} />
                            {typeInfo?.name || provider.type}
                          </span>
                        </td>
                        <td>
                          {!apiCapabilities ? (
                            <span className="text-xs text-tertiary">not verified</span>
                          ) : apiCapabilities.supported.length === 0 ? (
                            <span className="text-xs text-error">no API confirmed</span>
                          ) : (
                            <Tooltip content={`Verified ${new Date(apiCapabilities.verifiedAt).toLocaleString()}`}>
                            <span
                              className="text-xs text-secondary"
                            >
                              {apiCapabilities.supported
                                .map((k) => providerApiLabel(k))
                                .join(' · ')}
                            </span>
                            </Tooltip>
                          )}
                        </td>
                        <td>
                          {models.length === 0 ? (
                            <span className="text-xs text-tertiary">no models</span>
                          ) : (
                            <Tooltip content={models.map((m) => m.name).join('\n')}>
                            <span
                              className="text-xs text-secondary"
                            >
                              {models.length} model{models.length > 1 ? 's' : ''}
                            </span>
                            </Tooltip>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <AgentAvatarStack
                              agentIds={agentIds}
                              agents={agents}
                              onToggle={(agentId) => toggleProviderAgent(provider.id, agentId)}
                            />
                            <AgentPicker
                              kind="provider"
                              targets={agentIds}
                              agents={agents}
                              onToggle={(agentId) => toggleProviderAgent(provider.id, agentId)}
                            />
                          </div>
                        </td>
                        <td>
                          <Tooltip content="Toggle enabled">
                          <button
                            className="switch-row"
                            onClick={() => handleToggleEnabled(provider)}
                            role="switch"
                            aria-checked={provider.enabled}
                          >
                            <span className={`switch ${provider.enabled ? 'switch-on' : ''}`}>
                              <span className="switch-thumb" />
                            </span>
                            <span
                              className={
                                provider.enabled
                                  ? 'text-success text-sm font-medium'
                                  : 'text-tertiary text-sm'
                              }
                            >
                              {provider.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </button>
                          </Tooltip>
                        </td>
                        <td>
                          <div className="row-actions flex items-center gap-1">
                            {keychainAvailable === true &&
                              !keychainSecretRef &&
                              typeof provider.config.apiKey === 'string' &&
                              provider.config.apiKey.length > 0 && (
                                <Tooltip content="Move API key to OS keychain">
                                <button
                                  className="btn-ghost btn-icon btn-sm"
                                  onClick={() => migrateToKeychain(provider.id)}
                                >
                                  <Lock size={14} />
                                </button>
                                </Tooltip>
                              )}
                            <Tooltip content="Details">
                            <button
                              className="btn-ghost btn-icon btn-sm"
                              onClick={() =>
                                setDetails({
                                  provider,
                                  models,
                                  agentIds,
                                  apiCapabilities,
                                })
                              }
                            >
                              <Eye size={14} />
                            </button>
                            </Tooltip>
                            <Tooltip content="Edit">
                            <button
                              className="btn-ghost btn-icon btn-sm"
                              onClick={() => setEditing(provider)}
                            >
                              <Edit size={14} />
                            </button>
                            </Tooltip>
                            <Tooltip content="Delete">
                            <button
                              className="btn-ghost btn-icon btn-sm text-error"
                              onClick={() => handleDelete(provider)}
                            >
                              <Trash2 size={14} />
                            </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <AddProviderModal
          onClose={() => setShowAdd(false)}
          agents={agents}
          existingIds={providers.map((p) => p.provider.id)}
        />
      )}
      {editing && <EditProviderModal provider={editing} onClose={() => setEditing(null)} />}
      {details && <ProviderDetailsModal entry={details} onClose={() => setDetails(null)} />}
    </div>
  );
}

// ============================================================================
// Add Provider modal
// ============================================================================

interface AddProviderModalProps {
  onClose: () => void;
  agents: DetectedAgent[];
  existingIds: string[];
}

/**
 * "Only free models" filter — a model counts as free when its id contains
 * "free" (case-insensitive), matching how gateways name them
 * (e.g. "deepseek-v4-flash-free", "glm-5-airx-free").
 */
const isFreeModel = (id: string): boolean => /free/i.test(id);

export function AddProviderModal({ onClose, agents, existingIds }: AddProviderModalProps) {
  const { refreshAll } = useStore();
  const [form, setForm] = useState({
    type: 'openai-compatible' as ModelProvider['type'],
    id: '',
    name: '',
    apiKey: '',
    baseUrl: '',
    region: '',
    project: '',
    modelNames: '',
    onlyFree: false,
    keychainStorage: false,
    targetAgentIds: agents
      .filter((a) => a.detection.installed && a.supports.modelProviders)
      .map((a) => a.id),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  /** Live verification result (probed via the ApiVerifier below) */
  const [verified, setVerified] = useState<ProviderApiCapabilities | null>(null);
  const [knownModelIds, setKnownModelIds] = useState<string[]>([]);
  const { addToast } = useStore();
  // Pre-submit keychain-availability probe (Phase 1 Secrets): checked live
  // when the toggle is turned on, so the user is told BEFORE submitting that
  // the OS keychain is unusable in this environment.
  const [keychainAvailable, setKeychainAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!form.keychainStorage) {
      setKeychainAvailable(null);
      return;
    }
    let cancelled = false;
    // Guard: tests may reset api mocks between render cycles, leaving
    // getKeychainAvailability returning undefined.
    const p = api.getKeychainAvailability();
    if (!p) {
      setKeychainAvailable(false);
      return;
    }
    p.then((res) => {
      if (!cancelled) setKeychainAvailable(res.ok ? (res.data?.available ?? false) : false);
    });
    return () => {
      cancelled = true;
    };
  }, [form.keychainStorage]);

  // A changed endpoint or key invalidates a previous verification.
  useEffect(() => {
    setVerified(null);
  }, [form.baseUrl, form.apiKey]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.id.trim()) e.id = 'Provider ID is required';
    else if (existingIds.includes(form.id)) e.id = 'This ID already exists in the registry';
    if (!form.name.trim()) e.name = 'Display name is required';
    if (form.type === 'anthropic' && !form.apiKey.trim()) e.apiKey = 'API key is required';
    if (form.keychainStorage && !form.apiKey.trim())
      e.apiKey = 'API key is required to store it in the OS keychain';
    if (form.type === 'bedrock' && !form.region.trim()) e.region = 'Region is required';
    if (form.type === 'vertex' && !form.project.trim()) e.project = 'Project is required';
    if (form.targetAgentIds.length === 0) e.targetAgentIds = 'Pick at least one agent';
    if (
      form.onlyFree &&
      form.modelNames.trim() &&
      !form.modelNames.split(',').some((m) => isFreeModel(m.trim()))
    ) {
      e.modelNames = 'Only free models is on, but no model id above contains "free"';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || submitting) return;

    const config: Record<string, unknown> = {};
    if (form.apiKey) config.apiKey = form.apiKey;
    if (form.baseUrl) config.baseUrl = form.baseUrl;
    if (form.region) config.region = form.region;
    if (form.project) config.project = form.project;

    const provider: ModelProvider = {
      id: form.id.trim(),
      name: form.name.trim(),
      type: form.type,
      config,
      enabled: true,
      priority: 0,
    };

    const models: ModelConfig[] = form.modelNames
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
      .filter((m) => !form.onlyFree || isFreeModel(m))
      .map((modelId) => ({
        id: modelId,
        providerId: provider.id,
        name: modelId,
        displayName: modelId,
        roles: [...DEFAULT_ROLES],
        capabilities: ['tool_use'],
      }));

    // Pre-submit gate: if the OS keychain is confirmed unavailable, stop
    // before the request instead of letting it fail server-side.
    if (form.keychainStorage && keychainAvailable === false) {
      addToast({
        type: 'error',
        title: 'OS keychain unavailable',
        message:
          'The OS keychain cannot be reached in this environment, so the API key ' +
          'cannot be stored there. Unlock the keychain and retry, or save the ' +
          'provider without keychain storage.',
      });
      return;
    }
    setSubmitting(true);
    // Direct api call (not the store's addProvider) so the opt-in
    // `keychainStorage` flag can reach the server; on failure the REAL
    // server error (e.g. keychain write failure) is surfaced verbatim —
    // never a generic message.
    const res = await api.addProvider(
      provider,
      models,
      form.targetAgentIds,
      verified ?? undefined,
      form.keychainStorage
    );
    setSubmitting(false);
    // Guard: tests may reset api mocks between render cycles, leaving
    // addProvider returning undefined.
    if (!res) {
      addToast({
        type: 'error',
        title: 'Add Provider Failed',
        message: 'The server returned an empty response. Please try again.',
      });
      return;
    }
    if (!res.ok) {
      addToast({
        type: 'error',
        title: 'Add Provider Failed',
        message: res.error || 'Unknown error',
      });
      return;
    }
    addToast({
      type: 'success',
      title: 'Provider Added',
      message: `"${provider.name}" registered and installed into ${form.targetAgentIds.length} agent(s)`,
    });
    await refreshAll();
    onClose();
  };

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Model Provider</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Provider Type</label>
              <select
                className="input select"
                value={form.type}
                onChange={(e) => set({ type: e.target.value as ModelProvider['type'] })}
              >
                {PROVIDER_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Provider ID</label>
                <input
                  className={`input ${errors.id ? 'input-error' : ''}`}
                  placeholder="e.g., anthropic-main, internal-gw"
                  value={form.id}
                  onChange={(e) => set({ id: e.target.value })}
                />
                {errors.id && <p className="form-help text-error">{errors.id}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder="e.g., Anthropic"
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
                {errors.name && <p className="form-help text-error">{errors.name}</p>}
              </div>
            </div>

            {(form.type === 'anthropic' || form.type === 'openai-compatible') && (
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  className={`input ${errors.apiKey ? 'input-error' : ''}`}
                  type="password"
                  placeholder="sk-…"
                  value={form.apiKey}
                  onChange={(e) => set({ apiKey: e.target.value })}
                />
                {errors.apiKey && <p className="form-help text-error">{errors.apiKey}</p>}
                <label className="checkbox-wrapper" style={{ marginTop: 6 }}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.keychainStorage}
                    onChange={(e) => set({ keychainStorage: e.target.checked })}
                  />
                  <span className="checkbox-label">Store in OS keychain</span>
                </label>
                <p className="form-help">
                  Opt-in: the key is written to the OS keychain and only an empty placeholder is
                  kept in registry.json. Off by default.
                </p>
                {form.keychainStorage && keychainAvailable === false && (
                  <p className="form-help text-error">
                    OS keychain is not available in this environment — saving with keychain storage
                    is disabled until the keychain can be reached.
                  </p>
                )}
                {form.keychainStorage && keychainAvailable === true && (
                  <p className="form-help text-success">OS keychain is available.</p>
                )}
              </div>
            )}
            {form.type === 'openai-compatible' && (
              <div className="form-group">
                <label className="form-label">Base URL</label>
                <input
                  className="input"
                  placeholder="https://api.openai.com/v1"
                  value={form.baseUrl}
                  onChange={(e) => set({ baseUrl: e.target.value })}
                />
                <p className="form-help">Custom OpenAI-compatible endpoint (optional)</p>
              </div>
            )}

            {form.type === 'openai-compatible' && (
              <div className="form-group">
                <ApiVerifier
                  mode="probe"
                  baseUrl={form.baseUrl.trim() || undefined}
                  apiKey={form.apiKey.trim() || undefined}
                  onVerified={setVerified}
                  onModels={(ids) => {
                    setKnownModelIds((known) => Array.from(new Set([...known, ...ids])));
                    set({
                      modelNames: (form.onlyFree ? ids.filter(isFreeModel) : ids).join(', '),
                    });
                  }}
                />
                {verified && (
                  <p className="form-help text-success mt-2">
                    ✓ Verified {new Date(verified.verifiedAt).toLocaleString()} — the API support
                    result is saved together with this provider.
                  </p>
                )}
              </div>
            )}
            {form.type === 'bedrock' && (
              <div className="form-group">
                <label className="form-label">AWS Region</label>
                <input
                  className={`input ${errors.region ? 'input-error' : ''}`}
                  placeholder="us-east-1"
                  value={form.region}
                  onChange={(e) => set({ region: e.target.value })}
                />
                {errors.region && <p className="form-help text-error">{errors.region}</p>}
              </div>
            )}
            {form.type === 'vertex' && (
              <div className="form-group">
                <label className="form-label">Google Cloud Project</label>
                <input
                  className={`input ${errors.project ? 'input-error' : ''}`}
                  placeholder="my-project-id"
                  value={form.project}
                  onChange={(e) => set({ project: e.target.value })}
                />
                {errors.project && <p className="form-help text-error">{errors.project}</p>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Model Names (optional)</label>
              <ModelChecklist
                knownModelIds={knownModelIds}
                value={form.modelNames}
                onChange={(next) => set({ modelNames: next })}
              />
              <p className="form-help">
                Models are registered alongside the provider and written into each agent.
              </p>
              <label className="checkbox-wrapper" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={form.onlyFree}
                  onChange={(e) => {
                    const onlyFree = e.target.checked;
                    setForm((f) => ({
                      ...f,
                      onlyFree,
                      // Re-apply the filter to whatever is in the field now.
                      modelNames: onlyFree
                        ? f.modelNames
                            .split(',')
                            .map((m) => m.trim())
                            .filter((m) => m && isFreeModel(m))
                            .join(', ')
                        : f.modelNames,
                    }));
                  }}
                />
                <span className="checkbox-label">Only free models</span>
              </label>
              {form.onlyFree && (
                <p className="form-help">
                  Only models whose id contains “free” are registered and written into the agents —
                  verification auto-fills just those.
                </p>
              )}
              {errors.modelNames && <p className="form-help text-error">{errors.modelNames}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Install Into Agents</label>
              <div className="border rounded overflow-auto" style={{ maxHeight: 160 }}>
                {agents.map((agent) => {
                  const supported = agent.supports.modelProviders;
                  return (
                    <Tooltip
                      key={agent.id}
                      content={
                        supported
                          ? undefined
                          : `${agent.name}'s config format cannot store model providers — nothing would be written to its files`
                      }
                      disabled={supported}
                    >
                    <label
                      className={`flex items-center gap-2 px-2 py-1 hover:bg-bg-hover ${
                        supported ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={form.targetAgentIds.includes(agent.id)}
                        disabled={!supported}
                        onChange={(e) =>
                          set({
                            targetAgentIds: e.target.checked
                              ? [...form.targetAgentIds, agent.id]
                              : form.targetAgentIds.filter((id) => id !== agent.id),
                          })
                        }
                      />
                      <span className="flex-1 text-sm">{agent.name}</span>
                      {!supported ? (
                        <span className="badge badge-neutral">no model support</span>
                      ) : agent.detection.installed ? (
                        <span className="badge badge-success">
                          {agent.detection.version || 'installed'}
                        </span>
                      ) : (
                        <span className="text-xs text-tertiary">path-based</span>
                      )}
                    </label>
                    </Tooltip>
                  );
                })}
              </div>
              {errors.targetAgentIds && (
                <p className="form-help text-error">{errors.targetAgentIds}</p>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || (form.keychainStorage && keychainAvailable === false)}
            >
              <Plus size={16} />
              Add Provider
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Edit Provider modal
// ============================================================================

interface EditProviderModalProps {
  provider: ModelProvider;
  onClose: () => void;
}

export function EditProviderModal({ provider, onClose }: EditProviderModalProps) {
  const { registry, updateProvider } = useStore();
  const config = (provider.config || {}) as Record<string, unknown>;
  const currentModels =
    registry?.providers.find((p) => p.provider.id === provider.id)?.models || [];
  const [form, setForm] = useState({
    name: provider.name,
    apiKey: String(config.apiKey || ''),
    baseUrl: String(config.baseUrl || ''),
    region: String(config.region || ''),
    project: String(config.project || ''),
    enabled: provider.enabled,
    modelNames: currentModels.map((m) => m.id).join(', '),
    onlyFree: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState<ProviderApiCapabilities | null>(null);
  const [knownModelIds, setKnownModelIds] = useState<string[]>(currentModels.map((m) => m.id));

  useEffect(() => {
    setVerified(null);
  }, [form.baseUrl, form.apiKey]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const nextConfig = { ...config };
    if (form.apiKey) nextConfig.apiKey = form.apiKey;
    if (form.baseUrl) nextConfig.baseUrl = form.baseUrl;
    if (form.region) nextConfig.region = form.region;
    if (form.project) nextConfig.project = form.project;
    // Only openai-compatible providers expose the model list for editing here
    // (see the same guard on the verifier/model-names fields below); leave
    // `models` undefined for other types so existing entries — including any
    // custom roles/capabilities this form can't represent — are left alone.
    const rawIds = form.modelNames
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    const freeFiltered = rawIds.filter((m) => !form.onlyFree || isFreeModel(m));
    // "Only free models" matched nothing: refuse to save so the model list
    // cannot be wiped by accident.
    if (form.onlyFree && rawIds.length > 0 && freeFiltered.length === 0) {
      setSubmitting(false);
      return;
    }
    const models: ModelConfig[] | undefined =
      provider.type === 'openai-compatible'
        ? freeFiltered.map((modelId) => ({
            id: modelId,
            providerId: provider.id,
            name: modelId,
            displayName: modelId,
            roles: [...DEFAULT_ROLES],
            capabilities: ['tool_use'],
          }))
        : undefined;
    const ok = await updateProvider(
      provider.id,
      {
        name: form.name.trim() || provider.name,
        enabled: form.enabled,
        config: nextConfig,
      },
      verified ?? undefined,
      models
    );
    setSubmitting(false);
    if (ok) onClose();
  };

  const rawIdsNow = form.modelNames
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const freeFilterEmpty = form.onlyFree && rawIdsNow.length > 0 && !rawIdsNow.some(isFreeModel);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Provider — {provider.id}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            {(provider.type === 'anthropic' || provider.type === 'openai-compatible') && (
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  className="input"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                />
              </div>
            )}
            {provider.type === 'openai-compatible' && (
              <div className="form-group">
                <label className="form-label">Base URL</label>
                <input
                  className="input"
                  placeholder="https://api.openai.com/v1"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                />
              </div>
            )}
            {provider.type === 'openai-compatible' && (
              <div className="form-group">
                <ApiVerifier
                  mode="probe"
                  baseUrl={form.baseUrl.trim() || undefined}
                  apiKey={form.apiKey.trim() || undefined}
                  onVerified={setVerified}
                  onModels={(ids) => {
                    setKnownModelIds((known) => Array.from(new Set([...known, ...ids])));
                    setForm((f) => ({
                      ...f,
                      modelNames: (f.onlyFree ? ids.filter(isFreeModel) : ids).join(', '),
                    }));
                  }}
                />
                {verified && (
                  <p className="form-help text-success mt-2">
                    ✓ Verified {new Date(verified.verifiedAt).toLocaleString()} — saved with the
                    provider on Save.
                  </p>
                )}
              </div>
            )}
            {provider.type === 'openai-compatible' && (
              <div className="form-group">
                <label className="form-label">Model Names (optional)</label>
                <ModelChecklist
                  knownModelIds={knownModelIds}
                  value={form.modelNames}
                  onChange={(next) => setForm((f) => ({ ...f, modelNames: next }))}
                />
                <label className="checkbox-wrapper" style={{ marginTop: 6 }}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.onlyFree}
                    onChange={(e) => {
                      const onlyFree = e.target.checked;
                      setForm((f) => ({
                        ...f,
                        onlyFree,
                        modelNames: onlyFree
                          ? f.modelNames
                              .split(',')
                              .map((m) => m.trim())
                              .filter((m) => m && isFreeModel(m))
                              .join(', ')
                          : f.modelNames,
                      }));
                    }}
                  />
                  <span className="checkbox-label">Only free models</span>
                </label>
                <p className="form-help">
                  Comma-separated model ids, saved with the provider on Save — or verify above and
                  use "Use all N models" to auto-fill from the live endpoint.
                  {form.onlyFree ? ' Only ids containing “free” are kept.' : ''}
                </p>
                {freeFilterEmpty && (
                  <p className="form-help text-error">
                    Only free models is on, but no model id above contains "free" — Save is disabled
                    so the model list isn't wiped.
                  </p>
                )}
              </div>
            )}
            {provider.type === 'bedrock' && (
              <div className="form-group">
                <label className="form-label">AWS Region</label>
                <input
                  className="input"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                />
              </div>
            )}
            {provider.type === 'vertex' && (
              <div className="form-group">
                <label className="form-label">Google Cloud Project</label>
                <input
                  className="input"
                  value={form.project}
                  onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}
                />
              </div>
            )}
            <div className="form-group">
              <label className="checkbox-wrapper">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                <span className="checkbox-label">Provider enabled</span>
              </label>
              <p className="form-help">
                Edits update the shared definition; they are materialized into every agent this
                provider is installed on.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || freeFilterEmpty}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Provider Details modal — view/copy credentials, API support, model counts,
// and re-verify the connection against the live endpoint.
// ============================================================================

interface ProviderDetailsModalProps {
  entry: RegistryProvider;
  onClose: () => void;
}

export function ProviderDetailsModal({ entry, onClose }: ProviderDetailsModalProps) {
  const { registry, agents, refreshAll, addToast } = useStore();
  // Resolve the live entry so badges reflect the latest verification.
  const live = registry?.providers.find((p) => p.provider.id === entry.provider.id) || entry;
  const provider = live.provider;
  const config = (provider.config || {}) as Record<string, unknown>;
  const baseUrl = String(config.baseUrl || '');
  const apiKey = String(config.apiKey || '');
  const caps = live.apiCapabilities;
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<'key' | 'url' | null>(null);

  const copy = async (what: 'key' | 'url') => {
    const text = what === 'key' ? apiKey : baseUrl;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      addToast({
        type: 'warning',
        title: 'Copy failed',
        message: 'Clipboard is not available in this browser.',
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Provider Details — {provider.name}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="badge badge-primary">{provider.type}</span>
            <span className="text-xs text-tertiary font-mono">{provider.id}</span>
            {provider.enabled ? (
              <Status status="connected" label="Enabled" />
            ) : (
              <Status status="disabled" label="Disabled" />
            )}
          </div>

          {/* Base URL */}
          <div className="form-group">
            <label className="form-label">Base URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm break-all">{baseUrl || '—'}</code>
              <button
                className="btn-ghost btn-icon btn-sm"
                title="Copy base URL"
                onClick={() => copy('url')}
                disabled={!baseUrl}
              >
                {copied === 'url' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* API key */}
          <div className="form-group">
            <label className="form-label">API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm break-all">
                {apiKey
                  ? revealed
                    ? apiKey
                    : apiKey.length > 8
                      ? `${apiKey.slice(0, 8)}••••••••${apiKey.slice(-4)}`
                      : '••••••••'
                  : '—'}
              </code>
              <button
                className="btn-ghost btn-icon btn-sm"
                title={revealed ? 'Hide API key' : 'Reveal API key'}
                onClick={() => setRevealed((r) => !r)}
                disabled={!apiKey}
              >
                {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                className="btn-ghost btn-icon btn-sm"
                title="Copy API key"
                onClick={() => copy('key')}
                disabled={!apiKey}
              >
                {copied === 'key' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="form-help">
              Stored on this machine only — the dashboard never sends it anywhere else.
            </p>
          </div>

          {/* API support (from live verification) */}
          <div className="form-group">
            <label className="form-label">APIs Available</label>
            {!caps ? (
              <p className="text-xs text-tertiary">Not verified yet — run a test below.</p>
            ) : caps.supported.length === 0 ? (
              <p className="text-xs text-error">No OpenAI-style API confirmed at the last test.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <ProtocolTicks supported={caps.supported} />
                <span className="text-xs text-secondary">
                  verified {caps.verifiedAt ? new Date(caps.verifiedAt).toLocaleString() : ''}
                </span>
              </div>
            )}
            {caps && (
              <p className="form-help">
                {caps.models.length} model{caps.models.length === 1 ? '' : 's'} available via this
                API
                {caps.models.length > 0
                  ? ` (e.g. ${caps.models.slice(0, 3).join(', ')}${caps.models.length > 3 ? '…' : ''})`
                  : ''}
              </p>
            )}
          </div>

          {/* Registered models */}
          <div className="form-group">
            <label className="form-label">Registered Models ({live.models.length})</label>
            {live.models.length === 0 ? (
              <p className="text-xs text-tertiary">No models registered for this provider yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {live.models.map((m) => (
                  <span key={m.id} className="badge badge-neutral">
                    {m.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Installed on */}
          <div className="form-group">
            <label className="form-label">Installed On ({live.agentIds.length})</label>
            <div className="flex items-center gap-1 flex-wrap">
              {live.agentIds.map((id) => {
                const supported = agentTakesModels(agents, id);
                return (
                  <span
                    key={id}
                    className="chip"
                    style={supported ? undefined : { opacity: 0.55 }}
                    title={
                      supported
                        ? undefined
                        : `${agents.find((a) => a.id === id)?.name || id}'s config format cannot store model providers — nothing was written to its files`
                    }
                  >
                    {agents.find((a) => a.id === id)?.name || id}
                  </span>
                );
              })}
              {live.agentIds.length === 0 && (
                <span className="text-xs text-tertiary">Not installed on any agent.</span>
              )}
            </div>
            {live.agentIds.some((id) => !agentTakesModels(agents, id)) && (
              <p className="form-help">
                Dimmed agents use config formats that cannot store model providers — the provider is
                registered for them but their files are left untouched.
              </p>
            )}
          </div>

          {/* Re-verify against the live endpoint */}
          <ApiVerifier
            mode="test"
            providerId={provider.id}
            onVerified={async () => {
              await refreshAll();
            }}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
