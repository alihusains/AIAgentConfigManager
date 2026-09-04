/**
 * Free-model auto-sync ("Only free models" — requirement 6).
 *
 * A provider registered with `config.trackFreeModels: true` is re-verified on
 * every dashboard open: the server re-probes the provider's live endpoint
 * (GET /models), keeps only model ids containing "free", and diff-updates the
 * registry entry + every agent config the provider is installed on.
 *
 * Server-side on purpose: the dashboard may be open in several tabs, but the
 * registry file has one authoritative owner. The GUI only flips the flag and
 * renders the result.
 */

import type {
  ModelConfig,
  ModelProvider,
  ProviderApiCapabilities,
  RegistryProvider,
} from './types';
import { probeProviderAPIs, toApiCapabilities } from './provider-test';
import { resolveProviderApiKey } from './registry';

/** Model ids containing "free" (case-insensitive) — same rule as the GUI filter. */
export function isFreeModelId(id: string): boolean {
  return /free/i.test(id);
}

/** Registry marker: does this provider opt into free-model tracking? */
export function tracksFreeModels(provider: ModelProvider): boolean {
  return provider.config?.trackFreeModels === true;
}

/** Enable (or disable) free-model tracking on a provider config copy. */
export function withFreeModelTracking(provider: ModelProvider, enabled: boolean): ModelProvider {
  const config = { ...(provider.config || {}) };
  if (enabled) {
    config.trackFreeModels = true;
  } else {
    delete config.trackFreeModels;
  }
  return { ...provider, config };
}

export interface FreeModelProbe {
  /** Fresh model ids from the endpoint, or [] when the probe failed. */
  ids: string[];
  /** True when the endpoint returned a real model list (safe to diff against). */
  gotList: boolean;
  caps?: ProviderApiCapabilities;
  error?: string;
}

/**
 * Re-verify one provider's endpoint and return the fresh model list.
 * `gotList: false` (with an `error`) means the probe failed — callers keep
 * the previous model list in that case, never wipe it.
 */
export async function probeProviderModels(entry: RegistryProvider): Promise<FreeModelProbe> {
  const baseUrl = String(entry.provider.config?.baseUrl || '');
  if (!baseUrl) {
    return { ids: [], gotList: false, error: 'provider has no baseUrl configured' };
  }
  let apiKey: string | null = null;
  try {
    apiKey = await resolveProviderApiKey(entry);
  } catch {
    apiKey = null;
  }
  try {
    const result = await probeProviderAPIs({ baseUrl, apiKey: apiKey || undefined });
    if (result.modelIds.length === 0) {
      return { ids: [], gotList: false, error: 'endpoint returned no models' };
    }
    return { ids: result.modelIds, gotList: true, caps: toApiCapabilities(result) };
  } catch (err) {
    return { ids: [], gotList: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface FreeModelDiff {
  /** Next model list: previously-registered free models that still exist + new free ids. */
  models: ModelConfig[];
  added: string[];
  removed: string[];
}

/** Result of syncing one provider's free-model list. */
export interface FreeModelSyncOutcome {
  providerId: string;
  /** Model ids registered after the sync. */
  models: string[];
  /** Ids added by this sync. */
  added: string[];
  /** Ids dropped by this sync (vanished from the endpoint). */
  removed: string[];
  /** Agent ids whose config files were rewritten. */
  agentsWritten: string[];
  /** True when the endpoint probe returned a usable model list. */
  endpointOk: boolean;
  /** Probe or write failure detail. */
  error?: string;
  /** ISO timestamp of the sync. */
  syncedAt: string;
}

/** Aggregate result of syncing every tracked provider. */
export interface FreeModelSyncSummary {
  /** How many tracked providers were probed. */
  checked: number;
  /** How many had their model list changed (and agents rewritten). */
  changed: number;
  results: FreeModelSyncOutcome[];
}


/**
 * Diff the current model list against a fresh endpoint list, keeping only
 * free models. New "free" ids are appended; free ids that vanished from the
 * endpoint are dropped. Non-free models currently registered are left in
 * place (the provider may have been seeded manually) — they are never
 * auto-removed by the free-model sync.
 */
export function diffFreeModels(current: ModelConfig[], freshIds: string[]): FreeModelDiff {
  // Endpoints occasionally repeat ids — dedupe before diffing.
  const uniqueFresh = [...new Set(freshIds)];
  const freshSet = new Set(uniqueFresh);
  // Non-free registered models are ALWAYS kept — the sync manages the free
  // slice of the list, never the user's manually-registered paid models.
  const kept = current.filter(
    (m) => !isFreeModelId(m.id) || freshSet.has(m.id)
  );
  const added = uniqueFresh.filter(
    (id) => isFreeModelId(id) && !current.some((m) => m.id === id)
  );
  const removed = current
    .filter((m) => isFreeModelId(m.id) && !freshSet.has(m.id))
    .map((m) => m.id);
  const models: ModelConfig[] = [
    ...kept,
    ...added.map(
      (id): ModelConfig => ({
        id,
        providerId: current[0]?.providerId || '',
        name: id,
        displayName: id,
        roles: ['chat', 'edit', 'apply', 'summarize'],
        capabilities: ['tool_use'],
      })
    ),
  ];
  return { models, added, removed };
}
