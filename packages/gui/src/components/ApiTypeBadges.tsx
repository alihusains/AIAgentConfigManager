import { memo } from 'react';
import type { ProviderApiKind } from '@ai-agent-config/core';
import { providerApiBadgeClass } from './ProviderVerify';

/**
 * Compact API-kind badges for an agent.
 *
 * Renders the agent's `apiTypes` (ProviderApiKind set) as tinted pills in a
 * fixed, predictable order — chat → responses → anthropic — so columns of
 * badges line up visually across rows. Memoized: a row only re-renders this
 * when its `kinds` reference actually changes.
 */

const KIND_ORDER: ProviderApiKind[] = ['chat', 'responses', 'anthropic'];

/** Short, scan-friendly labels for dense list rows. */
const SHORT_LABEL: Record<ProviderApiKind, string> = {
  chat: 'chat',
  responses: 'responses',
  anthropic: 'anthropic',
};

export const ApiTypeBadges = memo(function ApiTypeBadges({
  kinds,
  compact = false,
}: {
  /** The agent's supported API kinds (from the catalog `apiTypes` field). */
  kinds: readonly ProviderApiKind[] | undefined;
  /** Tighter spacing/padding for dense table rows. */
  compact?: boolean;
}) {
  if (!kinds || kinds.length === 0) {
    return <span className="badge badge-neutral">no API</span>;
  }
  const set = new Set(kinds);
  return (
    <span className={compact ? 'api-badge-row api-badge-row--compact' : 'api-badge-row'}>
      {KIND_ORDER.filter((k) => set.has(k)).map((k) => (
        <span key={k} className={`badge ${providerApiBadgeClass(k)}`}>
          {SHORT_LABEL[k]}
        </span>
      ))}
    </span>
  );
});
