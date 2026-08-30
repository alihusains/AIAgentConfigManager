# M068 — Migrate existing plaintext provider keys into the OS keychain

## Identity

- Task ID: M068
- Parent workstream: Phase 1 (Secrets) exit criteria
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M068-migrate-plaintext-keys-to-keychain
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M068-migrate-plaintext-keys-to-keychain
- Type: feature
- Priority: P0
- Dependencies: none (M050/M056/M057 already shipped keychain support for NEW providers only)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M068-migrate-plaintext-keys-to-keychain`

Work ONLY within these repository paths:

- `packages/core/src/registry.ts`
- `packages/core/src/registry.test.ts`
- `packages/cli/src/gui-server.ts`
- `packages/gui/src/components/ProvidersView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/smoke.test.tsx`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

M050/M056/M057 added OS-keychain storage for NEW provider registrations only (opt-in checkbox). Providers registered BEFORE that work still have their API key sitting in plaintext in `registry.json` at `provider.config.apiKey`. This is the last remaining Phase 1 exit-criteria item: let the user move an EXISTING provider's key into the keychain, one provider at a time, explicit action only — never automatic/bulk/silent migration.

## Current state

Read `packages/core/src/registry.ts` in full, especially `storeProviderApiKeyInKeychain` (already exists, built for new-provider registration) and `resolveProviderApiKey`. Read `packages/core/src/keychain.ts` (`isKeychainAvailable`, `setSecret`). Read `packages/core/src/index.ts`'s `registerProvider` for the exact pattern already used when a NEW provider opts into keychain storage (keychain-first-then-registry-write ordering, error handling if the keychain write fails).

## Target state

A new core function in `registry.ts` (name and exact signature your call, follow the file's existing conventions):

```ts
export async function migrateProviderApiKeyToKeychain(
  registryPath: string,
  providerId: string
): Promise<{ keychainSecretRef: string } | { error: string }>
```

Behavior:
- Load the registry, find the provider entry by id.
- If it already has `keychainSecretRef`, return a clear "already migrated" error (no-op, not a crash).
- If `provider.config.apiKey` is empty/missing, return a clear "nothing to migrate" error.
- Otherwise: write the plaintext value into the keychain via the SAME primitive `storeProviderApiKeyInKeychain` already uses (reuse it directly if its signature allows, or extract the shared logic — do not duplicate the keychain-write code path), set `provider.config.apiKey = ''`, set `keychainSecretRef`, save the registry.
- If the keychain write itself fails (e.g. `isKeychainAvailable()` is false, or the native call throws), the registry must NOT be modified — the plaintext key stays in place and a clear error is returned. Never leave the user in a state where the key is gone from both places.

Add one HTTP route to `gui-server.ts` following existing provider-route conventions exactly: `POST /api/providers/:id/migrate-to-keychain`.

In `ProvidersView.tsx`: for any provider row that has a plaintext key (`config.apiKey` non-empty) and no `keychainSecretRef`, AND keychain is available on this machine, show a "Move to keychain" action (button, icon-button, or menu item — match the row's existing action affordances). Clicking it calls the new endpoint, shows a loading state, and on success updates the row to show the same lock-icon badge M057 already built for keychain-backed providers (reuse that exact badge/indicator, do not invent a new one). On failure, show the real error message from the server, never a generic fallback.

## Read first

### Current code

- `packages/core/src/registry.ts` (full file — `storeProviderApiKeyInKeychain`, `resolveProviderApiKey`, `saveRegistry`)
- `packages/core/src/keychain.ts` (`isKeychainAvailable`, `setSecret`)
- `packages/core/src/index.ts` (`registerProvider`'s keychain-opt-in path, for the established error-handling pattern)
- `packages/cli/src/gui-server.ts` (existing `/api/providers/*` routes, for the exact convention to follow)
- `packages/gui/src/components/ProvidersView.tsx` (M057's keychain checkbox + lock-icon badge, reuse the badge exactly)

### Tests

- `packages/core/src/registry.test.ts` — add: successful migration sets `keychainSecretRef` and empties `config.apiKey`; already-migrated returns a clear error and makes no changes; nothing-to-migrate (empty apiKey) returns a clear error; a simulated keychain-write failure leaves the registry completely unchanged (plaintext key still present).
- `packages/gui/src/smoke.test.tsx` — add: the "Move to keychain" action appears only for eligible providers; a successful migration updates the row to show the lock badge; a failure shows the real server error.

## Allowed scope

- `packages/core/src/registry.ts`
- `packages/core/src/registry.test.ts`
- `packages/cli/src/gui-server.ts`
- `packages/gui/src/components/ProvidersView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/src/keychain.ts` (consume its existing exports only)
- `packages/core/src/index.ts` (consume `resolveProviderApiKey`/`storeProviderApiKeyInKeychain` as-is; do not modify `registerProvider`'s own opt-in path)
- Any other component file

## Exact requirements

1. One-provider-at-a-time, explicit-click-only migration — never automatic, never bulk.
2. Reuses the existing keychain-write primitive, does not duplicate it.
3. Keychain-write failure leaves the registry byte-for-byte unchanged (no partial state).
4. Already-migrated and nothing-to-migrate cases both produce clear, honest errors, not crashes.
5. GUI reuses M057's existing lock-icon badge for the post-migration state, no new visual language invented.
6. Full core + cli + gui test suites green.

## Non-goals

- No bulk "migrate all" action in this task.
- No new provider-registration flow changes (M056/M057's opt-in path for NEW providers is untouched).
- No changes to how `resolveProviderApiKey` resolves at runtime (it already handles both cases).

## Implementation constraints

- Reuse existing primitives and UI patterns exactly.
- Smallest correct diff.
- No speculative abstractions (no generic "secret migration framework").

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M068-migrate-plaintext-keys-to-keychain
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter agentcontrol test
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Real end-to-end (isolated `AI_CONFIG_HOME`, do not touch the real one): register a provider with a plaintext key, confirm it's plaintext in `registry.json`, call the migrate action via the GUI or a direct curl, confirm the registry now shows `keychainSecretRef` and an empty `config.apiKey`, confirm the real OS keychain now holds the value (`security find-generic-password` on macOS or equivalent), confirm the provider still resolves and works normally afterward.

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- real end-to-end proof (before/after registry.json content, real keychain entry confirmed)
- limitations or failures

## Completion criteria

- migration works one-provider-at-a-time, reuses existing primitives, fails safe, full test suites green

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
