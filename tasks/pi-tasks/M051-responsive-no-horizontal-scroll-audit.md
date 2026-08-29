# M051 — Responsive audit: eliminate horizontal scrolling, verify at real breakpoints

## Identity

- Task ID: M051
- Parent workstream: Quality hardening
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M051-responsive-no-horizontal-scroll-audit
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M051-responsive-no-horizontal-scroll-audit
- Type: bug
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M051-responsive-no-horizontal-scroll-audit`

Work ONLY within these repository paths:

- `packages/gui/src/index.css`
- `packages/gui/src/components/Dashboard.tsx`
- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/components/ToolsView.tsx`
- `packages/gui/src/components/SettingsView.tsx`
- `packages/gui/src/components/AgentDetailView.tsx`

Read every file listed in "Read first" before writing code.

**Explicitly excluded from this task's scope (owned by concurrent tasks, may be mid-flight in other worktrees — do not touch): `SkillsView.tsx`, `ProvidersView.tsx`, `MCPView.tsx`, any new `EnvVarsView.tsx`.** If you find a horizontal-scroll issue in one of those files, note it in FOLLOW_UP instead of fixing it.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder explicitly required "no horizontal scrolling" and "responsive" as part of the overall quality bar for this product. This is a real, testable, bounded audit-and-fix task across the views NOT already being touched by the concurrent Skills/EnvVars work.

## Target state

For each in-scope view, at viewport widths 1024px, 1280px, 1440px, and 1920px (this is a desktop-first power-user tool per the original redesign brief, but must not break at a laptop's minimum practical width):

- No element causes the page body to scroll horizontally.
- Any genuinely wide content (a data table with many columns, a long path, a code block) scrolls horizontally ONLY within its own bounded container (`overflow-x: auto` on that specific container), never the whole page — this is already the stated global convention (see the project's own dataviz/responsiveness guidance if referenced elsewhere in the codebase's comments) — audit for and fix any violation of it.
- Fix real violations found; do not preemptively add `overflow-x: hidden` everywhere as a blanket suppressor if it would clip real content — find the actual overflow source (an unwrapped long string, a fixed-width element wider than its container, a flex/grid item without `min-width: 0`) and fix that.

## Read first

### Current code

- All 6 in-scope component files (full read)
- `packages/gui/src/index.css` (global body/layout rules, existing `.table-container { overflow-x: auto }` pattern already used correctly elsewhere as the reference convention)

### Reference / specification

- `docs/epics/agentic-control-plane-redesign-v2.md`

### Tests

- `packages/gui/src/smoke.test.tsx` — do not weaken any existing assertion; add one if a specific structural change needs a new assertion, but this task is primarily a visual/layout fix, not new functional test surface.

## Allowed scope

- `packages/gui/src/index.css`
- `packages/gui/src/components/Dashboard.tsx`
- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/components/ToolsView.tsx`
- `packages/gui/src/components/SettingsView.tsx`
- `packages/gui/src/components/AgentDetailView.tsx`

## Forbidden scope

- `SkillsView.tsx`, `ProvidersView.tsx`, `MCPView.tsx`, any `EnvVarsView.tsx` — concurrent work, may not exist yet or may be mid-flight elsewhere
- `Sidebar.tsx`, `CommandPalette.tsx`
- Any core/cli file

## Exact requirements

1. Real horizontal-overflow audit at 1024/1280/1440/1920px for all 6 in-scope views, using a headless browser (Playwright) measuring actual `document.documentElement.scrollWidth` vs `clientWidth` — not a visual guess.
2. Every real violation found is fixed at its root cause.
3. Full gui test suite still green.
4. A short list of any violations found in the EXCLUDED files, for the lead to route to their respective owners.

## Non-goals

- No redesign of any view's layout beyond what's needed to eliminate horizontal overflow.
- No changes to the excluded files.

## Implementation constraints

- Smallest correct diff per violation found.
- Follow existing naming/class conventions.
- No speculative abstractions.

## Interface / contract

No component prop/export changes expected — this is a CSS/layout-only fix in the general case; if a genuine structural change is required, keep exports/props unchanged.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M051-responsive-no-horizontal-scroll-audit
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Real Playwright measurements at all 4 breakpoints, before and after, for all 6 in-scope views, pasted in the report (not a visual claim)

## Expected evidence

- exact commands executed
- real build/test output
- the before/after `scrollWidth` vs `clientWidth` measurements at each breakpoint for each view
- files changed
- a list of any violations found in excluded files, for follow-up
- limitations or failures

## Completion criteria

- zero horizontal overflow at all 4 breakpoints for all 6 in-scope views, proven with real measurements
- scope respected
- test suite green

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
