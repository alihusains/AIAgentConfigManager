# Performance pass (M038)

Date: 2026-07-29 · Machine: macOS (darwin/arm64), Node v26.7.0, pnpm v10.33.4
Worktree: `pi-worktrees/task-M038-performance-pass` (branch `pi/M038-performance-pass`)

Scope (CHECKPOINT.md §5 Step 4): CLI startup time, adapter-detection cost,
gui-server memory, GUI bundle size. Method: measure first, apply only
mechanical low-risk fixes with real before/after numbers, document everything
else as a recommendation.

**TL;DR**

| Area | Before | After | Action |
| --- | --- | --- | --- |
| CLI startup (`--help`) | 0.11–0.13 s | 0.10–0.13 s | No fix needed (already fast) |
| `acm detect` wall clock | 2.87–3.26 s | 1.53–1.66 s | **Fixed** (~46% faster) |
| `/api/agents/catalog` response | ~3.00 s | ~2.46 s | **Fixed** (see §3 caveat) |
| gui-server RSS (steady) | ~85–90 MB | ~86–91 MB | No fix — healthy; recommendation only |
| GUI bundle | 93.07 kB gz | 93.07 kB gz | Re-confirmed healthy (budget 300 kB) |

All numbers below are captured output from the exact commands shown.

---

## 1. CLI startup time

Command (5 runs each, before and after; `--help` exits before any detection):

```bash
for i in 1 2 3 4 5; do /usr/bin/time -p node packages/cli/dist/index.js --help >/dev/null 2>&1; done
```

| Run | Before | After |
| --- | --- | --- |
| 1 | 0.13 | 0.13 |
| 2 | 0.11 | 0.11 |
| 3 | 0.11 | 0.10 |
| 4 | 0.11 | 0.11 |
| 5 | 0.11 | 0.11 |

**Finding 1.1 — No fix needed.** Startup is dominated by Node + ESM module
loading of `@ai-agent-config/core` (all 24 adapters are imported eagerly via
`listAvailableAdapters()` in the `AgentConfigManager` constructor, and
`packages/cli/src/index.ts` imports it at top level). At ~110 ms total this is
not user-visible.

**Recommendation 1 (not implemented): lazy-load the manager for read-only
commands.** `--help`, `version`, and `config-path <id>` never need the
manager; only command actions do. Deferring the `AgentConfigManager` import
into each action (or lazy-importing the core package per command group) would
shave roughly 50–70 ms. Not done because: (a) the gain is small at current
size, (b) it means restructuring every command action in `index.ts`, and
(c) it is the kind of change that invites import-cycle regressions in core.
Revisit only if adapter count grows substantially.

**Recommendation 2 (not implemented): stop rebuilding all adapter instances
on every catalog call.** `getAgentCatalog()` (in
`packages/core/src/agent-catalog.ts`) calls `listAvailableAdapters()` — which
constructs a *new* adapter object for every one of the 24 adapters — on each
call, and `getAgentCatalogEntry()` calls `getAgentCatalog()` again (full
rebuild + `.find()`). It is called once per catalog entry from
`/api/agents/catalog` (the "known: false" loop), so one request builds the
24 adapters ~14 extra times. This is CPU-wasteful but sub-millisecond today
(adapters are cheap objects); a module-level memo invalidated on
`registerAdapter` would be the fix. Left as a recommendation because a cache
with an invalidation hook is exactly the class of change this task excludes.

## 2. Adapter detection cost

Full `detect` wall clock:

```bash
$ time node packages/cli/dist/index.js detect
# before: real 0m3.256s / real 0m2.872s (two runs)
# after:  real 0m1.661s / real 0m1.532s / real 0m1.547s (three runs)
```

Output diff of `detect` before vs. after: **byte-identical**
(`diff` clean, 37 agent entries).

Internal breakdown (bench script driving the built core, before the fix):

