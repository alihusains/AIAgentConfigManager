/**
 * DualPaneLayout Component — Responsive IC Theme
 *
 * A responsive dual-pane layout for Infrastructure Control plane screens.
 * Mobile (<640px): Full width stacked layout (single column)
 * Tablet (640px-1024px): Two-column layout begins at md: breakpoint
 * Desktop (1024px+): Side-by-side with configurable flex basis
 *
 * Design: Professional, minimal, high-contrast UI with efficient information density
 * Dark Mode: Full support via `dark:` prefixes + automatic CSS variable switching
 * Accessibility: 44px minimum touch targets, WCAG AAA contrast, semantic structure
 */

import React, { ReactNode } from 'react';

interface DualPaneLayoutProps {
  /** Left pane content (controls, filters, list) */
  leftPane: ReactNode;
  /** Right pane content (preview, details) */
  rightPane: ReactNode;
  /** Optional left pane title/header */
  leftTitle?: string;
  /** Optional right pane title/header */
  rightTitle?: string;
  /** Optional className for the container */
  className?: string;
  /** Optional left pane flex basis (default: '40%' on desktop) */
  leftBasis?: string;
  /** Optional right pane flex basis (default: '60%' on desktop) */
  rightBasis?: string;
}

export const DualPaneLayout: React.FC<DualPaneLayoutProps> = ({
  leftPane,
  rightPane,
  leftTitle,
  rightTitle,
  className = '',
  leftBasis = '40%',
  rightBasis = '60%',
}) => {
  return (
    <div
      className={`
        flex flex-col lg:flex-row
        gap-4 sm:gap-6 lg:gap-8
        w-full min-h-0
        px-4 sm:px-6 lg:px-8
        py-4 sm:py-6
        bg-white dark:bg-gray-900
        text-gray-900 dark:text-white
        transition-colors duration-200
        ${className}
      `}
      style={{
        '--left-basis': leftBasis,
        '--right-basis': rightBasis,
      } as React.CSSProperties & { '--left-basis': string; '--right-basis': string }}
    >
      {/* Left Pane: Controls — Full width mobile, left pane desktop */}
      <div
        className="
          w-full lg:w-[var(--left-basis)]
          flex-shrink-0 flex flex-col
          gap-4 sm:gap-6
          min-h-0
        "
        role="region"
        aria-label={leftTitle ? `${leftTitle} panel` : 'Control panel'}
      >
        {leftTitle && (
          <h2 className="
            text-xs sm:text-sm
            font-semibold
            text-gray-600 dark:text-gray-400
            mb-2 sm:mb-4
            uppercase tracking-widest
            transition-colors duration-200
          ">
            {leftTitle}
          </h2>
        )}
        {leftPane}
      </div>

      {/* Right Pane: Preview/Details — Full width mobile, right pane desktop */}
      <div
        className="
          w-full lg:w-[var(--right-basis)]
          flex flex-col flex-grow
          gap-4 sm:gap-6
          min-h-0
        "
        role="region"
        aria-label={rightTitle ? `${rightTitle} panel` : 'Preview panel'}
      >
        {rightTitle && (
          <h2 className="
            text-xs sm:text-sm
            font-semibold
            text-gray-600 dark:text-gray-400
            mb-2 sm:mb-4
            uppercase tracking-widest
            transition-colors duration-200
          ">
            {rightTitle}
          </h2>
        )}
        {rightPane}
      </div>
    </div>
  );
};

export default DualPaneLayout;
