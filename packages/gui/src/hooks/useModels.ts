/**
 * React hook for fetching and managing model data
 */

import { useEffect, useState, useCallback } from 'react';
import type { ExtendedModelInfo, ModelsResponse } from '../types/models';

interface UseModelsState {
  models: ExtendedModelInfo[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

/**
 * Hook to fetch available models from the API
 */
export function useModels(): UseModelsState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseModelsState>({
    models: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchModels = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const response = await fetch('/api/models');
      const json = (await response.json()) as {
        ok: boolean;
        data?: ModelsResponse;
        error?: string;
      };

      if (!json.ok || !json.data) {
        throw new Error(json.error || 'Failed to fetch models');
      }

      setState({
        models: json.data.models,
        loading: false,
        error: null,
        lastUpdated: json.data.lastUpdated,
      });
    } catch (error) {
      setState({
        models: [],
        loading: false,
        error: String(error),
        lastUpdated: null,
      });
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    ...state,
    refetch: fetchModels,
  };
}

/**
 * Hook to find a specific model by ID
 */
export function useModel(modelId: string | undefined): ExtendedModelInfo | null {
  const { models } = useModels();
  return modelId ? models.find((m) => m.id === modelId) ?? null : null;
}

/**
 * Hook to filter models based on criteria
 */
export function useFilteredModels(
  filters?: {
    providers?: string[];
    visionSupport?: boolean;
    capabilities?: string[];
  }
): ExtendedModelInfo[] {
  const { models } = useModels();

  return models.filter((model) => {
    if (filters?.providers && !filters.providers.includes(model.provider_id)) {
      return false;
    }
    if (filters?.visionSupport && !model.vision_support) {
      return false;
    }
    if (
      filters?.capabilities &&
      !filters.capabilities.some((cap) => model.capabilities.includes(cap))
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Hook to get models sorted by a criterion
 */
export function useSortedModels(
  sortBy: 'name' | 'token_limit' | 'cost' | 'recommended' = 'recommended'
): ExtendedModelInfo[] {
  const { models } = useModels();

  return [...models].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'token_limit':
        return b.token_limit - a.token_limit;
      case 'cost':
        return (a.input_tokens_per_million + a.output_tokens_per_million) -
               (b.input_tokens_per_million + b.output_tokens_per_million);
      case 'recommended':
        return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
      default:
        return 0;
    }
  });
}

/**
 * Hook to get recommended models
 */
export function useRecommendedModels(): ExtendedModelInfo[] {
  const { models } = useModels();
  return models.filter((m) => m.recommended).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Hook to group models by provider
 */
export function useModelsByProvider(): Record<string, ExtendedModelInfo[]> {
  const { models } = useModels();
  const grouped: Record<string, ExtendedModelInfo[]> = {};

  for (const model of models) {
    const provider = model.provider_name;
    if (!grouped[provider]) {
      grouped[provider] = [];
    }
    grouped[provider].push(model);
  }

  return grouped;
}

/**
 * Hook to calculate estimated costs for a sample query
 */
export function useEstimatedCost(
  modelId: string | undefined,
  inputTokens: number = 500,
  outputTokens: number = 200
): number | null {
  const model = useModel(modelId);

  if (!model) return null;

  const inputCost = (model.input_tokens_per_million * inputTokens) / 1_000_000;
  const outputCost = (model.output_tokens_per_million * outputTokens) / 1_000_000;
  return inputCost + outputCost;
}