```text
detectAgents (24 adapters): 972.8 ms        # already Promise.all
catalog-only entries: 13
catalog probes (sequential): 1833.5 ms      # the CLI loop, one await per entry
catalog probes (Promise.all): 595.9 ms
```

### What was parallel and what was sequential (grep-verified, not guessed)

- `AgentConfigManager.detectAgents()` — **already parallel**:
  `packages/core/src/index.ts:294` wraps the 24 `detectAgent` calls in
  `Promise.all`.
- `detectAgent()` per adapter — sequential *within* an adapter, but only
  until the first binary resolves; fine.
- `detectCatalogEntry()` (no-adapter catalog entries, 13 of them) —
  **sequential**: the CLI `detect` command looped
  `for (const entry of catalog) { const probe = await detectCatalogEntry(entry); … }`
  (`packages/cli/src/index.ts`), and inside `detectCatalogEntry` the
  candidate-binary loop awaited `resolveBinary` one at a time.
- `/api/agents/catalog` (gui-server) — **sequential**: awaited
  `detectCatalogEntry(entry)` inside the per-entry `for` loop.
- `detectCliTools()` — already `Promise.all`.

### Fix 2 (applied): parallelize independent catalog probes

Three mechanical changes, no behavior change:

1. `packages/core/src/agent-catalog.ts` — `detectCatalogEntry` now resolves
   all candidate binaries with `Promise.all` and takes the first hit (same
   "first name wins" semantics as the sequential loop; per-binary
   failure-tolerance preserved via `.catch(() => null)`).
2. `packages/cli/src/index.ts` — `detect` command probes all 13 catalog-only
   entries with `Promise.all`, then prints in catalog order.
3. `packages/cli/src/gui-server.ts` — `/api/agents/catalog` runs
   `manager.detectAgents()` and the catalog-only probes in one `Promise.all`
   batch (previously the probes also ran *after* detection, serially).

**Result:** `acm detect` 2.87–3.26 s → **1.53–1.66 s** (~46% faster,
byte-identical output). The remaining ~1.5 s floor is: 24 adapters
`detectAgents` (~0.9 s, bounded by the slowest installed CLI's `--version`
subprocess) + ~0.6 s of catalog version probes. Note the wall clock includes
the ~0.1 s CLI startup.

**Recommendation 3 (not implemented): bound/timeout the version probes.**
`getCommandVersion` gives each attempt a 15 s timeout
(`packages/core/src/utils/index.ts`); a wedged CLI would stall a whole
`detect`. A tighter per-probe timeout (e.g. 3 s) plus an overall `detect`
budget would protect the tail, but changing probe timeouts is a
behavioral decision (some CLIs genuinely start slow) — out of scope for a
mechanical pass.

**Recommendation 4 (not implemented): cache negative binary lookups per
process.** `resolveBinary` re-runs `which` for every non-installed binary on
every detection pass (28 sequential `which` spawns measured at 284–421 ms vs
63–186 ms parallel). A process-lifetime negative cache (a CLI that is not
installed stays not-installed until a job installs it) would cut repeated
`/api/state` cost roughly in half, but it needs invalidation on
install/uninstall jobs — a stale "not installed" is exactly the failure mode
CHECKPOINT.md warns about, so it stays a recommendation.

## 3. gui-server memory (RSS)

Method: start `node packages/cli/dist/index.js gui --no-open --port 4399`,
hit `/api/state` 3×, then `/api/agents/catalog` 1×, sample
`/api/system/stats` (in-process `process.memoryUsage()`) and `ps -o rss`.

Before (identical code path as shipped):

```text
state: 200 1.038706s / 0.832262s / 0.797828s
catalog: 200 2.997798s
{"ok":true,"data":{"rssBytes":86769664,"heapUsedBytes":22364656,"heapTotalBytes":35635200,"externalBytes":4353183,"uptimeSec":49.3,…}}
ps -o rss: 84912 KB
# after the catalog call: rssBytes 92635136, ps rss 90464 KB
```

After (with the parallel-catalog fix):

