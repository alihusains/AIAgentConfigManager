# Theme Token System

Design tokens for the AI Agent Config Manager GUI. Dark & Minimal ultramodern theme.

## Overview

The theme module provides a canonical, type-safe design token system that centralizes all color, typography, spacing, and layout decisions. Tokens are defined in TypeScript (`tokens.ts`) and compiled into CSS variables for component consumption.

**Key invariants:**
- Single source of truth: light theme defines all tokens; dark theme only defines overrides
- WCAG AA contrast (4.5:1 minimum) on all text tokens in both themes
- Brand vs. text-safe separation: accent colors for fills/borders, `-text` variants for readable text
- No phantom references: every CSS variable used in components must be defined
- Dark theme only: no light mode (ultramodern design direction)

## File Structure

```
packages/gui/src/theme/
├── index.ts              # Re-exports tokens and utilities
├── tokens.ts             # Token definitions + validation (this file)
├── inject.ts             # CSS generation and runtime injection
├── README.md             # This file
```

## Token Categories

### Color Tokens

**Surfaces** — layered backgrounds:
- `--bg-canvas` — page base (near-black in dark)
- `--bg-primary` — raised panel
- `--bg-secondary` — card/table row
- `--bg-tertiary` — further-raised element
- `--bg-hover` — hover state
- `--bg-active` — active/pressed state

**Text** — semantic hierarchy:
- `--text-primary` — headings, primary content
- `--text-secondary` — supporting labels
- `--text-tertiary` — disabled, tertiary labels (WCAG AA verified)
- `--text-inverse` — text on filled accents

**Borders**:
- `--border-primary` — default borders
- `--border-secondary` — emphasized borders
- `--border-focus` — focus ring outline

**Accents** — with brand/text-safe separation:
- `--accent-primary` / `--accent-primary-text` — main CTA, active nav
- `--accent-success` / `--accent-success-text` — success states
- `--accent-warning` / `--accent-warning-text` — warning states
- `--accent-error` / `--accent-error-text` — error states
- `--accent-info` / `--accent-info-text` — informational states

**Brand vs. Text Rule:** Use the plain `--accent-*` (brand) for fills, borders, dots, and focus rings. Use `--accent-*-text` for any readable text (labels, captions, buttons).

Example:
```css
.status-indicator {
  background: var(--accent-success);  /* brand color for fill */
  color: var(--accent-success-text);  /* WCAG AA safe text color */
}
```

### Typography

- `--font-display` — Space Grotesk (headers, stat numbers)
- `--font-sans` — Inter (body, UI text)
- `--font-mono` — JetBrains Mono (code, identifiers)

Type scale (all in `px`):
- `xs` 12, `sm` 13, `base` 14, `md` 15, `lg` 16, `xl` 20, `2xl` 24, `3xl` 32

### Spacing

Canonical scale (4/8/12/16/24 primary; 5/7/8 for compat):
- `--space-1` → 4px
- `--space-2` → 8px
- `--space-3` → 12px
- `--space-4` → 16px
- `--space-6` → 24px
- `--space-7` → 32px (compat)
- `--space-8` → 40px (compat)

### Radius

- `--radius-sm` — 8px (buttons, inputs)
- `--radius-md` — 12px (cards)
- `--radius-lg` — 16px (panels)
- `--radius-full` — 999px (pills)

### Elevation / Shadow

Three levels per theme:
- `--elevation-1` / `--shadow-sm` — subtle
- `--elevation-2` / `--shadow-md` — raised
- `--elevation-3` / `--shadow-lg` / `--shadow-elevated` — prominent

Dark shadows have higher opacity for visibility on dark backgrounds.

### Motion

- `--transition-fast` — 150ms ease-out
- `--transition-normal` — 200ms ease-out
- `--transition-slow` — 220ms ease-out

### Atmosphere

- `--glass-blur` — 20px (for glass-surface effects)

## Usage in Components

### CSS

All tokens are CSS variables, so components just consume them:

```css
.card {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-4);
}
```

### React / TypeScript

For runtime access (e.g., conditional styling):

```tsx
import { getTokenValue } from '../theme';

const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
const bgColor = getTokenValue('--bg-canvas', isDark);
```

## Testing

Comprehensive test suite in `packages/gui/src/theme.test.ts`:

```bash
pnpm --filter @ai-agent-config/gui test
```

Tests verify:
- ✅ Token structure completeness (no phantom references)
- ✅ WCAG AA contrast (4.5:1 minimum for all text)
- ✅ CSS variable well-formedness (valid hex/rgba)
- ✅ Consistency between light and dark (no unmatched variables)
- ✅ Brand vs. text-safe separation (verified for all accents)
- ✅ CSS generation correctness

