# M016 — Fix formatting regression from M011 (freebuff adapter)

## Identity

- Task ID: M016
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: (current HEAD of branch `pi/M011-adapter-freebuff` at dispatch time)
- Branch: pi/M011-adapter-freebuff (continue on the SAME branch — this is a
  correction to M011's own work, not a new independent branch)
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff
- Type: refactor
- Priority: P0 (blocks M012 integration)
- Dependencies: none (this IS the fix for M011; nothing else has started)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff`

Work ONLY within these repository paths:

- `packages/core/src/adapters/index.ts`
- `packages/core/src/adapters/freebuff.ts`

Do NOT touch `packages/core/src/agent-catalog.json` — that file's diff from
the earlier M011 run is already correctly formatted; leave it exactly as is.

Do not reset, clean, stash, rebase, or overwrite unrelated work. Do not
revert the substantive freebuff-registration change itself — only its
formatting is wrong.

Do not run a formatter/linter over the whole file — make targeted manual
edits, comparing line-by-line against the reference files named below.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The previous run of this same task (M011) correctly implemented the FreeBuff
adapter, but reformatted both touched files in a way that doesn't match this
codebase's existing style:

- `packages/core/src/adapters/index.ts` (a PRE-EXISTING file): converted from
  2-space indentation + single-quoted strings to 1-space indentation +
  double-quoted strings, and reordered/reformatted the import statements.
  This is a scope violation — the task only needed to ADD one export, one
  import, and one Map entry; it should not have touched the formatting of
  every other line in the file.
- `packages/core/src/adapters/freebuff.ts` (the NEW file): written with
  3-space indentation and double-quoted strings throughout, which does not
  match the single-quote + 2-space convention used by every other adapter
  file in this directory (`junie.ts`, `pi.ts`, `kilo.ts`, `gemini.ts`, etc.).

The actual logic in both files is correct and should not change — this task
is a pure formatting correction.

## Current state

Run `git diff main -- packages/core/src/adapters/index.ts
packages/core/src/adapters/freebuff.ts` in this worktree to see the exact
current (incorrectly formatted) state. Compare against
`packages/core/src/adapters/junie.ts` and `packages/core/src/adapters/pi.ts`
(unchanged, correctly formatted files) as your style reference.

## Target state

Both files use:

- **2-space indentation** (not 1-space, not 3-space) — matching every other
  file in `packages/core/src/adapters/`
- **Single-quoted strings** (`'freebuff'`, not `"freebuff"`) — matching every
  other file in that directory
- In `index.ts`: the import/export statement formatting, ordering, and line
  style must match exactly what existed before M011's edit — i.e. only the
  new `createFreebuffAdapter` export line, the new import line, and the new
  `['freebuff', createFreebuffAdapter]` Map entry (with its own comment line,
  matching the existing `// <Name> CLI ("<binary>")` comment convention
  used above every other Map entry) should differ from the pre-M011 version
  of this file. Every other line must be byte-identical to the pre-M011
  version.
- In `freebuff.ts`: same content/logic as the current version, just
  reformatted to 2-space indent + single quotes, matching the exact
  structural style of `junie.ts`/`pi.ts` (header doc comment, import block,
  `createXAdapter()` function, `GenericAdapterOptions` object literal).

## Read first

- `packages/core/src/adapters/junie.ts` — 2-space/single-quote style reference
- `packages/core/src/adapters/pi.ts` — second style reference
- The current (incorrectly formatted) `packages/core/src/adapters/index.ts`
  and `packages/core/src/adapters/freebuff.ts` in this worktree
- `git log -p -1 -- packages/core/src/adapters/index.ts` in this worktree, or
  `git show main:packages/core/src/adapters/index.ts`, to see the exact
  pre-M011 formatting of `index.ts` that must be preserved for every
  untouched line

## Allowed scope

- `packages/core/src/adapters/index.ts`
- `packages/core/src/adapters/freebuff.ts`

## Forbidden scope

- `packages/core/src/agent-catalog.json`
- any other file
- any logic/behavior change — this is formatting-only

## Exact requirements

1. Rewrite `packages/core/src/adapters/index.ts` so every line that existed
   before M011 is restored to its exact pre-M011 formatting (2-space indent,
   single quotes, original import grouping/order), with ONLY the 3 additive
   changes for FreeBuff registration layered on top in the same style.
2. Rewrite `packages/core/src/adapters/freebuff.ts` to 2-space indentation
   and single-quoted strings throughout, with no logic change.
3. Confirm `git diff main -- packages/core/src/adapters/index.ts` afterward
   shows ONLY the FreeBuff-related additions (no unrelated line changes) —
   this is the actual pass/fail bar for this task, check it yourself before
   reporting done.

## Non-goals

- Any change to `agent-catalog.json`.
- Any change to the adapter's actual behavior/paths/options.
- Running a project-wide formatter.

## Implementation constraints

- Manual, targeted edits — do not run `prettier`/`eslint --fix` over these
  files (there's no project formatter config anyway; a formatter run is what
  caused this problem originally, so don't repeat it).
- Smallest correct diff against `main`.

## Interface / contract

No change — `createFreebuffAdapter`'s exported signature and behavior stay
identical.

## Dependencies

- Upstream: none
- Downstream: M012 (Cline) cannot start until this correction is merged

## Verification

Run:

```bash
git diff main -- packages/core/src/adapters/index.ts
git diff main -- packages/core/src/adapters/freebuff.ts
pnpm --filter @ai-agent-config/core build
```

Also verify:

- The `index.ts` diff shows ONLY additive FreeBuff-related lines — no
  reformatting of unrelated lines. Paste this diff in full in the report.
- `packages/core/src/adapters/freebuff.ts` visually matches `junie.ts`'s
  indentation/quote style (paste a short excerpt of both side by side in the
  report, or just state clearly that a manual comparison was done).

## Expected evidence

The final report must include:

- exact commands executed
- the full `git diff main -- packages/core/src/adapters/index.ts` output,
  showing it is minimal/additive
- confirmation the build still passes
- limitations or failures

## Completion criteria

The task is complete only when `index.ts`'s diff against `main` is minimal
and additive (no formatting churn on untouched lines), `freebuff.ts` matches
the codebase's 2-space/single-quote convention, and the build still passes.

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- packages/core/src/adapters/index.ts
- packages/core/src/adapters/freebuff.ts

COMMANDS_RUN:
```text
<real commands and relevant output, including the full index.ts diff>
```

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
