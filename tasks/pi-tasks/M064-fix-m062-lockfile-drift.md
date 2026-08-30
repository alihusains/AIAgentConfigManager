# M064 — Regenerate pnpm-lock.yaml after M062's package.json changes

## Identity

- Task ID: M064
- Parent workstream: Corrective fix (M062 follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: pi/M062-npm-distribution branch (NOT main — this is a direct correction of M062's own uncommitted worktree, work in that exact worktree)
- Branch: pi/M062-npm-distribution (continue on the SAME branch, do not create a new one)
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M062-npm-distribution
- Type: bug
- Priority: P0
- Dependencies: none — this worktree already exists with M062's commit on it

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M062-npm-distribution`

(This worktree already has M062's commit `89ca41b` on it — do not recreate the worktree, do not touch any file M062 already changed except `pnpm-lock.yaml`.)

Work ONLY within these repository paths:

- `pnpm-lock.yaml`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

M062 moved `@ai-agent-config/core` to `devDependencies` in `packages/cli/package.json` and made other package.json changes, but never regenerated `pnpm-lock.yaml`. The lead ran `pnpm install --frozen-lockfile` (the exact mode CI uses) and got a real, reproducible failure: `ERR_PNPM_OUTDATED_LOCKFILE — Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with packages/cli/package.json`. This would break CI and any fresh clone.

## Target state

1. Run `pnpm install` (WITHOUT `--frozen-lockfile`, since you need it to actually update the lockfile) to regenerate `pnpm-lock.yaml` so it matches the current `packages/cli/package.json` and `packages/core/package.json`.
2. Confirm `pnpm install --frozen-lockfile` then succeeds cleanly (no `ERR_PNPM_OUTDATED_LOCKFILE`).
3. Re-run the full build + test suite to confirm nothing regressed from the lockfile update itself.
4. Commit ONLY `pnpm-lock.yaml` — do not re-commit or touch any file M062 already changed.

## Read first

- `packages/cli/package.json`, `packages/core/package.json` (M062's already-committed changes — read-only, do not modify)

## Allowed scope

- `pnpm-lock.yaml`

## Forbidden scope

- Any other file (all of M062's other changes are already committed and correct — do not touch them)

## Exact requirements

1. `pnpm install --frozen-lockfile` succeeds cleanly after your fix.
2. Full build + test suite still green.
3. Only `pnpm-lock.yaml` changes.

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M062-npm-distribution
pnpm install
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Also verify:

- `git status --short` shows only `pnpm-lock.yaml`
- The frozen-lockfile install's real output showing success (not just build success afterward)

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- pnpm-lock.yaml

COMMANDS_RUN:
```text
<real commands and relevant output, especially the frozen-lockfile success>
```

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
