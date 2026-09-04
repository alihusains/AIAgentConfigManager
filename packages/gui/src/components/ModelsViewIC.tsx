/**
 * ModelsView Refactored — IC Signature Dual-Pane Theme
 *
 * Refactored model management interface using Infrastructure Control
 * plane design patterns. Dual-pane layout with model filters/list (left)
 * and selected model details/pricing (right).
 *
 * Features:
 * - Left pane: Model filters (provider, vision, capability, cost)
 * - Right pane: Live model comparison/pricing
 * - Real-time cost calculation
 * - Responsive: side-by-side desktop, stacked mobile
 * - WCAG AA accessibility
 */

import React, { useMemo, useState } from 'react';
import { Search, ZoomIn } from 'lucide-react';
import { useModels } from '../hooks/useModels';
import { TokenInfoDisplay, TokenPriceCard } from './TokenInfoDisplay';
import {
  DualPaneLayout,
  ControlPanel,
  ControlGroup,
  PreviewPane,
  StatusIndicator,
} from './';
import type { ExtendedModelInfo, ModelFilters, ModelSortOption } from '../types/models';
import { getModelCostTier, MODEL_CAPABILITIES } from '../types/models';

/**
 * ModelListItem — a single model row in the left pane
 */
interface ModelListItemProps {
  model: ExtendedModelInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function ModelListItem({ model, isSelected, onSelect }: ModelListItemProps) {
  const costTier = getModelCostTier(
    model.input_tokens_per_million,
    model.output_tokens_per_million
  );

  return (
    <div
      className={`px-4 py-3 border-b border-border cursor-pointer transition-colors ${
        isSelected ? 'bg-accent/5 border-l-2 border-l-accent' : 'hover:bg-bg-secondary/50'
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-primary truncate">
            {model.name}
          </div>
          <div className="text-xs text-tertiary font-mono truncate">
            {model.id}
          </div>
        </div>
        {model.vision_support && (
          <span className="flex-shrink-0 inline-block px-2 py-1 text-xs bg-accent/10 text-accent rounded font-medium whitespace-nowrap">
            Vision
          </span>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-secondary flex gap-2 flex-wrap">
        <span className="inline-block px-2 py-0.5 bg-bg-secondary rounded">
          {model.provider_name}
        </span>
        <span className="inline-block px-2 py-0.5 bg-bg-secondary rounded capitalize">
          {costTier}
        </span>
      </div>
    </div>
  );
}

/**
 * ModelDetailsPanel — right pane showing selected model details
 */
interface ModelDetailsPanelProps {
  model: ExtendedModelInfo;
}

function ModelDetailsPanel({ model }: ModelDetailsPanelProps) {
  const costTier = getModelCostTier(
    model.input_tokens_per_million,
    model.output_tokens_per_million
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="card">
        <h2 className="text-xl font-bold text-primary mb-1">
          {model.name}
        </h2>
        <p className="text-sm text-tertiary font-mono mb-4">
          {model.id}
        </p>

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="text-xs text-tertiary mb-1">Provider</div>
            <div className="font-medium text-primary text-sm">
              {model.provider_name}
            </div>
          </div>

          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="text-xs text-tertiary mb-1">Cost Tier</div>
            <div className="font-medium text-primary text-sm capitalize">
              {costTier}
            </div>
          </div>

          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="text-xs text-tertiary mb-1">Context</div>
            <div className="font-medium text-primary text-sm">
              {model.token_limit.toLocaleString()} tokens
            </div>
          </div>

          <div className="bg-bg-secondary rounded-lg p-3">
            <div className="text-xs text-tertiary mb-1">Vision</div>
            <div>
              {model.vision_support ? (
                <StatusIndicator status="connected" label="Yes" inline />
              ) : (
                <StatusIndicator status="disabled" label="No" inline />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {model.capabilities.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
            Capabilities
          </h3>
          <div className="flex flex-wrap gap-2">
            {model.capabilities.map((cap) => (
              <span
                key={cap}
                className="inline-block px-2 py-1 text-xs bg-accent/10 text-accent rounded font-medium"
              >
                {MODEL_CAPABILITIES[cap]?.name || cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div className="card">
        <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
          Pricing (per 1M tokens)
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-tertiary mb-1">Input</div>
            <div className="text-lg font-bold text-primary">
              ${model.input_tokens_per_million.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-tertiary mb-1">Output</div>
            <div className="text-lg font-bold text-primary">
              ${model.output_tokens_per_million.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Raw stats */}
      <div className="card">
        <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
          Details
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-tertiary">Status</span>
            <StatusIndicator
              status={model.recommended ? 'connected' : 'attention'}
              label={model.recommended ? 'Recommended' : 'Available'}
              inline
            />
          </div>
          <div className="flex justify-between">
            <span className="text-tertiary">Model ID</span>
            <span className="font-mono text-xs text-primary">{model.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tertiary">Provider</span>
            <span className="text-primary">{model.provider_name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ModelsViewIC — Main refactored component
 */
export const ModelsViewIC: React.FC = () => {
  const { models, loading, error } = useModels();
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(models[0]?.id);
  const [filters, setFilters] = useState<ModelFilters>({});
  const [sortBy, setSortBy] = useState<ModelSortOption>('recommended');
  const [searchQuery, setSearchQuery] = useState('');

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

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.provider_name.toLowerCase().includes(q)
      );
    }

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
  }, [models, filters, sortBy, searchQuery]);

  const selectedModel = filteredAndSortedModels.find((m) => m.id === selectedModelId);

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin mb-3 text-2xl">⏳</div>
            <p className="text-secondary">Loading models...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="card bg-error/5 border border-error/20">
          <p className="font-medium text-error mb-2">Error loading models</p>
          <p className="text-sm text-error/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title mb-2">AI Models</h1>
        <p className="text-secondary text-sm">
          Compare {models.length} models with live pricing and capability filtering.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="card">
          <div className="text-xs text-tertiary mb-2 uppercase tracking-widest font-semibold">
            Total
          </div>
          <div className="text-2xl font-bold text-primary">
            {models.length}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-tertiary mb-2 uppercase tracking-widest font-semibold">
            Vision
          </div>
          <div className="text-2xl font-bold text-accent">
            {models.filter((m) => m.vision_support).length}
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-tertiary mb-2 uppercase tracking-widest font-semibold">
            Recommended
          </div>
          <div className="text-2xl font-bold text-success">
            {models.filter((m) => m.recommended).length}
          </div>
        </div>
      </div>

      {/* Dual-pane layout */}
      <DualPaneLayout
        controlsPanel={
          <ControlPanel>
            {/* Search */}
            <ControlGroup label="Search">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tertiary"
                />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-bg-primary text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </ControlGroup>

            {/* Provider filter */}
            {uniqueProviders.length > 0 && (
              <ControlGroup label="Providers">
                {uniqueProviders.map((provider) => (
                  <label
                    key={provider}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.providers?.includes(provider) ?? false}
                      onChange={(e) => {
                        const newProviders = e.target.checked
                          ? [...(filters.providers || []), provider]
                          : (filters.providers || []).filter((p) => p !== provider);
                        setFilters({ ...filters, providers: newProviders });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-primary">{provider}</span>
                  </label>
                ))}
              </ControlGroup>
            )}

            {/* Vision support filter */}
            <ControlGroup>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.visionSupport ?? false}
                  onChange={(e) => {
                    setFilters({
                      ...filters,
                      visionSupport: e.target.checked || undefined,
                    });
                  }}
                  className="rounded"
                />
                <span className="text-sm font-medium text-primary">Vision Support Only</span>
              </label>
            </ControlGroup>

            {/* Capabilities filter */}
            {allCapabilities.length > 0 && (
              <ControlGroup label="Capabilities">
                {allCapabilities.map((capability) => (
                  <label
                    key={capability}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.capabilities?.includes(capability) ?? false}
                      onChange={(e) => {
                        const newCapabilities = e.target.checked
                          ? [...(filters.capabilities || []), capability]
                          : (filters.capabilities || []).filter((c) => c !== capability);
                        setFilters({ ...filters, capabilities: newCapabilities });
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-primary">
                      {MODEL_CAPABILITIES[capability]?.name || capability}
                    </span>
                  </label>
                ))}
              </ControlGroup>
            )}

            {/* Cost tier filter */}
            <ControlGroup label="Cost Tier">
              {(['budget', 'standard', 'premium'] as const).map((tier) => (
                <label key={tier} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.costTier === tier}
                    onChange={(e) => {
                      setFilters({
                        ...filters,
                        costTier: e.target.checked ? tier : undefined,
                      });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-primary capitalize">{tier}</span>
                </label>
              ))}
            </ControlGroup>

            {/* Sort */}
            <ControlGroup label="Sort By">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ModelSortOption)}
                className="px-3 py-2 text-sm rounded-lg border border-border bg-bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="recommended">Recommended First</option>
                <option value="name">Name (A-Z)</option>
                <option value="token_limit_desc">Token Limit (High)</option>
                <option value="cost_asc">Cost (Low to High)</option>
              </select>
            </ControlGroup>

            {/* Stats */}
            <div className="pt-4 border-t border-border">
              <div className="text-xs text-tertiary">
                <p>Showing {filteredAndSortedModels.length} model(s)</p>
              </div>
            </div>
          </ControlPanel>
        }
        previewPane={
          <PreviewPane
            isEmpty={!selectedModel}
            emptyIcon={<ZoomIn size={48} className="text-tertiary opacity-50" />}
            emptyMessage="Select a model to view details and pricing"
          >
            {selectedModel && (
              <ModelDetailsPanel model={selectedModel} />
            )}
          </PreviewPane>
        }
        controlsBasis="35%"
        previewBasis="65%"
      />

      {/* Model Grid (optional compact view below) */}
      {filteredAndSortedModels.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-secondary mb-4 uppercase tracking-widest">
            All Models
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedModels.map((model) => (
              <div
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className="cursor-pointer"
              >
                <TokenPriceCard
                  model={model}
                  isSelected={model.id === selectedModelId}
                  onClick={() => setSelectedModelId(model.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelsViewIC;
