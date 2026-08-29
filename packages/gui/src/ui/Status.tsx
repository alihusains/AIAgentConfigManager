import { memo } from 'react';

/**
 * Status — a standardized indicator rendered as dot + text, NEVER color-only.
 *
 * Accessibility requirement: distinguishing state by color alone is invisible
 * to colorblind users, so every status carries a visible text label (and a
 * `role="status"` for screen readers).
 *
 * The dot color is a semantic token reference only. The VALUES belong to E1's
 * token layer (Pi); this component never defines a hex literal, so it adapts to
 * the active theme and to E1's final status palette without any change here.
 */

export type StatusKind =
  | 'connected'
  | 'attention'
  | 'failed'
  | 'disabled'
  | 'not-verified'
  | (string & Record<never, never>);

export interface StatusProps {
  /** Which state to render. Unknown values fall back to `disabled` styling. */
  status: StatusKind;
  /** Override the visible label. Defaults to a human label for known statuses. */
  label?: string;
  className?: string;
}

const LABELS: Record<string, string> = {
  connected: 'Connected',
  attention: 'Attention',
  failed: 'Failed',
  disabled: 'Disabled',
  'not-verified': 'Not verified',
};

// Semantic token reference (not a value) for each state. `var(--…)` keeps the
// dot on-theme and means the value tracks E1's token system automatically.
const TONES: Record<string, string> = {
  connected: 'var(--accent-success)',
  attention: 'var(--accent-warning)',
  failed: 'var(--accent-error)',
  'not-verified': 'var(--accent-info)',
  disabled: 'var(--text-tertiary)',
};

export const Status = memo(function Status({ status, label, className }: StatusProps) {
  const tone = TONES[status] ?? TONES.disabled;
  const disabled = status === 'disabled' || !(status in TONES);
  const text = label ?? LABELS[status] ?? status;

  return (
    <span className={className ? `status ${className}` : 'status'} role="status">
      <span
        className="status-dot"
        aria-hidden="true"
        style={
          disabled
            ? { background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--text-tertiary)' }
            : { background: tone, color: tone }
        }
      />
      <span className="status-label">{text}</span>
    </span>
  );
});
