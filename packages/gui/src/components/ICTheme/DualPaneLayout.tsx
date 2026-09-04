/**
 * DualPaneLayout — IC Signature theme master layout.
 *
 * Responsive dual-pane container: side-by-side on desktop (lg), stacked
 * on mobile/tablet. Enforces the IC theme's professional aesthetic with
 * clean borders, spacing, and a seamless mobile-to-desktop transition.
 *
 * Combines a left/top control pane (filters, toggles, inputs) with a
 * right/bottom preview pane (live metrics, results, feedback). Perfect for
 * dashboards, config tools, and live-preview workflows.
 *
 * Children passed as `controlPane` and `previewPane` render in the
 * appropriate sections with no additional wrappers, giving full layout control.
 */

import type { ReactNode } from 'react';

export interface DualPaneLayoutProps {
  /** Left pane (desktop) / top pane (mobile) — filters, controls, inputs. */
  controlPane: ReactNode;
  /** Right pane (desktop) / bottom pane (mobile) — preview, metrics, results. */
  previewPane: ReactNode;
  /** Optional header above both panes (title, nav, breadcrumbs). */
  header?: ReactNode;
  /** Optional footer below both panes (instructions, hints, metadata). */
  footer?: ReactNode;
  /** CSS class for the root container (for custom theming or overrides). */
  className?: string;
}

export function DualPaneLayout({
  controlPane,
  previewPane,
  header,
  footer,
  className,
}: DualPaneLayoutProps) {
  return (
    <div
      className={
        className
          ? `ic-dual-pane-layout ${className}`
          : 'ic-dual-pane-layout'
      }
    >
      {/* Header section (if provided) */}
      {header && <div className="ic-dual-pane-header">{header}</div>}

      {/* Main dual-pane container */}
      <div className="ic-dual-pane-container">
        {/* Left / Top: Control pane (filters, form, toggles) */}
        <div className="ic-pane ic-pane-control">{controlPane}</div>

        {/* Right / Bottom: Preview pane (live metrics, results) */}
        <div className="ic-pane ic-pane-preview">{previewPane}</div>
      </div>

      {/* Footer section (if provided) */}
      {footer && <div className="ic-dual-pane-footer">{footer}</div>}
    </div>
  );
}
