import { memo, type ReactNode } from 'react';

/**
 * Badge — a tinted status pill.
 *
 * Thin, memoized wrapper over the shared `.badge .badge-*` CSS so callers get
 * a typed `variant` prop instead of hand-joining class strings. Renders a
 * `<span>`; costs essentially nothing and bails out of re-renders via memo.
 */

export type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'chat'
  | 'responses'
  | 'anthropic';

export interface BadgeProps {
  variant?: BadgeVariant;
  /** Render the pulsing live-dot before the label. */
  dot?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

export const Badge = memo(function Badge({
  variant = 'neutral',
  dot = false,
  title,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={className ? `badge badge-${variant} ${className}` : `badge badge-${variant}`}
      title={title}
    >
      {dot && <span className="live-dot" />}
      {children}
    </span>
  );
});
