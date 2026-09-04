/**
 * ModelsView Component
 *
 * Comprehensive view of all available AI models with filtering, sorting,
 * pricing information, and capability details.
 *
 * Features:
 * - Filter by provider, vision support, capabilities, and cost tier
 * - Sort by name, token limit, cost, or recommended status
 * - Display comprehensive model metadata
 * - Show token pricing and cost estimates
 * - Link to provider details
 */

import React, { useMemo, useState } from 'react';
import { useModels } from '../hooks/useModels';
import { TokenInfoDisplay, TokenPriceCard } from './TokenInfoDisplay';
import type { ExtendedModelInfo, ModelFilters, ModelSortOption } from '../types/models';
import { getModelCostTier, MODEL_CAPABILITIES, MODEL_STATUS } from '../types/models';

// ============================================================================
// Component Interfaces
// ============================================================================

interface ModelGridProps {
  models: ExtendedModelInfo[];
  selectedModelId?: string;
  onSelectModel: (modelId: string) => void;
}

interface ModelFilterBarProps {
  filters: ModelFilters;
  onFiltersChange: (filters: ModelFilters) => void;
  providers: string[];
  allCapabilities: string[];
}

interface ModelSortBarProps {
  sortBy: ModelSortOption;
  onSortChange: (sortBy: ModelSortOption) => void;
}

// ============================================================================
// Helper Components
// ============================================================================

