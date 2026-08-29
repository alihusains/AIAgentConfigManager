# M029 — Design token system v2 (dark-mode-first, electric violet accent)

## Identity

- Task ID: M029
- Parent workstream: AgentControl GUI redesign v2 (premium dark-mode-first aesthetic)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 3102310
- Branch: pi/M029-design-tokens-v2
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M029-design-tokens-v2
- Type: refactor
- Priority: P0
- Dependencies: none (this is the foundation every other GUI task in this workstream depends on)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M029-design-tokens-v2`

Work ONLY within these repository paths:

- `packages/gui/src/index.css`
- `packages/gui/index.html` (font `<link>` tags only)
- `docs/epics/agentic-control-plane-redesign-v2.md` (new file you create — the new canonical spec, see below)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new npm dependencies unless explicitly authorized below (Google Fonts via `<link>` is pre-authorized; no JS animation/theming libraries).

Do not touch any component `.tsx` file in this task — token definitions only. Components consuming new tokens are separate downstream tasks (M031–M035).

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder has requested a full v2 visual redesign of the GUI superseding the current design system (docs/epics/agentic-control-plane-redesign.md, which specified `#159f84` teal-green as brand accent). The founder explicitly chose "Replace it (v2)" over "Extend it" when asked. This task establishes the new token foundation so downstream component tasks (sidebar, dashboard, tables, buttons) have a single source of truth to consume.

This project has already been burned once by an under-specified palette failing WCAG AA at small text sizes (see `docs/audits/E7-audit-report.md` and CHECKPOINT.md §5 Step 3) and by two divergent dark-theme definitions (`@media (prefers-color-scheme)` vs `html[data-theme='dark']` resolving to different values). Both mistakes must not be repeated.

## Current state

`packages/gui/src/index.css` currently defines (do not assume these values carry over — you are replacing the palette, not just re-theming it):
- `:root` — light theme tokens, teal-green accent family (`--accent-primary: #159f84`, `--accent-primary-text: #0d7a63`, etc.)
- `html[data-theme='dark']` — dark theme tokens (this project fixed a prior bug where `@media (prefers-color-scheme: dark)` and `html[data-theme='dark']` disagreed; there must be exactly ONE source of truth per theme, never two independently-maintained blocks for the same theme)
- Inter (body) + JetBrains Mono (monospace) loaded via Google Fonts link tag in `packages/gui/index.html`
- A spacing/radius scale already exists; you are replacing values, not the existence of the scale

Read `packages/gui/src/index.css` fully first to understand current token names — you MUST keep every existing `--token-name` that is currently referenced by component code (do not rename or delete a token whose old name is still used elsewhere in the codebase; you are not allowed to touch component files in this task, so any token you keep must keep working with zero component changes). Use `grep -rn "var(--" packages/gui/src/index.css packages/gui/src/components packages/gui/src/ui` to get the exhaustive list of every token name in use before you touch anything.

## Target state

A new token system in `packages/gui/src/index.css`, dark-mode-first (dark is the default when no `data-theme` attribute and no explicit light preference — i.e. dark renders under both `:root` unqualified AND `@media (prefers-color-scheme: dark)` must resolve identically, exactly like the current codebase already guarantees — do not reintroduce two divergent dark blocks), plus a fully-designed light theme mirroring the same hierarchy (not an inverted-color reskin).

### Exact palette (lead decision — implement these exact values, do not invent your own; if a value below turns out ambiguous, use the closest reasonable interpretation and note it in KNOWN_ISSUES rather than blocking)

**Dark theme (default):**
```
--canvas: #0e0e13;          /* deep warm charcoal/graphite base, NOT pure black */
--surface: #16161d;         /* raised panel background */
--surface-2: #1c1c25;       /* card / table row background */
--surface-glass: rgba(28, 28, 37, 0.62);  /* for backdrop-filter: blur(20px) panels */
--border: #2b2b37;
--border-strong: #3a3a4a;
--text-primary: #f3f2f8;
--text-secondary: #b7b4c4;
--text-tertiary: #8b899b;   /* MEASURE this — see WCAG requirement below; adjust if it fails */
--accent-primary: #7c5cff;  /* electric violet — brand, non-text uses only: fills, borders, active indicators, focus rings, status dots */
--accent-primary-text: #b6a3ff; /* text-safe variant of --accent-primary for dark bg; MEASURE and adjust to pass AA */
--accent-success: #22e6a0;  /* signal green — brand, non-text uses only */
--accent-success-text: #5eeab8; /* text-safe variant for dark bg; MEASURE and adjust to pass AA */
--accent-warning: #ffb020;
--accent-warning-text: #ffb020; /* MEASURE; adjust if it fails AA on dark */
--accent-error: #ff5c72;
--accent-error-text: #ff8a9a;   /* text-safe variant for dark bg; MEASURE and adjust */
--accent-info: #5b9dff;
--accent-info-text: #8ab8ff;    /* text-safe variant for dark bg; MEASURE and adjust */
```

