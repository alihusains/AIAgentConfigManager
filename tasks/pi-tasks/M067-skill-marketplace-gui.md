# M067 — Skill marketplace GUI: browse, preview, install from the public repo

## Identity

- Task ID: M067
- Parent workstream: Growth feature (browse-and-install layer)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 58ba5ef (main, after M066 merged)
- Branch: pi/M067-skill-marketplace-gui
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M067-skill-marketplace-gui
- Type: feature
- Priority: P1
- Dependencies: M066 must be merged first

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M067-skill-marketplace-gui`

Work ONLY within these repository paths:

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/index.css` (marketplace-section rules only)
- `packages/gui/src/smoke.test.tsx`

Read every file listed in "Read first" before writing code — especially M066's actual merged diff and final report for the exact API shape.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

M066 (merged) built real, cached, user-triggered interop with the public `alihusains/enterprise-skills` repo. This task adds the actual "Browse marketplace" experience to the existing SkillsView, so the founder can discover and install real external skills alongside the local cross-agent browsing already built (M045).

## Target state

- Add a "Marketplace" tab/section within the existing `SkillsView` (do not build a separate page — this is a founder-decided scope boundary, keep it inside the existing Skills experience alongside the library/cross-agent browsing).
- The marketplace section is EMPTY/collapsed by default and only fetches when the user explicitly expands it or clicks "Browse marketplace" — no automatic fetch on page load, matching M066's user-triggered-only design.
- Each marketplace skill shows: name, description, a link to view it on GitHub (`htmlUrl`), and an "Install" button.
- Clicking Install calls M066's install endpoint, shows a loading state, and on success refreshes the local library view (M045's existing `allSkills` list) so the newly-installed skill immediately appears as a normal library skill, copyable to any agent via the existing flow — no special-cased "marketplace skill" state after install, it becomes an ordinary library skill.
- If a skill with that id already exists locally (M066 refuses to silently overwrite), show a clear message, not a silent failure.
- A manual "Refresh" action for the marketplace list, respecting M066's cache/force semantics.
- Rate-limit / network-failure errors from M066 are shown honestly (e.g. "GitHub rate limit reached, try again in N minutes" if that detail is available, or a clear generic network error) — never a blank/broken state with no explanation.
- Styled entirely with v2 tokens, both themes, consistent with the rest of `SkillsView`.

## Read first

### Current code

- `packages/gui/src/components/SkillsView.tsx` (full file, current state after M036/M045/M055)
- M066's merged commit and final report (the exact API shape and error semantics)
- `packages/gui/src/ui/` (`Skeleton`, `Button`, `EmptyState`, `Badge` — reuse these)

### Reference / specification

- `docs/epics/agentic-control-plane-redesign-v2.md`

### Tests

- `packages/gui/src/smoke.test.tsx` — add assertions: marketplace section doesn't fetch until expanded/triggered; a successful install adds the skill to the visible local library list; an already-exists case shows a clear message; a mocked rate-limit error shows a clear error, not a blank state.

## Allowed scope

- `packages/gui/src/components/SkillsView.tsx`
- `packages/gui/src/api.ts`
- `packages/gui/src/index.css` (marketplace-section rules only)
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/**`, `packages/cli/**` (M066's territory, already merged)
- Any other component file

## Exact requirements

1. Marketplace section inside SkillsView, collapsed/no-fetch by default.
2. Browse, preview (name/description/GitHub link), install.
3. Successful install merges into the existing local library view seamlessly.
4. Already-exists and rate-limit/network errors both shown clearly, never silently.
5. Full gui test suite green with real new coverage.

## Non-goals

- No new page/route.
- No second marketplace source in this task.
- No redesign of the existing library/cross-agent browsing sections.

## Implementation constraints

- Reuse existing UI primitives and SkillsView's established patterns exactly.
- Smallest correct diff given the file's size.
- No speculative abstractions.

## Interface / contract

Consumes M066's marketplace API exactly as documented in its final report.

## Dependencies

- Upstream: M066
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M067-skill-marketplace-gui
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Real end-to-end: start the GUI dev server, expand the marketplace section, confirm a real fetch happens only then (not on page load), browse real results, install one real skill, confirm it appears in the local library and is copyable to an agent via the existing flow, confirmed on disk
- Confirm no fetch happens if the marketplace section is never opened

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- real end-to-end proof (browse, install, appears in library, copyable)
- limitations or failures

## Completion criteria

- all requirements implemented and demonstrated with real evidence
- zero automatic/background fetching
- scope respected

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
