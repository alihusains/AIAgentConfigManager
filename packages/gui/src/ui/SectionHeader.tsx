import { memo, type ReactNode } from 'react';

/**
 * SectionHeader — the page/section heading block used at the top of views and
 * between logical groups: a title, an optional supporting line, and an
 * optional right-aligned actions slot.
 *
 * Built on the app's existing utility classes (no new CSS), so it matches the
 * current views pixel-for-pixel. Memoized.
 */

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions (buttons, badges). */
  actions?: ReactNode;
  /** Tighter bottom margin when used between groups rather than at page top. */
  compact?: boolean;
}

export const SectionHeader = memo(function SectionHeader({
  title,
  description,
  actions,
  compact = false,
}: SectionHeaderProps) {
  return (
    <div
      className={
        compact
          ? 'mb-3 flex items-start justify-between gap-4'
          : 'mb-6 flex items-start justify-between gap-4'
      }
    >
      <div className="min-w-0">
        <h2 className={compact ? 'text-base font-semibold' : 'page-title'}>{title}</h2>
        {description != null && (
          <p className="text-secondary text-sm mt-1">{description}</p>
        )}
      </div>
      {actions != null && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
});
