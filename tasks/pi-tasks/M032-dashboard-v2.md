# M032 — Dashboard v2: bento stat cards + visual protocol coverage

## Identity

- Task ID: M032
- Parent workstream: AgentControl GUI redesign v2
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch time — branch from main AFTER M029 is merged>
- Branch: pi/M032-dashboard-v2
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M032-dashboard-v2
- Type: feature
- Priority: P1
- Dependencies: M029 must be merged first

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M032-dashboard-v2`

Work ONLY within these repository paths:

- `packages/gui/src/components/Dashboard.tsx`
- `packages/gui/src/index.css` (dashboard/KPI/protocol-coverage rules only)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce a charting library dependency (no recharts/d3/chart.js) — build the sparkline/donut/segmented-bar visuals with plain SVG or CSS conic-gradient, no new dependency.

Do not touch M029's token definitions — consume `var(--token)` only.

Do not fabricate trend/sparkline data — see "Non-goals" below, this is a hard project rule (CHECKPOINT.md: "Do not fabricate data... A fake tab is worse than an absent one").

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder's brief calls for: "Dashboard stat cards — turn 'Model Providers / MCP Servers / Agents / Custom Agents' into a bento-grid of cards with sparkline/ring visualizations, subtle gradient backgrounds per card, and a real sense of 'live system health'" and "Protocol coverage panel — replace flat progress bars with a more visual representation (radial/donut cluster or segmented horizontal bars with gradient fills and animated fill-in), clearer legend tied to color."

Read the existing `Dashboard.tsx` docstring (lines ~18–32) carefully first — the current implementation deliberately REPLACED an earlier "uniform card grid" with a single KPI strip, specifically to avoid the "row of four identical tinted cards" anti-pattern the founder's CURRENT-STATE complaint also names. Your job is to reconcile these: build the bento-grid treatment the new brief wants, but keep it "an intentional overview panel," not a return to generic uniform tinted cards — differentiate each cell (different accent tint per metric type, not identical styling repeated four times) rather than reverting to what was already deliberately removed.

## Current state

Read `packages/gui/src/components/Dashboard.tsx` in full (378 lines). It currently has:
- A `KpiCell` component rendering one stat inside a single "overview strip" (label, icon, value, optional trend, click-through)
- A `ProtocolCoverage` component (lines ~72–110) rendering `.protocol-bar`/`.protocol-bar-fill` flat proportional bars per `ProviderApiKind` (`chat`/`responses`/`anthropic`), with counts and a legend
- No real "trend" data source currently wired (check the `trend` prop's actual usage/callers — if no real trend/historical data exists, `trend` is likely unused or always undefined; do NOT invent fake trend numbers to fill it)

## Target state

- Read `docs/epics/agentic-control-plane-redesign-v2.md` for exact tokens (colors, spacing, radius, glass/glow utilities from M029). No hardcoded hex.
- Turn the KPI strip into a bento-style grid of 4 cards (Model Providers / MCP Servers / Agents / Custom Agents), each with:
  - A distinct subtle gradient background derived from a different semantic/accent token per card (not 4 identical tints)
  - The stat number rendered with the `.stat-figure`/`.numeric-display` utility class from M029 (Space Grotesk + tabular figures)
  - A ring or sparkline visualization ONLY if there is a real data dimension to show one honestly:
    - If there's a genuine count-vs-capacity or count-vs-total relationship available from existing store/registry state (e.g. "installed" vs "detected total" for Agents), render a simple SVG ring showing that real ratio.
    - If no real secondary dimension exists for a given card (e.g. Custom Agents may just be a flat count with nothing to compare against), do NOT invent one — render that card as a clean number-forward card without a fake ring, and note this honestly in your final report rather than fabricating a ratio.
  - A brief entrance count-up animation on mount (from 0 to the real value, CSS/JS transition, respecting `prefers-reduced-motion` — skip animation entirely when reduced motion is set, show the final value immediately).
- Rework `ProtocolCoverage` from flat bars into a clearer visual: EITHER a segmented horizontal bar with gradient fills and an animated fill-in transition (simplest, lowest-risk upgrade of the existing structure) OR a radial/donut cluster (higher fidelity but higher risk) — your choice, but if you choose the donut, it must render with plain SVG (`<circle>` with `stroke-dasharray`/`stroke-dashoffset`), no library. Keep the existing legend tied to color, using the same three protocol kinds and the same real counts already computed — do not alter what data is shown, only how it's rendered.
- Preserve all existing click-through behavior (KPI cells linking to their respective views).

## Read first

### Current code

- `packages/gui/src/components/Dashboard.tsx` (full file)
- `packages/gui/src/ui/Skeleton.tsx` (loading-state convention already used — keep using it for the loading state of these cards, do not invent a new skeleton pattern)
- Dashboard-related CSS in `packages/gui/src/index.css` (search `.kpi`, `.protocol-`)

### Reference / specification

- `docs/epics/agentic-control-plane-redesign-v2.md` (M029's frozen token contract)
- CHECKPOINT.md (the "do not fabricate data" rule — read the relevant paragraph)

### Tests

- `packages/gui/src/smoke.test.tsx` — check for Dashboard assertions; keep them passing (update only if the DOM structure they assert on must change, and if so keep the assertions equivalent in intent, not weakened).

## Allowed scope

- `packages/gui/src/components/Dashboard.tsx`
- `packages/gui/src/index.css` (dashboard/kpi/protocol-coverage rules only)
- `packages/gui/src/smoke.test.tsx` (only if an existing assertion's DOM query needs updating to match a structural change you made — do not weaken or delete an assertion, only adjust its selector)

## Forbidden scope

- Any token definition (M029's contract)
- Any new npm dependency (charting libs especially)
- Any other component file
- Fabricated data of any kind

## Exact requirements

1. Replace the KPI strip with a bento-grid of 4 differentiated cards using v2 tokens, each with a distinct gradient tint.
2. Render real ratios as SVG rings only where a genuine secondary data dimension exists; otherwise render an honest number-forward card.
3. Add a respectful count-up entrance animation (skipped under `prefers-reduced-motion`).
4. Rework `ProtocolCoverage` into segmented gradient bars or an SVG donut cluster (implementer's choice), preserving the exact same underlying data and legend semantics.
5. Preserve all click-through navigation behavior.

## Non-goals

- Do not add any new backend data source, API call, or trend/history endpoint — this task consumes only what's already available in store/registry state today.
- Do not invent sparkline history data — there is no time-series data source in this project; a "sparkline" literally requires historical points this project does not currently persist, so do not build one from fabricated points. Where the brief says "sparkline," a ring/ratio visualization using only currently-available real data is the honest substitute; state this substitution explicitly in your final report.
- No redesign of any other view.

## Implementation constraints

- Preserve public component props/exports used elsewhere (`Dashboard` itself, any exported subcomponents referenced by other files — check with grep before renaming/removing an export).
- Follow existing naming/class conventions.
- Prefer the smallest correct diff.
- No speculative abstractions (e.g. a generic "chart" component library) — build exactly what's needed here.

## Interface / contract

`Dashboard` component's external props/usage in `App.tsx` must not change. The underlying registry/catalog data shape consumed (`registry`, `agents`, coverage counts) must not change — this task is presentation-only.

## Dependencies

- Upstream: M029
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M032-dashboard-v2
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server, visually confirm the bento grid, ring visuals (where real data supports them), protocol coverage panel, and count-up animation in both themes; confirm reduced-motion disables the count-up; then stop the server
- Confirm no fabricated data was introduced (state this explicitly)

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- explicit statement of which cards got a real ring vs. honest number-forward treatment and why
- limitations or failures

## Completion criteria

- all requirements implemented
- no fabricated data
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
