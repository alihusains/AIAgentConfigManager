# M061 — Warn on registry import when a keychain-backed key or a custom-agent path won't carry over

## Identity

- Task ID: M061
- Parent workstream: Cross-platform / cross-machine registry portability (founder-reported gap)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M061-registry-import-portability-warnings
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M061-registry-import-portability-warnings
- Type: feature
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M061-registry-import-portability-warnings`

Work ONLY within these repository paths:

- `packages/core/src/index.ts`
- `packages/core/src/registry.test.ts` (or the appropriate existing test file — check first)
- `packages/gui/src/components/SettingsView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/smoke.test.tsx`

Read every file listed in "Read first" before writing code.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

The founder asked whether a registry exported on macOS and imported on Windows (or vice versa) would work. Two real, confirmed gaps in the current `importRegistry` (`packages/core/src/index.ts`):

1. A provider with `keychainSecretRef` set never carries its real key in the export (correct — that's the whole point of keychain storage, a real key must never be embedded in a portable JSON file), but on import, that provider silently ends up with no real key at all — `resolveProviderApiKey` will return `null` and the provider will simply fail to verify, with no clear explanation to the user about WHY.
2. A custom agent's `configPath` (and any other agent-specific absolute path field) is OS-specific (`/Users/...` on macOS/Linux vs `C:\Users\...` on Windows). Importing a registry exported on one OS onto a different OS carries stale, wrong paths with no warning.

## Current state

Read `importRegistry` in `packages/core/src/index.ts` in full (the shape-validation logic already there). Read `RegistryProvider`/`CustomAgentDef` types in `packages/core/src/types/index.ts` to confirm the exact fields involved (`keychainSecretRef`, `configPath`).

## Target state

1. Extend `importRegistry`'s return shape (it likely already supports a `warnings` array somewhere in this codebase's existing patterns — check `registerProvider`/other operations for the established warnings convention and match it) to include a clear warning for:
   - Each imported provider that has a `keychainSecretRef` — e.g. `"Provider '<name>' was exported with a keychain-stored key. The real key does not travel with the export; you'll need to re-enter it."`
   - Each imported custom agent whose `configPath` looks like it's from a different OS than the CURRENT one (a simple heuristic is fine: a path starting with `C:\` or containing `\` when running on macOS/Linux, or a path starting with `/` when running on Windows) — e.g. `"Custom agent '<name>''s config path looks like it's from a different OS. Update it before it's used."`
2. Surface these warnings clearly in the GUI's import flow (`SettingsView.tsx`) — a toast or an inline list, not silently swallowed. Follow the existing warnings-display convention already used elsewhere in this codebase for provider delete/install warnings (do not invent a new pattern).
3. Do NOT block the import — these are warnings, not errors; the import should still succeed and the user fixes the flagged entries afterward.

## Read first

### Current code

- `packages/core/src/index.ts` (`importRegistry`, and an existing operation that already returns `warnings` — find and match that exact pattern)
- `packages/core/src/types/index.ts` (`RegistryProvider.keychainSecretRef`, `CustomAgentDef.configPath`)
- `packages/gui/src/components/SettingsView.tsx` (the current import flow and how it displays a result)
- `packages/gui/src/api.ts` (the import client function)

### Tests

- Extend the appropriate existing test file with: importing a registry containing a keychain-backed provider produces the expected warning; importing a registry with an obviously-other-OS custom-agent path produces the expected warning; a normal import with neither condition produces no such warnings; the import still succeeds in all cases (warnings never block it).

## Allowed scope

- `packages/core/src/index.ts`
- `packages/core/src/registry.test.ts` (or the correct existing test file)
- `packages/gui/src/components/SettingsView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- Any other file
- `packages/core/src/keychain.ts`, `packages/core/src/env-vars.ts`

## Exact requirements

1. Both warning cases implemented, using the existing warnings convention.
2. Import never blocked by these warnings.
3. GUI surfaces the warnings clearly.
4. Real test coverage for all 3 scenarios (keychain warning, cross-OS-path warning, clean import).
5. Full core + gui test suites green.

## Non-goals

- No automatic path translation/correction — just an honest warning.
- No re-prompt-for-key UI flow (that's a separate, later task) — just the warning that one is needed.

## Implementation constraints

- Match the existing `warnings` convention exactly, do not invent a new response shape.
- Smallest correct diff.
- No speculative abstractions.

## Interface / contract

`importRegistry`'s return shape gains a `warnings?: string[]` field (or extends an existing one) — additive only.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M061-registry-import-portability-warnings
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Real import of a constructed test registry containing both conditions, confirming both warnings appear and the import still succeeds

## Expected evidence

- exact commands executed
- real test output
- files changed
- real import repro showing both warnings
- limitations or failures

## Completion criteria

- both warning cases implemented and tested
- import never blocked
- full test suites green

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
