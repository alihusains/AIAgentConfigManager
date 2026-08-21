# M018 — Add root biome.json (stop pi's autofix from reformatting to double quotes)

## Identity

- Task ID: M018
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: (current HEAD of branch `pi/M011-adapter-freebuff` at dispatch time)
- Branch: pi/M011-adapter-freebuff (continue on the SAME branch)
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff
- Type: refactor
- Priority: P0 (root cause of the M011/M016/M017 formatting churn; fix this
  before re-attempting the freebuff.ts formatting fix)
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff`

Work ONLY within this repository path:

- `biome.json` (new file, repo root — create it)

Do not touch any other file in this task.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report,
including literal `cat` output, not descriptions.

## Why this task exists

Three consecutive task runs in this session (M011, M016, M017) each
reformatted or failed to durably fix formatting in edited/created files —
converting single-quoted, 2-space-indented code to double-quoted, 3-space
code, even when explicitly instructed not to and even after two dedicated
corrective attempts. Root cause, found by the lead's own investigation of
this environment: the `pi-lens` extension (installed globally at
`~/.pi/agent/npm/node_modules/pi-lens`) runs a post-write autofix pipeline
using Biome, and `pi-lens`'s own `tool-policy.js` `biomeConfigArgs(cwd)`
function explicitly says: **"A project config wins outright... [If none
exists] passes `--config-path` pinned to pi-lens's own bundled
`config/biome/core.jsonc`"** — which hardcodes `"quoteStyle": "double"`.
This repository has no `biome.json` today, so every pi-lens autofix pass
falls back to that double-quote default and silently reformats files after
every edit, regardless of what any task instructs or what pi itself writes.

Adding a `biome.json` at this repo's root that matches the codebase's actual,
consistent existing convention (single quotes, 2-space indentation) makes
`getBiomeConfigPath(cwd)` find it, so `biomeConfigArgs` returns `[]` (no
`--config-path` override) and biome's own config discovery picks up this
project file instead — permanently fixing the autofix mismatch for every
future edit in this repository, not just the one file this session has been
fighting over.

## Current state

- No `biome.json`, `biome.jsonc`, or any formatter config exists anywhere in
  this repository (confirmed earlier this session).
- Every existing file across `packages/core/src`, `packages/cli/src`,
  `packages/gui/src` consistently uses single-quoted strings and 2-space
  indentation (verify this yourself by looking at a handful of files, e.g.
  `packages/core/src/adapters/junie.ts`, `packages/core/src/adapters/pi.ts`,
  `packages/gui/src/App.tsx`).
- Semicolons are used consistently; trailing commas are used in multi-line
  object/array literals.

## Target state

A new `biome.json` at the repository root (`/biome.json`, same level as
`package.json`, `turbo.json`) that configures Biome's formatter to:

- `quoteStyle: "single"` for JS/TS
- `indentStyle: "space"`, `indentWidth: 2`
- semicolons always, trailing commas matching the codebase's existing style
  (ES5-style trailing commas — check a real multi-line example in the
  codebase to confirm, e.g. the `PROVIDER_TYPES` array or any
  `GenericAdapterOptions` object literal, and match what's actually there)

Leave the linter section either absent or minimal/recommended-only — this
task's job is fixing the FORMATTER mismatch (the observed root cause), not
introducing new lint enforcement. Do not disable the linter if including it
at all requires no extra decision; if genuinely unsure whether to include a
linter block, omit it entirely and only configure `formatter`/
`javascript.formatter` — a minimal, targeted config is safer than a larger
speculative one.

## Read first

- `packages/core/src/adapters/junie.ts`, `packages/core/src/adapters/pi.ts`,
  `packages/gui/src/App.tsx` — confirm the actual existing style
  (quotes/indent/semicolons/trailing commas) by reading them directly, don't
  assume
- `/Users/a.sorathiya/.pi/agent/npm/node_modules/pi-lens/config/biome/core.jsonc`
  — the bundled fallback config this new file supersedes (read-only
  reference outside this repo — do not edit it, you don't have permission
  to and it's outside this repository entirely)
- Biome's own configuration schema/docs for the exact JSON shape of
  `formatter`/`javascript.formatter` (`quoteStyle`, `indentStyle`,
  `indentWidth`, `semicolons`, `trailingCommas`) if you need to confirm the
  correct schema — the bundled `core.jsonc` referenced above is also a
  valid example of the schema shape (its `$schema` field points at a
  relative `configuration_schema.json` inside its own package — you can use
  a stable public schema URL instead, e.g. `https://biomejs.dev/schemas/…`,
  matching whatever version is realistic; if uncertain of the exact version
  URL, omit `$schema` rather than guess a broken one)

## Allowed scope

- `biome.json` (new file, repo root)

## Forbidden scope

- any file inside `~/.pi/` (outside this repository entirely — never touch
  another tool's global config)
- any application source file
- any other file in this repository

## Exact requirements

1. Create `/biome.json` at the repository root with a `formatter`/
   `javascript.formatter` configuration matching this codebase's actual
   existing style: single quotes, 2-space indent, semicolons, trailing
   commas matching what's actually observed in the codebase.
2. Do not include an opinionated linter configuration that could trigger
   unrelated autofixes — keep this config's scope to formatting.
3. Validate the file is syntactically valid JSON/JSONC.

## Non-goals

- Fixing `freebuff.ts`'s formatting in this task (a separate, follow-up task
  will redo that once this root-cause fix is in place and can be trusted to
  stick).
- Any linter rule configuration.
- Editing anything under `~/.pi/`.

## Implementation constraints

- Smallest correct config — do not copy the entire bundled `core.jsonc`
  wholesale; write a minimal, targeted file for this repo's actual needs.
- Valid JSON/JSONC syntax.

## Interface / contract

N/A — a tooling config file, not an application interface.

## Dependencies

- Upstream: none
- Downstream: the freebuff.ts formatting fix (next task) depends on this
  being in place and correct first

## Verification

Run, and paste the REAL literal output of each:

```bash
cat biome.json
python3 -c "import json; json.load(open('biome.json'))" 2>&1 || echo "(JSONC with comments may not parse as strict JSON — note if so)"
git status --short
```

Also verify:

- Re-read `biome.json` after writing it and confirm by eye it actually
  contains `"quoteStyle": "single"` somewhere — paste the exact matching
  line(s).

## Expected evidence

The final report must include:

- exact commands executed
- the real, literal `cat biome.json` output
- confirmation of valid syntax
- `git status --short`
- limitations or failures

## Completion criteria

The task is complete only when `biome.json` exists at the repo root, is
syntactically valid, and configures single-quote/2-space formatting matching
the codebase's actual existing style.

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- biome.json

COMMANDS_RUN:
```text
<real commands and relevant output, including full file contents>
```

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
