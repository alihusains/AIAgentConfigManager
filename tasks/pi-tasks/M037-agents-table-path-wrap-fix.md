# M037 — Fix Config Path / MCP File columns wrapping character-by-character in Agents table

## Identity

- Task ID: M037
- Parent workstream: bugfix (founder-reported, screenshot evidence)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M037-agents-table-path-wrap-fix
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M037-agents-table-path-wrap-fix
- Type: bug
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M037-agents-table-path-wrap-fix`

Work ONLY within these repository paths:

- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/index.css` (add a scoped rule for this table only — do not modify the shared `.table` class used by Providers/MCP tables, which were just redesigned and must not regress)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not touch `ProvidersView.tsx` or `MCPView.tsx` — their tables were just redesigned in a separate workstream and are out of scope here.

Do not broaden scope — this is a single visual bug fix, not a table redesign.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder took a screenshot of the live Agents page (`/agents` view, Installed Agents table) showing the "Config Path" and "MCP File" columns rendering their path text one character (or 2-3 characters) per line — e.g. `~/.cod` / `ex/` / `con` / `fi` / `g.t` / `oml` stacked vertically instead of a normal wrapped path. This makes those two columns unreadably tall and the table visually broken.

## Current state

Read `packages/gui/src/components/AgentsView.tsx` around lines 655–725 (the Config File / Config Path / MCP File `<td>` cells). The relevant markup is:

```tsx
<td className="font-mono text-xs break-all max-w-0" style={{ maxWidth: 220 }}>
  <div className="flex items-center gap-1.5">
    <span className="flex-1 min-w-0">{row.configPath}</span>
    <button ...><Edit size={13} /></button>
  </div>
  ...
</td>
```

and similarly for the MCP File column with `style={{ maxWidth: 180 }}`.

Root cause: `.break-all` (`packages/gui/src/index.css` line ~553, `word-break: break-all`) removes the normal minimum-content-width floor a text node would otherwise impose. Combined with `.min-w-0` on the flex child and NO `table-layout: fixed` on `.table` (`packages/gui/src/index.css` line ~1345), the browser's auto table-layout algorithm is free to shrink this column's computed width down far below the intended 220px/180px `max-width`, and `break-all` then wraps at literally any character boundary once the available width is that narrow. The `max-w-0` utility class on the `<td>` (defined elsewhere in `index.css` — check what it does) may also be fighting the inline `style={{ maxWidth: 220 }}` in ways worth understanding, though inline styles normally win on specificity for the same property.

This table (`AgentsView.tsx`'s Installed Agents table) was NOT part of the recent GUI redesign workstream (which touched Sidebar, Dashboard, ProvidersView, MCPView, and shared `ui/` primitives) — do not assume any of that work is related; treat this as an isolated, pre-existing bug now visible in a screenshot.

## Target state

The Config Path and MCP File columns must render their path text wrapped at reasonable word/path-segment boundaries (or truncated with an ellipsis and a `title` tooltip showing the full path — your choice, whichever better matches how the rest of this table already handles long text; check if `text-tertiary` truncation patterns already exist elsewhere in this file first), never one character per line. The column must not be allowed to collapse to a near-zero width regardless of how many columns exist in the table.

Recommended approach (adjust if you find a better one that fits this codebase's existing patterns, but the acceptance bar is: no more than one path-segment worth of characters per wrapped line, at a reasonable minimum column width of roughly 140–220px):
- Replace `break-all` with `break-words` / `overflow-wrap: anywhere` (wraps at reasonable points, still allows breaking a very long unbroken path segment if truly necessary, without breaking at every single character when width is merely tight) — OR
- Give the `<td>` (or the `.table` this specific table uses, scoped via a table-specific class so it doesn't leak into Providers/MCP tables) an explicit `min-width` matching the intended `max-width` (e.g. `min-width: 180px` alongside `max-width: 220px`) so the browser's auto layout can't collapse it below a sane floor.
- A combination of both is fine and likely most robust.

Do not change the actual path data being displayed, the edit-file button behavior, or the "model:"/"keys:" sub-rows beneath the main path — this is a pure CSS/layout fix.

## Read first

### Current code

- `packages/gui/src/components/AgentsView.tsx` (lines ~570–730, the Installed Agents table markup, especially the Config File/Config Path/MCP File `<td>` cells)
- `packages/gui/src/index.css` — the `.break-all` definition (~line 553), the `.table`/`.table-container` rules (~lines 1341–1377), and whatever `.max-w-0` currently does

### Reference / specification

- None beyond this task file and the founder's screenshot description above.

### Tests

- `packages/gui/src/smoke.test.tsx` — check for any AgentsView assertions; keep them passing.

## Allowed scope

- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/index.css` (a new scoped rule/class for this table's path columns only — do not edit the shared `.table`, `.break-all`, or any class also used by `ProvidersView.tsx`/`MCPView.tsx` in a way that changes their rendering; if you must touch a shared class, first confirm via grep that no other view relies on the specific behavior you're changing, and prefer adding a new modifier class over editing the shared one)

## Forbidden scope

- `packages/gui/src/components/ProvidersView.tsx`
- `packages/gui/src/components/MCPView.tsx`
- Any change to what data is displayed or the edit/uninstall/update action behavior
- Any redesign beyond fixing the wrapping bug

## Exact requirements

1. Config Path column text wraps at reasonable boundaries (or truncates with a tooltip) — never one character per line — at any realistic browser width.
2. MCP File column: same fix.
3. No regression to the edit-file button, the "model:"/"keys:" sub-rows, or any other column in this table.
4. No change to `ProvidersView.tsx` or `MCPView.tsx` and no regression to their already-redesigned tables (verify by visually checking those two pages still render correctly after your CSS change, since `.table`/`.break-all` are shared class names).

## Non-goals

- No broader Agents table redesign (avatar-stacks, hover actions, etc.) — that is out of scope for this bugfix.
- No change to the sidebar "Agents" count badge or the "Installed Agents 22/37" stat — those are a separate, unrelated question the founder also flagged visually but did not ask to be changed in this task; do not touch `Sidebar.tsx` or the agents-count logic.

## Implementation constraints

- Preserve public component exports/props.
- Prefer the smallest correct diff.
- Do not introduce a table library or any new dependency.
- No speculative abstractions.

## Interface / contract

`AgentsView` external usage must not change. No data-shape changes.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M037-agents-table-path-wrap-fix
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` within allowed scope only
- Start the GUI dev server (or `node packages/cli/dist/index.js start` against a real/temp registry), open the Agents page, visually confirm the Config Path / MCP File columns now wrap normally (screenshot or describe exactly what you see, e.g. "path now wraps at `/` boundaries, 2–3 lines max, no single-character lines")
- Open the Providers and MCP Servers pages in the same session and confirm their tables still render exactly as before (no regression from any shared-class change)
- Then stop the server

## Expected evidence

- exact commands executed
- real build/test output
- files changed
- a clear before/after description (or screenshot path) of the Agents table columns
- explicit confirmation Providers/MCP tables are unaffected
- limitations or failures

## Completion criteria

- requirement implemented and visually confirmed
- no regression to Providers/MCP tables
- scope respected
- verification passes
- diff reviewed for accidental changes

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
