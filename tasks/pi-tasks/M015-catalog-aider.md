# M015 — Add Aider catalog entry (detect-only, no adapter)

## Identity

- Task ID: M015
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: (resolve to the merge commit of M014 on `main` at dispatch time — do not dispatch until M014 is merged)
- Branch: pi/M015-catalog-aider
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M015-catalog-aider
- Type: feature
- Priority: P3
- Dependencies: M011, M012, M013, M014 (must all be merged to `main` first)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M015-catalog-aider`

Work ONLY within these repository paths:

- `packages/core/src/agent-catalog.json`

Read every file listed in "Read first" before writing anything.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not create a new adapter file for Aider — this task is catalog-only,
intentionally. Do not modify `adapters/index.ts`.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

`research/agent-research-aider.md` (task M010) verified, from Aider's actual
source code, that Aider has **no MCP support at all** and stores provider
credentials mostly in a `.env` file — there is no MCP materialization value
and no safe provider-credential surface for this tool to manage. Per this
project's existing pattern (`reasonix`/`freebuff` before their real adapters
existed, and per `docs/agent-cli-inventory.md` §4.5's note that
"catalog-only agents are now detected on the machine instead of being
offered as Available to Install"), a config-manager-relevant agent with no
real adapter value can still get useful **detection** (so it shows up as
"installed"/"available" in the dashboard, and a user can install/uninstall
it) purely from a `agent-catalog.json` entry — no TypeScript adapter code
required.

## Current state

No `aider` entry exists anywhere in `packages/core/src/agent-catalog.json`.
From `research/agent-research-aider.md`:

- Binary: `aider` (installed via `pip install aider-chat` / `pipx install
  aider-chat` — confirm the exact current official install command from
  Aider's docs before writing it; do not guess if the research file doesn't
  already state it plainly)
- Global config: `~/.aider.conf.yml` (YAML) — confirmed real path
- No MCP support — confirmed absence, not just "unconfirmed"

## Target state

A new `aider` entry added to `packages/core/src/agent-catalog.json`, matching
the existing field shape used by other catalog-only entries (e.g. compare
`reasonix`/`freebuff`'s original catalog-only shape, before their adapters
existed — check git history/the M011/M013 diffs if useful, or just match the
current field shape of any entry): `id`, `name`, `description`, `status`,
`source`, `addedAt`, `binaries`, `settingsPaths`, `install`, `uninstall`, and
a `note` explaining the no-MCP/env-based-credentials finding briefly.

## Read first

### Current code (read fully before writing anything)

- `research/agent-research-aider.md` — your primary spec (§1 for the config
  path, TL;DR for the no-MCP finding)
- `packages/core/src/agent-catalog.json` — read the full file, in particular
  2-3 existing entries as the exact template (field names, date format,
  `settingsPaths` per-platform shape)

## Allowed scope

- `packages/core/src/agent-catalog.json`

## Forbidden scope

- `packages/core/src/adapters/**` (no adapter file, no registration change)
- `packages/gui/src/**`, `packages/cli/src/**`
- any other file

## Exact requirements

1. Add a new `aider` entry to `packages/core/src/agent-catalog.json`:
   - `id: "aider"`, `name: "Aider"`
   - `description`: brief, accurate (mention it's a well-established
     terminal pair-programming CLI; do not claim MCP support)
   - `status: "beta"` (or whatever status value existing similar entries use
     — match the convention)
   - `source`: the correct GitHub repo URL (confirm the current org/repo
     name — the research file should have this; if genuinely ambiguous,
     report BLOCKED with why rather than guessing)
   - `addedAt`: today's date in the same `YYYY-MM-DD` format other entries use
   - `binaries: ["aider"]`
   - `settingsPaths`: `~/.aider.conf.yml` for darwin/linux/win32 (per the
     research file, Aider uses `Path.home()` with no per-platform variation
     — win32 path is `%USERPROFILE%\.aider.conf.yml`, matching the existing
     convention other entries use for expressing a home-relative Windows
     path)
   - `install`/`uninstall`: the correct pip/pipx commands (confirm from the
     research file or official docs — do not guess)
   - `note`: one sentence stating Aider has no MCP support and manages
     credentials primarily via a `.env` file, so this tool provides
     detection only for it today
2. Do not touch any other existing entry.
3. Do not create `packages/core/src/adapters/aider.ts` or register anything
   in `adapters/index.ts` — this is intentionally catalog-only.

## Non-goals

- Any adapter implementation for Aider.
- Any GUI changes.
- MCP support for Aider (does not exist).

## Implementation constraints

- Match the exact existing JSON field shape/order/style of other catalog
  entries.
- Prefer the smallest correct diff — one new object in the array/map, no
  other changes.

## Interface / contract

N/A — pure data entry, no code contract.

## Dependencies

- Upstream: M011, M012, M013, M014 (must be merged first, for a clean
  sequential integration history — this task doesn't actually conflict with
  their file regions, but keep the same discipline)
- Downstream: none

## Verification

Run:

```bash
python3 -c "import json,sys; json.load(open('packages/core/src/agent-catalog.json'))"
```

Also verify:

- `git status --short` — changed files are exactly
  `packages/core/src/agent-catalog.json`
- Diff the file (`git diff packages/core/src/agent-catalog.json`) and confirm
  only one new entry was added — no existing entry was reordered, removed,
  or modified.

## Expected evidence

The final report must include:

- exact commands executed
- real output confirming valid JSON
- the diff showing exactly one new entry added
- limitations or failures (e.g. if the install command couldn't be
  confirmed)

## Completion criteria

The task is complete only when the new entry is added correctly, no other
entry changed, the JSON is valid, and no adapter/registration file was
touched.

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- packages/core/src/agent-catalog.json

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
