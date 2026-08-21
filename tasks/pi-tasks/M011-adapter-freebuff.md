# M011 — Implement FreeBuff adapter (GenericAdapter, keyed MCP)

## Identity

- Task ID: M011
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 690c44c
- Branch: pi/M011-adapter-freebuff
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff
- Type: feature
- Priority: P1
- Dependencies: none (M012/M013/M014 also touch the shared registry files and must integrate sequentially after this one — do not start them until M011 is merged)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff`

Work ONLY within these repository paths:

- `packages/core/src/adapters/freebuff.ts` (new file — create it)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not redesign the architecture — this is a mechanical parameterization of the existing `GenericAdapter`, the same pattern already used for Pi/Junie/Gemini.

Do not broaden scope.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

FreeBuff is a real, MCP-capable coding agent CLI (npm package `freebuff`,
built on the Codebuff platform) with no adapter registered today —
`packages/core/src/agent-catalog.json` has a catalog-only entry for it (no
adapter), and its `note` field ("No API key, account, or config file needed")
is misleading marketing copy, not accurate. Verified primary-source research
already exists at `research/agent-research-freebuff.md` (task M007) — this
task turns that research into a real, registered adapter.

## Current state

From `research/agent-research-freebuff.md` (read the full file — this is
your primary specification):

- Config dir: `~/.config/manicode/` (yes, "manicode" — a Codebuff/Manicode
  legacy name; `settings.json` inside it holds `{ mode, adsEnabled,
  freebuffModel, ... }`).
- MCP config: **standard `mcpServers` keyed shape**, read from `.agents/mcp.json`
  files at (in override order) `{cwd}/.agents/mcp.json`,
  `{cwd}/../.agents/mcp.json`, then `{homedir}/.agents/mcp.json`.
- No BYOK / custom provider surface exists in the CLI at all — the model is
  always one of a small curated Freebuff-served catalog.
- `packages/core/src/agent-catalog.json` already has a `freebuff` entry
  (catalog-only, no `settingsPaths`) — you will extend it, not create it from
  scratch.

## Target state

A new `packages/core/src/adapters/freebuff.ts` exporting
`createFreebuffAdapter()`, built via `createGenericAdapter()` (see
`packages/core/src/adapters/junie.ts` and `packages/core/src/adapters/pi.ts`
for the exact pattern to mirror), registered in
`packages/core/src/adapters/index.ts`, with `packages/core/src/agent-catalog.json`'s
`freebuff` entry updated to add a `settingsPaths` field (config-based
detection even when the binary is absent, same pattern already used for
`gemini`/`reasonix`).

## Read first

### Current code (read fully before writing anything)

- `research/agent-research-freebuff.md` — your primary spec; every path/shape
  claim in it is sourced and verified
- `packages/core/src/adapters/junie.ts` — the closest structural analog:
  `GenericAdapter`, separate MCP file, keyed shape, `modelProviders: false`
- `packages/core/src/adapters/pi.ts` — second closest analog, same shape
- `packages/core/src/adapters/generic.ts` — read `GenericAdapterOptions` (the
  options interface) and `encodeMCP`/`decodeMCPRaw` (~lines 54-77, 170-280) so
  you understand exactly what the keyed shape does and does NOT need you to
  handle (the merge-preserving logic for unknown per-entry fields already
  exists — you are not writing new merge logic, only supplying paths/options)
- `packages/core/src/adapters/index.ts` — the registration map (`adapters =
  new Map(...)`) and the `export` list at the top of the file
- `packages/core/src/agent-catalog.json` — the existing `freebuff` entry, and
  the `reasonix`/`gemini` entries as examples of a `settingsPaths` field
  shape

## Allowed scope

- `packages/core/src/adapters/freebuff.ts` (new file)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

## Forbidden scope

- `packages/core/src/adapters/generic.ts` (read-only — its existing
  `GenericAdapterOptions`/merge logic already supports everything this task
  needs; if you find it genuinely doesn't, STOP and report BLOCKED rather
  than modifying shared adapter machinery)
- any other adapter file (`junie.ts`, `pi.ts`, `gemini.ts`, `kilo.ts`,
  `omp.ts`, `opencode-style.ts`, `codex.ts`, `claude-code.ts`)
- `packages/gui/src/**`, `packages/cli/src/**`
- any other file
- unrelated refactors, dependency upgrades, architecture changes,
  formatting-only changes outside touched code

## Exact requirements

1. Create `packages/core/src/adapters/freebuff.ts` exporting
   `createFreebuffAdapter(): AgentAdapter`, built via `createGenericAdapter()`
   with:
   - `id: 'freebuff'`, `name: 'FreeBuff'`, `binaries: ['freebuff']`
   - `configPath`/`configPaths`: `~/.config/manicode/settings.json` on all
     three platforms (there is no Windows-specific path documented in the
     research — use the same `~/.config/manicode/settings.json` shape;
     resolve `~` the same way other adapters do)
   - `mcpPath`/`mcpConfigPaths`: **`~/.agents/mcp.json`** (the home/global
     scope only — do NOT attempt to materialize into the project-relative
     `.agents/mcp.json` locations; a registry-based config manager manages
     the global scope, and per-project scope is out of this task's bound —
     if you disagree after reading the research file, report your reasoning
     in the final report rather than silently changing scope)
   - `format: 'json'`, `mcpShape: 'keyed'`
   - `supports: { modelProviders: false, mcpServers: true, permissions:
     false, projectConfig: false }` (no BYOK exists — do not add provider
     write support)
2. Register the new adapter in `packages/core/src/adapters/index.ts`:
   add the `createFreebuffAdapter` export, import it, and add
   `['freebuff', createFreebuffAdapter]` to the `adapters` Map, following the
   exact existing pattern for every other entry (alphabetize consistently
   with the existing ordering style — match whatever ordering convention is
   already there, do not invent a new one).
3. Update the `freebuff` entry in `packages/core/src/agent-catalog.json`:
   add a `settingsPaths` field (darwin/linux/win32) pointing at
   `~/.config/manicode/settings.json`, so config-based detection works even
   when the binary isn't installed (mirror the `reasonix` or `gemini` entry's
   `settingsPaths` shape exactly).
4. Do not add any UI/GUI changes — this task is core-only. A later task will
   wire the GUI's "Install / Available" list and MCP management surface to
   pick it up automatically (the existing GUI already renders any registered
   adapter generically per the shipped #11 feature — verify this claim by
   reading `packages/gui/src/components/AgentsView.tsx` if you're unsure, but
   do not edit it).

## Non-goals

- Any GUI changes.
- Model/provider write support (none exists to support).
- Project-scoped `.agents/mcp.json` materialization.
- Modifying `generic.ts` or any other existing adapter.

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow existing naming and module conventions exactly (compare against
  `junie.ts`/`pi.ts` file structure: header doc comment citing sources, a
  `_PATHS` const if needed, the `createXAdapter()` factory function).
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.

## Interface / contract

- `AgentAdapter`, `GenericAdapterOptions`, `createGenericAdapter` — existing
  contracts, do not change their shape.
- The `adapters` Map in `index.ts` — add one entry, do not restructure it.

## Dependencies

- Upstream: none
- Downstream: M012 (Cline), M013 (Reasonix), M014 (Goose) all touch
  `adapters/index.ts` and `agent-catalog.json` too — they must not start until
  this task is merged to `main`.

## Verification

Run (this worktree needs its own install first):

```bash
pnpm install --frozen-lockfile
pnpm --filter @ai-agent-config/core build
pnpm --filter @ai-agent-config/core typecheck 2>&1 || pnpm --filter @ai-agent-config/core exec tsc --noEmit
```

Also verify:

- `git status --short` — changed files are exactly the three allowed paths
  (plus the new file)
- `python3 -c "import json,sys; json.load(open('packages/core/src/agent-catalog.json'))"`
  to confirm the catalog JSON is still valid
- Write a small throwaway Node/ts-node script (or use `pnpm --filter
  @ai-agent-config/core exec node -e "..."`) that imports
  `listAvailableAdapters` from the built `dist/` (after `pnpm build`) and
  confirms `'freebuff'` appears in the returned list with the expected
  `configPaths`/`mcpConfigPaths` — paste the real output. Delete the
  throwaway script before finishing (confirm `git status --short` is clean
  of it).

## Expected evidence

The final report must include:

- exact commands executed
- real output or relevant excerpts
- files changed
- the throwaway verification script's real output showing freebuff registered
- limitations or failures

## Completion criteria

The task is complete only when:

- all requirements are implemented
- no non-goal behavior was changed
- scope is respected (exactly the 3 allowed paths + the new file)
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
