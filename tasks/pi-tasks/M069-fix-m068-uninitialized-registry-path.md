# M069 — Fix M068: migrateProviderApiKeyToKeychain can run with an empty registryFilePath

## Identity

- Task ID: M069
- Parent workstream: Corrective fix (M068 follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: pi/M068-migrate-plaintext-keys-to-keychain branch (continue on THIS branch, do not create a new one)
- Branch: pi/M068-migrate-plaintext-keys-to-keychain
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M068-migrate-plaintext-keys-to-keychain
- Type: bug
- Priority: P0
- Dependencies: none — this worktree already has M068's commit on it

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M068-migrate-plaintext-keys-to-keychain`

Work ONLY within these repository paths:

- `packages/core/src/index.ts`
- `packages/core/src/registry.test.ts` (add a regression test only — do not touch other tests)

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

The lead independently ran a real end-to-end check of M068 with a genuinely isolated `HOME`/`AI_CONFIG_HOME` (a fresh manager instance, no prior registry access) and found:

```
mgr.migrateProviderApiKeyToKeychain('test-e2e-provider')
=> { success: false, error: "No registry found at  — nothing to migrate." }
```

Note the empty path in the error message — `this.registryFilePath` was still `''` because `AgentConfigManager.migrateProviderApiKeyToKeychain` (added in M068) calls `migrateProviderApiKeyToKeychain(this.registryFilePath, providerId)` directly without first calling `this.requireRegistry()`, unlike every other registry-touching method in this class (`deleteProvider`, `registerProvider`, etc. — grep `this.requireRegistry()` for the established pattern). `registryFilePath` is only populated as a side effect of `initRegistry()`, which `requireRegistry()` calls lazily. If this method is the first registry operation performed on a manager instance, it silently fails with a confusing path-less error instead of working.

## Target state

`AgentConfigManager.migrateProviderApiKeyToKeychain` calls `await this.requireRegistry()` first (exactly like every other method in the class), THEN calls the core `migrateProviderApiKeyToKeychain(this.registryFilePath, providerId)` — same pattern as `deleteProvider` and the others. Do not change the core `registry.ts` function's own signature or behavior; the bug is only in how `index.ts` calls it.

## Read first

### Current code

- `packages/core/src/index.ts` — the `migrateProviderApiKeyToKeychain` method added in M068 (search for it), and at least 2 other methods that call `this.requireRegistry()` first for the established, correct pattern
- `packages/core/src/registry.ts` — `migrateProviderApiKeyToKeychain` (unchanged, for reference only)

### Tests

- Add a regression test in `packages/core/src/registry.test.ts` or a new focused test in `packages/core/src/index.ts`'s own test coverage (check which file already covers `AgentConfigManager` methods like `deleteProvider` and add the migrate test alongside it, following that file's existing pattern) that constructs a FRESH `AgentConfigManager` and calls `migrateProviderApiKeyToKeychain` as the FIRST registry operation (no prior `getRegistryState`/`registerProvider` call on that instance) against a real, isolated temp registry with a plaintext-key provider already present in the file — confirm it succeeds instead of returning the empty-path error.

## Allowed scope

- `packages/core/src/index.ts`
- `packages/core/src/registry.test.ts` (or the correct existing test file for `AgentConfigManager` methods — your call, follow whichever file already tests sibling methods like `deleteProvider`)

## Forbidden scope

- `packages/core/src/registry.ts`
- Any GUI file
- Any other file

## Exact requirements

1. `migrateProviderApiKeyToKeychain` calls `this.requireRegistry()` before using `this.registryFilePath`, matching the established pattern exactly.
2. A regression test proves it works as the FIRST registry call on a fresh manager instance.
3. Full core test suite green, zero regressions.

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M068-migrate-plaintext-keys-to-keychain
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` shows only the allowed files
- Re-run the lead's exact repro (fresh manager, isolated `HOME`/`AI_CONFIG_HOME`, migrate as the first call) and confirm it now succeeds — paste the real output

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
