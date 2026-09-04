/**
 * ControlPanel — IC Signature theme left pane container.
 *
 * Organizes filters, toggles, date ranges, and other user controls into
 * logical sections. Uses FormSection sub-components for consistent spacing
 * and visual hierarchy. Dark theme aware, responsive.
 *
 * Minimal chrome: just structured spacing and subdued section borders.
 * Everything is semantic and label-forward.
 */

import type { ReactNode } from 'react';

export interface ControlPanelProps {
  children: ReactNode;
  /** Optional heading displayed above the controls. */
  title?: string;
  /** CSS class for root customization. */
  className?: string;
}

export function ControlPanel({ children, title, className }: ControlPanelProps) {
  return (
    <div className={className ? `ic-control-panel ${className}` : 'ic-control-panel'}>
      {title && <h3 className="ic-control-panel-title">{title}</h3>}
      {children}
    </div>
  );
}

/* FormSection: A logical grouping of related controls (e.g., "Date Range", "Filters"). */
export interface FormSectionProps {
  /** Visible section heading. */
  label: string;
  /** The controls / inputs for this section. */
  children: ReactNode;
  /** Hint or description text (optional). */
  hint?: string;
  /** CSS class for customization. */
  className?: string;
}

export function FormSection({
  label,
  children,
  hint,
  className,
}: FormSectionProps) {
  return (
    <fieldset className={className ? `ic-form-section ${className}` : 'ic-form-section'}>
      <legend className="ic-form-section-label">{label}</legend>
      {hint && <span className="ic-form-section-hint">{hint}</span>}
      <div className="ic-form-section-content">{children}</div>
    </fieldset>
  );
}
