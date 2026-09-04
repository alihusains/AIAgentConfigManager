/**
 * StatusIndicator — IC Signature theme feedback + status display.
 *
 * Shows "Last updated: 5m ago", "Sync in progress", "Error", or similar
 * transient feedback. Uses semantic color and optional animated dot for
 * live/syncing state.
 *
 * Variants:
 * - "idle": gray, no animation (default)
 * - "syncing": blue, animated dot
 * - "success": green, static check
 * - "error": red, warning icon
 */

import { memo, ReactNode } from 'react';

export type StatusIndicatorVariant = 'idle' | 'syncing' | 'success' | 'error';

export interface StatusIndicatorProps {
  variant?: StatusIndicatorVariant;
  label: string;
  /** Optional icon (appears before the label). */
  icon?: ReactNode;
  className?: string;
}

export const StatusIndicator = memo(function StatusIndicator({
  variant = 'idle',
  label,
  icon,
  className,
}: StatusIndicatorProps) {
  const variantClass = `ic-status-indicator-${variant}`;
  return (
    <div
      className={
        className
          ? `ic-status-indicator ${variantClass} ${className}`
          : `ic-status-indicator ${variantClass}`
      }
    >
      {variant === 'syncing' && <span className="ic-status-dot ic-status-dot-pulse" />}
      {icon && <span className="ic-status-icon">{icon}</span>}
      <span className="ic-status-label">{label}</span>
    </div>
  );
});
