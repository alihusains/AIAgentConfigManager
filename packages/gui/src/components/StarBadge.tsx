import { Star, Flame, Trending2, ExternalLink } from 'lucide-react';
import { Tooltip } from '../ui';
import {
  formatStarCount,
  getRankBadge,
  getMaintenanceStatus,
  isTrending,
  formatGrowth,
  getTimeSinceUpdate,
} from '../utils/starFormatter';

interface StarBadgeProps {
  /** GitHub repository URL */
  github?: string;
  /** Star count metadata */
  stars?: {
    count: number;
    fetchedAt: string;
    growth30d?: number;
    maintenance?: 'active' | 'stale' | 'archived';
  };
  /** Agent rank in the leaderboard (0-based) */
  rank?: number;
  /** Compact display mode */
  compact?: boolean;
}

/**
 * Display star count badge with GitHub link, rank, trending indicator,
 * and maintenance status.
 */
export function StarBadge({
  github,
  stars,
  rank,
  compact = false,
}: StarBadgeProps) {
  if (!stars) return null;

  const trending = isTrending(stars.growth30d);
  const rankBadge = rank !== undefined ? getRankBadge(rank) : null;
  const maint = getMaintenanceStatus(stars.maintenance);
  const timeSince = getTimeSinceUpdate(stars.fetchedAt);

  const formatDisplay = () => formatStarCount(stars.count);
  const updateInfo = `Updated ${timeSince}`;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {trending && (
          <Tooltip content={`Trending: ${formatGrowth(stars.growth30d)}`}>
            <span className="flex items-center gap-0.5 text-warning text-xs">
              <Flame size={12} />
            </span>
          </Tooltip>
        )}
        {github ? (
          <Tooltip content={`${formatDisplay()} stars on GitHub · ${updateInfo}`}>
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="badge badge-neutral text-xs hover:badge-primary transition-colors inline-flex items-center gap-1"
            >
              <Star size={12} />
              {formatDisplay()}
              <ExternalLink size={10} />
            </a>
          </Tooltip>
        ) : (
          <Tooltip content={updateInfo}>
            <span className="badge badge-neutral text-xs">
              <Star size={12} className="inline" />
              {formatDisplay()}
            </span>
          </Tooltip>
        )}
      </div>
    );
  }

  // Full display
  return (
    <div className="flex flex-col gap-1">
      {/* Star count + rank row */}
      <div className="flex items-center gap-2 flex-wrap">
        {rankBadge && (
          <Tooltip content={`Ranked #${rank! + 1} by stars`}>
            <span className="badge badge-accent text-xs font-semibold">
              {rankBadge}
            </span>
          </Tooltip>
        )}

        {github ? (
          <Tooltip content={`${formatDisplay()} stars on GitHub · ${updateInfo}`}>
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="badge badge-primary hover:badge-accent transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Star size={14} className="inline" />
              {formatDisplay()}
              <ExternalLink size={12} className="inline" />
            </a>
          </Tooltip>
        ) : (
          <Tooltip content={updateInfo}>
            <span className="badge badge-neutral inline-flex items-center gap-1">
              <Star size={14} className="inline" />
              {formatDisplay()}
            </span>
          </Tooltip>
        )}

        {trending && (
          <Tooltip content={`Trending: ${formatGrowth(stars.growth30d)} in last 30 days`}>
            <span className="badge badge-warning inline-flex items-center gap-1">
              <Flame size={12} />
              Trending
            </span>
          </Tooltip>
        )}
      </div>

      {/* Maintenance status */}
      {stars.maintenance && (
        <Tooltip content={`Maintenance status: ${maint.label}`}>
          <span className={`badge badge-xs ${maint.color}`}>
            {maint.icon} {maint.label}
          </span>
        </Tooltip>
      )}

      {/* Updated timestamp */}
      <span className="text-xs text-tertiary">{updateInfo}</span>
    </div>
  );
}
