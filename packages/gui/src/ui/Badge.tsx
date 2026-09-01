import { type ReactElement, type ReactNode, isValidElement, memo } from 'react';
import { Tooltip } from './Tooltip';

/**
 * Badge — a tinted status pill.
 *
 * Thin, memoized wrapper over the shared `.badge .badge-*` CSS so callers get
 * a typed `variant` prop instead of hand-joining class strings. Renders a
 * `<span>`; costs essentially nothing and bails out of re-renders via memo.
 *
 * `title` renders as the styled Tooltip (themeable, touch-capable — audit A9)
 * instead of a native title attribute: the badge keeps the native attribute
 * as a queryable/AT fallback, and gains hover/focus/long-press behavior.
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
  const span = (
    <span
      className={className ? `badge badge-${variant} ${className}` : `badge badge-${variant}`}
      title={title}
    >
      {dot && <span className="live-dot" />}
      {children}
    </span>
  );
  // Audit A9: styled tooltip instead of native-title-only. isValidElement
  // narrows span to ReactElement for Tooltip's children type.
  return title && isValidElement(span) ? (
    <Tooltip content={title}>{span as ReactElement}</Tooltip>
  ) : (
    span
  );
});
