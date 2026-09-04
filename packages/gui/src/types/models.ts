/**
 * Type definitions for model-related API responses and components
 */

/**
 * Extended model information with pricing and capability metadata
 */
export interface ExtendedModelInfo {
  id: string;
  name: string;
  provider_id: string;
  provider_name: string;
  provider_type: string;
  vision_support: boolean;
  token_limit: number;
  input_tokens_per_million: number;
  output_tokens_per_million: number;
  capabilities: string[];
  training_data_cutoff: string;
  api_compatibility: string;
  status: 'stable' | 'beta' | 'limited' | 'unknown';
  recommended: boolean;
}

/**
 * Response from GET /api/models
 */
export interface ModelsResponse {
  models: ExtendedModelInfo[];
  totalCount: number;
  lastUpdated: string;
}

/**
 * Token pricing for a model
 */
export interface TokenPricing {
  modelId: string;
  modelName: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  estimatedCostForSample?: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
}

/**
 * Cost comparison for multiple models
 */
export interface CostComparison {
  models: TokenPricing[];
  sampleInput: number;
  sampleOutput: number;
  sortedByCost: string[]; // model IDs sorted by total estimated cost
}

/**
 * Model filter options
 */
export interface ModelFilters {
  providers?: string[];
  visionSupport?: boolean;
  capabilities?: string[];
  costTier?: 'budget' | 'standard' | 'premium';
  minTokenLimit?: number;
}

/**
 * Model sorting options
 */
export type ModelSortOption =
  | 'name'
  | 'token_limit_asc'
  | 'token_limit_desc'
  | 'cost_asc'
  | 'cost_desc'
  | 'recommended';

/**
 * Categorized models for UI display
 */
export interface CategorizedModels {
  recommended: ExtendedModelInfo[];
  byProvider: Record<string, ExtendedModelInfo[]>;
  byCapability: Record<string, ExtendedModelInfo[]>;
}

/**
 * Model capabilities metadata
 */
export interface ModelCapabilityInfo {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
}

/**
 * Known model capabilities with descriptions
 */
export const MODEL_CAPABILITIES: Record<string, ModelCapabilityInfo> = {
  reasoning: {
    id: 'reasoning',
    name: 'Advanced Reasoning',
    description: 'Extended thinking and complex problem solving',
    color: 'purple',
  },
  function_calling: {
    id: 'function_calling',
    name: 'Function Calling',
    description: 'Can call external functions and APIs',
    color: 'blue',
  },
  streaming: {
    id: 'streaming',
    name: 'Streaming',
    description: 'Supports real-time token streaming',
    color: 'green',
  },
  tools: {
    id: 'tools',
    name: 'Tools Support',
    description: 'Native tool integration and execution',
    color: 'orange',
  },
  vision: {
    id: 'vision',
    name: 'Vision',
    description: 'Can process and understand images',
    color: 'pink',
  },
  code_generation: {
    id: 'code_generation',
    name: 'Code Generation',
    description: 'Specialized for code writing and analysis',
    color: 'indigo',
  },
};

/**
 * Model status labels
 */
export const MODEL_STATUS: Record<string, { label: string; color: string }> = {
  stable: { label: 'Stable', color: 'green' },
  beta: { label: 'Beta', color: 'yellow' },
  limited: { label: 'Limited', color: 'orange' },
  unknown: { label: 'Unknown', color: 'gray' },
};

/**
 * Cost tier classification helper
 */
export function getModelCostTier(
  inputCost: number,
  outputCost: number
): 'budget' | 'standard' | 'premium' {
  const avgCost = (inputCost + outputCost) / 2;
  if (avgCost < 1) return 'budget';
  if (avgCost < 10) return 'standard';
  return 'premium';
}
