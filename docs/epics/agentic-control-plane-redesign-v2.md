# Epic: Agentic Control Plane redesign v2 — design token system

**Status:** Canonical spec for the v2 visual foundation (task M029). Supersedes the palette, typography, and scale decisions in `docs/epics/agentic-control-plane-redesign.md` (kept for history). Downstream component tasks (M031 sidebar, M032 dashboard, M033 providers table, M034 MCP table, M035 buttons/inputs) implement against the token names in this file — **they are the frozen contract for this workstream.**

**Direction:** premium dark-mode-first aesthetic. Electric violet brand accent (`#7c5cff` dark / `#6a3ff0` light), deep warm charcoal canvas, layered soft shadows, glass/amber atmosphere utilities. Light theme is a fully-designed mirror of the dark hierarchy, not an inverted-color reskin.

**Source of truth in code:** `packages/gui/src/index.css` (single stylesheet, no Tailwind). Dark is the default when no `data-theme` attribute is set and the OS prefers dark; `html[data-theme='dark']` and the `@media (prefers-color-scheme: dark)` block resolve to **identical** values (single-source-of-truth invariant, same structural pattern as before).

---

## 1. Color tokens

### 1.1 Dark theme (default)

| Token | Value | Role |
| --- | --- | --- |
| `--bg-canvas` / `--canvas` | `#0e0e13` | deep warm charcoal base, NOT pure black |
| `--bg-primary` / `--surface` | `#16161d` | raised panel background |
| `--bg-secondary` / `--surface-2` | `#1c1c25` | card / table row background |
| `--bg-tertiary` | `#22222d` | raised element (derived — see §7) |
| `--bg-hover` | `#22222d` | hover state |
| `--bg-active` | `#2b2b37` | active/pressed state |
| `--surface-glass` | `rgba(28, 28, 37, 0.62)` | for `backdrop-filter: blur(20px)` panels |
| `--border-primary` / `--border` | `#2b2b37` | default border |
| `--border-secondary` / `--border-strong` | `#3a3a4a` | emphasized border |
| `--border-focus` | `#b6a3ff` | focus ring (text-safe accent) |
| `--text-primary` | `#f3f2f8` | primary text |
| `--text-secondary` | `#b7b4c4` | secondary text |
| `--text-tertiary` | `#8b899b` | tertiary text (measured ≥4.5:1, §4) |
| `--text-inverse` | `#0e0e13` | text on filled accent |
| `--accent-primary` | `#7c5cff` | **brand-only** — fills, borders, active indicators, focus rings, status dots. Never use for text; use `--accent-primary-text`. |
| `--accent-primary-hover` | `#8d70ff` | hover state of brand violet |
| `--accent-primary-text` | `#b6a3ff` | text-safe variant of `--accent-primary` for dark bg |
| `--accent-success` | `#22e6a0` | **brand-only** signal green |
| `--accent-success-text` | `#5eeab8` | text-safe variant for dark bg |
| `--accent-warning` | `#ffb020` | **brand-only** |
| `--accent-warning-text` | `#ffb020` | text-safe variant (passes AA on dark) |
| `--accent-error` | `#ff5c72` | **brand-only** |
| `--accent-error-text` | `#ff8a9a` | text-safe variant for dark bg |
| `--accent-info` | `#5b9dff` | **brand-only** |
| `--accent-info-text` | `#8ab8ff` | text-safe variant for dark bg |
| `--accent-secondary` | `#8ab8ff` | legacy name, kept — now maps to info family |
| `--anthropic-accent` | `#e8927c` | categorical (unchanged) |
| `--cat-olive` | `#b3bd8a` | categorical (unchanged) |
| `--provider-anthropic` | `#d4b160` | categorical (unchanged) |
| `--provider-openai` | `#7fb3d5` | categorical (unchanged) |
| `--provider-bedrock` | `#e0a05c` | categorical (unchanged) |
| `--provider-vertex` | `#8fa3d9` | categorical (unchanged) |

### 1.2 Light theme

