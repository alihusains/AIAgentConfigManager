# M009 — Research: Cline config/MCP footprint (primary sources)

## Identity

- Task ID: M009
- Parent workstream: agent-coverage-research-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 2a290b3
- Branch: pi/M009-research-cline
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M009-research-cline
- Type: docs
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M009-research-cline`

Work ONLY within these repository paths:

- `research/agent-research-cline.md` (new file — create it)

Read every file listed in "Read first" before writing anything.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not modify any application source code, adapter code, or the agent catalog — this is a research-only task.

Do not broaden scope — do not "helpfully" start building the adapter.

If you cannot reach the internet/web from this environment, STOP and report BLOCKED with exactly that limitation stated (do not guess or hallucinate).

Cite the real, specific source for every factual claim.

## Why this task exists

`docs/agent-cli-inventory.md` §4.2/§4.4 lists Cline as **P2**, noting it's
"VS Code ext (+ later CLI)" and "VS Code-extension heritage," with a local
trace already observed on this machine (`~/.cline/data` exists, dir only, per
§3 "Config traces without a binary"). Cline is significant (66.3k★) and has
apparently added a standalone CLI at some point — this needs primary-source
verification of whether a real terminal CLI with its own config now exists
(distinct from the VS Code extension's data dir), and if so, its actual
config/MCP shape, since `.mcp.json` per project was guessed in the existing
table without a cited source.

## Current state

Unconfirmed guesses from the existing research doc: binary `cline`; config
`~/.cline/data` (present locally, but this is extension data, not necessarily
CLI config); MCP guessed as `.mcp.json` per project — no primary source cited
for the MCP claim.

## Target state

A new file `research/agent-research-cline.md`, matching the rigor/style of
`docs/agent-cli-inventory.md`, that answers with cited sources:

1. Does Cline currently ship an actual standalone terminal CLI binary (not
   just the VS Code/JetBrains extension)? If yes, what is the binary name
   and how is it installed (npm package name, etc.)?
2. If a CLI exists: what is its config file format and exact path(s) per
   platform? Is `~/.cline/data` actually CLI config, or is it extension
   state/cache that a config manager shouldn't touch?
3. How are MCP servers configured for Cline (CLI and/or extension) — exact
   file location and JSON shape? Confirm or correct the guessed `.mcp.json`
   per-project claim.
4. How are model providers/API keys configured?
5. Adapter-shape recommendation (`GenericAdapter` vs `OpenCodeStyleAdapter` vs
   bespoke vs "no viable CLI adapter — extension-only, out of scope"), clearly
   labeled as recommendation. If there is genuinely no terminal CLI yet, say
   so plainly — that is a valid, useful, negative finding.

## Read first

### Reference (for format/rigor/tone to match)

- `docs/agent-cli-inventory.md` — full file, especially §3 ("Config traces
  without a binary"), §4.2 (Cline row), and §4.4 (Cline row)
- `packages/core/src/adapters/junie.ts`, `packages/core/src/adapters/kilo.ts`
  — concrete examples of the two named adapter shapes

### Primary sources to investigate

- https://github.com/cline/cline — README, any CLI-specific docs/package
- Official Cline documentation site
- npm registry for any `cline`-branded CLI package

## Allowed scope

- `research/agent-research-cline.md` (new file only)

## Forbidden scope

- any application source file
- `packages/core/src/agent-catalog.json`
- any other file
- installing or running any `cline` binary/extension

## Exact requirements

1. Create `research/agent-research-cline.md`.
2. Answer all 5 numbered questions with cited sources.
3. If no real terminal CLI exists yet, state that plainly as the conclusion
   instead of forcing a speculative adapter design.
4. End with a "Sources" section.

## Non-goals

- Writing or modifying any adapter code.
- Updating `agent-catalog.json`.
- Installing/running Cline.

## Implementation constraints

- Prefer primary sources over secondhand blog posts.
- Distinguish "verified fact" from "recommendation" clearly.
- A negative finding ("extension-only, no CLI") is an acceptable and useful
  outcome — don't manufacture complexity to avoid saying so.

## Interface / contract

N/A — research/docs task.

## Dependencies

- Upstream: none
- Downstream: a future adapter-implementation task for Cline, only if a real
  CLI is confirmed to exist

## Verification

No build/typecheck/test commands. Verify manually:

- `research/agent-research-cline.md` exists and is non-empty
- `git status --short` shows ONLY that one new file
- every claim has a citation or is marked unconfirmed
- all 5 questions are directly answered

## Expected evidence

The final report must include:

- the full path of the file created
- a 3-5 line summary of the key finding
- `git status --short` output
- any BLOCKED reason if web access was unavailable

## Completion criteria

The task is complete only when the file exists, answers all 5 questions with
citations, and no application code or catalog file was touched.

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- research/agent-research-cline.md

COMMANDS_RUN:
```text
<git status --short output>
```

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
