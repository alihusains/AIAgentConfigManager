/**
 * DualPaneLayout Component
 *
 * IC Signature Theme: Responsive dual-pane layout container
 * Desktop: side-by-side (left controls + right preview)
 * Mobile: stacked vertically
 *
 * Design: Professional, minimal, high-contrast UI with efficient information density.
 * No breaking changes to existing components.
 */

import React, { ReactNode } from 'react';

export interface DualPaneLayoutProps {
  /** Content for the left/top pane (controls, filters, form) */
  controlsPanel: ReactNode;
  /** Content for the right/bottom pane (preview, details, results) */
  previewPane: ReactNode;
  /** Optional instructions or guidance content */
  instructions?: ReactNode;
  /** Layout mode: 'side' (desktop) or 'stack' (mobile/forced) */
  layout?: 'side' | 'stack';
  /** Responsive breakpoint: desktop default breakpoint */
  breakpoint?: 'sm' | 'md' | 'lg';
  /** Spacing between panes: comfortable visual separation */
  spacing?: 'compact' | 'normal' | 'comfortable';
  /** Optional className for the container */
  className?: string;
  /** Left pane minimum width (side layout) */
  controlsMinWidth?: string;
  /** Left pane flex basis (default: 40%) */
  controlsBasis?: string;
  /** Right pane flex basis (default: 60%) */
  previewBasis?: string;
}

/**
 * Map spacing token to Tailwind gap classes
 */
const spacingMap: Record<string, string> = {
  compact: 'gap-3',
  normal: 'gap-4 sm:gap-5 lg:gap-6',
  comfortable: 'gap-5 sm:gap-6 lg:gap-8',
};

/**
 * Map breakpoint to Tailwind responsive prefix
 */
const breakpointMap: Record<string, string> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export const DualPaneLayout = React.memo(function DualPaneLayout({
  controlsPanel,
  previewPane,
  instructions,
  layout = 'side',
  breakpoint = 'lg',
  spacing = 'normal',
  className = '',
  controlsMinWidth = 'min-w-[300px]',
  controlsBasis = '40%',
  previewBasis = '60%',
}: DualPaneLayoutProps) {
  const gapClass = spacingMap[spacing];
  const breakpointPrefix = breakpointMap[breakpoint];

  // Compute responsive flex direction based on layout preference
  const flexDirection = layout === 'stack' 
    ? 'flex-col' 
    : `flex-col ${breakpointPrefix}:flex-row`;

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Instructions section (optional, top-level) */}
      {instructions && (
        <div className="mb-6">
          {instructions}
        </div>
      )}

      {/* Main dual-pane container */}
      <div
        className={`flex ${flexDirection} ${gapClass} flex-1`}
        style={
          {
            '--controls-min-width': controlsMinWidth,
            '--controls-basis': controlsBasis,
            '--preview-basis': previewBasis,
          } as React.CSSProperties
        }
      >
        {/* Left/Top Pane: Controls */}
        <div
          className={`w-full ${breakpointPrefix}:w-[var(--controls-basis)] flex-shrink-0 flex flex-col ${controlsMinWidth}`}
          role="region"
          aria-label="Input controls"
        >
          {controlsPanel}
        </div>

        {/* Right/Bottom Pane: Preview */}
        <div
          className={`w-full ${breakpointPrefix}:w-[var(--preview-basis)] flex flex-col flex-grow min-h-[400px] ${breakpointPrefix}:min-h-auto`}
          role="region"
          aria-label="Live preview"
        >
          {previewPane}
        </div>
      </div>
    </div>
  );
});

DualPaneLayout.displayName = 'DualPaneLayout';
