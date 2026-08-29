import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { useAgentCatalog } from '../hooks/useAgentCatalog';
import { ApiTypeBadges } from './ApiTypeBadges';
import { AgentIconTile } from './AgentIcon';
import { providerApiLabel } from './ProviderVerify';
import { Skeleton } from '../ui';
import {
  Database,
  Server,
  Bot,
  UserPlus,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import type { ProviderApiKind } from '@ai-agent-config/core';

/**
 * Dashboard — at-a-glance health of the local AI-agent estate.
 *
 * Design intent:
 *  - A bento-grid of four differentiated stat cards (providers, MCP servers,
 *    installed agents, custom agents) — each with its own accent tint and a
 *    subtle per-metric gradient. This is an intentional overview panel, not a
 *    uniform row of identical tinted cards: the tints are per-metric semantic
 *    accents, and only cards with a genuine secondary data dimension (installed
 *    vs. known agents) get a ring; the others stay number-forward.
 *  - A "Protocol coverage" panel answers the new question the catalog now
 *    supports: how many catalog agents speak each wire protocol
 *    (chat / responses / anthropic), rendered as segmented gradient bars with
 *    an animated fill-in plus one combined distribution bar.
 *  - A compact "Detected agents" strip surfaces installed agents with their
 *    API-kind badges so the newest data dimension is visible immediately.
 *
 * Everything is memoized and derived from stable store/catalog references so
 * the view re-renders only when the underlying data actually changes.
 */

const PROTOCOL_ORDER: ProviderApiKind[] = ['chat', 'responses', 'anthropic'];

/* -------------------------------------------------------------------------- */
/* Count-up + ring helpers (no charting library — plain CSS/SVG)              */
/* -------------------------------------------------------------------------- */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
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

/**
 * Thin SVG ring showing one real ratio (e.g. installed agents / known agents).
 * A dashoffset transition drives the fill-in; the global reduced-motion
 * override collapses the transition to instant.
 */
const Ring = memo(function Ring({
  ratio,
  size = 52,
  stroke = 6,
  trackClass = 'bento-ring-track',
  fillClass = 'bento-ring-fill',
}: {
  /** 0..1 — a real, currently-available ratio. */
  ratio: number;
  size?: number;
  stroke?: number;
  trackClass?: string;
  fillClass?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <svg
      className="bento-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle
        className={trackClass}
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
      />
      <circle
        className={fillClass}
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
});

/* -------------------------------------------------------------------------- */
/* Bento stat card (one metric in the overview grid)                          */
/* -------------------------------------------------------------------------- */

const BentoCard = memo(function BentoCard({
  label,
  icon,
  value,
  caption,
  tint,
  captionClass,
  ring,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  caption: string;
  /** `--bento-tint` token, e.g. `var(--accent-primary)`. */
  tint: string;
  captionClass?: string;
  /** Real ratio (0..1) to render as a ring; omit for a number-forward card. */
  ring?: { ratio: number; trackClass: string; fillClass: string };
  onClick: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const displayed = useCountUp(value, reduced);
  return (
    <button
      type="button"
      className="bento-card"
      style={{ '--bento-tint': tint } as React.CSSProperties}
      onClick={onClick}
    >
      <span className="bento-card-label">
        {icon}
        {label}
      </span>
      <span className="bento-card-body">
        <span className="bento-card-value stat-figure">{displayed}</span>
        <span className="bento-card-caption">
          {caption}
          {captionClass ? <span className={captionClass} /> : null}
        </span>
      </span>
      {ring ? (
        <Ring
          ratio={ring.ratio}
          trackClass={ring.trackClass}
          fillClass={ring.fillClass}
        />
      ) : null}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Protocol coverage                                                          */
/* -------------------------------------------------------------------------- */

const ProtocolCoverage = memo(function ProtocolCoverage({
  counts,
  total,
}: {
  counts: Record<ProviderApiKind, number>;
  total: number;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Protocol coverage</h3>
        <span className="text-secondary text-sm">{total} catalog agents</span>
      </div>
      <div className="protocol-coverage">
        {PROTOCOL_ORDER.map((kind) => {
          const n = counts[kind];
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          return (
            <div className="protocol-row" key={kind}>
              <span className="protocol-row-label">
                <span className={`protocol-dot is-${kind}`} aria-hidden="true" />
                {providerApiLabel(kind)}
              </span>
              <div
                className="protocol-bar"
                role="progressbar"
                aria-valuenow={n}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={`${providerApiLabel(kind)}: ${n} of ${total} agents`}
              >
                <div
                  className={`protocol-bar-fill is-${kind}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="protocol-row-count">{n}</span>
            </div>
          );
        })}
        {/* Combined distribution — one segmented bar of the same real data. */}
        <div
          className="protocol-segments"
          role="img"
          aria-label={`Protocol distribution: ${PROTOCOL_ORDER.map(
            (k) => `${providerApiLabel(k)} ${counts[k]}`,
          ).join(', ')}`}
        >
          {PROTOCOL_ORDER.map((kind) => {
            const n = counts[kind];
            const pct = total > 0 ? (n / total) * 100 : 0;
            return (
              <div
                key={kind}
                className={`protocol-segment is-${kind}`}
                style={{ width: `${pct}%` }}
                title={`${providerApiLabel(kind)}: ${n}`}
              />
            );
          })}
        </div>
      </div>
      <p className="text-tertiary text-xs mt-3">
        Share of catalog agents declaring each wire protocol: chat (OpenAI Chat
        Completions), responses (OpenAI Responses), anthropic (Anthropic
        Messages).
      </p>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Detected agents strip                                                      */
/* -------------------------------------------------------------------------- */

interface DetectedAgentVM {
  id: string;
  name: string;
  icon?: string;
  kinds?: readonly ProviderApiKind[];
}

const DetectedStrip = memo(function DetectedStrip({
  agents,
  onSelect,
}: {
  agents: DetectedAgentVM[];
  onSelect: (id: string) => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Detected agents</h3>
        </div>
        <p className="text-secondary text-sm">No agents detected on this machine yet.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Detected agents</h3>
        <span className="text-secondary text-sm">{agents.length} installed</span>
      </div>
      <div className="detected-strip">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            className="detected-chip"
            onClick={() => onSelect(a.id)}
          >
            <AgentIconTile icon={a.icon} id={a.id} size={24} iconSize={14} />
            <span className="detected-chip-name">{a.name}</span>
            <ApiTypeBadges kinds={a.kinds} compact />
          </button>
        ))}
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export function Dashboard() {
  const {
    agents,
    registry,
    platform,
    loading,
    error,
    authError,
    setActiveView,
    refreshAll,
    openAgent,
  } = useStore();
  const catalog = useAgentCatalog();

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

  // Map id → catalog entry so the detected strip can read both `icon` and
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

  const goProviders = useCallback(() => setActiveView('providers'), [setActiveView]);
  const goMCP = useCallback(() => setActiveView('mcp'), [setActiveView]);
  const goAgents = useCallback(() => setActiveView('agents'), [setActiveView]);

  if (loading && !registry) {
    return (
      <div className="p-4" role="status" aria-label="Loading registry state">
        <Skeleton className="mb-6" width="240px" height={28} />
        <div className="flex gap-4 flex-wrap mb-6">
          <Skeleton className="flex-1 min-w-[160px]" height={72} />
          <Skeleton className="flex-1 min-w-[160px]" height={72} />
          <Skeleton className="flex-1 min-w-[160px]" height={72} />
          <Skeleton className="flex-1 min-w-[160px]" height={72} />
        </div>
        <Skeleton width="100%" height={200} />
      </div>
    );
  }

  if (error && !registry) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="empty-state">
          <AlertTriangle size={64} className="empty-state-icon text-warning" />
          {authError ? (
            <>
              <h3 className="empty-state-title">Dashboard access token missing or expired</h3>
              <p className="empty-state-message">
                The page loads, but this browser no longer holds the per-session token of the
                running dashboard (401 Unauthorized). The agents and registry live behind the
                local API and cannot be shown without it.
              </p>
              <div className="mt-4">
                <button type="button" className="btn-primary" onClick={() => refreshAll()}>
                  Try Again
                </button>
              </div>
              <p className="empty-state-message mt-2">
                Still failing? Re-run <span className="font-mono">ai-config gui</span> in the
                terminal and open the printed{' '}
                <span className="font-mono">http://127.0.0.1:…/?t=…</span> URL — old tabs and
                bookmarks are rejected by design.
              </p>
            </>
          ) : (
            <>
              <h3 className="empty-state-title">Cannot reach the config server</h3>
              <p className="empty-state-message text-error">{error}</p>
              <button type="button" className="btn-primary mt-4" onClick={() => refreshAll()}>
                Retry
              </button>
            </>
          )}
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
    <div className="p-4 dashboard">
      {/* KPI bento grid — four differentiated stat cards, one accent each */}
      <div className="bento-grid">
        <BentoCard
          label="Model Providers"
          icon={<Database size={16} />}
          value={providers.length}
          caption={
            providers.length > 0
              ? `${providers.filter((p) => p.provider.enabled).length} enabled`
              : 'Add your first provider'
          }
          tint="var(--accent-primary)"
          onClick={goProviders}
        />
        <BentoCard
          label="MCP Servers"
          icon={<Server size={16} />}
          value={mcpServers.length}
          caption={
            mcpServers.length > 0
              ? `${mcpServers.filter((m) => m.server.enabled).length} enabled`
              : 'Add your first MCP server'
          }
          tint="var(--accent-info)"
          onClick={goMCP}
        />
        <BentoCard
          label="Agents (installed)"
          icon={<Bot size={16} />}
          value={installedAgents.length}
          caption={`${agentsWithConfig.length} have a config file · ${agents.length} known`}
          tint="var(--accent-success)"
          ring={
            agents.length > 0
              ? {
                  ratio: installedAgents.length / agents.length,
                  trackClass: 'bento-ring-track-success',
                  fillClass: 'bento-ring-fill-success',
                }
              : undefined
          }
          onClick={goAgents}
        />
        <BentoCard
          label="Custom Agents"
          icon={<UserPlus size={16} />}
          value={customAgents.length}
          caption={
            customAgents.length > 0 ? 'user-defined config paths' : 'Register custom tools'
          }
          tint="var(--accent-warning)"
          onClick={goAgents}
        />
      </div>

      {/* Protocol coverage + detected agents */}
      <div className="dashboard-panels">
        <ProtocolCoverage counts={coverage.counts} total={coverage.total} />
        <DetectedStrip agents={detected} onSelect={openAgent} />
      </div>

      {/* Registry summary */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Registry — single source of truth</h3>
          <span className="badge badge-primary">
            {registry?.updatedAt ? new Date(registry.updatedAt).toLocaleString() : '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-tertiary text-xs">Location</p>
            <p className="font-mono text-sm break-all mt-1">{registry?.path}</p>
            <p className="text-tertiary text-xs mt-2 mb-1">
              One definition per provider / MCP server; each entry lists the agents it is
              installed on. Agent files are generated from this registry — never edit them by
              hand.
            </p>
          </div>
          <div className="flex-shrink-0">
            <p className="text-tertiary text-xs">Info</p>
            <div className="mt-1 space-y-1">
              <div className="text-sm">
                <span className="text-tertiary">Platform:</span>{' '}
                <span className="font-mono">{platform}</span>
              </div>
              <div className="text-sm">
                <span className="text-tertiary">Providers:</span> {providers.length}
              </div>
              <div className="text-sm">
                <span className="text-tertiary">MCP servers:</span> {mcpServers.length}
              </div>
              <div className="text-sm">
                <span className="text-tertiary">Custom agents:</span> {customAgents.length}
              </div>
            </div>
          </div>
          <button type="button" className="btn-ghost btn-sm self-start" onClick={goAgents}>
            Manage agents
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
