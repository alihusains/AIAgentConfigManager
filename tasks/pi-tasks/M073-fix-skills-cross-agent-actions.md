# M073 — Fix: user cannot attach/view/edit/delete skills across agents

## Identity

- Task ID: M073
- Parent workstream: Bugfix (user report)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M073-fix-skills-cross-agent-actions
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M073-fix-skills-cross-agent-actions
- Type: bug
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M073-fix-skills-cross-agent-actions`

Work ONLY within these repository paths:

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/index.css` (skill-row rules only)
- `packages/core/src/skills.ts`
- `packages/gui/src/smoke.test.tsx`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command, including a REAL browser check with the dev server clicking through the actual workflow, and paste what you actually observed in your final report.

## Why this task exists

The user reported (with a real screenshot of the "All skills (560)" list) that they "cannot attach a skill to other agents, cannot view, edit, delete, or modify it." This is a repeat complaint — cross-agent skill management was the ORIGINAL core requirement of this whole project and has supposedly been built across several earlier tasks (shared library + copy, cross-agent browse, delete-from-library, marketplace install). Something is still broken or not discoverable for the actual user.

## Current state — start here, do not assume

The lead read `SkillsView.tsx`'s `SkillRow` component and found a likely explanation worth verifying first: the per-agent-chip "copy to another agent" action (a small `Link2` icon inside each agent badge, e.g. "Claude Code", "Junie") IS present in the code for every row regardless of library status, but:

1. The convenient "Assign to: [agent buttons]" row only appears when `isLibrarySkill` is true — for a user whose shared library is genuinely empty (0 skills copied in, all 560 skills exist only inside individual agents' own folders — this matches the user's screenshot showing "Skills in library: 0, Skills total (all agents): 560"), that assign-shortcut row NEVER appears, for any skill.
2. Library-only actions (delete-from-library, copy-from-library) only render when `inLibrary` (`foundOn.has('library')`) is true — same problem, applies to zero of this user's actual skills.
3. The per-agent-chip copy icon (`Link2`, 12px) is small and may be visually indistinguishable from a plain badge/tag at normal zoom — the user may not even realize it is clickable. This could be a discoverability problem as much as a functional one.

**Do not assume any of the above is the (only) real cause. Start the GUI dev server for real, open the Skills page in a real browser, and reproduce the user's exact complaint yourself first**: with a shared library that has zero skills in it (the realistic case for most users — skills exist only in individual agents' folders), try to (a) copy/attach a skill from one agent to another, (b) view a skill's content, (c) edit a skill, (d) delete a skill. Document exactly what happens (or doesn't) at each step BEFORE deciding what to fix.

## Target state

Whatever the real, reproduced root cause turns out to be, the end state must be: for ANY skill in the "All skills" list — whether it started in the shared library or only inside one agent's own folder — the user can, without confusion:

- **Attach/copy** it to any other skill-capable agent (this may already technically work via the small copy icon; if so, the fix is making it visually obvious/discoverable, not adding new plumbing — do not build a duplicate mechanism if one already works, fix its visibility/UX instead).
- **View** its content (check whether a "view skill content" action exists anywhere today — if not, this is a real gap to close: at minimum, clicking a skill should show its `SKILL.md` content, reusing whatever code-viewing primitive already exists in the app, e.g. `CodeEditor.tsx`, read-only).
- **Edit** it (if no edit capability exists today for skills that live only in an agent's own folder, and the founder's `SKILL.md` frontmatter design allows it, wire this up reusing the existing raw-file-edit plumbing (`saveAgentRawFile`/`CodeEditor.tsx`) already used elsewhere in this app for agent config files, adapted to a skill file).
- **Delete** it — a skill that exists in an agent's own folder (not just the shared library) needs a delete action too, not just library skills (currently `onDeleteFromLibrary` is library-only, per the code).

Do not overbuild: if the honest fix is "make the existing action visible/obvious" rather than new backend plumbing, do that. Only add new backend capability in `skills.ts` if you confirm, via your real browser reproduction, that no existing capability covers it.

## Read first

### Current code

- `packages/gui/src/components/SkillsView.tsx` (full file — `SkillRow`, the assign/copy/delete handlers, `handleAssign`/`handleCopy`/`handleUnassign`/`handleDeleteFromLibrary`)
- `packages/core/src/skills.ts` (full file — `createSkill`, `assignSkillToAgent`, `removeSkillFromAgent`, `copySkillBetweenAgents`, `removeSkillFromLibrary`, `getAllKnownSkills`/`getSkillsSnapshot`)
- `packages/gui/src/components/CodeEditor.tsx` and the existing raw-file view/edit flow used for agent configs (for a pattern to reuse for viewing/editing a skill's `SKILL.md`)

### Tests

- `packages/gui/src/smoke.test.tsx` — add real coverage for the fixed/added behavior: attach/copy works and is visually discoverable for a non-library skill; view works for any skill; edit works where added; delete works for a skill that lives only in an agent's folder, not just a library skill.

## Allowed scope

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/index.css` (skill-row rules only)
- `packages/core/src/skills.ts`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/cli/src/gui-server.ts` UNLESS your real reproduction proves a genuinely new backend route is required (e.g. for view/edit/delete-from-agent-folder) — if so, note it clearly in your report and get it right, but keep the route additive and following existing conventions exactly; do not restructure existing routes.
- Any other component file

## Exact requirements

1. Real browser reproduction FIRST, documented, before any fix.
2. Attach/copy, view, edit, and delete all genuinely work and are discoverable for skills regardless of whether they are "in the library" or only inside one agent's folder.
3. No duplicate mechanisms built where an existing one already works — fix visibility/UX for those, add real plumbing only where nothing exists.
4. Full gui (+ core, if `skills.ts` changes) test suite green.

## Non-goals

- No redesign of the overall Skills page layout beyond what is needed to fix these specific actions.
- No new skill-source integrations (marketplace is M066/M067, untouched here).

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M073-fix-skills-cross-agent-actions
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` within allowed scope only
- Real end-to-end in a real browser against a realistic fixture (shared library empty, skills present only in 2+ agents' own folders): attach one such skill to a third agent, view its content, edit it if edit is added, delete it — describe exactly what you did and saw at each step, including what was broken BEFORE your fix

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- the real reproduction steps and observations, before and after the fix
- limitations or failures

## Completion criteria

- the user's exact complaint (attach/view/edit/delete not working) is reproduced, root-caused, and fixed with real before/after evidence

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
