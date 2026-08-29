# M038 — Performance pass: measure, report, fix only what's cheap and safe

## Identity

- Task ID: M038
- Parent workstream: Phase 0 closeout (CHECKPOINT.md §5 Step 4)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M038-performance-pass
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M038-performance-pass
- Type: refactor
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M038-performance-pass`

Work ONLY within these repository paths:

- `packages/cli/src/index.ts`
- `packages/cli/src/gui-server.ts`
- `packages/core/src/agent-catalog.ts`
- `packages/core/src/detect/*.ts`
- `docs/audits/performance-pass.md` (new file — your measurement report)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Measure BEFORE changing anything, so you have real before/after numbers. Never report an optimization without a real measured before and after.

Only apply a fix if it is low-risk and mechanical (e.g. `Promise.all` instead of a sequential loop over independent async calls, removing a redundant duplicate file read, lazy-importing a heavy module). If a finding requires a real architectural decision (e.g. adding a cache with invalidation, changing what data is held in memory long-term), do NOT implement it — write it up as a finding with a recommendation instead, and stop there for that finding.

Do not broaden scope because you notice adjacent improvements.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

CHECKPOINT.md §5 Step 4 says this was assigned earlier this project and never produced any numbers: "Task was assigned but produced no numbers. The founder explicitly named 'low memory consumption, optimized, production ready' as goals." This closes that gap with real measurements, and only the safest class of fix.

## Current state

Read CHECKPOINT.md §5 Step 4 in full for the exact scope already identified:
- CLI startup time (`packages/cli/src/index.ts`) — check for eager imports of heavy modules that could be deferred.
- Adapter detection cost across 24+ adapters — is detection sequential or parallel? Any redundant file reads across adapters (e.g. reading the same catalog JSON multiple times)?
- gui-server memory (`packages/cli/src/gui-server.ts`, now larger than the ~1000 lines noted at last checkpoint) — any whole-tree reads held in memory, unbounded caches, or per-request full-catalog re-detection that could be avoided.
- GUI bundle size — already measured healthy (currently ~93KB gzipped JS per the last build output, well under the 300KB budget); just re-confirm the current number, no action needed unless it regressed significantly.

**Caution (already flagged in CHECKPOINT.md, still applies):** "caching config reads is only safe if invalidation is correct. A config manager showing stale state is worse than a slow one." Do not add a cache unless you can prove invalidation is correct with a test — if you're not confident, write it up as a recommendation instead of implementing it.

## Target state

A written report at `docs/audits/performance-pass.md` with:
1. Real measured CLI startup time (cold, e.g. `time node packages/cli/dist/index.js --help` or equivalent, averaged over a few runs).
2. Real measured adapter-detection wall-clock time for a full `detect` run, and whether it's sequential or parallel today (grep the actual detection loop, don't guess).
3. Real measured gui-server memory (RSS) under a normal session — start it, hit `/api/state` a few times, sample `ps`/`process.memoryUsage()`.
4. GUI bundle size re-confirmed from a real `pnpm build` output.
5. For each finding: current number, whether you applied a fix (with before/after numbers) or left it as a recommendation (with a one-paragraph rationale for why it needs a real architecture decision instead of a mechanical fix).

Apply the safe class of fix only. Example of what's in-scope-safe: parallelizing an already-independent sequential `for` loop of `await`s into `Promise.all`. Example of what's NOT in-scope (recommend instead): adding a persistent cache layer, changing the registry's read/write model, restructuring gui-server's request handling.

## Read first

### Current code

- `packages/cli/src/index.ts` (imports at the top, command dispatch)
- `packages/cli/src/gui-server.ts` (full file, look for repeated full-catalog reads per request)
- `packages/core/src/agent-catalog.ts` and `packages/core/src/detect/*.ts` (the detection loop — sequential vs parallel)

### Reference / specification

- `CHECKPOINT.md` §5 Step 4 (the exact scope this task closes)

### Tests

- `pnpm test` (full suite) must stay green — this task must not break any existing test.

## Allowed scope

- `packages/cli/src/index.ts`
- `packages/cli/src/gui-server.ts`
- `packages/core/src/agent-catalog.ts`
- `packages/core/src/detect/*.ts`
- `docs/audits/performance-pass.md` (new)

## Forbidden scope

- Any GUI (`.tsx`) file
- Any adapter file (`packages/core/src/adapters/*.ts`)
- Adding a dependency
- Adding a cache without a test proving invalidation correctness

## Exact requirements

1. Produce real, reproducible measurements for the four areas above, written into `docs/audits/performance-pass.md`.
2. Apply only mechanical, low-risk fixes with real before/after numbers; everything else becomes a documented recommendation.
3. Full test suite (`pnpm test`) still green after any change.
4. Full build (`pnpm build`) still green.

## Non-goals

- No new caching layer.
- No architectural changes to the registry or gui-server's request model.
- No GUI changes.

## Implementation constraints

- Preserve public APIs.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

No public API/CLI behavior changes are expected; if a fix changes timing-sensitive behavior in a way that could be user-visible, call it out explicitly in the report.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M038-performance-pass
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Also verify:

- `git status --short` within allowed scope only
- Every number in the report is real output you captured, not an estimate

## Expected evidence

- exact commands executed
- real measured numbers, before and after for any applied fix
- files changed
- limitations or failures

## Completion criteria

- report exists with real numbers for all four areas
- any applied fix has real before/after numbers and passes full test suite
- scope respected
- no fabricated numbers

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- <file>

COMMANDS_RUN:
```text
<real commands and relevant output>
```

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