| Token | Value | Role |
| --- | --- | --- |
| `--bg-canvas` | `#f7f6fb` | light lavender-tinted canvas |
| `--bg-primary` | `#ffffff` | raised panel |
| `--bg-secondary` | `#f0eef7` | card / table row |
| `--bg-tertiary` | `#ffffff` | raised element |
| `--bg-hover` | `#f0eef7` | hover state |
| `--bg-active` | `#e3e0ec` | active/pressed state |
| `--surface-glass` | `rgba(255, 255, 255, 0.68)` | glass panels |
| `--border-primary` | `#e3e0ec` | default border |
| `--border-secondary` | `#cfccdc` | emphasized border |
| `--border-focus` | `#6a3ff0` | focus ring (brand violet) |
| `--text-primary` | `#17151f` | primary text |
| `--text-secondary` | `#4c4959` | secondary text |
| `--text-tertiary` | `#6b687a` | tertiary text (measured ≥4.5:1, §4) |
| `--text-inverse` | `#f7f6fb` | text on filled accent |
| `--accent-primary` | `#6a3ff0` | **brand-only** |
| `--accent-primary-hover` | `#5f34e0` | hover state of brand violet |
| `--accent-primary-text` | `#5326d1` | text-safe variant for light bg |
| `--accent-success` | `#0f9d70` | **brand-only** (deeper than dark-mode value for light-bg legibility) |
| `--accent-success-text` | `#0b7a57` | text-safe variant (adjusted from `#0c7d5a` — see §4) |
| `--accent-warning` | `#b3690a` | **brand-only** |
| `--accent-warning-text` | `#8f5407` | text-safe variant |
| `--accent-error` | `#d1364c` | **brand-only** |
| `--accent-error-text` | `#ad2038` | text-safe variant |
| `--accent-info` | `#2f68c9` | **brand-only** |
| `--accent-info-text` | `#2454a3` | text-safe variant |
| `--accent-secondary` | `#2f68c9` | legacy name, kept — maps to info family |

### 1.3 Brand vs text rule (non-negotiable)

The brand hexes (`--accent-primary`, `--accent-success`, `--accent-warning`, `--accent-error`, `--accent-info` — the ones **without** `-text`) are for **non-text uses only**: fills, borders, active indicators, focus rings, status dots. Where an accent renders as *readable text*, use the matching `-text` token. Every `-text` token and every `--text-*` token measures ≥4.5:1 against `--bg-canvas`, `--bg-primary`, and `--bg-secondary` in both themes (WCAG AA, measured with the WCAG relative-luminance formula — table in §4). Existing component code that still renders brand hexes as text (e.g. `ProviderVerify` status text, `Status` dot colors used as text) is to be migrated to the `-text` variants by the downstream component tasks (M031–M035), not by M029.

**Do not "tidy up" the brand/text duplication** — the split exists because the brand hexes fail AA at the 11–14px sizes this app uses (same failure mode as the E7 audit of the v1 teal palette).

---

## 2. Typography

| Token | Value | Use |
| --- | --- | --- |
| `--font-display` | `"Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | headers (`h1`–`h3`), stat numbers, card titles |
| `--font-sans` | `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | body / table / UI text |
| `--font-mono` | `"JetBrains Mono", "Fira Code", monospace` | identifiers, code, file paths |

- **Space Grotesk** (Google Fonts, weights 400–700) was added in M029 as the display face. `--font-display` previously aliased `--font-sans`; it now resolves to Space Grotesk, so existing rules using `var(--font-display)` (`.card-title`, `.adr-stat-value`, etc.) pick it up automatically.
- Inter and JetBrains Mono are unchanged and still loaded.
- All three are loaded via one Google Fonts `<link>` in `packages/gui/index.html` with `display=swap` (`font-display: swap`).
- **`.numeric-display` / `.stat-figure` utility class** (defined in `index.css`, not yet applied): `font-family: var(--font-display); font-variant-numeric: tabular-nums; letter-spacing: -0.01em;` — use for stat numbers and any figure that must not shift width.

