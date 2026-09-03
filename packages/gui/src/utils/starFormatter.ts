/**
 * Star count formatting and ranking utilities
 */

/**
 * Format star count for display
 * 1-999: "234 ⭐"
 * 1k-999k: "1.2k ⭐"
 * 1M+: "1.5M ⭐"
 * Unknown: "—"
 */
export function formatStarCount(count: number | undefined): string {
  if (count === undefined || count === null) return '—';
  if (count < 1000) return `${count} ⭐`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k ⭐`;
  return `${(count / 1000000).toFixed(1)}M ⭐`;
}

/**
 * Get rank badge label (Top 10, Top 20, etc.)
 */
export function getRankBadge(index: number): string | null {
  if (index < 10) return 'Top 10';
  if (index < 20) return 'Top 20';
  if (index < 50) return 'Top 50';
  return null;
}

/**
 * Get maintenance status badge color and label
 */
export function getMaintenanceStatus(status?: string): {
  color: string;
  label: string;
  icon: string;
} {
  switch (status) {
    case 'active':
      return { color: 'bg-success/20 text-success', label: 'Active', icon: '✓' };
    case 'stale':
      return { color: 'bg-warning/20 text-warning', label: 'Stale', icon: '⚠' };
    case 'archived':
      return { color: 'bg-error/20 text-error', label: 'Archived', icon: '◯' };
    default:
      return { color: 'bg-neutral/20 text-neutral', label: 'Unknown', icon: '—' };
  }
}

/**
 * Check if an agent is trending (50+ stars in last 30 days)
 */
export function isTrending(growth30d?: number): boolean {
  return growth30d !== undefined && growth30d >= 50;
}

/**
 * Format growth percentage for display
 */
export function formatGrowth(growth: number | undefined): string {
  if (growth === undefined) return '—';
  return `+${growth} ⬆`;
}

/**
 * Get time since last update
 */
export function getTimeSinceUpdate(fetchedAt: string | undefined): string {
  if (!fetchedAt) return 'Never';
  
  const fetched = new Date(fetchedAt);
  const now = new Date();
  const diff = now.getTime() - fetched.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
