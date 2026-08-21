# M010 — Research: Aider config/MCP footprint (primary sources)

## Identity

- Task ID: M010
- Parent workstream: agent-coverage-research-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 2a290b3
- Branch: pi/M010-research-aider
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M010-research-aider
- Type: docs
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M010-research-aider`

Work ONLY within these repository paths:

- `research/agent-research-aider.md` (new file — create it)

Read every file listed in "Read first" before writing anything.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not modify any application source code, adapter code, or the agent catalog — this is a research-only task.

Do not broaden scope — do not "helpfully" start building the adapter.

If you cannot reach the internet/web from this environment, STOP and report BLOCKED with exactly that limitation stated (do not guess or hallucinate).

Cite the real, specific source for every factual claim.

## Why this task exists

`docs/agent-cli-inventory.md` §4.2/§4.4 lists Aider (48.3k★, MCP-capable,
category 7 "Plugins, MCPs, CLI tools") as **P2**, with config guessed as
`~/.aider.conf.yml` / `~/.config/aider/aider.conf.yml` and MCP guessed as
`~/.mcp.json` (project) — both unconfirmed, no primary source cited. Aider is
one of the most established, widely-used terminal coding agents outside the
project's current catalog, making it a high-value target to verify and adapt.
There's already a separate, older research file in this repo
(`research/ai-agent-config-paths.md`) that does NOT cover Aider at all — this
task fills that gap specifically.

## Current state

Unconfirmed guesses from `docs/agent-cli-inventory.md`: global config
`~/.aider.conf.yml` or `~/.config/aider/aider.conf.yml` (YAML); MCP guessed as
`~/.mcp.json` in the project directory — no citation for either.

## Target state

A new file `research/agent-research-aider.md`, matching the rigor/style of
`docs/agent-cli-inventory.md`, that answers with cited sources:

1. What is Aider's actual config file format and exact path(s) per platform
   (macOS/Linux/Windows)? Confirm or correct the two guessed YAML paths —
   note Aider is also known to support a `.aider.conf.yml` in the current
   project directory in addition to a global one; confirm precedence.
2. Is `~/.mcp.json` (or any MCP config) actually something Aider itself
   reads, or is that guess conflating a different tool's convention? If Aider
   supports MCP servers, cite the exact mechanism/flag/config key and file
   shape.
3. How are model providers/API keys configured — env vars (Aider is
   historically env-var-heavy, e.g. `OPENAI_API_KEY`), a config file field, or
   both? Be specific.
4. Does Aider support any other agent-config-manager-relevant settings worth
   noting (model aliases, `.aider.model.settings.yml`, etc.)?
5. Adapter-shape recommendation (`GenericAdapter` vs `OpenCodeStyleAdapter` vs
   bespoke — YAML may push toward detect-only like OMP, per
   `docs/agent-cli-inventory.md` §4.6), clearly labeled as recommendation.

## Read first

### Reference (for format/rigor/tone to match)

- `docs/agent-cli-inventory.md` — full file, especially §4.2 and §4.4 (Aider
  rows) and §4.6
- `research/ai-agent-config-paths.md` — skim this older research file (it
  covers a different, non-overlapping set of tools: Cursor, Copilot CLI,
  Windsurf, Continue.dev, OpenInterpreter, Zed, Amazon Q, Ollama, LM Studio,
  Jan.ai — Aider is NOT among them) purely to match its citation/table format
  if useful; do not duplicate its content
- `packages/core/src/adapters/junie.ts`, `packages/core/src/adapters/kilo.ts`,
  `packages/core/src/adapters/omp.ts` — concrete examples of the three
  possible adapter shapes referenced in requirement 5

### Primary sources to investigate

- https://aider.chat/docs/config/ (or wherever Aider's current official docs
  site is)
- https://github.com/Aider-AI/aider (or current org — confirm the actual repo)

## Allowed scope

- `research/agent-research-aider.md` (new file only)

## Forbidden scope

- any application source file
- `packages/core/src/agent-catalog.json`
- any other file
- installing or running the actual `aider` binary against real credentials

## Exact requirements

1. Create `research/agent-research-aider.md`.
2. Answer all 5 numbered questions with cited sources.
3. Explicitly confirm or correct both existing guesses (config path, MCP
   claim) — say which it is for each.
4. End with a "Sources" section.

## Non-goals

- Writing or modifying any adapter code.
- Updating `agent-catalog.json`.
- Installing/running Aider.
- Rewriting `research/ai-agent-config-paths.md`.

## Implementation constraints

- Prefer primary sources (official docs/repo) over secondhand blog posts.
- Distinguish "verified fact" from "recommendation" clearly.

## Interface / contract

N/A — research/docs task.

## Dependencies

- Upstream: none
- Downstream: a future adapter-implementation task for Aider will read this
  file as its primary input

## Verification

No build/typecheck/test commands. Verify manually:

- `research/agent-research-aider.md` exists and is non-empty
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
- research/agent-research-aider.md

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
