/**
 * PreviewPane — IC Signature theme right pane container for live metrics/results.
 *
 * Displays live-updating dashboard metrics, stats, or preview content. Uses
 * a clean card-based layout with high contrast for readability. Responsive:
 * stacks on mobile, side-by-side on desktop.
 *
 * Works well for:
 * - Real-time metric displays
 * - Live previews (email signatures, configs)
 * - Comparison views (before/after, options)
 * - Status dashboards
 */

import type { ReactNode } from 'react';

export interface PreviewPaneProps {
  children: ReactNode;
  /** Optional heading displayed above the preview content. */
  title?: string;
  /** Metadata line (e.g., "Last updated: 2s ago", "Live"). */
  subtitle?: string;
  /** CSS class for root customization. */
  className?: string;
}

export function PreviewPane({
  children,
  title,
  subtitle,
  className,
}: PreviewPaneProps) {
  return (
    <div className={className ? `ic-preview-pane ${className}` : 'ic-preview-pane'}>
      {(title || subtitle) && (
        <div className="ic-preview-pane-header">
          {title && <h3 className="ic-preview-pane-title">{title}</h3>}
          {subtitle && <span className="ic-preview-pane-subtitle">{subtitle}</span>}
        </div>
      )}
      <div className="ic-preview-pane-content">{children}</div>
    </div>
  );
}
