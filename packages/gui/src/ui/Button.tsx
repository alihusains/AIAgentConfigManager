import {
  forwardRef,
  memo,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';

/**
 * Button — typed wrapper over the shared `.btn .btn-*` CSS.
 *
 * Forwards refs and spreads native button attributes, so it drops in anywhere
 * a `<button>` is used. `loading` swaps the leading icon for a small spinner
 * and disables the control. Memoized + forwardRef keeps it cheap and stable.
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
      ...rest
    },
    ref
  ) {
    const classes = [
      'btn',
      `btn-${variant}`,
      size === 'sm' ? 'btn-sm' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : icon}
        {children}
      </button>
    );
  })
);
