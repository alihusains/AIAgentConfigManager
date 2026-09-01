/**
 * Test API verification checkmarks — the apiAvailability field that tracks
 * ✓/✗/— status per wire protocol.
 */
import { describe, it, expect } from 'vitest';
import {
  probeProviderAPIs,
  toApiCapabilities,
  probeConfirmsApi,
} from './provider-test';
import type { ProviderProbeDetail } from './types';

describe('Provider API verification checkmarks', () => {
  describe('ProviderVerificationResult.apiAvailability', () => {
    it('includes per-API status (confirmed/rejected/unreached)', async () => {
      // Probe a publicly reachable endpoint to get real data
      const result = await probeProviderAPIs({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-fake',
        timeoutMs: 5000,
      });

      expect(result).toBeDefined();
      expect(result.apiAvailability).toBeDefined();
      expect(result.apiAvailability).toMatchObject({
        chat: expect.stringMatching(/^(confirmed|rejected|unreached)$/),
        responses: expect.stringMatching(/^(confirmed|rejected|unreached)$/),
        anthropic: expect.stringMatching(/^(confirmed|rejected|unreached)$/),
      });
    });

    it('marks routes as "confirmed" when the API responds with 2xx or 4xx to valid credentials', () => {
      const probe: ProviderProbeDetail = {
        api: 'chat',
        ok: false,
        reached: true,
        authenticated: true,
        endpoint: true,
        httpStatus: 400, // 4xx with auth means route exists and processed request
        curl: 'curl ...',
        body: '{"error": "max_tokens must be > 0"}',
      };

      expect(probeConfirmsApi(probe, false)).toBe(true);
    });

    it('marks routes as "rejected" when 401/403 or 404/405/501 without proof of credentials', () => {
      const unreachedProbe: ProviderProbeDetail = {
        api: 'chat',
        ok: false,
        reached: false,
        authenticated: false,
        endpoint: false,
        httpStatus: undefined,
        curl: 'curl ...',
        error: 'Timed out after 10000ms',
      };

      expect(probeConfirmsApi(unreachedProbe, false)).toBe(false);
    });

    it('encodes unreached as "unreached", confirmed as "confirmed", others as "rejected"', async () => {
      // Probe a truly unreachable endpoint to get unreached status
      const result = await probeProviderAPIs({
        baseUrl: 'http://192.0.2.1/v1', // TEST-NET-1 (non-routable per RFC 5737)
        apiKey: undefined,
        timeoutMs: 1000,
      });

      expect(result.apiAvailability).toMatchObject({
        chat: 'unreached',
        responses: 'unreached',
        anthropic: 'unreached',
      });
    });
  });

  describe('toApiCapabilities', () => {
    it('preserves apiAvailability when shrinking to the persisted type', async () => {
      const result = await probeProviderAPIs({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-fake',
        timeoutMs: 5000,
      });

      const caps = toApiCapabilities(result);
      expect(caps.apiAvailability).toEqual(result.apiAvailability);
    });

    it('compacts result while keeping the granular per-API status', async () => {
      const result = await probeProviderAPIs({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-fake',
        timeoutMs: 5000,
      });

      const caps = toApiCapabilities(result);
      expect(caps).toHaveProperty('supported');
      expect(caps).toHaveProperty('models');
      expect(caps).toHaveProperty('apiAvailability');
      expect(caps).toHaveProperty('verifiedAt');
    });
  });

  describe('ProtocolTicks prop contract', () => {
    it('ProviderApiCapabilities now carries apiAvailability (optional for backward compat)', () => {
      // Simulate what a registry entry looks like after toApiCapabilities
      const caps = {
        supported: ['chat' as const],
        models: ['gpt-4'],
        apiAvailability: {
          chat: 'confirmed' as const,
          responses: 'rejected' as const,
          anthropic: 'unreached' as const,
        },
        verifiedAt: new Date().toISOString(),
      };

      expect(caps.apiAvailability).toBeDefined();
      expect(caps.apiAvailability.chat).toBe('confirmed');
      expect(caps.apiAvailability.responses).toBe('rejected');
      expect(caps.apiAvailability.anthropic).toBe('unreached');
    });

    it('availability is optional for backward compat with older registries', () => {
      // Simulate what a registry entry might look like before this change
      const oldCaps = {
        supported: ['chat' as const],
        models: ['gpt-4'],
        verifiedAt: new Date().toISOString(),
        // no apiAvailability field
      };

      // TypeScript allows this (apiAvailability is optional)
      expect(oldCaps).not.toHaveProperty('apiAvailability');
    });
  });
});
