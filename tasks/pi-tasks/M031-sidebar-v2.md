# M031 — Sidebar v2: grouped nav, active pill/glow, live status dots

## Identity

- Task ID: M031
- Parent workstream: AgentControl GUI redesign v2
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: <set at dispatch time — branch from main AFTER M029 is merged>
- Branch: pi/M031-sidebar-v2
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M031-sidebar-v2
- Type: feature
- Priority: P1
- Dependencies: M029 (design-tokens-v2) must be merged to main first — this task reads `docs/epics/agentic-control-plane-redesign-v2.md` as its palette/token contract

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M031-sidebar-v2`

Work ONLY within these repository paths:

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/index.css` (sidebar-specific rules only — search for existing `.sidebar`/`.nav-item` rules, do not touch token definitions from M029)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies (lucide-react icons already used — reuse that icon set; do not add a new icon library).

Do not touch any token definition added by M029 — consume `var(--token-name)` only.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder's redesign brief calls for: "Sidebar nav — collapsible, icon+label with active-state pill/glow indicator, grouped sections (Registry, Detected Agents) with clear visual separation and status dots that feel like live signals, not static bullets." M029 has landed the v2 token foundation (electric-violet/signal-green palette, glass/glow utilities, spacing/radius scale); this task applies it to the sidebar specifically.

## Current state

Read `packages/gui/src/components/Sidebar.tsx` in full (149 lines). It currently renders a flat `REGISTRY_VIEWS` list (Overview/Providers/MCP Servers/Agents/Skills/CLI Tools) plus real counters derived from registry state (`countFor`), an `installed` count of detected agents, and per-agent icons via `AgentIconTile`. Active state uses a `nav-item active` class. There is already a "Registry / Detected / System" grouping per CHECKPOINT §4 (E2) — confirm what grouping already exists by reading the full render output before assuming you need to build grouping from scratch; you may only need to restyle the existing groups, not restructure them.

## Target state

- Read `docs/epics/agentic-control-plane-redesign-v2.md` (produced by M029) for the exact token names to use — do not hardcode any hex color in this task; every color must come from a `var(--token)`.
- Active nav item gets a pill-shaped background (`var(--radius-full)`) using `--accent-primary` at low opacity plus a soft `--accent-primary` glow (box-shadow), not a hard fill — text stays `--text-primary` or `--accent-primary-text` (whichever passes contrast per the v2 spec's measured table).
- Each detected/installed agent status indicator becomes a small pulsing dot (CSS animation, `prefers-reduced-motion` respected — no animation when reduced motion is set) using `--accent-success` for installed / a neutral `--text-tertiary`-based dot for not-installed. This is a decorative enhancement layered on top of the EXISTING text/label that already communicates status — per this project's own accessibility rule (see `packages/gui/src/ui/Status.tsx`), status must never be color-only; keep whatever text/aria-label already exists and only add the visual dot alongside it.
- Sidebar itself uses the `--surface` background with a `--border` divider from the content area (no more stark contrast between a dark sidebar and a white content area — both should share the same v2 dark (or light) theme).
- Add a collapse/expand affordance if one does not already exist (check current code for `sidebarOpen` state in the store — it may already exist for mobile; if a collapse toggle for desktop does not exist, add a simple icon-only collapsed state that keeps icons + tooltips, expanding on hover or click).

## Read first

### Current code

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/ui/Status.tsx` (the existing dot+text status pattern — reuse its convention, do not invent a second one)
- Sidebar-related CSS rules in `packages/gui/src/index.css` (search `.sidebar`, `.nav-item`, `.nav-group`)

### Reference / specification

- `docs/epics/agentic-control-plane-redesign-v2.md` (from M029 — the frozen token contract)
- `docs/audits/E7-audit-report.md` (nav contrast was previously measured and fixed at 7.12 — do not regress below 4.5:1 for nav text)

### Tests

- `packages/gui/src/smoke.test.tsx` — check whether it renders/asserts on the Sidebar; if so, keep those assertions passing.

## Allowed scope

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/index.css` (sidebar/nav rules only)

## Forbidden scope

- Any token definition in `index.css` (that's M029's contract; consume, don't redefine)
- Any other component file
- `packages/core/`, `packages/cli/`

## Exact requirements

1. Apply v2 tokens (colors, spacing, radius) to the sidebar background, dividers, and nav items — zero hardcoded hex values remaining in the touched CSS.
2. Active nav item: pill shape + soft accent glow, text contrast ≥4.5:1 (verify against the v2 spec's measured table).
3. Status dots for detected/installed agents, animated pulse respecting `prefers-reduced-motion`, additive to (not replacing) existing text/aria status indication.
4. Grouped sections (Registry / Detected / System or whatever the current grouping is) get clear visual separation (spacing + a subtle divider), restyled not restructured unless no grouping exists yet.
5. No regression to keyboard navigation, the existing skip-to-content link, or existing nav counters.

## Non-goals

- Redesigning any other view.
- Changing the routing/view-switching logic itself, only its presentation.
- Building new collapse logic if a working mobile toggle already exists and a desktop collapse isn't explicitly requested elsewhere — check current behavior first and keep this minimal if in doubt, report your reasoning in KNOWN_ISSUES.

## Implementation constraints

- Preserve public component props (`SidebarProps`).
- Follow existing naming/class conventions in `index.css`.
- Follow existing error handling (none new needed here).
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.

## Interface / contract

`Sidebar` component props and the `REGISTRY_VIEWS` navigation contract with the rest of the app (`activeView`, `setActiveView`) must not change.

## Dependencies

- Upstream: M029
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M031-sidebar-v2
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server, visually confirm sidebar in both themes, confirm active pill + status dots render, confirm reduced-motion disables the pulse (emulate via devtools), then stop the server
- Nav text contrast re-measured ≥4.5:1

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- contrast re-measurement for nav text
- limitations or failures

## Completion criteria

- all requirements implemented
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
