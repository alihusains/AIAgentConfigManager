# Parallel Adapter Detection — AgentControl

**Date:** 2026-08-31
**Change:** `packages/core/src/index.ts` — `detectAgents()` now runs through a
concurrency-limited pool (`mapWithConcurrency`, cap of 5) instead of an unbounded
`Promise.all`.

## TL;DR

Adapter detection was **already parallel** (unbounded `Promise.all`). The 2.2s
wall-clock was never a sequential scan — it is dominated by slow per-agent
`--version` subprocess probes. This change **bounds that parallelism to 5
in-flight adapters** to cap peak file-descriptor / process pressure, adds a
reusable `mapWithConcurrency` helper, and adds unit tests. Wall-clock improved
modestly (2.2s → ~1.9s) because the real cost is the slowest probes, not
parallelism.

## Before

`detectAgents()` used:

```ts
const results = await Promise.all(
  Array.from(this.adapters.keys()).map((id) => this.detectAgent(id))
);
```

All 24 adapters fired at once. Each `detectAgent()` spawns `which` (PATH
resolution) plus a `--version` probe (up to 15s timeout) and opens config files.
Unbounded, that burst is dozens of concurrent child processes + file handles.

Per-agent sequential work (measured, macOS M3):

| Agent      | ms   |
| ---------- | ---- |
| freebuff   | 1233 |
| mimo       | 1210 |
| chatgpt    | 883  |
| gemini     | 799  |
| kilo       | 720  |
| opencode   | 412  |
| omp        | 364  |
| pi         | 200  |
| claude-code| 149  |
| others     | <60 each |

Sum of per-agent work: **~6.4s**. With full parallelism, wall-clock ≈ the slowest
agent (freebuff ~1.2s) + process-spawn scheduling overhead → **~2.2s** observed.

## After

`detectAgents()` now maps through a worker pool of **5**:

```ts
const ids = Array.from(this.adapters.keys());
const results = await mapWithConcurrency(ids, DETECT_CONCURRENCY, (id) =>
  this.detectAgent(id).catch(() => null)
);
```

- **Concurrency cap = 5** (`DETECT_CONCURRENCY`): at most 5 adapters detect at
  once, bounding peak fds / child processes.
- **Order preserved**: results come back in adapter-map order, then sorted
  (installed-first, then by name) exactly as before.
- **Error isolation**: `.catch(() => null)` per item means one adapter failing
  can never abort the whole scan (each `detectAgent()` already isolates its own
  sub-steps; this is defense-in-depth).
- **Reusable primitive**: `mapWithConcurrency` is exported and unit-tested.

## Measured Results

`time node packages/cli/dist/index.js detect` (3 runs, macOS M3, 36 GB RAM):

| Run | Before (unbounded) | After (cap 5) |
| --- | ------------------ | ------------- |
| 1   | 3.34s              | 3.07s         |
| 2   | 2.20s              | 1.93s         |
| 3   | 2.13s              | 1.93s         |
| **Median** | **~2.2s**     | **~1.9s**     |

Runtime concurrency verification (24 items, cap 5): **peak in-flight = 5**,
order preserved.

## Why the speedup is modest (honest note)

The task brief assumed a *sequential* loop to parallelize. There was none —
detection was already fully parallel, so the 2.2s floor is set by the **slowest
`--version` probes** (freebuff, mimo, chatgpt, gemini, kilo each take 0.7–1.2s
just to answer `--version`). Capping parallelism trades a little wall-clock for
bounded resource pressure; it does not remove the probe cost.

### Where the real wins are (future, out of scope here)

1. **Skip / cache `--version`** — version rarely matters for *detection* (we
   only need "is it installed?"). Probing version is the dominant cost.
2. **Parallelize the multi-binary `which`** within an adapter (minor; most
   adapters have 1–2 binary names).
3. **TTL cache detection results** so repeated GUI `/api/state` calls are ~ms
   instead of re-probing (see `docs/performance/baseline-metrics.md`).

## Files Changed

- `packages/core/src/index.ts` — added `DETECT_CONCURRENCY`, exported
  `mapWithConcurrency`, rewired `detectAgents()` to use the pool.
- `packages/core/src/map-with-concurrency.test.ts` — new: 5 unit tests (order,
  cap, clamping, empty input, rejection propagation).

## Tests

- `pnpm --filter @ai-agent-config/core test` → **299 passed | 1 skipped**
- `pnpm build` → 3/3 packages green