Type scale unchanged: `--text-size-xs` 12 / `sm` 13 / `base` 14 / `md` 15 / `lg` 18 / `xl` 20 / `2xl` 28 / `3xl` 32 px.

---

## 3. Spacing, radius, elevation

**Spacing** (brief scale is exactly 4/8/12/16/24):

| Token | Value |
| --- | --- |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` (compat — not in brief scale, kept for existing references) |
| `--space-6` | `24px` |
| `--space-7` | `32px` (compat) |
| `--space-8` | `40px` (compat) |

**Radius:**

| Token | Value |
| --- | --- |
| `--radius-sm` | `8px` (buttons/inputs) |
| `--radius-md` | `12px` (cards) |
| `--radius-lg` | `16px` (panels) |
| `--radius-full` | `999px` |

**Elevation** — new `--elevation-1/2/3` tokens are the v2 names; legacy `--shadow-sm/md/lg/elevated` (referenced by existing components) are aliases of them, so both names resolve identically:

| Token | Dark | Light |
| --- | --- | --- |
| `--elevation-1` (`--shadow-sm`) | `0 1px 2px 0 rgb(0 0 0 / 0.35)` | `0 1px 2px 0 rgb(23 21 31 / 0.05)` |
| `--elevation-2` (`--shadow-md`) | `0 6px 14px -3px rgb(0 0 0 / 0.42), 0 2px 4px -2px rgb(0 0 0 / 0.32)` | `0 4px 12px -2px rgb(23 21 31 / 0.07), 0 2px 4px -2px rgb(23 21 31 / 0.05)` |
| `--elevation-3` (`--shadow-lg`, `--shadow-elevated`) | `0 20px 40px -10px rgb(0 0 0 / 0.55), 0 8px 16px -8px rgb(0 0 0 / 0.42)` | `0 16px 32px -8px rgb(23 21 31 / 0.14), 0 6px 12px -6px rgb(23 21 31 / 0.08)` |

Soft and layered — not heavy drop-shadows.

**Motion:** unchanged — `--transition-fast` 150ms, `--transition-normal` 200ms, `--transition-slow` 220ms (ease-out).

---

## 4. Measured WCAG contrast (M029, relative-luminance formula)

Every text-capable token measured against every background it can render on. Threshold: **4.5:1**.

### Dark theme (bg: `--bg-canvas` #0e0e13, `--bg-primary` #16161d, `--bg-secondary` #1c1c25)

| Token | Value | canvas | primary | secondary | Result |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` | `#f3f2f8` | 17.30 | 16.17 | 15.19 | PASS |
| `--text-secondary` | `#b7b4c4` | 9.48 | 8.86 | 8.32 | PASS |
| `--text-tertiary` | `#8b899b` | 5.64 | 5.27 | 4.95 | PASS |
| `--accent-primary-text` | `#b6a3ff` | 8.87 | 8.29 | 7.79 | PASS |
| `--accent-success-text` | `#5eeab8` | 12.78 | 11.95 | 11.22 | PASS |
| `--accent-warning-text` | `#ffb020` | 10.53 | 9.84 | 9.24 | PASS |
| `--accent-error-text` | `#ff8a9a` | 8.57 | 8.02 | 7.53 | PASS |
| `--accent-info-text` | `#8ab8ff` | 9.52 | 8.90 | 8.36 | PASS |

### Light theme (bg: `--bg-canvas` #f7f6fb, `--bg-primary` #ffffff, `--bg-secondary` #f0eef7)

