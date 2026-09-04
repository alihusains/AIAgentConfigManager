/**
 * PreviewPane Component — Responsive IC Theme with Dark Mode
 *
 * Right pane container for details, previews, and metadata in dual-pane layouts.
 * Provides consistent styling, empty states, and content hierarchy.
 *
 * Responsive: Full width mobile, right sidebar desktop (min-height maintains space)
 * Dark Mode: Full color support with WCAG AAA contrast ratios
 * Accessibility: Clear empty states, semantic structure, focus management
 */

import React, { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

interface PreviewPaneProps {
  /** Content to display in the preview pane */
  children?: ReactNode;
  /** Optional title */
  title?: string;
  /** Whether the pane is empty (no selection) */
  isEmpty?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state icon or visual */
  emptyIcon?: ReactNode;
  /** Optional className for additional styling */
  className?: string;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  children,
  title,
  isEmpty = false,
  emptyMessage = 'Select an item to view details',
  emptyIcon,
  className = '',
}) => {
  return (
    <div className={`
      flex flex-col gap-4 sm:gap-5 lg:gap-6
      w-full
      p-4 sm:p-5 lg:p-6
      bg-white dark:bg-gray-850
      border border-gray-200 dark:border-gray-700
      rounded-lg sm:rounded-xl
      min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]
      transition-colors duration-200
      ${className}
    `}>
      {title && (
        <h3 className="
          text-base sm:text-lg
          font-semibold
          text-gray-900 dark:text-white
          mb-2 sm:mb-3
          transition-colors duration-200
        ">
          {title}
        </h3>
      )}

      {isEmpty ? (
        <div className="
          flex-1 flex items-center justify-center
          min-h-[250px] sm:min-h-[350px] lg:min-h-[450px]
        ">
          <EmptyState
            icon={emptyIcon}
            title="No Selection"
            message={emptyMessage}
          />
        </div>
      ) : (
        <div className="
          flex flex-col gap-4 sm:gap-5 lg:gap-6
          overflow-y-auto
          pr-2 sm:pr-3
          max-h-[calc(100vh-300px)]
        ">
          {children}
        </div>
      )}
    </div>
  );
};

export default PreviewPane;
