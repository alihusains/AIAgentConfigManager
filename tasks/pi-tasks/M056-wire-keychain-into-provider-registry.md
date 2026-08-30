# M056 — Wire keychain storage into the provider registry (opt-in, new providers only)

## Identity

- Task ID: M056
- Parent workstream: Phase 1 (Secrets) — productroadmap.md
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M056-wire-keychain-into-provider-registry
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M056-wire-keychain-into-provider-registry
- Type: feature
- Priority: P0
- Dependencies: none (M050's keychain module is already merged to main)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M056-wire-keychain-into-provider-registry`

Work ONLY within these repository paths:

- `packages/core/src/registry.ts`
- `packages/core/src/index.ts`
- `packages/core/src/provider-test.ts`
- `packages/core/src/registry.test.ts` (or a new sibling test file if none exists — check first)

Read every file listed in "Read first" before writing code.

**This task is core-only. Do not touch any GUI file, and do not touch `packages/cli/src/gui-server.ts`.** A follow-up task will add the GUI toggle once this backend contract is proven. This is a deliberate, lead-decided scope boundary for security-sensitive work — do not widen it.

**Do not migrate any existing plaintext key.** This task only affects NEW providers explicitly opting in; every existing provider with a plaintext key must continue to work byte-for-byte identically, with zero behavior change, unless the caller explicitly opts a NEW provider into keychain storage.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

M050 (already merged) added an isolated `packages/core/src/keychain.ts` module (`setSecret`/`getSecret`/`deleteSecret`/`isKeychainAvailable`) and an additive `keychainSecretRef?: string` field on `RegistryProvider`, deliberately NOT wired into the registry read/write flow yet. This task does that wiring — the next concrete step of Phase 1 (Secrets), per `docs/design/phase1-secrets-design.md`'s "Recommended Implementation Plan: Option 2."

## Current state

Read `docs/design/phase1-secrets-design.md` in full — specifically "Option 2: Unified Keychain Service with Registry References" and the "Recommended Implementation Plan" section — this task implements that plan's registry-layer piece.

Read `packages/core/src/registry.ts` in full: how a provider's `config.apiKey` (or equivalent field — confirm the exact field name) is currently read/written, and how `registerProvider`/`updateProvider` currently persist a provider's config to `registry.json`.

Read `packages/core/src/provider-test.ts`: this is where a provider's REAL key value is needed to make a live verification API call — this is the critical path that must correctly resolve a keychain-backed key back to a real string before making the HTTP request.

Read `packages/core/src/keychain.ts` (already merged) for the exact API you're wiring in — do not change that module's public interface, only consume it.

## Target state

1. **Resolution helper:** a new function (e.g. `resolveProviderApiKey(provider: RegistryProvider): Promise<string | null>`) in `registry.ts` (or `index.ts`, your call on the best home — document it) that: if `provider.keychainSecretRef` is set, calls `keychain.getSecret(provider.keychainSecretRef)` and returns that; otherwise returns the existing plaintext `config.apiKey` field unchanged (full backward compatibility). If the keychain lookup fails (returns `null`, e.g. keychain unavailable or entry missing), return `null` and let the caller decide how to surface that (do not throw).

2. **Opt-in write path:** extend `registerProvider` (or add a new explicit variant — your call, keep the existing function's default behavior 100% unchanged for callers that don't opt in) so a caller can request keychain storage for a NEW provider's key: when requested, call `keychain.setSecret(ref, realKey)` with a deterministic reference (e.g. `provider:<providerId>`), store `keychainSecretRef` on the registry entry, and do NOT persist the real key in `config.apiKey` in `registry.json` (store an empty string or omit the field — your call, document which, but the real key must never land in the JSON file when this path is used). If the keychain write fails (`isKeychainAvailable()` false, or `setSecret` throws), the registration must fail cleanly with a clear error — never silently fall back to writing the plaintext key to disk without the caller explicitly knowing that happened (this is the one place where a silent fallback would be a real security regression, not just a UX inconvenience).

3. **Wire `provider-test.ts`'s verification flow** to call the new resolution helper instead of reading `config.apiKey` directly, so a keychain-backed provider can still be verified. If resolution returns `null` (keychain unavailable at verify time), the verification result must clearly say why it couldn't run, not silently report a false failure indistinguishable from a bad key.

4. **Deletion:** when a provider with a `keychainSecretRef` is deleted from the registry, also call `keychain.deleteSecret(ref)` so the credential doesn't outlive the registry entry — but a keychain deletion failure must not block the registry deletion itself (log/warn, don't fail the whole operation over an orphaned keychain entry — the registry is still the source of truth for what "exists").

