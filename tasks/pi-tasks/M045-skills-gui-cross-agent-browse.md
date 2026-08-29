# M045 — SkillsView: browse every skill on every agent, copy any skill between any two agents

## Identity

- Task ID: M045
- Parent workstream: Skills feature — core requirement fix
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch — branch AFTER M044 is merged>
- Branch: pi/M045-skills-gui-cross-agent-browse
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M045-skills-gui-cross-agent-browse
- Type: feature
- Priority: P0
- Dependencies: M044 must be merged first — this task consumes the aggregation API it adds

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M045-skills-gui-cross-agent-browse`

Work ONLY within these repository paths:

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/index.css` (skills-view rules only)
- `packages/gui/src/smoke.test.tsx`

Read every file listed in "Read first" before writing code — especially M044's actual merged diff, since this task's whole job is consuming what it built.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

M044 added a backend aggregation of every skill found on every skill-capable agent's real directory (not just the tool's own separate shared library). On this machine, `claude-code` alone has ~283 real skills sitting in `~/.claude/skills` that were completely invisible in the current SkillsView because it only ever renders `snapshot.skills` (the empty shared library). This task rewires the UI so the founder can actually browse everything that exists, and copy any skill from any agent to any other skill-capable agent — the literal core requirement that was broken.

## Current state

Read `packages/gui/src/components/SkillsView.tsx` in full (442 lines pre-M036, now larger after M036's copy-affordance work). It currently renders `snapshot.skills.map(skill => <SkillCard .../>)` — only library skills get a card at all. Read M044's actual merged diff (`git log`/`git show` on the commit that merged M044 into `main`) to get the exact new API shape it exposed (documented in that task's final report) before writing any code — do not guess the shape.

## Target state

- The Skills view must show a browsable list/grid covering EVERY skill found anywhere (library + every agent), using M044's aggregation data, not just `snapshot.skills`.
- Each skill entry shows: name, description, version (if any), and which agents it's currently found on (`foundOn`).
- For each skill, the user can pick ANY currently-listed source agent (or the library, if present there) and copy it to ANY other skill-capable agent — reuse the existing `copySkillToAgent`/`copySkillBetweenAgents` API wiring from M036 (do not reinvent it), just make the SOURCE agent selectable from the full `foundOn` list rather than assuming the skill originated in the library.
- A skill found on a large number of agents (e.g. a skill installed everywhere) should not degrade the UI into an unreadable wall — use pagination, virtualization, or a search/filter box (the codebase already has `useWindowedList.ts` in `packages/gui/src/hooks/` — check if it's applicable and reuse it rather than inventing a new list-virtualization approach) given ~283 real skills exist on this machine right now; the view MUST stay responsive and scrollable vertically only, never horizontally (a hard project-wide requirement — verify no new horizontal overflow is introduced at 1024px and 1440px viewport widths).
- Loading state for a large skill list uses the existing `Skeleton` component (already used elsewhere in this file), not a spinner-only state.
- Search/filter by skill name is required given the realistic scale (283+ entries) — a plain client-side substring filter on the already-fetched aggregated list is sufficient, no new backend endpoint needed.
- Preserve the existing "Create new skill" flow, the existing assign/unassign chip UI for LIBRARY skills specifically (do not remove existing functionality), and the existing copy-affordance UI pattern from M036 — this task extends the model to cover non-library-originated skills, it does not replace the existing UI wholesale.

## Read first

### Current code

- `packages/gui/src/components/SkillsView.tsx` (full file, current state after M036)
- `packages/gui/src/api.ts` (existing skills client functions)
- `packages/gui/src/hooks/useWindowedList.ts` (existing list virtualization utility — check applicability)
- `packages/gui/src/ui/Skeleton.tsx` (existing loading-state convention)

### Reference / specification

- M044's merged commit and its final report (the exact new API shape)
- `docs/epics/agentic-control-plane-redesign-v2.md` (v2 tokens — this file must be styled with v2 tokens throughout, consistent with the rest of the redesign; no hardcoded hex)

### Tests

- `packages/gui/src/smoke.test.tsx` — update/add assertions covering: a skill that exists only on an agent (not the library) renders and is copyable; search/filter narrows the visible list; no assertion is weakened.

## Allowed scope

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/index.css` (skills-view rules only)
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- Any other component file
- `packages/core/`, `packages/cli/` (M044's territory, already merged, do not modify)

## Exact requirements

1. Every skill found anywhere (library or any agent) is visible and browsable, backed by M044's aggregation.
2. Any skill can be copied from any of its real current locations to any other skill-capable agent.
3. Search/filter works across the full list.
4. Large lists (283+ real entries) stay performant and render via loading skeletons, not a blocking spinner.
5. Zero horizontal scrolling introduced, verified at 1024px and 1440px.
6. Existing create/assign/unassign/copy functionality for library skills is preserved.

## Non-goals

- No content-diffing UI for a skill that differs across two agents' copies.
- No forced import of discovered skills into the shared library.
- No redesign of any other view.

## Implementation constraints

- Preserve `SkillsView`'s external export.
- Follow existing naming/class conventions and v2 tokens.
- Prefer the smallest correct diff given the file's existing size.
- No speculative abstractions.

## Interface / contract

Consumes M044's aggregation API exactly as documented in its final report — do not invent a different shape client-side.

## Dependencies

- Upstream: M044
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M045-skills-gui-cross-agent-browse
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server against this real machine's config (or a temp `AI_CONFIG_HOME` seeded with a realistic large skill count), confirm the real ~283 `claude-code` skills are now browsable and one can be copied to another skill-capable agent (e.g. `pi`), confirmed by checking the target agent's directory on disk afterward
- Confirm zero horizontal scrollbar at 1024px and 1440px viewport widths
- Confirm search/filter narrows results correctly
- Stop the server after

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- real end-to-end proof that a previously-invisible agent-only skill is now browsable and was successfully copied to a different agent, confirmed on disk
- limitations or failures

## Completion criteria

- all requirements implemented and demonstrated with real evidence
- no non-goal behavior changed
- scope respected
- verification passes

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
