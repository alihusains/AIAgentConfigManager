import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MoreVertical,
  Save,
  ArrowUpCircle,
  Sparkles,
} from 'lucide-react';
import { AgentIconTile } from './AgentIcon';
import { CodeEditor } from './CodeEditor';
import { ApiTypeBadges } from './ApiTypeBadges';
import { useWindowedList } from '../hooks/useWindowedList';
import { MCP_SERVER_WARNING_THRESHOLD } from './AgentDetailView';
import { Tooltip } from '../ui';

/** Which file an in-browser edit session is open on. */
interface EditingFile {
  agentId: string;
  agentName: string;
  kind: 'config' | 'mcp';
}

/** Platform-filtered install/uninstall command for a catalog entry. */
function commandFor(
  entry: AgentCatalogEntry,
  action: 'install' | 'uninstall',
  platform: string
): string | undefined {
  const cmd = action === 'install' ? entry.install : entry.uninstall;
  if (!cmd) return undefined;
  const platforms =
    action === 'install' ? entry.installPlatforms : entry.uninstallPlatforms;
  if (
    platforms &&
    platforms.length > 0 &&
    !platforms.includes(platform as Platform)
  ) {
    return undefined;
  }
  return cmd;
}

const STATUS_BADGE: Record<string, string> = {
  stable: 'badge-success',
  beta: 'badge-warning',
  upcoming: 'badge-neutral',
};

interface RowActionsMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: { label: string; onClick: () => void }[];
}

/**
 * A "⋮" button that opens a small labeled menu — replaces a row of
 * identical icon-only buttons (which users could not tell apart) with
 * plain text actions.
 */
