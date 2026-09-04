/**
 * TokenInfoDisplay Component
 *
 * Displays token pricing information with cost estimates and model comparisons.
 * Sub-components:
 * - TokenPriceCard: Shows pricing for a single model
 * - TokenComparison: Table comparing costs across multiple models
 * - CostEstimator: Interactive cost calculator for sample queries
 */

import React, { useState } from 'react';
import type { ExtendedModelInfo } from '../types/models';
import { getModelCostTier, MODEL_STATUS } from '../types/models';

// ============================================================================
// Types
// ============================================================================

interface TokenInfoDisplayProps {
  /** The currently selected model */
  selectedModelId: string | undefined;
  /** All available models for comparison */
  allModels: ExtendedModelInfo[];
  /** Optional callback when user selects a different model */
  onSelectModel?: (modelId: string) => void;
}

interface TokenPriceCardProps {
  model: ExtendedModelInfo;
  isSelected?: boolean;
  onClick?: () => void;
}

interface TokenComparisonProps {
  models: ExtendedModelInfo[];
  selectedModelId?: string;
  sampleInputTokens?: number;
  sampleOutputTokens?: number;
}

interface CostEstimatorProps {
  model: ExtendedModelInfo;
}

// ============================================================================
// TokenPriceCard Component
// ============================================================================

/**
 * Card displaying pricing information for a single model
 */
export const TokenPriceCard: React.FC<TokenPriceCardProps> = ({
  model,
  isSelected = false,
  onClick,
}) => {
  const costTier = getModelCostTier(
    model.input_tokens_per_million,
    model.output_tokens_per_million
  );
  const avgCost = (model.input_tokens_per_million + model.output_tokens_per_million) / 2;

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
        }
      `}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-sm">{model.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{model.provider_name}</p>
          </div>
          <span
            className={`
              px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap
              ${
                costTier === 'budget'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : costTier === 'standard'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }
            `}
          >
            {costTier.charAt(0).toUpperCase() + costTier.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Input (per 1M)</p>
            <p className="font-mono text-sm">${model.input_tokens_per_million.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Output (per 1M)</p>
            <p className="font-mono text-sm">${model.output_tokens_per_million.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Avg Cost</span>
          <span className="font-mono font-semibold">${avgCost.toFixed(3)}</span>
        </div>

        {model.vision_support && (
          <div className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-1 rounded">
            ✓ Vision Support
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// TokenComparison Component
// ============================================================================

/**
 * Table comparing token costs across multiple models
 */
export const TokenComparison: React.FC<TokenComparisonProps> = ({
  models,
  selectedModelId,
  sampleInputTokens = 500,
  sampleOutputTokens = 200,
}) => {
  // Sort by total estimated cost
  const sorted = [...models].sort((a, b) => {
    const costA = (a.input_tokens_per_million * sampleInputTokens +
      a.output_tokens_per_million * sampleOutputTokens) /
      1_000_000;
    const costB = (b.input_tokens_per_million * sampleInputTokens +
      b.output_tokens_per_million * sampleOutputTokens) /
      1_000_000;
    return costA - costB;
  });

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Model</th>
            <th className="px-4 py-2 text-right font-semibold">Input/1M</th>
            <th className="px-4 py-2 text-right font-semibold">Output/1M</th>
            <th className="px-4 py-2 text-right font-semibold text-nowrap">
              Sample ({sampleInputTokens} in / {sampleOutputTokens} out)
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((model) => {
            const sampleCost = (model.input_tokens_per_million * sampleInputTokens +
              model.output_tokens_per_million * sampleOutputTokens) /
              1_000_000;
            const isSelected = model.id === selectedModelId;

            return (
              <tr
                key={model.id}
                className={`
                  border-t border-gray-200 dark:border-gray-700
                  ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'}
                `}
              >
                <td className="px-4 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    {isSelected && <span className="text-blue-500">✓</span>}
                    <div>
                      <p className="font-semibold">{model.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {model.provider_name}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  ${model.input_tokens_per_million.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  ${model.output_tokens_per_million.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right font-mono font-semibold">
                  ${sampleCost.toFixed(5)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// CostEstimator Component
// ============================================================================

/**
 * Interactive cost calculator for sample queries
 */
export const CostEstimator: React.FC<CostEstimatorProps> = ({ model }) => {
  const [inputTokens, setInputTokens] = useState(500);
  const [outputTokens, setOutputTokens] = useState(200);

  const inputCost = (model.input_tokens_per_million * inputTokens) / 1_000_000;
  const outputCost = (model.output_tokens_per_million * outputTokens) / 1_000_000;
  const totalCost = inputCost + outputCost;

  return (
    <div className="space-y-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      <h4 className="font-semibold">Cost Estimator</h4>

      <div className="space-y-3">
        {/* Input tokens slider */}
        <div>
          <label className="text-sm font-medium">
            Input Tokens: <span className="font-mono font-bold text-blue-600">{inputTokens}</span>
          </label>
          <input
            type="range"
            min="1"
            max="2000000"
            step="100"
            value={inputTokens}
            onChange={(e) => setInputTokens(Number(e.target.value))}
            className="w-full mt-2"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cost: <span className="font-mono text-green-600">${inputCost.toFixed(6)}</span>
          </div>
        </div>

        {/* Output tokens slider */}
        <div>
          <label className="text-sm font-medium">
            Output Tokens: <span className="font-mono font-bold text-blue-600">{outputTokens}</span>
          </label>
          <input
            type="range"
            min="1"
            max="100000"
            step="50"
            value={outputTokens}
            onChange={(e) => setOutputTokens(Number(e.target.value))}
            className="w-full mt-2"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cost: <span className="font-mono text-green-600">${outputCost.toFixed(6)}</span>
          </div>
        </div>

        {/* Total cost */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
          <p className="text-sm font-medium">Total Estimated Cost</p>
          <p className="text-2xl font-mono font-bold text-green-600">${totalCost.toFixed(6)}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main TokenInfoDisplay Component
// ============================================================================

/**
 * Main component combining price card, comparison table, and cost estimator
 */
export const TokenInfoDisplay: React.FC<TokenInfoDisplayProps> = ({
  selectedModelId,
  allModels,
  onSelectModel,
}) => {
  const selectedModel = allModels.find((m) => m.id === selectedModelId);

  if (!selectedModel) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <p>Select a model to view pricing information</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected model card */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Selected Model</h3>
        <TokenPriceCard model={selectedModel} isSelected={true} />
      </div>

      {/* Cost estimator */}
      <CostEstimator model={selectedModel} />

      {/* Comparison table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Cost Comparison (Top 10 Cheapest)</h3>
        <TokenComparison
          models={allModels.slice(0, 10)}
          selectedModelId={selectedModelId}
          sampleInputTokens={500}
          sampleOutputTokens={200}
        />
      </div>

      {/* Model details */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <h4 className="font-semibold mb-3">Model Details</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">Token Limit:</dt>
            <dd className="font-mono font-semibold">{selectedModel.token_limit.toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">Training Cutoff:</dt>
            <dd className="font-mono">{selectedModel.training_data_cutoff}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">Status:</dt>
            <dd>
              <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap`}>
                {MODEL_STATUS[selectedModel.status]?.label || selectedModel.status}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600 dark:text-gray-400">API Type:</dt>
            <dd className="font-mono">{selectedModel.api_compatibility}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
