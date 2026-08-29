# M040 — Audit every README.md / productroadmap.md claim against source

## Identity

- Task ID: M040
- Parent workstream: Phase 0 closeout (CHECKPOINT.md §5 / §8 exit criteria)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M040-readme-roadmap-claims-audit
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M040-readme-roadmap-claims-audit
- Type: docs
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M040-readme-roadmap-claims-audit`

Work ONLY within these repository paths:

- `README.md`
- `productroadmap.md`
- `ROADMAP.md`
- `docs/audits/readme-roadmap-claims-audit.md` (new file — your audit trail)

Read every file listed in "Read first" before writing anything.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Every factual claim you touch must be re-verified against actual source (run the command, read the actual file, count the actual thing) — never trust the existing prose, and never trust this task file's own numbers either, since the codebase has changed since this task was written (a full GUI redesign workstream, M029–M037, just landed).

Do not broaden scope into fixing unrelated prose/style issues — only correctness of factual claims.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

CHECKPOINT.md §8 (Definition of Done for Phase 0) lists "Every claim in README and productroadmap.md re-verified against source" as an unchecked item, and productroadmap.md's own Phase 0 exit criteria says: "README claims audited against reality; anything not yet true is removed or marked planned." This project has a documented history of stale/wrong counts propagating because someone trusted a summary instead of the source (CHECKPOINT.md §0) — this task exists specifically to not repeat that.

## Current state

Read `README.md`, `productroadmap.md`, and `ROADMAP.md` in full. They contain specific, checkable factual claims: adapter counts, test counts, bundle sizes, which bugs are fixed vs. open, which features exist vs. are planned, phase completion status. Recent commits have changed several of these underlying facts (adapter count, test count, the GUI redesign status, the new skill-copy feature, the M037 path-wrap fix, M038/M039's own findings if they've landed by the time you run this — check `git log --oneline -30` on `main` first to know what's actually landed).

## Target state

Every specific, checkable claim in these three files verified against real source, with corrections applied directly to the docs where a claim is now wrong, and a full audit trail written to `docs/audits/readme-roadmap-claims-audit.md` listing each claim checked, the command/method used to verify it, and the verdict (confirmed / corrected / removed).

Specifically re-verify, using the real commands (do not estimate):
1. Adapter count — count entries in the `adapters` Map in `packages/core/src/adapters/index.ts`, not by listing files (a stated project convention — see CHECKPOINT.md §3).
2. Test counts — run `pnpm test` fresh and record the real per-package and total numbers.
3. Build/bundle sizes — run `pnpm build` fresh and record real output.
4. Any claim about a specific bug being "fixed" or "regressed" — check git log / the actual current code for that bug, not just the prose.
5. Any claim about GUI redesign phase status — check against what's actually landed on `main` (the full M029–M037 workstream) versus what the docs currently describe (they may still describe the OLD pre-redesign state, or the OLD v1 epic's teal-green palette rather than the new v2 electric-violet/signal-green palette that superseded it).
6. Any claim about skill management — the docs likely do not yet mention the new cross-agent skill-copy feature (M030/M036) at all; if the README's feature list should include it, add an honest, accurate line (do not oversell — this project's stated policy is "a fake tab is worse than an absent one," the documentation equivalent is a false claim is worse than a missing one).
7. Phase 0 exit-criteria checklist in `CHECKPOINT.md` is explicitly OUT of scope for editing in this task (that file is for the next session's hand-off, not for you to declare closed) — only `README.md`/`productroadmap.md`/`ROADMAP.md` are in scope.

Where a claim cannot be verified (no reliable source of truth exists), mark it explicitly as unverifiable in the audit trail rather than silently leaving it or guessing.

## Read first

### Current code

- `README.md`, `productroadmap.md`, `ROADMAP.md` (full files)
- `packages/core/src/adapters/index.ts` (the adapters Map — the actual source of truth for adapter count)
- `git log --oneline -30` on `main` (to know what has actually landed recently)
- `docs/epics/agentic-control-plane-redesign-v2.md` (the current design contract, if the docs still reference the old v1 epic)

### Reference / specification

- `CHECKPOINT.md` (background on what changed this cycle and the project's stated documentation standards)

### Tests

- N/A — this is a documentation task; `pnpm test` is run only to get real current numbers to cite, not because you're changing test files.

## Allowed scope

- `README.md`
- `productroadmap.md`
- `ROADMAP.md`
- `docs/audits/readme-roadmap-claims-audit.md` (new file)

## Forbidden scope

- Any source code file (`.ts`/`.tsx`/`.json`)
- `CHECKPOINT.md` (leave it as-is; it's a separate hand-off artifact, not part of this audit's scope)
- Any test file

## Exact requirements

1. Every specific factual claim in the three docs is checked against real, current source (with the actual command/verification method recorded).
2. Wrong claims are corrected in place; claims describing features not yet built are marked as planned, not stated as done; claims that are now stale (e.g. describing the pre-redesign GUI) are updated to reflect the current v2 state.
3. A full audit trail is written to `docs/audits/readme-roadmap-claims-audit.md`.
4. No claim is removed or softened without a real reason recorded in the audit trail — do not weaken an accurate claim.

## Non-goals

- No prose/style rewriting beyond what's needed to fix a factual inaccuracy.
- No changes to `CHECKPOINT.md`.
- No code changes of any kind.
- No declaring Phase 0 "complete" — that determination belongs to the founder/lead, not this task; just report the facts.

## Implementation constraints

- Preserve the existing structure/tone of each document; this is a correctness pass, not a rewrite.
- Prefer the smallest correct diff per claim.

## Interface / contract

N/A.

## Dependencies

- Upstream: none (informational awareness of M037/M038/M039 landing, not a hard blocking dependency)
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M040-readme-roadmap-claims-audit
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Also verify:

- `git status --short` within allowed scope only
- Every number cited in your corrections matches the real command output you captured, quoted in the audit trail

## Expected evidence

- exact commands executed
- real numbers captured for every claim checked
- the full list of corrections made, with before/after text for each
- files changed
- limitations or failures

## Completion criteria

- all three docs' factual claims verified
- corrections applied where wrong, with an audit trail
- no unverified claim silently left uncorrected
- no source-code changes

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