**Light theme:**
```
--canvas: #f7f6fb;
--surface: #ffffff;
--surface-2: #f0eef7;
--surface-glass: rgba(255, 255, 255, 0.68);
--border: #e3e0ec;
--border-strong: #cfccdc;
--text-primary: #17151f;
--text-secondary: #4c4959;
--text-tertiary: #6b687a;   /* MEASURE — see WCAG requirement */
--accent-primary: #6a3ff0;  /* brand, non-text uses only */
--accent-primary-text: #5326d1; /* text-safe variant for light bg; MEASURE and adjust */
--accent-success: #0f9d70;  /* brand, non-text uses only (deeper than dark-mode value for light-bg legibility) */
--accent-success-text: #0c7d5a; /* text-safe variant; MEASURE and adjust */
--accent-warning: #b3690a;
--accent-warning-text: #8f5407; /* MEASURE and adjust */
--accent-error: #d1364c;
--accent-error-text: #ad2038;   /* MEASURE and adjust */
--accent-info: #2f68c9;
--accent-info-text: #2454a3;   /* MEASURE and adjust */
```

**Semantic colors:** exactly 3 (`success`, `warning`, `error`) plus `info` as a 4th non-brief-mandated-but-already-existing status color — keep all 4 since `info` is already used by existing status/badge components you are not touching.

