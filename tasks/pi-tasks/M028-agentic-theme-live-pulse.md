# M028 — "Agentic" theme: a live-status pulse for active/installed agents

## Identity

- Task ID: M028
- Parent workstream: agents-tab-revamp-2
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: working tree HEAD (main, with many other uncommitted changes already present — do not discard them)
- Branch: none — sequential execution directly in the repository (no worktree isolation)
- Worktree: none (main checkout)
- Type: feature
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager`

Work ONLY within these repository paths:

- `packages/gui/src/index.css`
- `packages/gui/src/components/Sidebar.tsx`

Do NOT touch `packages/gui/src/components/AgentsView.tsx` or
`packages/gui/src/components/Dashboard.tsx` — a later task (M025) rebuilds
the Agents tab table and will apply this same pulse class there once it
exists; touching those files now risks a merge conflict with that task.

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work —
the working tree already has many other uncommitted changes from earlier
work; leave everything outside your allowed scope untouched.

Do not introduce new dependencies (no animation libraries — pure CSS only).

Do not redesign the color palette, typography, or layout — this task adds
ONE new reusable CSS utility (a subtle "live" pulse) and applies it to ONE
existing element (the sidebar's per-agent "on" badge). Nothing else changes.

Do not broaden scope — do not add neon glow, scanlines, glitch effects, or
any other decorative effect. This is a config-management tool, not a
sci-fi/cyberpunk product; the direction here is "developer tool that clearly
shows something autonomous is running," expressed with restraint.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The user asked for the app to read as more "agentic" — i.e. it should feel
like a control surface for live, running agent processes, not a generic
static admin-panel table. Checked against this project's own design-taste
reference material (the ui-ux-pro-max skill's local style/color datasets),
the closest fit for a developer-facing config tool is the existing
"Developer Tool / IDE dark" direction this app already uses (dark slate
background, single confident accent — this app's teal), NOT a neon/cyberpunk
or chatbot-style skin (both were considered and explicitly rejected as
mismatched for a config-management dashboard: cyberpunk-ui carries a
documented high accessibility risk and a gaming/entertainment connotation
that doesn't fit; the AI-chatbot styles assume a conversational layout this
app doesn't have).

The concrete, bounded expression of "agentic" chosen for this app: an
installed/active agent's status indicator should read as a *live* thing —
a small, slow, breathing pulse — rather than a flat static badge. This is
the single most legible way to communicate "these are running processes I'm
watching," without adding decorative noise.

## Current state

`packages/gui/src/index.css` already defines `@keyframes spin` (used by
`.spinner`/`.animate-spin`) and already respects
`prefers-reduced-motion: reduce` globally (see the block near the end of the
file that forces `animation-duration: 0.01ms !important` etc. for
`*, *::before, *::after` under that media query — the new animation
automatically inherits this protection; do not duplicate the reduced-motion
override).

`packages/gui/src/components/Sidebar.tsx`'s per-agent nav row renders:

```tsx
{agent.detection.installed ? (
  <span className="badge badge-success">on</span>
) : (
  <span className="badge badge-neutral">—</span>
)}
```

## Target state

1. A new CSS utility class in `packages/gui/src/index.css`, placed near the
   existing `.badge`/`.badge-success` rules:

```css
/* "Live" status dot — a slow, subtle breathing pulse for genuinely running/
   installed agents. Respects prefers-reduced-motion via the existing global
   override elsewhere in this file; nothing extra needed here. */
.live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-success);
  flex-shrink: 0;
  animation: live-pulse 2.2s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-success) 45%, transparent);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-success) 0%, transparent);
  }
}
```

   (Exact values are a strong reference; keep the spirit — small, slow,
   low-amplitude, using the existing `--accent-success` token, no new color
   introduced. Adjust size/timing by a small amount only if it visibly
   clashes with the existing `.badge` sizing next to it.)

2. In `packages/gui/src/components/Sidebar.tsx`, add the dot inside the
   existing "on" badge (do not remove the badge or its text) so the badge
   reads as `● on` instead of plain `on`:

```tsx
{agent.detection.installed ? (
  <span className="badge badge-success">
    <span className="live-dot" />
    on
  </span>
) : (
  <span className="badge badge-neutral">—</span>
)}
```

   The `.badge` class already uses `display: inline-flex; align-items: center;`
   (confirm this in the file before assuming it — if it doesn't, add
   `gap: 4px` inline or via a small scoped addition so the dot and text don't
   collide; do not restructure `.badge` itself if avoidable).

## Read first

### Current code

- `packages/gui/src/index.css` — read the `.badge`/`.badge-success` rules,
  the existing `@keyframes spin`/`.animate-spin` for the established
  animation-utility convention, and the `prefers-reduced-motion` block near
  the end of the file
- `packages/gui/src/components/Sidebar.tsx` — the per-agent nav row (search
  for `badge-success`)

## Allowed scope

- `packages/gui/src/index.css`
- `packages/gui/src/components/Sidebar.tsx`

## Forbidden scope

- `packages/gui/src/components/AgentsView.tsx`
- `packages/gui/src/components/Dashboard.tsx`
- any other file
- new dependencies
- any color-palette or typography change
- any decorative effect beyond the single pulse described (no glow text-
  shadow, no scanlines, no glitch)

## Exact requirements

1. Add the `.live-dot` class and `@keyframes live-pulse` to `index.css`
   exactly as specified (small tuning allowed, spirit preserved).
2. Wire it into the Sidebar's "on" badge exactly as specified — the badge
   keeps its "on" text, gains a leading pulsing dot.
3. Do not touch the "not installed" (`badge-neutral`) branch.
4. Confirm the animation is inert under `prefers-reduced-motion: reduce`
   (it should be, via the existing global override — verify this is true by
   reading that block, do not add a duplicate override).

## Non-goals

- Applying the pulse anywhere else (Dashboard/AgentsView — that's M025's job
  once it exists, using this same `.live-dot` class).
- Any other visual/theme change.

## Implementation constraints

- Pure CSS animation, no JS-driven animation, no new dependency.
- Follow existing naming conventions (`kebab-case` CSS classes matching the
  rest of the file).
- Prefer the smallest correct diff.

## Interface / contract

New CSS class `.live-dot` (no props) — a plain empty `<span className="live-dot" />`.
This name/shape is frozen: a later task (M025) will reuse `.live-dot` by
this exact class name in the Agents tab table.

## Dependencies

- Upstream: none
- Downstream: M025 will reuse the `.live-dot` class in the Agents tab table

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
pnpm --filter @ai-agent-config/gui run typecheck
pnpm --filter @ai-agent-config/gui run build
```

Also verify:

- `git status --short` shows changes ONLY in the allowed-scope files
- `git diff --name-only` matches the allowed scope exactly
- `.live-dot` and `@keyframes live-pulse` exist in `index.css`
- the Sidebar's installed-agent badge now renders the dot + "on" text

## Expected evidence

The final report must include:

- exact commands executed
- real output of both verification commands
- files changed (`git diff --name-only`)
- the exact CSS added (paste it)
- the exact Sidebar.tsx change (paste it)

## Completion criteria

The task is complete only when:

- the CSS utility and Sidebar wiring exist exactly as specified
- no non-goal behavior or file changed
- scope is respected
- typecheck and build both pass
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
