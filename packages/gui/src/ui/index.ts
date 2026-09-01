/**
 * Shared UI primitive library.
 *
 * Thin, typed, memoized wrappers over the app's existing CSS classes — no
 * duplicated styles, no new dependencies. Named ESM exports so unused
 * primitives are tree-shaken out of the bundle.
 *
 * Inventory
 * ---------
 *  Badge         tinted status pill (`.badge .badge-*`), optional live-dot
 *  Button        `.btn .btn-*` with variant/size/icon/loading, forwards ref
 *  Card          `.card` panel with optional header (title + actions slot)
 *  StatCard      KPI tile (label, tinted value, trend, icon chip) — color-mix
 *  EmptyState    `.empty-state` zero-data placeholder (icon/title/msg/action)
 *  SectionHeader view/group heading (title, description, actions slot)
 *  Field         form row (`.form-group` label + control + help)
 *  Toggle        accessible `.switch` on/off (role="switch")
 *  Modal         `.modal` dialog via portal; Escape + backdrop close, focus trap +
 *                restore (audit A1)
 *  Tooltip       hover/focus/long-press hint replacing native `title` (audit A9)
 *
 * Memoization notes: leaf/presentational components with primitive props are
 * wrapped in React.memo (Badge, Button, StatCard, EmptyState, SectionHeader,
 * Field, Toggle). Structural containers that take `children` (Card, Modal) are
 * plain functions because children identity changes every parent render, so
 * memo would never bail out.
 */

export { Badge, type BadgeProps, type BadgeVariant } from './Badge';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps } from './Card';
export { StatCard, type StatCardProps } from './StatCard';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { Field, type FieldProps } from './Field';
export { Toggle, type ToggleProps } from './Toggle';
export { Modal, type ModalProps } from './Modal';
export { Status, type StatusProps, type StatusKind } from './Status';
export { Skeleton, type SkeletonProps } from './Skeleton';
export { Tooltip, type TooltipProps } from './Tooltip';
