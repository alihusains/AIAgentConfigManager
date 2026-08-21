# M006 — Research: Reasonix config/MCP footprint (primary sources)

## Identity

- Task ID: M006
- Parent workstream: agent-coverage-research-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 2a290b3
- Branch: pi/M006-research-reasonix
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M006-research-reasonix
- Type: docs
- Priority: P1
- Dependencies: none (this is pure research; a later implementation task will depend on this one's output, but does not exist yet)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M006-research-reasonix`

Work ONLY within these repository paths:

- `research/agent-research-reasonix.md` (new file — create it)

Read every file listed in "Read first" before writing anything.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not modify any application source code, adapter code, or the agent catalog — this is a research-only task; a separate implementation task will use your findings.

Do not broaden scope — do not "helpfully" start building the adapter.

If you cannot reach the internet/web from this environment, STOP and report BLOCKED with exactly that limitation stated (do not guess or hallucinate paths/formats to fill the gap).

Cite the real, specific source (URL, doc page, or repo file path) for every factual claim. Do not invent plausible-sounding details.

## Why this task exists

This project (`AI Agent Config Manager` / AgentSync) is a registry that lets a
user define providers/models/MCP servers once and materialize them into every
AI coding agent CLI's own config format. Reasonix (`esengine/reasonix` on
GitHub) is already listed in `packages/core/src/agent-catalog.json` as a
catalog-only entry (detect-only: install/uninstall commands + guessed
`settingsPaths`), but has no real adapter — nobody has verified its actual
config file format, its actual MCP server configuration mechanism (if any),
or which of the two guessed settings paths (`config.json` vs `config.toml`)
is correct. This is blocking a real adapter from being built.

## Current state

The catalog entry for reasonix today (`packages/core/src/agent-catalog.json`):

```json
{
  "id": "reasonix",
  "name": "Reasonix",
  "description": "DeepSeek-native coding agent engineered for byte-stable prefix-cache performance. Requires Node >= 22.",
  "status": "beta",
  "source": "https://github.com/esengine/reasonix",
  "binaries": ["reasonix"],
  "settingsPaths": {
    "darwin": ["~/.reasonix/config.json", "~/.reasonix/config.toml"],
    "linux": ["~/.reasonix/config.json", "~/.reasonix/config.toml"],
    "win32": ["~/.reasonix/config.json", "~/.reasonix/config.toml"]
  },
  "install": "npm install -g reasonix",
  "uninstall": "npm uninstall -g reasonix",
  "note": "DeepSeek API key required at first run."
}
```

`settingsPaths` lists both a `.json` and `.toml` candidate — this is an
unconfirmed guess, not a verified fact.

## Target state

A new file `research/agent-research-reasonix.md` exists, written in the same
spirit and rigor as the existing `docs/agent-cli-inventory.md` §4.4 table (a
project file you should read for the expected tone/rigor/citation style), that
answers, with cited primary sources:

1. What is Reasonix's actual config file format and exact path(s), per
   platform (macOS/Linux/Windows)? Is it JSON, TOML, YAML, or something else —
   resolve the `config.json` vs `config.toml` ambiguity definitively if
   possible, or report that both exist / neither is confirmed, citing why.
2. Does Reasonix support MCP servers at all? If yes: where is MCP server
   config stored (same file under a key, or a separate file)? What is the
   exact JSON/TOML shape (field names, whether it's a keyed object or an
   array, what each server entry needs — command, args, env, url, headers,
   etc.)?
3. How are model/provider credentials configured (the note says "DeepSeek API
   key required at first run" — where does that key actually get stored: env
   var, config file field, a separate auth file)?
4. Is there a project-level (per-repo) config in addition to the global one
   (e.g. `.reasonix/config.json` in a project directory), and if so, how does
   precedence work?
5. Your own read on adapter shape: does this look closest to the existing
   `GenericAdapter` pattern (main config + separate MCP file, or `mcpShape:
   'keyed'`/`'array'` in the main file), the `OpenCodeStyleAdapter` pattern
   (MCP under an `mcp` key with `command: string[]`), or does it need
   something bespoke? Justify briefly from what you found — this is an
   opinion/recommendation section, clearly labeled as such, not a claim of
   fact.

## Read first

### Reference (for format/rigor/tone to match)

- `docs/agent-cli-inventory.md` — read the whole file, especially §3 ("This
  machine — config & MCP footprint per agent") and §4.4/§4.5/§4.6, as the
  exact model for how findings should be reported
- `packages/core/src/agent-catalog.json` (the `reasonix` entry, quoted above)
- `packages/core/src/adapters/junie.ts` and `packages/core/src/adapters/kilo.ts`
  — read these as concrete examples of the two adapter shapes named in
  requirement 5, so your recommendation is grounded in what actually exists,
  not guessed

### Primary sources to investigate

- https://github.com/esengine/reasonix — README, any `docs/` directory,
  source code (especially anything that reads/writes a config file or `mcp`
  settings — grep the repo source itself if you can access it, since source
  code is the most authoritative source for undocumented behavior)
- Any official docs site the README links to

## Allowed scope

- `research/agent-research-reasonix.md` (new file only)

## Forbidden scope

- any application source file (`packages/core/src/**`, `packages/gui/src/**`,
  `packages/cli/src/**`)
- `packages/core/src/agent-catalog.json`
- any other file
- installing or running the actual `reasonix` binary against real credentials

## Exact requirements

1. Create `research/agent-research-reasonix.md`.
2. Answer all 5 numbered questions in "Target state" with cited sources.
3. If a fact cannot be verified from any available source, say so explicitly
   ("unconfirmed — no primary source found for X") rather than guessing.
4. End the file with a short "Sources" section listing every URL/reference
   actually consulted, matching `docs/agent-cli-inventory.md`'s §5 style.

## Non-goals

- Writing or modifying any adapter code.
- Updating `agent-catalog.json`.
- Installing/running Reasonix.

## Implementation constraints

- Prefer primary sources (official repo/docs) over secondhand blog posts.
- Distinguish clearly between "verified fact" and "recommendation/opinion" in
  the write-up (see requirement 5).
- Keep the file focused — this is one agent's research, not a rewrite of the
  whole landscape doc.

## Interface / contract

N/A — this is a research/docs task, not a code contract.

## Dependencies

- Upstream: none
- Downstream: a future adapter-implementation task for Reasonix will read
  this file as its primary input

## Verification

This task has no build/typecheck/test commands — verify manually that:

- `research/agent-research-reasonix.md` exists and is non-empty
- `git status --short` shows ONLY that one new file
- every factual claim in the file has a citation (URL or "unconfirmed")
- the file directly answers all 5 numbered questions

## Expected evidence

The final report must include:

- the full path of the file created
- a brief (3-5 line) summary of the key finding (config format + MCP support
  answer)
- `git status --short` output
- any BLOCKED reason if web access was unavailable

## Completion criteria

The task is complete only when:

- the file exists, answers all 5 questions with citations
- no application code or catalog file was touched
- `git status --short` shows exactly one new, untracked-then-added file

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- research/agent-research-reasonix.md

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
