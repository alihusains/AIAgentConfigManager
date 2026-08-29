import { memo, type CSSProperties, type HTMLAttributes } from 'react';

/**
 * Skeleton — a content-shaped loading placeholder.
 *
 * Used in place of the generic spinner (audit D1). Sizing mirrors the content
 * it stands in for (pass width/height, or let the parent size it). The pulse is
 * opacity-only (compositor-friendly) so it never triggers layout; the global
 * prefers-reduced-motion override already disables it for reduced-motion users.
 */

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}

export const Skeleton = memo(function Skeleton({
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <span
      className={className ? `skeleton ${className}` : 'skeleton'}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...rest}
    />
  );
});
