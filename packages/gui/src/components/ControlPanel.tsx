/**
 * ControlPanel Component
 *
 * IC Signature Theme: Container for organized form controls and input groups
 * Provides consistent styling, spacing, and section dividers.
 *
 * Design: Subtle background, padding, and border for visual containment.
 * No breaking changes to existing components.
 */

import React, { ReactNode } from 'react';

export interface ControlPanelProps {
  /** Panel content (form controls, filters, inputs) */
  children: ReactNode;
  /** Optional panel title */
  title?: string;
  /** Optional panel description */
  description?: string;
  /** Optional className for additional styling */
  className?: string;
}

/**
 * ControlPanel — main container for control groups
 */
export const ControlPanel = React.memo(function ControlPanel({
  children,
  title,
  description,
  className = '',
}: ControlPanelProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Optional header */}
      {(title || description) && (
        <div className="pb-3 border-b border-border">
          {title && (
            <h3 className="text-sm font-semibold text-primary mb-1">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-xs text-secondary">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Control groups */}
      <div className="flex flex-col gap-4">
        {children}
      </div>
    </div>
  );
});

ControlPanel.displayName = 'ControlPanel';

/**
 * ControlGroup — a single logical group of controls (e.g., filters, section)
 */
export interface ControlGroupProps {
  /** Group label (uppercase, semibold) */
  label?: string;
  /** Group content */
  children: ReactNode;
  /** Optional helper text below label */
  description?: string;
  /** Optional className */
  className?: string;
  /** Show divider above group */
  showDivider?: boolean;
}

export const ControlGroup = React.memo(function ControlGroup({
  label,
  children,
  description,
  className = '',
  showDivider = false,
}: ControlGroupProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Divider (optional) */}
      {showDivider && <div className="h-px bg-border my-1" />}

      {/* Label */}
      {label && (
        <div>
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
            {label}
          </label>
          {description && (
            <p className="text-xs text-tertiary mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Children (inputs, selects, toggles, etc.) */}
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
});

ControlGroup.displayName = 'ControlGroup';
