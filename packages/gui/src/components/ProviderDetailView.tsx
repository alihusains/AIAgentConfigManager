/**
 * ProviderDetailView — route-addressable provider detail page with tabs.
 *
 * Replaces the old ProviderDetailsModal. Deep-linkable via hash routing:
 *   #/providers/<id>          → Overview tab
 *   #/providers/<id>/models   → Models tab
 *   #/providers/<id>/agents   → Agents tab
 *   #/providers/<id>/api      → API Configuration tab
 *
 * Tabs are real routes (not local state), keyboard-navigable (arrow keys),
 * and use proper ARIA tab/tablist/tabpanel roles.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Check,
  Database,
  Cpu,
  Users,
  Key,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Status } from '../ui';
import { ProtocolTicks, ApiVerifier } from './ProviderVerify';
import type { ProviderApiCapabilities } from '@ai-agent-config/core';
import { Tooltip } from '../ui';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Database },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'api', label: 'API Configuration', icon: Key },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isValidTab(id: string | undefined): id is TabId {
  return id === 'overview' || id === 'models' || id === 'agents' || id === 'api';
}

interface ProviderDetailViewProps {
  providerId: string | null;
}

export function ProviderDetailView({ providerId }: ProviderDetailViewProps) {
  const { registry, agents, refreshAll, addToast, setActiveView } = useStore();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const tabRefs = useRef<Map<TabId, HTMLButtonElement>>(new Map());

  // Resolve the live provider from the registry
  const entry = providerId ? registry?.providers.find((p) => p.provider.id === providerId) : null;
  const provider = entry?.provider;
  const config = (provider?.config || {}) as Record<string, unknown>;
  const baseUrl = String(config.baseUrl || '');
  const apiKey = String(config.apiKey || '');
  const caps = entry?.apiCapabilities;

  // Read initial tab from the hash (deep-link support)
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/');
    if (parts[0] === 'providers' && parts[1]) {
      const tab = parts[2];
      if (isValidTab(tab)) {
        setActiveTab(tab);
      }
    }
  }, [providerId]);

  // Update hash when tab changes (deep-linkable tabs)
  useEffect(() => {
    if (!providerId) return;
    const desired = `#/providers/${encodeURIComponent(providerId)}${activeTab === 'overview' ? '' : `/${activeTab}`}`;
    if (window.location.hash !== desired) {
      window.history.replaceState(null, '', desired);
    }
  }, [activeTab, providerId]);

  // Keyboard navigation between tabs
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tabIds = TABS.map((t) => t.id);
      const currentIdx = tabIds.indexOf(activeTab);
      let nextIdx = currentIdx;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIdx = (currentIdx + 1) % tabIds.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIdx = (currentIdx - 1 + tabIds.length) % tabIds.length;
          break;
        case 'Home':
          nextIdx = 0;
          break;
        case 'End':
          nextIdx = tabIds.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextTab = tabIds[nextIdx];
      setActiveTab(nextTab);
      tabRefs.current.get(nextTab)?.focus();
    },
    [activeTab]
  );

  if (!providerId || !entry || !provider) {
    return (
      <div className="p-8">
        <button className="btn-ghost btn-sm mb-4" onClick={() => setActiveView('providers')}>
          <ArrowLeft size={14} /> Back to Providers
        </button>
        <div className="empty-state">
          <AlertTriangle size={48} className="empty-state-icon" />
          <h3 className="empty-state-title">Provider not found</h3>
          <p className="empty-state-text">
            The provider &quot;{providerId}&quot; does not exist in the registry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button className="btn-ghost btn-sm mb-4" onClick={() => setActiveView('providers')}>
          <ArrowLeft size={14} /> Back to Providers
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-title">{provider.name}</h1>
          <span className="badge badge-primary">{provider.type}</span>
          <span className="text-xs text-tertiary font-mono">{provider.id}</span>
          {provider.enabled ? (
            <Status status="connected" label="Enabled" />
          ) : (
            <Status status="disabled" label="Disabled" />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Provider details" className="tab-list mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
              }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`tab-btn ${isActive ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleTabKeyDown}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'overview' && (
          <OverviewTab
            provider={provider}
            baseUrl={baseUrl}
            caps={caps}
            models={entry.models}
            agentIds={entry.agentIds}
            agents={agents}
          />
        )}
        {activeTab === 'models' && <ModelsTab models={entry.models} />}
        {activeTab === 'agents' && (
          <AgentsTab entry={entry} agents={agents} onRefresh={() => refreshAll().then(() => {})} />
        )}
        {activeTab === 'api' && (
          <ApiConfigTab
            baseUrl={baseUrl}
            apiKey={apiKey}
            caps={caps}
            providerId={provider.id}
            onVerified={() => refreshAll().then(() => {})}
            addToast={addToast}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  provider,
  baseUrl,
  caps,
  models,
  agentIds,
  agents,
}: {
  provider: { id: string; name: string; type: string; enabled: boolean };
  baseUrl: string;
  caps?: ProviderApiCapabilities;
  models: Array<{ id: string; name: string }>;
  agentIds: string[];
  agents: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="grid gap-4">
      {/* Connection Health */}
      <section className="card">
        <h3 className="card-title">Connection</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">Base URL</span>
            <code className="text-sm break-all">{baseUrl || '—'}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">Status</span>
            {provider.enabled ? (
              <Status status="connected" label="Enabled" />
            ) : (
              <Status status="disabled" label="Disabled" />
            )}
          </div>
          {caps?.verifiedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">Last Verified</span>
              <span className="text-sm">{new Date(caps.verifiedAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </section>

      {/* API Capabilities */}
      <section className="card">
        <h3 className="card-title">API Capabilities</h3>
        {!caps ? (
          <p className="text-xs text-tertiary">
            Not verified yet — run a test in the API Configuration tab.
          </p>
        ) : caps.supported.length === 0 ? (
          <p className="text-xs text-error">No OpenAI-style API confirmed at the last test.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <ProtocolTicks supported={caps.supported} />
            <span className="text-xs text-secondary">
              {caps.models.length} model{caps.models.length === 1 ? '' : 's'} available
            </span>
          </div>
        )}
      </section>

      {/* Registered Models */}
      <section className="card">
        <h3 className="card-title">Models ({models.length})</h3>
        {models.length === 0 ? (
          <p className="text-xs text-tertiary">No models registered for this provider.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {models.map((m) => (
              <span key={m.id} className="badge badge-neutral font-mono">
                {m.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Installed Agents */}
      <section className="card">
        <h3 className="card-title">Installed On ({agentIds.length})</h3>
        {agentIds.length === 0 ? (
          <p className="text-xs text-tertiary">Not installed on any agent.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {agentIds.map((id) => (
              <span key={id} className="chip">
                {agents.find((a) => a.id === id)?.name || id}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Relationship indicator */}
      <section className="card">
        <h3 className="card-title">Relationship</h3>
        <div className="text-xs text-tertiary font-mono">
          {provider.name} → {models.length} model{models.length === 1 ? '' : 's'} →{' '}
          {agentIds.length} agent{agentIds.length === 1 ? '' : 's'}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Models Tab
// ---------------------------------------------------------------------------

function ModelsTab({ models }: { models: Array<{ id: string; name: string }> }) {
  if (models.length === 0) {
    return (
      <div className="empty-state">
        <Cpu size={48} className="empty-state-icon" />
        <h3 className="empty-state-title">No models registered</h3>
        <p className="empty-state-text">
          Models will appear here once they are registered for this provider.
        </p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Model ID</th>
            <th>Name</th>
            <th>Provider</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}>
              <td className="font-mono text-sm">{m.id}</td>
              <td className="text-sm">{m.name}</td>
              <td className="text-sm text-tertiary">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agents Tab
// ---------------------------------------------------------------------------

function AgentsTab({
  entry,
  agents,
  onRefresh,
}: {
  entry: { provider: { id: string; name: string }; agentIds: string[] };
  agents: Array<{ id: string; name: string }>;
  onRefresh: () => Promise<void>;
}) {
  const { addToast } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  const toggleAgent = async (agentId: string) => {
    setBusy(agentId);
    try {
      const isInstalled = entry.agentIds.includes(agentId);
      if (isInstalled) {
        await api.removeProviderAgent(entry.provider.id, agentId);
        addToast({
          type: 'success',
          title: 'Agent removed',
          message: `${agentId} no longer uses ${entry.provider.name}`,
        });
      } else {
        await api.addProviderAgents(entry.provider.id, [agentId]);
        addToast({
          type: 'success',
          title: 'Agent added',
          message: `${agentId} now uses ${entry.provider.name}`,
        });
      }
      await onRefresh();
    } catch (e) {
      addToast({ type: 'error', title: 'Operation failed', message: String(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => {
            const isInstalled = entry.agentIds.includes(agent.id);
            return (
              <tr key={agent.id}>
                <td className="text-sm">{agent.name}</td>
                <td>
                  {isInstalled ? (
                    <Status status="connected" label="Installed" />
                  ) : (
                    <Status status="disabled" label="Not installed" />
                  )}
                </td>
                <td>
                  <button
                    className={`btn-sm ${isInstalled ? 'btn-danger' : 'btn-secondary'}`}
                    disabled={busy !== null}
                    onClick={() => toggleAgent(agent.id)}
                  >
                    {busy === agent.id ? 'Working…' : isInstalled ? 'Remove' : 'Install'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Configuration Tab
// ---------------------------------------------------------------------------

function ApiConfigTab({
  baseUrl,
  apiKey,
  caps,
  providerId,
  onVerified,
  addToast,
}: {
  baseUrl: string;
  apiKey: string;
  caps?: ProviderApiCapabilities;
  providerId: string;
  onVerified: () => Promise<void>;
  addToast: (t: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }) => void;
}) {
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
      addToast({ type: 'warning', title: 'Copy failed', message: 'Clipboard not available.' });
    }
  };

  return (
    <div className="grid gap-4">
      {/* Base URL */}
      <section className="card">
        <h3 className="card-title">Base URL</h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm break-all">{baseUrl || '—'}</code>
          <Tooltip content="Copy base URL">
          <button
            className="btn-ghost btn-icon btn-sm"
            onClick={() => copy('url')}
            disabled={!baseUrl}
          >
            {copied === 'url' ? <Check size={14} /> : <Copy size={14} />}
          </button>
          </Tooltip>
        </div>
      </section>

      {/* API Key — masked by default */}
      <section className="card">
        <h3 className="card-title">API Key</h3>
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
          <Tooltip content={revealed ? 'Hide API key' : 'Reveal API key'}>
          <button
            className="btn-ghost btn-icon btn-sm"
            onClick={() => setRevealed((r) => !r)}
            disabled={!apiKey}
          >
            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          </Tooltip>
          <Tooltip content="Copy API key">
          <button
            className="btn-ghost btn-icon btn-sm"
            onClick={() => copy('key')}
            disabled={!apiKey}
          >
            {copied === 'key' ? <Check size={14} /> : <Copy size={14} />}
          </button>
          </Tooltip>
        </div>
        <p className="text-xs text-tertiary mt-2">
          Stored on this machine only — never sent anywhere else.
        </p>
      </section>

      {/* Verification Results */}
      <section className="card">
        <h3 className="card-title">Verification</h3>
        {!caps ? (
          <p className="text-xs text-tertiary mb-4">Not verified yet.</p>
        ) : (
          <div className="mb-4">
            <ProtocolTicks supported={caps.supported} />
            <span className="text-xs text-secondary">
              Verified {caps.verifiedAt ? new Date(caps.verifiedAt).toLocaleString() : ''}
            </span>
          </div>
        )}
        <ApiVerifier mode="test" providerId={providerId} onVerified={onVerified} />
      </section>
    </div>
  );
}
