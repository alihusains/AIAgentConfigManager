/**
 * Hook for accessing the known providers catalog with search and filtering
 */

import { useMemo, useState } from 'react';
import {
  KNOWN_PROVIDERS,
  getPopularProviders,
  searchProviders,
  getProviderById,
  groupProvidersByCategory,
  KnownProvider,
} from '../data/known-providers';

export interface UseProviderCatalogOptions {
  sortBy?: 'popular' | 'alphabetical' | 'category';
  filterCategory?: string;
}

export function useProviderCatalog(options: UseProviderCatalogOptions = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    options.filterCategory || null
  );

  // Filter and sort providers
  const filteredProviders = useMemo(() => {
    let providers = searchQuery ? searchProviders(searchQuery) : [...KNOWN_PROVIDERS];

    if (selectedCategory) {
      providers = providers.filter((p) => p.category === selectedCategory);
    }

    if (options.sortBy === 'alphabetical') {
      providers.sort((a, b) => a.name.localeCompare(b.name));
    } else if (options.sortBy === 'category') {
      const categoryOrder: Record<string, number> = {
        popular: 0,
        enterprise: 1,
        opensource: 2,
        local: 3,
      };
      providers.sort(
        (a, b) => (categoryOrder[a.category] ?? 999) - (categoryOrder[b.category] ?? 999)
      );
    } else {
      // Default: sort by popular
      providers = getPopularProviders().filter((p) =>
        searchQuery ? searchProviders(searchQuery).some((sp) => sp.id === p.id) : true
      );
      if (selectedCategory) {
        providers = providers.filter((p) => p.category === selectedCategory);
      }
    }

    return providers;
  }, [searchQuery, selectedCategory, options.sortBy]);

  // Group by category for UI display
  const groupedProviders = useMemo(() => groupProvidersByCategory(), []);

  return {
    // State
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,

    // Data
    allProviders: KNOWN_PROVIDERS,
    filteredProviders,
    groupedProviders,
    categories: Object.keys(groupedProviders),
    popularProviders: getPopularProviders(),

    // Queries
    getProviderById,
    searchProviders,
    providerCount: filteredProviders.length,
    totalProviders: KNOWN_PROVIDERS.length,
  };
}
