# M059 — Fix `gui-server.ts` importing `core/dist/keychain.js` directly instead of the package export

## Identity

- Task ID: M059
- Parent workstream: Hygiene fix (M057 follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M059-fix-keychain-dist-import
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M059-fix-keychain-dist-import
- Type: bug
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M059-fix-keychain-dist-import`

Work ONLY within these repository paths:

- `packages/core/src/index.ts`
- `packages/cli/src/gui-server.ts`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

M057 (merged) needed `isKeychainAvailable` from `packages/core/src/keychain.ts` inside `gui-server.ts`, but `keychain.ts` was deliberately not re-exported from `packages/core/src/index.ts` (M050 kept it isolated on purpose, to avoid touching the registry wiring in that task). Rather than adding the export, M057 imported directly from the compiled output path (`@ai-agent-config/core/dist/keychain.js` or similar) — a fragile shortcut that bypasses the package's declared public API and will break silently if the build output structure ever changes.

## Current state

Read the exact import statement M057 added in `packages/cli/src/gui-server.ts` (search for `keychain` in that file) and `packages/core/src/index.ts`'s existing `export * from '...'` pattern for every other module.

## Target state

1. Add `export * from './keychain';` to `packages/core/src/index.ts` (matching the exact pattern already used for `env-vars`, `provider-test`, etc.).
2. Update `gui-server.ts`'s import to use the normal package import (`@ai-agent-config/core`) instead of reaching into `dist/`.
3. Confirm nothing else in the codebase still imports from a `core/dist/*` path directly (grep the whole repo to be sure this was the only instance).

## Read first

### Current code

- `packages/core/src/index.ts` (the existing export-per-module pattern)
- `packages/cli/src/gui-server.ts` (the exact fragile import M057 added)

### Tests

- No new tests needed — this is a pure import-path fix; existing M057/M050 tests must continue to pass unmodified.

## Allowed scope

- `packages/core/src/index.ts`
- `packages/cli/src/gui-server.ts`

## Forbidden scope

- Any other file

## Exact requirements

1. `keychain.ts` is exported from `core`'s public entry point.
2. `gui-server.ts` imports it the normal way, zero `dist/` path references anywhere in the repo.
3. Full build + test suites still green, zero behavior change.

## Non-goals

- No other refactor.

## Implementation constraints

- Smallest possible diff — this is a two-line fix, not a redesign.

## Interface / contract

No public behavior change — only the import mechanism changes.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M059-fix-keychain-dist-import
pnpm install --frozen-lockfile
pnpm build
pnpm test
grep -rn "core/dist" packages/ --include="*.ts" --include="*.tsx"
```

Also verify:

- `git status --short` within allowed scope only
- The grep above returns nothing

## Expected evidence

- exact commands executed
- real test output
- files changed
- confirmation the grep found zero remaining dist-path imports

## Completion criteria

- clean package-level import, zero dist-path references, full test suite green

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
