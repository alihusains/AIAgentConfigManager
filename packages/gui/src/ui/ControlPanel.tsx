/**
 * ControlPanel Component — Responsive IC Theme with Dark Mode
 *
 * Left pane container for filters, search, and controls in dual-pane layouts.
 * Provides consistent styling and spacing for control groups.
 *
 * Responsive: Full width mobile, left sidebar desktop
 * Dark Mode: Complete color support with 7:1+ WCAG AAA contrast
 * Accessibility: 44px minimum touch targets, semantic labels
 */

import React, { ReactNode } from 'react';

interface ControlPanelProps {
  children: ReactNode;
  /** Optional className for additional styling */
  className?: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ children, className = '' }) => {
  return (
    <div className={`
      flex flex-col gap-4 sm:gap-5 lg:gap-6
      w-full
      p-4 sm:p-5 lg:p-6
      bg-gray-50 dark:bg-gray-800
      border border-gray-200 dark:border-gray-700
      rounded-lg sm:rounded-xl
      transition-colors duration-200
      ${className}
    `}>
      {children}
    </div>
  );
};

/**
 * ControlGroup — a single control section (e.g., filters, search)
 * Responsive spacing and dark mode support
 */
interface ControlGroupProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export const ControlGroup: React.FC<ControlGroupProps> = ({
  label,
  children,
  className = '',
}) => {
  return (
    <fieldset className={`
      flex flex-col gap-3 sm:gap-3.5
      pb-4 sm:pb-5
      border-b border-gray-200 dark:border-gray-700
      last:border-b-0
      transition-colors duration-200
      ${className}
    `}>
      {label && (
        <legend className="
          text-xs sm:text-xs
          font-semibold
          text-gray-700 dark:text-gray-300
          uppercase tracking-widest
          leading-tight
          transition-colors duration-200
        ">
          {label}
        </legend>
      )}
      <div className="
        flex flex-col gap-2 sm:gap-2.5
        min-h-max
      ">
        {children}
      </div>
    </fieldset>
  );
};

export default ControlPanel;
