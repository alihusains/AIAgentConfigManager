# M046 — Fix stale in-memory registry + undeletable percent-encoded agent IDs (QA finding C1)

## Identity

- Task ID: M046
- Parent workstream: Bug-free hardening (QA pass follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M046-fix-registry-desync-percent-encoding
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M046-fix-registry-desync-percent-encoding
- Type: bug
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M046-fix-registry-desync-percent-encoding`

Work ONLY within these repository paths:

- `packages/cli/src/gui-server.ts`
- `packages/core/src/index.ts`
- `packages/cli/src/gui-server-delete.test.ts` (or a new sibling test file if cleaner — your call)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not touch `packages/core/src/skills.ts` (a different fix, M044, lives there, may be running concurrently in a different worktree — do not touch it here).

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

`docs/audits/qa-pass.md` finding C1 (Critical): creating a custom agent with an id containing special characters (e.g. `../evil`, or any id with `/`) makes it **permanently undeletable via the API** — `gui-server.ts` passes the raw (still percent-encoded) URL segment to `manager.removeCustomAgent()` without calling `decodeURIComponent`, while the core's lookup compares against the DECODED id stored in memory, so the two never match. The finding also documents a related data-integrity issue: the server's in-memory registry can desync from disk and there is no recovery path short of restarting the process.

## Current state

Read the C1 finding in `docs/audits/qa-pass.md` in full (exact repro steps included) before touching any code. Read `packages/cli/src/gui-server.ts` around the custom-agent DELETE route (search for `removeCustomAgent`) and confirm exactly where the raw `parts[3]` (or equivalent path segment) is used without decoding — do not assume the QA report's line numbers are still accurate after other merges, re-locate the real code.

Read `packages/core/src/index.ts`'s `removeCustomAgent` (or equivalent) and `addCustomAgent` to understand the current id-matching logic and where a decode step needs to be added or is missing.

## Target state

1. Decode every path segment that represents a resource id in `gui-server.ts` (`decodeURIComponent`) before passing it to any core manager method, matching the pattern already used correctly elsewhere in the same file for other routes (grep for existing `decodeURIComponent` usage in this file and follow that convention).
2. Validate custom agent IDs at CREATION time (in `addCustomAgent`) to reject ids containing `/`, `\`, or other path-traversal-style characters, so this class of unreconcilable id can't be created in the first place — mirror the existing `assertSafeId`-style validation pattern already used in `packages/core/src/skills.ts` if applicable, or add an equivalent guard here (do not import from `skills.ts` if that creates an awkward cross-module dependency — a small local validation function is fine, keep it consistent in spirit).
3. Add a regression test reproducing the QA report's exact repro (create with `../evil`, attempt percent-encoded delete, confirm it succeeds after the fix — or confirm creation itself is now rejected, whichever fix layer you land on, but the end state must be: no agent id can become permanently stuck).

## Read first

### Current code

- `docs/audits/qa-pass.md` (finding C1, full repro and root-cause analysis)
- `packages/cli/src/gui-server.ts` (the custom-agent routes, and existing correct `decodeURIComponent` usage elsewhere in the file as a convention reference)
- `packages/core/src/index.ts` (`addCustomAgent`, `removeCustomAgent`, and however the in-memory registry vs disk relationship works)

### Reference / specification

- `docs/audits/qa-pass.md` finding C1

### Tests

- `packages/cli/src/gui-server-delete.test.ts` — add the regression test here (it already covers delete-cascade regressions in this exact style) or a clearly-named sibling file.

## Allowed scope

- `packages/cli/src/gui-server.ts`
- `packages/core/src/index.ts`
- `packages/cli/src/gui-server-delete.test.ts` (or a new sibling test file)

## Forbidden scope

- `packages/core/src/skills.ts`
- Any GUI (`.tsx`) file
- Any adapter file

## Exact requirements

1. Percent-encoded / special-character agent ids can be created AND deleted without becoming stuck (pick creation-time rejection, decode-before-lookup, or both — document your choice and why).
2. A real regression test reproduces the QA report's exact case and passes.
3. Full cli + core test suites still green.

## Non-goals

- No general registry-vs-disk reconciliation/file-watch mechanism (the QA report's "suggested fix #2" is bigger scope — out of scope here, note it as a recommendation in FOLLOW_UP if relevant).
- No change to provider/MCP delete-cascade logic (already fixed, different bug).

## Implementation constraints

- Preserve existing public APIs/behavior for well-formed ids.
- Follow existing naming/error-handling conventions in both files exactly.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

`addCustomAgent`/`removeCustomAgent` signatures unchanged; only validation/decoding behavior changes.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M046-fix-registry-desync-percent-encoding
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/cli test
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` within allowed scope only
- Reproduce the QA report's exact `curl` repro against a real running server (isolated `AI_CONFIG_HOME`) and confirm the fixed behavior end to end

## Expected evidence

- exact commands executed
- real test output
- files changed
- real end-to-end curl repro showing the fix works
- limitations or failures

## Completion criteria

- QA finding C1 fully resolved with real regression test and real repro evidence
- scope respected
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
