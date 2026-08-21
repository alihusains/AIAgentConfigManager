# M001 — Edit Provider: "Use all N models" quick-fill

## Identity

- Task ID: M001
- Parent workstream: community-issues-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: de8e80369378f20dcb75cbe5798fc7ed5476bf8e
- Branch: pi/M001-edit-provider-quickfill
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M001-edit-provider-quickfill
- Type: feature
- Priority: P2
- Dependencies: none (M004 depends on this — do not start M004 until this is merged)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M001-edit-provider-quickfill`

Work ONLY within these repository paths:

- `packages/gui/src/components/ProvidersView.tsx`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies unless explicitly authorized.

Do not redesign the architecture.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

In `AddProviderModal` (same file), a successful `ApiVerifier` probe shows a
"Use all N models" button that auto-fills the model list textarea via the
`onModels` callback (see `onModels={(ids) => set({ modelNames: ids.join(', ') })}`
around line 392, and the textarea bound to `form.modelNames` around line 432).

`EditProviderModal` also renders `<ApiVerifier mode="probe" ... onVerified={setVerified} />`
(around line 574) but does not pass an `onModels` callback, and — importantly —
`EditProviderModal`'s local `form` state has no `modelNames` field at all today.
So there is currently no way to add/quick-fill models while editing an existing
provider from this modal.

## Current state

- `AddProviderModal` (`ProvidersView.tsx` ~lines 238-488): has `modelNames` in its
  form state, a textarea bound to it, and passes `onModels` to `ApiVerifier` to
  auto-fill that textarea after verification.
- `EditProviderModal` (`ProvidersView.tsx` ~lines 489-627): form state is
  `{ name, apiKey, baseUrl, region, project, enabled }` — no `modelNames` field,
  no models textarea, and `ApiVerifier` is called without `onModels`.
- `updateProvider(id, providerPatch, apiCapabilities?)` (from `useStore`, see
  `packages/gui/src/store/index.ts`) only patches the `ModelProvider` record and
  optional `apiCapabilities` — it does not currently take a models list argument.
  Check the store's `updateProvider` signature and the `api.ts` client call it
  wraps to confirm whether models can be updated through it, or whether a
  separate store action (e.g. one used for adding models to an existing provider)
  must be reused instead. If updating a provider's registered models requires a
  different store action, use that existing action — do not invent a new API
  endpoint.

## Target state

`EditProviderModal` has a models field (textarea, comma-separated ids, matching
`AddProviderModal`'s existing UX) pre-filled with the provider's current
registered model ids. After a successful verification in this modal, a
"Use all N models" button (or equivalent affordance identical in behavior to
the one in `AddProviderModal`) appears and, when clicked, fills that field with
the verified model ids (via `onModels` on `ApiVerifier`). Saving the modal
persists the resulting model list using whatever existing store mechanism
already handles model updates for a provider — do not add a new API route.

## Read first

### Current code

- `packages/gui/src/components/ProvidersView.tsx` (full file — `AddProviderModal`
  for the reference pattern, `EditProviderModal` for the target, and the
  imports/props shared between them)
- `packages/gui/src/components/ProviderVerify.tsx` (`ApiVerifier`'s `onModels`
  prop and `onVerified` prop — confirm exact prop names/types, do not guess)
- `packages/gui/src/store/index.ts` (`updateProvider` signature, and any other
  action that updates a provider's `models` array — e.g. whatever action
  `AddProviderModal`'s submit handler uses to create models for a new provider)

### Reference / specification

- `docs/community-issues.md` item **#1** ("Edit Provider: 'Use all N models'
  quick-fill")

## Allowed scope

- `packages/gui/src/components/ProvidersView.tsx`

## Forbidden scope

- `packages/gui/src/components/ProviderVerify.tsx` (read-only — reuse its
  existing `onModels`/`onVerified` props as-is; do not change its interface)
- `packages/gui/src/store/index.ts` (read-only — reuse whatever action already
  exists; if no existing action can persist an edited model list, report
  BLOCKED with the gap instead of adding a new store action or API route)
- any other file
- unrelated refactors
- dependency upgrades
- architecture changes
- formatting-only changes outside touched code

## Exact requirements

1. Add a models field to `EditProviderModal`'s local form state, pre-filled from
   the provider's currently registered models (same comma-separated-ids
   textarea UX as `AddProviderModal`).
2. Pass an `onModels` callback to the `ApiVerifier` used in `EditProviderModal`
   that writes the verified model ids into that field — matching
   `AddProviderModal`'s existing behavior exactly (including the visible
   "Use all N models" button/affordance sourced from `ApiVerifier` itself, not
   a hand-rolled duplicate).
3. On submit, persist the resulting model list using an existing store
   mechanism (reuse, do not invent). If none exists, stop and report BLOCKED
   with exactly what's missing — do not add a new API endpoint to work around it.
4. Only `openai-compatible`-type providers show the verifier today (see the
   `provider.type === 'openai-compatible'` guard in `EditProviderModal`) — keep
   that same conditional guard for the new field/button; do not show it for
   provider types that don't support probing.

## Non-goals

- Changing `AddProviderModal`'s behavior.
- Changing `ApiVerifier`/`ProviderVerify.tsx`.
- Changing how models are displayed in the providers table or details modal.
- Adding a new backend endpoint for model updates.

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow existing naming and module conventions (`form`/`set` pattern already
  used in both modals).
- Follow existing error handling.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.
- Do not change unrelated behavior.

## Interface / contract

- `ApiVerifier`'s `onModels?: (modelIds: string[]) => void` and
  `onVerified` props are the existing contract — call them, do not redefine them.
- Whatever store action ends up persisting the model list must be called with
  the same shape/types it already expects elsewhere in this file.

## Dependencies

- Upstream: none
- Downstream: M004 (verification-age tooltip in the same file) — must not start
  until this task's branch is merged to `main`, to avoid a same-file conflict.

## Verification

Run:

```bash
pnpm --filter @ai-agent-config/gui typecheck
pnpm --filter @ai-agent-config/gui build
```

Also verify:

- `git status --short`
- changed files are within allowed scope (only `ProvidersView.tsx`)
- manually reason through / describe the exact runtime behavior: open Edit
  Provider on an `openai-compatible` provider, verify, click "Use all N
  models", confirm the field fills, confirm Save persists it (there is no
  existing GUI test harness in this package — static/typecheck verification
  plus a clear code-level walkthrough in the report is acceptable; do not
  invent a test framework).

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
