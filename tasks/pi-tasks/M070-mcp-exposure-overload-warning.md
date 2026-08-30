# M070 — MCP exposure dashboard: per-agent server count + overload warning

## Identity

- Task ID: M070
- Parent workstream: Later/v0.4 roadmap item ("MCP exposure dashboard — tool counts per server + overload warning")
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M070-mcp-exposure-overload-warning
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M070-mcp-exposure-overload-warning
- Type: feature
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M070-mcp-exposure-overload-warning`

Work ONLY within these repository paths:

- `packages/gui/src/components/AgentDetailView.tsx`
- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/index.css` (warning-indicator rules only)
- `packages/gui/src/smoke.test.tsx`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

`ROADMAP.md` and `docs/epics/agentic-control-plane-redesign.md` both name "MCP exposure counts per agent + overload warning" as an outstanding item, and `ROADMAP.md`'s own success metrics already state the target: "median servers-per-agent ≤ 10". No live per-server tool-count introspection exists in this codebase (that would require connecting to each MCP server at runtime, which is a much bigger feature and conflicts with the app's no-background-network-calls design) — the honest, buildable version of this feature is a per-agent MCP **server** count with a visible warning once it crosses a sensible threshold. `AgentDetailView.tsx` already computes `mcpServers` (the list of MCP servers assigned to one agent, `registry.mcpServers` filtered by `agentIds.includes(agentId)`) and already renders `mcpServers.length` at a stat card (~line 264) and a badge (~line 383) — this task adds the warning layer on top of data that already exists, and surfaces the same count in the agents-overview table so it's visible without opening every agent's detail page.

## Current state

Read `packages/gui/src/components/AgentDetailView.tsx` in full, especially the `mcpServers` computation (~line 162) and its two current render sites (~line 264 stat card, ~line 383 badge). Read `packages/gui/src/components/AgentsView.tsx` in full — it currently does NOT show a per-agent MCP server count in its table; confirm this yourself before assuming it. Read `packages/gui/src/ui/Badge.tsx` for existing badge variants (there should already be a warning/danger variant used elsewhere in the app — reuse it, do not invent a new visual language).

## Target state

- Pick one clear threshold (your call, document your reasoning — e.g. "warning" above 10 servers per agent, matching the roadmap's own stated success metric, escalating to a stronger visual treatment above a higher count like 20 if that fits the existing badge variants; do not overengineer this into a configurable setting, a fixed constant is fine).
- In `AgentDetailView.tsx`: when an agent's `mcpServers.length` crosses the threshold, the existing stat card and badge (both already rendering this count) get a visible warning treatment (icon and/or color change via the existing warning badge variant) plus a short, honest tooltip/label explaining why (e.g. "N MCP servers assigned — high server counts can slow an agent down or overwhelm its tool-selection"). Do not fabricate a specific performance claim you cannot back up; phrase it as a caution, not a guaranteed fact.
- In `AgentsView.tsx`: add the same per-agent MCP server count to the main table (a small badge/number in an existing or new column, matching the table's current visual conventions exactly), with the same warning treatment when it crosses the threshold — this is the "at a glance across all agents" view the roadmap item is asking for.
- Both are pure client-side computations from data already in the registry state (`registry.mcpServers`, filtering by `agentIds`) — no new API route, no new backend computation needed.

## Read first

### Current code

- `packages/gui/src/components/AgentDetailView.tsx` (full file, the `mcpServers` computation and its two render sites)
- `packages/gui/src/components/AgentsView.tsx` (full file, current table structure/columns)
- `packages/gui/src/ui/Badge.tsx` (existing variants — reuse the warning one)

### Reference / specification

- `ROADMAP.md` (the "MCP exposure counts per agent + overload warning" line and the "median servers-per-agent ≤ 10" success metric)
- `docs/epics/agentic-control-plane-redesign.md`

### Tests

- `packages/gui/src/smoke.test.tsx` — add assertions: an agent below the threshold shows no warning; an agent above the threshold shows the warning treatment in both `AgentDetailView` and the `AgentsView` table; the count itself is accurate against a mocked registry fixture with a known number of MCP servers assigned to a test agent.

## Allowed scope

- `packages/gui/src/components/AgentDetailView.tsx`
- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/index.css` (warning-indicator rules only)
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `packages/core/**`, `packages/cli/**` (this is a pure client-side computation over data already returned by the existing registry API — no backend changes needed)
- Any other component file

## Exact requirements

1. Per-agent MCP server count visible in both `AgentDetailView` (already partially there — add the warning layer) and `AgentsView`'s main table (new).
2. One clear, documented threshold; warning treatment reuses the app's existing warning badge/color variant, not a new one.
3. Honest, non-alarmist copy — a caution, not a fabricated hard performance claim.
4. Full gui test suite green with real new coverage for the threshold logic.

## Non-goals

- No live MCP server introspection (connecting to servers to count their actual exposed tools) — server count is the honest, buildable proxy this task ships.
- No configurable threshold setting.
- No changes to how MCP servers are added/removed/assigned (M034/existing MCPView flows untouched).

## Implementation constraints

- Pure client-side computation, no new API surface.
- Reuse existing badge/warning UI primitives exactly.
- Smallest correct diff.

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M070-mcp-exposure-overload-warning
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Real end-to-end: start the GUI dev server against a registry with a real agent assigned more MCP servers than the threshold, confirm the warning renders in both `AgentDetailView` and `AgentsView`, confirm an agent below the threshold shows no warning

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- real end-to-end proof (above/below threshold, both views)
- limitations or failures

## Completion criteria

- warning implemented and demonstrated with real evidence in both views, honest copy, full test suite green

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
