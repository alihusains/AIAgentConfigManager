# M013 — Implement Reasonix adapter (bespoke TOML, same-file MCP)

## Identity

- Task ID: M013
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: (resolve to the merge commit of M012 on `main` at dispatch time — do not dispatch until M012 is merged)
- Branch: pi/M013-adapter-reasonix
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M013-adapter-reasonix
- Type: feature
- Priority: P1
- Dependencies: M011, M012 (must both be merged to `main` first — this task's worktree is created from `main` AFTER those merges)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M013-adapter-reasonix`

Work ONLY within these repository paths:

- `packages/core/src/adapters/reasonix.ts` (new file — create it)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies (the `toml` package is already a
dependency of `packages/core` — used by `codex.ts` — do not add another TOML
library).

Do not modify `packages/core/src/utils/index.ts`, `generic.ts`, or `codex.ts` —
read them, don't edit them. If you find you genuinely need a shared helper
change to do this correctly, STOP and report BLOCKED with exactly what's
missing, rather than editing shared machinery.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

Reasonix is a real, MCP-capable coding agent CLI in
`packages/core/src/agent-catalog.json` (catalog-only, no real adapter). Its
main config is **TOML**, which `GenericAdapter` cannot parse (it only
supports `'json' | 'jsonc'`), but the repo already has a **working, precedent
TOML adapter**: `packages/core/src/adapters/codex.ts`, using the shared
`parseConfig(content, 'toml')` / `stringifyConfig(obj, 'toml')` helpers from
`packages/core/src/utils/index.ts` (which wrap the already-installed `toml`
npm package). This task is a bespoke adapter closely modeled on `codex.ts`'s
structure, not a `GenericAdapter` parameterization.

Verified primary-source research already exists at
`research/agent-research-reasonix.md` (task M006) — read it fully; it is
your primary specification for Reasonix's exact schema.

## Current state

From `research/agent-research-reasonix.md` (do not re-derive these — they
are already verified against Reasonix's actual source code):

- Global config: `~/.reasonix/config.toml` (darwin/linux), `%APPDATA%\reasonix\config.toml`
  (Windows). The `~/.reasonix/config.json` path is a read-only legacy
  fallback — never a write target.
- MCP servers are `[[plugins]]` array-of-tables **in the same file**. Each
  entry: `name` (required), `command`+`args`+`env` for stdio (default
  transport), or `type = "http"|"sse"` + `url` + `headers` for remote, plus
  optional `startup_timeout_seconds`/`call_timeout_seconds`/`tool_timeout_seconds`/
  `concurrency`/`auto_start`.
- Field-for-field compatible with the standard `mcpServers` shape (command,
  args, env, url, headers) — only the container differs: TOML array of
  tables (`[[plugins]]`), not a keyed JSON object.
- Provider credentials live in a separate `.env` file next to the config —
  **never write API keys into `config.toml`**.
- `packages/core/src/agent-catalog.json` already has a `reasonix` entry with
  an inaccurate `settingsPaths` (lists both `.json` and `.toml`) — you will
  correct it, not create a new entry.

## Target state

A new `packages/core/src/adapters/reasonix.ts` exporting
`createReasonixAdapter(): AgentAdapter`, structured like `codex.ts` (full
manual `AgentAdapter` implementation, not `GenericAdapter`), that:

- reads/writes `~/.reasonix/config.toml` via `parseConfig`/`stringifyConfig`
  with `'toml'`
- exposes the `[[plugins]]` array as this app's unified `MCPServerConfig[]`
  (map `name`→`name`, stdio `command`/`args`/`env`, remote `url`/`headers`/
  `type`)
- preserves every other key in the parsed TOML object verbatim on write
  (providers, ui, permissions, sandbox, anything else) — read the object,
  mutate only the `plugins` array, write the whole object back, exactly the
  pattern `codex.ts` already uses for its own unknown-key preservation
- never writes to the `.env` credential file and never reads/writes provider
  API keys into `config.toml`
- is registered in `packages/core/src/adapters/index.ts` and has a corrected
  `agent-catalog.json` entry

## Read first

### Current code (read fully before writing anything)

- `research/agent-research-reasonix.md` — your primary spec (§2 "MCP server
  support" has the exact TOML shape and the `PluginEntry` field list; §6 has
  the exact catalog corrections)
- `packages/core/src/adapters/codex.ts` — the structural template: how it
  implements the full `AgentAdapter` interface, reads/writes TOML via
  `parseConfig`/`stringifyConfig`, and preserves unrelated keys (its
  `sortForTOML` helper is codex-specific key-ordering — you do not need to
  replicate that exact function, but do preserve whatever ordering approach
  keeps the TOML serializer's array-of-tables output valid and stable)
- `packages/core/src/utils/index.ts` — `parseConfig`/`stringifyConfig`
  (~lines 442-468) and `readFileSafe` — the exact functions you will call
- `packages/core/src/types/index.ts` — the full `AgentAdapter` interface
  (~lines 166-202) you must implement, and `AgentInfo`/`AgentCapabilities`/
  `MCPServerConfig`/`ModelProvider`/`ModelConfig`/`PermissionConfig` shapes
- `packages/core/src/adapters/index.ts` — registration map and exports
- `packages/core/src/agent-catalog.json` — the existing (inaccurate)
  `reasonix` entry you will correct

## Allowed scope

- `packages/core/src/adapters/reasonix.ts` (new file)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

## Forbidden scope

- `packages/core/src/utils/index.ts`, `packages/core/src/adapters/generic.ts`,
  `packages/core/src/adapters/codex.ts` (all read-only reference)
- any other adapter file
- `packages/gui/src/**`, `packages/cli/src/**`
- any other file
- unrelated refactors, dependency upgrades, architecture changes,
  formatting-only changes outside touched code

## Exact requirements

1. Implement `listMCPServers`/`addMCPServer`/`removeMCPServer`/
   `updateMCPServer` against the `[[plugins]]` array, mapping this app's
   `MCPServerConfig` fields to/from `PluginEntry` fields per
   `research/agent-research-reasonix.md` §2. `addMCPServer`/`updateMCPServer`
   must preserve any Reasonix-specific fields already present on an existing
   entry (timeouts, `concurrency`, `auto_start`) when only common fields are
   being changed — same "merge, don't clobber" principle `generic.ts` already
   uses for its keyed shape.
2. Implement `readConfig`/`writeConfig`/`getConfigPath`/`validateConfig`
   against `~/.reasonix/config.toml`, preserving every other top-level
   section verbatim across a read-modify-write cycle.
3. Set `supports: { modelProviders: false, mcpServers: true, permissions:
   false, projectConfig: false }` — provider config lives partly in
   `config.toml` (`[[providers]]`, non-secret fields) per the research, but
   credentials are in `.env`; **do not implement provider write support in
   this task** — keep it out of scope and `modelProviders: false`, since
   partial provider support without secret handling would be worse than none.
   If you believe read-only provider listing is safe and valuable, note it
   as a FOLLOW_UP recommendation instead of implementing it.
4. `listModelProviders`/`addModelProvider`/etc., `listModels`/etc., and
   `listPermissions`/etc. should behave consistently with
   `supports.modelProviders: false` / `supports.permissions: false` (see how
   `omp.ts` or `pi.ts` handle unsupported capability methods — either return
   empty lists / throw a clear "not supported for this agent" error,
   whichever matches the codebase's existing convention for an unsupported
   capability; check codex.ts's own patterns for methods it does support vs.
   not).
5. `backupConfig`/`restoreConfig`: implement against `config.toml` (copy the
   file), matching whatever pattern the interface implies elsewhere in the
   codebase (check `codex.ts` or `generic.ts` for the existing backup
   convention).
6. Register in `packages/core/src/adapters/index.ts` (export + import + Map
   entry), without disturbing the `freebuff`/`cline` entries added by M011/M012.
7. Correct the `reasonix` entry in `packages/core/src/agent-catalog.json` per
   `research/agent-research-reasonix.md` §6: `settingsPaths` becomes
   `~/.reasonix/config.toml` (darwin/linux) and `%APPDATA%\reasonix\config.toml`
   (win32) — remove the `.json` candidate from the write-target list (it may
   stay as a comment/note if useful, but must not be a `settingsPaths` entry
   since writes must never target it).

## Non-goals

- Any GUI changes.
- Model/provider write support (see requirement 3).
- Reading or writing the `.env` credential file.
- Project-level `./reasonix.toml` support (global scope only, matching this
  tool's registry-first model — same scoping decision made for FreeBuff in
  M011).

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow `codex.ts`'s existing structure/conventions as closely as makes
  sense for Reasonix's different schema.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.
- No new dependencies.

## Interface / contract

- Implement the full `AgentAdapter` interface (`packages/core/src/types/index.ts`
  ~lines 166-202) — every method must exist and behave sensibly for
  Reasonix's actual capabilities.
- `parseConfig`/`stringifyConfig` signatures are the existing contract — call
  them, do not change them.

## Dependencies

- Upstream: M011, M012 (must be merged first)
- Downstream: M014 (Goose) touches the same shared files and must not start
  until this task is merged

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
- A throwaway script/test (delete before finishing) that: constructs the
  reasonix adapter, calls `readConfig`/`listMCPServers` against a small
  hand-written sample `config.toml` (matching the shape in
  `research/agent-research-reasonix.md`'s `[[plugins]]` example) written to
  a temp file, confirms the parsed servers match expectations, then calls
  `addMCPServer`/`writeConfig` and re-reads to confirm the round-trip
  preserves unrelated TOML sections and produces valid TOML (parse it back
  with `parseConfig(..., 'toml')` to confirm it's syntactically valid) —
  paste the real output. This is a real functional check, not just a
  typecheck — do not skip it.

## Expected evidence

The final report must include:

- exact commands executed
- real output or relevant excerpts
- files changed
- the round-trip verification script's real output
- limitations or failures (e.g. anything about `[[plugins]]` you couldn't
  fully verify without a real Reasonix install)

## Completion criteria

The task is complete only when:

- all requirements are implemented
- no non-goal behavior was changed
- scope is respected
- required verification passes, including the real round-trip check
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
