# M060 — Fix RAM/CPU spike on Skills refresh (unbounded recursive scan across 560+ real skills)

## Identity

- Task ID: M060
- Parent workstream: Performance hardening (founder-reported live bug)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M060-fix-skills-refresh-ram-spike
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M060-fix-skills-refresh-ram-spike
- Type: bug
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M060-fix-skills-refresh-ram-spike`

Work ONLY within these repository paths:

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts`

Read every file listed in "Read first" before writing code.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

The founder reported the dashboard's RAM spikes when they click refresh on the Skills page. Root cause, confirmed by the lead on this machine's real data: `getAllKnownSkills()` (M044) calls `listSkillsInDir()` for the shared library plus every skill-capable agent's real directory, and for EVERY skill folder found (560+ real folders on this machine right now — Junie alone has 283), `readSkillDef()` calls `countFiles()`, which does an unbounded recursive directory walk (up to 500 files, following every subdirectory) with no caching. This entire scan re-runs from scratch on every single Skills-page load/refresh, with no memoization — hundreds of synchronous-ish `fs.readdir` calls stacking up per request.

## Current state

Read `packages/core/src/skills.ts` in full: `countFiles`, `readSkillDef`, `listSkillsInDir`, `getAllKnownSkills`, `getSkillsSnapshot`. Read `packages/cli/src/gui-server.ts`'s `GET /api/skills` route to see how often and from where this gets triggered.

## Target state

Reduce the real cost of a Skills refresh without changing what data is shown to the user. Do BOTH of the following, in order of value:

1. **Stop paying for `fileCount` on every scan.** `AggregatedSkill`/`SkillDef.fileCount` is the only reason `countFiles`'s expensive recursive walk exists. Check every real caller/consumer of `fileCount` in `packages/gui/src/components/SkillsView.tsx` — if it's only used for a small "N files" display label, replace the expensive recursive `countFiles` with a cheap SHALLOW count (immediate directory entries only, one `fs.readdir` call, no recursion) for the vast majority of skills, which are single-directory-plus-SKILL.md folders. If a skill genuinely has nested subdirectories and an exact deep count is needed for something real (verify this before assuming it), keep the expensive path but only apply it lazily (e.g., on-demand when a single skill's detail is opened, not for every skill on every list load) — your call which approach fits the real UI need, but the default list-load path must not pay for a full recursive walk across 560+ folders on every request.
2. **Cache `getAllKnownSkills()`'s result** with a short TTL (e.g. 5–10 seconds) or an explicit invalidation hook (any assign/unassign/copy/create/delete mutation clears the cache), so a page reload or a background poll doesn't force a full re-scan every time within a tight window. Pick whichever is simpler and correct given the existing mutation call sites — do not build a complex cache invalidation system; a simple in-memory `{ data, expiresAt }` guarded by the existing `SkillsDirOptions` test-override seam (so tests can still force a fresh scan) is enough.

Measure the REAL before/after cost on this machine (it already has 560+ real skill folders, don't synthesize fixtures for the measurement) — wall-clock time and, if feasible, a rough memory delta (`process.memoryUsage()` before/after a real request) for `GET /api/skills` before and after your fix.

## Read first

### Current code

- `packages/core/src/skills.ts` (full file)
- `packages/gui/src/components/SkillsView.tsx` (every real use of `fileCount`, to confirm what can safely move to a shallow count)
- `packages/cli/src/gui-server.ts` (the `GET /api/skills` route and any mutation routes that would need to invalidate a new cache)

### Tests

- `packages/core/src/skills.test.ts` — add tests: a shallow count matches expectations for a normal (non-nested) skill folder; the cache returns the same object within its TTL and a fresh scan after invalidation/expiry; existing tests must not regress (check whether any existing test asserts on `fileCount` for a skill with real nested subdirectories — if so, preserve correctness for that case explicitly).

## Allowed scope

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts`

## Forbidden scope

- Any GUI file
- Any other core file

## Exact requirements

1. Real, measured before/after cost reduction for `GET /api/skills` on this machine's actual 560+ real skill folders.
2. No loss of correctness for any skill that genuinely needs an accurate file count (if such a case exists in real data on this machine, verify and handle it explicitly, don't just assume none exist).
3. Cache (or equivalent) correctly invalidates after a mutation, so the UI never shows stale data after an assign/copy/create/delete.
4. Full core + cli test suites green.

## Non-goals

- No change to what data the API returns (same shape, same information) — only how expensively it's computed.
- No GUI changes.

## Implementation constraints

- Smallest correct diff that meaningfully fixes the real cost.
- Follow existing naming/conventions.
- No speculative abstractions (no generic caching framework — a simple TTL/invalidation is enough).

## Interface / contract

No change to `AggregatedSkill`/`SkillDef`/`SkillsSnapshot`'s public shape.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M060-fix-skills-refresh-ram-spike
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/cli test
```

Also verify:

- `git status --short` within allowed scope only
- Real measured before/after: start a real server against this machine's real `~/.claude/skills`, `~/.pi/agent/skills`, etc. (read-only, do not modify anything real), hit `GET /api/skills` and time it / sample `process.memoryUsage()` before and after your fix, paste real numbers
- Confirm a mutation (e.g. assign) correctly invalidates the cache so the next fetch reflects it

## Expected evidence

- exact commands executed
- real before/after timing/memory numbers on this machine's real data
- files changed
- confirmation cache invalidation works correctly after a mutation
- limitations or failures

## Completion criteria

- measured real improvement, no data-shape change, no correctness loss, cache invalidates correctly, full test suites green

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
