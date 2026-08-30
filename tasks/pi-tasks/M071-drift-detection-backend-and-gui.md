# M071 — Drift detection: detect out-of-band agent config edits, offer re-sync

## Identity

- Task ID: M071
- Parent workstream: v0.4 roadmap item ("Drift detection watcher — agents edited configs outside the tool? Show a diff, offer re-sync")
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M071-drift-detection
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M071-drift-detection
- Type: feature
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M071-drift-detection`

Work ONLY within these repository paths:

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts` (new file, or extend an existing `AgentConfigManager`-focused test file if one already exists — check first)
- `packages/cli/src/gui-server.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/index.css` (drift-indicator rules only)
- `packages/gui/src/smoke.test.tsx`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

`ROADMAP.md`'s v0.4 section names this exact gap: "Drift detection watcher — agents edited configs outside the tool? Show a diff, offer re-sync (registry → agent, or agent → registry 'import')." Today, if a user (or the underlying CLI tool itself, e.g. via its own `/login` flow) edits a registry-managed provider or MCP server directly inside an agent's own config file, this tool has no way to notice — the registry silently believes it still matches what is on disk. This task adds detection and a manual re-sync action; it deliberately does NOT attempt the "agent → registry" adoption direction (importing the agent's edited version back into the registry) — that direction already exists conceptually via each adapter's own `readConfig` + the existing `migrateFromAgentConfigs` merge-import path, and is out of scope here to keep this task shippable.

## Current state

Read `packages/core/src/index.ts`'s private `materializeAgent` method in full (search for it). It already computes, for one agent: `current` (the agent's actual on-disk config via `adapter.readConfig()`) and a `merged` config (what the registry says SHOULD be materialized into that agent, built from `targetedProviders`/`targetedServers` filtered to this agent's `agentIds`). Read how `modelProviders`, `models`, and `mcpServers` are assembled in `merged` — this is the exact target-state computation drift detection needs to compare against `current`, WITHOUT writing anything.

## Target state

A new core method, e.g.:

```ts
async detectDrift(agentId: string): Promise<{
  agentId: string;
  drifted: boolean;
  changedProviders: string[]; // registry-managed provider ids present with different content on disk, or missing
  changedServers: string[];   // registry-managed MCP server names, same idea
  error?: string;
}>
```

Behavior:
- Reuses `materializeAgent`'s exact target-state computation logic (extract the shared "compute what should be materialized for this agent" logic into a private helper both `materializeAgent` and `detectDrift` call — do not duplicate the provider/server assembly logic, and do not change `materializeAgent`'s own write behavior or its existing tests).
- Compares ONLY the registry-managed subset (the provider ids / server names the registry believes it owns for this agent) between the computed target state and `adapter.readConfig()`'s actual current state — deep-equal comparison (JSON-stable, ignore key ordering) is enough; do not attempt a line-level text diff.
- Agent-local entries (not registry-managed) are never compared — drift is only about registry-managed entries silently changing or disappearing.
- Detect-only agents (the ones `materializeAgent` already skips) report `drifted: false` with no error.
- This is 100% user-triggered (an explicit "Check for drift" action or automatic-on-agent-page-load — your call, but if automatic, it must be cheap: reading each agent's config file, no network calls, and must not run on a timer/interval).

Add one HTTP route to `gui-server.ts`: `GET /api/agents/:id/drift`.

In `AgentsView.tsx`: a per-agent indicator (badge, matching the existing conventions this file already uses for other status badges) that shows when drift is detected, with a tooltip naming which providers/servers changed. A "Re-sync" action next to it that calls the EXISTING re-materialize path (find the existing sync/materialize API call already used elsewhere in this file or `api.ts` — reuse it, do not add a new write endpoint in this task) to push the registry's version back over the agent's file. Keep this intentionally simple: a badge + tooltip + button is enough; no diff-viewer modal in this task (that is a reasonable follow-up, not required here).

## Read first

### Current code

- `packages/core/src/index.ts` (`materializeAgent` in full, and `syncAgents` for the existing re-sync entry point to reuse from the GUI)
- `packages/cli/src/gui-server.ts` (existing `/api/agents/*` routes and the existing sync/materialize route, for conventions)
- `packages/gui/src/api.ts` (existing sync-related calls)
- `packages/gui/src/components/AgentsView.tsx` (existing badge patterns, e.g. the M070 MCP-server-count badge, for the exact visual convention to match)

### Tests

- Core: a new test (or extension of an existing `AgentConfigManager` test file) covering: no drift when the agent's file matches the registry; drift detected when a registry-managed provider's on-disk value changes; drift detected when a registry-managed provider disappears from the agent's file entirely; no drift reported for changes to agent-local (non-registry-managed) entries; detect-only agents always report no drift.
- GUI: `smoke.test.tsx` — the drift badge appears only when the mocked API reports drift; the re-sync button calls the existing sync endpoint and the badge clears on success.

## Allowed scope

- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts` (or the correct existing test file for `AgentConfigManager` — your call)
- `packages/cli/src/gui-server.ts`
- `packages/gui/src/api.ts`
- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/index.css` (drift-indicator rules only)
- `packages/gui/src/smoke.test.tsx`

## Forbidden scope

- `materializeAgent`'s own write behavior and its existing call sites/tests (read/reuse its computation, do not change what it writes or when)
- Any other component file
- `packages/core/src/adapters/**` (consume `adapter.readConfig()` as-is)

## Exact requirements

1. `detectDrift` reuses `materializeAgent`'s target-state computation via a shared helper, no duplicated logic.
2. Only registry-managed entries are compared; agent-local entries never trigger a false positive.
3. One new read-only route; re-sync reuses the EXISTING write/materialize path, no new write endpoint.
4. GUI: simple badge + tooltip + re-sync button, matching existing visual conventions exactly.
5. Full core + cli + gui test suites green, with real new coverage for both the true-positive and false-positive drift cases.

## Non-goals

- No "agent → registry" adoption/import direction in this task.
- No diff-viewer modal (a plain list of changed provider ids/server names in a tooltip or small panel is enough).
- No automatic background polling for drift.

## Implementation constraints

- Reuse `materializeAgent`'s computation; extract shared logic rather than duplicating it.
- Reuse the existing sync/materialize write path for the GUI's re-sync button.
- Smallest correct diff.
- No speculative abstractions (no generic "diff engine").

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M071-drift-detection
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter agentcontrol test
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Real end-to-end (isolated `HOME`/`AI_CONFIG_HOME` — do not touch the real ones): register a provider for a real installed agent adapter, materialize it, manually hand-edit that agent's config file to change the provider's value, call the drift endpoint and confirm it reports drift naming that provider, click re-sync (or call the endpoint), confirm the file matches the registry again and drift clears

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- real end-to-end proof (drift induced, detected, named correctly, re-synced, cleared)
- limitations or failures

## Completion criteria

- drift detection reuses existing computation, has zero false positives on agent-local changes, full test suites green, real end-to-end proof

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
