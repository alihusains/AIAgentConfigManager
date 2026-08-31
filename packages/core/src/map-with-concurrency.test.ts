/**
 * Unit tests for the concurrency-limited mapper used by detectAgents().
 * Verifies the pool respects the concurrency cap, preserves item order,
 * and propagates worker rejections (per-item isolation is the caller's job).
 */
import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './index';

describe('mapWithConcurrency', () => {
  it('returns results in the same order as the input items', async () => {
    const items = [50, 10, 30, 20, 40];
    const results = await mapWithConcurrency(items, 3, async (n) => {
      // Varying delays force out-of-order completion; the pool must re-order.
      await new Promise((r) => setTimeout(r, n));
      return n * 2;
    });
    expect(results).toEqual([100, 20, 60, 40, 80]);
  });

  it('never runs more than `concurrency` workers at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('clamps concurrency to the item count (no idle workers)', async () => {
    let calls = 0;
    // concurrency 10 > 2 items → should still just map the 2 items.
    const results = await mapWithConcurrency(['a', 'b'], 10, async (s) => {
      calls += 1;
      return s.toUpperCase();
    });
    expect(results).toEqual(['A', 'B']);
    expect(calls).toBe(2);
  });

  it('handles an empty input without spawning workers', async () => {
    const results = await mapWithConcurrency<number, number>([], 5, async (n) => n);
    expect(results).toEqual([]);
  });

  it('propagates a worker rejection (caller isolates per-item)', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });
});
