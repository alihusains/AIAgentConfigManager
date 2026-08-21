import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { api, type CatalogAgent } from '../api';
import type {
  CustomAgentDef,
  AgentDetection,
  AgentCatalogEntry,
  AgentJob,
  Platform,
} from '@ai-agent-config/core';
import {
  Bot,
  UserPlus,
  Plus,
  Edit,
  Trash2,
  FolderOpen,
  FileCode,
  Download,
  RefreshCw,
  AlertTriangle,
  Check,
} from 'lucide-react';

// Local helper types (server messages are plain JSON)
type RawConfigResult = {
  path: string;
  content: string;
  exists: boolean;
};

/** Platform-filtered install/uninstall command for a catalog entry. */
function commandFor(
  entry: AgentCatalogEntry,
  action: 'install' | 'uninstall',
  platform: string,
): string | undefined {
  const cmd = action === 'install' ? entry.install : entry.uninstall;
  if (!cmd) return undefined;
  const platforms = action === 'install' ? entry.installPlatforms : entry.uninstallPlatforms;
  if (platforms && platforms.length > 0 && !platforms.includes(platform as Platform)) {
    return undefined;
  }
  return cmd;
}

const STATUS_BADGE: Record<string, string> = {
  stable: 'badge-success',
  beta: 'badge-warning',
  upcoming: 'badge-neutral',
};

