# M072 — Fix sidebar Agents count (shows 0) + sort Environment view alphabetically

## Identity

- Task ID: M072
- Parent workstream: Bugfix (user report)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M072-sidebar-count-env-sort
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M072-sidebar-count-env-sort
- Type: bug
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M072-sidebar-count-env-sort`

Work ONLY within these repository paths:

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/components/EnvVarsView.tsx`
- `packages/gui/src/smoke.test.tsx`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command, including a real browser check with the dev server, and paste the REAL output/screenshots-described-in-text in your final report.

## Why this task exists

The user (a real screenshot, not a hypothesis) reported the sidebar's "Agents" nav item shows a count of **0** even though the Agents page itself lists 22 installed agents. The lead already root-caused this by reading the code: `Sidebar.tsx`'s `countFor('agents')` returns `registry?.customAgents.length` — the count of manually-added CUSTOM agents only (typically 0 for most users), not the real installed/detected agent count the Agents page actually shows (e.g. "22/37 installed"). This is a straightforward wrong-metric bug.

Separately, the user asked for the Environment view to be sorted (ascending) — the lead confirmed `packages/core/src/env-vars.ts`'s `listEnvVars` has no sort at all; entries come back in raw `process.env`/shell-profile insertion order.

## Target state

1. **Sidebar fix**: `countFor('agents')` in `Sidebar.tsx` shows the real installed-agent count — the same number the Agents page's "Installed Agents" stat shows (check `AgentsView.tsx` for exactly which computed value that is — likely `agents.filter((a) => a.detection.installed).length`, already available via `useStore()` in `Sidebar.tsx` as the `agents` value already destructured there). Do not invent a new computation; reuse whatever the Agents page itself already trusts as the real count.
2. **Environment sort**: entries in `EnvVarsView.tsx`'s rendered list are sorted alphabetically ascending by variable name (case-insensitive). Sort client-side in the component (do not change `listEnvVars`'s core ordering/behavior unless sorting there is clearly the better place — your call, but keep the change minimal and don't restructure the function).

## Read first

### Current code

- `packages/gui/src/components/Sidebar.tsx` (the `countFor` switch, full file)
- `packages/gui/src/components/AgentsView.tsx` (how the real installed-agent count is computed and displayed, for parity)
- `packages/gui/src/components/EnvVarsView.tsx` (full file, how entries currently render, unsorted)
- `packages/core/src/env-vars.ts` (`listEnvVars`, read-only unless you determine core-side sorting is clearly correct)

### Tests

- `packages/gui/src/smoke.test.tsx` — add: the sidebar Agents count matches the real installed-agent count in a mocked fixture with a known number of installed agents and a different (or zero) number of custom agents; the Environment view renders entries in ascending alphabetical order given an unsorted mocked fixture.

## Allowed scope

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/components/EnvVarsView.tsx`
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/src/env-vars.ts` (read-only unless you have a strong, documented reason to sort there instead — default to sorting in the component)
- Any other component file

## Exact requirements

1. Sidebar "Agents" count matches the real installed-agent count, not `customAgents.length`.
2. Environment view entries render in ascending alphabetical order by name, case-insensitive.
3. Full gui test suite green with real new coverage for both fixes.

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M072-sidebar-count-env-sort
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Real browser check: start the GUI dev server (`pnpm --filter @ai-agent-config/gui dev` or the app's own dev command — check `package.json`), open it, confirm the sidebar's Agents badge now shows a real non-zero number matching the Agents page, and confirm the Environment page lists variables alphabetically — describe exactly what you saw

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- real browser confirmation described in text
- limitations or failures

## Completion criteria

- both bugs fixed and demonstrated with real evidence, full test suite green

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
