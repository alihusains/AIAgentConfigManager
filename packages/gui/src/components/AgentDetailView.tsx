import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store';
import { api, type CatalogAgent } from '../api';
import type { AgentCatalogEntry, Platform } from '@ai-agent-config/core';
import { AgentIconTile } from './AgentIcon';
import { ApiTypeBadges } from './ApiTypeBadges';
import {
  ArrowLeft,
  FileCode,
  FolderOpen,
  Download,
  Trash2,
  ExternalLink,
  RefreshCw,
  Check,
  X as XIcon,
  Database,
  Server,
  KeyRound,
  FileText,
  Terminal,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { Tooltip } from '../ui';

type RawConfigResult = { path: string; content: string; exists: boolean };

/**
 * MCP server count above which the UI surfaces an overload warning.
 * Matches the roadmap's own success metric: "median servers-per-agent ≤ 10".
 * This is a soft heuristic — a caution, not a hard performance guarantee.
 */
export const MCP_SERVER_WARNING_THRESHOLD = 10;

/** Platform-filtered lifecycle command for a catalog entry. */
function commandFor(
  entry: AgentCatalogEntry,
  action: 'install' | 'uninstall',
  platform: string,
): string | undefined {
  const cmd = action === 'install' ? entry.install : entry.uninstall;
  if (!cmd) return undefined;
  const platforms = action === 'install' ? entry.installPlatforms : entry.uninstallPlatforms;
  if (platforms && platforms.length > 0 && !platforms.includes(platform as Platform)) return undefined;
  return cmd;
}

function InfoRow({
  icon,
  label,
  path,
  exists,
  onReveal,
}: {
  icon?: React.ReactNode;
  label: string;
  path?: string | null;
  exists?: boolean | null;
  onReveal?: () => void;
}) {
  const has = Boolean(path);
  return (
    <div className="adr-row">
      <div className="adr-row-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="adr-row-value">
        {has ? (
          <span className="font-mono text-xs break-all">{path}</span>
        ) : (
          <span className="text-tertiary text-xs">—</span>
        )}
        {typeof exists === 'boolean' && has && (
          <span className={`badge ${exists ? 'badge-success' : 'badge-neutral'} ml-2`}>
            {exists ? 'exists' : 'missing'}
          </span>
        )}
      </div>
      {has && onReveal && (
        <Tooltip content="Reveal folder"><button className="btn-ghost btn-icon btn-sm" onClick={onReveal}>
          <FolderOpen size={14} />
        </button></Tooltip>
      )}
    </div>
  );
}

export function AgentDetailView({ agentId }: { agentId: string | null }) {
  const {
    agents,
    registry,
    platform,
    loading,
    revealAgent,
    setActiveView,
    refreshAll,
    addToast,
  } = useStore();

  const p = (platform as 'darwin' | 'win32' | 'linux') || 'darwin';

  // Catalog (for icon, description, install commands, source) — loaded on demand.
  const [catalog, setCatalog] = useState<CatalogAgent[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [viewingConfig, setViewingConfig] = useState(false);
  const [rawConfig, setRawConfig] = useState<RawConfigResult | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [job, setJob] = useState<'install' | 'uninstall' | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const res = await api.getAgentCatalog();
    setCatalogLoading(false);
    if (res.ok && res.data) setCatalog(res.data.agents);
  }, []);

  useEffect(() => {
    if (!catalog) void loadCatalog();
  }, [catalog, loadCatalog]);

  const viewConfig = async () => {
    setViewingConfig(true);
    setRawConfig(null);
    setRawError(null);
    const res = await api.getAgentConfig(agentId!);
    if (!res.ok) {
      setRawError(res.error || 'Failed to load config');
      return;
    }
    setRawConfig(res.data || null);
  };

  // ---- Resolve the agent across detection, catalog, and custom agents ----
  const detected = agents.find((a) => a.id === agentId) || null;
  const catalogEntry = catalog?.find((c) => c.id === agentId) || null;
  const custom = registry?.customAgents.find((c) => c.id === agentId) || null;

  const name = detected?.name || catalogEntry?.name || custom?.name || agentId || 'Unknown agent';
  const icon = catalogEntry?.icon;
  const description = detected?.description || catalogEntry?.description || custom?.description;
  const source = catalogEntry?.source;
  const note = catalogEntry?.note;
  const installed = catalogEntry ? catalogEntry.installed : detected ? detected.detection.installed : false;
  const version = detected?.detection.version;
  const binaryPath = detected?.detection.binaryPath;
  const detectedBy = detected?.detection.detectedBy;
  const configExists = detected?.detection.configExists;

  // Paths — prefer live detection, fall back to catalog, then custom def.
  const configPath =
    detected?.configPaths?.[p] ||
    detected?.configPaths?.darwin ||
    catalogEntry?.settingsPaths?.[p]?.[0] ||
    custom?.configPath ||
    null;
  const mcpPath =
    detected?.detection.mcpPath ||
    detected?.mcpConfigPaths?.[p] ||
    catalogEntry?.mcpPaths?.[p]?.[0] ||
    custom?.mcpPath ||
    null;
  const modelPath = detected?.detection.modelConfigPath || catalogEntry?.modelConfigPaths?.[p]?.[0] || null;
  const credentialPath = detected?.detection.modelCredentialPath || catalogEntry?.modelCredentialPaths?.[p]?.[0] || null;

  // Registry entries installed INTO this agent.
  const providers = (registry?.providers || []).filter((entry) => entry.agentIds.includes(agentId!));
  const mcpServers = (registry?.mcpServers || []).filter((m) => m.agentIds.includes(agentId!));
  const mcpOverloaded = mcpServers.length > MCP_SERVER_WARNING_THRESHOLD;

  const installCmd = commandFor(catalogEntry || ({} as AgentCatalogEntry), 'install', p);
  const uninstallCmd = commandFor(catalogEntry || ({} as AgentCatalogEntry), 'uninstall', p);

  if (!agentId) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <AlertTriangle size={56} className="empty-state-icon text-warning" />
          <h3 className="empty-state-title">No agent selected</h3>
          <p className="empty-state-message">Pick an agent from the sidebar or the Agents tab.</p>
          <button className="btn-primary mt-4" onClick={() => setActiveView('agents')}>
            <ArrowLeft size={16} /> Back to Agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Back link */}
      <button className="btn-ghost btn-sm mb-4" onClick={() => setActiveView('agents')}>
        <ArrowLeft size={14} /> All agents
      </button>

      {/* Header card */}
      <div className="card mb-6">
        <div className="adr-header">
          <AgentIconTile icon={icon} id={agentId} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{name}</h1>
              {installed ? (
                <span className="badge badge-success">
                  <Check size={12} className="inline mr-1" />
                  {version || 'installed'}
                </span>
              ) : (
                <span className="badge badge-neutral">not installed</span>
              )}
              {catalogEntry && (
                <span className={`badge ${catalogEntry.status === 'stable' ? 'badge-primary' : 'badge-neutral'}`}>
                  {catalogEntry.status}
                </span>
              )}
            </div>
            {catalogEntry?.apiTypes && catalogEntry.apiTypes.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-tertiary text-xs">Wire API</span>
                <ApiTypeBadges kinds={catalogEntry.apiTypes} />
              </div>
            )}
            {description && <p className="text-secondary text-sm mt-1 max-w-2xl">{description}</p>}
            {binaryPath && (
              <p className="text-xs text-tertiary font-mono mt-1 break-all">
                {binaryPath}
                {detectedBy && <span> · via {detectedBy}</span>}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {source && (
              <a className="btn-secondary btn-sm" href={source} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Website
              </a>
            )}
            <Tooltip content="Refresh"><button className="btn-secondary btn-sm" disabled={loading || catalogLoading} onClick={() => { void loadCatalog(); void refreshAll(); }}>
              <RefreshCw size={14} className={catalogLoading || loading ? 'animate-spin' : ''} />
            </button></Tooltip>
            {installed && (
              <button className="btn-secondary btn-sm" onClick={() => viewConfig()}>
                <FileCode size={14} /> View Config
              </button>
            )}
            {installed && uninstallCmd && (
              <button className="btn-danger btn-sm" onClick={() => setJob('uninstall')}>
                <Trash2 size={14} /> Uninstall
              </button>
            )}
            {!installed && installCmd && (
              <button className="btn-primary btn-sm" onClick={() => setJob('install')}>
                <Download size={14} /> Install
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="adr-stats">
        <div className="adr-stat">
          <Database size={18} />
          <div>
            <p className="adr-stat-value">{providers.length}</p>
            <p className="adr-stat-label">Providers</p>
          </div>
        </div>
        <Tooltip content={mcpOverloaded ? `${mcpServers.length} MCP servers assigned — high server counts can slow an agent down or overwhelm its tool-selection` : undefined} disabled={!mcpOverloaded}>
        <div className="adr-stat">
          <Server size={18} className={mcpOverloaded ? 'text-warning' : ''} />
          <div>
            <p className={mcpOverloaded ? 'text-warning' : ''}>{mcpServers.length}</p>
            <p className="adr-stat-label">MCP Servers{mcpOverloaded ? ' ⚠' : ''}</p>
          </div>
        </div>
        </Tooltip>
        <div className="adr-stat">
          <FileText size={18} />
          <div>
            <p className="adr-stat-value">{configExists ? 'yes' : 'no'}</p>
            <p className="adr-stat-label">Config file</p>
          </div>
        </div>
        <div className="adr-stat">
          <Terminal size={18} />
          <div>
            <p className="adr-stat-value">{installed ? 'on' : 'off'}</p>
            <p className="adr-stat-label">CLI installed</p>
          </div>
        </div>
      </div>

      <div className="adr-grid">
        {/* Config files */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Config Files</h3>
            <button className="btn-ghost btn-sm" onClick={() => revealAgent(agentId)}>
              <FolderOpen size={14} /> Open folder
            </button>
          </div>
          <div className="p-4 space-y-1">
            <InfoRow
              icon={<FileCode size={15} />}
              label="Agent config"
              path={configPath}
              exists={configExists}
              onReveal={() => revealAgent(agentId, 'config')}
            />
            <InfoRow
              icon={<Server size={15} />}
              label="MCP servers"
              path={mcpPath}
              exists={detected?.detection.mcpConfigExists}
              onReveal={mcpPath ? () => revealAgent(agentId, 'mcp') : undefined}
            />
            <InfoRow
              icon={<Database size={15} />}
              label="Model config"
              path={modelPath && modelPath !== configPath ? modelPath : modelPath ? 'same file' : null}
              exists={detected?.detection.modelConfigExists}
              onReveal={modelPath && modelPath !== configPath ? () => revealAgent(agentId, 'model') : undefined}
            />
            <InfoRow
              icon={<KeyRound size={15} />}
              label="Credentials"
              path={credentialPath}
              exists={detected?.detection.modelCredentialExists}
            />
          </div>
          {note && (
            <div className="px-4 py-2 border-t text-xs text-tertiary flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              <span>{note}</span>
            </div>
          )}
        </div>

        {/* Providers installed into this agent */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              Model Providers
              <span className="badge badge-primary ml-2">{providers.length}</span>
            </h3>
            <button className="btn-ghost btn-sm" onClick={() => setActiveView('providers')}>
              Manage <ChevronRight size={14} />
            </button>
          </div>
          {providers.length === 0 ? (
            <div className="p-4 text-sm text-tertiary">
              No providers installed into {name} yet.
            </div>
          ) : (
            <div className="p-2">
              {providers.map((entry) => (
                <div key={entry.provider.id} className="adr-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{entry.provider.name}</span>
                      <span className="badge badge-neutral">{entry.provider.type}</span>
                      {!entry.provider.enabled && <span className="badge badge-neutral">disabled</span>}
                    </div>
                    <p className="text-xs text-tertiary mt-0.5">
                      {entry.models.length} model{entry.models.length === 1 ? '' : 's'}
                      {entry.models.length > 0 && (
                        <> · {entry.models.slice(0, 3).map((m) => m.name).join(', ')}{entry.models.length > 3 ? '…' : ''}</>
                      )}
                    </p>
                  </div>
                  <Tooltip content="Remove from this agent">
                  <button
                    className="btn-ghost btn-icon btn-sm"
                    onClick={async () => {
                      const ok = await useStore.getState().toggleProviderAgent(entry.provider.id, agentId);
                      if (ok) addToast({ type: 'success', title: 'Removed', message: `${entry.provider.name} removed from ${name}` });
                    }}
                  >
                    <XIcon size={14} />
                  </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MCP servers installed into this agent */}
        <div className="card adr-span-2">
          <div className="card-header">
            <h3 className="card-title">
              MCP Servers
              <span
                className={`badge ml-2 ${mcpOverloaded ? 'badge-warning' : 'badge-primary'}`}
              >
                {mcpOverloaded && <AlertTriangle size={12} className="inline mr-1" />}
                {mcpServers.length}
              </span>
            </h3>
            <button className="btn-ghost btn-sm" onClick={() => setActiveView('mcp')}>
              Manage <ChevronRight size={14} />
            </button>
          </div>
          {mcpServers.length === 0 ? (
            <div className="p-4 text-sm text-tertiary">
              No MCP servers installed into {name} yet.
            </div>
          ) : (
            <>
            {mcpOverloaded && (
              <div className="px-4 py-2 border-b flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-warning" />
                <span className="text-xs text-warning">
                  {mcpServers.length} MCP servers assigned — high server counts can slow an agent down or overwhelm its tool-selection.
                </span>
              </div>
            )}
            <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-1">
              {mcpServers.map((entry) => (
                <div key={entry.server.name} className="adr-list-item">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{entry.server.name}</span>
                      <span className="badge badge-neutral">{entry.server.type}</span>
                      {!entry.server.enabled && <span className="badge badge-neutral">disabled</span>}
                    </div>
                    <p className="text-xs text-tertiary font-mono mt-0.5 truncate">
                      {entry.server.command || entry.server.url || '—'}
                    </p>
                  </div>
                  <Tooltip content="Remove from this agent">
                  <button
                    className="btn-ghost btn-icon btn-sm"
                    onClick={async () => {
                      const ok = await useStore.getState().toggleMCPAgent(entry.server.name, agentId);
                      if (ok) addToast({ type: 'success', title: 'Removed', message: `${entry.server.name} removed from ${name}` });
                    }}
                  >
                    <XIcon size={14} />
                  </button>
                  </Tooltip>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {/* Config viewer modal */}
      {viewingConfig && (
        <div className="modal-overlay" onClick={() => setViewingConfig(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Config — {name}</h2>
              <button className="modal-close" onClick={() => setViewingConfig(false)}>✕</button>
            </div>
            <div className="modal-body">
              {rawError ? (
                <p className="text-error text-sm">{rawError}</p>
              ) : !rawConfig ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="spinner" />
                  <span className="text-secondary text-sm">Reading config…</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-tertiary font-mono break-all mb-2">{rawConfig.path}</p>
                  {!rawConfig.exists ? (
                    <p className="text-warning text-sm">
                      Config file does not exist yet — it will be created when you install a provider or MCP server into this agent.
                    </p>
                  ) : (
                    <pre className="code-block">{rawConfig.content}</pre>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setViewingConfig(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {job && catalogEntry && (
        <InstallJobModal agent={catalogEntry} action={job} platform={platform} onClose={() => setJob(null)} onDone={() => { void loadCatalog(); void refreshAll(); }} />
      )}
    </div>
  );
}

// ============================================================================
// Install / uninstall job modal (shared style with AgentsView)
// ============================================================================
function InstallJobModal({
  agent,
  action,
  platform,
  onClose,
  onDone,
}: {
  agent: CatalogAgent;
  action: 'install' | 'uninstall';
  platform: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const addToast = useStore((s) => s.addToast);
  const p = (platform as 'darwin' | 'win32' | 'linux') || 'darwin';
  const command = commandFor(agent, action, p);
  const [phase, setPhase] = useState<'confirm' | 'running' | 'done'>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [runError, setRunError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<import('@ai-agent-config/core').AgentJob | null>(null);

  const start = async () => {
    setRunError(null);
    const res =
      action === 'install' ? await api.installAgent(agent.id) : await api.uninstallAgent(agent.id);
    if (!res.ok || !res.data) {
      setRunError(res.error || 'Failed to start the command');
      return;
    }
    setJobId(res.data.jobId);
    setPhase('running');
  };

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const finish = (update: import('@ai-agent-config/core').AgentJob) => {
      setPhase('done');
      const ok = update.status === 'success';
      addToast({
        type: ok ? 'success' : 'error',
        title: ok ? (action === 'install' ? 'Install complete' : 'Uninstall complete') : 'Command failed',
        message: ok
          ? action === 'install'
            ? `${agent.name} installed.`
            : `${agent.name} was uninstalled. Config files were left untouched.`
          : update.error || `Exit code ${update.exitCode ?? '?'} — see output above.`,
      });
      onDone();
    };
    const tick = async () => {
      const res = await api.getAgentJob(jobId);
      if (cancelled) return;
      if (!res.ok || !res.data) {
        clearInterval(interval);
        setRunError(res.error || 'Job lookup failed');
        setPhase('done');
        onDone();
        return;
      }
      setJob(res.data);
      if (res.data.status !== 'running') {
        clearInterval(interval);
        finish(res.data);
      }
    };
    const interval = setInterval(tick, 1500);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, action, agent.name, addToast, onDone]);

  const isUninstall = action === 'uninstall';
  const confirmRequired = isUninstall && confirmText.trim() !== agent.id;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isUninstall ? 'Uninstall' : 'Install'} — {agent.name}</h2>
          <button className="modal-close" onClick={onClose} disabled={phase === 'running'}>✕</button>
        </div>
        <div className="modal-body">
          {runError && (
            <div className="mb-3 flex items-start gap-2 text-error text-sm">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{runError}</span>
            </div>
          )}
          {phase === 'confirm' && (
            <>
              <div className="mb-3 p-3 rounded-lg bg-bg-tertiary">
                <p className="text-sm text-secondary">
                  The dashboard will run this command and stream the output.
                </p>
              </div>
              {command && (
                <div className="mb-3">
                  <p className="text-xs text-tertiary mb-1">Command that will run</p>
                  <pre className="code-block">{command}</pre>
                </div>
              )}
              {agent.note && <p className="text-xs text-tertiary mb-3">{agent.note}</p>}
              {isUninstall && (
                <div className="form-group">
                  <label className="form-label">
                    Type <span className="font-mono">{agent.id}</span> to confirm
                  </label>
                  <input
                    className="input"
                    placeholder={agent.id}
                    value={confirmText}
                    autoFocus
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </div>
              )}
            </>
          )}
          {phase === 'running' && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="spinner" />
                <span className="text-secondary text-sm">
                  Running {agent.id} {action}… this can take a few minutes.
                </span>
              </div>
              <pre className="terminal-output">{job?.output || ''}</pre>
            </>
          )}
          {phase === 'done' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                {job?.status === 'success' ? (
                  <span className="badge badge-success">
                    <Check size={12} className="inline mr-1" />
                    {action === 'install' ? 'Installed' : 'Uninstalled'} successfully
                  </span>
                ) : (
                  <span className="badge badge-error">Failed{job?.exitCode !== undefined ? ` (exit ${job.exitCode})` : ''}</span>
                )}
              </div>
              <pre className="terminal-output">{job?.output || ''}</pre>
            </>
          )}
        </div>
        <div className="modal-footer">
          {phase === 'confirm' && (
            <>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className={isUninstall ? 'btn-danger' : 'btn-primary'}
                onClick={start}
                disabled={confirmRequired}
              >
                <Download size={16} />
                {isUninstall ? 'Run uninstall' : 'Run install'}
              </button>
            </>
          )}
          {(phase === 'running' || phase === 'done') && (
            <button className="btn-secondary" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}