/**
 * StatusIndicator Component — Responsive IC Theme with Dark Mode
 *
 * Unified status display component following Infrastructure Control plane design.
 * Shows status with indicator dot + text label (never color-only for accessibility).
 * Supports: Connected, Attention, Failed, Disabled, Not Verified
 *
 * Responsive: Adapts text size and padding for mobile/desktop
 * Dark Mode: Full color support with WCAG AAA contrast on all status types
 * Accessibility: Never uses color alone; always paired with text and dot symbol
 */

import React from 'react';

export type StatusType = 'connected' | 'attention' | 'failed' | 'disabled' | 'not-verified';

interface StatusIndicatorProps {
  /** Status type */
  status: StatusType;
  /** Optional label text (overrides default) */
  label?: string;
  /** Whether to show as inline badge */
  inline?: boolean;
  /** Optional className */
  className?: string;
}

const STATUS_CONFIG: Record<StatusType, {
  label: string;
  dot: string;
  lightColor: string;
  darkColor: string;
  lightBg: string;
  darkBg: string;
}> = {
  connected: {
    label: 'Connected',
    dot: '●',
    lightColor: 'text-green-600',
    darkColor: 'dark:text-green-400',
    lightBg: 'bg-green-50',
    darkBg: 'dark:bg-green-900/20',
  },
  attention: {
    label: 'Attention',
    dot: '●',
    lightColor: 'text-amber-600',
    darkColor: 'dark:text-amber-400',
    lightBg: 'bg-amber-50',
    darkBg: 'dark:bg-amber-900/20',
  },
  failed: {
    label: 'Failed',
    dot: '●',
    lightColor: 'text-red-600',
    darkColor: 'dark:text-red-400',
    lightBg: 'bg-red-50',
    darkBg: 'dark:bg-red-900/20',
  },
  disabled: {
    label: 'Disabled',
    dot: '○',
    lightColor: 'text-gray-500',
    darkColor: 'dark:text-gray-400',
    lightBg: 'bg-gray-100',
    darkBg: 'dark:bg-gray-700',
  },
  'not-verified': {
    label: 'Not Verified',
    dot: '●',
    lightColor: 'text-gray-500',
    darkColor: 'dark:text-gray-400',
    lightBg: 'bg-gray-100',
    darkBg: 'dark:bg-gray-700',
  },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  inline = false,
  className = '',
}) => {
  const config = STATUS_CONFIG[status];
  const displayLabel = label || config.label;

  if (inline) {
    return (
      <span className={`
        inline-flex items-center gap-1.5 sm:gap-2
        transition-colors duration-200
        ${className}
      `}
      role="status"
      aria-label={displayLabel}
      >
        <span className={`
          text-sm sm:text-base leading-none
          ${config.lightColor} ${config.darkColor}
          transition-colors duration-200
        `}>
          {config.dot}
        </span>
        <span className="
          text-xs sm:text-sm font-medium
          text-gray-700 dark:text-gray-300
          transition-colors duration-200
        ">
          {displayLabel}
        </span>
      </span>
    );
  }

  return (
    <div className={`
      inline-flex items-center gap-2 sm:gap-2.5
      px-3 sm:px-4 py-2 sm:py-2.5
      min-h-10 sm:min-h-11
      rounded-lg sm:rounded-xl
      ${config.lightBg} ${config.darkBg}
      border border-gray-200 dark:border-gray-600
      transition-colors duration-200
      ${className}
    `}
    role="status"
    aria-label={displayLabel}
    >
      <span className={`
        text-base sm:text-lg leading-none
        ${config.lightColor} ${config.darkColor}
        transition-colors duration-200
      `}>
        {config.dot}
      </span>
      <span className="
        text-xs sm:text-sm font-medium
        text-gray-700 dark:text-gray-300
        transition-colors duration-200
      ">
        {displayLabel}
      </span>
    </div>
  );
};

/**
 * StatusRow — displays status in a row context (e.g., table)
 * Responsive sizing and full dark mode support
 */
interface StatusRowProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export const StatusRow: React.FC<StatusRowProps> = ({ status, label, className = '' }) => {
  return (
    <StatusIndicator
      status={status}
      label={label}
      inline={false}
      className={className}
    />
  );
};

/**
 * StatusBadge — small inline status indicator
 * Compact sizing for dense layouts
 */
interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  return (
    <StatusIndicator
      status={status}
      label={label}
      inline={true}
      className={className}
    />
  );
};

export default StatusIndicator;
