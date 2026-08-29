# M052 — Fix response-envelope/status-code QA findings (H2, H3, M1, M2, M3, M4)

## Identity

- Task ID: M052
- Parent workstream: Bug-free hardening (QA pass follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M052-fix-response-envelope-findings
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M052-fix-response-envelope-findings
- Type: bug
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M052-fix-response-envelope-findings`

Work ONLY within these repository paths:

- `packages/cli/src/gui-server.ts`
- `packages/core/src/index.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/SettingsView.tsx`
- Existing cli/core test files as appropriate (do not create sprawling new files; extend existing ones matching their conventions)

Read `docs/audits/qa-pass.md` findings H2, H3, M1, M2, M3, M4 in full before writing any code — each has an exact repro; verify each still reproduces against current `main` before fixing (the codebase has moved since the QA pass ran).

Do not touch `packages/core/src/skills.ts`, `packages/core/src/env-vars.ts`, or `packages/core/src/keychain.ts` — unrelated, possibly concurrent work.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If a finding no longer reproduces (already fixed by other merged work), say so explicitly and skip it rather than inventing a fix for a non-existent bug.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

`docs/audits/qa-pass.md` (a full QA pass against the running dashboard) found 4 High and 2 Medium findings, all in the same request/response-handling layer, that have not yet been fixed:

- **H2:** Client validation errors (missing name, duplicate skill, invalid agent id) return HTTP 500 instead of 400/409.
- **H3:** `POST /api/providers/verify` returns top-level `ok: true` even when the actual verification checks (`models.ok`, `chat.ok`) both failed — ambiguous API contract.
- **M1:** `POST /api/agents/custom` with a missing `name` field crashes with an unhandled `TypeError` instead of a clean validation error.
- **M2:** The GUI's "Export Registry" button is purely client-side (serializes whatever is currently in memory) — there is no server-side `GET /api/registry/export` endpoint, so a stale GUI state exports stale data.
- **M3:** Agent install/uninstall jobs run with no timeout (only the tool-update job has one), so a hung install consumes a child-process slot indefinitely.
- **M4:** `PUT /api/agents/custom/:id` with an empty body `{}` returns `200 ok: true` with no indication nothing was actually changed.

## Target state

1. **H2:** The `handle()` wrapper (or wherever the response status is decided) in `gui-server.ts` should map a thrown `Error` from a validation-style failure to `400` (or `409` for a duplicate-resource case) instead of defaulting to `500`. Read the current `handle()` implementation and existing error paths carefully — do this in the way that's least invasive to already-correct 500s for genuine server errors (a crash is still a 500; "you gave me bad input" is a 400). If core methods already return an `OperationResult`-style shape with room for a status hint, prefer wiring that through rather than string-matching error messages.
2. **H3:** Either rename the top-level `ok` in the verify response to something unambiguous (e.g. `completed`) or make it reflect real reachability (`models.ok || chat.ok`) — pick whichever is the smaller, less-breaking change given how `packages/gui/src/components/ProviderVerify.tsx` already consumes this response (read that file first; do not break its existing correct per-check handling).
3. **M1:** Add an explicit guard in `addCustomAgent` (`core/index.ts`) rejecting a missing/empty `name`/`id` with a clean `{ success: false, error: '...' }` before any `.trim()` call reaches an `undefined`.
4. **M2:** Add a real `GET /api/registry/export` route returning the full registry JSON from the server's authoritative state (not the GUI's in-memory copy), and wire `SettingsView.tsx`'s export button to use it instead of (or in addition to, as a fallback) the current client-side serialization — read the current export code path fully first.
5. **M3:** Add a reasonable default timeout (e.g. 5 minutes) to `startAgentJob` calls for install/uninstall that currently have none, matching the pattern already used for the tool-update job.
6. **M4:** `PUT /api/agents/custom/:id` with an empty body should return a clear indication that no field was actually changed (e.g. a `changed: false` field in the response, or a 400 if you judge that's more correct — your call, document the reasoning) rather than a bare `200 ok: true` indistinguishable from a real update.

## Read first

### Current code

- `docs/audits/qa-pass.md` (findings H2, H3, M1, M2, M3, M4 — full text, exact repros)
- `packages/cli/src/gui-server.ts` (the `handle()` wrapper, the verify route, the custom-agent routes, `startAgentJob` usage)
- `packages/core/src/index.ts` (`addCustomAgent`)
- `packages/gui/src/components/ProviderVerify.tsx` (how `ok`/`models.ok`/`chat.ok` are currently consumed — do not break this)
- `packages/gui/src/components/SettingsView.tsx` (current export button implementation)

### Tests

- Extend the existing test files (`gui-server.test.ts`, `gui-server-delete.test.ts`, or a clearly-named sibling) with regression tests for each finding you fix, using the QA report's exact repro as the test case.

## Allowed scope

- `packages/cli/src/gui-server.ts`
- `packages/core/src/index.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/SettingsView.tsx`
- Existing cli/core test files (extend, don't sprawl new ones unless genuinely cleaner)

## Forbidden scope

- `packages/core/src/skills.ts`, `packages/core/src/env-vars.ts`, `packages/core/src/keychain.ts`
- Any other GUI component
- Any adapter file

## Exact requirements

1. Each of H2, H3, M1, M2, M3, M4 is either fixed with a real regression test, or confirmed already resolved (state which and why).
2. `ProviderVerify.tsx`'s existing correct per-check handling is not broken.
3. Full cli + core + gui test suites still green.

## Non-goals

- No changes to H4/H5 (separate tasks) or the low-severity findings.
- No broader response-envelope redesign beyond what's needed for these 6 findings.

## Implementation constraints

- Smallest correct diff per finding.
- Follow existing naming/error-handling conventions exactly.
- No speculative abstractions.

## Interface / contract

Existing successful-request response shapes must not change for any already-correct 200 response — only the error/edge-case paths listed above.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M052-fix-response-envelope-findings
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/cli test
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Re-run each of the 6 QA report's exact `curl` repro steps against a real running server (isolated `AI_CONFIG_HOME`) confirming the fixed behavior

## Expected evidence

- exact commands executed
- real test output
- files changed
- real curl-based before/after for each of the 6 findings
- limitations or failures

## Completion criteria

- all 6 findings resolved or explicitly confirmed already-fixed
- ProviderVerify.tsx behavior unbroken
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
