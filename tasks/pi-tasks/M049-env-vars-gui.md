# M049 — Environment Variables view: new sidebar page, redacted by default, search/edit

## Identity

- Task ID: M049
- Parent workstream: New feature — centralized environment variable management
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch — branch AFTER M048 is merged>
- Branch: pi/M049-env-vars-gui
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M049-env-vars-gui
- Type: feature
- Priority: P1
- Dependencies: M048 must be merged first

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M049-env-vars-gui`

Work ONLY within these repository paths:

- `packages/gui/src/components/EnvVarsView.tsx` (new file)
- `packages/gui/src/components/Sidebar.tsx` (add one nav entry)
- `packages/gui/src/App.tsx` (wire the new view into routing)
- `packages/gui/src/store/index.ts` (add the new view id to the view-union type only)
- `packages/gui/src/api.ts`
- `packages/gui/src/index.css` (env-vars-view rules only)
- `packages/gui/src/smoke.test.tsx`

Read every file listed in "Read first" before writing code, especially M048's actual merged diff and final report for the exact API shape.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder wants a single place in the dashboard to see and manage environment variables (system + user), instead of hunting through shell profiles / OS settings. M048 built the backend (`listEnvVars`/`setEnvVar`/`removeEnvVar` with redaction). This task adds the actual GUI page.

## Target state

A new "Environment" entry in the sidebar (place it in the existing "Registry" or "System" section — check `Sidebar.tsx`'s current grouping and pick whichever fits the existing information architecture best, document your choice), rendering a new `EnvVarsView` that:

- Lists every env var from M048's `listEnvVars()`, grouped or tagged by `source` (process / shell-profile / windows-user / windows-system) with clear labeling of which ones this tool can edit (`editable`) vs. read-only.
- Values are redacted by default for anything `looksSensitive`, with an explicit per-row "reveal" toggle/icon (mirroring the existing masked-key pattern already planned for provider secrets in `docs/design/phase1-secrets-design.md` — consistent visual language, e.g. `sk-...ab12` with an eye icon to reveal).
- A search/filter box (this is a potentially large list — dozens to 100+ vars on a real machine; must stay responsive and scrollable vertically only, never horizontally, at 1024px and 1440px viewport widths).
- Add/edit/remove actions for `editable` entries, using the existing modal/form patterns already in this codebase (`Modal`, `Field` from `packages/gui/src/ui/`) — do not invent a new modal pattern.
- A read-only entry (not editable) shows why (e.g. "requires admin privileges" or "set by a parent process, not a profile file") rather than a disabled control with no explanation — this project's stated honesty principle (never show a disabled thing with no reason).
- Styled entirely with v2 tokens (`docs/epics/agentic-control-plane-redesign-v2.md`), consistent with the rest of the redesigned app — no hardcoded hex, matching the row-hierarchy/hover-reveal-actions pattern already established for the Providers/MCP tables (reuse that visual language for consistency, but this is a NEW component file, not a shared one — you are not editing `ProvidersView.tsx`/`MCPView.tsx`).

## Read first

### Current code

- `packages/gui/src/components/Sidebar.tsx` (nav structure, `REGISTRY_VIEWS` array, grouping)
- `packages/gui/src/App.tsx` (view routing switch)
- `packages/gui/src/store/index.ts` (the view-id union type)
- `packages/gui/src/components/SkillsView.tsx` and `packages/gui/src/components/MCPView.tsx` (as structural/visual references for a new registry-style view — read for conventions, do not edit)
- `packages/gui/src/ui/` (`Modal`, `Field`, `Badge`, `Button`, `EmptyState`, `Skeleton` — reuse these primitives)

### Reference / specification

- M048's merged commit and final report (the exact `EnvVarEntry` shape and route paths)
- `docs/epics/agentic-control-plane-redesign-v2.md`
- `docs/design/phase1-secrets-design.md` (redaction/reveal visual language to stay consistent with)

### Tests

- `packages/gui/src/smoke.test.tsx` — add assertions covering: the view renders, redaction hides a sensitive-looking value by default, reveal shows it, search narrows the list, a read-only row shows its reason.

## Allowed scope

- `packages/gui/src/components/EnvVarsView.tsx` (new)
- `packages/gui/src/components/Sidebar.tsx` (one new nav entry)
- `packages/gui/src/App.tsx` (routing wire-up)
- `packages/gui/src/store/index.ts` (view-id union addition only)
- `packages/gui/src/api.ts`
- `packages/gui/src/index.css` (env-vars-view rules only)
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/`, `packages/cli/` (M048's territory, already merged, do not modify)
- Any other component file

## Exact requirements

1. New sidebar entry, new view, wired into routing.
2. Full list from M048's API, grouped/labeled by source and editability.
3. Redaction by default with an explicit reveal action.
4. Search/filter, responsive, zero horizontal scroll at 1024px/1440px.
5. Add/edit/remove for editable entries using existing UI primitives.
6. Read-only entries show why, not just a disabled control.
7. Fully styled with v2 tokens, both themes.

## Non-goals

- No changes to any other view.
- No system-level write support (M048 doesn't provide it either).

## Implementation constraints

- Follow existing naming/class/component conventions exactly.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

Consumes M048's API exactly as documented in its final report.

## Dependencies

- Upstream: M048
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M049-env-vars-gui
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server, open the new Environment view against this real machine's actual env vars (read-only checks are safe; do NOT click add/edit/remove against real env vars during this verification — use a temp/mocked config path for any mutating action check), confirm redaction/reveal, search, and responsive behavior at 1024px/1440px
- Stop the server after

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- confirmation no real environment variable or dotfile was modified during verification
- limitations or failures

## Completion criteria

- all requirements implemented and demonstrated
- zero real-system side effects during verification
- scope respected

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
