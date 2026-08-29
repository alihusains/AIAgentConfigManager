import { memo, type ReactNode } from 'react';

/**
 * EmptyState — the shared zero-data placeholder (`.empty-state`).
 *
 * Standard vertical stack: large icon, title, message, optional action row.
 * Memoized; props are stable nodes/primitives so it bails out cleanly.
 */

export interface EmptyStateProps {
  /** Large icon element (e.g. `<Bot size={64} />`). */
  icon?: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  /** Action buttons rendered below the message. */
  action?: ReactNode;
  className?: string;
}

export const EmptyState = memo(function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={className ? `empty-state ${className}` : 'empty-state'}>
      {icon != null && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      {message != null && <p className="empty-state-message">{message}</p>}
      {action != null && <div className="empty-state-action">{action}</div>}
    </div>
  );
});
