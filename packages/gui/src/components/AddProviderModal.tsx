import { useState, useEffect } from 'react';
import { Plus, Search, X, ChevronLeft } from 'lucide-react';
import { KNOWN_PROVIDERS, KnownProvider } from '../data/known-providers';
import { CustomProviderForm } from './CustomProviderForm';
import type { DetectedAgent } from '@ai-agent-config/core';
import { Tooltip } from '../ui';

interface AddProviderModalProps {
  onClose: () => void;
  agents: DetectedAgent[];
  existingIds: string[];
}

interface CatalogProvider {
  id: string;
  name: string;
  base_url: string;
  logo_url?: string;
  description?: string;
  models?: Array<{ name: string }>;
}

export function AddProviderModal({ onClose, agents, existingIds }: AddProviderModalProps) {
  const [stage, setStage] = useState<'selection' | 'configuration'>('selection');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<KnownProvider | null>(null);
  const [catalogProviders, setCatalogProviders] = useState<CatalogProvider[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Load catalog providers on mount
  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const response = await fetch('/api/providers/catalog');
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.data?.providers) {
            setCatalogProviders(data.data.providers);
          }
        }
      } catch (error) {
        console.error('Failed to load provider catalog:', error);
      } finally {
        setLoadingCatalog(false);
      }
    };
    loadCatalog();
  }, []);

  // Group providers by category
  const categories = Array.from(
    new Set(KNOWN_PROVIDERS.map((p) => p.category))
  ).sort();

  // Filter providers
  const filtered = KNOWN_PROVIDERS.filter((p) => {
    const matchesSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory || p.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categoryGroups = categories.reduce(
    (acc, cat) => {
      acc[cat] = filtered.filter((p) => p.category === cat);
      return acc;
    },
    {} as Record<string, KnownProvider[]>
  );

  const categoryLabels: Record<string, string> = {
    popular: '⭐ Popular',
    specialized: '🎯 Specialized',
    enterprise: '🏢 Enterprise',
    opensource: '🔓 Open Source',
    local: '💻 Local',
    emerging: '🚀 Emerging',
  };

  const handleSelectProvider = (provider: KnownProvider) => {
    setSelectedProvider(provider);
    setStage('configuration');
  };

  const handleBack = () => {
    setSelectedProvider(null);
    setStage('selection');
  };

  if (stage === 'configuration' && selectedProvider) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal modal-lg"
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          <div className="modal-header">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <h2 className="modal-title">Configure {selectedProvider.name}</h2>
            <button className="modal-close" onClick={onClose}>
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <CustomProviderForm
              onClose={onClose}
              agents={agents}
              existingIds={existingIds}
              prefilledProvider={{
                name: selectedProvider.name,
                baseUrl: selectedProvider.baseUrl,
                logoUrl: selectedProvider.logo,
                apiType: selectedProvider.type === 'anthropic-compatible' 
                  ? 'anthropic-compatible' 
                  : 'openai-compatible',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header">
          <h2 className="modal-title">Add Provider from Catalog</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 pt-4 pb-2 border-b">
          <div className="flex items-center gap-2 bg-bg-subtle rounded-lg px-3 py-2">
            <Search size={16} className="text-tertiary" />
            <input
              type="text"
              placeholder="Search providers..."
              className="flex-1 bg-transparent outline-none text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-bg-hover rounded"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="px-6 pt-3 pb-2 flex flex-wrap gap-2 border-b">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedCategory === null
                ? 'bg-primary text-white'
                : 'bg-bg-subtle text-secondary hover:bg-bg-hover'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-bg-subtle text-secondary hover:bg-bg-hover'
              }`}
            >
              {categoryLabels[cat] || cat}
            </button>
          ))}
        </div>

        {/* Provider List */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '1.5rem' }}
        >
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-secondary text-sm">No providers found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(categoryGroups).map(([category, providers]) =>
                providers.length > 0 ? (
                  <div key={category}>
                    <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-2">
                      {categoryLabels[category] || category}
                    </h3>
                    <div className="space-y-2">
                      {providers.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => handleSelectProvider(provider)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-bg-hover transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm group-hover:text-primary transition-colors">
                                {provider.name}
                              </p>
                              <p className="text-xs text-secondary mt-0.5 line-clamp-2">
                                {provider.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-mono ${
                                  provider.type === 'openai-compatible'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                    : provider.type === 'anthropic-compatible'
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200'
                                }`}
                              >
                                {provider.type === 'openai-compatible'
                                  ? 'OpenAI'
                                  : provider.type === 'anthropic-compatible'
                                    ? 'Anthropic'
                                    : 'Native'}
                              </span>
                            </div>
                          </div>
                          {provider.notes && (
                            <p className="text-xs text-tertiary mt-2">
                              💡 {provider.notes}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>

        <div className="modal-footer border-t">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
