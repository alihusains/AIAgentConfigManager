# M058 — Environment variables: allow editing process-only vars via profile-file adoption

## Identity

- Task ID: M058
- Parent workstream: Environment variable management (M048/M049 follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M058-env-vars-allow-editing-process-only
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M058-env-vars-allow-editing-process-only
- Type: feature
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M058-env-vars-allow-editing-process-only`

Work ONLY within these repository paths:

- `packages/core/src/env-vars.ts`
- `packages/core/src/env-vars.test.ts`
- `packages/gui/src/components/EnvVarsView.tsx`
- `packages/gui/src/smoke.test.tsx`

Read every file listed in "Read first" before writing code.

Do not modify any real dotfile on this machine during tests or manual verification — always use a temp/mocked path, exactly like M048's existing tests already do.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

The founder tried to edit a process-only environment variable in the new Environment view and found it read-only with no way to change it. The current design (M048/M049) marks any variable that exists in `process.env` but not in any shell profile file as `editable: false`, with a note explaining why. This is CORRECT in spirit (a tool can only persist a value by writing to a file it controls; a process-only variable was set by a parent process — this terminal, an IDE, launchd — and no file backs it yet), but it's an unnecessarily hard stop. The real fix: let the user "adopt" that variable into a shell profile file, converting it from process-only into a shell-profile-backed variable going forward — with an honest, visible note that changing it will NOT retroactively affect any already-running process (a hard, universal OS constraint no tool can work around — the same reason `export FOO=bar` in one terminal tab never affects a tab already open).

## Current state

Read `packages/core/src/env-vars.ts` in full, especially `listEnvVars` (the process-only branch that sets `editable: false`) and `setEnvVar`/`removeEnvVar` (the existing shell-profile write logic — reuse this exact logic, do not duplicate it). Read `packages/gui/src/components/EnvVarsView.tsx` in full to see how the current read-only state is rendered (the "shows why" pattern already implemented) and where an "Edit anyway (add to profile)" action would fit.

## Target state

1. **Core:** `setEnvVar`/equivalent already writes/updates a shell-profile line. Confirm (or adjust if needed) that calling `setEnvVar` for a name that currently only exists in `process.env` correctly ADDS a new `export NAME=value` line to the target profile file (following the exact same file-selection logic already used for a brand-new variable), and that a subsequent `listEnvVars()` call now reports that variable as `source: 'shell-profile'`, `editable: true` — i.e., confirm the existing write path already handles this case correctly (it likely does, since it wasn't scoped around "does this name already exist elsewhere" — but verify with a real test, don't assume).
2. **GUI:** for a row currently shown as read-only specifically because of the "process-only, not in a profile file" reason (not other read-only reasons like Windows system-level vars, which must stay genuinely read-only since this tool cannot write those safely), add a clear action (e.g. "Edit anyway" or "Add to profile") that opens the existing edit modal. Before/within that modal, show an explicit, unmissable note: "This variable is currently set by a running process. Adding it to your shell profile will apply to new terminal sessions only — it will not change this or any already-running process." Do not silently drop this caveat; it must be visible at the moment of the edit action, not buried elsewhere.
3. Do NOT add this override action for genuinely non-writable cases (Windows system-level `HKEY_LOCAL_MACHINE` entries) — those stay read-only with their existing explanation, since this tool cannot safely write them without admin elevation it doesn't have. Confirm which `editable: false` cases get the new override and which don't; document your reasoning.

## Read first

### Current code

- `packages/core/src/env-vars.ts` (full file — `listEnvVars`'s process-only branch, `setEnvVar`'s existing write logic)
- `packages/gui/src/components/EnvVarsView.tsx` (full file — the current read-only rendering and reason display)

### Tests

- `packages/core/src/env-vars.test.ts` — new test: a process-only-simulated variable, after `setEnvVar`, is subsequently reported as `shell-profile`/`editable: true` by `listEnvVars`, using a temp mocked profile file exactly like the existing tests.
- `packages/gui/src/smoke.test.tsx` — new assertions: a process-only row shows the override action with the caveat text; a Windows-system-level-style row (mock the data) does NOT show it.

## Allowed scope

- `packages/core/src/env-vars.ts`
- `packages/core/src/env-vars.test.ts`
- `packages/gui/src/components/EnvVarsView.tsx`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- Any other file
- Any change to Windows system-level (`HKEY_LOCAL_MACHINE`) handling — that must stay read-only

## Exact requirements

1. A process-only variable (missing from any shell profile) can be edited via an explicit "adopt into profile" action.
2. The caveat about not affecting already-running processes is shown clearly at the point of that action, not hidden.
3. Genuinely non-writable cases (Windows system-level) are NOT given this override.
4. Real test coverage for both the allowed and disallowed override cases, using only temp/mocked files — zero real dotfile edits.
5. Full core + gui test suites green.

## Non-goals

- No change to Windows system-level var handling.
- No retroactive "live update this process's environment" feature — that is impossible for any external tool and must not be implied anywhere in the UI copy.

## Implementation constraints

- Reuse the existing `setEnvVar` write logic exactly — do not duplicate shell-profile-writing code.
- Follow existing naming/component conventions.
- Smallest correct diff.
- No speculative abstractions.

## Interface / contract

No breaking changes to `EnvVarEntry`/`listEnvVars`/`setEnvVar` signatures — this is a UI-and-behavior refinement using the existing contract.

## Dependencies

- Upstream: none (M048/M049 already merged)
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M058-env-vars-allow-editing-process-only
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Confirm no real dotfile on this machine was touched (checksum before/after, as done in M048)
- Real before/after: a process-only variable, after using the new action against a temp profile file, is reported as editable on the next `listEnvVars()` call

## Expected evidence

- exact commands executed
- real test output
- files changed
- confirmation no real dotfile was touched
- limitations or failures

## Completion criteria

- process-only variables can be adopted into a profile file via a clear, honest UI action
- Windows system-level vars remain correctly read-only
- full test suites green
- zero real-dotfile side effects

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
