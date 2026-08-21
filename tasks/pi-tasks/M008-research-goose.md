# M008 — Research: Goose config/MCP footprint (primary sources)

## Identity

- Task ID: M008
- Parent workstream: agent-coverage-research-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 2a290b3
- Branch: pi/M008-research-goose
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M008-research-goose
- Type: docs
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M008-research-goose`

Work ONLY within these repository paths:

- `research/agent-research-goose.md` (new file — create it)

Read every file listed in "Read first" before writing anything.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not modify any application source code, adapter code, or the agent catalog — this is a research-only task.

Do not broaden scope — do not "helpfully" start building the adapter.

If you cannot reach the internet/web from this environment, STOP and report BLOCKED with exactly that limitation stated (do not guess or hallucinate).

Cite the real, specific source for every factual claim.

## Why this task exists

`docs/agent-cli-inventory.md` §4.4 lists Goose (`aaif-goose`, Linux Foundation
Agentic AI project, 52.9k★) as **P2**, with config location marked
`~/.config/goose/config.yaml (global settings + providers)` and MCP marked
`goose mcp add → same config.yaml` — both explicitly flagged **"verify before
adapting"** in that table, i.e. plausible-but-unconfirmed guesses, not
verified facts. This task turns that guess into a verified finding (or a
corrected one) from primary sources, so a real adapter can be built next.

## Current state

Unconfirmed guess from the existing research doc:
`~/.config/goose/config.yaml` — global settings + providers — MCP added via
`goose mcp add`, written into the same file. No structure/shape has been
verified; no primary source was cited for this row originally.

## Target state

A new file `research/agent-research-goose.md`, matching the rigor/style of
`docs/agent-cli-inventory.md`, that answers with cited sources:

1. What is Goose's actual config file format and exact path(s) per platform
   (macOS/Linux/Windows)? Confirm or correct `~/.config/goose/config.yaml`.
2. Is there a project-level (per-repo) config in addition to the global one?
3. How exactly are MCP servers configured — confirm the `goose mcp add`
   command's effect: same file or separate? What is the exact YAML shape for
   an MCP server entry (field names for command, args, env, url, etc.)?
4. How are model providers/API keys configured — same file, separate file,
   or env vars?
5. Adapter-shape recommendation: does this look closest to `GenericAdapter`
   (see `packages/core/src/adapters/junie.ts`) or `OpenCodeStyleAdapter` (see
   `packages/core/src/adapters/kilo.ts`), or does YAML mean it needs
   detect-only treatment like OMP (see `packages/core/src/adapters/omp.ts`,
   and `docs/agent-cli-inventory.md` §4.6 "OMP is the only one that requires
   YAML, which the core's `ConfigFormat` (json/jsonc) does not support")?
   Clearly label this as recommendation, not fact.

## Read first

### Reference (for format/rigor/tone to match)

- `docs/agent-cli-inventory.md` — full file, especially §4.4 (the Goose row)
  and §4.6
- `packages/core/src/adapters/junie.ts`, `packages/core/src/adapters/kilo.ts`,
  `packages/core/src/adapters/omp.ts` — concrete examples of the three
  possible adapter shapes referenced in requirement 5

### Primary sources to investigate

- https://github.com/aaif-goose (or wherever the current canonical repo for
  Goose lives — the project moved to Linux Foundation per the existing doc;
  confirm the current org/repo name yourself)
- Official Goose documentation site
- The actual source code's config-loading module, if accessible, as the most
  authoritative source for the real shape

## Allowed scope

- `research/agent-research-goose.md` (new file only)

## Forbidden scope

- any application source file
- `packages/core/src/agent-catalog.json`
- any other file
- installing or running the actual `goose` binary against real credentials

## Exact requirements

1. Create `research/agent-research-goose.md`.
2. Answer all 5 numbered questions with cited sources.
3. Explicitly confirm or correct the existing guessed path/format from
   `docs/agent-cli-inventory.md` — say which it is.
4. End with a "Sources" section.

## Non-goals

- Writing or modifying any adapter code.
- Updating `agent-catalog.json`.
- Installing/running Goose.

## Implementation constraints

- Prefer primary sources (official docs/repo) over secondhand blog posts.
- Distinguish "verified fact" from "recommendation" clearly.

## Interface / contract

N/A — research/docs task.

## Dependencies

- Upstream: none
- Downstream: a future adapter-implementation task for Goose will read this
  file as its primary input

## Verification

No build/typecheck/test commands. Verify manually:

- `research/agent-research-goose.md` exists and is non-empty
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
- research/agent-research-goose.md

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
