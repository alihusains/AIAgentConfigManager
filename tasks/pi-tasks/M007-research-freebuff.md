# M007 — Research: FreeBuff config/MCP footprint (primary sources)

## Identity

- Task ID: M007
- Parent workstream: agent-coverage-research-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 2a290b3
- Branch: pi/M007-research-freebuff
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M007-research-freebuff
- Type: docs
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M007-research-freebuff`

Work ONLY within these repository paths:

- `research/agent-research-freebuff.md` (new file — create it)

Read every file listed in "Read first" before writing anything.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not modify any application source code, adapter code, or the agent catalog — this is a research-only task.

Do not broaden scope — do not "helpfully" start building the adapter.

If you cannot reach the internet/web from this environment, STOP and report BLOCKED with exactly that limitation stated (do not guess or hallucinate).

Cite the real, specific source for every factual claim.

## Why this task exists

FreeBuff is already in `packages/core/src/agent-catalog.json` as a
catalog-only entry, and its `note` field claims "No API key, account, or
config file needed." If that's literally true, there may be genuinely nothing
for a config-manager adapter to do beyond detection — which is itself a
useful, confirmed finding (not a gap to force-fill), but it needs to be
verified from a primary source rather than taken on faith from one marketing
sentence in the catalog.

## Current state

The catalog entry for freebuff today:

```json
{
  "id": "freebuff",
  "name": "FreeBuff",
  "description": "Free, ad-supported coding agent CLI. No API key, account, or config file needed. Requires Node >= 18.",
  "status": "beta",
  "source": "https://freebuff.com/cli",
  "binaries": ["freebuff"],
  "install": "npm install -g freebuff",
  "uninstall": "npm uninstall -g freebuff",
  "note": "Funded by text ads — usage is free."
}
```

No `settingsPaths` field exists for it at all — consistent with "no config
file," but unverified.

## Target state

A new file `research/agent-research-freebuff.md`, matching the rigor/style of
`docs/agent-cli-inventory.md`, that answers with cited sources:

1. Does FreeBuff genuinely have zero on-disk config file, or is there
   actually some settings/state file (even if no API key is required) — e.g.
   a preferences file, a session/history file, a model-selection setting?
   Check the actual repo/binary behavior description, not just the tagline.
2. Does FreeBuff support MCP servers in any form? If yes, where/how is that
   configured?
3. Is there any way to select/configure which underlying model FreeBuff uses,
   and if so, where does that setting live?
4. Given the answers above, is there any legitimate adapter work here at all,
   or is "detect-only, no adapter possible" the correct and final answer? Say
   so plainly if that's the finding — that is a valid, useful conclusion.

## Read first

### Reference (for format/rigor/tone to match)

- `docs/agent-cli-inventory.md` — especially the "Config traces without a
  binary (no adapter value today)" section (§3) as an example of a
  legitimately-negative finding being written up plainly
- `packages/core/src/agent-catalog.json` (the `freebuff` entry, quoted above)

### Primary sources to investigate

- https://freebuff.com/cli and any linked docs/GitHub repo
- The npm package `freebuff` (readme, any config-related code if the source
  is inspectable)

## Allowed scope

- `research/agent-research-freebuff.md` (new file only)

## Forbidden scope

- any application source file
- `packages/core/src/agent-catalog.json`
- any other file
- installing or running the actual `freebuff` binary

## Exact requirements

1. Create `research/agent-research-freebuff.md`.
2. Answer all 4 numbered questions with cited sources.
3. State explicitly and plainly if the finding is "no adapter work needed —
   detect-only is correct" — don't manufacture a gap that isn't real.
4. End with a "Sources" section.

## Non-goals

- Writing or modifying any adapter code.
- Updating `agent-catalog.json`.
- Installing/running FreeBuff.

## Implementation constraints

- Prefer primary sources over marketing copy.
- A negative/simple finding ("nothing to adapt") is an acceptable and valid
  outcome — do not pad the report to manufacture complexity.

## Interface / contract

N/A — research/docs task.

## Dependencies

- Upstream: none
- Downstream: none, or a trivial follow-up if a real config surface is found

## Verification

No build/typecheck/test commands. Verify manually:

- `research/agent-research-freebuff.md` exists and is non-empty
- `git status --short` shows ONLY that one new file
- every claim has a citation or is marked unconfirmed

## Expected evidence

The final report must include:

- the full path of the file created
- a 2-4 line summary of the key finding
- `git status --short` output
- any BLOCKED reason if web access was unavailable

## Completion criteria

The task is complete only when the file exists, answers all 4 questions with
citations, and no application code or catalog file was touched.

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- research/agent-research-freebuff.md

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
