# M014 — Implement Goose adapter (bespoke YAML, same-file extensions map)

## Identity

- Task ID: M014
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: (resolve to the merge commit of M013 on `main` at dispatch time — do not dispatch until M013 is merged)
- Branch: pi/M014-adapter-goose
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M014-adapter-goose
- Type: feature
- Priority: P2
- Dependencies: M011, M012, M013 (must all be merged to `main` first)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M014-adapter-goose`

Work ONLY within these repository paths:

- `packages/core/src/adapters/goose.ts` (new file — create it)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies (the `js-yaml` package is already a
dependency of `packages/core` — used via the shared `parseConfig`/
`stringifyConfig` helpers — do not add another YAML library).

Do not modify `packages/core/src/utils/index.ts`, `generic.ts`, `codex.ts`,
or `omp.ts` — read them, don't edit them. If you find you genuinely need a
shared helper change, STOP and report BLOCKED with exactly what's missing.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

Goose (Linux Foundation AAIF project) is MCP-capable with a clean,
serde-defined config schema, but has no adapter today. Its config is YAML,
which `GenericAdapter` doesn't parse — but the shared `parseConfig`/
`stringifyConfig` helpers in `packages/core/src/utils/index.ts` already
support `'yaml'` (full parse + stringify round-trip), and this repo's
existing `omp.ts` chose YAML **detect-only** specifically because OMP's
config is fragmented across three YAML files with cross-agent MCP
inheritance and no clean single schema. Goose does NOT have that problem: a
single config file (`config.yaml`) with a stable, fully-documented
`extensions:` map. **This task builds real MCP write support for Goose,
overriding the "detect-only" recommendation in
`research/agent-research-goose.md` §5** — that recommendation didn't have
visibility into this repo's own YAML round-trip capability; you are
implementing the lead's corrected decision, not the research file's opinion
section.

Verified primary-source research already exists at
`research/agent-research-goose.md` (task M008) — it is authoritative for
Goose's actual on-disk shape (ignore only its final "recommendation"
section, which this task file supersedes).

## Current state

From `research/agent-research-goose.md` (do not re-derive facts — only the
final adapter-shape opinion is superseded):

- Global config: `~/.config/goose/config.yaml` (macOS/Linux),
  `%APPDATA%\Block\goose\config\config.yaml` (Windows). Single file, no
  project-level config.
- MCP servers ("extensions") live under the **`extensions:` key in the same
  file**, as a map keyed by extension name. Field names differ from the
  standard `mcpServers` shape — **read `research/agent-research-goose.md`
  §3 carefully, the field-name table is critical**:
  - stdio: `type: stdio`, `name`, `cmd` (NOT `command`), `args`, `envs` (NOT
    `env`; `env` accepted as a read alias), `env_keys` (secret-store key
    names), `timeout`, `cwd`, `available_tools`, `enabled`
  - remote: `type: streamable_http`, `uri` (NOT `url`), `headers`, `envs`,
    `env_keys`, `timeout`, `client_id`, `client_secret_key`, `scopes`,
    `enabled`
  - other types exist (`builtin`, `platform`, `frontend`, `inline_python`,
    legacy `sse`) — this task only needs to read/preserve those untouched,
    not manage them
- Provider *selection* (`active_provider`, `providers:` map with
  `{enabled, model, configured}`) is in the same file, but **API keys are
  NEVER in config.yaml** — they live in the OS keyring or a `secrets.yaml`
  fallback file. Do not implement provider write support that could write a
  key into `config.yaml`.
- No `goose` entry exists in `packages/core/src/agent-catalog.json` yet —
  create one.

## Target state

A new `packages/core/src/adapters/goose.ts` exporting
`createGooseAdapter(): AgentAdapter`, a bespoke full `AgentAdapter`
implementation (like `codex.ts`, but YAML instead of TOML) that:

- reads/writes `~/.config/goose/config.yaml` (and the Windows path) via
  `parseConfig`/`stringifyConfig` with `'yaml'`
- exposes the `extensions:` map as this app's unified `MCPServerConfig[]`,
  translating the Goose-specific field names (`cmd`↔`command`, `uri`↔`url`,
  `envs`↔`env`) on both decode and encode
- preserves every other top-level key (`active_provider`, `providers`, any
  unrecognized keys) verbatim across a read-modify-write cycle, and
  preserves per-extension fields this app doesn't manage (`env_keys`,
  `timeout`, `available_tools`, `client_id`, `client_secret_key`, `scopes`,
  `description`) when updating an existing entry — same "merge, don't
  clobber" principle used elsewhere in this codebase
- never writes API keys anywhere
- is registered in `packages/core/src/adapters/index.ts` with a new
  `agent-catalog.json` entry

## Read first

### Current code (read fully before writing anything)

- `research/agent-research-goose.md` — your primary spec for facts (§1-4);
  treat §5's "detect-only" recommendation as superseded by this task file
- `packages/core/src/adapters/codex.ts` — structural template for a bespoke
  full `AgentAdapter` implementation with format-specific parse/stringify
  and unknown-key preservation
- `packages/core/src/adapters/omp.ts` — read for contrast (why IT stayed
  detect-only: multi-file fragmentation + cross-agent inheritance) so your
  implementation explicitly does NOT inherit that same limitation for
  Goose's single-file, well-defined schema
- `packages/core/src/utils/index.ts` — `parseConfig`/`stringifyConfig`
  (~lines 442-468, confirm `'yaml'` is handled) and `readFileSafe`
- `packages/core/src/types/index.ts` — the full `AgentAdapter` interface
  (~lines 166-202) and `MCPServerConfig`/etc. shapes
- `packages/core/src/adapters/index.ts` — registration map and exports
- `packages/core/src/agent-catalog.json` — existing entries as the template
  for the new `goose` entry

## Allowed scope

- `packages/core/src/adapters/goose.ts` (new file)
- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`