## Validation Functions

### `validateTokenConsistency()`

Returns `{ valid: boolean; missing: { theme, tokens } }`. Use in tests or at build time to ensure no phantom variables.

```tsx
import { validateTokenConsistency } from '../theme';

const { valid, missing } = validateTokenConsistency();
if (!valid) {
  console.error(`Missing tokens in ${missing.theme}:`, missing.tokens);
}
```

### `validateContrast()`

Returns `{ valid: boolean; failures: Array<{token, theme, bg, ratio}> }`. Ensures WCAG AA (4.5:1) on all text tokens.

```tsx
import { validateContrast } from '../theme';

const { valid, failures } = validateContrast();
if (!valid) {
  failures.forEach(f => {
    console.warn(`${f.token} on ${f.bg} (${f.theme}): ${f.ratio}:1 — below AA`);
  });
}
```

### `getContrastRatio(foreground, background)`

Calculate contrast ratio for any two hex colors.

```tsx
import { getContrastRatio } from '../theme';

const ratio = getContrastRatio('#ffffff', '#000000'); // → ~21:1
const passes = ratio >= 4.5; // WCAG AA
```

## CSS Generation

To generate the CSS variable declarations (for documentation or verification):

```tsx
import { generateCSSVariablesDeclaration } from '../theme/inject';

const css = generateCSSVariablesDeclaration();
console.log(css);
/* Output:
:root {
  color-scheme: light;
  --bg-canvas: #f7f6fb;
  ... (light theme) ...
}

html[data-theme="dark"] {
  color-scheme: dark;
  --bg-canvas: #0e0e13;
  ... (dark theme overrides) ...
}
*/
```

## Adding New Tokens

To add a new token:

1. **Define it in `tokens.ts`:**
   - Add to the appropriate category in `ColorTokens.light` and `ColorTokens.dark`
   - Update `CSSVariables.light` (always include)
   - If it changes in dark mode, update `CSSVariables.dark`

2. **Verify consistency:**
   ```bash
   pnpm --filter @ai-agent-config/gui test
   ```
   Tests will catch missing variables or contrast issues.

3. **Use it in CSS:**
   ```css
   .my-component {
     color: var(--my-new-token);
   }
   ```

4. **Document it:**
   - Add a comment explaining the token's semantic role
   - Link any related design spec (e.g., `docs/epics/...md`)

## Contrast Validation

Every text token is measured against three backgrounds (canvas, primary, secondary) in both light and dark themes. The threshold is **4.5:1** (WCAG AA, small text).

Measured values are in `ColorTokens` structure; the validation function re-measures at test time to catch accidental changes.

**Why brand and text-safe variants?** The brand colors (`--accent-primary: #8d70ff` in dark) are optimized for fills and borders. When rendered as text on those same backgrounds, contrast fails. The `-text` variants (`--accent-primary-text: #b6a3ff`) are carefully chosen to pass AA while staying in the brand color family.

## Dark Mode Only

The current design is dark-mode only (ultramodern aesthetic). Light mode is explicitly not supported. If light mode is added in the future:

1. Update `CSSVariables.light` with new light-theme hex values (currently mirrors the old theme)
2. Add light-mode CSS generation
3. Update ThemeToggle to enable light mode
4. Re-run contrast validation across both themes

## Performance Notes

- **CSS variable overhead is minimal** (~0.5 KB gzipped)
- **No JS at runtime** — themes are pure CSS + data-attribute switching
- **Fast theme switching** — just 2 paint operations (attribute set + CSS cascade)
- **Bundle size:** Tokens add ~1 KB unminified, ~300B gzipped
- **No component re-renders** — CSS cascade handles it

## Debugging

To check what tokens are currently applied:

```tsx
// In browser console
getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas')
```

To manually inject a theme at runtime:

```tsx
import { injectTokensIntoCSSVariables } from '../theme/inject';

injectTokensIntoCSSVariables(true);  // → dark theme
injectTokensIntoCSSVariables(false); // → light theme
```

## Related Files

- **CSS:** `packages/gui/src/index.css` — auto-generated CSS blocks, checked into git
- **Components:** `packages/gui/src/components/` — all components consume `var(--token)`
- **Tests:** `packages/gui/src/theme.test.ts` — validation suite
- **Spec:** `docs/epics/agentic-control-plane-redesign-v2.md` — canonical design spec
