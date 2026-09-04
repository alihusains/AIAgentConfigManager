import { describe, expect, it } from 'vitest';
import { diffFreeModels, isFreeModelId, tracksFreeModels, withFreeModelTracking } from './free-model-sync';
import type { ModelConfig, ModelProvider } from './types';

const model = (id: string, providerId = 'p1'): ModelConfig => ({
  id,
  providerId,
  name: id,
  roles: ['chat', 'edit', 'apply', 'summarize'],
  capabilities: ['tool_use'],
});

describe('free-model-sync', () => {
  describe('isFreeModelId', () => {
    it('matches ids containing "free" case-insensitively', () => {
      expect(isFreeModelId('gpt-4o-free')).toBe(true);
      expect(isFreeModelId('FREE-TIER-MODEL')).toBe(true);
      expect(isFreeModelId('freemium-x')).toBe(true);
    });

    it('rejects ids without "free"', () => {
      expect(isFreeModelId('gpt-4o')).toBe(false);
      expect(isFreeModelId('claude-sonnet')).toBe(false);
    });
  });

  describe('diffFreeModels', () => {
    it('adds fresh free ids and keeps existing free models', () => {
      const current = [model('old-free')];
      const { models, added, removed } = diffFreeModels(current, ['new-free', 'old-free', 'paid-x']);
      expect(added).toEqual(['new-free']);
      expect(removed).toEqual([]);
      expect(models.map((m) => m.id)).toEqual(['old-free', 'new-free']);
    });

    it('removes registered free models that vanished from the endpoint', () => {
      const current = [model('gone-free'), model('stay-free')];
      const { models, added, removed } = diffFreeModels(current, ['stay-free']);
      expect(added).toEqual([]);
      expect(removed).toEqual(['gone-free']);
      expect(models.map((m) => m.id)).toEqual(['stay-free']);
    });

    it('ALWAYS keeps non-free registered models (user-registered paid models)', () => {
      const current = [model('my-paid-model'), model('free-one')];
      const { models, removed } = diffFreeModels(current, ['free-one', 'free-two']);
      expect(models.map((m) => m.id)).toContain('my-paid-model');
      expect(removed).not.toContain('my-paid-model');
    });

    it('dedupes repeated endpoint ids', () => {
      const { models, added } = diffFreeModels([], ['dup-free', 'dup-free']);
      expect(added).toEqual(['dup-free']);
      expect(models.map((m) => m.id)).toEqual(['dup-free']);
    });
  });

  describe('tracking flag', () => {
    const provider = (): ModelProvider => ({
      id: 'p1',
      name: 'P1',
      type: 'openai-compatible',
      enabled: true,
      priority: 0,
      config: {},
    });

    it('withFreeModelTracking sets and clears the flag', () => {
      expect(tracksFreeModels(withFreeModelTracking(provider(), true))).toBe(true);
      expect(tracksFreeModels(withFreeModelTracking(provider(), false))).toBe(false);
      expect(tracksFreeModels(provider())).toBe(false);
    });

    it('does not mutate the original provider config', () => {
      const p = provider();
      withFreeModelTracking(p, true);
      expect(tracksFreeModels(p)).toBe(false);
    });
  });
});
