# M019 — Bigger agent icon/logo tiles across the GUI

## Identity

- Task ID: M019
- Parent workstream: agents-tab-revamp-2
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: working tree HEAD (1b6a3d7 + uncommitted changes already in the tree — do not discard them)
- Branch: none — sequential execution directly in the repository (no worktree isolation for this task)
- Worktree: none (main checkout)
- Type: refactor
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager`

Work ONLY within these repository paths:

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/components/Dashboard.tsx`
- `packages/gui/src/components/AgentPicker.tsx`
- `packages/gui/src/components/Breadcrumbs.tsx`

Do NOT touch `packages/gui/src/components/AgentsView.tsx` — a separate task
(M025) already owns icon sizing there together with a larger table redesign;
touching it here would create a merge conflict.

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work —
the working tree already has many other uncommitted changes from earlier
work; leave everything outside your allowed scope untouched.

Do not introduce new dependencies.

Do not redesign the architecture — this is a pure sizing change.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The user reviewed the running GUI and said the per-agent icon/logo tiles are
too small across the app. `AgentIconTile` (in
`packages/gui/src/components/AgentIcon.tsx`, already correct, do not modify
it) renders either the agent's real brand logo (from `packages/gui/public/logos/`)
or a colored fallback glyph, sized via its `size`/`iconSize` props. The
call sites listed above currently pass small size values.

## Current state

- `Sidebar.tsx`: the "Detected Agents" nav list renders `<AgentIconTile icon={...} id={agent.id} size={22} iconSize={14} />` per row.
- `Dashboard.tsx`: the "Agents on this machine" table renders `<AgentIconTile id={agent.id} size={32} />` per row.
- `AgentPicker.tsx`: the install-target popover renders `<AgentIconTile id={agent.id} size={18} iconSize={12} />` per row.
- `Breadcrumbs.tsx`: renders `<AgentIconTile icon={agentIcon} id={selectedAgentId || ''} size={18} />` in the current-page breadcrumb, and `<AgentIconTile icon={icon} id={agentId} size={64} />` is used elsewhere in `AgentDetailView.tsx` (do not touch that file — its size is already appropriately large).

## Target state

Every listed call site's tile is visibly larger, in proportion to its
container, without breaking layout (no overlap, no clipping, no text
truncation caused by the icon eating more horizontal space than the
container can spare):

- `Sidebar.tsx` nav-item row: `size={28}` `iconSize={17}` (fits inside the
  existing `.nav-item` 10px vertical padding without increasing the row's
  height so much that the sidebar becomes visually heavier than the rest of
  the app — verify it still looks correct, adjust by a few px if 28 causes
  visible overlap with the `on`/`—` badge on the right).
- `Dashboard.tsx` "Agents on this machine" table, Agent column:
  `size={40}` (no `iconSize` override needed — the component computes a
  sensible default from `size`).
- `AgentPicker.tsx` popover row: `size={22}` `iconSize={15}`.
- `Breadcrumbs.tsx` current-page breadcrumb tile: `size={22}` (was 18).

## Read first

### Current code

- `packages/gui/src/components/AgentIcon.tsx` (read-only reference — do not
  modify; understand `AgentIconTile`'s `size`/`iconSize` props and how the
  tinted background/border scale)
- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/components/Dashboard.tsx`
- `packages/gui/src/components/AgentPicker.tsx`
- `packages/gui/src/components/Breadcrumbs.tsx`
- `packages/gui/src/index.css` — read the `.nav-item`, `.nav-item-icon`,
  `.agent-icon-tile` rules to understand surrounding layout constraints
  before changing sizes; do not edit CSS unless a listed size change causes
  a real visual break that CSS alone can fix (e.g. `.nav-item` gap), in
  which case make the smallest possible CSS adjustment in
  `packages/gui/src/index.css` and say exactly what you changed and why in
  the final report.

## Allowed scope

- `packages/gui/src/components/Sidebar.tsx`
- `packages/gui/src/components/Dashboard.tsx`
- `packages/gui/src/components/AgentPicker.tsx`
- `packages/gui/src/components/Breadcrumbs.tsx`
- `packages/gui/src/index.css` (only if strictly necessary per "Target state" note above)

## Forbidden scope

- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/components/AgentIcon.tsx`
- `packages/gui/src/components/AgentDetailView.tsx`
- any other file
- unrelated refactors
- dependency upgrades
- architecture changes
- formatting-only changes outside touched code (do not run a formatter over
  whole files — change only the specific size props/lines)

## Exact requirements

1. Update the four size values exactly as specified in "Target state".
2. If (and only if) a size bump visibly breaks layout, make the smallest
   possible CSS fix and document it.
3. Do not change any other prop, any unrelated markup, or any logic.

## Non-goals

- Redesigning any of these components beyond the icon size.
- Touching the Agents tab table (that's M025).
- Changing `AgentIcon.tsx`'s API or defaults.

## Implementation constraints

- Preserve public component APIs.
- Follow existing naming and module conventions.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.

## Interface / contract

No interface changes. `AgentIconTile({ icon?, id?, size?, iconSize? })`
signature stays exactly as-is.

## Dependencies

- Upstream: none
- Downstream: none (M025 handles AgentsView.tsx independently)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
pnpm --filter @ai-agent-config/gui run typecheck
pnpm --filter @ai-agent-config/gui run build
```

Also verify:

- `git status --short` shows changes ONLY in the allowed-scope files
- `git diff --name-only` matches the allowed scope exactly
- the four size values match "Target state" exactly

## Expected evidence

The final report must include:

- exact commands executed
- real output of both verification commands
- files changed (`git diff --name-only`)
- confirmation that no file outside allowed scope changed
- any CSS adjustment made and why, if applicable

## Completion criteria

The task is complete only when:

- all four size changes are made as specified
- no non-goal behavior changed
- scope is respected
- `typecheck` and `build` both pass
- the diff has been reviewed for accidental changes
- no unresolved issue remains

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
