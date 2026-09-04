/**
 * PreviewPane Component
 *
 * IC Signature Theme: Container for live preview and results
 * Real-time updates with no animations (pure speed, efficiency).
 * Elevated card style for visual separation.
 *
 * Design: Professional, minimal presentation with responsive sizing.
 * No breaking changes to existing components.
 */

import React, { ReactNode } from 'react';

export interface PreviewPaneProps {
  /** Preview content (mockup, results, details) */
  children?: ReactNode;
  /** Optional title/heading */
  title?: string;
  /** Preview mode or context label */
  previewMode?: string;
  /** Whether pane is in empty state */
  isEmpty?: boolean;
  /** Message to show when empty */
  emptyMessage?: string;
  /** Icon/visual for empty state */
  emptyIcon?: ReactNode;
  /** Optional className */
  className?: string;
  /** Show as elevated card (default: true) */
  elevated?: boolean;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Loading message */
  loadingMessage?: string;
}

export const PreviewPane = React.memo(function PreviewPane({
  children,
  title,
  previewMode,
  isEmpty = false,
  emptyMessage = 'Select an item to view preview',
  emptyIcon,
  className = '',
  elevated = true,
  isLoading = false,
  loadingMessage = 'Loading preview...',
}: PreviewPaneProps) {
  const cardStyle = elevated 
    ? 'card card-elevated bg-primary border border-border rounded-lg' 
    : '';

  return (
    <div className={`flex flex-col gap-4 h-full ${className}`}>
      {/* Header */}
      {(title || previewMode) && (
        <div className="pb-3 border-b border-border">
          <div className="flex items-baseline justify-between gap-4">
            {title && (
              <h3 className="text-sm font-semibold text-primary">
                {title}
              </h3>
            )}
            {previewMode && (
              <span className="text-xs text-tertiary uppercase tracking-wide">
                {previewMode}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      {isLoading ? (
        // Loading state
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary/20 mb-3">
              <div className="w-6 h-6 border-2 border-transparent border-t-accent border-r-accent rounded-full animate-spin" />
            </div>
            <p className="text-sm text-secondary">{loadingMessage}</p>
          </div>
        </div>
      ) : isEmpty ? (
        // Empty state
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            {emptyIcon && (
              <div className="mb-4 flex justify-center opacity-60">
                {emptyIcon}
              </div>
            )}
            <p className="text-sm font-medium text-secondary mb-1">
              No Preview Available
            </p>
            <p className="text-xs text-tertiary">
              {emptyMessage}
            </p>
          </div>
        </div>
      ) : (
        // Content
        <div className={`flex-1 flex flex-col gap-4 overflow-auto ${cardStyle}`}>
          {children}
        </div>
      )}
    </div>
  );
});

PreviewPane.displayName = 'PreviewPane';
