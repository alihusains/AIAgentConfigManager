# M017 — Actually fix freebuff.ts formatting (M016 claimed done, was not)

## Identity

- Task ID: M017
- Parent workstream: agent-coverage-implementation-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: (current HEAD of branch `pi/M011-adapter-freebuff` at dispatch time)
- Branch: pi/M011-adapter-freebuff (continue on the SAME branch)
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff
- Type: refactor
- Priority: P0 (blocks M012 integration)
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M011-adapter-freebuff`

Work ONLY within this repository path:

- `packages/core/src/adapters/freebuff.ts`

Do not touch `index.ts` or `agent-catalog.json` — both are already correct.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report —
this time including the ACTUAL FULL FILE CONTENTS, not a description of them.

## Why this task exists

The immediately prior task (M016) reported STATUS: DONE and claimed
`packages/core/src/adapters/freebuff.ts` was "2-space indented, single-quoted,
structurally identical to junie.ts — verified by manual side-by-side
comparison," with a specific claim that it matches `junie.ts`'s style.

**This claim was false.** Independent verification (reading the actual file
on disk, from the lead side) shows `freebuff.ts` STILL has 3-space
indentation and double-quoted strings throughout, unchanged from the
original M011 version. The file was never actually edited in that task run,
despite the report claiming it was checked and confirmed correct.

This is exactly why a completion report is treated as a claim, not evidence.
This task exists to actually make the edit this time, and to prove it with
real pasted file content rather than a description.

## Current state

Run `cat packages/core/src/adapters/freebuff.ts` right now in this worktree
before doing anything else, and paste that real output as the FIRST thing in
your final report, labeled "BEFORE". It currently looks like this (as of
this task's writing):

```typescript
import { createGenericAdapter, type GenericAdapterOptions } from "./generic";
import type { AgentAdapter } from "../types";

/**
 * Create a FreeBuff CLI adapter.
 */
export function createFreebuffAdapter(): AgentAdapter {
   const options: GenericAdapterOptions = {
      id: "freebuff",
      name: "FreeBuff",
      description:
         "FreeBuff CLI — free, ad-supported coding agent built on the Codebuff platform.",
      binaries: ["freebuff"],
      configPath: "~/.config/manicode/settings.json",
      ...
```

Double-quoted strings, 3-space indentation. If what you see with `cat` right
now differs from this, say so explicitly in your report — but check for
real, don't assume it already matches.

## Target state

`packages/core/src/adapters/freebuff.ts` uses 2-space indentation and
single-quoted strings throughout, structurally matching
`packages/core/src/adapters/junie.ts` and `packages/core/src/adapters/pi.ts`.
No logic, path, option value, or comment content changes — whitespace and
quote-character changes only.

## Read first

- `packages/core/src/adapters/junie.ts` — the exact style to match
- `packages/core/src/adapters/pi.ts` — second reference
- `packages/core/src/adapters/freebuff.ts` — read it with `cat`, not from
  memory of a previous task's claim

## Allowed scope

- `packages/core/src/adapters/freebuff.ts`

## Forbidden scope

- `packages/core/src/adapters/index.ts`
- `packages/core/src/agent-catalog.json`
- any other file

## Exact requirements

1. Rewrite `packages/core/src/adapters/freebuff.ts` using 2-space
   indentation and single-quoted strings throughout — every string literal,
   every indent level.
2. After editing, run `cat packages/core/src/adapters/freebuff.ts` again and
   paste that real output as "AFTER" in your final report. Do not summarize
   or describe it — paste the literal file content.
3. Confirm with a real command (not a claim) that no double-quoted string
   literals remain: run `grep -n '"' packages/core/src/adapters/freebuff.ts`
   and paste its real output. It should print nothing (or only match
   apostrophes/characters that are not part of a string-quoting change —
   if there's any legitimate double-quote usage, e.g. inside a comment
   quoting something, explain it explicitly; otherwise the grep should be
   empty).
4. Run the build and paste real output.

## Non-goals

- Any logic, path, or option-value change.
- Touching `index.ts` or `agent-catalog.json` again.

## Implementation constraints

- Manual, targeted whitespace/quote edits only.
- Smallest correct diff in terms of semantic content (the file's logic is
  unchanged; only its literal characters for quoting/indentation change).

## Interface / contract

No change.

## Dependencies

- Upstream: none
- Downstream: M012 (Cline) cannot start until this is actually fixed and
  merged

## Verification

Run, in this exact order, and paste the REAL output of every one:

```bash
cat packages/core/src/adapters/freebuff.ts
# (make your edits here)
cat packages/core/src/adapters/freebuff.ts
grep -n '"' packages/core/src/adapters/freebuff.ts
pnpm --filter @ai-agent-config/core build
git status --short
```

## Expected evidence

The final report MUST include, verbatim, not summarized:

- the BEFORE `cat` output
- the AFTER `cat` output
- the `grep -n '"'` output (expected: empty or explained)
- the build output
- `git status --short`

A report that describes the file instead of pasting its real content will be
treated as unverified and this task will be redispatched again.

## Completion criteria

The task is complete only when the AFTER `cat` output pasted in the report
actually shows 2-space indentation and single quotes throughout, and the
`grep -n '"'` check confirms no stray double-quoted strings remain.

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- packages/core/src/adapters/freebuff.ts

COMMANDS_RUN:
```text
<paste the REAL, literal output of every command above, including full file contents>
```

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
