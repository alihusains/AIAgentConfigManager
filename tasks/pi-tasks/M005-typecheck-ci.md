# M005 — Add TypeScript check to CI

## Identity

- Task ID: M005
- Parent workstream: community-issues-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 7e1c825
- Branch: pi/M005-typecheck-ci
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M005-typecheck-ci
- Type: refactor
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M005-typecheck-ci`

Work ONLY within these repository paths:

- `.github/workflows/` (new file only)
- `turbo.json`
- `package.json` (root)
- `packages/gui/package.json`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies unless explicitly authorized.

Do not redesign the architecture.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

`pnpm build` type-checks `packages/core` and `packages/cli` (their `build`
script is plain `tsc`), but `packages/gui`'s `build` script is `vite build`,
which does NOT fail on TypeScript type errors — Vite transpiles/strips types
without a full program check. `packages/gui/package.json` already has a
`typecheck` script (`tsc --noEmit`), but nothing in `turbo.json`'s task
pipeline or CI runs it, so a real type error in the GUI package can currently
merge with a fully green `pnpm build`. There is also no `.github/workflows/`
directory at all today (only `.github/ISSUE_TEMPLATE/` exists) — no CI runs on
push/PR currently.

## Current state

- `turbo.json` tasks: `build`, `dev`, `test`, `lint` — no `typecheck` task.
- `packages/core/package.json` and `packages/cli/package.json` scripts:
  `build` (`tsc`), `dev`, `test` (`vitest run`), `lint` (`eslint src --ext .ts`).
- `packages/gui/package.json` scripts: `dev`, `build` (`vite build`),
  `typecheck` (`tsc --noEmit`) — no `lint` script, no `test` script.
- No `.eslintrc*` config exists anywhere in the repo (root or per-package), so
  the existing `lint` scripts in core/cli would themselves currently fail
  with a missing-config error if run — that is a pre-existing gap, out of
  scope for this task; do not attempt to fix or add an ESLint config here.
- No `.github/workflows/` directory exists.

## Target state

A GitHub Actions workflow runs on push and pull_request, installs
dependencies with pnpm, and runs a command that fails the check if any
package (including the GUI, via its `typecheck` script) has a TypeScript type
error. `packages/gui`'s type errors specifically must be able to fail this
CI check — this is the concrete gap the community issue names.

## Read first

### Current code

- `turbo.json` (full file)
- `package.json` (root, full file)
- `packages/gui/package.json` (full file)
- `packages/core/package.json`, `packages/cli/package.json` (for the existing
  `build`/`test`/`lint` script shapes, to keep the new workflow consistent
  with how this repo already runs pnpm/turbo)
- `pnpm-workspace.yaml`, `.github/ISSUE_TEMPLATE/*.yml` (for existing repo
  conventions/formatting — read-only, do not edit)

### Reference / specification

- `docs/community-issues.md` item **#7** ("Add TypeScript check to CI")

## Allowed scope

- a new file under `.github/workflows/` (e.g. `.github/workflows/ci.yml`)
- `turbo.json`
- `package.json` (root)
- `packages/gui/package.json`

## Forbidden scope

- `packages/core/package.json`, `packages/cli/package.json` (their existing
  `build` already type-checks via plain `tsc` — do not modify their scripts)
- adding or modifying any ESLint config (`lint` staying broken/unconfigured is
  a separate pre-existing gap, not this task's job)
- any GUI/CLI/core source file
- any other file
- unrelated refactors
- dependency upgrades
- architecture changes
- formatting-only changes outside touched code

## Exact requirements

1. Add a `typecheck` task to `turbo.json`'s `tasks` map (no persistent cache
   needed; follow the existing `lint` task's shape — `outputs: []` — as the
   closest analog, and add `dependsOn: ["^build"]` only if that's genuinely
   required for the workspace's type resolution to work correctly; otherwise
   omit it, whichever is actually correct for this repo).
2. Ensure `packages/gui`'s `typecheck` script (`tsc --noEmit`, already
   present) is picked up by `turbo run typecheck` — add a `typecheck` script
   to any package that needs one for the turbo task to resolve across the
   workspace (core/cli already effectively type-check via their `build`
   script; add a thin `"typecheck": "tsc --noEmit"` to those only if needed
   for `turbo run typecheck` to run without error across all packages — check
   turbo's actual behavior when a task is missing from some packages before
   adding scripts speculatively).
3. Add a root script, e.g. `"typecheck": "turbo run typecheck"`, to
   `package.json`, following the existing pattern of `"build": "turbo run build"`.
4. Add `.github/workflows/ci.yml` (or similarly named) that: triggers on
   `push` and `pull_request`; checks out the repo; sets up Node (>=20, per
   the root `package.json` `engines` field) and pnpm (pinned to the
   `packageManager` field's version, `pnpm@9.0.0`); runs `pnpm install
   --frozen-lockfile`; runs `pnpm build` (needed so `core`'s `dist` exists for
   dependent packages, matching local dev practice) and then
   `pnpm typecheck`; fails the job (default GitHub Actions behavior) if either
   command exits non-zero.
5. Do not add a lint step to this workflow — no working ESLint config exists,
   so wiring `pnpm lint` into CI here would make the workflow fail
   unconditionally on a pre-existing, out-of-scope gap.

## Non-goals

- Fixing the missing ESLint configuration.
- Adding a lint CI step.
- Adding test-coverage reporting or any other CI check beyond build+typecheck.
- Changing any application source code.

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow existing naming and module conventions.
- Follow existing error handling.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.
- Do not change unrelated behavior.
- Do not add new npm dependencies.

## Interface / contract

- The workflow must be a valid, syntactically correct GitHub Actions YAML file.
- `turbo run typecheck` must actually execute `tsc --noEmit` for
  `packages/gui` (the specific gap named in the issue) and exit non-zero on a
  real type error.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
```

Also verify:

- `git status --short`
- changed files are within allowed scope
- as a real regression check: temporarily introduce an obvious type error
  into a throwaway scratch file inside `packages/gui/src` (e.g. assign a
  `number` to a variable typed `string`), confirm `pnpm typecheck` fails
  non-zero, then fully revert that scratch change before finishing (confirm
  `git status --short` is clean of it) — paste both the failing and the
  clean passing output in the report.
- validate the new YAML file's syntax (e.g. `python3 -c "import yaml,
  sys; yaml.safe_load(open(sys.argv[1]))" .github/workflows/ci.yml` or
  equivalent) since no local GitHub Actions runner exists to execute the
  workflow itself.

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
