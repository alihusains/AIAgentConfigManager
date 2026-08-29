# M035 — Buttons/inputs v2 + refined cmd+K command palette + empty/loading states

## Identity

- Task ID: M035
- Parent workstream: AgentControl GUI redesign v2
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch time — branch from main AFTER M029 is merged>
- Branch: pi/M035-buttons-inputs-palette-v2
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M035-buttons-inputs-palette-v2
- Type: feature
- Priority: P1
- Dependencies: M029 must be merged first

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M035-buttons-inputs-palette-v2`

Work ONLY within these repository paths:

- `packages/gui/src/ui/Button.tsx`
- `packages/gui/src/ui/EmptyState.tsx`
- `packages/gui/src/ui/Skeleton.tsx`
- `packages/gui/src/ui/Field.tsx`
- `packages/gui/src/components/CommandPalette.tsx`
- `packages/gui/src/index.css` (button/input/palette/empty-state/skeleton rules only)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not touch M029's token definitions — consume `var(--token)` only.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder's brief asks for: "Buttons/inputs — pill or soft-rounded, with clear primary/secondary/ghost hierarchy, search bar with cmd+K styling refined (floating command palette feel)" and "Empty/loading states — designed, not default (skeleton shimmer, friendly illustration or icon for zero-state)." These are shared primitives every other v2 task (sidebar, dashboard, tables) will render through — applying v2 tokens here benefits the whole app immediately since these are reused components.

## Current state

Read all five files listed above in full before changing anything. `Button.tsx`/`EmptyState.tsx`/`Skeleton.tsx` are small, focused primitives already in `packages/gui/src/ui/` (established in E6 per CHECKPOINT.md — "status system + skeletons"). `CommandPalette.tsx` (301 lines) already implements the ⌘K palette (E5, landed in commit `cea276b` per CHECKPOINT). Check what `.btn-primary`/`.btn-secondary`/`.btn-ghost` currently look like in `index.css` (lines ~836–865) before restyling — confirm they already have a primary/secondary/ghost hierarchy (per the class names, they likely do) and that your job is refining the visual treatment (pill/soft-rounded shape, hover/focus states) with v2 tokens, not building the hierarchy from scratch.

## Target state

- Read `docs/epics/agentic-control-plane-redesign-v2.md` for v2 tokens (colors, `--radius-full` for pill shape, spacing scale, glass utilities). No hardcoded hex.
- Buttons: pill or soft-rounded (`--radius-full` or `--radius-lg`, your call per button size/density — keep large CTAs pill-shaped, dense inline actions can stay `--radius-md`), with a clear visual hierarchy: primary (filled `--accent-primary`), secondary (bordered/outlined), ghost (text-only, subtle hover background). Add a designed hover/focus/active state to each (subtle scale or glow on hover, visible focus ring for keyboard nav — do not remove existing focus-visible styles, only restyle them with v2 tokens).
- Inputs (`Field.tsx` / any `<input>`/`<select>` styling in `index.css`): soft-rounded, consistent border/focus-ring treatment using v2 tokens.
- Command palette: refine into more of a "floating command palette feel" — a `.glass-surface` (from M029) backdrop-blur panel, soft elevation shadow, refined result-row hover states — without changing its actual keyboard-navigation behavior, search logic, or the set of commands it exposes.
- Empty states (`EmptyState.tsx`): keep the existing icon-based approach (check current implementation — if it already takes an icon, keep that API), refine visual treatment with v2 tokens and generous whitespace; do not add new illustration assets (no new SVG/image files — reuse `lucide-react` icons already used elsewhere).
- Loading states (`Skeleton.tsx`): refine the shimmer animation to respect `prefers-reduced-motion` (if it doesn't already — check first) and use v2 surface tokens for the shimmer gradient.

## Read first

### Current code

- `packages/gui/src/ui/Button.tsx`
- `packages/gui/src/ui/EmptyState.tsx`
- `packages/gui/src/ui/Skeleton.tsx`
- `packages/gui/src/ui/Field.tsx`
- `packages/gui/src/components/CommandPalette.tsx`
- Button/input/palette/skeleton CSS rules in `packages/gui/src/index.css` (search `.btn-`, `.command-palette`, `.skeleton`, `.field`)

### Reference / specification

- `docs/epics/agentic-control-plane-redesign-v2.md` (M029's frozen token contract)

### Tests

- `packages/gui/src/smoke.test.tsx` and `packages/gui/src/status.test.tsx` — keep all assertions passing; update selectors only if structure changed, never weaken an assertion.

## Allowed scope

- `packages/gui/src/ui/Button.tsx`
- `packages/gui/src/ui/EmptyState.tsx`
- `packages/gui/src/ui/Skeleton.tsx`
- `packages/gui/src/ui/Field.tsx`
- `packages/gui/src/components/CommandPalette.tsx`
- `packages/gui/src/index.css` (button/input/palette/empty-state/skeleton rules only)
- `packages/gui/src/smoke.test.tsx`, `packages/gui/src/status.test.tsx` (selector updates only)

## Forbidden scope

- Any token definition (M029's contract)
- Any component file not listed above
- Changing command palette keyboard behavior, search/filter logic, or command list
- Adding new image/illustration assets

## Exact requirements

1. Restyle buttons (primary/secondary/ghost) with v2 tokens, pill/soft-rounded geometry, designed hover/focus/active states, focus-visible preserved for accessibility.
2. Restyle inputs/fields with v2 tokens, consistent focus-ring treatment.
3. Refine the command palette into a glass/blur floating panel per v2 tokens, with zero change to its keyboard nav, search, or command set.
4. Refine empty states with v2 tokens and generous whitespace, reusing existing icon-based API, no new assets.
5. Refine skeleton loading shimmer with v2 tokens, respecting `prefers-reduced-motion`.

## Non-goals

- No new illustration/image assets.
- No change to command palette functionality, only visual treatment.
- No redesign of any view-level component (Dashboard/Sidebar/tables — those are separate parallel tasks).

## Implementation constraints

- Preserve public component props/exports of all five files.
- Follow existing naming/class conventions.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

`Button`, `EmptyState`, `Skeleton`, `Field` component prop shapes must not change (these are consumed across many other components you are not touching in this task — a signature change would silently break call sites in files outside your scope). `CommandPalette`'s external trigger (keyboard shortcut, open/close API) must not change.

## Dependencies

- Upstream: M029
- Downstream: none (M031–M034 already use these shared primitives as-is; if this task changes a prop shape, it would break them — hence the interface constraint above)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M035-buttons-inputs-palette-v2
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- `grep -rn "<Button\|<EmptyState\|<Skeleton\|<Field" packages/gui/src/components/` — confirm every call site's prop usage still matches the (unchanged) prop signatures
- Start the GUI dev server, visually confirm buttons/inputs/palette/empty/loading states in both themes, confirm ⌘K still opens/closes/searches/navigates identically; confirm reduced-motion disables shimmer/palette animations; then stop the server

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- confirmation command palette behavior is unchanged (describe what you tested)
- limitations or failures

## Completion criteria

- all requirements implemented
- no prop-signature breakage for shared primitives
- no non-goal behavior changed
- scope respected
- verification passes
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
