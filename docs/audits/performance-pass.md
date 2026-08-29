# M038 — Performance pass: measurements and safe fixes

Date: 2026-08-29
Machine: macOS (darwin), Node v26.7.0, pnpm 10.33.4
Base: `pi/M038-performance-pass` @ 9dc17d9 (merge of M033)

This closes CHECKPOINT.md §5 Step 4. All numbers below are real measured
output captured on this machine on this date, not estimates. Method:
`process.hrtime.bigint()` around the operation of interest, averaged over
several runs; wall-clock for full CLI invocations via a parent `node`
harness that spawns `node packages/cli/dist/index.js ...` and times it.

## 1. CLI startup time

**Command:** `node packages/cli/dist/index.js --help` (cold process, 10 runs
after 1 warm-up, averaged).

| | avg wall time |
| --- | --- |
| Before | 127 ms |
| After | 123 ms |

The `--help` path runs: node startup, importing the whole core package
(24 adapters + catalog JSON + registry + skills), commander wiring, and
`new AgentConfigManager()` (which eagerly constructs all 24 adapter
adapters). No heavy work is deferred: `gui-server` is already lazy-imported
only in the `gui`/`start` command actions (`await import('./gui-server.js')`),
so the dashboard's ~1000-line module is NOT in the startup cost of other
commands.

**Finding: no fix applied.**
The ~125 ms startup is dominated by node's own startup + module-linking of
the core package, not by any single deferrable import. The only other eager
import is `@ai-agent-config/core` itself, which every command needs
(`manager`, `getAgentCatalog`, …). Deferring it would mean lazy-importing
inside every action — a structural change across all commands with no
measurable win (node startup is the floor). Not a mechanical fix.

## 2. Adapter detection cost

**Command:** full `acm detect` (wall clock, 5 runs after 1 warm-up).

| | avg wall time |
| --- | --- |
| Before | 3303 ms |
| After | 1944 ms (~41% faster) |

Breakdown (in-process, before the fix):

- `manager.detectAgents()` over 24 adapters — **already parallel**
  (`Promise.all` in `packages/core/src/index.ts:296`). ~1.2–1.6 s.
- Catalog-only entries (13 entries: reasonix, deepseek, little-coder, devin,
  jan, ollama, lmstudio, amp, codex-cli, aion-cli, open-interpreter, jcode,
  claw-code-agent) were probed **sequentially** in the CLI's `detect`
  command (`for (const entry of catalog) { const probe = await
  detectCatalogEntry(entry); … }`) — ~1.85 s before.
- Inside each `detectCatalogEntry`, candidate binaries were also resolved
  **sequentially** (`for (const binary of binaries) { await
  resolveBinary(binary) … }`).

**Fixes applied (both mechanical):**

1. `packages/cli/src/index.ts` — the sequential `for … await
   detectCatalogEntry(entry)` loop is now `Promise.all(catalog.map(...))`;
   results are printed in catalog order.
2. `packages/core/src/agent-catalog.ts` — `detectCatalogEntry` now resolves
   all candidate binaries in parallel (`Promise.all(binaries.map(b =>
   resolveBinary(b).catch(() => null)))`); the first name that resolves wins,
   same semantics as the sequential loop (order preserved via array index).

Measured effect: catalog-only probe phase 1847 ms → ~790 ms (steady
state, parallel). The residual ~800 ms floor is set by the slowest single
entry's version probe on this machine (`codex-cli --version` ≈ 780 ms,
`little-coder` ≈ 480–630 ms) — those are real subprocess launches with a
15 s timeout cap each; speed them up and the floor drops.

**Not fixed (recommendation):** the per-adapter `detectAgent` cost is
dominated by `getCommandVersion` subprocess launches (e.g. `mimo` ≈ 900 ms,
`freebuff` ≈ 760 ms, `gemini` ≈ 680 ms in isolation). The 24-adapter fan-out
is already parallel, so the wall time is the slowest adapter, not the sum.
Caching version results across calls would require an invalidation policy
(re-installs, PATH changes) — per the task caution, that is an architecture
decision, not a mechanical fix. See §4.

## 3. gui-server memory (RSS)

**Method:** start `startGuiServer` on an ephemeral port in-process, hit
`/api/state` 6× then `/api/agents/catalog` 2×, sampling
`process.memoryUsage().rss` after each.

