/**
 * IC Signature Theme Components
 *
 * A cohesive design system for professional, corporate dashboards and
 * configuration tools. Enforces:
 * - Minimalist & utilitarian (function over decoration)
 * - High contrast & accessibility (WCAG AA)
 * - Responsive dual-pane layout (mobile-first)
 * - Brand-enforced colors & typography
 *
 * Core components:
 *  - DualPaneLayout: Master layout (controls + preview, responsive)
 *  - ControlPanel: Left/top pane (filters, toggles, inputs)
 *  - PreviewPane: Right/bottom pane (metrics, results, live updates)
 *  - StatusIndicator: Feedback (last updated, syncing, errors)
 *  - ActionButtons: Button group (export, refresh, settings)
 *  - InstructionCard: Guidance (tips, steps, warnings)
 *  - FormSection: Grouped input section (labels, hints, content)
 */

export { DualPaneLayout, type DualPaneLayoutProps } from './DualPaneLayout';
export { ControlPanel, FormSection, type ControlPanelProps, type FormSectionProps } from './ControlPanel';
export { PreviewPane, type PreviewPaneProps } from './PreviewPane';
export { StatusIndicator, type StatusIndicatorProps, type StatusIndicatorVariant } from './StatusIndicator';
export { ActionButtons, type ActionButtonsProps } from './ActionButtons';
export { InstructionCard, type InstructionCardProps, type InstructionVariant } from './InstructionCard';
