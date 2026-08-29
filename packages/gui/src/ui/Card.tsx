import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Card — the shared panel container (`.card`, which carries its own padding).
 *
 * Optionally renders the standard header (`.card-header` + `.card-title`) when
 * a `title` is given, with an `actions` slot pushed to the right by the
 * header's flex layout. Body content is rendered directly, so callers keep
 * full control of spacing (matching the existing `.card` usage). Kept as a
 * plain (non-memo) structural container: its `children` change on every
 * parent render, so memo would never bail out.
 */

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Renders a `.card-header` with a `.card-title`. Omit for a bare panel. */
  title?: ReactNode;
  /** Right-aligned header content (buttons, badges, meta). */
  actions?: ReactNode;
}

export function Card({ title, actions, className, children, ...rest }: CardProps) {
  const hasHeader = title != null || actions != null;
  return (
    <div className={className ? `card ${className}` : 'card'} {...rest}>
      {hasHeader && (
        <div className="card-header">
          {title != null ? <h3 className="card-title">{title}</h3> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
