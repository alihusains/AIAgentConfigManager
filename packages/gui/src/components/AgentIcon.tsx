import {
  MessageSquare,
  MessageCircle,
  Code,
  Sparkles,
  Zap,
  Bot,
  Braces,
  Cpu,
  Wind,
  Wrench,
  Rocket,
  Bird,
  Box,
  Play,
  Github,
  MousePointer,
  Waves,
  Terminal,
  Brain,
  Package,
  Cloud,
  FlaskConical,
  Hammer,
  Bolt,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import { logoUrl } from '../logos';

/**
 * Map of catalog `icon` string → lucide component. The catalog JSON stores the
 * icon as a plain string (framework-agnostic); this is the single place that
 * knows how to render it. Unknown / absent names fall back to the generic Bot.
 */
const ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  MessageCircle,
  Code,
  Sparkles,
  Zap,
  Bot,
  Braces,
  Cpu,
  Wind,
  Wrench,
  Rocket,
  Bird,
  Box,
  Play,
  Github,
  MousePointer,
  Waves,
  Terminal,
  Brain,
  Package,
  Cloud,
  FlaskConical,
  Hammer,
  Bolt,
  SquareTerminal,
};

export function iconFor(name?: string): LucideIcon {
  if (name && ICONS[name]) return ICONS[name];
  return Bot;
}

interface AgentIconProps {
  /** Catalog `icon` field (a lucide icon name). */
  icon?: string;
  /** Agent id — used to look up the real brand logo. */
  id?: string;
  size?: number;
  className?: string;
}

export function AgentIcon({ icon, id, size = 18, className }: AgentIconProps) {
  const logo = logoUrl(id);
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', display: 'block' }}
      />
    );
  }
  const Icon = iconFor(icon);
  return <Icon size={size} className={className} aria-hidden />;
}

/**
 * A rounded, tinted icon tile — the visual identity for an agent. The accent
 * color is derived deterministically from the agent id/name so each agent has
 * a consistent hue across the whole app (sidebar, dashboard, detail page).
 *
 * The palette is a small set of muted, warm-tuned categorical tints (defined
 * as design tokens) rather than a saturated rainbow, so agent identity stays
 * distinguishable without introducing decorative multi-hue noise.
 */
const PALETTE = [
  'var(--accent-primary)',
  'var(--accent-info)',
  'var(--anthropic-accent)',
  'var(--cat-olive)',
  'var(--accent-success)',
];

function hueFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function AgentIconTile({
  icon,
  id,
  size = 36,
  iconSize,
}: {
  icon?: string;
  id?: string;
  size?: number;
  iconSize?: number;
}) {
  const color = hueFor(id || 'agent');
  const hasLogo = Boolean(logoUrl(id));
  return (
    <div
      className="agent-icon-tile"
      style={{
        width: size,
        height: size,
        // Real logos carry their own colors, so use a neutral surface; the
        // tinted background only shows for the glyph fallback.
        // In dark mode, use lighter background (secondary) for better contrast
        background: hasLogo
          ? 'color-mix(in srgb, var(--bg-secondary) 80%, transparent)'
          : `color-mix(in srgb, ${color} 24%, transparent)`,
        color,
        borderRadius: Math.round(size * 0.28),
      }}
    >
      <AgentIcon
        icon={icon}
        id={id}
        size={iconSize ?? Math.round(size * (hasLogo ? 0.62 : 0.52))}
      />
    </div>
  );
}