export function AgentsView() {
  const {
    agents,
    registry,
    platform,
    loading,
    revealAgent,
    deleteCustomAgent,
    refreshAll,
  } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CustomAgentDef | null>(null);
  const [viewingConfig, setViewingConfig] = useState<string | null>(null); // agent id
  const [rawConfig, setRawConfig] = useState<RawConfigResult | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  // Maintained catalog (known agent CLIs merged with live detection)
  const [catalog, setCatalog] = useState<CatalogAgent[] | null>(null);
  const [catalogMeta, setCatalogMeta] = useState<{ version: number; updatedAt: string } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  // Active install/uninstall job modal
  const [job, setJob] = useState<{ agent: CatalogAgent; action: 'install' | 'uninstall' } | null>(null);

  const customAgents = registry?.customAgents || [];
  const p = (platform as 'darwin' | 'win32' | 'linux') || 'darwin';

  const loadCatalog = useCallback(async () => {
    const res = await api.getAgentCatalog();
    if (!res.ok || !res.data) {
      setCatalogError(res.error || 'Failed to load agent catalog');
      return;
    }
    setCatalog(res.data.agents);
    setCatalogMeta(res.data.meta);
    setCatalogError(null);
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const viewConfig = async (agentId: string) => {
    setViewingConfig(agentId);
    setRawConfig(null);
    setRawError(null);
    const res = await api.getAgentConfig(agentId);
    if (!res.ok) {
      setRawError(res.error || 'Failed to load config');
      return;
    }
    setRawConfig(res.data || null);
  };

  // --------------------------------------------------------------------------
  // Installed rows — from the catalog when it loaded, otherwise from the store
  // detection snapshot (graceful fallback).
  // --------------------------------------------------------------------------
  interface InstalledRow {
    id: string;
    name: string;
    known: boolean;
    detection: AgentDetection;
    configPath: string;
    mcpPath: string | null;
    catalogEntry?: CatalogAgent;
  }

  const installedRows: InstalledRow[] = useMemo(() => {
    if (catalog) {
      return catalog
        .filter((a) => a.installed)
        .map((a) => {
          const d = a.detected;
          const cfg = d?.configPaths?.[p] || d?.configPaths?.darwin || '—';
          const mcp = d?.mcpConfigPaths?.[p];
          return {
            id: a.id,
            name: a.name,
            known: a.known,
            detection: d?.detection ?? { installed: true, configExists: false, method: 'assumed' },
            configPath: cfg,
            mcpPath: mcp ? (mcp === (d?.configPaths?.[p] || d?.configPaths?.darwin) ? 'same file' : mcp) : null,
            catalogEntry: a,
          };
        });
    }
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      known: true,
      detection: a.detection,
      configPath: a.configPaths[p] || a.configPaths.darwin || '—',
      mcpPath: a.mcpConfigPaths?.[p]
        ? a.mcpConfigPaths[p] === (a.configPaths[p] || a.configPaths.darwin)
          ? 'same file'
          : a.mcpConfigPaths[p]
        : null,
    }));
  }, [catalog, agents, p]);

  const availableAgents = useMemo(
    () => (catalog ?? []).filter((a) => !a.installed),
    [catalog],
  );

  const installedCount = catalog ? installedRows.length : agents.filter((a) => a.detection.installed).length;
  const totalCount = catalog ? catalog.filter((a) => a.known).length : agents.length;

  const jobDone = () => {
    void loadCatalog();
    void refreshAll();
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Agents</h2>
          <p className="text-secondary text-sm mt-1">
            Installed agent CLIs, agents available to install from the maintained catalog,
            and custom agents with explicit config paths.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost btn-sm"
            title="Refresh catalog + detection"
            disabled={loading}
            onClick={() => { void loadCatalog(); void refreshAll(); }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>
            <UserPlus size={16} />
            Add Custom Agent
          </button>
        </div>
      </div>

      {/* ---------------- Installed Agents ---------------- */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Installed Agents</h3>
          <span className="badge badge-success">
            {installedCount}/{totalCount || installedCount} installed
          </span>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Config File</th>
                <th>Config Path</th>
                <th>MCP File</th>
                <th style={{ width: '160px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {installedRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 rounded-lg bg-bg-tertiary flex-shrink-0">
                        <Bot size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium truncate">{row.name}</p>
                          {!row.known && (
                            <span className="badge badge-neutral" title="Discovered on this machine but not in the maintained catalog yet">
                              new
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-tertiary">{row.id}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className="badge badge-success">
                        {row.detection.version || 'installed'}
                      </span>
                      {row.detection.binaryPath && (
                        <span className="text-xs text-tertiary font-mono">
                          {row.detection.binaryPath}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${row.detection.configExists ? 'badge-success' : 'badge-neutral'}`}>
                      {row.detection.configExists ? 'exists' : 'missing'}
                    </span>
                  </td>
                  <td className="font-mono text-xs break-all max-w-0" style={{ maxWidth: 240 }}>
                    {row.configPath}
                  </td>
                  <td className="font-mono text-xs break-all" style={{ maxWidth: 180 }}>
                    {row.mcpPath ? (
                      row.mcpPath === 'same file' ? (
                        <span className="text-tertiary">same file</span>
                      ) : (
                        row.mcpPath
                      )
                    ) : (
                      <span className="text-tertiary">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn-ghost btn-icon btn-sm"
                        title="View config file"
                        onClick={() => viewConfig(row.id)}
                      >
                        <FileCode size={14} />
                      </button>
                      <button
                        className="btn-ghost btn-icon btn-sm"
                        title="Reveal config folder"
                        onClick={() => revealAgent(row.id)}
                      >
                        <FolderOpen size={14} />
                      </button>
                      {row.catalogEntry &&
                        commandFor(row.catalogEntry, 'uninstall', p) && (
                        <button
                          className="btn-danger btn-sm"
                          title={commandFor(row.catalogEntry, 'uninstall', p)}
                          onClick={() => setJob({ agent: row.catalogEntry!, action: 'uninstall' })}
                        >
                          Uninstall
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {installedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-tertiary py-8">
                    No agents installed yet — pick one below to install.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- Available to Install ---------------- */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Available to Install</h3>
          <span className="badge badge-neutral">
            {availableAgents.length} agent{availableAgents.length === 1 ? '' : 's'}
          </span>
        </div>

        {catalogError && !catalog ? (
          <div className="p-4">
            <p className="text-error text-sm">{catalogError}</p>
            <p className="text-tertiary text-xs mt-1">
              Showing the last known detection snapshot instead.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Install Command</th>
                  <th style={{ width: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {availableAgents.map((a) => {
                  const installCmd = commandFor(a, 'install', p);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-2 rounded-lg bg-bg-tertiary flex-shrink-0">
                            <Bot size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium truncate">{a.name}</p>
                              <span className={`badge ${STATUS_BADGE[a.status] || 'badge-neutral'}`}>
                                {a.status}
                              </span>
                            </div>
                            <p className="text-xs text-tertiary">{a.id}</p>
                            {a.description && (
                              <p className="text-xs text-secondary mt-0.5 max-w-md">{a.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">not installed</span>
                      </td>
                      <td className="font-mono text-xs break-all" style={{ maxWidth: 320 }}>
                        {installCmd ? (
                          installCmd
                        ) : (
                          <span className="text-tertiary font-sans">manual setup</span>
                        )}
                        {a.note && (
                          <span className="text-tertiary font-sans font-normal block mt-0.5">
                            {a.note}
                          </span>
                        )}
                      </td>
                      <td>
                        {installCmd ? (
                          <button
                            className="btn-primary btn-sm"
                            title={installCmd}
                            onClick={() => setJob({ agent: a, action: 'install' })}
                          >
                            <Download size={14} />
                            Install
                          </button>
                        ) : (
                          <span className="text-tertiary text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {availableAgents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-tertiary py-6">
                      Every catalogued agent is installed on this machine 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {catalogMeta && (
          <div className="px-4 py-2 border-t flex items-center justify-between">
            <span className="text-xs text-tertiary">
              Maintained agent catalog v{catalogMeta.version} · last updated {catalogMeta.updatedAt}
            </span>
          </div>
        )}
      </div>

      {/* ---------------- Custom agents ---------------- */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Custom Agents</h3>
          <button className="btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} />
            Add
          </button>
        </div>

        {customAgents.length === 0 ? (
          <div className="empty-state">
            <UserPlus size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No Custom Agents</h3>
            <p className="empty-state-message">
              Register any tool that reads a JSON config: point at its config path
              (and optionally a separate MCP servers file) and manage it like a
              first-class agent.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Config Path</th>
                  <th>MCP Path</th>
                  <th>Format</th>
                  <th style={{ width: '130px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customAgents.map((def) => (
                  <tr key={def.id}>
                    <td>
                      <div className="min-w-0">
                        <p className="font-medium">{def.name}</p>
                        <p className="text-xs text-tertiary">{def.id}</p>
                      </div>
                    </td>
                    <td className="font-mono text-xs break-all" style={{ maxWidth: 240 }}>
                      {def.configPath}
                    </td>
                    <td className="font-mono text-xs">
                      {def.mcpPath ? (
                        <span className="break-all">{def.mcpPath}</span>
                      ) : (
                        <span className="text-tertiary">—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{def.format || 'json'}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          title="View config"
                          onClick={() => viewConfig(def.id)}
                        >
                          <FileCode size={14} />
                        </button>
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          title="Reveal config folder"
                          onClick={() => revealAgent(def.id)}
                        >
                          <FolderOpen size={14} />
                        </button>
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          title="Edit"
                          onClick={() => setEditing(def)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn-ghost btn-icon btn-sm text-error"
                          title="Remove (files are left untouched)"
                          onClick={() => {
                            if (confirm(`Remove custom agent "${def.name}" from the registry?\n\nIts config files on disk are NOT deleted.`)) {
                              deleteCustomAgent(def.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <CustomAgentModal onClose={() => setShowAdd(false)} />}
      {editing && (
        <CustomAgentModal
          onClose={() => setEditing(null)}
          initial={editing}
        />
      )}
      {job && (
        <AgentJobModal
          agent={job.agent}
          action={job.action}
          platform={platform}
          onClose={() => setJob(null)}
          onDone={jobDone}
        />
      )}

      {/* Raw config viewer */}
      {viewingConfig && (
        <div className="modal-overlay" onClick={() => setViewingConfig(null)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Config — {viewingConfig}</h2>
              <button className="modal-close" onClick={() => setViewingConfig(null)}>✕</button>
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
                      Config file does not exist yet — it will be created when you install
                      a provider or MCP server into this agent.
                    </p>
                  ) : (
                    <pre className="code-block">{rawConfig.content}</pre>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setViewingConfig(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Install / uninstall job modal — runs the catalogued command with live output
// ============================================================================

interface AgentJobModalProps {
  agent: CatalogAgent;
  action: 'install' | 'uninstall';
  platform: string;
  onClose: () => void;
  onDone: () => void;
}

function AgentJobModal({ agent, action, platform, onClose, onDone }: AgentJobModalProps) {
  const addToast = useStore((s) => s.addToast);
  const p = (platform as 'darwin' | 'win32' | 'linux') || 'darwin';
  const command = commandFor(agent, action, p);

  const [phase, setPhase] = useState<'confirm' | 'running' | 'done'>('confirm');
  const [confirmText, setConfirmText] = useState('');
  const [runError, setRunError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<AgentJob | null>(null);
  const outputRef = useRef<HTMLPreElement | null>(null);

  // Auto-scroll the live output to the newest bytes
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [job?.output]);

  const start = async () => {
    setRunError(null);
    const res =
      action === 'install'
        ? await api.installAgent(agent.id)
        : await api.uninstallAgent(agent.id);
    if (!res.ok || !res.data) {
      setRunError(res.error || 'Failed to start the command');
      return;
    }
    setJobId(res.data.jobId);
    setPhase('running');
  };

  // Poll the running job every 1.5s for live output + completion
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const finish = (update: AgentJob) => {
      setPhase('done');
      const ok = update.status === 'success';
      addToast({
        type: ok ? 'success' : 'error',
        title: ok
          ? action === 'install' ? 'Install complete' : 'Uninstall complete'
          : 'Command failed',
        message: ok
          ? action === 'install'
            ? `${agent.name} installed — you can now install providers & MCP servers into it.`
            : `${agent.name} was uninstalled. Its config files on disk were left untouched.`
          : update.error || `Exit code ${update.exitCode ?? '?'} — see the output above.`,
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

  const verb = action === 'install' ? 'install' : 'uninstall';
  const isUninstall = action === 'uninstall';
  const confirmRequired = isUninstall && confirmText.trim() !== agent.id;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isUninstall ? 'Uninstall' : 'Install'} — {agent.name}
          </h2>
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
              {isUninstall ? (
                <div className="mb-3 p-3 rounded-lg warning-box">
                  <p className="text-sm text-warning font-medium flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    This will remove {agent.name} from your system
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    Your config files and registry entries (providers, MCP servers) are NOT
                    deleted — after reinstalling, everything will materialize again.
                  </p>
                </div>
              ) : (
                <div className="mb-3 p-3 rounded-lg bg-bg-tertiary">
                  <p className="text-sm text-secondary">
                    The dashboard will run this command for you and stream the output.
                  </p>
                </div>
              )}

              {command && (
                <div className="mb-3">
                  <p className="text-xs text-tertiary mb-1">Command that will run</p>
                  <pre className="code-block">{command}</pre>
                </div>
              )}
              {agent.note && (
                <p className="text-xs text-tertiary mb-3">{agent.note}</p>
              )}

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
                  Running <span className="font-mono">{agent.id}</span> {verb}… this can take a few minutes.
                </span>
              </div>
              <pre ref={outputRef} className="terminal-output">{job?.output || ''}</pre>
              <p className="text-xs text-tertiary mt-2">
                You can close this window — the command keeps running in the background.
              </p>
            </>
          )}

          {phase === 'done' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                {job?.status === 'success' ? (
                  <>
                    <span className="badge badge-success">
                      <Check size={12} className="inline mr-1" />
                      {verb === 'install' ? 'Installed' : 'Uninstalled'} successfully
                    </span>
                  </>
                ) : (
                  <span className="badge badge-error">Failed{job?.exitCode !== undefined ? ` (exit ${job.exitCode})` : ''}</span>
                )}
                {job?.error && <span className="text-error text-sm">{job.error}</span>}
              </div>
              <pre ref={outputRef} className="terminal-output">{job?.output || ''}</pre>
              <p className="text-xs text-tertiary mt-2">
                Detection has been refreshed — {agent.name} should now appear in the right list.
              </p>
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

// ============================================================================
// Add / Edit custom agent modal
// ============================================================================

interface CustomAgentModalProps {
  onClose: () => void;
  initial?: CustomAgentDef;
}

function CustomAgentModal({ onClose, initial }: CustomAgentModalProps) {
  const { addCustomAgent, updateCustomAgent } = useStore();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    id: initial?.id || '',
    name: initial?.name || '',
    description: initial?.description || '',
    configPath: initial?.configPath || '~/.config/my-agent/config.json',
    mcpPath: initial?.mcpPath || '',
    format: initial?.format || 'json',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.id.trim()) e.id = 'Agent ID is required';
    else if (!isEdit && !/^[a-z0-9][a-z0-9-_]*$/.test(form.id.trim())) {
      e.id = 'Use lowercase letters, digits, dashes (e.g. my-agent)';
    }
    if (!form.configPath.trim()) e.configPath = 'Config path is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    const ok = isEdit
      ? await updateCustomAgent(initial!.id, {
          name: form.name.trim() || undefined,
          description: form.description.trim() || undefined,
          configPath: form.configPath.trim(),
          mcpPath: form.mcpPath.trim() || undefined,
          format: form.format as 'json' | 'jsonc',
        })
      : await addCustomAgent({
          id: form.id.trim(),
          name: form.name.trim() || form.id.trim(),
          description: form.description.trim() || undefined,
          configPath: form.configPath.trim(),
          mcpPath: form.mcpPath.trim() || undefined,
          format: form.format as 'json' | 'jsonc',
        });
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? `Edit Custom Agent — ${initial!.id}` : 'Add Custom Agent'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {!isEdit && (
              <div className="form-group">
                <label className="form-label">Agent ID</label>
                <input
                  className={`input ${errors.id ? 'input-error' : ''}`}
                  placeholder="e.g., my-agent"
                  value={form.id}
                  onChange={(e) => set({ id: e.target.value })}
                />
                {errors.id && <p className="form-help text-error">{errors.id}</p>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="input"
                placeholder="e.g., My Agent"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input
                className="input"
                placeholder="What this agent is"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Agent Config Path</label>
              <input
                className={`input ${errors.configPath ? 'input-error' : ''}`}
                placeholder="~/.config/my-agent/config.json"
                value={form.configPath}
                onChange={(e) => set({ configPath: e.target.value })}
              />
              {errors.configPath && <p className="form-help text-error">{errors.configPath}</p>}
              <p className="form-help">
                Where model providers + models are written (unified JSON schema, extra keys preserved).
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Agent MCP Server Path (optional)</label>
              <input
                className="input"
                placeholder="~/.config/my-agent/mcp.json"
                value={form.mcpPath}
                onChange={(e) => set({ mcpPath: e.target.value })}
              />
              <p className="form-help">
                Separate file for MCP servers (e.g. an mcp.json). Leave empty to write
                MCP servers into the config path.
              </p>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">File Format</label>
                <select
                  className="input select"
                  value={form.format}
                  onChange={(e) => set({ format: e.target.value as 'json' | 'jsonc' })}
                >
                  <option value="json">JSON</option>
                  <option value="jsonc">JSONC (comments allowed)</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-tertiary">
              Paths support <span className="font-mono">~/</span> home expansion and{' '}
              <span className="font-mono">%ENV%</span> variables. The files are created
              automatically when you install anything into this agent.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <Plus size={16} />
              {isEdit ? 'Save Changes' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}