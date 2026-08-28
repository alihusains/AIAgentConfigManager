import { memo, type KeyboardEvent, type ReactNode } from 'react';

/**
 * StatCard — a KPI tile: label, big tinted value, optional trend line and an
 * icon chip tinted to match.
 *
 * The icon chip uses `color-mix()` so `color` can be a hex value OR a CSS
 * variable (e.g. `var(--accent-info)`); the previous `${color}15` trick only
 * worked for hex and silently produced invalid CSS for variables.
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
      className="card flex-1 stat-card-hover"
      style={{ minWidth: 0, cursor: interactive ? 'pointer' : undefined }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-secondary text-sm truncate">{title}</p>
          <p className="stat-value mt-1.5" style={{ color }}>
            {value}
          </p>
          {trend != null && <p className="text-xs text-success mt-1.5 truncate">{trend}</p>}
        </div>
        {icon != null && (
          <div
            className="p-2 rounded-lg flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
});