## Read first

### Current code

- `docs/design/phase1-secrets-design.md` (full doc, especially Option 2 and the implementation plan)
- `packages/core/src/registry.ts` (full file)
- `packages/core/src/provider-test.ts` (full file)
- `packages/core/src/keychain.ts` (already merged — the exact API you're consuming)
- `packages/core/src/index.ts` (`registerProvider`/`updateProvider`/`deleteProvider` call sites)

### Tests

- Extend `packages/core/src/registry.test.ts` (or the appropriate existing test file — check what actually exists first) with: resolution returns plaintext unchanged when no `keychainSecretRef`; resolution calls the keychain when one is set (mock `keychain.ts`'s functions, do not hit the real OS keychain in this test — follow the pattern M050's own `keychain.test.ts` already established for gracefully handling keychain unavailability, but for THIS test you should mock the module entirely since you're testing the wiring logic, not the keychain itself); opt-in registration never writes the real key to the JSON structure (assert on the actual serialized object); a failed keychain write during opt-in registration fails cleanly with no plaintext fallback; deletion calls `deleteSecret` and tolerates its failure without failing the registry deletion.

## Allowed scope

- `packages/core/src/registry.ts`
- `packages/core/src/index.ts`
- `packages/core/src/provider-test.ts`
- `packages/core/src/registry.test.ts` (or the correct existing test file)

## Forbidden scope

- Any GUI (`.tsx`) file
- `packages/cli/src/gui-server.ts`
- `packages/core/src/keychain.ts` (already merged, consume only, do not modify its public interface)
- Migrating any existing plaintext key

## Exact requirements

1. Full backward compatibility: every existing plaintext-key provider works identically, zero opt-in required, zero behavior change.
2. A new provider CAN opt into keychain storage; when it does, the real key never lands in `registry.json`.
3. A failed keychain write during opt-in never silently falls back to plaintext.
4. Verification (`provider-test.ts`) works for both plaintext and keychain-backed providers.
5. Deletion cleans up the keychain entry, tolerating a keychain-deletion failure without blocking registry deletion.
6. Real test coverage for all of the above, with the OS keychain itself mocked (not hit for real) in these specific tests.

## Non-goals

- No migration of existing plaintext keys to the keychain.
- No GUI changes (a separate, later task).
- No CLI command changes.

## Implementation constraints

- Zero behavior change for existing callers/providers.
- Follow existing naming/error-handling conventions exactly.
- Prefer the smallest correct diff.
- No speculative abstractions beyond what's specified.

## Interface / contract

```ts
export async function resolveProviderApiKey(provider: RegistryProvider): Promise<string | null>
```
Exact opt-in registration signature — your call, but must not change the default (non-opt-in) behavior of any existing exported function used by current callers.

## Dependencies

- Upstream: M050 (already merged)
- Downstream: a future GUI task will add the opt-in toggle once this lands

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M056-wire-keychain-into-provider-registry
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` within allowed scope only
- Confirm via a real assertion that the serialized `registry.json` shape for an opt-in provider never contains the raw key string
- Confirm every existing provider-related test still passes unmodified (no weakened assertions)

## Expected evidence

- exact commands executed
- real test output (before/after counts)
- files changed
- the exact serialized JSON shape proof (no plaintext key) for the opt-in path
- limitations or failures

## Completion criteria

- zero behavior change for existing providers
- opt-in path never persists plaintext when the keychain is used
- failure paths never silently degrade to plaintext
- full core test suite green

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
