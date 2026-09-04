import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { api, type CatalogAgent } from '../api';
import type {
  CustomAgentDef,
  AgentDetection,
  AgentCatalogEntry,
  AgentJob,
  Platform,
  ProviderApiKind,
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
  Compass,
  ExternalLink,
  MoreVertical,
  Save,
  ArrowUpCircle,
  Sparkles,
  Copy,
  Search,
} from 'lucide-react';
import { AgentIconTile } from './AgentIcon';
import { logoUrl } from '../logos';
import { CodeEditor } from './CodeEditor';
import { ApiTypeBadges } from './ApiTypeBadges';
import { StarBadge } from './StarBadge';
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


const AvailableRow = memo(function AvailableRow({
  agent,
  installCmd,
  onInstall,
  rank,
}: {
  agent: CatalogAgent;
  installCmd?: string;
  onInstall: (agent: CatalogAgent) => void;
  rank?: number;
}) {
  const handleClick = useCallback(() => onInstall(agent), [onInstall, agent]);
  const [copied, setCopied] = useState(false);

  const handleCopyCommand = useCallback(() => {
    if (installCmd) {
      navigator.clipboard.writeText(installCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [installCmd]);

  // Remove agent name from description if it starts with it
  const cleanDescription = agent.description
    ? agent.description.replace(new RegExp(`^${agent.name}\\s*[-–—]\\s*`), '')
    : agent.id;

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-4 hover:bg-bg-hover transition-colors duration-150 border-b border-border-primary last:border-b-0">
      {/* Left: Logo + Name + Tags */}
      <div className="flex items-center gap-3 min-w-0 md:min-w-[220px]">
        <AgentIconTile icon={agent.icon} id={agent.id} size={48} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-50">{agent.name}</span>
            <span className={`badge badge-xs ${STATUS_BADGE[agent.status] || 'badge-neutral'}`}>
              {agent.status}
            </span>
          </div>
          <ApiTypeBadges kinds={agent.apiTypes} compact />
        </div>
      </div>

      {/* Center: Description + Star badge — Refined secondary information */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Tooltip content={cleanDescription}>
          <span className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
            {cleanDescription}
          </span>
        </Tooltip>
        {agent.stars && (
          <div className="flex items-center gap-2">
            <StarBadge
              github={agent.github}
              stars={agent.stars}
              rank={rank}
              compact
            />
          </div>
        )}
      </div>

      {/* Right: Install Command + Copy Button + Install Button — Refined action area */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end flex-shrink-0 min-w-0">
        {installCmd && (
          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-bg-tertiary rounded-lg text-xs font-mono border border-border-primary min-w-0">
            <span className="break-all leading-snug max-w-[260px]">{installCmd}</span>
            <button
              type="button"
              onClick={handleCopyCommand}
              className="flex-shrink-0 p-0.5 ml-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              title="Copy command"
            >
              {copied ? (
                <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
        )}
        <Tooltip content={installCmd ? 'Install agent' : 'Manual installation required'}>
          <button
            className="btn-primary btn-sm"
            onClick={handleClick}
            disabled={!installCmd}
          >
            <Download size={14} />
            Install
          </button>
        </Tooltip>
      </div>
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
  if (agents.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
          Every catalogued agent is installed on this machine 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 divide-y divide-slate-200/30 dark:divide-slate-700/30 border border-slate-200/30 dark:border-slate-700/30 rounded-xl overflow-hidden">
      {agents.map((a, index) => (
        <AvailableRow
          key={a.id}
          agent={a}
          installCmd={commandFor(a, 'install', platform)}
          onInstall={onInstall}
          rank={index}
        />
      ))}
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

  // Sorting and filtering for available agents
  interface AvailableAgentFilters {
    sortBy: 'name' | 'stars' | 'trending' | 'maintenance';
    filterTrending: boolean;
    filterByStatus: 'all' | 'active' | 'stale' | 'archived';
    searchQuery: string;
  }
  const [availableFilters, setAvailableFilters] = useState<AvailableAgentFilters>({
    sortBy: 'stars',
    filterTrending: false,
    filterByStatus: 'all',
    searchQuery: '',
  });

  // ---------------- Explore (OpenRouter trending coding agents) ----------------
  // Ranking data from the server (GET /api/agents/explore); the list order
  // mirrors openrouter.ai/apps/category/coding exactly. Which sub-tab is
  // active: 'catalog' (installable, adapter-backed) or 'explore'.
  const [availTab, setAvailTab] = useState<'catalog' | 'explore'>('catalog');
  const [exploreAgents, setExploreAgents] = useState<ExploreAgentRow[]>([]);
  const [exploreError, setExploreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api.getExploreAgents();
      if (cancelled) return;
      if (res.ok && res.data) setExploreAgents(res.data);
      else setExploreError(res.error || 'Could not load the explore ranking');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const customAgents = registry?.customAgents || [];
  const p = (platform as 'darwin' | 'win32' | 'linux') || 'darwin';

  // Reload the catalog from anywhere (refs avoid stale-closure scope bugs —
  // the original loader was trapped inside this effect while other handlers
  // called `loadCatalog()` and hit "Cannot find name").
  const loadCatalogRef = useRef<() => Promise<void>>(async () => {});
  // Load catalog once on mount, with timeout to prevent hanging
  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      try {
        const res = await api.getAgentCatalog();
        clearTimeout(timeoutId);
        if (!mounted) return;
        if (!res.ok || !res.data) {
          setCatalogError(res.error || 'Failed to load agent catalog');
          return;
        }
        setCatalog(res.data.agents);
        setCatalogMeta(res.data.meta);
        setCatalogError(null);
      } catch (err) {
        clearTimeout(timeoutId);
        if (!mounted) return;
        setCatalogError('Failed to load agent catalog — connection timeout');
      }
    };
    loadCatalogRef.current = loadCatalog;
    void loadCatalog();
    return () => {
      mounted = false;
    };
  }, []); // Empty deps: load once on mount only
  // Stable alias used by handlers below.
  const loadCatalog = useCallback(() => loadCatalogRef.current(), []);

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
  // Apply sorting and filtering to available agents
  // --------------------------------------------------------------------------
  const filteredAndSortedAvailable = useMemo(() => {
    let agents = (catalog ?? []).filter((a) => !a.installed);

    // Search filter
    if (availableFilters.searchQuery) {
      const q = availableFilters.searchQuery.toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    // Trending filter
    if (availableFilters.filterTrending) {
      agents = agents.filter((a) => a.stars && a.stars.growth30d && a.stars.growth30d >= 50);
    }

    // Maintenance status filter
    if (availableFilters.filterByStatus !== 'all') {
      agents = agents.filter((a) => a.stars?.maintenance === availableFilters.filterByStatus);
    }

    // Sort
    if (availableFilters.sortBy === 'stars') {
      agents.sort((a, b) => (b.stars?.count ?? 0) - (a.stars?.count ?? 0));
    } else if (availableFilters.sortBy === 'trending') {
      agents.sort((a, b) => (b.stars?.growth30d ?? 0) - (a.stars?.growth30d ?? 0));
    } else if (availableFilters.sortBy === 'maintenance') {
      const priority = { active: 0, stale: 1, archived: 2 };
      agents.sort(
        (a, b) =>
          (priority[a.stars?.maintenance as keyof typeof priority] ?? 99) -
          (priority[b.stars?.maintenance as keyof typeof priority] ?? 99)
      );
    } else if (availableFilters.sortBy === 'name') {
      agents.sort((a, b) => a.name.localeCompare(b.name));
    }

    return agents;
  }, [catalog, availableFilters]);

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

  // Use the filtered and sorted available agents
  const availableAgents = filteredAndSortedAvailable;

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
  // per-agent materialize path, then clears drift status. We DO NOT re-check
  // drift immediately—drift detection may show transient false-positives
  // (timing/normalization issues) after a fresh write. Drift will be
  // re-detected on the next agent view load or manual check.
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
    // Immediately clear drift status (resync succeeded, file is now in sync).
    // Do NOT re-check drift immediately—let it refresh on next view load.
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
    // Refresh state to show updated registry
    void refreshAll();
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

  /** Open the shared install modal for an Explore row's catalog id. */
  const openInstallCatalog = useCallback(
    (catalogId: string) => {
      const entry = catalog?.find((c) => c.id === catalogId);
      if (entry) setJob({ agent: entry, action: 'install' });
    },
    [catalog]
  );

  return (
    <div className="page-container">
      {/* Header: Premium typography and refined hierarchy — responsive layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 px-4 sm:px-6 md:px-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2 text-slate-900 dark:text-slate-50">
            Agents
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-[65ch]">
            Installed agent CLIs, available agents from the maintained catalog, and custom agents with explicit config paths.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0 w-full sm:w-auto justify-end">
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
      <div className="card mb-6 mx-4 sm:mx-6 md:mx-8">
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
        <div className="chat-list">
          {installedRows.length === 0 ? (
            <div className="empty-state py-8">
              <p className="text-center text-tertiary text-sm">No agents installed yet — pick one below to install.</p>
            </div>
          ) : (
            installedRows.map((row) => {
              const mcpCount = (registry?.mcpServers || []).filter(
                (m) => m.agentIds.includes(row.id)
              ).length;
              const mcpOver = mcpCount > MCP_SERVER_WARNING_THRESHOLD;
              return (
                <div key={row.id} className="chat-row-card">
                  <div className="chat-row-avatar">
                    <AgentIconTile
                      icon={row.catalogEntry?.icon}
                      id={row.id}
                      size={40}
                    />
                  </div>
                  <div className="chat-row-content">
                    <div className="chat-row-header">
                      <div className="chat-row-label">{row.name}</div>
                      <div className="flex items-center gap-1">
                        {!row.known && (
                          <Tooltip content="Discovered on this machine but not in the maintained catalog yet">
                            <span className="badge badge-neutral text-xs">new</span>
                          </Tooltip>
                        )}
                        {mcpCount > 0 && (
                          <Tooltip content={mcpOver ? `${mcpCount} MCP servers assigned — high server counts can slow an agent down` : `${mcpCount} MCP server${mcpCount === 1 ? '' : 's'} assigned`}>
                            <span className={`badge ${mcpOver ? 'badge-warning' : 'badge-neutral'} text-xs`}>
                              {mcpOver && <AlertTriangle size={10} className="inline mr-0.5" />}
                              MCP: {mcpCount}
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="chat-row-preview">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{row.id}</span>
                        <span className="badge badge-success text-xs">
                          <span className="live-dot" />
                          {row.detection.version || 'installed'}
                        </span>
                        {updateStatus[row.id]?.checking ? (
                          <span className="text-xs text-tertiary flex items-center gap-1">
                            <div className="spinner" style={{ width: 10, height: 10 }} />
                            checking…
                          </span>
                        ) : updateStatus[row.id]?.updateAvailable ? (
                          <Tooltip content={`Update to ${updateStatus[row.id]?.latestVersion}`}>
                            <button
                              className="btn-secondary btn-sm text-xs px-2 py-0.5"
                              disabled={updateStatus[row.id]?.updating}
                              onClick={() => runUpdate(row.id, row.name)}
                            >
                              {updateStatus[row.id]?.updating ? (
                                <div className="spinner" style={{ width: 10, height: 10 }} />
                              ) : (
                                <ArrowUpCircle size={10} />
                              )}
                              Update
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>
                      <ApiTypeBadges kinds={row.catalogEntry?.apiTypes} compact />
                      <DriftBadge
                        status={driftStatus[row.id]}
                        onResync={() => void resyncAgent(row.id, row.name)}
                      />
                      {row.catalogEntry?.stars && (
                        <StarBadge
                          github={row.catalogEntry.github}
                          stars={row.catalogEntry.stars}
                          compact
                        />
                      )}
                    </div>
                  </div>
                  <div className="chat-row-actions">
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
                        {
                          label: 'Edit config file',
                          onClick: () => {
                            setOpenMenuFor(null);
                            openFileEditor(row.id, row.name, 'config');
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
                              {
                                label: 'Edit MCP file',
                                onClick: () => {
                                  setOpenMenuFor(null);
                                  openFileEditor(row.id, row.name, 'mcp');
                                },
                              },
                            ]
                          : []),
                        ...(row.catalogEntry &&
                        commandFor(row.catalogEntry, 'uninstall', p)
                          ? [
                              {
                                label: 'Uninstall',
                                onClick: () => {
                                  setOpenMenuFor(null);
                                  setJob({
                                    agent: row.catalogEntry!,
                                    action: 'uninstall',
                                  });
                                },
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------- Available to Install ---------------- */}
      <div className="card mb-6 mx-4 sm:mx-6 md:mx-8">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2" role="tablist" aria-label="Agent discovery">
            <button
              role="tab"
              aria-selected={availTab === 'catalog'}
              className={`btn btn-sm ${availTab === 'catalog' ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setAvailTab('catalog')}
            >
              <Download size={13} /> Installable
              <span className="text-tertiary font-normal">({availableAgents.length})</span>
            </button>
            <button
              role="tab"
              aria-selected={availTab === 'explore'}
              className={`btn btn-sm ${availTab === 'explore' ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setAvailTab('explore')}
            >
              <Compass size={13} /> Explore
              <span className="text-tertiary font-normal">
                ({exploreAgents.length})
              </span>
            </button>
          </div>
          {availTab === 'catalog' ? (
            <span className="badge badge-neutral">
              {availableAgents.length} agent
              {availableAgents.length === 1 ? '' : 's'}
            </span>
          ) : (
            <a
              href="https://openrouter.ai/apps/category/coding"
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-tertiary hover:underline"
            >
              Ranked by openrouter.ai · coding agents ↗
            </a>
          )}
        </div>

        {/* Filter and Sort Controls — responsive flex wrap */}
        {!catalogError && catalog && catalog.filter((a) => !a.installed).length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-b border-border-primary bg-bg-secondary/40 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded text-xs flex-1 min-w-[150px]">
              <Search size={12} className="text-tertiary" />
              <input
                type="text"
                placeholder="Search agents…"
                className="bg-transparent border-0 outline-none flex-1 text-sm"
                value={availableFilters.searchQuery}
                onChange={(e) =>
                  setAvailableFilters((f) => ({ ...f, searchQuery: e.target.value }))
                }
              />
            </div>

            {/* Sort */}
            <select
              className="input input-sm text-xs"
              value={availableFilters.sortBy}
              onChange={(e) =>
                setAvailableFilters((f) => ({
                  ...f,
                  sortBy: e.target.value as AvailableAgentFilters['sortBy'],
                }))
              }
            >
              <option value="stars">Sort: Most Stars</option>
              <option value="trending">Sort: Trending</option>
              <option value="name">Sort: Name A-Z</option>
              <option value="maintenance">Sort: Maintenance</option>
            </select>

            {/* Trending filter */}
            <button
              className={`btn btn-sm text-xs ${
                availableFilters.filterTrending
                  ? 'btn-accent'
                  : 'btn-ghost'
              }`}
              onClick={() =>
                setAvailableFilters((f) => ({
                  ...f,
                  filterTrending: !f.filterTrending,
                }))
              }
            >
              {availableFilters.filterTrending ? '🔥 Trending' : 'Trending'}
            </button>

            {/* Maintenance filter */}
            <select
              className="input input-sm text-xs"
              value={availableFilters.filterByStatus}
              onChange={(e) =>
                setAvailableFilters((f) => ({
                  ...f,
                  filterByStatus: e.target.value as AvailableAgentFilters['filterByStatus'],
                }))
              }
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="stale">Stale</option>
              <option value="archived">Archived</option>
            </select>

            {/* Clear filters */}
            {(availableFilters.searchQuery ||
              availableFilters.filterTrending ||
              availableFilters.sortBy !== 'stars' ||
              availableFilters.filterByStatus !== 'all') && (
              <button
                className="btn btn-ghost btn-sm text-xs"
                onClick={() =>
                  setAvailableFilters({
                    sortBy: 'stars',
                    filterTrending: false,
                    filterByStatus: 'all',
                    searchQuery: '',
                  })
                }
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {availTab === 'explore' ? (
          exploreError ? (
            <div className="p-4">
              <p className="text-error text-sm">{exploreError}</p>
            </div>
          ) : exploreAgents.length === 0 ? (
            <div className="p-6 flex flex-col items-center justify-center gap-3">
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <p className="text-secondary text-sm">Loading trending agents…</p>
            </div>
          ) : (
            <ExploreList
              agents={exploreAgents}
              platform={p}
              searchQuery={availableFilters.searchQuery}
              onInstallCatalog={openInstallCatalog}
            />
          )
        ) : !catalog && !catalogError ? (
          <div className="p-6 flex flex-col items-center justify-center gap-3">
            <div className="spinner" style={{ width: 24, height: 24 }} />
            <p className="text-secondary text-sm">Loading agent catalog…</p>
          </div>
        ) : catalogError && !catalog ? (
          <div className="p-4">
            <p className="text-error text-sm">{catalogError}</p>
            <p className="text-tertiary text-xs mt-1">
              Showing the last known detection snapshot instead.
            </p>
          </div>
        ) : availableAgents.length === 0 ? (
          <div className="p-4 text-center text-tertiary text-sm">
            Every catalogued agent is installed on this machine 🎉
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
      <div className="card mx-4 sm:mx-6 md:mx-8">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="card-title">Custom Agents</h3>
          <button
            className="btn-primary btn-sm w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1"
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

/* -------------------------------------------------------------------------- */
/* Explore row — one OpenRouter-ranked coding agent                            */
/* -------------------------------------------------------------------------- */

export interface ExploreAgentRow {
  rank: number;
  name: string;
  description: string;
  website: string;
  kind: 'cli' | 'web' | 'desktop';
  catalogId?: string;
  install?: string;
  logo?: string;
  hasAdapter?: boolean;
  catalog: ExploreCatalogRef | null;
}

interface ExploreCatalogRef {
  id: string;
  name: string;
  apiTypes: string[];
  status: string;
  install?: string;
  installPlatforms?: string[];
  note?: string;
  github?: string;
  stars?: number;
}

interface ExploreRowProps {
  agent: ExploreAgentRow;
  platform: string;
  onInstallCatalog: (catalogId: string) => void;
}

const KIND_BADGE: Record<string, { label: string; className: string }> = {
  cli: { label: 'CLI installable', className: 'badge-success' },
  web: { label: 'Web app', className: 'badge-neutral' },
  desktop: { label: 'Desktop app', className: 'badge-neutral' },
};

const ExploreRow = memo(function ExploreRow({
  agent,
  platform,
  onInstallCatalog,
}: ExploreRowProps) {
  const [copied, setCopied] = useState(false);
  const catalog = agent.catalog;
  // Effective install command: catalog entry wins (allow-listed + tracked),
  // otherwise the explore entry's own verified command (copy-only).
  const installCmd =
    catalog && catalog.install && (!catalog.installPlatforms || catalog.installPlatforms.includes(platform))
      ? catalog.install
      : (agent.install ?? catalog?.install);
  const wiredInstall = Boolean(catalog && catalog.install && installCmd === catalog.install);

  const handleCopy = useCallback(() => {
    if (installCmd) {
      navigator.clipboard.writeText(installCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [installCmd]);

  const logoSrc = agent.logo
    ? `/logos/${agent.logo}`
    : catalog
      ? logoUrl(catalog.id)
      : undefined;

  const hue = ((agent.rank * 47) % 360);
  const kind = KIND_BADGE[agent.kind] ?? KIND_BADGE.web;

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 px-5 py-4 hover:bg-bg-hover transition-colors duration-150 border-b border-slate-200/30 dark:border-slate-700/30 last:border-b-0">
      {/* Rank + logo */}
      <div className="flex items-center gap-3 min-w-0 md:min-w-[220px]">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: `hsl(${hue} 60% 92%)`, color: `hsl(${hue} 55% 32%)` }}
          title={`#${agent.rank} on OpenRouter`}
        >
          {agent.rank}
        </span>
        <div
          className="flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: 48,
            height: 48,
            borderRadius: 13,
            background: logoSrc ? 'color-mix(in srgb, var(--bg-secondary) 80%, transparent)' : `hsl(${hue} 60% 90%)`,
            color: `hsl(${hue} 55% 32%)`,
          }}
        >
          {logoSrc ? (
            <img src={logoSrc} alt="" width={30} height={30} style={{ objectFit: 'contain' }} loading="lazy" />
          ) : (
            <span className="font-bold text-lg">{agent.name.slice(0, 1)}</span>
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-50">
              {agent.name}
            </span>
            {catalog && <span className={`badge badge-xs ${STATUS_BADGE[catalog.status] || 'badge-neutral'}`}>{catalog.status}</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`badge badge-xs ${kind.className}`}>{kind.label}</span>
            {agent.hasAdapter && <span className="badge badge-xs badge-accent">Adapter ✓</span>}
            {catalog && catalog.apiTypes.length > 0 && (
              <ApiTypeBadges kinds={catalog.apiTypes as ProviderApiKind[]} compact />
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <Tooltip content={agent.description}>
          <span className="text-sm text-slate-600 dark:text-slate-400 line-clamp-1">
            {agent.description}
          </span>
        </Tooltip>
        {catalog?.note && (
          <p className="text-xs text-tertiary mt-1 line-clamp-1">{catalog.note}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:justify-end">
        {installCmd && (
          <div className="flex items-center gap-1 px-2.5 py-1.5 bg-bg-tertiary rounded-lg text-xs font-mono border border-border-primary min-w-0">
            <span className="break-all leading-snug max-w-[260px]">{installCmd}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 p-0.5 ml-1 hover:text-text-primary transition-colors"
              title="Copy command"
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            </button>
          </div>
        )}
        {wiredInstall ? (
          <button className="btn-primary btn-sm flex-shrink-0" onClick={() => onInstallCatalog(catalog!.id)}>
            <Download size={14} />
            Install
          </button>
        ) : (
          <>
            {agent.kind === 'cli' && installCmd && !wiredInstall && (
              <span className="badge badge-xs badge-neutral flex-shrink-0">manual install</span>
            )}
            <a
              className="btn-secondary btn-sm flex-shrink-0"
              href={agent.website}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink size={14} />
              Visit
            </a>
          </>
        )}
      </div>
    </div>
  );
});

/**
 * ExploreList — the full OpenRouter coding-agents ranking. Agent rows that map
 * to a catalogued agent get a working tracked Install; everything else shows
 * its verified install command (copy) or a website link.
 */
function ExploreList({
  agents,
  platform,
  searchQuery,
  onInstallCatalog,
}: {
  agents: ExploreAgentRow[];
  platform: string;
  searchQuery: string;
  onInstallCatalog: (catalogId: string) => void;
}) {
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query)
      )
    : agents;
  return (
    <div className="flex flex-col border border-border-primary rounded-xl overflow-hidden">
      {filtered.length === 0 ? (
        <div className="p-6 text-center text-tertiary text-sm">No agents match your search.</div>
      ) : (
        filtered.map((a) => (
          <ExploreRow key={a.rank} agent={a} platform={platform} onInstallCatalog={onInstallCatalog} />
        ))
      )}
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
