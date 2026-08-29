# M050 — Phase 1 foundation: OS keychain wrapper module (new, additive, no adapter changes yet)

## Identity

- Task ID: M050
- Parent workstream: Phase 1 (Secrets) — productroadmap.md
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M050-phase1-keychain-foundation
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M050-phase1-keychain-foundation
- Type: feature
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M050-phase1-keychain-foundation`

Work ONLY within these repository paths:

- `packages/core/src/keychain.ts` (new file)
- `packages/core/src/keychain.test.ts` (new file)
- `packages/core/package.json` (one new dependency only — see below)
- `packages/core/src/types/index.ts` (an ADDITIVE, optional field only — see below)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

**Do not touch `registry.ts`, any adapter, `provider-test.ts`, or `materializeAgent`/`initRegistry` in `index.ts` — this task builds the keychain wrapper module in isolation only. Wiring it into the actual registry read/write/materialization flow is deliberately a separate, later task** (this is a lead decision: credential-handling wiring is security-sensitive and will be scoped precisely once this foundation is proven, not bundled into the same change).

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

`docs/design/phase1-secrets-design.md` (already researched and merged) recommends `@napi-rs/keyring` after surveying `keytar` (unmaintained/deprecated), `@napi-rs/keyring`, and `cross-keychain`. This task builds the actual keychain read/write wrapper module against that recommendation as an isolated, testable unit — the first concrete step of Phase 1 — without yet touching how the registry or any adapter uses it (that wiring is intentionally sequenced as later, separate work once this foundation is proven solid).

## Current state

Read `docs/design/phase1-secrets-design.md` in full, specifically the "Recommended Implementation Plan: Option 2" and "Appendix: Keychain API Reference" sections — implement against what that doc already specified as the API shape; if you find the doc's proposed shape is unworkable for a real reason, deviate and document exactly why in your final report, but default to following it.

## Target state

A new module `packages/core/src/keychain.ts`:

```ts
export interface KeychainEntry {
  service: string;  // fixed namespace for this app, e.g. 'ai-agent-config'
  account: string;  // e.g. `provider:<providerId>` — the reference stored in registry.json
}

export async function setSecret(account: string, value: string): Promise<void>
export async function getSecret(account: string): Promise<string | null>
export async function deleteSecret(account: string): Promise<void>
/** Returns false (never throws) when the OS keychain is unavailable in this environment (e.g. headless CI, a locked keychain, an unsupported platform) — callers must handle this gracefully, never assume keychain access always succeeds. */
export async function isKeychainAvailable(): Promise<boolean>
```

- Add `@napi-rs/keyring` as a dependency of `packages/core` (check the exact current package name/version on npm yourself before adding — do not guess the version, the design doc's citation may be stale by now; verify via `npm view @napi-rs/keyring` or the actual npm registry page).
- Wrap every keychain call in error handling that never throws an uncaught exception to the caller — a locked keychain, a missing native binding on an unsupported platform/arch, or a CI/headless environment must all degrade to a clear, typed failure (`null`/`false`/a thrown typed error your module defines, not a raw native exception), matching this project's stated policy of no silent failures AND no scary uncaught native crashes for something this optional at this stage.
- Add ONE additive, optional field to a type in `packages/core/src/types/index.ts` (your call on the exact type — likely wherever a provider's `apiKey`-equivalent field is currently typed) representing "this credential is stored in the keychain, here is its account reference" — additive only, do not change or remove any existing field, and do not touch `registry.ts`'s actual read/write logic in this task (that's the separate wiring task).

## Read first

### Current code

- `docs/design/phase1-secrets-design.md` (full doc — this task implements its foundation layer)
- `packages/core/src/types/index.ts` (find the provider/credential-related type to extend additively)
- `packages/core/package.json` (existing dependency conventions)

### Reference / specification

- `docs/design/phase1-secrets-design.md`

### Tests

- `packages/core/src/keychain.test.ts` — new file. Since a real OS keychain may not be reliably available/interactive in this environment, structure tests to: (a) call `isKeychainAvailable()` first and skip the round-trip tests gracefully (not fail the suite) if it returns false, logging clearly why; (b) if available, do a real set→get→delete round-trip against a clearly-scoped TEST-only account name (e.g. `test:ci-roundtrip-<random>`) and verify it, then clean up by deleting it — never leave a test credential behind in the real keychain.

## Allowed scope

- `packages/core/src/keychain.ts` (new)
- `packages/core/src/keychain.test.ts` (new)
- `packages/core/package.json` (one dependency addition)
- `packages/core/src/types/index.ts` (one additive optional field)

## Forbidden scope

- `packages/core/src/registry.ts`
- `packages/core/src/provider-test.ts`
- `packages/core/src/index.ts` (`materializeAgent`, `initRegistry`, or anything else)
- Any adapter file
- Any GUI/CLI file

## Exact requirements

1. `keychain.ts` implemented exactly per the interface above (or a documented, justified deviation).
2. Real dependency added at a real, verified current version.
3. Tests that gracefully skip (not fail) when no real keychain is available in this environment, and clean up after themselves when one is.
4. One additive type field only, nothing else touched.
5. Full core test suite still green (new tests included, gracefully skipped where appropriate).

## Non-goals

- No wiring into `registry.ts`, adapters, or the GUI — that is later, separate work.
- No CLI command for managing keychain entries yet.
- No migration of any existing plaintext key.

## Implementation constraints

- Never let a keychain failure crash or hang the process — always degrade gracefully with a clear typed result.
- Follow existing naming/error-handling conventions in the codebase.
- Prefer the smallest correct diff.
- No speculative abstractions beyond the specified interface.

## Interface / contract

See the `KeychainEntry`/function signatures above — this is the frozen contract for the future wiring task.

## Dependencies

- Upstream: none
- Downstream: a future task (not yet dispatched) will wire this into `registry.ts`/adapters — the lead will scope that separately once this foundation is verified

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M050-phase1-keychain-foundation
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` within allowed scope only
- Real output showing whether a real keychain was available in this environment and, if so, a real round-trip result (with cleanup confirmed)
- Confirm the added dependency's exact version and that `pnpm install` succeeds cleanly (no native build failures) in this environment

## Expected evidence

- exact commands executed
- real test output, including whether keychain tests ran or gracefully skipped and why
- files changed
- the exact dependency version added and how you verified it's current
- limitations or failures

## Completion criteria

- module implemented and tested per the contract
- no scope creep into wiring/registry/adapters
- full test suite green (skips are fine, failures are not)

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
