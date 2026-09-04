import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { useAgentCatalog } from '../hooks/useAgentCatalog';
import { ApiTypeBadges } from './ApiTypeBadges';
import { AgentIconTile } from './AgentIcon';
import { providerApiLabel } from './ProviderVerify';
import { Skeleton } from '../ui';
import Database from 'lucide-react/dist/esm/icons/database.js';
import Server from 'lucide-react/dist/esm/icons/server.js';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import UserPlus from 'lucide-react/dist/esm/icons/user-plus.js';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import Settings from 'lucide-react/dist/esm/icons/settings.js';
import type { ProviderApiKind } from '@ai-agent-config/core';
import {
  DualPaneLayout,
  ControlPanel,
  FormSection,
  PreviewPane,
  StatusIndicator,
  ActionButtons,
  InstructionCard,
} from './ICTheme';

/**
 * Dashboard — IC Signature theme dual-pane layout.
 *
 * Left pane (ControlPanel):
 *  - Dashboard filters & toggles (stat visibility)
 *  - Date range / refresh options
 *  - Quick actions
 *
 * Right pane (PreviewPane):
 *  - Live stat cards (Model Providers, MCP Servers, Agents, Custom Agents)
 *  - Protocol coverage breakdown
 *  - Detected agents list
 *  - Real-time update indicators
 *
 * The dashboard maintains all existing functionality while applying the
 * IC theme's professional, minimalist aesthetic: high contrast, clean typography,
 * responsive layout (mobile-first), and accessibility-first design.
 */

const PROTOCOL_ORDER: ProviderApiKind[] = ['chat', 'responses', 'anthropic'];

/* -------------------------------------------------------------------------- */
/* Motion + formatting helpers                                                */
/* -------------------------------------------------------------------------- */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Entrance count-up: eases 0 → value on mount. Skipped entirely under
 * prefers-reduced-motion (shows the final value immediately).
 */
function useCountUp(target: number, reduced: boolean): number {
  const [value, setValue] = useState(reduced ? target : 0);
  const rafRef = useRef(0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    const from = 0;
    const distance = target - from;
    if (distance === 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + distance * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, reduced]);
  return value;
}

