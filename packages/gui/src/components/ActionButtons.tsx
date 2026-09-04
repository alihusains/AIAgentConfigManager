/**
 * ActionButtons Component
 *
 * IC Signature Theme: Primary and secondary action buttons
 * Variants: primary (filled, branded), secondary (outlined), ghost (minimal)
 * States: default, hover, active, disabled
 *
 * Design: Professional, high-contrast, efficient visual feedback.
 * No breaking changes to existing components.
 */

import React, { ReactNode } from 'react';

export interface ActionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Button label/text */
  children: ReactNode;
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Left-side icon */
  icon?: ReactNode;
  /** Right-side icon */
  iconRight?: ReactNode;
  /** Show loading spinner */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-accent text-inverse hover:bg-primary-hover active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg',
  secondary:
    'bg-secondary text-primary border border-border hover:bg-border active:bg-border disabled:opacity-60 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-accent hover:bg-accent/10 active:bg-accent/20 disabled:opacity-60 disabled:cursor-not-allowed',
  danger:
    'bg-error/90 text-inverse hover:bg-error active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium gap-1.5',
  md: 'px-4 py-2 text-sm font-medium gap-2',
  lg: 'px-6 py-3 text-base font-semibold gap-2',
};

export const ActionButton = React.memo(React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    {
      children,
      variant = 'secondary',
      size = 'md',
      icon,
      iconRight,
      loading = false,
      fullWidth = false,
      disabled = false,
      className = '',
      ...rest
    },
    ref
  ) {
    const baseClass =
      'inline-flex items-center justify-center rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent';
    const widthClass = fullWidth ? 'w-full' : '';
    const variantClass = variantStyles[variant];
    const sizeClass = sizeStyles[size];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClass} ${sizeClass} ${variantClass} ${widthClass} ${className}`}
        {...rest}
      >
        {loading ? (
          <>
            <span className="inline-flex w-4 h-4 rounded-full border-2 border-transparent border-t-current animate-spin" />
          </>
        ) : (
          <>
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span>{children}</span>
            {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
          </>
        )}
      </button>
    );
  }
));

ActionButton.displayName = 'ActionButton';

/**
 * ActionButtonGroup — container for multiple action buttons
 */
export interface ActionButtonGroupProps {
  /** Child buttons */
  children: ReactNode;
  /** Layout direction */
  direction?: 'row' | 'column';
  /** Spacing between buttons */
  spacing?: 'compact' | 'normal' | 'comfortable';
  /** Optional className */
  className?: string;
}

const spacingMap: Record<string, string> = {
  compact: 'gap-2',
  normal: 'gap-3',
  comfortable: 'gap-4',
};

export const ActionButtonGroup = React.memo(function ActionButtonGroup({
  children,
  direction = 'row',
  spacing = 'normal',
  className = '',
}: ActionButtonGroupProps) {
  const directionClass = direction === 'row' ? 'flex-row' : 'flex-col';
  const spacingClass = spacingMap[spacing];

  return (
    <div
      className={`flex ${directionClass} ${spacingClass} flex-wrap items-center ${className}`}
    >
      {children}
    </div>
  );
});

ActionButtonGroup.displayName = 'ActionButtonGroup';

/**
 * Common action button presets
 */
export const CommonActions = {
  /**
   * Copy to clipboard button
   */
  copy: (label = 'Copy') => ({
    variant: 'secondary' as const,
    children: label,
  }),

  /**
   * Primary submit/apply button
   */
  apply: (label = 'Apply') => ({
    variant: 'primary' as const,
    children: label,
  }),

  /**
   * Export/download button
   */
  export: (label = 'Export') => ({
    variant: 'secondary' as const,
    children: label,
  }),

  /**
   * Delete/danger button
   */
  delete: (label = 'Delete') => ({
    variant: 'danger' as const,
    children: label,
  }),

  /**
   * Reset button
   */
  reset: (label = 'Reset') => ({
    variant: 'ghost' as const,
    children: label,
  }),

  /**
   * Cancel button
   */
  cancel: (label = 'Cancel') => ({
    variant: 'ghost' as const,
    children: label,
  }),

  /**
   * Help/info button
   */
  help: (label = 'Help') => ({
    variant: 'ghost' as const,
    children: label,
  }),
};