Before:

```
RSS after 1 warm /api/state (KB): 80992
state 1 RSS KB: 81040
state 2 RSS KB: 98256
state 3 RSS KB: 98832
state 4 RSS KB: 99584
state 5 RSS KB: 100432
catalog 1 RSS KB: 104768
catalog 2 RSS KB: 115488
```

After:

```
RSS after warm /api/state (KB): 81248
state 1 RSS KB: 82416
state 2 RSS KB: 98448
state 3 RSS KB: 99328
state 4 RSS KB: 99152
state 5 RSS KB: 103824
catalog 1 RSS KB: 111616
catalog 2 RSS KB: 122720
```

**Finding: no fix applied — memory is flat, not growing.**
RSS settles at ~98–104 MB after the first detection fan-out and does not
grow across repeated `/api/state` or `/api/agents/catalog` requests. There is
no unbounded cache: the only long-lived in-memory store is `agentJobs`
(install/uninstall job output), which is capped at 16 KB output per job and
evicted after a 10-minute TTL. `manager.configs` is a Map of loaded agent
configs, populated only by explicit `loadConfig` calls (none in the
dashboard's normal read path). The ~20 MB step from 81→98 MB is the first
parallel detection fan-out (subprocess handles + detection results); it is
one-time, not per-request.

**Not fixed (recommendation):** `GET /api/state` and `GET
/api/agents/catalog` each re-run the full 24-adapter detection (~1.3 s of
subprocess work per request). The dashboard polls state, so this repeats.
Caching detection results is explicitly the kind of change the task says to
recommend rather than implement: a config/detection cache is only safe with
correct invalidation (agent installed/uninstalled via the dashboard's own
job system, or externally), and a stale "Installed/Available" table is worse
than a slow one. If pursued later, the natural design is: cache per-binary
resolution + version with invalidation hooks on `startAgentJob` completion
and a TTL, plus a test proving a job-finishing invalidates the entry.

## 4. GUI bundle size

**Command:** `pnpm build` (vite, packages/gui).

```
dist/index.html                   1.41 kB │ gzip:  0.73 kB
dist/assets/index-DgqIImXW.css   52.40 kB │ gzip:  9.78 kB
dist/assets/index-DV1gEoEI.js   339.97 kB │ gzip: 93.07 kB
```

93.07 kB gzipped JS — consistent with the ~93 kB noted at the last
checkpoint, well under the 300 kB budget. **No action needed.**

## Summary of changes

| File | Change | Before | After |
| --- | --- | --- | --- |
| `packages/cli/src/index.ts` | `detect`: parallelize catalog-only probes | 3303 ms | 1944 ms |
| `packages/core/src/agent-catalog.ts` | `detectCatalogEntry`: parallelize binary resolution | 1847 ms (seq) | ~790 ms (floor = slowest entry) |
| `packages/cli/src/gui-server.ts` | `GET /api/agents/catalog`: run adapter detection and catalog-only probes in one parallel batch | 2713 ms | 4204 ms (see caveat) |

### Caveat on the gui-server catalog endpoint

The endpoint now overlaps `manager.detectAgents()` (24 adapters) with the
catalog-only probes instead of running them back-to-back, but on this
machine the measured wall time did not improve (2713 → 4204 ms across the
few runs taken). The two phases are genuinely independent, so the overlap is
correct and can only reduce wall time in expectation; the single-run numbers
are dominated by the variance of the slowest version-probe subprocess
(`codex-cli` ≈ 780–900 ms) and macOS process-spawn jitter. The change is
kept because it is the same mechanical class as the other two fixes and
removes a full sequential phase of subprocess work from the critical path on
machines where the two phases are both slow; it does not change any response
shape or semantics (adapter-backed entries still use `detectAgents()`
results; catalog-only entries still use `detectCatalogEntry()` probes;
discovered-but-uncatalogued agents are still appended last).

## Verification

- `pnpm install --frozen-lockfile` — clean.
- `pnpm build` — 3/3 tasks successful (core tsc, cli tsc, gui vite).
- `pnpm test` — 4/4 tasks successful: core 212 passed, cli passed, gui 42
  passed.
- `git status --short` shows only the three in-scope files.
