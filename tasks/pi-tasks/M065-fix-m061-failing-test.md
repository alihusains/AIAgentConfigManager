# M065 — Fix the failing M061 smoke test (import-warnings toast test)

## Identity

- Task ID: M065
- Parent workstream: Corrective fix (M061 follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: pi/M061-registry-import-portability-warnings branch (continue on THIS branch, do not create a new one)
- Branch: pi/M061-registry-import-portability-warnings
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M061-registry-import-portability-warnings
- Type: bug
- Priority: P0
- Dependencies: none — this worktree already has M061's implementation commit on it

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M061-registry-import-portability-warnings`

(This worktree already has M061's commit with the real implementation — do NOT touch `packages/core/src/index.ts` or `packages/gui/src/components/SettingsView.tsx`, they are already correct and verified by the lead. The bug is in the TEST, not the implementation.)

Work ONLY within these repository paths:

- `packages/gui/src/smoke.test.tsx`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

The lead independently verified M061's implementation is correct (`resolveProviderApiKey`/import warnings logic in `core/index.ts` and the toast-loop in `SettingsView.tsx` both match spec exactly). Running the full test suite found ONE failing test: `SettingsView > Import Registry surfaces server warnings as warning toasts (M061)` — it times out on `await screen.findByText(warnings[0])`. The previous Pi worker got stuck for over 2 hours apparently unable to resolve this (the process ran with slowly-growing CPU time but the diff never changed, suggesting a repeated failed verification loop). Diagnose the REAL cause — do not assume it's a simple typo without checking.

## Current state

Read the full failing test in `packages/gui/src/smoke.test.tsx` (search for `Import Registry surfaces server warnings as warning toasts (M061)`). Read how the existing, ALREADY-PASSING toast tests elsewhere in this same file assert on toast text (there are many existing toast-related assertions in this file that work — find one and compare its pattern against the failing test's pattern to spot the real difference). Read the actual `Toast`/`ToastContainer` component (`packages/gui/src/ui/` or wherever it lives) to understand exactly how toast text is rendered in the DOM (is title and message one text node or two? Is there a toast-count limit that could drop the second of two warnings before the first is even queried?).

## Target state

The test passes reliably, asserting on the REAL rendered behavior — do not weaken the assertion (e.g. do not change `findByText(warnings[0])` to a partial/regex match just to make it pass if the real behavior is actually broken; if the real behavior IS broken — e.g. only one toast can be visible at a time and the second warning's toast races the first — the fix might legitimately be adjusting the test's expectation to match real, correct toast-stacking behavior, but only if you've confirmed that's how toasts genuinely work everywhere else in this app, not inventing a new exception for this one test).

## Read first

### Current code

- `packages/gui/src/smoke.test.tsx` (the failing test, and at least 2 other passing toast-assertion tests in the same file for comparison)
- `packages/gui/src/ui/` (the Toast/ToastContainer component's actual render output)
- `packages/gui/src/store/index.ts` (`addToast`, to understand any toast-limit/dedup logic that might affect two toasts fired in a tight loop)

### Tests

- Fix the one failing test in `packages/gui/src/smoke.test.tsx`. Do not touch any other test.

## Allowed scope

- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/src/index.ts`
- `packages/gui/src/components/SettingsView.tsx`
- `packages/gui/src/ui/**` (the Toast component itself — if you find a REAL bug there, report it in FOLLOW_UP instead of fixing it in this task, since this task's scope is the test file only)
- Any other file

## Exact requirements

1. Root-cause the real reason `findByText(warnings[0])` times out (do not guess — read the actual rendered DOM via the test's own debug output if needed).
2. Fix the test so it passes, reflecting real correct behavior — no weakened/fake assertions.
3. Full gui test suite green (this test now passing, zero other regressions).

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M061-registry-import-portability-warnings
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` shows only `packages/gui/src/smoke.test.tsx`
- Real test output showing all tests passing, including the previously-failing one, run at least twice to rule out flakiness

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- packages/gui/src/smoke.test.tsx

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