| Token | Value | canvas | primary | secondary | Result |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` | `#17151f` | 16.79 | 18.05 | 15.71 | PASS |
| `--text-secondary` | `#4c4959` | 8.12 | 8.73 | 7.60 | PASS |
| `--text-tertiary` | `#6b687a` | 5.03 | 5.40 | 4.70 | PASS |
| `--accent-primary-text` | `#5326d1` | 7.61 | 8.18 | 7.12 | PASS |
| `--accent-success-text` | `#0b7a57` (adjusted) | 4.96 | 5.34 | 4.64 | PASS (was 4.46 at #0c7d5a) |
| `--accent-warning-text` | `#8f5407` | 5.68 | 6.11 | 5.31 | PASS |
| `--accent-error-text` | `#ad2038` | 6.42 | 6.91 | 6.01 | PASS |
| `--accent-info-text` | `#2454a3` | 6.80 | 7.31 | 6.36 | PASS |

**Adjustment made:** the brief's light `--accent-success-text: #0c7d5a` measured 4.46:1 against `--bg-secondary` (#f0eef7) — a fail. Deepened to `#0b7a57` (same hue family), now 4.96/5.34/4.64. All other brief values passed as specified.

Brand-only tokens (no `-text`) were **not** measured against the text threshold — that is the documented exception in §1.3.

---

## 5. Atmosphere utilities (defined in `index.css`, unused by components until downstream tasks apply them)

| Class | Definition |
| --- | --- |
| `.glass-surface` | `background: var(--surface-glass); backdrop-filter: blur(var(--glass-blur))` (with `-webkit-` fallback); `border: 1px solid var(--border-primary)`. `--glass-blur: 20px`. |
| `.ambient-glow` | soft radial gradient of `--accent-primary` at 16% → 6% → 0% opacity, for use behind key panels. |
| `.grain-texture` | inline SVG `feTurbulence` data-URI noise tile at 3.5% opacity, `background-repeat: repeat`. No external image asset. |
| `.numeric-display` / `.stat-figure` | Space Grotesk + `font-variant-numeric: tabular-nums` + `-0.01em` tracking (see §2). |

---

## 6. Invariants (both are prior bugs in this codebase — do not break)

1. **Single-source-of-truth dark theme.** `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `html[data-theme="dark"] { … }` hold byte-identical token values. Any token added to one MUST be added to the other.
2. **No phantom token references.** Every `var(--token)` used in `packages/gui/src/index.css`, `components/`, and `ui/` must resolve in both themes. Verify with: `grep -rn "var(--" packages/gui/src/index.css packages/gui/src/components packages/gui/src/ui`.

---

## 7. Documented deviations / derived values

- **Brief names → existing names.** The brief specifies `--canvas`, `--surface`, `--surface-2`, `--border`, `--border-strong`; the codebase (and every existing component) uses `--bg-canvas`, `--bg-primary`, `--bg-secondary`, `--border-primary`, `--border-secondary`. The brief's values were mapped onto the **existing names** (components must not change in M029). The mapping is: `--canvas`→`--bg-canvas`, `--surface`→`--bg-primary`, `--surface-2`→`--bg-secondary`, `--border`→`--border-primary`, `--border-strong`→`--border-secondary`. Downstream tasks should use the existing names.
- **`--bg-tertiary` (derived, not in brief):** dark `#22222d` (one step above `--bg-secondary`), light `#ffffff` (as before). It is a raised-surface token referenced by existing components.
- **`--accent-warning-text` (dark)** is intentionally the same value as `--accent-warning` (`#ffb020`) because it already passes AA on dark (10.53:1).
- **`--accent-secondary`** (legacy name, no v2 brief value) now maps to the info family: dark `#8ab8ff`, light `#2f68c9`.
- **`--border-focus`** uses `--accent-primary-text` in dark (`#b6a3ff`) and brand `--accent-primary` in light (`#6a3ff0`) — focus rings are non-text; the text-safe value is used in dark for visual softness against the violet fills.
- **`--accent-primary-hover`**: dark `#8d70ff` (lighter), light `#5f34e0` (darker) — derived, not in brief.
- **`--space-5/7/8`** kept with their old values (20/32/40px) for compatibility; the brief's canonical scale is `--space-1/2/3/4/6`.
- **`--shadow-elevated`** now aliases `--elevation-3` (was a heavier custom shadow); `--shadow-sm/md/lg` alias `--elevation-1/2/3`.
