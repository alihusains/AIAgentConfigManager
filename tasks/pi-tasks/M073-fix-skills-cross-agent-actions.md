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

**Do NOT start a GUI dev server or drive a real browser for this task.** Two prior dispatch attempts on this exact task stalled indefinitely during an interactive browser-verification step. Verify everything through React Testing Library component tests in `smoke.test.tsx` instead — they already render these exact components against realistic fixtures and are the established, reliable verification method used throughout this codebase's existing test suite.

Run every required verification command and paste the REAL output in your final report.

## Why this task exists

The user reported (with a real screenshot of the "All skills (560)" list) that they "cannot attach a skill to other agents, cannot view, edit, delete, or modify it." Cross-agent skill management was the ORIGINAL core requirement of this whole project and has supposedly been built across several earlier tasks (shared library + copy, cross-agent browse, delete-from-library, marketplace install). Something is still broken or not discoverable for the actual user.

## Current state — read the actual code, do not stop at this summary

The lead root-caused this by reading `SkillsView.tsx`'s `SkillRow` component and found:

1. The convenient "Assign to: [agent buttons]" row only appears when `isLibrarySkill` is true. For a user whose shared library is genuinely empty (0 skills copied in, all 560 skills exist only inside individual agents' own folders — this matches a real user's screenshot showing "Skills in library: 0, Skills total (all agents): 560"), that assign-shortcut row NEVER appears, for any skill.
2. Library-only actions (delete-from-library, copy-from-library) only render when `inLibrary` (`foundOn.has('library')`) is true — same problem, applies to zero of this user's actual skills.
3. The per-agent-chip "copy to another agent" action (a small `Link2` icon inside each agent badge, e.g. "Claude Code") IS present in the code for every row regardless of library status, but is small (12px) and may be visually indistinguishable from a plain badge/tag — a discoverability problem as much as a functional one.

**Read `SkillRow` in `SkillsView.tsx` yourself in full and confirm or correct this diagnosis before writing any fix.** Then write a NEW test in `smoke.test.tsx` that renders `SkillsView` with a realistic fixture matching the real user's situation — shared library empty, all skills found only via `foundOn: ['some-agent-id', 'another-agent-id']`, never `'library'` — and assert, using React Testing Library queries (`getByRole`, `getByTitle`, `queryByRole`, etc.), whether attach/copy, view, edit, and delete controls are actually present and clickable for such a skill. This test should FAIL against the current code if the diagnosis above is correct — that failure IS your reproduction. Fix the code until the test passes.

## Target state

Whatever the confirmed root cause turns out to be, the end state must be: for ANY skill in the "All skills" list — whether it started in the shared library or only inside one agent's own folder — the user can, without confusion:

- **Attach/copy** it to any other skill-capable agent (this may already technically work via the small copy icon; if so, the fix is making it visually obvious/discoverable, not adding new plumbing — do not build a duplicate mechanism if one already works, fix its visibility/UX instead).
- **View** its content (check whether a "view skill content" action exists anywhere today — if not, this is a real gap to close: at minimum, clicking a skill should show its `SKILL.md` content, reusing whatever code-viewing primitive already exists in the app, e.g. `CodeEditor.tsx`, read-only).
- **Edit** it (if no edit capability exists today for skills that live only in an agent's own folder, and the `SKILL.md` frontmatter design allows it, wire this up reusing the existing raw-file-edit plumbing (`saveAgentRawFile`/`CodeEditor.tsx`) already used elsewhere in this app for agent config files, adapted to a skill file).
- **Delete** it — a skill that exists in an agent's own folder (not just the shared library) needs a delete action too, not just library skills (currently `onDeleteFromLibrary` is library-only, per the code).

Do not overbuild: if the honest fix is "make the existing action visible/obvious" rather than new backend plumbing, do that. Only add new backend capability in `skills.ts` if your test-driven reproduction confirms no existing capability covers it.

## Read first

### Current code

- `packages/gui/src/components/SkillsView.tsx` (full file — `SkillRow`, the assign/copy/delete handlers, `handleAssign`/`handleCopy`/`handleUnassign`/`handleDeleteFromLibrary`)
- `packages/core/src/skills.ts` (full file — `createSkill`, `assignSkillToAgent`, `removeSkillFromAgent`, `copySkillBetweenAgents`, `removeSkillFromLibrary`, `getAllKnownSkills`/`getSkillsSnapshot`)
- `packages/gui/src/components/CodeEditor.tsx` and the existing raw-file view/edit flow used for agent configs (for a pattern to reuse for viewing/editing a skill's `SKILL.md`)

### Tests

- `packages/gui/src/smoke.test.tsx` — the new reproduction test described above, plus coverage for the fixed/added behavior: attach/copy works and is discoverable (a real, queryable control, not just present in the DOM) for a non-library skill; view works for any skill; edit works where added; delete works for a skill that lives only in an agent's folder, not just a library skill.

## Allowed scope

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/index.css` (skill-row rules only)
- `packages/core/src/skills.ts`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/cli/src/gui-server.ts` UNLESS your reproduction proves a genuinely new backend route is required (e.g. for view/edit/delete-from-agent-folder) — if so, note it clearly in your report and get it right, but keep the route additive and following existing conventions exactly; do not restructure existing routes.
- Any other component file
- Starting a dev server or any browser automation tool

## Exact requirements

1. A failing reproduction test written FIRST (against the realistic empty-library fixture), confirming the real bug, before any fix.
2. Attach/copy, view, edit, and delete all genuinely work and are discoverable (queryable via RTL, not merely present in markup) for skills regardless of whether they are "in the library" or only inside one agent's folder.
3. No duplicate mechanisms built where an existing one already works — fix visibility/UX for those, add real plumbing only where nothing exists.
4. Full gui (+ core, if `skills.ts` changes) test suite green.

## Non-goals

- No redesign of the overall Skills page layout beyond what is needed to fix these specific actions.
- No new skill-source integrations (marketplace is M066/M067, untouched here).
- No live browser verification in this task — the lead will do a final live check after merge.

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
- Paste the reproduction test's output BOTH before your fix (red) and after (green) — this is your evidence, in place of a live browser session

## Expected evidence

- exact commands executed
- real build/test output, both red (before fix) and green (after fix) for the reproduction test
- files changed
- limitations or failures

## Completion criteria

- the user's exact complaint (attach/view/edit/delete not working) is reproduced via a failing test, root-caused, and fixed with a now-passing test

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