function RowActionsMenu({ open, onToggle, onClose, items }: RowActionsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  return (
    <div className="relative" ref={ref}>
      <Tooltip content="More actions">
      <button
        className="btn-ghost btn-icon btn-sm"
        onClick={onToggle}
      >
        <MoreVertical size={14} />
      </button>
      </Tooltip>
      {open && (
        <div className="popover" style={{ minWidth: 180 }}>
          {items.map((item) => (
            <button
              key={item.label}
              className="flex items-center w-full px-2 py-1.5 rounded hover:bg-bg-hover text-sm text-left"
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Windowed "Available to Install" list                                       */
/*                                                                            */
/* The catalog now holds 30+ installable agents and keeps growing, so this   */
/* list is windowed: only the rows inside the scroll viewport (plus a small   */
/* overscan) are mounted. Rows are fixed-height and memoized, and the install */
/* handler is a stable reference, so scrolling re-renders only the slice.     */
/* -------------------------------------------------------------------------- */

const AVAIL_ROW_HEIGHT = 56;

const AvailableRow = memo(function AvailableRow({
  agent,
  installCmd,
  onInstall,
}: {
  agent: CatalogAgent;
  installCmd?: string;
  onInstall: (agent: CatalogAgent) => void;
}) {
  const handleClick = useCallback(() => onInstall(agent), [onInstall, agent]);
  return (
    <div className="avail-row" style={{ height: AVAIL_ROW_HEIGHT }}>
      <AgentIconTile icon={agent.icon} id={agent.id} size={32} />
      <div className="avail-meta">
        <div className="avail-name-row">
          <span className="avail-name">{agent.name}</span>
          <span className={`badge ${STATUS_BADGE[agent.status] || 'badge-neutral'}`}>
            {agent.status}
          </span>
        </div>
        <Tooltip content={agent.description || agent.id}>
        <span className="avail-id">
          {agent.id}
          {agent.description ? ` — ${agent.description}` : ''}
        </span>
        </Tooltip>
      </div>
      <ApiTypeBadges kinds={agent.apiTypes} compact />
      {installCmd ? (
        <Tooltip content={installCmd}>
        <button className="btn-primary btn-sm" onClick={handleClick}>
          <Download size={14} />
          Install
        </button>
        </Tooltip>
      ) : (
        <span className="text-tertiary text-xs">manual</span>
      )}
    </div>
  );
});

function AvailableList({
  agents,
  platform,
  onInstall,
}: {
  agents: CatalogAgent[];
  platform: string;
  onInstall: (agent: CatalogAgent) => void;
}) {
  const { containerRef, onScroll, range } = useWindowedList(
    agents.length,
    AVAIL_ROW_HEIGHT
  );

  if (agents.length === 0) {
    return (
      <div className="p-4 text-center text-tertiary text-sm">
        Every catalogued agent is installed on this machine 🎉
      </div>
    );
  }

  const visible = agents.slice(range.start, range.end);

  return (
    <div className="agent-window avail-window" ref={containerRef} onScroll={onScroll}>
      <div className="agent-window-viewport" style={{ height: range.totalHeight }}>
        <div
          className="agent-window-slice"
          style={{ transform: `translateY(${range.offsetTop}px)` }}
        >
          {visible.map((a) => (
            <AvailableRow
              key={a.id}
              agent={a}
              installCmd={commandFor(a, 'install', platform)}
              onInstall={onInstall}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * M071: drift indicator for one agent. Amber badge when the agent's
 * registry-managed providers/MCP servers were edited out-of-band; a
 * "Re-sync" button pushes the registry's version back over the file.
 * Renders nothing when there is no drift (or while the first check runs).
 */
function DriftBadge({
  status,
  onResync,
}: {
  status?: {
    checking: boolean;
    resyncing: boolean;
    drifted: boolean;
    changedProviders: string[];
    changedServers: string[];
  } | undefined;
  onResync: () => void;
}) {
  if (!status || (!status.drifted && !status.resyncing)) return null;
  const parts: string[] = [];
  if (status.changedProviders.length > 0)
    parts.push(`provider${status.changedProviders.length === 1 ? '' : 's'}: ${status.changedProviders.join(', ')}`);
  if (status.changedServers.length > 0)
    parts.push(`MCP server${status.changedServers.length === 1 ? '' : 's'}: ${status.changedServers.join(', ')}`);
  const tooltip = status.drifted
    ? `This agent's config was edited outside the registry. ${parts.join('; ')}. Re-syncing restores the registry's version.`
    : 'Re-syncing…';
  return (
    <span className="flex items-center gap-1">
      <Tooltip content={tooltip}>
      <span className="badge badge-warning" style={{ cursor: 'default' }}>
        <AlertTriangle size={10} className="inline mr-1" />
        drifted
      </span>
      </Tooltip>
      {status.drifted && (
        <Tooltip content="Restore the registry's version of this agent's config">
        <button
          className="btn-ghost btn-sm text-xs"
          disabled={status.resyncing}
          onClick={onResync}
        >
          {status.resyncing ? (
            <div className="spinner" style={{ width: 12, height: 12 }} />
          ) : (
            'Re-sync'
          )}
        </button>
        </Tooltip>
      )}
    </span>
  );
}

export function AgentsView() {
  const {
    agents,
    registry,
    platform,
    loading,
    revealAgent,
    deleteCustomAgent,
    refreshAll,
    addToast,
  } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CustomAgentDef | null>(null);
  const [editingFile, setEditingFile] = useState<EditingFile | null>(null);
  const [fileState, setFileState] = useState<{
    path: string;
    content: string;
    exists: boolean;
  } | null>(null);
  const [fileDraft, setFileDraft] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null); // agent id

  // Update checking — per-agent result, keyed by agent id.
  interface UpdateStatus {
    checking: boolean;
    updating: boolean;
    method?: 'npm' | 'brew' | 'unsupported';
    currentVersion?: string;
    latestVersion?: string;
    updateAvailable?: boolean;
    reason?: string;
  }
  const [updateStatus, setUpdateStatus] = useState<Record<string, UpdateStatus>>({});
  const [checkingAllUpdates, setCheckingAllUpdates] = useState(false);

  // Maintained catalog (known agent CLIs merged with live detection)
  const [catalog, setCatalog] = useState<CatalogAgent[] | null>(null);
  const [catalogMeta, setCatalogMeta] = useState<{
    version: number;
    updatedAt: string;
  } | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  // Active install/uninstall job modal
  const [job, setJob] = useState<{
    agent: CatalogAgent;
    action: 'install' | 'uninstall';
  } | null>(null);

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

  const openFileEditor = async (
    agentId: string,
    agentName: string,
    kind: 'config' | 'mcp'
  ) => {
    setOpenMenuFor(null);
    setEditingFile({ agentId, agentName, kind });
    setFileState(null);
    setFileDraft('');
    setFileError(null);
    const res = await api.getAgentRawFile(agentId, kind);
    if (!res.ok || !res.data) {
      setFileError(res.error || 'Failed to load file');
      return;
    }
    setFileState(res.data);
    setFileDraft(res.data.content);
  };

  const closeFileEditor = () => {
    setEditingFile(null);
    setFileState(null);
    setFileDraft('');
    setFileError(null);
  };

  const saveFileEditor = async () => {
    if (!editingFile) return;
    setSavingFile(true);
    const res = await api.saveAgentRawFile(
      editingFile.agentId,
      editingFile.kind,
      fileDraft
    );
    setSavingFile(false);
    if (!res.ok || !res.data) {
      addToast({
        type: 'error',
        title: 'Save failed',
        message: res.error || 'Could not write the file.',
      });
      return;
    }
    setFileState({ path: res.data.path, content: fileDraft, exists: true });
    addToast({
      type: 'success',
      title: 'Saved',
      message: res.data.backupPath
        ? `${editingFile.agentName}'s ${editingFile.kind === 'mcp' ? 'MCP file' : 'config'} was updated — previous version backed up.`
        : `${editingFile.agentName}'s ${editingFile.kind === 'mcp' ? 'MCP file' : 'config'} was created.`,
    });
    void loadCatalog();
    void refreshAll();
  };

  // --------------------------------------------------------------------------
  // Version management — check for updates, then update one or all agents.
  // --------------------------------------------------------------------------
  const checkOneUpdate = useCallback(async (agentId: string): Promise<UpdateStatus> => {
    setUpdateStatus((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], checking: true, updating: false },
    }));
    const res = await api.checkAgentUpdate(agentId);
    const status: UpdateStatus =
      res.ok && res.data
        ? { checking: false, updating: false, ...res.data }
        : { checking: false, updating: false, method: 'unsupported', reason: res.error };
    setUpdateStatus((prev) => ({ ...prev, [agentId]: status }));
    return status;
  }, []);

  const checkAllUpdates = async () => {
    setCheckingAllUpdates(true);
    const ids = installedRows.map((row) => row.id);
    const results = await Promise.all(ids.map((id) => checkOneUpdate(id)));
    setCheckingAllUpdates(false);
    const available = results.filter((r) => r.updateAvailable).length;
    addToast({
      type: 'info',
      title: 'Update check complete',
      message:
        available > 0
          ? `${available} agent${available === 1 ? '' : 's'} can be updated.`
          : 'Everything is up to date.',
    });
  };

  const runUpdate = async (agentId: string, agentName: string) => {
    setUpdateStatus((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], updating: true },
    }));
    const res = await api.updateAgent(agentId);
    if (!res.ok || !res.data) {
      setUpdateStatus((prev) => ({ ...prev, [agentId]: { ...prev[agentId], updating: false } }));
      addToast({
        type: 'error',
        title: 'Update failed to start',
        message: res.error || `Could not start an update for ${agentName}.`,
      });
      return;
    }
    const jobId = res.data.jobId;
    const poll = async (): Promise<void> => {
      const jobRes = await api.getAgentJob(jobId);
      if (!jobRes.ok || !jobRes.data || jobRes.data.status === 'running') {
        setTimeout(() => void poll(), 1500);
        return;
      }
      const ok = jobRes.data.status === 'success';
      setUpdateStatus((prev) => ({ ...prev, [agentId]: { ...prev[agentId], updating: false } }));
      addToast({
        type: ok ? 'success' : 'error',
        title: ok ? 'Update complete' : 'Update failed',
        message: ok
          ? `${agentName} was updated.`
          : jobRes.data.error || 'The update command exited with an error.',
      });
      void loadCatalog();
      void refreshAll();
      void checkOneUpdate(agentId);
    };
    void poll();
  };

  const updateAllAvailable = async () => {
    const targets = installedRows.filter((row) => updateStatus[row.id]?.updateAvailable);
    for (const row of targets) {
      await runUpdate(row.id, row.name);
    }
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
    modelPath: string | null;
    credentialPath: string | null;
    catalogEntry?: CatalogAgent;
  }

  const installedRows: InstalledRow[] = useMemo(() => {
    if (catalog) {
      return catalog
        .filter((a) => a.installed)
        .map((a) => {
          const d = a.detected;
          const cfg = d?.configPaths?.[p] || d?.configPaths?.darwin || '—';
          const mcp = d?.detection?.mcpPath || d?.mcpConfigPaths?.[p];
          return {
            id: a.id,
            name: a.name,
            known: a.known,
            detection: d?.detection ?? {
              installed: true,
              configExists: false,
              method: 'assumed',
            },
            configPath: cfg,
            mcpPath: mcp
              ? mcp === (d?.configPaths?.[p] || d?.configPaths?.darwin)
                ? 'same file'
                : mcp
              : null,
            modelPath: d?.detection?.modelConfigPath || null,
            credentialPath: d?.detection?.modelCredentialPath || null,
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
      mcpPath: a.detection.mcpPath
        ? a.detection.mcpPath === (a.configPaths[p] || a.configPaths.darwin)
          ? 'same file'
          : a.detection.mcpPath
        : a.mcpConfigPaths?.[p]
          ? a.mcpConfigPaths[p] === (a.configPaths[p] || a.configPaths.darwin)
            ? 'same file'
            : a.mcpConfigPaths[p]
          : null,
      modelPath: a.detection.modelConfigPath || null,
      credentialPath: a.detection.modelCredentialPath || null,
    }));
  }, [catalog, agents, p]);

  const availableAgents = useMemo(
    () => (catalog ?? []).filter((a) => !a.installed),
    [catalog]
  );

  const installedCount = catalog
    ? installedRows.length
    : agents.filter((a) => a.detection.installed).length;
  const totalCount = catalog
    ? catalog.filter((a) => a.known).length
    : agents.length;

  // --------------------------------------------------------------------------
  // M071 drift detection — per-agent result, keyed by agent id.
  // --------------------------------------------------------------------------
  interface DriftStatus {
    checking: boolean;
    resyncing: boolean;
    drifted: boolean;
    changedProviders: string[];
    changedServers: string[];
  }
  const [driftStatus, setDriftStatus] = useState<Record<string, DriftStatus>>({});

  const checkDrift = useCallback(async (agentId: string) => {
    setDriftStatus((prev) => ({
      ...prev,
      [agentId]: {
        checking: true,
        resyncing: false,
        drifted: prev[agentId]?.drifted ?? false,
        changedProviders: prev[agentId]?.changedProviders ?? [],
        changedServers: prev[agentId]?.changedServers ?? [],
      },
    }));
    const res = await api.checkAgentDrift(agentId);
    console.log(`[checkDrift] ${agentId}:`, res); // DEBUG
    setDriftStatus((prev) => ({
      ...prev,
      [agentId]: res?.ok && res.data
        ? {
            checking: false,
            resyncing: false,
            drifted: res.data.drifted,
            changedProviders: res.data.changedProviders,
            changedServers: res.data.changedServers,
          }
        : {
            checking: false,
            resyncing: false,
            drifted: false,
            changedProviders: [],
            changedServers: [],
          },
    }));
  }, []);

  // Cheap, read-only (one config-file read per agent, no network) — run once
  // when the catalog lands, not on a timer.
  const driftCheckedFor = useRef<string[] | null>(null);
  useEffect(() => {
    if (!catalog) {
      driftCheckedFor.current = null;
      return;
    }
    if (driftCheckedFor.current) return;
    driftCheckedFor.current = installedRows.map((r) => r.id);
    for (const row of installedRows) void checkDrift(row.id);
  }, [catalog, installedRows, checkDrift]);

  // Re-sync pushes the registry's version back over the agent's file via the
  // per-agent materialize path, then re-checks.
  const resyncAgent = async (agentId: string, agentName: string) => {
    setDriftStatus((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], resyncing: true },
    }));
    const res = await api.resyncAgent(agentId);
    console.log(`[resync] ${agentId}:`, res); // DEBUG
    const ok = res.ok;
    setDriftStatus((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], resyncing: false },
    }));
    if (!ok) {
      console.error(`[resync] Failed for ${agentId}:`, res.error); // DEBUG
      addToast({
        type: 'error',
        title: 'Re-sync failed',
        message: res.error || `Could not re-sync ${agentName}.`,
      });
      return;
    }
    addToast({
      type: 'success',
      title: 'Re-synced',
      message: `${agentName}'s config was re-materialized from the registry.`,
    });
    // Immediately clear drift status (resync succeeded, file is now in sync)
    setDriftStatus((prev) => ({
      ...prev,
      [agentId]: {
        checking: false,
        resyncing: false,
        drifted: false,
        changedProviders: [],
        changedServers: [],
      },
    }));
    // Then refresh and re-check to verify
    void refreshAll();
    // Delay the re-check slightly to ensure refreshAll has completed
    setTimeout(() => void checkDrift(agentId), 500);
  };

  const jobDone = () => {
    void loadCatalog();
    void refreshAll();
  };

  // Stable handler for the windowed "Available to Install" rows — keeps each
  // memoized row from re-rendering when unrelated state changes.
  const openInstall = useCallback(
    (agent: CatalogAgent) => setJob({ agent, action: 'install' }),
    []
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Agents</h1>
          <p className="text-secondary text-sm mt-1">
            Installed agent CLIs, agents available to install from the
            maintained catalog, and custom agents with explicit config paths.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content="Refresh catalog + detection">
          <button
            className="btn-ghost btn-sm"
            disabled={loading}
            onClick={() => {
              void loadCatalog();
              void refreshAll();
            }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          </Tooltip>
          <button
            className="btn-primary"
            onClick={() => setShowAdd(true)}
            disabled={loading}
          >
            <UserPlus size={16} />
            Add Custom Agent
          </button>
        </div>
      </div>

      {/* ---------------- Installed Agents ---------------- */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <h3 className="card-title">Installed Agents</h3>
            <span className="badge badge-success">
              {installedCount}/{totalCount || installedCount} installed
            </span>
          </div>
          <div className="flex items-center gap-2">
            {installedRows.filter((row) => updateStatus[row.id]?.updateAvailable).length >
              0 && (
              <button
                className="btn-secondary btn-sm"
                onClick={updateAllAvailable}
                disabled={installedRows.some((row) => updateStatus[row.id]?.updating)}
              >
                <ArrowUpCircle size={14} />
                Update all (
                {installedRows.filter((row) => updateStatus[row.id]?.updateAvailable).length})
              </button>
            )}
            <button
              className="btn-ghost btn-sm"
              onClick={checkAllUpdates}
              disabled={checkingAllUpdates || installedRows.length === 0}
            >
              {checkingAllUpdates ? (
                <div className="spinner" style={{ width: 14, height: 14 }} />
              ) : (
                <Sparkles size={14} />
              )}
              Check for updates
            </button>
          </div>
        </div>
        <div className="table-container">
          <table className="table agents-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>API</th>
                <th>Status</th>
                <th>Config File</th>
                <th>Config Path</th>
                <th>MCP File</th>
                <th>MCP Servers</th>
                <th style={{ width: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {installedRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-0">
                      <AgentIconTile
                        icon={row.catalogEntry?.icon}
                        id={row.id}
                        size={40}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium truncate">{row.name}</p>
                          {!row.known && (
                            <Tooltip content="Discovered on this machine but not in the maintained catalog yet">
                            <span
                              className="badge badge-neutral"
                            >
                              new
                            </span>
                            </Tooltip>
                          )}
                          <DriftBadge
                            status={driftStatus[row.id]}
                            onResync={() => void resyncAgent(row.id, row.name)}
                          />
                        </div>
                        <p className="text-xs text-tertiary">{row.id}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <ApiTypeBadges kinds={row.catalogEntry?.apiTypes} compact />
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className="badge badge-success">
                        <span className="live-dot" />
                        {row.detection.version || 'installed'}
                      </span>
                      {row.detection.binaryPath && (
                        <Tooltip
                          content={
                            row.detection.detectedBy
                              ? `found via ${row.detection.detectedBy}`
                              : row.detection.binaryPath
                          }
                          disabled={!row.detection.detectedBy && !row.detection.binaryPath}
                        >
                        <span
                          className="text-xs text-tertiary font-mono"
                        >
                          {row.detection.binaryPath}
                          {row.detection.detectedBy && (
                            <span className="text-tertiary">
                              {' '}
                              ({row.detection.detectedBy})
                            </span>
                          )}
                        </span>
                        </Tooltip>
                      )}
                      {updateStatus[row.id]?.checking ? (
                        <span className="text-xs text-tertiary flex items-center gap-1">
                          <div className="spinner" style={{ width: 11, height: 11 }} />
                          checking…
                        </span>
                      ) : updateStatus[row.id]?.updateAvailable ? (
                        <Tooltip content={`Update to ${updateStatus[row.id]?.latestVersion}`}>
                        <button
                          className="btn-secondary btn-sm"
                          disabled={updateStatus[row.id]?.updating}
                          onClick={() => runUpdate(row.id, row.name)}
                        >
                          {updateStatus[row.id]?.updating ? (
                            <div className="spinner" style={{ width: 12, height: 12 }} />
                          ) : (
                            <ArrowUpCircle size={12} />
                          )}
                          Update to {updateStatus[row.id]?.latestVersion}
                        </button>
                        </Tooltip>
                      ) : updateStatus[row.id] && updateStatus[row.id].method !== 'unsupported' ? (
                        <span className="text-xs text-tertiary">up to date</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${row.detection.configExists ? 'badge-success' : 'badge-neutral'}`}
                    >
                      {row.detection.configExists ? 'exists' : 'missing'}
                    </span>
                  </td>
                  <td className="font-mono text-xs path-cell">
                    <div className="flex items-center gap-1.5">
                      <Tooltip content={row.configPath}>
                      <span className="flex-1 min-w-0 break-words">
                        {row.configPath}
                      </span>
                      </Tooltip>
                      <Tooltip content="Edit config file">
                      <button
                        className="btn-ghost btn-icon btn-sm flex-shrink-0"
                        onClick={() => openFileEditor(row.id, row.name, 'config')}
                      >
                        <Edit size={13} />
                      </button>
                      </Tooltip>
                    </div>
                    {/* Model config lives in a genuinely different file only for a
                        couple of agents (e.g. reasonix's separate credentials) — show
                        it as a note here instead of a whole redundant column, since in
                        every other case it's identical to the path above. */}
                    {row.modelPath &&
                      row.modelPath !== row.configPath &&
                      row.modelPath !== 'same file' && (
                        <Tooltip content={row.modelPath}>
                        <div className="text-xs text-tertiary mt-0.5">
                          model: {row.modelPath}
                        </div>
                        </Tooltip>
                      )}
                    {row.credentialPath && (
                      <Tooltip content={row.credentialPath}>
                      <div className="text-xs text-tertiary mt-0.5">
                        keys: {row.credentialPath}
                      </div>
                      </Tooltip>
                    )}
                  </td>
                  <td className="font-mono text-xs path-cell">
                    {row.mcpPath && row.mcpPath !== 'same file' ? (
                      <div className="flex items-center gap-1.5">
                        <Tooltip content={row.mcpPath}>
                        <span className="flex-1 min-w-0 break-words">
                          {row.mcpPath}
                        </span>
                        </Tooltip>
                        <Tooltip content="Edit MCP file">
                        <button
                          className="btn-ghost btn-icon btn-sm flex-shrink-0"
                          onClick={() => openFileEditor(row.id, row.name, 'mcp')}
                        >
                          <Edit size={13} />
                        </button>
                        </Tooltip>
                      </div>
                    ) : row.mcpPath === 'same file' ? (
                      <span className="text-tertiary">same file</span>
                    ) : (
                      <span className="text-tertiary">—</span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const count = (registry?.mcpServers || []).filter(
                        (m) => m.agentIds.includes(row.id)
                      ).length;
                      const over = count > MCP_SERVER_WARNING_THRESHOLD;
                      return (
                        <Tooltip content={over ? `${count} MCP servers assigned — high server counts can slow an agent down or overwhelm its tool-selection` : `${count} MCP server${count === 1 ? '' : 's'} assigned`}>
                        <span
                          className={`badge ${over ? 'badge-warning' : 'badge-neutral'}`}
                        >
                          {over && <AlertTriangle size={11} className="inline mr-1" />}
                          {count}
                        </span>
                        </Tooltip>
                      );
                    })()}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <RowActionsMenu
                        open={openMenuFor === row.id}
                        onToggle={() =>
                          setOpenMenuFor(openMenuFor === row.id ? null : row.id)
                        }
                        onClose={() => setOpenMenuFor(null)}
                        items={[
                          {
                            label: 'Reveal config folder',
                            onClick: () => {
                              setOpenMenuFor(null);
                              revealAgent(row.id);
                            },
                          },
                          ...(row.mcpPath && row.mcpPath !== 'same file'
                            ? [
                                {
                                  label: 'Reveal MCP folder',
                                  onClick: () => {
                                    setOpenMenuFor(null);
                                    revealAgent(row.id, 'mcp');
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
                      {row.catalogEntry &&
                        commandFor(row.catalogEntry, 'uninstall', p) && (
                          <Tooltip content={commandFor(row.catalogEntry, 'uninstall', p)}>
                          <button
                            className="btn-danger btn-sm"
                            onClick={() =>
                              setJob({
                                agent: row.catalogEntry!,
                                action: 'uninstall',
                              })
                            }
                          >
                            Uninstall
                          </button>
                          </Tooltip>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {installedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-tertiary py-8">
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
            {availableAgents.length} agent
            {availableAgents.length === 1 ? '' : 's'}
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
          <AvailableList
            agents={availableAgents}
            platform={p}
            onInstall={openInstall}
          />
        )}

        {catalogMeta && (
          <div className="px-4 py-2 border-t flex items-center justify-between">
            <span className="text-xs text-tertiary">
              Maintained agent catalog v{catalogMeta.version} · last updated{' '}
              {catalogMeta.updatedAt}
            </span>
          </div>
        )}
      </div>

      {/* ---------------- Custom agents ---------------- */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Custom Agents</h3>
          <button
            className="btn-primary btn-sm"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        {customAgents.length === 0 ? (
          <div className="empty-state">
            <UserPlus size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No Custom Agents</h3>
            <p className="empty-state-message">
              Register any tool that reads a JSON config: point at its config
              path (and optionally a separate MCP servers file) and manage it
              like a first-class agent.
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
                    <td
                      className="font-mono text-xs break-all"
                      style={{ maxWidth: 240 }}
                    >
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
                      <span className="badge badge-neutral">
                        {def.format || 'json'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Tooltip content="Edit config file">
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          onClick={() => openFileEditor(def.id, def.name, 'config')}
                        >
                          <FileCode size={14} />
                        </button>
                        </Tooltip>
                        <Tooltip content="Reveal config folder">
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          onClick={() => revealAgent(def.id)}
                        >
                          <FolderOpen size={14} />
                        </button>
                        </Tooltip>
                        <Tooltip content="Edit">
                        <button
                          className="btn-ghost btn-icon btn-sm"
                          onClick={() => setEditing(def)}
                        >
                          <Edit size={14} />
                        </button>
                        </Tooltip>
                        <Tooltip content="Remove (files are left untouched)">
                        <button
                          className="btn-ghost btn-icon btn-sm text-error"
                          onClick={() => {
                            if (
                              confirm(
                                `Remove custom agent "${def.name}" from the registry?\n\nIts config files on disk are NOT deleted.`
                              )
                            ) {
                              deleteCustomAgent(def.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                        </Tooltip>
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
        <CustomAgentModal onClose={() => setEditing(null)} initial={editing} />
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

      {/* In-browser config/MCP file editor */}
      {editingFile && (
        <div className="modal-overlay" onClick={closeFileEditor}>
          <div
            className="modal"
            style={{ maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editingFile.kind === 'mcp' ? 'MCP file' : 'Config'} —{' '}
                {editingFile.agentName}
              </h2>
              <button className="modal-close" onClick={closeFileEditor}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {fileError ? (
                <p className="text-error text-sm">{fileError}</p>
              ) : !fileState ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="spinner" />
                  <span className="text-secondary text-sm">Reading file…</span>
                </div>
              ) : (
                <>
                  <p className="text-xs text-tertiary font-mono break-all mb-2">
                    {fileState.path}
                  </p>
                  {!fileState.exists && (
                    <p className="text-warning text-sm mb-2">
                      This file does not exist yet — saving will create it.
                    </p>
                  )}
                  <CodeEditor value={fileDraft} onChange={setFileDraft} />
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeFileEditor}>
                Close
              </button>
              <button
                className="btn-primary"
                disabled={!fileState || savingFile}
                onClick={saveFileEditor}
              >
                {savingFile ? (
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  <Save size={14} />
                )}
                Save
              </button>
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

function AgentJobModal({
  agent,
  action,
  platform,
  onClose,
  onDone,
}: AgentJobModalProps) {
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
          ? action === 'install'
            ? 'Install complete'
            : 'Uninstall complete'
          : 'Command failed',
        message: ok
          ? action === 'install'
            ? `${agent.name} installed — you can now install providers & MCP servers into it.`
            : `${agent.name} was uninstalled. Its config files on disk were left untouched.`
          : update.error ||
            `Exit code ${update.exitCode ?? '?'} — see the output above.`,
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
          <button
            className="modal-close"
            onClick={onClose}
            disabled={phase === 'running'}
          >
            ✕
          </button>
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
                    Your config files and registry entries (providers, MCP
                    servers) are NOT deleted — after reinstalling, everything
                    will materialize again.
                  </p>
                </div>
              ) : (
                <div className="mb-3 p-3 rounded-lg bg-bg-tertiary">
                  <p className="text-sm text-secondary">
                    The dashboard will run this command for you and stream the
                    output.
                  </p>
                </div>
              )}

              {command && (
                <div className="mb-3">
                  <p className="text-xs text-tertiary mb-1">
                    Command that will run
                  </p>
                  <pre className="code-block">{command}</pre>
                </div>
              )}
              {agent.note && (
                <p className="text-xs text-tertiary mb-3">{agent.note}</p>
              )}

              {isUninstall && (
                <div className="form-group">
                  <label className="form-label">
                    Type <span className="font-mono">{agent.id}</span> to
                    confirm
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
                  Running <span className="font-mono">{agent.id}</span> {verb}…
                  this can take a few minutes.
                </span>
              </div>
              <pre ref={outputRef} className="terminal-output">
                {job?.output || ''}
              </pre>
              <p className="text-xs text-tertiary mt-2">
                You can close this window — the command keeps running in the
                background.
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
                      {verb === 'install' ? 'Installed' : 'Uninstalled'}{' '}
                      successfully
                    </span>
                  </>
                ) : (
                  <span className="badge badge-error">
                    Failed
                    {job?.exitCode !== undefined
                      ? ` (exit ${job.exitCode})`
                      : ''}
                  </span>
                )}
                {job?.error && (
                  <span className="text-error text-sm">{job.error}</span>
                )}
              </div>
              <pre ref={outputRef} className="terminal-output">
                {job?.output || ''}
              </pre>
              <p className="text-xs text-tertiary mt-2">
                Detection has been refreshed — {agent.name} should now appear in
                the right list.
              </p>
            </>
          )}
        </div>
        <div className="modal-footer">
          {phase === 'confirm' && (
            <>
              <button className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
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
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
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

  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));

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
          <h2 className="modal-title">
            {isEdit ? `Edit Custom Agent — ${initial!.id}` : 'Add Custom Agent'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
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
                {errors.id && (
                  <p className="form-help text-error">{errors.id}</p>
                )}
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
              {errors.configPath && (
                <p className="form-help text-error">{errors.configPath}</p>
              )}
              <p className="form-help">
                Where model providers + models are written (unified JSON schema,
                extra keys preserved).
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">
                Agent MCP Server Path (optional)
              </label>
              <input
                className="input"
                placeholder="~/.config/my-agent/mcp.json"
                value={form.mcpPath}
                onChange={(e) => set({ mcpPath: e.target.value })}
              />
              <p className="form-help">
                Separate file for MCP servers (e.g. an mcp.json). Leave empty to
                write MCP servers into the config path.
              </p>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">File Format</label>
                <select
                  className="input select"
                  value={form.format}
                  onChange={(e) =>
                    set({ format: e.target.value as 'json' | 'jsonc' })
                  }
                >
                  <option value="json">JSON</option>
                  <option value="jsonc">JSONC (comments allowed)</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-tertiary">
              Paths support <span className="font-mono">~/</span> home expansion
              and <span className="font-mono">%ENV%</span> variables. The files
              are created automatically when you install anything into this
              agent.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
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
