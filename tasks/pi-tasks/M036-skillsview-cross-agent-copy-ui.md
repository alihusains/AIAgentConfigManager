# M036 — SkillsView UI: copy a skill from one agent to another

## Identity

- Task ID: M036
- Parent workstream: Skill management improvements
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch time — branch from main AFTER M030 is merged>
- Branch: pi/M036-skillsview-cross-agent-copy-ui
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M036-skillsview-cross-agent-copy-ui
- Type: feature
- Priority: P1
- Dependencies: M030 (core `copySkillBetweenAgents` + `POST /api/skills/:skillId/copy` route) must be merged first. If M029 (design tokens v2) has also merged by the time this dispatches, use its tokens for any new UI you add; if not yet merged, use the existing token names already in the file (do not block on M029 — this task's core requirement is functional wiring, not restyling).

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M036-skillsview-cross-agent-copy-ui`

Work ONLY within these repository paths:

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/api.ts` (add one client function only)
- `packages/gui/src/index.css` (only if a new class is genuinely needed; prefer reusing existing `.badge`, `.btn-*` classes already used elsewhere in this file)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not implement or reference symlinks — the backend (M030) is copy-based; this is a pure UI-wiring task.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder asked to "improve the Skill management functionality, where I can copy a skill from one agent to another agent (attach one skill from one agent to another agent, check first if the agent supports skills or not...)." M030 (already merged before this task dispatches) added the backend capability: `copySkillBetweenAgents(skillId, sourceAgentId, targetAgentId)` in `packages/core/src/skills.ts` and the `POST /api/skills/:skillId/copy` route in `packages/cli/src/gui-server.ts`. This task wires that capability into the existing `SkillsView` UI, extending the existing assign/unassign UI rather than building a new page (founder's explicit choice: "Extend existing Skills view").

## Current state

Read `packages/gui/src/components/SkillsView.tsx` in full (442 lines) before changing anything. It already has:
- A `SkillCard` component per skill, showing assigned agents as removable badge-chips (`badge-success badge-chip`) and unassigned agents as ghost buttons to assign (`Assign to:` row).
- `busyKey(skillId, agentId, action)` — a string key identifying which button shows a loading spinner, for `'assign' | 'unassign'` actions. You will extend this union type to add a `'copy'` action variant (or design your own equivalent — keep it consistent with the existing pattern, do not introduce a second unrelated busy-state mechanism).
- `handleAssign`/`handleUnassign` handlers in the main `SkillsView` component that call `api.assignSkill`/`api.unassignSkill`, update `snapshot` state from the response, and show a toast via `addToast` from the store.
- `packages/gui/src/api.ts` already has `assignSkill(skillId, agentId)` and `unassignSkill(skillId, agentId)` client functions (lines ~218–224) — follow their exact pattern (request shape, `encodeURIComponent`, response type) for your new function.

Only 4 catalog agents are ever skill-capable today (`chatgpt`/codex, `claude-code`, `opencode`, `aion-cli` — confirmed via `packages/core/src/agent-catalog.json`), so `snapshot.agents` in this view already only ever contains skill-capable agents — the "check first if the agent supports skills" requirement is already satisfied structurally by this existing snapshot design; you do not need to add a separate capability check in the UI beyond selecting from `snapshot.agents`.

## Target state

- Add `copySkillToAgent(skillId, sourceAgentId, targetAgentId)` to `packages/gui/src/api.ts`, calling `POST /api/skills/${encodeURIComponent(skillId)}/copy` with body `{ sourceAgentId, targetAgentId }`, matching the existing `assignSkill`/`unassignSkill` function shape and return-type convention exactly.
- In `SkillCard`, for each agent already shown as assigned (in the badge-chip row), add a small affordance (e.g. a `Link2`/copy icon button next to or inside the existing badge-chip, or a compact dropdown/menu — your call, keep it visually minimal and consistent with the existing chip density) that lets the user pick one of the OTHER currently-assigned-elsewhere-or-unassigned agents from `snapshot.agents` as the copy target, then calls the new API function.
  - The target agent list offered must exclude the source agent itself (no self-copy) and should reasonably prioritize showing agents that do NOT already have the skill (copying to an agent that already has it should still be allowed — it's a safe idempotent overwrite per M030's `assignSkillToAgent`-style copy semantics — but don't make that the default suggestion).
  - Reuse `AgentIconTile` for agent identity in whatever picker UI you build, consistent with the rest of this file.
- Wire loading state through the existing `busy`/`busyKey` mechanism (extend it for the copy action) so the button shows a spinner and other actions are disabled while a copy is in flight, exactly like assign/unassign already behave.
- On success: refresh `snapshot` from the response or via a re-fetch (follow whichever pattern `handleAssign` already uses) and show a success toast via `addToast`, e.g. `Copied "<skill name>" to <target agent name>`.
- On error: show an error toast with the real error message from the API response — do not swallow it, do not show a generic message when a specific one is available (follow the existing `handleAssign`/`handleUnassign` error-toast pattern exactly).

## Read first

### Current code

- `packages/gui/src/components/SkillsView.tsx` (full file, 442 lines)
- `packages/gui/src/api.ts` (full `assignSkill`/`unassignSkill`/`getSkills` section, lines ~205–230)
- `packages/core/src/skills.ts` (read the `copySkillBetweenAgents` function M030 added, and its exact error messages, so your UI can surface them meaningfully)
- `packages/cli/src/gui-server.ts` (read the `POST /api/skills/:skillId/copy` route M030 added — confirm exact request/response envelope)

### Reference / specification

- `tasks/pi-tasks/M030-skill-cross-agent-copy.md` (the backend task spec this UI wires into)

### Tests

- `packages/gui/src/smoke.test.tsx` — check for existing SkillsView assertions; keep them passing. Add a new smoke assertion covering the copy affordance rendering (does not need to test the full network round-trip if the existing smoke tests mock at the same level as the assign/unassign tests already do — match their existing test style).

## Allowed scope

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/index.css` (only if a new class is genuinely needed)
- `packages/gui/src/smoke.test.tsx` (adding one new assertion, or updating a selector if structure changed)

## Forbidden scope

- `packages/core/src/skills.ts`, `packages/cli/src/gui-server.ts` (M030's territory — already merged, do not modify)
- Any other component file
- Any new backend endpoint (use exactly the one M030 added)

## Exact requirements

1. Add `copySkillToAgent` to `api.ts` matching existing skills-API conventions.
2. Add a source-agent → target-agent copy affordance inside `SkillCard`, excluding self-copy, using `snapshot.agents` (already pre-filtered to skill-capable agents) as the eligible target list.
3. Wire loading state via the existing `busy`/`busyKey` mechanism.
4. Show success/error toasts using the exact real API response message on error, following the existing `handleAssign`/`handleUnassign` pattern.
5. Refresh the skills snapshot after a successful copy so the UI reflects the new assignment immediately.

## Non-goals

- No symlink UI or explanation needed — the copy semantics are already handled by the backend; this UI does not need to expose "copy vs symlink" as a choice.
- No new page/route/modal-heavyweight flow — extend the existing card UI per the founder's explicit choice.
- No change to the create-skill or remove-skill flows.

## Implementation constraints

- Preserve public component exports (`SkillsView`).
- Follow existing naming/class conventions and the existing `busy`/toast patterns exactly — do not introduce a second state-management approach for loading/errors.
- Prefer the smallest correct diff.
- No speculative abstractions (e.g. a generic multi-target bulk-copy feature) — this is one skill, one source agent, one target agent at a time, per the founder's request.

## Interface / contract

```ts
copySkillToAgent(skillId: string, sourceAgentId: string, targetAgentId: string): Promise<ApiResult<{ targetPath: string }>>
```
(match whatever the existing `ApiResult`/response-wrapper type in `api.ts` is actually called — read the file, do not guess the type name.)

Backend contract (already implemented by M030, do not change): `POST /api/skills/:skillId/copy` with body `{ sourceAgentId, targetAgentId }`.

## Dependencies

- Upstream: M030
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M036-skillsview-cross-agent-copy-ui
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server, open Skills view, confirm a real end-to-end copy between two skill-capable agents works against the running local `agm start` server (create a throwaway test skill if needed, assign to one agent, then use the new UI to copy it to another, confirm the target agent's assignment badge appears and the target directory actually has the files on disk), confirm the error path (e.g. attempt a copy when the source has no such skill, if reachable through the UI) shows a real error message; then stop the server

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- real end-to-end manual verification transcript (what you clicked, what happened, confirmed via filesystem check that the copy actually happened)
- limitations or failures

## Completion criteria

- all requirements implemented
- no non-goal behavior changed
- scope respected
- verification passes including real runtime end-to-end check
- diff reviewed for accidental changes

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
