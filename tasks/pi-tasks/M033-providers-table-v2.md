# M033 — Providers table v2: hybrid card/table, avatar-stack, hover actions

## Identity

- Task ID: M033
- Parent workstream: AgentControl GUI redesign v2
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch time — branch from main AFTER M029 is merged>
- Branch: pi/M033-providers-table-v2
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M033-providers-table-v2
- Type: feature
- Priority: P1
- Dependencies: M029 must be merged first

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M033-providers-table-v2`

Work ONLY within these repository paths:

- `packages/gui/src/components/ProvidersView.tsx`
- `packages/gui/src/index.css` (providers-table rules only)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not touch M029's token definitions — consume `var(--token)` only.

**Hard requirement, non-negotiable:** row state must continue to follow the mutation response exactly as it does today (see "Why this task exists" — this is the bug class the founder personally hit and reported). Any restructuring of row rendering must preserve or improve this, never regress it.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

CHECKPOINT.md documents that `ProvidersView.tsx` (1083 lines) already has substantial E3 redesign work in it, but E3 was still marked pending against these open questions: is pill/badge usage reduced ~70–80%? Are there agent avatar groups instead of chip walls? Does provider row hierarchy exist (primary identity / secondary metadata / tertiary actions)? This task closes those gaps and applies the v2 (post-M029) palette on top.

This same file was the site of a real, founder-reported bug fixed this session (`9303f5c`, `packages/cli/src/gui-server-delete.test.ts`): a delete could return HTTP 200 with warnings-but-no-error, producing a false success toast for a delete that never actually happened. **Do not let this redesign reintroduce that class of bug** — any row removal/rename/edit in the UI must reflect the actual mutation response (success vs. warning vs. error), never optimistically assume success before the response confirms it.

## Current state

Read `packages/gui/src/components/ProvidersView.tsx` in full before changing anything — it is large (1083 lines) and may already implement some of the target state below; do not redo work that is already correct. Specifically check:
- How many `className="chip"` / `className="badge"` instances currently render per row, and for what data (this determines your reduction target)
- Whether "Installed On" already renders as individual chips per agent (a "chip wall") or already has some grouping
- How row state currently updates after a mutation (edit/delete/rename) — trace exactly how the response is read and applied, so you preserve or improve, never regress, that path

## Target state

- Read `docs/epics/agentic-control-plane-redesign-v2.md` for v2 tokens. No hardcoded hex.
- Reduce badge/chip usage roughly 70–80% versus current count by consolidating: the "Installed On" column becomes an avatar-stack (overlapping small agent icon circles, capped at ~4 visible + a "+N" count) that expands to the full list on hover (a simple CSS `:hover` popover/tooltip is sufficient — no new dependency).
- Establish clear row hierarchy: primary identity (provider name + type icon) visually dominant, secondary metadata (base URL, model count, api-type badges) visually subordinate, tertiary actions (edit/delete icons) hidden by default and shown on row hover — not always-on icon clutter.
- Row background/elevation on hover uses a `--surface-2`/glow treatment from M029, not a hard color change that could be mistaken for a state change.
- Keep the table structurally a real `<table>` (sticky header if not already present) — "hybrid card/table" means visual treatment (rounded row groups, breathing room, no harsh spreadsheet gridlines), not abandoning semantic table markup, since this is a data-dense power-user tool and `<table>` gives free accessibility semantics.
- The mutation-response-driven row state (edit/delete/rename reflecting actual server response) must be verifiably unchanged in behavior — re-run the existing delete-cascade regression coverage referenced below and confirm it still passes.

## Read first

### Current code

- `packages/gui/src/components/ProvidersView.tsx` (full file, 1083 lines)
- `packages/cli/src/gui-server-delete.test.ts` (the regression test for the bug this task must not reintroduce — read it to understand the exact failure mode)
- `docs/epics/agentic-control-plane-redesign.md` (OLD spec — read only for the E3 requirements list already referenced above, not for color values)

### Reference / specification

- `docs/epics/agentic-control-plane-redesign-v2.md` (M029's frozen token contract)

### Tests

- `packages/gui/src/smoke.test.tsx` — keep any ProvidersView-related assertions passing (update selectors only if structure changed, never weaken).
- `packages/cli/src/gui-server-delete.test.ts` — this is a CLI-side test, not touched by this GUI task, but its passing status is your proof the underlying mutation contract this UI relies on is unchanged; re-run it as part of verification.

## Allowed scope

- `packages/gui/src/components/ProvidersView.tsx`
- `packages/gui/src/index.css` (providers-table rules only)
- `packages/gui/src/smoke.test.tsx` (selector updates only, no weakened/removed assertions)

## Forbidden scope

- Any token definition (M029's contract)
- `packages/cli/src/gui-server.ts` or any backend mutation logic
- Any other component file
- Removing the semantic `<table>` structure

## Exact requirements

1. Reduce chip/badge count per row by ~70–80% via the avatar-stack consolidation for "Installed On."
2. Establish primary/secondary/tertiary visual hierarchy per row.
3. Hover-reveal actions (edit/delete) instead of always-on.
4. Apply v2 tokens throughout (zero hardcoded hex).
5. Confirm and report that row state still exactly follows the mutation response (no optimistic UI that could show false success) — trace this explicitly in your final report referencing the actual code path.

## Non-goals

- No backend/API changes.
- No change to what data is fetched or how filtering/sorting (if any) currently works, only presentation.
- No redesign of any other view.

## Implementation constraints

- Preserve public component exports/props used elsewhere.
- Follow existing naming/class conventions.
- Prefer the smallest correct diff given the file's size — do not rewrite the whole file if only the row/chip rendering needs to change.
- No speculative abstractions.

## Interface / contract

`ProvidersView` external usage in `App.tsx`/store must not change. The provider mutation API contract (request/response shape from `gui-server.ts`) must not change — this is presentation-only.

## Dependencies

- Upstream: M029
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M033-providers-table-v2
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
pnpm --filter @ai-agent-config/cli test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server, visually confirm the redesigned table in both themes, hover states, avatar-stack expand-on-hover; then stop the server
- Explicitly re-trace and confirm in your report that a delete/edit/rename only updates row UI state after reading the real mutation response (success/warning/error), quoting the relevant code

## Expected evidence

- exact commands executed
- real build/test output (gui AND cli suites)
- files changed
- explicit trace of the mutation-response-driven state update path
- before/after chip count estimate per row
- limitations or failures

## Completion criteria

- all requirements implemented
- mutation-response state handling verifiably unchanged
- no non-goal behavior changed
- scope respected
- verification passes
- diff reviewed for accidental changes

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