/** "2m ago" style freshness label for the registry footer. */
function freshnessLabel(updatedAt: number): string {
  const diff = Date.now() - updatedAt;
  if (diff < 30_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(updatedAt).toLocaleDateString();
}

/* -------------------------------------------------------------------------- */
/* IC Theme Stat Tile — Professional card with high contrast                  */
/* -------------------------------------------------------------------------- */

const IcStatTile = memo(function IcStatTile({
  label,
  icon,
  value,
  context,
  ratio,
  ratioLabel,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  /** Comparison context for the value (enabled count, config count, …). */
  context: string;
  /** Optional real ratio (0..1) rendered as a compact linear bar. */
  ratio?: number;
  /** Accessible description of the ratio, e.g. "3 of 5 installed". */
  ratioLabel?: string;
  onClick: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const displayed = useCountUp(value, reduced);
  return (
    <button
      type="button"
      className="ic-stat-tile"
      onClick={onClick}
      aria-label={`${label}: ${value}. ${context}`}
    >
      <div className="ic-stat-tile-header">
        <span className="ic-stat-tile-label">
          <span className="ic-stat-tile-icon">{icon}</span>
          {label}
        </span>
      </div>
      <div className="ic-stat-tile-body">
        <span className="ic-stat-tile-value stat-figure">{displayed}</span>
      </div>
      <div className="ic-stat-tile-footer">
        <span className="ic-stat-tile-context">{context}</span>
        {ratio !== undefined ? (
          <span
            className="ic-stat-tile-bar"
            role="progressbar"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={ratioLabel}
          >
            <span className="ic-stat-tile-bar-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </span>
        ) : null}
      </div>
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Protocol Coverage Card                                                     */
/* -------------------------------------------------------------------------- */

const ProtocolCoverage = memo(function ProtocolCoverage({
  counts,
  total,
}: {
  counts: Record<ProviderApiKind, number>;
  total: number;
}) {
  return (
    <div className="ic-protocol-coverage">
      <h4 className="ic-protocol-coverage-title">Protocol Coverage</h4>
      <p className="ic-protocol-coverage-subtitle">{total} catalog agents</p>
      <div className="ic-protocol-rows">
        {PROTOCOL_ORDER.map((kind) => {
          const n = counts[kind];
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div className="ic-protocol-row" key={kind}>
              <div className="ic-protocol-row-label">
                <span className={`ic-protocol-dot is-${kind}`} aria-hidden="true" />
                <span>{providerApiLabel(kind)}</span>
              </div>
              <div
                className="ic-protocol-bar"
                role="progressbar"
                aria-valuenow={n}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={`${providerApiLabel(kind)}: ${n} of ${total} agents`}
              >
                <div className={`ic-protocol-bar-fill is-${kind}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="ic-protocol-row-count">
                <span className="ic-protocol-row-value">{n}</span>
                <span className="ic-protocol-row-pct">{pct}%</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="ic-protocol-coverage-hint">
        Share of catalog agents declaring each wire protocol: chat (OpenAI Chat Completions),
        responses (OpenAI Responses), anthropic (Anthropic Messages).
      </p>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Detected Agents List                                                       */
/* -------------------------------------------------------------------------- */

interface DetectedAgentVM {
  id: string;
  name: string;
  icon?: string;
  kinds?: readonly ProviderApiKind[];
}

const DetectedList = memo(function DetectedList({
  agents,
  onSelect,
}: {
  agents: DetectedAgentVM[];
  onSelect: (id: string) => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="ic-detected-list-empty">
        <h4>Detected Agents</h4>
        <p>No agents detected on this machine yet.</p>
      </div>
    );
  }
  return (
    <div className="ic-detected-list">
      <div className="ic-detected-list-header">
        <h4>Detected Agents</h4>
        <span className="ic-detected-list-count">{agents.length} installed</span>
      </div>
      <ul className="ic-detected-list-rows">
        {agents.map((a) => (
          <li key={a.id}>
            <button type="button" className="ic-detected-row" onClick={() => onSelect(a.id)}>
              <AgentIconTile icon={a.icon} id={a.id} size={28} iconSize={16} />
              <span className="ic-detected-row-name">{a.name}</span>
              <div className="ic-detected-row-badges">
                <ApiTypeBadges kinds={a.kinds} compact />
              </div>
              <ArrowRight size={14} className="ic-detected-row-arrow" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Dashboard (Main component with IC Theme Dual-Pane Layout)                  */
/* -------------------------------------------------------------------------- */

export function Dashboard() {
  const { agents, registry, platform, loading, error, setActiveView, refreshAll, openAgent } =
    useStore();
  const catalog = useAgentCatalog();

  const [showFilters, setShowFilters] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Protocol coverage derived from the (stable) catalog reference.
  const coverage = useMemo(() => {
    const counts: Record<ProviderApiKind, number> = { chat: 0, responses: 0, anthropic: 0 };
    for (const entry of catalog) {
      for (const kind of entry.apiTypes ?? []) {
        if (kind in counts) counts[kind] += 1;
      }
    }
    return { counts, total: catalog.length };
  }, [catalog]);

  // Map id → catalog entry so the detected list can read both `icon` and
  // `apiTypes` in O(1). (DetectedAgent carries no icon; that lives in the
  // catalog.)
  const catalogById = useMemo(() => {
    const map = new Map<string, (typeof catalog)[number]>();
    for (const entry of catalog) map.set(entry.id, entry);
    return map;
  }, [catalog]);

  const detected = useMemo<DetectedAgentVM[]>(
    () =>
      agents
        .filter((a) => a.detection.installed)
        .map((a) => {
          const entry = catalogById.get(a.id);
          return {
            id: a.id,
            name: a.name,
            icon: entry?.icon,
            kinds: entry?.apiTypes,
          };
        }),
    [agents, catalogById]
  );

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshAll();
    }, 30_000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  // "Only free models" auto-sync (runs once per dashboard open): providers
  // flagged config.trackFreeModels are re-probed on the server; new free
  // model ids are pushed into the registry + every agent config. Silent
  // when nothing is tracked; a failed endpoint toasts once.
  const freeSyncDone = useRef(false);
  useEffect(() => {
    if (freeSyncDone.current) return;
    freeSyncDone.current = true;
    (async () => {
      try {
        const res = await api.syncFreeModels();
        if (!res.ok || !res.data) return;
        const { checked, results } = res.data;
        const failed = results.filter((r) => !r.endpointOk);
        const added = results.reduce((n, r) => n + r.added.length, 0);
        const removed = results.reduce((n, r) => n + r.removed.length, 0);
        if (added > 0 || removed > 0) {
          const names = results
            .filter((r) => r.added.length > 0 || r.removed.length > 0)
            .map((r) => r.providerId)
            .join(', ');
          useStore.getState().addToast({
            type: 'success',
            title: 'Free models synced',
            message:
              `${added} new free model${added === 1 ? '' : 's'} pushed into agent configs` +
              `${removed > 0 ? `, ${removed} removed` : ''} (${names})`,
          });
          await useStore.getState().refreshAll();
        }
        if (failed.length > 0 && checked > 0) {
          useStore.getState().addToast({
            type: 'warning',
            title: 'Free-model sync incomplete',
            message: `${failed.length} provider endpoint${
              failed.length === 1 ? '' : 's'
            } could not be re-checked${failed[0].error ? `: ${failed[0].error}` : ''}`,
          });
        }
      } catch {
        // Server unreachable — the normal connection error UI already covers it.
      }
    })();
  }, []);

  const goProviders = useCallback(() => setActiveView('providers'), [setActiveView]);
  const goMCP = useCallback(() => setActiveView('mcp'), [setActiveView]);
  const goAgents = useCallback(() => setActiveView('agents'), [setActiveView]);
  const handleRefresh = useCallback(() => refreshAll(), [refreshAll]);
  const handleSettings = useCallback(() => setActiveView('settings'), [setActiveView]);

  if (loading && !registry) {
    return (
      <div className="ic-dual-pane-layout">
        <div className="ic-dual-pane-header">
          <Skeleton width="240px" height={28} />
        </div>
        <div className="ic-dual-pane-container">
          <div className="ic-pane ic-pane-control">
            <Skeleton width="100%" height={300} />
          </div>
          <div className="ic-pane ic-pane-preview">
            <Skeleton width="100%" height={400} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !registry) {
    return (
      <div className="ic-dual-pane-layout">
        <div className="ic-dual-pane-header">
          <InstructionCard variant="error" title="Cannot reach the config server">
            <p>{error}</p>
            <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => refreshAll()}>
              Retry
            </button>
          </InstructionCard>
        </div>
      </div>
    );
  }

  const providers = registry?.providers || [];
  const mcpServers = registry?.mcpServers || [];
  const customAgents = registry?.customAgents || [];
  const installedAgents = agents.filter((a) => a.detection.installed);
  const agentsWithConfig = agents.filter((a) => a.detection.configExists);

  return (
    <DualPaneLayout
      header={
        <div className="ic-dashboard-header">
          <div>
            <h1 className="ic-dashboard-title">Dashboard Overview</h1>
            <p className="ic-dashboard-subtitle">
              One registry, distributed to every agent on this machine.
            </p>
          </div>
          <div className="ic-dashboard-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-2"
              onClick={handleRefresh}
              title="Refresh all data"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm flex items-center gap-2"
              onClick={handleSettings}
              title="Dashboard settings"
            >
              <Settings size={14} /> Settings
            </button>
          </div>
        </div>
      }
      controlPane={
        <ControlPanel title="Dashboard Controls">
          {/* Visibility toggles */}
          <FormSection label="View Options" hint="Choose which metrics to display">
            <label className="ic-form-check">
              <input
                type="checkbox"
                checked={showFilters}
                onChange={(e) => setShowFilters(e.target.checked)}
              />
              <span>Show all metrics</span>
            </label>
            <label className="ic-form-check">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>Auto-refresh every 30s</span>
            </label>
          </FormSection>

          {/* Quick actions */}
          <FormSection label="Quick Actions">
            <div className="ic-form-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm w-full flex items-center justify-center gap-2"
                onClick={goProviders}
              >
                <Plus size={14} /> Add Provider
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm w-full flex items-center justify-center gap-2"
                onClick={goMCP}
              >
                <Server size={14} /> MCP Servers
              </button>
            </div>
          </FormSection>

          {/* Info hint */}
          <InstructionCard variant="info" title="About this dashboard">
            <p>
              This dashboard shows you a real-time snapshot of your local AI agent configuration:
              installed providers, MCP servers, available and custom agents, and protocol coverage.
            </p>
            <p>Use the quick actions above to add new providers or configure MCP servers.</p>
          </InstructionCard>
        </ControlPanel>
      }
      previewPane={
        <PreviewPane
          title="Live Metrics"
          subtitle={
            registry?.updatedAt ? `Last updated ${freshnessLabel(registry.updatedAt)}` : undefined
          }
        >
          {/* Stat tiles grid */}
          <div className="ic-stats-grid">
            <IcStatTile
              label="Model Providers"
              icon={<Database size={15} />}
              value={providers.length}
              context={
                providers.length > 0
                  ? `${providers.filter((p) => p.provider.enabled).length} enabled`
                  : 'Add your first provider'
              }
              onClick={goProviders}
            />
            <IcStatTile
              label="MCP Servers"
              icon={<Server size={15} />}
              value={mcpServers.length}
              context={
                mcpServers.length > 0
                  ? `${mcpServers.filter((m) => m.server.enabled).length} enabled`
                  : 'Add your first MCP server'
              }
              onClick={goMCP}
            />
            <IcStatTile
              label="Agents (installed)"
              icon={<Bot size={15} />}
              value={installedAgents.length}
              context={`${agentsWithConfig.length} with config · ${agents.length} known`}
              ratio={agents.length > 0 ? installedAgents.length / agents.length : undefined}
              ratioLabel={`${installedAgents.length} of ${agents.length} agents installed`}
              onClick={goAgents}
            />
            <IcStatTile
              label="Custom Agents"
              icon={<UserPlus size={15} />}
              value={customAgents.length}
              context={customAgents.length > 0 ? 'user-defined config paths' : 'Register custom tools'}
              onClick={goAgents}
            />
          </div>

          {/* Protocol coverage + detected agents */}
          <div className="ic-detail-panels">
            <ProtocolCoverage counts={coverage.counts} total={coverage.total} />
            <DetectedList agents={detected} onSelect={openAgent} />
          </div>

          {/* Registry metadata */}
          <div className="ic-registry-metadata">
            <div className="ic-metadata-item">
              <span className="ic-metadata-label">Registry Path:</span>
              <code className="ic-metadata-value">{registry?.path}</code>
            </div>
            <div className="ic-metadata-item">
              <span className="ic-metadata-label">Platform:</span>
              <code className="ic-metadata-value">{platform}</code>
            </div>
          </div>

          {/* Action buttons and status */}
          <ActionButtons>
            <StatusIndicator
              variant={autoRefresh ? 'syncing' : 'idle'}
              label={autoRefresh ? 'Auto-refresh enabled' : 'Manual refresh'}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm flex items-center gap-1"
              onClick={goAgents}
            >
              Manage agents
              <ArrowRight size={13} />
            </button>
          </ActionButtons>
        </PreviewPane>
      }
    />
  );
}
