/**
 * ActionButtons — IC Signature theme action button group.
 *
 * Renders a horizontal button group (primary + secondary buttons) at the
 * bottom of a pane or card. Responsive: wraps on mobile, stays inline on desktop.
 *
 * Primary action (e.g., "Export", "Apply") is emphasized. Secondary actions
 * (e.g., "Reset", "Help") are understated.
 */

import type { ReactNode } from 'react';

export interface ActionButtonsProps {
  /** Slots for button elements (typically <button>). */
  children: ReactNode;
  /** Optional left-aligned secondary content (e.g., status text). */
  leading?: ReactNode;
  /** CSS class for root customization. */
  className?: string;
}

export function ActionButtons({
  children,
  leading,
  className,
}: ActionButtonsProps) {
  return (
    <div className={className ? `ic-action-buttons ${className}` : 'ic-action-buttons'}>
      {leading && <div className="ic-action-buttons-leading">{leading}</div>}
      <div className="ic-action-buttons-content">{children}</div>
    </div>
  );
}
