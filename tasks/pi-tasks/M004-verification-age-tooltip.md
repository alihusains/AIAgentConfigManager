# M004 — Show verification age on the providers table

## Identity

- Task ID: M004
- Parent workstream: community-issues-batch-1
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 2afb991f441db05d7605a3c31f8987ec7bfcdba5
- Branch: pi/M004-verification-age-tooltip
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M004-verification-age-tooltip
- Type: feature
- Priority: P3
- Dependencies: M001 (same file — this task only starts after M001 merged; it now has)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M004-verification-age-tooltip`

Work ONLY within these repository paths:

- `packages/gui/src/components/ProvidersView.tsx`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies unless explicitly authorized.

Do not redesign the architecture.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## IMPORTANT — formatting

Do NOT reformat this file. It currently uses single-quoted strings and the
existing line-wrapping/indentation style throughout. Match that exactly.
Change ONLY the specific lines needed for this feature — no quote-style
conversion, no re-wrapping of untouched lines, no `prettier`/formatter run
over the whole file. A diff that touches lines outside the actual feature
will be rejected in review.

## Why this task exists

The providers table's "APIs Available" column (`ProvidersView.tsx`, main
table body, ~lines 118-132) shows badges like "Chat" / "Responses" or
"not verified" / "no API confirmed", but never shows *when* the verification
happened — `apiCapabilities.verifiedAt` exists on the type (it's already
displayed elsewhere, e.g. inside `ProviderDetailsModal` and
`EditProviderModal`, both further down in this same file) but is not surfaced
in this table cell. A verification from months ago looks exactly as "current"
as one from five minutes ago.

## Current state

- `apiCapabilities?: ProviderApiCapabilities` is available in this table row's
  destructured scope (see `providers.map(({ provider, models, agentIds,
  apiCapabilities }) => { ... })` a few lines above the cell in question).
- `ProviderApiCapabilities.verifiedAt` is a timestamp already used elsewhere in
  this file as `new Date(caps.verifiedAt).toLocaleString()`.
- The table cell currently renders only the "not verified" / "no API
  confirmed" / badge-list states, with no age or timestamp information at all.

## Target state

The same table cell additionally communicates verification age:

- When `apiCapabilities` exists and `apiCapabilities.supported.length > 0`
  (the badge-list branch), the cell (or a wrapping element) carries a `title`
  attribute with the full verification timestamp
  (`new Date(apiCapabilities.verifiedAt).toLocaleString()`), and — when the
  verification is older than 30 days — a subtle, small, visually
  de-emphasized suffix showing "n days ago" alongside the badges.
- The "no API confirmed" case may also show the timestamp/tooltip if that's
  the smallest correct way to do it (it still has a `verifiedAt` from the
  failed attempt) — use judgment, this is not the primary case the issue
  names, don't over-build it.
- The "not verified" case is unchanged (there is no `verifiedAt` to show).

## Read first

### Current code

- `packages/gui/src/components/ProvidersView.tsx` — specifically:
  - the table row destructuring and the "APIs Available" `<td>` (~lines
    95-132)
  - `ProviderDetailsModal`'s existing verified-timestamp rendering (search for
    `caps.verifiedAt`) as the reference pattern for formatting the date
  - the `ProviderApiCapabilities` type import at the top of the file

### Reference / specification

- `docs/community-issues.md` item **#10** ("Show verification age on the
  providers table")

## Allowed scope

- `packages/gui/src/components/ProvidersView.tsx`

## Forbidden scope

- any other file
- unrelated refactors
- dependency upgrades
- architecture changes
- formatting-only changes outside touched code (see "IMPORTANT — formatting"
  above — this is non-negotiable for this task)
- changing `ProviderDetailsModal`, `EditProviderModal`, or `AddProviderModal`
  behavior

## Exact requirements

1. Add a `title` attribute (or equivalent hover tooltip) showing the full
   verification timestamp to the badge-list branch of the "APIs Available"
   table cell, using `apiCapabilities.verifiedAt`.
2. When the verification is more than 30 days old, show a small, visually
   secondary "n days ago" suffix next to the badges (e.g. reusing an existing
   utility text class like `text-xs text-tertiary` already used elsewhere in
   this file — do not invent a new one unless nothing fits).
3. Do not change the "not verified" branch.
4. Do not change any other column or row in the table.

## Non-goals

- Changing how verification age is shown in `ProviderDetailsModal` or
  `EditProviderModal`.
- Adding a re-verify action from the table row.
- Changing the 30-day threshold semantics anywhere else in the app.

## Implementation constraints

- Preserve public APIs unless explicitly required.
- Follow existing naming and module conventions.
- Follow existing error handling.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions (no new date-formatting utility
  module for one call site — inline it, matching how the rest of the file
  already calls `new Date(...).toLocaleString()` directly).
- Do not change unrelated behavior.
- Preserve the file's exact existing formatting style (single quotes, current
  line-wrapping) — see "IMPORTANT — formatting" above.

## Interface / contract

`ProviderApiCapabilities` (imported from `@ai-agent-config/core`) is read-only
here — do not change its shape.

## Dependencies

- Upstream: M001 (already merged to `main` — this task's worktree/branch was
  created from `main` after that merge, so `ProvidersView.tsx` already has
  M001's Edit Provider changes; do not revert or conflict with them)
- Downstream: none

## Verification

Run (this worktree needs its own install first — pnpm workspace symlinks are
not shared automatically into a fresh `git worktree`):

```bash
pnpm install --frozen-lockfile
pnpm --filter @ai-agent-config/gui typecheck
pnpm --filter @ai-agent-config/gui build
```

Also verify:

- `git status --short`
- `git diff --stat` shows changes ONLY in `ProvidersView.tsx`, and the diff
  itself (`git diff`) touches only the lines needed for this feature — no
  quote-style or whitespace churn on untouched lines
- describe the exact runtime behavior in the report (no GUI test harness
  exists in this package — static/typecheck verification plus a clear
  code-level walkthrough is acceptable), including what the tooltip and the
  "n days ago" suffix look like for a fresh verification vs. one older than
  30 days

## Expected evidence

The final report must include:

- exact commands executed
- real output or relevant excerpts
- files changed
- tests and results
- runtime evidence where applicable
- limitations or failures

## Completion criteria

The task is complete only when:

- all requirements are implemented
- no non-goal behavior was changed
- scope is respected
- required verification passes
- the diff has been reviewed for accidental changes
- no unresolved issue remains

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
