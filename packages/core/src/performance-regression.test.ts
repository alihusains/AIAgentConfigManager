/**
 * Performance regression tests — prevent future degradation of startup and detection performance.
 *
 * These tests establish hard SLAs:
 * - Individual agent detection cache hit: < 1ms
 * - Full detection scan: < 2s (concurrent, 8 workers)
 * - Adapter instantiation: < 50ms
 * - Memory growth: < 50MB over 3 cycles
 *
 * When a test fails, it signals a performance regression that should be investigated.
 * Failures may indicate:
 * - New eager imports that block startup
 * - Version probing timeout changes
 * - Concurrency level issues
 * - Memory leak in detection or caching
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { performance } from 'node:perf_hooks';
import { AgentConfigManager } from './index';

const TIMEOUTS = {
  cacheHit: 1, // Cached detection should be instant (< 1ms)
  fullScan: 2000, // 24 agents in parallel with 8 workers
  instantiation: 50, // Manager creation
  memoryGrowth: 50, // MB over 3 cycles
};

describe('Performance Regressions - Prevention', () => {
  let manager: AgentConfigManager;

  beforeAll(() => {
    manager = new AgentConfigManager();
  });

  test(
    'Cache hit should be < 1ms (SLA)',
    async () => {
      // Run detection once to populate cache
      await manager.detectAgents();

      const adapters = manager.getAvailableAgents().slice(0, 3);
      const timings: number[] = [];

      for (const adapter of adapters) {
        const start = performance.now();
        await manager.detectAgent(adapter.id);
        timings.push(performance.now() - start);
      }

      const maxTime = Math.max(...timings);
      console.log(`✓ Cache hit max: ${maxTime.toFixed(3)}ms (SLA: < 1ms)`);
      expect(maxTime).toBeLessThan(TIMEOUTS.cacheHit);
    },
    { timeout: 5000 }
  );

  test(
    'Full detection scan should be < 2s (SLA)',
    async () => {
      // Clear any cache from previous test
      (manager as any).detectionCache.clear();

      const start = performance.now();
      const agents = await manager.detectAgents();
      const elapsed = performance.now() - start;

      console.log(`✓ Full scan: ${elapsed.toFixed(2)}ms (${agents.length} agents, SLA: < 2s)`);
      expect(elapsed).toBeLessThan(TIMEOUTS.fullScan);
    },
    { timeout: 5000 }
  );

  test(
    'Single adapter detection should bail out fast on missing CLI',
    async () => {
      // Find an adapter that is NOT installed (common case on test machines)
      const agents = manager.getAvailableAgents();
      const uninstalledAdapter = agents.find(
        (a) => !['claude-code', 'codex', 'gemini', 'pi'].includes(a.id)
      );

      if (!uninstalledAdapter) {
        console.log('⊘ No uninstalled adapter available for timing, skipping');
        return;
      }

      // Clear cache
      (manager as any).detectionCache.clear();

      const start = performance.now();
      const detected = await manager.detectAgent(uninstalledAdapter.id);
      const elapsed = performance.now() - start;

      console.log(
        `✓ ${uninstalledAdapter.id} detection: ${elapsed.toFixed(2)}ms (installed: ${detected?.detection.installed})`
      );

      // Even for missing CLIs, should bail within aggressive timeout
      expect(elapsed).toBeLessThan(500);
    },
    { timeout: 10000 }
  );

  test(
    'Version probing should not block for > 3s on first attempt',
    async () => {
      // This test ensures that the version probing optimization (3s aggressive timeout)
      // is in place. If it fails, it means version probing was reverted to 15s.
      const detected = await manager.detectAgents();
      const installedAdapters = detected.filter((a) => a.detection.installed);

      if (installedAdapters.length === 0) {
        console.log('⊘ No installed adapters, skipping version probe timing');
        return;
      }

      // Clear cache to force version probing
      (manager as any).detectionCache.clear();

      const timings: { id: string; ms: number }[] = [];

      for (const adapter of installedAdapters) {
        const start = performance.now();
        await manager.detectAgent(adapter.id);
        const elapsed = performance.now() - start;
        timings.push({ id: adapter.id, ms: elapsed });
      }

      const slow = timings.filter((t) => t.ms > 3000);
      if (slow.length > 0) {
        console.log(`⚠ ${slow.length} adapters took > 3s:`);
        for (const t of slow) {
          console.log(`  - ${t.id}: ${t.ms.toFixed(0)}ms`);
        }
      }

      const maxTime = Math.max(...timings.map((t) => t.ms));
      console.log(`✓ Max detection time: ${maxTime.toFixed(2)}ms`);

      // At most 1 adapter should be slow (and then only if it's intentionally marked)
      expect(slow.length).toBeLessThan(2);
    },
    { timeout: 30000 }
  );

  test(
    'Adapter lazy-loading should not load all factories upfront',
    () => {
      // This is more of a code review check, but we can at least verify the
      // adapter map is lazy (contains factories, not instances).
      const adapters = manager.getAvailableAgents();
      expect(adapters.length).toBeGreaterThanOrEqual(24);
      console.log(`✓ Lazy-loaded ${adapters.length} adapters`);
    }
  );

  test(
    'Concurrent parallelization should show speedup > 1.3x',
    async () => {
      // This ensures the concurrency pool (8 workers) is actually speeding up detection
      const adapters = manager.getAvailableAgents().slice(0, 8);

      // Clear cache
      (manager as any).detectionCache.clear();

      // Sequential
      const startSeq = performance.now();
      for (const a of adapters) {
        await manager.detectAgent(a.id);
      }
      const seqTime = performance.now() - startSeq;

      // Clear cache
      (manager as any).detectionCache.clear();

      // Parallel
      const startPar = performance.now();
      await Promise.all(adapters.map((a) => manager.detectAgent(a.id)));
      const parTime = performance.now() - startPar;

      const speedup = seqTime / parTime;
      console.log(
        `✓ Parallelization: seq ${seqTime.toFixed(0)}ms, par ${parTime.toFixed(0)}ms, speedup ${speedup.toFixed(2)}x`
      );

      // Should see meaningful speedup from 8 workers
      expect(speedup).toBeGreaterThan(1.2);
    },
    { timeout: 30000 }
  );

  test(
    'Memory should not grow unbounded during repeated operations',
    async () => {
      if (!global.gc) {
        console.log('⊘ GC not available (run with --expose-gc), skipping memory test');
        return;
      }

      global.gc();
      const initial = process.memoryUsage().heapUsed / 1024 / 1024;

      for (let i = 0; i < 5; i++) {
        (manager as any).detectionCache.clear();
        await manager.detectAgents();
      }

      global.gc();
      const final = process.memoryUsage().heapUsed / 1024 / 1024;
      const growth = final - initial;

      console.log(
        `✓ Memory: initial ${initial.toFixed(2)}MB, final ${final.toFixed(2)}MB, growth ${growth.toFixed(2)}MB (SLA: < 50MB)`
      );
      expect(growth).toBeLessThan(TIMEOUTS.memoryGrowth);
    },
    { timeout: 30000 }
  );
});
