# M003 — Dashboard keyboard shortcuts

## Identity

- Task ID: M003
- Parent workstream: community-issues-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 7e1c825
- Branch: pi/M003-keyboard-shortcuts
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M003-keyboard-shortcuts
- Type: feature
- Priority: P3
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M003-keyboard-shortcuts`

Work ONLY within these repository paths:

- `packages/gui/src/App.tsx`
- `packages/gui/src/components/ThemeToggle.tsx`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies unless explicitly authorized.

Do not redesign the architecture.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

Refresh (the button in `App.tsx`'s header, ~line 77, calling `refreshAll()`)
and the theme toggle (`ThemeToggle.tsx`, rendered in `App.tsx` ~line 85) are
click-only today. `docs/community-issues.md` item **#5** asks for a
`Shift+R`-style refresh shortcut (plain `Cmd/Ctrl+R` is the browser's own
page-reload shortcut and must not be intercepted) and a `t` hotkey for theme
toggle, with a tooltip/legend listing the shortcuts. There is currently no
keydown handling anywhere in `packages/gui/src` (confirmed by search).

## Current state

- `App.tsx` holds `refreshAll` (from `useStore`) and renders the refresh
  button and `<ThemeToggle />` in its header.
- `ThemeToggle.tsx` keeps its `theme` state locally in `useState`, and its
  `toggle()` function both calls `document.documentElement.setAttribute(...)`
  and `localStorage.setItem(...)` — this logic and state live entirely inside
  the component, not in the shared store or a module-level utility.
- No keyboard event listeners exist anywhere in `packages/gui/src` today.

## Target state

- Pressing `Shift+R` anywhere in the app (except while focus is inside an
  `input`, `textarea`, `select`, or any `contenteditable` element) triggers
  the same refresh action as clicking the refresh button.
- Pressing `t` (same focus exclusion) toggles the theme, and `ThemeToggle`'s
  rendered icon reflects the new theme immediately (i.e. the hotkey and the
  click path must end up visually consistent — decide the smallest correct
  way to share the toggle logic/state between the global handler and the
  component; e.g. lifting the toggle function to a small exported helper in
  `ThemeToggle.tsx` that both the button's `onClick` and the global handler
  call, with the component still reflecting the current theme reactively).
- A visible tooltip or small legend (e.g. a `title` attribute on the relevant
  buttons, or a compact inline hint) lists both shortcuts somewhere reasonable
  in the header — do not build a separate modal/overlay for this.

## Read first

### Current code

- `packages/gui/src/App.tsx` (full file)
- `packages/gui/src/components/ThemeToggle.tsx` (full file)

## Allowed scope

- `packages/gui/src/App.tsx`
- `packages/gui/src/components/ThemeToggle.tsx`

## Forbidden scope

- `packages/gui/src/store/index.ts` (read-only — `refreshAll` already exists
  there; do not add new store actions for this)
- any other file
- unrelated refactors
- dependency upgrades (do not add a hotkey library — this is a small enough
  surface for a plain `keydown` listener)
- architecture changes
- formatting-only changes outside touched code

## Exact requirements

1. Add a single global `keydown` listener (e.g. via `useEffect` in `App.tsx`)
   that:
   - Ignores events when `document.activeElement` is an `input`, `textarea`,
     `select`, or has `isContentEditable === true`.
   - On `Shift+R` (no other modifiers required to also be checked beyond
     Shift): calls `refreshAll()` and calls `e.preventDefault()`.
   - On `t` (no modifiers): toggles the theme and calls `e.preventDefault()`.
2. Refactor `ThemeToggle.tsx` so its toggle behavior is callable from both the
   button's own click handler and `App.tsx`'s global handler, while the
   button's displayed icon still updates correctly regardless of which path
   triggered the toggle.
3. Add a visible hint listing both shortcuts (e.g. `title` attributes on the
   refresh button and the theme toggle button, updated to mention the
   respective hotkey — smallest correct approach, no new UI component
   required).
4. Clean up the listener on unmount (no leaked global listeners).

## Non-goals

- Remapping or intercepting `Cmd/Ctrl+R`.
- Any other keyboard shortcuts beyond refresh and theme toggle.
- Changing `refreshAll`'s behavior itself.
- Building a shortcuts help modal/overlay.

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow existing naming and module conventions.
- Follow existing error handling.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.
- Do not change unrelated behavior.
- No new dependencies (native `keydown` handling only).

## Interface / contract

`ThemeToggle`'s exported component signature (`export function ThemeToggle()`)
may gain an additional named export (e.g. a toggle function or hook) if that's
the cleanest way to share logic — but the existing `<ThemeToggle />` JSX usage
in `App.tsx` must keep working with no required new props.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run (this worktree needs its own install first — pnpm workspace symlinks are
not shared automatically into a fresh `git worktree`):

```bash
pnpm install --frozen-lockfile
pnpm --filter @ai-agent-config/gui typecheck
pnpm --filter @ai-agent-config/gui build
```

Also verify:

- `git status --short`
- changed files are within allowed scope (only `App.tsx` and `ThemeToggle.tsx`)
- describe the exact runtime behavior in the report (no GUI test harness
  exists in this package — static/typecheck verification plus a clear
  code-level walkthrough is acceptable), including explicitly confirming the
  input/textarea focus-exclusion logic and listener cleanup

## Expected evidence

The final report must include:

- exact commands executed
- real output or relevant excerpts
- files changed
- tests and results
- runtime evidence where applicable
- limitations or failures

## Completion criteria

The task is complete only when:

- all requirements are implemented
- no non-goal behavior was changed
- scope is respected
- required verification passes
- the diff has been reviewed for accidental changes
- no unresolved issue remains

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
