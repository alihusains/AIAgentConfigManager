# M034 — MCP Servers table v2: same hybrid card/table treatment as Providers

## Identity

- Task ID: M034
- Parent workstream: AgentControl GUI redesign v2
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch time — branch from main AFTER M029 is merged>
- Branch: pi/M034-mcp-table-v2
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M034-mcp-table-v2
- Type: feature
- Priority: P1
- Dependencies: M029 must be merged first

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M034-mcp-table-v2`

Work ONLY within these repository paths:

- `packages/gui/src/components/MCPView.tsx`
- `packages/gui/src/index.css` (mcp-table rules only)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not touch M029's token definitions — consume `var(--token)` only.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder's brief groups "Data tables (Providers, MCP Servers)" together as one redesign requirement. M033 (a parallel, independent task) applies the hybrid card/table treatment to `ProvidersView.tsx`. This task applies the equivalent treatment to `MCPView.tsx` (469 lines) so the two tables feel like one coherent system rather than two independently-designed screens. **Read M033's task file (`tasks/pi-tasks/M033-providers-table-v2.md`) first** — even though you cannot see M033's actual diff (different worktree, may not be merged yet when you start), its task file tells you the target visual pattern you must match for consistency: avatar-stack consolidation, primary/secondary/tertiary row hierarchy, hover-reveal actions, sticky header, real `<table>` markup preserved.

## Current state

Read `packages/gui/src/components/MCPView.tsx` in full first. It currently uses a mix of custom classes (`.card`, `.table`, `.badge`, `.empty-state`) and utility classes (`flex`, `items-center`, `gap-2`, `p-2`, `rounded-lg` — confirm whether these are Tailwind or hand-rolled utility classes already defined in `index.css`; check `grep -n "\.flex\b\|\.items-center\b" packages/gui/src/index.css` before assuming either way). Rows render server name, type badge, and (per the founder's complaint) likely a chip-heavy "Installed On" or similar per-agent list — confirm the actual current chip pattern by reading the full row-rendering JSX before redesigning it.

## Target state

- Read `docs/epics/agentic-control-plane-redesign-v2.md` for v2 tokens. No hardcoded hex.
- Match the same visual language M033 establishes for the Providers table: avatar-stack for any per-agent chip list (capped + hover-expand), primary/secondary/tertiary row hierarchy, hover-reveal action icons instead of always-on, sticky table header, `--surface-2` hover elevation.
- Preserve the existing empty-state (`No MCP Servers Registered`) — restyle it using v2 tokens and the M029 `.glass-surface`/spacing scale, but keep it an honest, real empty state (do not fabricate placeholder rows).
- Preserve all existing functionality (add/edit/delete MCP server flows) exactly as-is — this task is presentation-only.

## Read first

### Current code

- `packages/gui/src/components/MCPView.tsx` (full file, 469 lines)
- `tasks/pi-tasks/M033-providers-table-v2.md` (the sibling task's spec — for visual consistency, read-only reference, do not edit)

### Reference / specification

- `docs/epics/agentic-control-plane-redesign-v2.md` (M029's frozen token contract)

### Tests

- `packages/gui/src/smoke.test.tsx` — keep any MCPView-related assertions passing (update selectors only if structure changed, never weaken).

## Allowed scope

- `packages/gui/src/components/MCPView.tsx`
- `packages/gui/src/index.css` (mcp-table rules only)
- `packages/gui/src/smoke.test.tsx` (selector updates only, no weakened/removed assertions)

## Forbidden scope

- Any token definition (M029's contract)
- `packages/gui/src/components/ProvidersView.tsx` (that's M033's file — do not touch it even to "share" a component; if you find genuine duplication opportunity, note it in FOLLOW_UP instead of acting on it, since M033 may be mid-flight in a different worktree)
- `packages/cli/`, `packages/core/`
- Removing the semantic `<table>` structure

## Exact requirements

1. Apply the same avatar-stack/hierarchy/hover-reveal visual pattern as M033's Providers table (per its task file spec) to the MCP Servers table.
2. Apply v2 tokens throughout (zero hardcoded hex).
3. Preserve existing add/edit/delete functionality and the existing empty state (restyled, not replaced with fake data).
4. Do not touch `ProvidersView.tsx` even if you see an opportunity to share code — flag it as FOLLOW_UP instead.

## Non-goals

- No backend/API changes.
- No change to what data is fetched, only presentation.
- No shared-component extraction with `ProvidersView.tsx` in this task (that would create a merge conflict with the parallel M033 task — flag it as follow-up work instead).

## Implementation constraints

- Preserve public component exports/props used elsewhere.
- Follow existing naming/class conventions.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

`MCPView` external usage in `App.tsx`/store must not change. The MCP server mutation API contract must not change — this is presentation-only.

## Dependencies

- Upstream: M029 (required); M033 (informational reference only, not a hard code dependency — do not wait for it to merge, just read its task file for consistency)
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M034-mcp-table-v2
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server, visually confirm the redesigned table in both themes, hover states, avatar-stack, empty state; then stop the server

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- limitations or failures
- any visual-consistency follow-up needed once M033 actually lands (since you worked from its spec, not its diff)

## Completion criteria

- all requirements implemented
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
