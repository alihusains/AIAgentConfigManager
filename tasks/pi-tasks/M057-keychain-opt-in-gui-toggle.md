# M057 — GUI: opt-in toggle for storing a new provider's API key in the OS keychain

## Identity

- Task ID: M057
- Parent workstream: Phase 1 (Secrets) — productroadmap.md
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M057-keychain-opt-in-gui-toggle
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M057-keychain-opt-in-gui-toggle
- Type: feature
- Priority: P0
- Dependencies: none (M056 is already merged to main)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M057-keychain-opt-in-gui-toggle`

Work ONLY within these repository paths:

- `packages/cli/src/gui-server.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/ProvidersView.tsx`
- `packages/gui/src/smoke.test.tsx`

Read every file listed in "Read first" before writing code — especially M056's actual merged diff and final report for the exact core API you're wiring.

Do not touch `packages/core/**` — M056 already built and tested the core layer; this task only exposes it.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

M056 (merged) built the core-layer ability for a NEW provider to store its API key in the OS keychain instead of plaintext in `registry.json`, with `registerProvider(..., keychainStorage?: boolean)`. This task exposes that as an actual opt-in toggle in the "Add Provider" flow, and shows a clear "stored in OS keychain" indicator on providers that used it — the first user-visible piece of Phase 1 (Secrets).

## Current state

Read M056's merged commit and final report for the exact `registerProvider` signature and behavior (opt-in only, existing providers unaffected, a keychain-storage failure fails cleanly with a clear error — no silent plaintext fallback). Read `packages/gui/src/components/ProvidersView.tsx`'s current `AddProviderModal` in full to find where the API key field is entered.

## Target state

- In `AddProviderModal`, add a "Store in OS keychain" checkbox/toggle next to the API key field (default OFF, matching M056's default-unchanged behavior — this must be an explicit, informed choice, not a silent default).
- If checked, first call a new `isKeychainAvailable`-exposing check (add a route if one doesn't exist yet — check `gui-server.ts` first) BEFORE submitting, so the user gets immediate feedback if the keychain isn't usable in this environment rather than a failed submission with a confusing error.
- Wire the toggle through to the create-provider API call so `keychainStorage: true` reaches `registerProvider`.
- If the keychain write fails server-side (the clean-error path M056 built), surface the REAL error message to the user (e.g. via a toast), never a generic "something went wrong."
- On the Providers table/list, a provider that used keychain storage shows a small, clear indicator (e.g. a lock icon with a tooltip "API key stored in OS keychain") — reuse existing badge/icon patterns from this codebase, do not invent a new visual language for this one indicator.
- Styled entirely with v2 tokens, both themes, consistent with the rest of the app.

## Read first

### Current code

- M056's merged commit (`git log`/`git show` on the merge commit) and its final report — the exact core API
- `packages/cli/src/gui-server.ts` (the existing provider-creation route, to extend with the `keychainStorage` flag pass-through, and whatever `isKeychainAvailable` exposure already exists or needs adding)
- `packages/gui/src/components/ProvidersView.tsx` (the full `AddProviderModal` and the providers table row rendering)
- `packages/gui/src/api.ts` (existing provider-creation client function)

### Reference / specification

- `docs/design/phase1-secrets-design.md`
- `docs/epics/agentic-control-plane-redesign-v2.md`

### Tests

- `packages/gui/src/smoke.test.tsx` — add assertions: toggle renders and defaults off; submitting with it on passes `keychainStorage: true`; a keychain-unavailable state disables/warns before submit; a provider with keychain storage shows the lock indicator; a server-side keychain failure shows the real error message, not a generic one.

## Allowed scope

- `packages/cli/src/gui-server.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/ProvidersView.tsx`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/**`
- Any other GUI component file

## Exact requirements

1. Opt-in toggle, default off, in the Add Provider flow.
2. Pre-submit keychain-availability check with clear feedback.
3. Real error surfacing on a server-side keychain failure — never a generic message.
4. A clear, reused-pattern indicator on providers using keychain storage.
5. Full gui test suite green, with real new coverage for this feature.

## Non-goals

- No migration UI for existing plaintext providers (a separate, later task).
- No "reveal stored key" UI (out of scope here — this task is about opt-in creation and indication only).

## Implementation constraints

- Preserve existing `AddProviderModal`/`ProvidersView` behavior for non-opt-in providers exactly.
- Follow existing naming/class/component conventions.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

Consumes M056's `registerProvider(..., keychainStorage?: boolean)` exactly as documented in its final report.

## Dependencies

- Upstream: M056 (merged)
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M057-keychain-opt-in-gui-toggle
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
pnpm --filter @ai-agent-config/cli test
```

Also verify:

- `git status --short` within allowed scope only
- Real end-to-end: start the GUI against an isolated `AI_CONFIG_HOME`, add a provider WITH the toggle on, confirm the registry.json shows no plaintext key and the provider row shows the keychain indicator; add another WITHOUT the toggle, confirm it behaves exactly as before

## Expected evidence

- exact commands executed
- real test output
- files changed
- real end-to-end proof (both with and without the toggle)
- limitations or failures

## Completion criteria

- toggle implemented, defaults off, pre-submit availability check works
- real error surfacing on failure
- clear indicator on keychain-backed providers
- full gui + cli test suites green

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
