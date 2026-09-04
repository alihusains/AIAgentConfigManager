/**
 * BannerToggle Component
 *
 * IC Signature Theme: Visual on/off toggle for features or options
 * Provides clear visual states and accessible control.
 *
 * Design: Professional, high-contrast, smooth transitions (no jarring animations).
 * No breaking changes to existing components.
 */

import React from 'react';

export interface BannerToggleProps {
  /** Current toggle state */
  enabled: boolean;
  /** Callback when state changes */
  onChange: (enabled: boolean) => void;
  /** Toggle label */
  label: string;
  /** Optional description/helper text */
  description?: string;
  /** Optional className */
  className?: string;
  /** Whether toggle is disabled */
  disabled?: boolean;
  /** Custom icons: [on, off] */
  icons?: [ReactNode, ReactNode];
}

type ReactNode = React.ReactNode;

export const BannerToggle = React.memo(function BannerToggle({
  enabled,
  onChange,
  label,
  description,
  className = '',
  disabled = false,
  icons,
}: BannerToggleProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!enabled);
    }
  };

  return (
    <div className={`flex items-start gap-4 ${className}`}>
      {/* Toggle switch */}
      <button
        onClick={handleClick}
        disabled={disabled}
        role="switch"
        aria-checked={enabled}
        className={`relative flex-shrink-0 inline-flex h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent ${
          enabled ? 'bg-success' : 'bg-secondary'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {/* Switch thumb */}
        <span
          className={`inline-block h-5 w-5 rounded-full bg-primary shadow-md transition-transform duration-200 ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>

      {/* Label and description */}
      <div className="flex-1 min-w-0 pt-0.5">
        <label
          className={`text-sm font-medium cursor-pointer ${
            disabled ? 'text-tertiary cursor-not-allowed' : 'text-primary'
          }`}
          onClick={handleClick}
        >
          <span className="inline-flex items-center gap-2">
            {icons && (
              <span className="flex-shrink-0">
                {enabled ? icons[0] : icons[1]}
              </span>
            )}
            {label}
            {enabled && (
              <span className="inline-flex px-2 py-0.5 rounded-full bg-success/10 text-xs text-success font-semibold">
                On
              </span>
            )}
            {!enabled && (
              <span className="inline-flex px-2 py-0.5 rounded-full bg-tertiary/20 text-xs text-tertiary font-semibold">
                Off
              </span>
            )}
          </span>
        </label>

        {description && (
          <p className={`text-xs mt-1 ${disabled ? 'text-tertiary' : 'text-secondary'}`}>
            {description}
          </p>
        )}
      </div>

      {/* State indicator */}
      <div className="flex-shrink-0 text-xs font-semibold text-secondary uppercase tracking-wide pt-0.5">
        {enabled ? '✓' : '—'}
      </div>
    </div>
  );
});

BannerToggle.displayName = 'BannerToggle';
