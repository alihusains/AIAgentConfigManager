/**
 * InstructionCard — IC Signature theme guidance + context card.
 *
 * Displays step-by-step instructions, tips, or explanatory context.
 * Variant-based styling:
 * - "info": Blue, informational (default)
 * - "tip": Green, helpful hint
 * - "warning": Orange, caution
 * - "error": Red, critical info
 */

import { memo, ReactNode } from 'react';

export type InstructionVariant = 'info' | 'tip' | 'warning' | 'error';

export interface InstructionCardProps {
  /** Content of the instruction (usually JSX with steps, code, or text). */
  children: ReactNode;
  /** Optional title or heading. */
  title?: string;
  variant?: InstructionVariant;
  className?: string;
}

export const InstructionCard = memo(function InstructionCard({
  children,
  title,
  variant = 'info',
  className,
}: InstructionCardProps) {
  const variantClass = `ic-instruction-card-${variant}`;
  return (
    <div
      className={
        className
          ? `ic-instruction-card ${variantClass} ${className}`
          : `ic-instruction-card ${variantClass}`
      }
      role="region"
      aria-label={`${variant} instructions`}
    >
      {title && <h4 className="ic-instruction-card-title">{title}</h4>}
      <div className="ic-instruction-card-content">{children}</div>
    </div>
  );
});
