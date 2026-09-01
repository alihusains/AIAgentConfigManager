import { type ButtonHTMLAttributes, type ReactNode, forwardRef, memo } from 'react';
import { Tooltip } from './Tooltip';

/**
 * Button — typed wrapper over the shared `.btn .btn-*` CSS.
 *
 * Forwards refs and spreads native button attributes, so it drops in anywhere
 * a `<button>` is used. `loading` swaps the leading icon for a small spinner
 * and disables the control. Memoized + forwardRef keeps it cheap and stable.
 *
 * `title` renders as the styled Tooltip (audit A9) — themeable and visible
 * on touch — while keeping the native attribute as a queryable/AT fallback.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon element rendered before the label. */
  icon?: ReactNode;
  /** Disables the button and shows a spinner in place of the icon. */
  loading?: boolean;
}

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
      variant = 'secondary',
      size = 'md',
      icon,
      loading = false,
      className,
      children,
      disabled,
      type = 'button',
      title,
      ...rest
    },
    ref
  ) {
    const classes = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className ?? '']
      .filter(Boolean)
      .join(' ');

    const button = (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        title={title}
        {...rest}
      >
        {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : icon}
        {children}
      </button>
    );

    // Audit A9: styled tooltip when a hint is given; Tooltip is wrapper-less
    // so the DOM layout is unchanged, and it mirrors the string back into
    // the native title attribute (queryable + AT fallback).
    return title ? <Tooltip content={title}>{button}</Tooltip> : button;
  })
);
