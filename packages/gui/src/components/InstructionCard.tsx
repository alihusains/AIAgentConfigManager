/**
 * InstructionCard Component
 *
 * IC Signature Theme: Step-by-step guidance and instructions
 * Features: numbered steps, clean typography, optional icons/badges
 *
 * Design: Professional, minimal, supportive presentation.
 * No breaking changes to existing components.
 */

import React, { ReactNode } from 'react';

/**
 * Single instruction step
 */
export interface Step {
  /** Step number (auto-generated if omitted) */
  number?: number;
  /** Step title */
  title: string;
  /** Step description or detailed text */
  description?: string;
  /** Optional icon or badge */
  icon?: ReactNode;
  /** Optional code or example */
  example?: string;
  /** Step status: pending, active, completed, error */
  status?: 'pending' | 'active' | 'completed' | 'error';
}

export interface InstructionCardProps {
  /** Array of steps to display */
  steps: Step[];
  /** Card title */
  title?: string;
  /** Card description/intro text */
  description?: string;
  /** Optional className */
  className?: string;
  /** Whether to show step numbers */
  showNumbers?: boolean;
  /** Optional icon for the card */
  icon?: ReactNode;
  /** Compact mode (smaller spacing) */
  compact?: boolean;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-secondary/50', text: 'text-secondary', border: 'border-border' },
  active: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/30' },
  completed: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  error: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/30' },
};

const statusIcons: Record<string, string> = {
  pending: '○',
  active: '◐',
  completed: '✓',
  error: '✕',
};

export const InstructionCard = React.memo(function InstructionCard({
  steps,
  title,
  description,
  className = '',
  showNumbers = true,
  icon,
  compact = false,
}: InstructionCardProps) {
  const containerGap = compact ? 'gap-2' : 'gap-4';
  const stepGap = compact ? 'gap-2' : 'gap-3';

  return (
    <div className={`flex flex-col ${containerGap} ${className}`}>
      {/* Header */}
      {(title || description || icon) && (
        <div className="flex items-start gap-3 pb-3 border-b border-border">
          {icon && (
            <div className="flex-shrink-0 mt-1">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-primary">
                {title}
              </h3>
            )}
            {description && (
              <p className={`text-xs text-secondary mt-1`}>
                {description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Steps */}
      <div className={`flex flex-col ${stepGap}`}>
        {steps.map((step, idx) => {
          const stepNumber = step.number ?? idx + 1;
          const status = step.status ?? 'pending';
          const colors = statusColors[status];

          return (
            <div
              key={idx}
              className={`flex gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border} transition-colors duration-150`}
            >
              {/* Step badge */}
              {showNumbers && (
                <div
                  className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${colors.text} bg-primary border border-current`}
                  role="status"
                >
                  {statusIcons[status] || stepNumber}
                </div>
              )}

              {/* Step content */}
              <div className="flex-1 min-w-0">
                {step.icon && (
                  <div className="flex-shrink-0 mb-1">
                    {step.icon}
                  </div>
                )}

                <h4 className={`text-sm font-semibold text-primary`}>
                  {step.title}
                </h4>

                {step.description && (
                  <p className="text-xs text-secondary mt-1">
                    {step.description}
                  </p>
                )}

                {step.example && (
                  <pre className="text-xs bg-secondary/30 text-primary p-2 rounded-md mt-2 overflow-auto max-h-[120px] font-mono border border-border">
                    <code>{step.example}</code>
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

InstructionCard.displayName = 'InstructionCard';

/**
 * Simpler step-only component (no card wrapper)
 */
export interface StepListProps {
  steps: Step[];
  /** Optional className */
  className?: string;
  /** Compact mode */
  compact?: boolean;
}

export const StepList = React.memo(function StepList({
  steps,
  className = '',
  compact = false,
}: StepListProps) {
  return (
    <InstructionCard
      steps={steps}
      className={className}
      compact={compact}
      showNumbers={true}
    />
  );
});

StepList.displayName = 'StepList';
