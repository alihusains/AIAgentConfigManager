/**
 * Integration tests for major features
 */

import { describe, it, expect } from 'vitest';
import {
  KNOWN_PROVIDERS,
  getPopularProviders,
  searchProviders,
  getProviderById,
  groupProvidersByCategory,
} from './data/known-providers';

describe('Provider Catalog Integration', () => {
  it('should have at least 15 providers', () => {
    expect(KNOWN_PROVIDERS.length).toBeGreaterThanOrEqual(15);
  });

  it('should have all required provider fields', () => {
    KNOWN_PROVIDERS.forEach((provider) => {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('description');
      expect(provider).toHaveProperty('type');
      expect(provider).toHaveProperty('baseUrl');
      expect(provider).toHaveProperty('category');
      expect(provider).toHaveProperty('supportsModels');
      expect(provider).toHaveProperty('requiresAuth');
    });
  });

  it('should have unique provider IDs', () => {
    const ids = KNOWN_PROVIDERS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should group providers by category', () => {
    const grouped = groupProvidersByCategory();
    expect(Object.keys(grouped).length).toBeGreaterThan(0);
    expect(grouped).toHaveProperty('popular');
  });

  it('should return popular providers sorted correctly', () => {
    const popular = getPopularProviders();
    expect(popular.length).toBeGreaterThan(0);
    expect(popular[0].category).toBe('popular');
  });

  it('should search providers by name', () => {
    const results = searchProviders('openai');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.name.toLowerCase().includes('openai'))).toBe(true);
  });

  it('should search providers by description', () => {
    const results = searchProviders('local');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.description.toLowerCase().includes('local'))).toBe(true);
  });

  it('should get provider by ID', () => {
    const provider = getProviderById('openai');
    expect(provider).toBeDefined();
    expect(provider?.name).toBe('OpenAI');
  });

  it('should return undefined for non-existent provider', () => {
    const provider = getProviderById('non-existent-provider');
    expect(provider).toBeUndefined();
  });

  it('should have valid base URLs', () => {
    KNOWN_PROVIDERS.forEach((provider) => {
      expect(provider.baseUrl).toMatch(/^(https?:\/\/|\/\/)/);
    });
  });

  it('should have valid types', () => {
    const validTypes = ['openai-compatible', 'anthropic-compatible', 'native'];
    KNOWN_PROVIDERS.forEach((provider) => {
      expect(validTypes).toContain(provider.type);
    });
  });

  it('should have valid categories', () => {
    const validCategories = [
      'popular',
      'opensource',
      'local',
      'enterprise',
      'emerging',
      'specialized',
    ];
    KNOWN_PROVIDERS.forEach((provider) => {
      expect(validCategories).toContain(provider.category);
    });
  });

  it('should include major providers', () => {
    const majorProviders = ['openai', 'openrouter', 'anthropic', 'mistral'];
    majorProviders.forEach((id) => {
      expect(getProviderById(id)).toBeDefined();
    });
  });

  it('should include local hosting options', () => {
    const local = KNOWN_PROVIDERS.filter((p) => p.category === 'local');
    expect(local.length).toBeGreaterThan(0);
    expect(local.some((p) => p.name.toLowerCase().includes('ollama'))).toBe(true);
  });

  it('should include enterprise options', () => {
    const enterprise = KNOWN_PROVIDERS.filter((p) => p.category === 'enterprise');
    expect(enterprise.length).toBeGreaterThan(0);
  });
});

describe('Provider Catalog Search Performance', () => {
  it('should search quickly even with large catalog', () => {
    const start = performance.now();
    const results = searchProviders('model');
    const end = performance.now();
    expect(end - start).toBeLessThan(10); // Should be instant (< 10ms)
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle empty search results gracefully', () => {
    const results = searchProviders('xyzabc123notfound');
    expect(results).toEqual([]);
  });

  it('should be case-insensitive', () => {
    const lowercase = searchProviders('openai');
    const uppercase = searchProviders('OPENAI');
    expect(lowercase.length).toBe(uppercase.length);
  });
});
