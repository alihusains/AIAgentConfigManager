/**
 * AgentModelCompatibility Component
 *
 * Displays model compatibility information for a specific agent.
 * Shows supported models, recommended models, and capability support.
 *
 * Integrates with AgentsView to provide quick model reference for each agent.
 */

import React from 'react';
import type { DetectedAgent } from '@ai-agent-config/core';
import type { ExtendedModelInfo } from '../types/models';
import { useModels } from '../hooks/useModels';

// ============================================================================
// Component Types
// ============================================================================

interface AgentModelCompatibilityProps {
  /** The agent being displayed */
  agent: DetectedAgent;
  /** Optional click handler to navigate to model details */
  onSelectModel?: (modelId: string) => void;
  /** Display mode: 'compact' for inline display, 'full' for dedicated section */
  mode?: 'compact' | 'full';
}

interface ModelBadgeProps {
  model: ExtendedModelInfo;
  onClick?: () => void;
}

interface CompatibilityMetricsProps {
  agent: DetectedAgent;
  allModels: ExtendedModelInfo[];
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Small badge for a single model with visual indicators
 */
const ModelBadge: React.FC<ModelBadgeProps> = ({ model, onClick }: ModelBadgeProps) => {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1 rounded text-xs font-medium whitespace-nowrap
        transition-colors cursor-pointer
        bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
        hover:bg-blue-200 dark:hover:bg-blue-900/50
      `}
      title={`${model.name} (${model.provider_name})`}
    >
      <span className="flex items-center gap-1">
        {model.vision_support && <span title="Vision support">👁️</span>}
        {model.recommended && <span title="Recommended">⭐</span>}
        {model.name}
      </span>
    </button>
  );
};

/**
 * Displays capability badges for an agent
 */
const CapabilityBadges: React.FC<{ agent: DetectedAgent }> = ({ agent }) => {
  const capabilities = [];

  if (agent.supports?.modelProviders) capabilities.push('Model Providers');
  if (agent.supports?.mcpServers) capabilities.push('MCP Servers');
  if (agent.supports?.permissions) capabilities.push('Permissions');
  if (agent.supports?.projectConfig) capabilities.push('Project Config');

  if (capabilities.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {capabilities.map((cap) => (
        <span
          key={cap}
          className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
        >
          {cap}
        </span>
      ))}
    </div>
  );
};

/**
 * Compatibility metrics dashboard
 */
const CompatibilityMetrics: React.FC<CompatibilityMetricsProps> = ({ agent, allModels }) => {
  const agentCapabilities = [];
  if (agent.supports?.modelProviders) agentCapabilities.push('providers');
  if (agent.supports?.mcpServers) agentCapabilities.push('mcp');
  if (agent.supports?.permissions) agentCapabilities.push('permissions');

  // Show capability count and recommended model count
  const recommendedCount = allModels.filter((m) => m.recommended).length;

  return (
    <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
      <div className="text-center">
        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
          {agentCapabilities.length}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">Capabilities</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {recommendedCount}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">Recommended Models</p>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AgentModelCompatibility: React.FC<AgentModelCompatibilityProps> = ({
  agent,
  onSelectModel,
  mode = 'compact',
}) => {
  const { models: allModels } = useModels();

  // Extract recommended models from agent's supported models
  const recommendedModels = (agent.models || [])
    .filter((m) => allModels.some((am) => am.id === m.id && am.recommended))
    .slice(0, 3);

  if (mode === 'compact') {
    return (
      <div className="space-y-2">
        {/* Quick stats */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {agent.supports?.modelProviders && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <span>🔌</span> Model Providers
            </span>
          )}
          {agent.supports?.mcpServers && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              <span>🔗</span> MCP Servers
            </span>
          )}
          {agent.supports?.permissions && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
              <span>🔐</span> Permissions
            </span>
          )}
        </div>

        {/* Top recommended models preview */}
        {allModels.filter((m) => m.recommended).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              Recommended Models ({allModels.filter((m) => m.recommended).length})
            </p>
            <div className="flex flex-wrap gap-1">
              {allModels.filter((m: ExtendedModelInfo) => m.recommended).slice(0, 3).map((model: ExtendedModelInfo) => (
                <ModelBadge
                  key={model.id}
                  model={model}
                  onClick={() => onSelectModel?.(model.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode
  const fullModeRecommendedModels = allModels.filter((m: ExtendedModelInfo) => m.recommended).slice(0, 6);

  return (
    <div className="space-y-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div>
        <h4 className="font-semibold mb-3">Model & Agent Support</h4>
        <CompatibilityMetrics agent={agent} allModels={allModels} />
      </div>

      {/* Capabilities */}
      <div>
        <p className="text-sm font-semibold mb-2">Agent Capabilities</p>
        <CapabilityBadges agent={agent} />
      </div>

      {/* Recommended Models */}
      {fullModeRecommendedModels.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">Recommended Models</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {fullModeRecommendedModels.map((model: ExtendedModelInfo) => (
              <div
                key={model.id}
                className="p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                onClick={() => onSelectModel?.(model.id)}
              >
                <p className="font-medium text-sm">{model.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {model.provider_name}
                </p>
                <p className="text-xs mt-1 text-gray-500">
                  ${model.input_tokens_per_million.toFixed(2)}/1M
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All models count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>Total available models: <span className="font-semibold">{allModels.length}</span></p>
      </div>
    </div>
  );
};

// ============================================================================
// Hook for Agent Model Data
// ============================================================================

/**
 * Hook to get all model data for an agent
 */
export function useAgentModels(agent: DetectedAgent): {
  recommendedModels: ExtendedModelInfo[];
  allModels: ExtendedModelInfo[];
  capabilitiesCount: number;
} {
  const { models: allModels } = useModels();

  const recommendedModels = allModels.filter((m) => m.recommended).slice(0, 3);

  const capabilitiesCount = (agent.supports?.modelProviders ? 1 : 0) +
    (agent.supports?.mcpServers ? 1 : 0) +
    (agent.supports?.permissions ? 1 : 0) +
    (agent.supports?.projectConfig ? 1 : 0);

  return {
    recommendedModels,
    allModels,
    capabilitiesCount,
  };
}
