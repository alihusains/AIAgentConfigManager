import { memo, useState, useMemo } from 'react';
import { api, type CatalogAgent } from '../api';
import { Download, ExternalLink, Filter, Flame, Star, TrendingUp } from 'lucide-react';
import { AgentIconTile } from './AgentIcon';
import { StarBadge } from './StarBadge';
import { Tooltip } from '../ui';
import {
  formatStarCount,
  getRankBadge,
  getMaintenanceStatus,
  isTrending,
  formatGrowth,
} from '../utils/starFormatter';

interface AgentRankingsProps {
  agents: CatalogAgent[];
  onInstall?: (agent: CatalogAgent) => void;
}

/**
 * Full-page agent rankings leaderboard with sorting, filtering, and export.
 */
export function AgentRankings({
  agents,
  onInstall,
}: AgentRankingsProps) {
  const [sortBy, setSortBy] = useState<'stars' | 'growth' | 'name'>('stars');
  const [filterTrending, setFilterTrending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort and filter
  const sortedAgents = useMemo(() => {
    let list = [...agents];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    // Trending filter
    if (filterTrending) {
      list = list.filter((a) => a.stars && isTrending(a.stars.growth30d));
    }

    // Sort
    if (sortBy === 'growth') {
      list.sort((a, b) => (b.stars?.growth30d ?? 0) - (a.stars?.growth30d ?? 0));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => (b.stars?.count ?? 0) - (a.stars?.count ?? 0));
    }

    return list;
  }, [agents, sortBy, filterTrending, searchQuery]);

  const exportAsCSV = () => {
    const csv = [
      ['Rank', 'Agent', 'Stars', '30d Growth', 'Maintenance', 'GitHub'].join(','),
      ...sortedAgents.map((a, i) => [
        i + 1,
        `"${a.name}"`,
        a.stars?.count ?? 0,
        a.stars?.growth30d ?? 0,
        a.stars?.maintenance ?? 'unknown',
        a.github ?? '—',
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-rankings-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Agent Rankings</h1>
        <p className="text-secondary text-sm mt-1">
          AI coding agents ranked by GitHub stars, trending activity, and maintenance status.
        </p>
      </div>

      {/* Stats Summary */}
      {sortedAgents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-sm text-tertiary mb-1">Total Agents</div>
            <div className="text-2xl font-bold">{sortedAgents.length}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-tertiary mb-1">Most Popular</div>
            <div className="text-2xl font-bold">{formatStarCount(sortedAgents[0]?.stars?.count)}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-tertiary mb-1">Trending (30d+50⭐)</div>
            <div className="text-2xl font-bold">
              {sortedAgents.filter((a) => isTrending(a.stars?.growth30d)).length}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="card mb-6 p-4">
        <div className="flex flex-col gap-4">
          {/* Search + Sort */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              type="text"
              placeholder="Search agents…"
              className="input flex-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="stars">Sort: Most Stars</option>
              <option value="growth">Sort: Trending (30d Growth)</option>
              <option value="name">Sort: Name A-Z</option>
            </select>
            <button
              className={`btn btn-sm ${filterTrending ? 'btn-accent' : 'btn-ghost'}`}
              onClick={() => setFilterTrending(!filterTrending)}
            >
              {filterTrending ? '🔥 Trending' : 'Trending'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={exportAsCSV}
            >
              <Download size={14} />
              CSV
            </button>
          </div>

          {/* Filter summary */}
          {(searchQuery || filterTrending || sortBy !== 'stars') && (
            <div className="flex items-center gap-2 text-xs">
              <Filter size={12} className="text-tertiary" />
              <span className="text-tertiary">
                {sortedAgents.length} of {agents.length} agents
                {searchQuery && ` • matching "${searchQuery}"`}
                {filterTrending && ' • trending'}
              </span>
              <button
                className="text-accent-primary hover:underline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterTrending(false);
                  setSortBy('stars');
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rankings Table */}
      {sortedAgents.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-tertiary text-sm">No agents match your filters.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-secondary border-b border-border-primary">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">#</th>
                  <th className="px-4 py-2 text-left font-semibold">Agent</th>
                  <th className="px-4 py-2 text-right font-semibold">Stars</th>
                  <th className="px-4 py-2 text-right font-semibold">30d Growth</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-center font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((agent, index) => {
                  const trending = isTrending(agent.stars?.growth30d);
                  const maint = getMaintenanceStatus(agent.stars?.maintenance);
                  const rankBadge = getRankBadge(index);

                  return (
                    <tr
                      key={agent.id}
                      className="border-b border-border-primary hover:bg-bg-secondary transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-4 py-3 font-semibold text-accent-primary">
                        <div className="flex items-center gap-1">
                          #{index + 1}
                          {rankBadge && (
                            <Tooltip content={`Ranked ${rankBadge}`}>
                              <span className="badge badge-accent text-xs">
                                {rankBadge}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </td>

                      {/* Agent name + icon */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AgentIconTile
                            icon={agent.icon}
                            id={agent.id}
                            size={32}
                          />
                          <div className="min-w-0">
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-xs text-tertiary">{agent.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Stars */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star size={14} className="text-accent-primary" />
                          <span className="font-semibold">
                            {agent.stars ? formatStarCount(agent.stars.count) : '—'}
                          </span>
                        </div>
                      </td>

                      {/* Growth */}
                      <td className="px-4 py-3 text-right">
                        {trending ? (
                          <Tooltip content={`Grew ${agent.stars?.growth30d} stars in last 30 days`}>
                            <span className="badge badge-warning inline-flex items-center gap-1">
                              <Flame size={12} />
                              {formatGrowth(agent.stars?.growth30d)}
                            </span>
                          </Tooltip>
                        ) : agent.stars?.growth30d ? (
                          <span className="text-tertiary text-xs">
                            +{agent.stars.growth30d}
                          </span>
                        ) : (
                          <span className="text-tertiary">—</span>
                        )}
                      </td>

                      {/* Maintenance */}
                      <td className="px-4 py-3">
                        {agent.stars?.maintenance && (
                          <Tooltip content={`Status: ${maint.label}`}>
                            <span className={`badge badge-xs ${maint.color}`}>
                              {maint.icon} {maint.label}
                            </span>
                          </Tooltip>
                        )}
                      </td>

                      {/* GitHub link */}
                      <td className="px-4 py-3 text-center">
                        {agent.github ? (
                          <a
                            href={agent.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-primary hover:text-accent-primary/80 transition-colors inline-flex items-center gap-1"
                            title="View on GitHub"
                          >
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="text-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="mt-6 text-xs text-tertiary text-center">
        Star counts are updated daily. Last update times shown in individual agent cards.
      </div>
    </div>
  );
}