const ModelFilterBar: React.FC<ModelFilterBarProps> = ({
  filters,
  onFiltersChange,
  providers,
  allCapabilities,
}) => {
  return (
    <div className="space-y-5 p-5 rounded-xl border border-border-primary bg-bg-secondary">
      <h3 className="font-semibold text-sm tracking-wide text-text-primary">Filters</h3>

      {/* Provider filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Providers</label>
        <div className="space-y-2">
          {providers.map((provider) => (
            <label key={provider} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.providers?.includes(provider) ?? false}
                onChange={(e) => {
                  const newProviders = e.target.checked
                    ? [...(filters.providers || []), provider]
                    : (filters.providers || []).filter((p) => p !== provider);
                  onFiltersChange({ ...filters, providers: newProviders });
                }}
                className="rounded"
              />
              <span className="text-sm">{provider}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Vision support filter */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.visionSupport ?? false}
            onChange={(e) => {
              onFiltersChange({ ...filters, visionSupport: e.target.checked || undefined });
            }}
            className="rounded"
          />
          <span className="text-sm font-medium">Vision Support Only</span>
        </label>
      </div>

      {/* Capabilities filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Capabilities</label>
        <div className="space-y-2">
          {allCapabilities.map((capability) => (
            <label key={capability} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.capabilities?.includes(capability) ?? false}
                onChange={(e) => {
                  const newCapabilities = e.target.checked
                    ? [...(filters.capabilities || []), capability]
                    : (filters.capabilities || []).filter((c) => c !== capability);
                  onFiltersChange({ ...filters, capabilities: newCapabilities });
                }}
                className="rounded"
              />
              <span className="text-sm">
                {MODEL_CAPABILITIES[capability]?.name || capability}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Cost tier filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Cost Tier</label>
        <div className="space-y-2">
          {(['budget', 'standard', 'premium'] as const).map((tier) => (
            <label key={tier} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.costTier === tier}
                onChange={(e) => {
                  onFiltersChange({ ...filters, costTier: e.target.checked ? tier : undefined });
                }}
                className="rounded"
              />
              <span className="text-sm capitalize">{tier}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

const ModelSortBar: React.FC<ModelSortBarProps> = ({ sortBy, onSortChange }) => {
  const sortOptions: Array<{ value: ModelSortOption; label: string }> = [
    { value: 'recommended', label: 'Recommended First' },
    { value: 'name', label: 'Name (A-Z)' },
    { value: 'token_limit_desc', label: 'Token Limit (High)' },
    { value: 'cost_asc', label: 'Cost (Low to High)' },
  ];

  return (
    <div className="flex items-center gap-4 p-5 rounded-xl border border-border-primary bg-bg-secondary">
      <label className="text-sm font-medium text-text-primary whitespace-nowrap">Sort by:</label>
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as ModelSortOption)}
        className="px-3 py-2 text-sm rounded-lg border border-border-primary bg-bg-primary text-text-primary font-medium transition-colors hover:border-border-secondary"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const ModelGrid: React.FC<ModelGridProps> = ({ models, selectedModelId, onSelectModel }) => {
  if (models.length === 0) {
    return (
      <div className="text-center p-8 text-text-tertiary">
        <p>No models match the selected filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {models.map((model) => (
        <div key={model.id} onClick={() => onSelectModel(model.id)}>
          <TokenPriceCard
            model={model}
            isSelected={model.id === selectedModelId}
            onClick={() => onSelectModel(model.id)}
          />
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Main ModelsView Component
// ============================================================================

export const ModelsView: React.FC = () => {
  const { models, loading, error } = useModels();
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(models[0]?.id);
  const [filters, setFilters] = useState<ModelFilters>({});
  const [sortBy, setSortBy] = useState<ModelSortOption>('recommended');
  const [showDetails, setShowDetails] = useState(false);

  // Extract unique providers and capabilities
  const uniqueProviders = useMemo(
    () => [...new Set(models.map((m) => m.provider_name))].sort(),
    [models]
  );

  const allCapabilities = useMemo(() => {
    const caps = new Set<string>();
    models.forEach((m) => m.capabilities.forEach((c) => caps.add(c)));
    return Array.from(caps).sort();
  }, [models]);

  // Filter and sort models
  const filteredAndSortedModels = useMemo(() => {
    let result = [...models];

    // Apply filters
    if (filters.providers && filters.providers.length > 0) {
      result = result.filter((m) => filters.providers?.includes(m.provider_name));
    }
    if (filters.visionSupport) {
      result = result.filter((m) => m.vision_support);
    }
    if (filters.capabilities && filters.capabilities.length > 0) {
      result = result.filter((m) =>
        filters.capabilities?.some((c) => m.capabilities.includes(c))
      );
    }
    if (filters.costTier) {
      result = result.filter((m) => {
        const tier = getModelCostTier(
          m.input_tokens_per_million,
          m.output_tokens_per_million
        );
        return tier === filters.costTier;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'token_limit_asc':
          return a.token_limit - b.token_limit;
        case 'token_limit_desc':
          return b.token_limit - a.token_limit;
        case 'cost_asc':
          return (a.input_tokens_per_million + a.output_tokens_per_million) -
                 (b.input_tokens_per_million + b.output_tokens_per_million);
        case 'cost_desc':
          return (b.input_tokens_per_million + b.output_tokens_per_million) -
                 (a.input_tokens_per_million + a.output_tokens_per_million);
        case 'recommended':
          return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
        default:
          return 0;
      }
    });

    return result;
  }, [models, filters, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary">
        <div className="text-center">
          <div className="animate-spin mb-3">⏳</div>
          <p>Loading models...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-accent-error/10 border border-accent-error">
        <p className="text-accent-error font-medium">Error loading models</p>
        <p className="text-sm text-accent-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header: Refined typography hierarchy — responsive text sizing */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2 text-text-primary">
          AI Models
        </h1>
        <p className="text-sm sm:text-base text-text-secondary max-w-[65ch]">
          Comprehensive comparison of {models.length} available models with detailed pricing and capabilities
        </p>
      </div>

      {/* Stats: Asymmetric layout with varied visual weight (not three equal cards) — mobile responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {/* Primary stat: Total models — larger emphasis */}
        <div className="md:col-span-2 p-6 rounded-xl bg-bg-secondary border border-border-primary">
          <p className="text-sm font-medium text-text-secondary tracking-wide">Total Models</p>
          <p className="text-4xl font-bold text-accent-primary mt-2">{models.length}</p>
          <p className="text-xs text-text-tertiary mt-2">in our catalog</p>
        </div>

        {/* Secondary stats: Vision & Recommended — equal smaller size */}
        <div className="p-5 rounded-xl bg-bg-secondary border border-border-primary">
          <p className="text-sm font-medium text-text-secondary tracking-wide">Vision</p>
          <p className="text-3xl font-bold text-accent-primary mt-2">
            {models.filter((m) => m.vision_support).length}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-bg-secondary border border-border-primary">
          <p className="text-sm font-medium text-text-secondary tracking-wide">Recommended</p>
          <p className="text-3xl font-bold text-accent-primary mt-2">
            {models.filter((m) => m.recommended).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left sidebar: Filters — collapsible on mobile if needed */}
        <div className="md:col-span-1">
          <ModelFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            providers={uniqueProviders}
            allCapabilities={allCapabilities}
          />
        </div>

        {/* Main content: Models grid and details */}
        <div className="md:col-span-2 lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Sort bar */}
          <ModelSortBar sortBy={sortBy} onSortChange={setSortBy} />

          {/* Models grid */}
          <ModelGrid
            models={filteredAndSortedModels}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
          />

          {/* Results count */}
          <p className="text-sm text-text-secondary font-medium">
            Showing <span className="font-semibold text-text-primary">{filteredAndSortedModels.length}</span> of <span className="font-semibold text-text-primary">{models.length}</span> models
          </p>

          {/* Toggle details: Premium button styling */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2.5 rounded-lg border border-border-primary hover:bg-bg-tertiary text-sm font-medium transition-colors duration-150 text-text-secondary hover:text-text-primary"
          >
            {showDetails ? 'Hide Pricing Details' : 'Show Pricing Details'}
          </button>

          {/* Token pricing details */}
          {showDetails && selectedModelId && (
            <TokenInfoDisplay
              selectedModelId={selectedModelId}
              allModels={filteredAndSortedModels}
              onSelectModel={setSelectedModelId}
            />
          )}
        </div>
      </div>
    </div>
  );
};