```text
state: 200 3.801970s / 0.798941s / 0.785404s
catalog: 200 2.455820s
{"ok":true,"data":{"rssBytes":91029504,"heapUsedBytes":23423648,"heapTotalBytes":33701888,"externalBytes":4280897,…}}
ps -o rss: 90464 KB
```

(The first post-start `state` was 3.8 s vs 1.0 s — that run's process had
just returned from a longer warm-up window; steady-state `state` is ~0.8 s
both before and after. The catalog endpoint returned **identical agent sets**
(37 agents, same id/installed/known triples) before and after.)

**Finding 3.1 — RSS ~85–91 MB RSS, ~22–24 MB heapUsed. Healthy.** No
unbounded growth observed across repeated requests; job output is capped
(`MAX_JOB_OUTPUT` 16 KB, `JOB_TTL_MS` 10 min eviction). No fix applied.

**Recommendation 5 (not implemented): per-request full re-detection.**
`/api/state` (the dashboard's main poll) runs the full 24-adapter detection
on *every* request (~0.8 s each), and `/api/agents/catalog` re-runs it too —
and the dashboard calls both. A TTL'd detection snapshot (e.g. 30–60 s,
busted by install/uninstall jobs) would cut repeated work and latency.
Not implemented: it is a caching decision with real invalidation semantics
(a config manager showing stale "not installed" after an install job is the
explicit failure mode CHECKPOINT.md warns about), and that needs a design +
test, not a mechanical patch.

**Recommendation 6 (not implemented): `serveStatic` reads the whole file per
request** (`fs.readFileSync` per hit). The static JS/CSS are
hash-named with `max-age=31536000, immutable`, so a small in-memory cache of
served files (keyed by mtime) is safe for hashed assets; `index.html` stays
`no-cache`. Minor at current sizes (340 kB JS); left as a recommendation
because it means adding state to the request path.

## 4. GUI bundle size

```bash
$ pnpm build
dist/index.html                   1.41 kB │ gzip:  0.73 kB
dist/assets/index-DgqIImXW.css   52.40 kB │ gzip:  9.78 kB
dist/assets/index-DV1gEoEI.js   339.97 kB │ gzip: 93.07 kB
```

**Re-confirmed healthy** — 93.07 kB gzipped JS vs the 300 kB budget (matches
the ~93 kB noted at the last checkpoint; no regression). No action.

## 5. Verification

```bash
$ pnpm install --frozen-lockfile
Done in 224ms using pnpm v10.33.4

$ pnpm build
 Tasks:    3 successful, 3 total

$ pnpm test
@ai-agent-config/core:test:  Test Files  8 passed (8)  · Tests  95 passed | 1 skipped (96)
@ai-agent-config/gui:test:   Test Files  2 passed (2)  · Tests  42 passed (42)
@ai-agent-config/cli:test:   Test Files  5 passed (5)  · Tests  28 passed (28)
 Tasks:    4 successful, 4 total
```

Behavioral notes:

- `acm detect` output is byte-identical before/after (verified with `diff`).
- `/api/agents/catalog` returns the same 37 agents with the same
  id/installed/known values before/after (verified by script).
- No public API or CLI behavior changes. The only user-visible effect is
  that `acm detect` and the dashboard's catalog view finish roughly half as
  fast; result ordering is unchanged (catalog order preserved).
- Scope respected: only `packages/cli/src/index.ts`,
  `packages/cli/src/gui-server.ts`, `packages/core/src/agent-catalog.ts`,
  and this new report were changed. No dependencies added, no caches added,
  no GUI/adapter files touched.

## Files changed

- `packages/core/src/agent-catalog.ts` — parallel binary probes in `detectCatalogEntry`
- `packages/cli/src/index.ts` — `detect` command probes catalog entries in parallel
- `packages/cli/src/gui-server.ts` — `/api/agents/catalog` runs detection + probes in one parallel batch
- `docs/audits/performance-pass.md` — this report
