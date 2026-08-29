# M053 — Fix MCP server deletion not cleaning up agent config files (QA finding H4)

## Identity

- Task ID: M053
- Parent workstream: Bug-free hardening (QA pass follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M053-fix-mcp-delete-cleanup
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M053-fix-mcp-delete-cleanup
- Type: bug
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M053-fix-mcp-delete-cleanup`

Work ONLY within these repository paths:

- `packages/core/src/index.ts`
- `packages/core/src/registry-delete-cascade.test.ts` (or a new sibling test file if cleaner)

Read `docs/audits/qa-pass.md` finding H4 in full, and re-verify the exact repro against current `main` before fixing, since the codebase has moved since the QA pass ran.

Do not touch `packages/cli/src/gui-server.ts`, `packages/core/src/skills.ts`, `packages/core/src/env-vars.ts`, `packages/core/src/keychain.ts` — unrelated, possibly concurrent work.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

`docs/audits/qa-pass.md` finding H4: after `DELETE /api/mcp/:name` returns `200 ok: true`, the server entry can remain in an agent's real config file (e.g. `~/.claude/settings.json`'s `mcpServers`). The registry itself is updated correctly; the materialization step that should remove the server from each agent's file does not always complete. The server reports success based on the registry update, not on confirmed file cleanup — the same class of "the UI says success but the write didn't happen" bug this project has hit and fixed twice before (provider delete cascade, Codex rename).

## Current state

Read the H4 finding in `docs/audits/qa-pass.md` in full (exact repro). Read `deleteMCPServer` (or equivalently-named method) in `packages/core/src/index.ts` and trace exactly how it calls into per-agent removal/materialization — find the actual point where an agent's file write can silently fail to remove the entry. This may be an adapter-specific materialization bug (e.g. `claude-code`'s adapter not correctly filtering `mcpServers` on removal) rather than a bug in `deleteMCPServer` itself — trace all the way down before assuming which layer is wrong.

## Target state

- `deleteMCPServer` (or equivalent) must not report success unless the removal from every affected agent's file is verified (read the file back after write, or use whatever verification pattern the provider-delete-cascade fix already established — `packages/core/src/registry-delete-cascade.test.ts` documents that exact prior fix, follow its pattern).
- If a per-agent file write genuinely cannot be verified as removed (e.g. the agent's config format can't be parsed, or the file is locked), the response must carry an explicit warning (matching the existing `warnings` field pattern already used elsewhere in this codebase, e.g. in provider delete) rather than a bare `ok: true`.
- Add a regression test reproducing the QA report's exact repro (create an MCP server, install on `claude-code`, delete it, confirm both the registry AND the real `claude-code` config file no longer reference it) — use a temp/mocked agent config file for the test, never a real dotfile.

## Read first

### Current code

- `docs/audits/qa-pass.md` (finding H4)
- `packages/core/src/index.ts` (`deleteMCPServer`/`removeMCPServerFromAgent` and however materialization is invoked)
- `packages/core/src/registry-delete-cascade.test.ts` (the existing, already-fixed provider-delete-cascade pattern — follow its structure and testing conventions)
- The relevant agent adapter(s) implicated by the QA repro (it used `claude-code`) — trace whether the bug is in the adapter's MCP-removal logic specifically

### Tests

- Extend `registry-delete-cascade.test.ts` (or a clearly-named sibling) with the MCP-delete-cleanup regression test.

## Allowed scope

- `packages/core/src/index.ts`
- `packages/core/src/registry-delete-cascade.test.ts` (or a new sibling test file)
- The specific adapter file implicated by your root-cause trace, IF the bug is genuinely there (name it in your report; if you need to touch an adapter, that's expected and fine — just stay narrowly scoped to the actual bug)

## Forbidden scope

- `packages/cli/src/gui-server.ts`
- `packages/core/src/skills.ts`, `packages/core/src/env-vars.ts`, `packages/core/src/keychain.ts`
- Any GUI file
- Any adapter other than the one your trace implicates

## Exact requirements

1. Root-cause the exact point where MCP server removal from an agent's file can silently fail.
2. Fix it so deletion either verifiably succeeds or reports an explicit warning — never a false success.
3. Real regression test reproducing the QA report's case.
4. Full core test suite still green.

## Non-goals

- No change to provider or skill deletion (already correct, separate bugs, already fixed).
- No general file-watch/reconciliation mechanism.

## Implementation constraints

- Follow the exact verification pattern already established for provider delete.
- Smallest correct diff.
- No speculative abstractions.

## Interface / contract

`deleteMCPServer`'s return shape may gain a `warnings` field if it doesn't already have one — follow the existing pattern from provider delete exactly, do not invent a new shape.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M053-fix-mcp-delete-cleanup
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` within allowed scope only
- Real repro against a temp-config-home running server confirming the fix, matching the QA report's exact steps

## Expected evidence

- exact commands executed
- real test output
- files changed
- real before/after repro evidence
- limitations or failures

## Completion criteria

- root cause found and fixed with verification, not a guess
- regression test passes
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
