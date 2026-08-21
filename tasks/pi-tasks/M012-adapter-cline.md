# M012 — Implement Cline adapter (GenericAdapter, keyed MCP)

## Identity

- Task ID: M012
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: (resolve to the merge commit of M011 on `main` at dispatch time — do not dispatch this task until M011 is merged)
- Branch: pi/M012-adapter-cline
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M012-adapter-cline
- Type: feature
- Priority: P1
- Dependencies: M011 (must be merged to `main` first — this task's worktree is created from `main` AFTER that merge, so `adapters/index.ts`/`agent-catalog.json` already contain M011's freebuff entry; do not remove or conflict with it)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M012-adapter-cline`

Work ONLY within these repository paths:

- `packages/core/src/adapters/cline.ts` (new file — create it)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not redesign the architecture — this is a mechanical parameterization of the existing `GenericAdapter`.

Do not broaden scope.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

Cline now ships a real, first-party terminal CLI (npm package `cline`) with
first-class MCP support, but has no registered adapter today — it appears
only as an unconfirmed guess in `docs/agent-cli-inventory.md` and has no
`agent-catalog.json` entry at all. Verified primary-source research already
exists at `research/agent-research-cline.md` (task M009) — this task turns
that research into a real, registered adapter.

## Current state

From `research/agent-research-cline.md` (read the full file — this is your
primary specification):

- Cline's declarative, hand-editable config surface is: global `~/.cline/`
  tree (with settings under `~/.cline/data/settings/` — **this is app state,
  not a single config file a config manager should read/write**) and MCP at
  the **separate global file `~/.cline/mcp.json`**, standard keyed
  `mcpServers` shape with extra per-entry fields (`disabled`, `autoApprove`,
  `type`, `headers`, `env`).
- Provider/auth is managed via `cline auth` + a 0600 `secrets.json` — not a
  declarative file a config manager should author.
- No `cline` entry exists yet in `packages/core/src/agent-catalog.json` —
  you will create one, not extend an existing one (contrast with M011's
  freebuff, which already had a catalog entry).

## Target state

A new `packages/core/src/adapters/cline.ts` exporting `createClineAdapter()`,
built via `createGenericAdapter()` (mirror `packages/core/src/adapters/junie.ts`
and `packages/core/src/adapters/pi.ts`), registered in
`packages/core/src/adapters/index.ts`, with a **new** `cline` entry added to
`packages/core/src/agent-catalog.json` (there is no existing entry to extend).

## Read first

### Current code (read fully before writing anything)

- `research/agent-research-cline.md` — your primary spec
- `packages/core/src/adapters/junie.ts` — closest structural analog
- `packages/core/src/adapters/pi.ts` — second closest analog
- `packages/core/src/adapters/generic.ts` — `GenericAdapterOptions` and the
  keyed-shape `encodeMCP`/`decodeMCPRaw` merge logic (you are not modifying
  this file; read it to confirm it already preserves `disabled`/`autoApprove`
  on merge — it does, via the `...prior` spread in `encodeMCP`)
- `packages/core/src/adapters/index.ts` — registration map and exports
- `packages/core/src/agent-catalog.json` — read 2-3 full existing entries
  (e.g. `junie`, `kilo`) as the exact template for the new `cline` entry you
  will add: fields are `id`, `name`, `description`, `status`, `source`,
  `addedAt`, `binaries`, `settingsPaths`, `install`, `uninstall`, and
  optionally `note`

## Allowed scope

- `packages/core/src/adapters/cline.ts` (new file)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

## Forbidden scope

- `packages/core/src/adapters/generic.ts` (read-only)
- any other adapter file
- `packages/gui/src/**`, `packages/cli/src/**`
- any other file
- unrelated refactors, dependency upgrades, architecture changes,
  formatting-only changes outside touched code

## Exact requirements

1. Create `packages/core/src/adapters/cline.ts` exporting
   `createClineAdapter(): AgentAdapter`, via `createGenericAdapter()` with:
   - `id: 'cline'`, `name: 'Cline'`, `binaries: ['cline']`
   - `configPath`/`configPaths`: point at `~/.cline/mcp.json` for ALL of
     configPath/mcpPath — i.e. since there is no separate declarative
     "main config" file worth reading/writing (settings live in app-state
     `data/settings/`, not a clean JSON file), use the MCP file as both the
     nominal config path and the MCP path, exactly matching how
     `supports.modelProviders: false` already means the main config is
     barely touched in `pi.ts`/`junie.ts`. If you find evidence of a real,
     separate, safely-editable main config file while researching further,
     report it in your final report instead of guessing — but do not spend
     time re-deriving what `research/agent-research-cline.md` already
     answered.
   - `mcpPath`/`mcpConfigPaths`: `~/.cline/mcp.json` on all platforms
   - `format: 'json'`, `mcpShape: 'keyed'`
   - `supports: { modelProviders: false, mcpServers: true, permissions:
     false, projectConfig: false }`
2. Register the new adapter in `packages/core/src/adapters/index.ts`,
   following the exact existing pattern (export, import, add to the
   `adapters` Map) — do not remove or reorder unrelated entries, including
   the `freebuff` entry M011 added.
3. Add a **new** `cline` entry to `packages/core/src/agent-catalog.json`,
   matching the exact field shape of existing entries (`id`, `name`,
   `description`, `status: "beta"`, `source: "https://github.com/cline/cline"`,
   `addedAt` — use today's date in `YYYY-MM-DD` matching the format already
   used by other entries, `binaries: ["cline"]`, `settingsPaths` pointing at
   `~/.cline/mcp.json` for darwin/linux/win32, `install: "npm install -g
   cline"`, `uninstall: "npm uninstall -g cline"`). Do not remove or reorder
   any existing catalog entries.
4. Do not add any GUI changes.

## Non-goals

- Any GUI changes.
- Model/provider write support.
- Reading/writing `~/.cline/data/` (app state — never touch this path).

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow existing naming and module conventions exactly.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.

## Interface / contract

- `AgentAdapter`, `GenericAdapterOptions`, `createGenericAdapter` — existing
  contracts, do not change their shape.
- The `adapters` Map and `agent-catalog.json`'s array/object shape — add one
  entry each, do not restructure.

## Dependencies

- Upstream: M011 (must be merged first)
- Downstream: M013 (Reasonix), M014 (Goose) touch the same shared files and
  must not start until this task is merged

## Verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @ai-agent-config/core build
```

Also verify:

- `git status --short` — changed files are exactly the three allowed paths
  (plus the new file)
- `python3 -c "import json,sys; json.load(open('packages/core/src/agent-catalog.json'))"`
- A throwaway verification script (same approach as M011) confirming
  `'cline'` appears in `listAvailableAdapters()`'s output with the expected
  paths — paste real output, then delete the script and confirm
  `git status --short` is clean of it.

## Expected evidence

The final report must include:

- exact commands executed
- real output or relevant excerpts
- files changed
- the throwaway verification script's real output showing cline registered
- limitations or failures

## Completion criteria

The task is complete only when:

- all requirements are implemented
- no non-goal behavior was changed
- scope is respected
- required verification passes
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
