import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { AgentJob, CliToolStatus, ToolUpdateStatus } from '@ai-agent-config/core';
import { useStore } from '../store';
import { Badge, Button, Card, EmptyState, SectionHeader, StatCard } from '../ui';
import {
  ArrowUpCircle,
  Boxes,
  CheckCircle2,
  GitBranch,
  Package,
  RefreshCw,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';

/**
 * ToolsView — the CLI/environment tools tab.
 *
 * Lists the curated set of important CLIs (node, npm, pnpm, bun, git, …)
 * with installed / version / missing status, grouped by kind, plus a
 * per-row and a global 'Check' action that re-detects against the server.
 *
 * Update checking is opt-in ('Check for updates'): the server compares
 * installed versions against the npm registry for npm-distributed tools
 * (npm, pnpm, yarn, bun) and reports 'up to date' vs 'vX → vY'. Running
 * an update is an explicit per-row action that launches a tracked job
 * (same streaming/safety pattern as agent install/uninstall).
 *
 * Data lives in local state (not the global store): it is view-scoped,
 * fetched once on mount and refreshed on demand, so the rest of the app
 * never re-renders when a check finishes. Rows are memoized. There are no
 * polling loops — job polling only runs while an update job is in flight.
 */

const GROUP_ORDER = ['runtime', 'package-manager', 'vcs', 'language-toolchain'];

const GROUP_META: Record<string, { title: string; icon: React.ReactNode }> = {
  runtime: { title: 'Runtimes', icon: <Terminal size={16} /> },
  'package-manager': { title: 'Package Managers', icon: <Package size={16} /> },
  vcs: { title: 'Version Control', icon: <GitBranch size={16} /> },
  'language-toolchain': { title: 'Language Toolchains', icon: <Wrench size={16} /> },
};

function foundByLabel(foundBy?: CliToolStatus['foundBy']): string | null {
  switch (foundBy) {
    case 'path':
      return 'on PATH';
    case 'shell-env':
      return 'login shell PATH';
    case 'known-location':
      return 'known location';
    default:
      return null;
  }
}

/** Update status cell: '—' until checked, then up to date / vX → vY / manual. */
const UpdateCell = memo(function UpdateCell({
  update,
  checking,
}: {
  update?: ToolUpdateStatus;
  checking: boolean;
}) {
  if (checking) {
    return <span className="text-tertiary text-xs">checking…</span>;
  }
  if (!update) {
    return <span className="text-tertiary text-xs">—</span>;
  }
  if (update.method === 'unsupported') {
    return (
      <span className="text-tertiary text-xs" title={update.reason}>
        manual
      </span>
    );
  }
  if (!update.latestVersion) {
    return (
      <span className="text-tertiary text-xs" title={update.reason}>
        unknown
      </span>
    );
  }
  if (!update.updateAvailable) {
    return <Badge variant="success">up to date</Badge>;
  }
  return (
    <Badge variant="warning" title={`Update available: v${update.latestVersion}`}>
      v{update.currentVersion} → v{update.latestVersion}
    </Badge>
  );
});

interface ToolRowProps {
  tool: CliToolStatus;
  update?: ToolUpdateStatus;
  checking: boolean;
  updateChecking: boolean;
  updating: boolean;
  onCheck: (name: string) => void;
  onUpdate: (name: string) => void;
}

const ToolRow = memo(function ToolRow({
  tool,
  update,
  checking,
  updateChecking,
  updating,
  onCheck,
  onUpdate,
}: ToolRowProps) {
  const foundBy = foundByLabel(tool.foundBy);
  const updateAvailable = update?.updateAvailable === true;
  return (
    <tr>
      <td>
        <div className="min-w-0">
          <p className="font-medium">{tool.label}</p>
          <p className="text-xs text-tertiary truncate" title={tool.description}>
            {tool.description}
          </p>
        </div>
      </td>
      <td>
        <span className="font-mono text-sm">{tool.name}</span>
      </td>
      <td>
        {tool.installed ? (
          <Badge variant="success" dot>
            installed
          </Badge>
        ) : (
          <Badge variant="neutral">missing</Badge>
        )}
      </td>
      <td>
        {tool.installed ? (
          <span className="font-mono text-sm">{tool.version || '—'}</span>
        ) : (
          <span className="text-tertiary text-sm">—</span>
        )}
      </td>
      <td>
        <UpdateCell update={update} checking={updateChecking && tool.installed} />
      </td>
      <td>
        {tool.installed && tool.path ? (
          <span className="font-mono text-xs text-secondary break-all" title={tool.path}>
            {foundBy ? <span className="text-tertiary">{foundBy} · </span> : null}
            {tool.path}
          </span>
        ) : (
          <span className="text-tertiary text-xs">—</span>
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={
              checking ? undefined : tool.installed ? (
                <CheckCircle2 size={14} />
              ) : (
                <XCircle size={14} />
              )
            }
            loading={checking}
            onClick={() => onCheck(tool.name)}
            title={`Re-check ${tool.name}`}
          >
            Check
          </Button>
          {updateAvailable && (
            <Button
              size="sm"
              variant="primary"
              icon={<ArrowUpCircle size={14} />}
              loading={updating}
              disabled={updating}
              onClick={() => void onUpdate(tool.name)}
              title={`Update ${tool.name} to v${update?.latestVersion}`}
            >
              Update
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
});

export function ToolsView() {
  const [tools, setTools] = useState<CliToolStatus[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkingName, setCheckingName] = useState<string | null>(null);

  // Update state. `updates` stays null until the user runs an explicit
  // 'Check for updates' (registry lookups are opt-in, never polled).
  const [updates, setUpdates] = useState<Record<string, ToolUpdateStatus> | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updatingName, setUpdatingName] = useState<string | null>(null);
  const [updateJobId, setUpdateJobId] = useState<string | null>(null);

  const addToast = useStore((s) => s.addToast);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await api.getTools();
      if (res.ok && res.data) {
        setTools(res.data.tools);
        setCheckedAt(res.data.checkedAt);
      } else {
        setError(res.error || 'Tool detection failed');
      }
    } finally {
      setChecking(false);
      setCheckingName(null);
    }
  }, []);

  // Initial load: one detection pass on mount.
  useEffect(() => {
    void check();
  }, [check]);

  const checkOne = useCallback(
    (name: string) => {
      setCheckingName(name);
      void check();
    },
    [check]
  );

  /** Opt-in registry check: re-detect tools + compare versions vs npm latest. */
  const checkUpdates = useCallback(async () => {
    setUpdateChecking(true);
    try {
      const res = await api.getToolUpdateCheck();
      if (res.ok && res.data) {
        setTools(res.data.tools);
        setCheckedAt(res.data.checkedAt);
        const map: Record<string, ToolUpdateStatus> = {};
        for (const u of res.data.updates) map[u.name] = u;
        setUpdates(map);
      } else {
        addToast({
          type: 'error',
          title: 'Update check failed',
          message: res.error || 'Could not check for tool updates',
        });
      }
    } finally {
      setUpdateChecking(false);
    }
  }, [addToast]);

  /** Explicit user action: run the update for one tool as a tracked job. */
  const runUpdate = useCallback(
    async (name: string) => {
      setUpdatingName(name);
      const res = await api.runToolUpdate(name);
      if (!res.ok || !res.data) {
        setUpdatingName(null);
        addToast({
          type: 'error',
          title: `${name} update failed`,
          message: res.error || 'Could not start the update',
        });
        return;
      }
      setUpdateJobId(res.data.jobId);
    },
    [addToast]
  );

  // Bounded job polling: only active while an update job is in flight,
  // torn down on completion or unmount (no leaky subscriptions).
  useEffect(() => {
    if (!updateJobId) return;
    let cancelled = false;
    const finish = (job: AgentJob) => {
      const name = job.agentId;
      const ok = job.status === 'success';
      addToast({
        type: ok ? 'success' : 'error',
        title: ok ? `${name} updated` : `${name} update failed`,
        message: ok
          ? `${name} is now at the latest version.`
          : job.error || `Update exited with code ${job.exitCode ?? '?'}.`,
      });
      setUpdatingName(null);
      setUpdateJobId(null);
      if (ok) void checkUpdates(); // refresh versions + update status
    };
    const tick = async () => {
      const res = await api.getAgentJob(updateJobId);
      if (cancelled) return;
      if (!res.ok || !res.data) {
        clearInterval(interval);
        setUpdatingName(null);
        setUpdateJobId(null);
        addToast({
          type: 'error',
          title: 'Update job lost',
          message: res.error || 'Could not read the update job status',
        });
        return;
      }
      if (res.data.status !== 'running') {
        clearInterval(interval);
        finish(res.data);
      }
    };
    const interval = setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [updateJobId, addToast, checkUpdates]);

  const groups = useMemo(() => {
    if (!tools) return [];
    const map = new Map<string, CliToolStatus[]>();
    for (const tool of tools) {
      const arr = map.get(tool.group) ?? [];
      arr.push(tool);
      map.set(tool.group, arr);
    }
    const ordered: { key: string; items: CliToolStatus[] }[] = [];
    for (const key of GROUP_ORDER) {
      const items = map.get(key);
      if (items) ordered.push({ key, items });
    }
    for (const [key, items] of map) {
      if (!GROUP_ORDER.includes(key)) ordered.push({ key, items });
    }
    return ordered;
  }, [tools]);

  const installedCount = useMemo(() => tools?.filter((t) => t.installed).length ?? 0, [tools]);
  const missingCount = useMemo(() => tools?.filter((t) => !t.installed).length ?? 0, [tools]);
  const updateCount = useMemo(
    () => (updates ? Object.values(updates).filter((u) => u.updateAvailable).length : null),
    [updates]
  );

  return (
    <div className="p-4">
      <SectionHeader
        title="CLI Tools"
        description="Important CLIs on this machine — runtimes, package managers, and toolchains — with version and resolved path."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={<RefreshCw size={14} />}
              loading={checking}
              onClick={() => void check()}
              title="Re-detect all tools"
            >
              Check
            </Button>
            <Button
              variant="secondary"
              icon={<ArrowUpCircle size={14} />}
              loading={updateChecking}
              onClick={() => void checkUpdates()}
              title="Compare installed versions against the npm registry (npm, pnpm, yarn, bun)"
            >
              Check for updates
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        <StatCard
          title="Checked"
          value={tools ? tools.length : '—'}
          icon={<Boxes size={18} />}
          trend={
            checkedAt ? `last check ${new Date(checkedAt).toLocaleTimeString()}` : 'not checked yet'
          }
        />
        <StatCard
          title="Installed"
          value={tools ? installedCount : '—'}
          icon={<CheckCircle2 size={18} />}
          color="var(--accent-success)"
        />
        <StatCard
          title="Missing"
          value={tools ? missingCount : '—'}
          icon={<XCircle size={18} />}
          color={missingCount > 0 ? 'var(--accent-warning)' : 'var(--accent-success)'}
        />
        <StatCard
          title="Updates available"
          value={updateCount === null ? '—' : updateCount}
          icon={<ArrowUpCircle size={18} />}
          color={updateCount ? 'var(--accent-warning)' : 'var(--accent-success)'}
          trend={updates ? 'npm-distributed tools' : 'run "Check for updates"'}
        />
      </div>

      {error && (
        <div className="card mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {!tools && !error ? (
        <Card>
          <EmptyState
            icon={<Terminal size={64} />}
            title="Detecting CLIs…"
            message="Probing PATH, your login shell, and well-known install locations."
          />
        </Card>
      ) : (
        groups.map(({ key, items }) => {
          const meta = GROUP_META[key] ?? { title: key, icon: <Wrench size={16} /> };
          return (
            <Card
              key={key}
              className="mb-4"
              title={
                <span className="flex items-center gap-2">
                  {meta.icon}
                  {meta.title}
                  <span className="text-xs text-tertiary font-normal">
                    {items.filter((t) => t.installed).length}/{items.length} installed
                  </span>
                </span>
              }
            >
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tool</th>
                      <th>Binary</th>
                      <th>Status</th>
                      <th>Version</th>
                      <th>Update</th>
                      <th>Path</th>
                      <th style={{ width: '190px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((tool) => (
                      <ToolRow
                        key={tool.name}
                        tool={tool}
                        update={updates?.[tool.name]}
                        checking={checkingName === tool.name}
                        updateChecking={updateChecking}
                        updating={updatingName === tool.name}
                        onCheck={checkOne}
                        onUpdate={runUpdate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
