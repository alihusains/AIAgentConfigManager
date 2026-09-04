/**
 * StatusIndicator Component
 *
 * IC Signature Theme: Feedback messages for user actions
 * States: success (green + checkmark), error (red + X), info (blue + icon), copied (gold flash)
 *
 * Design: High-contrast, accessible, never color-only (always includes icon + text).
 * No breaking changes to existing components.
 */

import React, { ReactNode, useEffect, useState } from 'react';

export type StatusType = 'success' | 'error' | 'info' | 'warning' | 'copied';

export interface StatusIndicatorProps {
  /** Status type */
  status: StatusType;
  /** Status message/label */
  message: string;
  /** Auto-dismiss duration in ms (0 = never) */
  duration?: number;
  /** Icon or visual element */
  icon?: ReactNode;
  /** Optional className */
  className?: string;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

const statusConfig: Record<StatusType, { icon: string; bgColor: string; textColor: string; borderColor: string }> = {
  success: {
    icon: '✓',
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    borderColor: 'border-success/30',
  },
  error: {
    icon: '✕',
    bgColor: 'bg-error/10',
    textColor: 'text-error',
    borderColor: 'border-error/30',
  },
  info: {
    icon: 'ⓘ',
    bgColor: 'bg-info/10',
    textColor: 'text-info',
    borderColor: 'border-info/30',
  },
  warning: {
    icon: '⚠',
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/30',
  },
  copied: {
    icon: '✓',
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    borderColor: 'border-success/30',
  },
};

export const StatusIndicator = React.memo(function StatusIndicator({
  status,
  message,
  duration = 3000,
  icon,
  className = '',
  onDismiss,
}: StatusIndicatorProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after duration
  useEffect(() => {
    if (duration === 0) return;

    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  const config = statusConfig[status];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}
      role="alert"
    >
      {/* Icon */}
      <span className={`flex-shrink-0 text-lg font-bold ${config.textColor}`}>
        {icon || config.icon}
      </span>

      {/* Message */}
      <span className={`text-sm font-medium ${config.textColor}`}>
        {message}
      </span>
    </div>
  );
});

StatusIndicator.displayName = 'StatusIndicator';

/**
 * StatusBadge — inline status badge (no message, compact)
 */
export interface StatusBadgeProps {
  /** Status type */
  status: StatusType;
  /** Optional label */
  label?: string;
  /** Optional className */
  className?: string;
}

export const StatusBadge = React.memo(function StatusBadge({
  status,
  label,
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const labels: Record<StatusType, string> = {
    success: 'Success',
    error: 'Error',
    info: 'Info',
    warning: 'Warning',
    copied: 'Copied!',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
    >
      <span className="font-bold">{config.icon}</span>
      {label || labels[status]}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

/**
 * StatusRow — full-width status row (for tables, lists)
 */
export interface StatusRowProps {
  /** Status type */
  status: StatusType;
  /** Optional label */
  label?: string;
  /** Optional description */
  description?: string;
  /** Optional className */
  className?: string;
}

export const StatusRow = React.memo(function StatusRow({
  status,
  label,
  description,
  className = '',
}: StatusRowProps) {
  const config = statusConfig[status];
  const labels: Record<StatusType, string> = {
    success: 'Success',
    error: 'Error',
    info: 'Info',
    warning: 'Warning',
    copied: 'Copied!',
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}
      role="status"
    >
      <span className={`flex-shrink-0 text-lg font-bold ${config.textColor}`}>
        {config.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${config.textColor}`}>
          {label || labels[status]}
        </div>
        {description && (
          <p className="text-xs text-secondary mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
});

StatusRow.displayName = 'StatusRow';
