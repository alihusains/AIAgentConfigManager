import { type ReactNode, memo } from 'react';
import { Tooltip } from './Tooltip';

/**
 * Toggle — the shared on/off switch (`.switch` / `.switch-row`).
 *
 * Renders an accessible `<button role="switch">`. With a `label` it uses the
 * `.switch-row` layout (switch + text); without one it renders the bare switch.
 * Memoized: props are primitives/stable, so lists of toggles only re-render
 * the ones whose state changed.
 *
 * `title` renders as the styled Tooltip (audit A9) — themeable and visible
 * on touch, unlike the native attribute — while keeping the native attribute
 * as a queryable/AT fallback.
 */

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  disabled?: boolean;
  title?: string;
}

export const Toggle = memo(function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  title,
}: ToggleProps) {
  const handleClick = () => {
    if (!disabled) onChange(!checked);
  };

  const switchEl = (
    <span className={checked ? 'switch switch-on' : 'switch'} aria-hidden="true">
      <span className="switch-thumb" />
    </span>
  );

  if (label == null && description == null) {
    return (
      <Tooltip content={title} disabled={!title}>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          className="switch-row"
          onClick={handleClick}
          disabled={disabled}
          title={title}
          style={{ gap: 0 }}
        >
          {switchEl}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={title} disabled={!title}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className="switch-row"
        onClick={handleClick}
        disabled={disabled}
        title={title}
      >
        {switchEl}
        <span className="min-w-0 text-left">
          <span className={`text-sm ${checked ? 'text-primary' : 'text-secondary'}`}>{label}</span>
          {description != null && (
            <span className="text-xs text-tertiary block mt-0.5">{description}</span>
          )}
        </span>
      </button>
    </Tooltip>
  );
});