## Forbidden scope

- `packages/core/src/utils/index.ts`, `packages/core/src/adapters/generic.ts`,
  `packages/core/src/adapters/codex.ts`, `packages/core/src/adapters/omp.ts`
  (all read-only reference)
- any other adapter file
- `packages/gui/src/**`, `packages/cli/src/**`
- any other file
- unrelated refactors, dependency upgrades, architecture changes,
  formatting-only changes outside touched code

## Exact requirements

1. Implement `listMCPServers`/`addMCPServer`/`removeMCPServer`/
   `updateMCPServer` against the `extensions:` map, translating field names
   exactly per the table in `research/agent-research-goose.md` §3
   (`cmd`↔`command`, `uri`↔`url`, `envs`↔`env`), and preserving
   Goose-specific fields (`env_keys`, `timeout`, `available_tools`,
   `client_id`, `client_secret_key`, `scopes`, `description`, `bundled`) on
   existing entries when only common fields change.
2. Implement `readConfig`/`writeConfig`/`getConfigPath`/`validateConfig`
   against `~/.config/goose/config.yaml` (and the Windows path), preserving
   every other top-level key verbatim across read-modify-write.
3. Set `supports: { modelProviders: false, mcpServers: true, permissions:
   false, projectConfig: false }`. Provider *selection* exists in the file
   but credentials don't — do not implement provider write support in this
   task (same reasoning as M013/Reasonix). If read-only provider-selection
   listing seems safe and valuable, note it as a FOLLOW_UP instead of
   implementing it.
4. Types/entries this adapter doesn't manage (`builtin`, `platform`,
   `frontend`, `inline_python`, legacy `sse`) must pass through unchanged on
   write — never drop or corrupt an extension entry just because its `type`
   isn't one this adapter actively manages.
5. Register in `packages/core/src/adapters/index.ts` without disturbing the
   `freebuff`/`cline`/`reasonix` entries added by M011-M013.
6. Add a new `goose` entry to `packages/core/src/agent-catalog.json`
   matching the existing field shape (`id`, `name`, `description`,
   `status: "beta"`, `source` pointing at the canonical repo per
   `research/agent-research-goose.md` §0, `addedAt`, `binaries: ["goose"]`,
   `settingsPaths` for darwin/linux/win32 per §1, `install`/`uninstall` —
   research the correct install command from the same sources the research
   file cites if not already stated there, or from the official docs;
   report BLOCKED if you can't confirm one rather than guessing).

## Non-goals

- Any GUI changes.
- Model/provider write support.
- System keyring / `secrets.yaml` interaction of any kind.
- The system-level or `GOOSE_ADDITIONAL_CONFIG_FILES` config layers — target
  only the user config file.

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow `codex.ts`'s existing structure/conventions as closely as makes
  sense for Goose's different schema.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions.
- No new dependencies.

## Interface / contract

- Implement the full `AgentAdapter` interface.
- `parseConfig`/`stringifyConfig` signatures are the existing contract.

## Dependencies

- Upstream: M011, M012, M013 (must be merged first)
- Downstream: M015 (Aider) is independent of this one (catalog-entry-only,
  no shared-file risk beyond the same two registration files) but should
  still be sequenced after for cleanliness

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
- A throwaway script/test (delete before finishing) that: writes a small
  hand-crafted sample `config.yaml` to a temp path (using the
  `extensions:`/`providers:` shape from `research/agent-research-goose.md`
  §3's example), constructs the goose adapter pointed at that temp path (or
  monkey-patches the resolved path — use whatever mechanism the codebase
  already provides for testing against a non-default path, check how
  `codex.ts`/other adapters are unit-tested if a pattern exists), calls
  `readConfig`/`listMCPServers`, confirms field-name translation is correct
  (`cmd`→`command` etc.), then `addMCPServer`+`writeConfig`+re-read to
  confirm round-trip preserves `active_provider`/`providers` and any
  builtin/platform entries untouched — paste the real output.

## Expected evidence

The final report must include:

- exact commands executed
- real output or relevant excerpts
- files changed
- the round-trip verification script's real output
- limitations or failures

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
