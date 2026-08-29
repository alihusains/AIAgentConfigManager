import { useEffect, useMemo, useState } from 'react';
import { api, type CatalogAgent } from '../api';

/**
 * Shared agent-catalog loader.
 *
 * The catalog is static reference data (it ships with the server and does not
 * change during a session), yet three views need it — Dashboard (protocol
 * coverage), AgentsView (per-agent API badges) and AgentDetailView (icon,
 * install commands). Fetching it independently in each view would fire the
 * same request up to three times and re-run it on every mount.
 *
 * Instead we keep a module-level cache + a single in-flight promise, so the
 * catalog is fetched **at most once per session** and every consumer reads the
 * same array reference (which keeps downstream `React.memo` / `useMemo`
 * comparisons cheap and stable).
 */
let cache: CatalogAgent[] | null = null;
let pending: Promise<CatalogAgent[]> | null = null;
const subscribers = new Set<(agents: CatalogAgent[]) => void>();

/** Stable empty reference so consumers get one shared array, not a new [] per render. */
const EMPTY: CatalogAgent[] = [];

function loadCatalog(): Promise<CatalogAgent[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = api
      .getAgentCatalog()
      .then((res) => {
        const agents = res.ok && res.data ? res.data.agents : [];
        cache = agents;
        pending = null;
        for (const fn of subscribers) fn(agents);
        return agents;
      })
      .catch(() => {
        // Reset so a later mount can retry after a transient failure.
        pending = null;
        return [] as CatalogAgent[];
      });
  }
  return pending;
}

/**
 * Subscribe to the shared catalog. Returns a stable array reference once
 * loaded; re-renders only when the catalog actually arrives.
 */
export function useAgentCatalog(): CatalogAgent[] {
  const [agents, setAgents] = useState<CatalogAgent[]>(cache ?? EMPTY);

  useEffect(() => {
    if (cache) {
      setAgents(cache);
      return;
    }
    let alive = true;
    const notify = (a: CatalogAgent[]) => {
      if (alive) setAgents(a);
    };
    subscribers.add(notify);
    void loadCatalog().then((a) => {
      if (alive) setAgents(a);
    });
    return () => {
      alive = false;
      subscribers.delete(notify);
    };
  }, []);

  return agents;
}

/**
 * O(1) id → catalog-entry lookup, memoized on the (stable) catalog array.
 * Rows use this to read `apiTypes` / `icon` without scanning the list.
 */
export function useCatalogMap(): Map<string, CatalogAgent> {
  const agents = useAgentCatalog();
  return useMemo(() => {
    const map = new Map<string, CatalogAgent>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);
}
