import { memo, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

/**
 * StatCard — a KPI tile on the bento system (audit C3).
 *
 * Renders the same tile chrome as the Dashboard's BentoCard (label row with
 * icon, big figure, optional caption) via the shared `.bento-card` CSS, so
 * KPI rows look identical everywhere. The `--static` variant drops pointer
 * affordances for non-interactive tiles; passing `onClick` restores the
 * interactive role/keyboard handling.
 *
 * `color` is the `--bento-tint` and flows into the tile's radial wash, label
 * icon, and border glow via `color-mix()`, so it accepts hex values OR CSS
 * variables (e.g. `var(--accent-primary)`).
 *
 * Memoized: all props are primitives/stable nodes, so a row of stat cards only
 * re-renders the tiles whose data actually changed.
 */

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Accent for the value + icon chip. Hex or CSS variable. */
  color?: string;
  trend?: ReactNode;
  onClick?: () => void;
}

export const StatCard = memo(function StatCard({
  title,
  value,
  icon,
  color = 'var(--accent-primary)',
  trend,
  onClick,
}: StatCardProps) {
  const interactive = typeof onClick === 'function';

  const onKeyDown = interactive
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick!();
        }
      }
    : undefined;

  return (
    <div
      className="bento-card bento-card--static flex-1"
      style={{ '--bento-tint': color, minWidth: 0 } as CSSProperties}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="bento-card-label">
        {icon}
        {title}
      </span>
      <span className="bento-card-body">
        <span className="bento-card-value stat-figure">{value}</span>
      </span>
      {trend != null && (
        <span className="bento-card-caption">{trend}</span>
      )}
    </div>
  );
});
