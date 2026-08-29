# M039 — Full QA pass: click every control, list what's broken

## Identity

- Task ID: M039
- Parent workstream: Phase 0 closeout (CHECKPOINT.md §5 Step 5)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M039-full-qa-pass
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M039-full-qa-pass
- Type: test
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M039-full-qa-pass`

Work ONLY within these repository paths:

- `docs/audits/qa-pass.md` (new file — your findings report)

This is a read-only/observational task against a real running instance of the dashboard. Do NOT fix anything you find — this task's only deliverable is the report. Bugs you find get filed as findings for the lead to triage and dispatch as separate, properly-scoped fix tasks (this mirrors how M033/M035 already surfaced real bugs outside their own scope and correctly did not fix them inline).

Use a throwaway/isolated config home for this session (e.g. `AI_CONFIG_HOME=$(mktemp -d)/.ai-agent-config`) so you are not reading or mutating the founder's real `~/.ai-agent-config/registry.json` or any real agent config files on this machine. Populate the throwaway registry with a handful of fake providers/MCP servers/custom agents so every view has real data to exercise, rather than testing only empty states.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not broaden scope into fixing anything.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

CHECKPOINT.md §5 Step 5: "Run the GUI, click every control in every view, list anything broken. This was queued all session and never ran." This closes that gap. Two real bugs have already surfaced this way in this project's history without a dedicated QA pass (the delete-cascade bug, the Codex rename bug) — a deliberate pass is overdue, especially right after a large GUI redesign workstream just landed (design tokens v2, sidebar, dashboard, providers table, MCP table, buttons/palette, skill-copy UI).

**Known findings already on file — confirm whether these are fixed or still present, do not re-discover them as new:**
1. Agents page "Config Path"/"MCP File" columns were wrapping character-by-character (a fix, M037, is in flight or merged by the time you run this — check `git log --oneline -5` on `main` and confirm the fix landed and looks correct).
2. ~19 buttons across `AgentsView.tsx`/`AgentDetailView.tsx`/`Dashboard.tsx`/`MCPView.tsx`/`ProvidersView.tsx` render `className="btn-primary"`/`"btn-secondary"` without the required `.btn` base class, so they render unstyled (missing padding/radius/shape) — confirm this is still present (a dedicated fix task has not yet been dispatched as of this task's creation) and note it, do not fix it.
3. A registry self-heal bug: a provider deleted via the GUI can silently reappear because `initRegistry()` in `packages/core/src/index.ts` re-adds any provider still referenced in an agent's config file, even after explicit user deletion — confirm you can reproduce this in your throwaway registry (create a provider, install it to 2+ agents, delete it from one agent, refresh, see if it reappears) and note the reproduction steps, do not fix it.

## Target state

A report at `docs/audits/qa-pass.md` covering every view reachable from the sidebar (Overview/Dashboard, Providers, MCP Servers, Agents, Skills, CLI Tools, Settings) plus the command palette (⌘K) and both themes (light/dark), structured as:

```
## <View name>
- Controls tested: <list>
- Broken: <what, exact repro steps, screenshot description>
- Works as expected: <brief>
```

For each control you click (buttons, toggles, modals, forms, search/filter inputs, theme toggle, sidebar collapse if one exists): does it do what its label says, does any error surface silently (check the browser console via headless devtools if available, or Playwright's console message capture), does any action show a success state without the underlying operation actually succeeding (the false-success-toast bug class this project has hit twice before).

## Read first

### Current code

- `docs/community-issues.md` if it exists (past known issues, don't re-file duplicates)
- `packages/gui/src/App.tsx` (the view registry, so you know exactly what's reachable and don't miss a view)

### Reference / specification

- `CHECKPOINT.md` §5 Step 5

### Tests

- None required beyond your own manual/Playwright-driven exploration; do not add or modify test files in this task.

## Allowed scope

- `docs/audits/qa-pass.md` (new file)

## Forbidden scope

- Any source file (`.ts`/`.tsx`) — this is observation only, zero fixes
- The founder's real `~/.ai-agent-config/registry.json` or any real agent config file (`~/.claude/`, `~/.codex/`, `~/.config/opencode/`, etc.) — use an isolated `AI_CONFIG_HOME` throughout

## Exact requirements

1. Exercise every sidebar view, the command palette, both themes, using a throwaway populated registry.
2. Confirm/deny each of the 3 known findings above with your own reproduction.
3. Report any NEW broken control you find, with exact repro steps.
4. Zero source-code changes — findings only.

## Non-goals

- Fixing anything you find.
- Performance measurement (that's M038, separate task).
- README/roadmap claims auditing (that's a separate task).

## Implementation constraints

- N/A (no code changes).

## Interface / contract

N/A.

## Dependencies

- Upstream: none (informational cross-reference to M037's merge status, not a hard dependency)
- Downstream: none — findings become separate fix tasks the lead dispatches after triage

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M039-full-qa-pass
pnpm install --frozen-lockfile
pnpm build
AI_CONFIG_HOME=$(mktemp -d)/.ai-agent-config node packages/cli/dist/index.js start --no-open
```

Also verify:

- The throwaway config home is genuinely isolated (print its path in your report, confirm it is not `~/.ai-agent-config`)
- Real console/network errors captured where possible, not assumed
- Server stopped cleanly at the end (`node packages/cli/dist/index.js stop` or kill the process) — do not leave an orphaned server running

## Expected evidence

- exact commands executed
- the full `docs/audits/qa-pass.md` content
- confirmation the founder's real registry/config files were untouched
- limitations or failures (e.g. no browser available, so verification was via served HTML/console log inspection only — say so explicitly rather than implying a visual check that didn't happen)

## Completion criteria

- every reachable view exercised
- the 3 known findings confirmed or denied with real repro
- zero source-code changes
- server cleaned up, no orphaned process, no real user data touched

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
