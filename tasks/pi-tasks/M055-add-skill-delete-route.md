# M055 — Add DELETE route for library skills (QA finding H1)

## Identity

- Task ID: M055
- Parent workstream: Bug-free hardening (QA pass follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M055-add-skill-delete-route
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M055-add-skill-delete-route
- Type: feature
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M055-add-skill-delete-route`

Work ONLY within these repository paths:

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts`
- `packages/cli/src/gui-server-skills.test.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/smoke.test.tsx`

Read `docs/audits/qa-pass.md` finding H1 in full, and read the current `SkillsView.tsx` and `skills.ts` fully (they have both changed substantially since the QA pass ran — M041/M044/M045 landed since) before writing any code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

`docs/audits/qa-pass.md` finding H1: there is no way to delete a skill from the shared library except by manually deleting the directory on disk. The GUI has "Remove from agent" (unassign) but no "Delete from library." This is a real, user-visible gap the founder would hit immediately after creating a test skill.

## Current state

Read `packages/core/src/skills.ts` in full — note it already has `assignSkillToAgent`, `removeSkillFromAgent`, `copySkillBetweenAgents`, `createSkill`, and (from M044) `getAllKnownSkills`. There is no `deleteSkillFromLibrary`-equivalent function. Read the current `SkillsView.tsx` (substantially reworked by M045) to understand its current card/row structure and where a "delete from library" action would naturally fit, matching its existing patterns (busy-key loading state, toast on success/error, confirmation before a destructive action — check if a confirmation pattern already exists elsewhere in this codebase, e.g. for provider/MCP delete, and reuse it rather than inventing a new one).

## Target state

1. **Core:** a new function, e.g. `removeSkillFromLibrary(skillId, opts)`, that deletes the skill's folder from the shared library directory (reuse `getSkillsLibraryDir()`, `assertSafeId`). If the skill is still assigned to one or more agents, decide the correct behavior and document it (recommended: allow deletion of the library copy while leaving already-assigned agent copies in place, since those are independent copies per this project's existing "registry stays source of truth, agent dirs are generated output" philosophy already documented in `skills.ts`'s file header — do not silently cascade-delete from every agent, that would be a different, riskier operation than what's being asked).
2. **HTTP:** `DELETE /api/skills/:id` (library-scoped) following the existing route conventions in `gui-server.ts` exactly.
3. **GUI:** a "Delete from library" action on each library-originated skill card/row in `SkillsView.tsx` (only for skills that actually exist in the library — an agent-only skill discovered via M044's aggregation has no library copy to delete this way), with a confirmation step before the destructive action, wired to the new endpoint via `api.ts`, refreshing the skill list on success and showing a clear error toast on failure.

## Read first

### Current code

- `docs/audits/qa-pass.md` (finding H1)
- `packages/core/src/skills.ts` (full file, current state after M030/M041/M044)
- `packages/gui/src/components/SkillsView.tsx` (full file, current state after M036/M045)
- `packages/cli/src/gui-server.ts` (existing skills routes, and the existing DELETE conventions used for providers/MCP servers)
- `packages/gui/src/api.ts` (existing skills client functions)

### Tests

- `packages/core/src/skills.test.ts` — new tests for `removeSkillFromLibrary`.
- `packages/cli/src/gui-server-skills.test.ts` — new test for the DELETE route.
- `packages/gui/src/smoke.test.tsx` — new assertion for the delete action + confirmation flow.

## Allowed scope

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts`
- `packages/cli/src/gui-server-skills.test.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/src/env-vars.ts`, `packages/core/src/keychain.ts` — unrelated, possibly concurrent work
- Any other component file

## Exact requirements

1. A skill can be deleted from the shared library via the GUI, with confirmation, without needing filesystem access.
2. The operation does not silently cascade-delete from agents that already have their own copy.
3. Real regression tests at all 3 layers (core/cli/gui).
4. Full test suites green.

## Non-goals

- No cascading delete from all agents (a much bigger, different operation than what's asked).
- No bulk-delete UI.

## Implementation constraints

- Follow existing naming/error-handling/confirmation-UX conventions exactly.
- Smallest correct diff.
- No speculative abstractions.

## Interface / contract

`DELETE /api/skills/:id` — library-scoped only, following existing route/response-envelope conventions.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M055-add-skill-delete-route
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Also verify:

- `git status --short` within allowed scope only
- Real end-to-end: create a throwaway skill via the API, delete it via the new route/GUI action, confirm it's gone from disk and from the library listing, confirm an agent that had it assigned still has its own copy untouched

## Expected evidence

- exact commands executed
- real test output
- files changed
- real end-to-end proof
- limitations or failures

## Completion criteria

- H1 resolved with real evidence at all 3 layers
- no unwanted cascading behavior
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
