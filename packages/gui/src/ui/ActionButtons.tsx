/**
 * ActionButtons Component — Responsive IC Theme with Dark Mode
 *
 * Unified button group for primary actions (Copy, Export, Apply, etc.)
 * in Infrastructure Control plane screens.
 *
 * Responsive: Full width mobile, inline desktop (flex-wrap for mobile)
 * Dark Mode: Complete color support with proper contrast on all variants
 * Accessibility: 44px minimum touch targets, focus indicators, disabled states
 */

import React from 'react';
import { Copy, Download, Check, Trash2, Edit, Eye } from 'lucide-react';

interface ActionButtonProps {
  /** Button label */
  label: string;
  /** Icon component */
  icon?: React.ComponentType<{ size: number; className?: string }>;
  /** Callback function */
  onClick: () => void;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Tooltip text */
  title?: string;
  /** Optional className */
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon: Icon,
  onClick,
  variant = 'secondary',
  disabled = false,
  title,
  className = '',
}) => {
  const baseClass = `
    flex items-center justify-center sm:justify-start gap-2
    px-3 sm:px-4 py-2 sm:py-2.5
    min-h-11 sm:min-h-12
    rounded-lg sm:rounded-xl
    text-sm sm:text-base
    font-medium
    whitespace-nowrap
    transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variantClass = {
    primary: `
      bg-blue-600 dark:bg-blue-600
      text-white dark:text-white
      hover:enabled:bg-blue-700 dark:hover:enabled:bg-blue-700
      focus:ring-blue-500 dark:focus:ring-blue-400
      shadow-sm dark:shadow-md
    `,
    secondary: `
      bg-gray-100 dark:bg-gray-700
      text-gray-900 dark:text-gray-100
      border border-gray-200 dark:border-gray-600
      hover:enabled:bg-gray-200 dark:hover:enabled:bg-gray-600
      focus:ring-gray-400 dark:focus:ring-gray-500
    `,
    danger: `
      bg-red-100 dark:bg-red-900/30
      text-red-700 dark:text-red-400
      border border-red-200 dark:border-red-700
      hover:enabled:bg-red-200 dark:hover:enabled:bg-red-900/50
      focus:ring-red-500 dark:focus:ring-red-400
    `,
    ghost: `
      bg-transparent dark:bg-transparent
      text-gray-600 dark:text-gray-400
      hover:enabled:bg-gray-100 dark:hover:enabled:bg-gray-700
      focus:ring-gray-300 dark:focus:ring-gray-600
    `,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title || label}
      className={`${baseClass} ${variantClass[variant]} ${className}`}
    >
      {Icon && <Icon size={18} className="flex-shrink-0" />}
      {label}
    </button>
  );
};

interface ActionButtonGroupProps {
  /** Array of action button configs */
  actions: ActionButtonProps[];
  /** Layout direction */
  direction?: 'row' | 'column';
  /** Optional className */
  className?: string;
}

export const ActionButtonGroup: React.FC<ActionButtonGroupProps> = ({
  actions,
  direction = 'row',
  className = '',
}) => {
  const directionClass = direction === 'row'
    ? 'flex-row flex-wrap sm:flex-nowrap'
    : 'flex-col';

  return (
    <div className={`
      flex ${directionClass}
      gap-2 sm:gap-3
      w-full
      ${className}
    `}>
      {actions.map((action, idx) => (
        <div key={idx} className="flex-1 sm:flex-auto min-w-full sm:min-w-fit">
          <ActionButton {...action} />
        </div>
      ))}
    </div>
  );
};

/**
 * Common action button presets with responsive + dark mode support
 */
export const CommonActions = {
  Copy: (onClick: () => void, disabled?: boolean): ActionButtonProps => ({
    label: 'Copy',
    icon: Copy,
    onClick,
    variant: 'secondary',
    disabled,
    title: 'Copy to clipboard',
  }),

  Export: (onClick: () => void, disabled?: boolean): ActionButtonProps => ({
    label: 'Export',
    icon: Download,
    onClick,
    variant: 'secondary',
    disabled,
    title: 'Export configuration',
  }),

  Apply: (onClick: () => void, disabled?: boolean): ActionButtonProps => ({
    label: 'Apply',
    icon: Check,
    onClick,
    variant: 'primary',
    disabled,
    title: 'Apply changes',
  }),

  Delete: (onClick: () => void, disabled?: boolean): ActionButtonProps => ({
    label: 'Delete',
    icon: Trash2,
    onClick,
    variant: 'danger',
    disabled,
    title: 'Delete this item',
  }),

  Edit: (onClick: () => void, disabled?: boolean): ActionButtonProps => ({
    label: 'Edit',
    icon: Edit,
    onClick,
    variant: 'secondary',
    disabled,
    title: 'Edit this item',
  }),

  View: (onClick: () => void, disabled?: boolean): ActionButtonProps => ({
    label: 'View',
    icon: Eye,
    onClick,
    variant: 'secondary',
    disabled,
    title: 'View details',
  }),
};

export default ActionButton;
