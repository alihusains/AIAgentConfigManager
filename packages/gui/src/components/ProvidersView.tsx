import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { AgentPicker } from './AgentPicker';
import { ApiVerifier } from './ProviderVerify';
import type {
  ModelProvider,
  ModelConfig,
  DetectedAgent,
  RegistryProvider,
  ProviderApiCapabilities,
} from '@ai-agent-config/core';
import { Plus, Edit, Trash2, Eye, EyeOff, Copy, Check, Database, Zap, Globe, Cloud } from 'lucide-react';

const PROVIDER_TYPES = [
  { id: 'anthropic', name: 'Anthropic', icon: Zap, color: '#D4A843' },
  { id: 'openai-compatible', name: 'OpenAI Compatible', icon: Globe, color: '#41A6D7' },
  { id: 'bedrock', name: 'AWS Bedrock', icon: Cloud, color: '#FF9900' },
  { id: 'vertex', name: 'Google Vertex AI', icon: Cloud, color: '#4285F4' },
] as const;

const DEFAULT_ROLES: ModelConfig['roles'] = ['chat', 'edit', 'apply', 'summarize'];

export function ProvidersView() {
  const { registry, agents, loading, toggleProviderAgent, deleteProvider } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ModelProvider | null>(null);
  const [details, setDetails] = useState<RegistryProvider | null>(null);

  const providers = registry?.providers || [];
  const agentName = (id: string) => agents.find((a) => a.id === id)?.name || id;

  const handleDelete = async (provider: ModelProvider) => {
    const installed = registry?.providers.find((p) => p.provider.id === provider.id)?.agentIds.length || 0;
    if (
      !confirm(
        `Delete provider "${provider.name}" from the registry?\n\nIt is currently installed on ${installed} agent(s) — those configs will be cleaned up.`,
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
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Model Providers</h2>
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
          <div className="table-container">
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
                {providers.map(({ provider, models, agentIds, apiCapabilities }) => {
                  const typeInfo = PROVIDER_TYPES.find((t) => t.id === provider.type);
                  const Icon = typeInfo?.icon || Database;
                  const color = typeInfo?.color || '#3b82f6';
                  return (
                    <tr key={provider.id}>
                      <td>
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="p-2 rounded-lg flex-shrink-0"
                            style={{ background: `${color}15`, color }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{provider.name}</p>
                            <p className="text-xs text-tertiary">{provider.id}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-primary">{provider.type}</span>
                      </td>
                      <td>
                        {!apiCapabilities ? (
                          <span className="text-xs text-tertiary">not verified</span>
                        ) : apiCapabilities.supported.length === 0 ? (
                          <span className="text-xs text-error">no API confirmed</span>
                        ) : (
                          <div className="flex gap-1 flex-wrap">
                            {apiCapabilities.supported.map((k) => (
                              <span key={k} className={`badge ${k === 'chat' ? 'badge-chat' : 'badge-responses'}`}>
                                {k === 'chat' ? 'Chat' : 'Responses'}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {models.length === 0 ? (
                          <span className="text-xs text-tertiary">no models</span>
                        ) : (
                          <div className="flex flex-wrap gap-1" style={{ maxWidth: 220 }}>
                            {models.slice(0, 4).map((m) => (
                              <span key={m.id} className="badge badge-neutral">{m.name}</span>
                            ))}
                            {models.length > 4 && (
                              <span className="badge badge-neutral">+{models.length - 4}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 flex-wrap">
                          {agentIds.map((id) => (
                            <span key={id} className="chip">
                              {agentName(id)}
                              <button
                                title={`Remove from ${agentName(id)}`}
                                onClick={() => toggleProviderAgent(provider.id, id)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <AgentPicker
                            targets={agentIds}
                            agents={agents}
                            onToggle={(agentId) => toggleProviderAgent(provider.id, agentId)}
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          className={`badge ${provider.enabled ? 'badge-success' : 'badge-neutral'} cursor-pointer`}
                          onClick={() => handleToggleEnabled(provider)}
                          title="Toggle enabled"
                        >
                          {provider.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn-ghost btn-icon btn-sm"
                            title="Details"
                            onClick={() => setDetails({ provider, models, agentIds, apiCapabilities })}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn-ghost btn-icon btn-sm"
                            title="Edit"
                            onClick={() => setEditing(provider)}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="btn-ghost btn-icon btn-sm text-error"
                            title="Delete"
                            onClick={() => handleDelete(provider)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
      {editing && (
        <EditProviderModal
          provider={editing}
          onClose={() => setEditing(null)}
        />
      )}
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

export function AddProviderModal({ onClose, agents, existingIds }: AddProviderModalProps) {
  const { addProvider } = useStore();
  const [form, setForm] = useState({
    type: 'openai-compatible' as ModelProvider['type'],
    id: '',
    name: '',
    apiKey: '',
    baseUrl: '',
    region: '',
    project: '',
    modelNames: '',
    targetAgentIds: agents.filter((a) => a.detection.installed).map((a) => a.id),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  /** Live verification result (probed via the ApiVerifier below) */
  const [verified, setVerified] = useState<ProviderApiCapabilities | null>(null);

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
    if (form.type === 'bedrock' && !form.region.trim()) e.region = 'Region is required';
    if (form.type === 'vertex' && !form.project.trim()) e.project = 'Project is required';
    if (form.targetAgentIds.length === 0) e.targetAgentIds = 'Pick at least one agent';
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
      .map((modelId) => ({
        id: modelId,
        providerId: provider.id,
        name: modelId,
        displayName: modelId,
        roles: [...DEFAULT_ROLES],
        capabilities: ['tool_use'],
      }));

    setSubmitting(true);
    const ok = await addProvider(provider, models, form.targetAgentIds, verified ?? undefined);
    setSubmitting(false);
    if (ok) onClose();
  };

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add Model Provider</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
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
                  <option key={t.id} value={t.id}>{t.name}</option>
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
                  onModels={(ids) => set({ modelNames: ids.join(', ') })}
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
              <input
                className="input"
                placeholder="e.g., gpt-4o, gpt-4o-mini (comma-separated)"
                value={form.modelNames}
                onChange={(e) => set({ modelNames: e.target.value })}
              />
              <p className="form-help">
                Models are registered alongside the provider and written into each agent.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Install Into Agents</label>
              <div className="border rounded overflow-auto" style={{ maxHeight: 160 }}>
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-bg-hover"
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={form.targetAgentIds.includes(agent.id)}
                      onChange={(e) =>
                        set({
                          targetAgentIds: e.target.checked
                            ? [...form.targetAgentIds, agent.id]
                            : form.targetAgentIds.filter((id) => id !== agent.id),
                        })
                      }
                    />
                    <span className="flex-1 text-sm">{agent.name}</span>
                    {agent.detection.installed ? (
                      <span className="badge badge-success">{agent.detection.version || 'installed'}</span>
                    ) : (
                      <span className="text-xs text-tertiary">path-based</span>
                    )}
                  </label>
                ))}
              </div>
              {errors.targetAgentIds && <p className="form-help text-error">{errors.targetAgentIds}</p>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
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
  const { updateProvider } = useStore();
  const config = (provider.config || {}) as Record<string, unknown>;
  const [form, setForm] = useState({
    name: provider.name,
    apiKey: String(config.apiKey || ''),
    baseUrl: String(config.baseUrl || ''),
    region: String(config.region || ''),
    project: String(config.project || ''),
    enabled: provider.enabled,
  });
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState<ProviderApiCapabilities | null>(null);

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
    const ok = await updateProvider(
      provider.id,
      {
        name: form.name.trim() || provider.name,
        enabled: form.enabled,
        config: nextConfig,
      },
      verified ?? undefined,
    );
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Provider — {provider.id}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
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
                />
                {verified && (
                  <p className="form-help text-success mt-2">
                    ✓ Verified {new Date(verified.verifiedAt).toLocaleString()} — saved with the
                    provider on Save.
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
                Edits update the shared definition; they are materialized into every agent
                this provider is installed on.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>Save</button>
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
      addToast({ type: 'warning', title: 'Copy failed', message: 'Clipboard is not available in this browser.' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Provider Details — {provider.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="badge badge-primary">{provider.type}</span>
            <span className="text-xs text-tertiary font-mono">{provider.id}</span>
            {provider.enabled ? (
              <span className="badge badge-success">Enabled</span>
            ) : (
              <span className="badge badge-neutral">Disabled</span>
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
            <p className="form-help">Stored on this machine only — the dashboard never sends it anywhere else.</p>
          </div>

          {/* API support (from live verification) */}
          <div className="form-group">
            <label className="form-label">APIs Available</label>
            {!caps ? (
              <p className="text-xs text-tertiary">Not verified yet — run a test below.</p>
            ) : caps.supported.length === 0 ? (
              <p className="text-xs text-error">No OpenAI-style API confirmed at the last test.</p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {caps.supported.map((k) => (
                  <span key={k} className={`badge ${k === 'chat' ? 'badge-chat' : 'badge-responses'}`}>
                    {k === 'chat' ? 'Chat Completions' : 'Responses'}
                  </span>
                ))}
                <span className="text-xs text-secondary">
                  verified {caps.verifiedAt ? new Date(caps.verifiedAt).toLocaleString() : ''}
                </span>
              </div>
            )}
            {caps && (
              <p className="form-help">
                {caps.models.length} model{caps.models.length === 1 ? '' : 's'} available via this API
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
              {live.agentIds.map((id) => (
                <span key={id} className="chip">
                  {agents.find((a) => a.id === id)?.name || id}
                </span>
              ))}
              {live.agentIds.length === 0 && (
                <span className="text-xs text-tertiary">Not installed on any agent.</span>
              )}
            </div>
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
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}