**WCAG requirement (non-negotiable, learned from this project's own history):** every `-text` suffixed token (and every token used for text anywhere in the existing component code per your grep above) must measure ≥4.5:1 contrast against both `--canvas` and `--surface`/`--surface-2` it is likely to render on, for both themes. Use a real contrast calculation (WCAG relative luminance formula), not eyeballing. Where a value above fails, adjust it (keep it recognizably the same hue family) until it passes, and record the final measured ratio in your final report as a table: `token | theme | background | ratio`. The brand-only tokens (`--accent-primary`, `--accent-success`, etc., without `-text`) do NOT need to pass text contrast — they are for fills/borders/dots only; never use them for text purposes in this task since you are not touching components, but document this rule with a one-line CSS comment above each brand token, e.g. `/* brand-only; use --accent-primary-text for readable text */`.

**Typography:**
- Add **Space Grotesk** (Google Fonts, variable weight 400–700) as the new display face for headers (`h1`–`h3`) and stat numbers, with `font-variant-numeric: tabular-nums` applied via a `.numeric-display` or `.stat-figure` utility class (add the class definition; you don't need to apply it to any component in this task).
- Keep **Inter** for body/table text and **JetBrains Mono** for monospace — do not remove these, they are already correctly loaded and used by existing components.
- Add the Space Grotesk `<link>` tag in `packages/gui/index.html` next to the existing Inter/JetBrains Mono links, same loading pattern (`rel="preconnect"` + stylesheet link), `font-display: swap` behavior preserved.

**Radius scale:**
```
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-full: 999px;
```
Keep whatever existing radius token names are already referenced by components (from your grep) mapped onto this new scale — do not leave any existing `var(--radius-*)` reference undefined.

**Spacing scale (exactly 4/8/12/16/24px per the brief):**
```
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
```
Same rule: map any existing spacing token names onto this scale rather than leaving them undefined.

**Depth / atmosphere utilities (define as CSS custom properties + utility classes, do not apply anywhere — that's for downstream tasks):**
- `--elevation-1`, `--elevation-2`, `--elevation-3` box-shadow values appropriate to dark and light (soft, layered, not heavy drop-shadows)
- A `.glass-surface` utility class using `--surface-glass` + `backdrop-filter: blur(20px)` (with `-webkit-backdrop-filter` fallback) + a subtle `--border` outline
- A `.ambient-glow` utility class for a soft radial-gradient glow using `--accent-primary` at low opacity (for use behind key panels)
- A `.grain-texture` utility class using a small inline SVG `feTurbulence`-based data-URI background at very low opacity (2–4%) for the noise/grain texture called for in the brief — do not use an external image asset

**Invariants to hold (both are prior bugs in this exact codebase — do not reintroduce either):**
1. Dark theme must resolve identically whether reached via `@media (prefers-color-scheme: dark)` (no `data-theme` attribute set) or via `html[data-theme='dark']` (explicit toggle). Structure the CSS so both paths reference the same values (e.g. one block guarded by `:root:not([data-theme='light'])` inside the dark media query, mirrored by `:root[data-theme='dark']`, exactly as the current file already does for the existing palette — follow that existing structural pattern, just with new values).
2. No component may end up referencing a `var(--token)` that isn't defined in either theme. After your changes, every token name found by the grep in "Current state" must still resolve.

## Read first

### Current code

- `packages/gui/src/index.css` (full file — ~2800 lines, this is the single stylesheet, no Tailwind)
- `packages/gui/index.html`

### Reference / specification

- `docs/epics/agentic-control-plane-redesign.md` (the OLD spec you are superseding — read it only to understand the existing token *names* and structural pattern, not to reuse its color values)
- `docs/audits/E7-audit-report.md` (why the WCAG requirement above exists — read the contrast-failure section)
- `CHECKPOINT.md` §5 Step 3 (documents the exact brand-vs-text token split pattern already used for the old palette — replicate that pattern, not its values)

### Tests

- None exist for CSS tokens specifically; verification is manual contrast measurement + build.

## Allowed scope

- `packages/gui/src/index.css`
- `packages/gui/index.html`
- `docs/epics/agentic-control-plane-redesign-v2.md` (new file: write the final palette table, typography choices, spacing/radius scale, and the measured contrast ratio table here as the new canonical spec other Pi tasks and the lead will read)

## Forbidden scope

- Any `.tsx` file in `packages/gui/src/components/` or `packages/gui/src/ui/`
- `packages/core/`, `packages/cli/`
- Any test file
- Deleting `docs/epics/agentic-control-plane-redesign.md` (leave it; it's superseded but kept for history)
- Adding any JS dependency (animation libs, theming libs)
- Reformatting the whole file — only touch token-definition regions; leave unrelated CSS rules untouched

## Exact requirements

1. Replace the color token values in `:root` (light) and the dark theme block(s) with the palette specified above, preserving every existing token *name* referenced elsewhere in the codebase (per your grep), adding the new `-text` variants and any new tokens (spacing, radius, elevation, glass/glow/grain utilities) alongside.
2. Add Space Grotesk font loading in `packages/gui/index.html` and define `.numeric-display`/`.stat-figure` utility classes using it with tabular figures, without removing Inter/JetBrains Mono.
3. Measure and report real WCAG contrast ratios for every `-text` token against every background it could render on (canvas, surface, surface-2) in both themes; adjust any failing value and re-measure until it passes 4.5:1.
4. Add `.glass-surface`, `.ambient-glow`, `.grain-texture` utility classes (defined, unused elsewhere in this task).
5. Preserve the single-source-of-truth dark theme structure (no divergent `@media` vs `[data-theme]` blocks).
6. Write `docs/epics/agentic-control-plane-redesign-v2.md` documenting the final palette, typography, spacing/radius scale, and the measured contrast table, so downstream tasks (sidebar, dashboard, tables, buttons — M031 onward) can implement against it without re-deriving values.

## Non-goals

- Applying any new class or token to an actual component — zero `.tsx` changes in this task.
- Redesigning component layout, spacing, or structure — that's downstream work.
- Building the skill-copy feature (unrelated task, M030, different worktree).

## Implementation constraints

- Preserve every existing token name currently referenced by component code.
- Follow the existing file's structural conventions (section comments, ordering) rather than reorganizing the file.
- Do not introduce speculative abstractions (no CSS-in-JS, no new build tooling).
- Smallest correct diff — touch only the token-definition sections plus your 3 new utility classes plus the font link tags.

## Interface / contract

Downstream tasks (M031 sidebar, M032 dashboard, M033 providers table, M034 MCP table, M035 buttons/inputs) will consume exactly the token names you finalize. Do not choose token names casually — once written into `docs/epics/agentic-control-plane-redesign-v2.md`, they are the frozen contract for this workstream. If you rename or add a token beyond what's specified above, document it clearly in that file so downstream tasks can find it.

## Dependencies

- Upstream: none
- Downstream: M031, M032, M033, M034, M035 (all GUI component tasks in this workstream read the v2 spec doc you produce)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M029-design-tokens-v2
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/gui test
```

Also verify:

- `git status --short` shows changes only in the allowed scope
- `grep -rn "var(--" packages/gui/src/components packages/gui/src/ui` — every token referenced still has a definition in `index.css` (spot-check at least 15 distinct token names)
- Start the GUI dev server (`pnpm --filter @ai-agent-config/gui dev` or equivalent) and visually confirm both themes render without console errors about missing CSS, then stop the server
- The exact requested behavior: new palette values present, contrast table measured and passing, dark-theme single-source-of-truth preserved

## Expected evidence

The final report must include:

- exact commands executed
- real build/test output
- the full measured contrast ratio table (token | theme | background | ratio | pass/fail after adjustment)
- files changed
- confirmation every pre-existing token name still resolves
- limitations or failures

## Completion criteria

The task is complete only when:

- all requirements are implemented
- no non-goal behavior was changed (zero `.tsx` diffs)
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
