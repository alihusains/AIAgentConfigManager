# Theme Tokens — Quick Reference

## Import

```tsx
import { ColorTokens, getTokenValue } from '../theme';
import { injectTokensIntoCSSVariables } from '../theme/inject';
```

## CSS Usage (90% of cases)

```css
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-md);
  transition: background var(--transition-normal);
}
```

## Color Tokens — Brand vs Text

| Use Case | Token | Example |
|---|---|---|
| Button fill | `--accent-primary` | `background: var(--accent-primary)` |
| Button text | `--accent-primary-text` | `color: var(--accent-primary-text)` |
| Success indicator dot | `--accent-success` | `background: var(--accent-success)` |
| Success label text | `--accent-success-text` | `color: var(--accent-success-text)` |
| Warning fill | `--accent-warning` | `border: 1px solid var(--accent-warning)` |
| Warning text | `--accent-warning-text` | `color: var(--accent-warning-text)` |
| Error background | `--accent-error` | `background: var(--accent-error)` |
| Error text | `--accent-error-text` | `color: var(--accent-error-text)` |

**Rule:** If you're setting `color:` or text inside an element, use the `-text` variant. Otherwise, use the brand color.

## Common Patterns

### Card with Title

```css
.card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-md);
}

.card-title {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--text-size-lg);
  margin-bottom: var(--space-3);
}

.card-subtitle {
  color: var(--text-secondary);
  font-size: var(--text-size-sm);
}
```

### Button States

```css
.btn {
  background: var(--accent-primary);
  color: var(--accent-primary-text);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-4);
  transition: background var(--transition-normal);
}

.btn:hover {
  background: var(--accent-primary-hover);
}

.btn:active {
  background: var(--accent-primary-hover);
}
```

### Text Hierarchy

```css
.heading {
  color: var(--text-primary);
  font-size: var(--text-size-3xl);
}

.body {
  color: var(--text-secondary);
  font-size: var(--text-size-base);
}

.caption {
  color: var(--text-tertiary);
  font-size: var(--text-size-xs);
}
```

### Focus Ring

```css
.interactive:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

### Layered Backgrounds

```css
.background {
  background: var(--bg-canvas);
}

.panel {
  background: var(--bg-primary);
}

.card {
  background: var(--bg-secondary);
}

.raised {
  background: var(--bg-tertiary);
}
```

## Runtime Access

```tsx
// Get current theme value
const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
const textColor = getTokenValue('--text-primary', isDark);

// Manually switch theme (rarely needed)
import { injectTokensIntoCSSVariables } from '../theme/inject';
injectTokensIntoCSSVariables(true);  // dark
injectTokensIntoCSSVariables(false); // light (rare)
```

## Spacing Scale

| Token | Size | Usage |
|---|---|---|
| `--space-1` | 4px | Tiny gaps, inline spacing |
| `--space-2` | 8px | Button/input padding |
| `--space-3` | 12px | Small component gaps |
| `--space-4` | 16px | Standard padding/margins |
| `--space-6` | 24px | Section spacing |
| `--space-7` | 32px | Large gaps |
| `--space-8` | 40px | Very large gaps |

## Type Scale

| Token | Size | Usage |
|---|---|---|
| `--text-size-xs` | 12px | Captions, hints |
| `--text-size-sm` | 13px | Labels, secondary text |
| `--text-size-base` | 14px | Body text (default) |
| `--text-size-md` | 15px | Body emphasis |
| `--text-size-lg` | 16px | Section headings |
| `--text-size-xl` | 20px | Page headings |
| `--text-size-2xl` | 24px | Large headings |
| `--text-size-3xl` | 32px | Hero headings |

## Radius Scale

| Token | Size | Usage |
|---|---|---|
| `--radius-sm` | 8px | Buttons, inputs |
| `--radius-md` | 12px | Cards, modals |
| `--radius-lg` | 16px | Large panels |
| `--radius-full` | 999px | Pills |

## Motion

| Token | Duration | Usage |
|---|---|---|
| `--transition-fast` | 150ms | Quick interactions |
| `--transition-normal` | 200ms | Standard transitions |
| `--transition-slow` | 220ms | Prominent animations |

```css
.interactive {
  transition: background var(--transition-normal);
}
```

## Surface Hierarchy

**Use `--bg-secondary` for:**
- Table rows
- Cards in a grid
- List item backgrounds

**Use `--bg-primary` for:**
- Panel backgrounds
- Modals/dialogs
- Sidebars

**Use `--bg-tertiary` for:**
- Raised elements
- Floating panels
- Tooltips

## Never Use

❌ Hardcoded hex colors (e.g., `#ff5c72`)
❌ Old hardcoded shadows (e.g., `box-shadow: 0 2px 4px rgba(0,0,0,0.1)`)
❌ Theme-specific conditionals in component CSS

✅ Always use `var(--token)` — theme handling is automatic

## Font Families

| Token | Font | Usage |
|---|---|---|
| `--font-display` | Space Grotesk | Headings, stat numbers |
| `--font-sans` | Inter | Body, UI text (default) |
| `--font-mono` | JetBrains Mono | Code, identifiers, paths |

```css
.heading {
  font-family: var(--font-display);
}

.code {
  font-family: var(--font-mono);
}
```

## Categorical Colors (Pro/API tints)

```css
.api-anthropic { background: var(--provider-anthropic); }
.api-openai { background: var(--provider-openai); }
.api-bedrock { background: var(--provider-bedrock); }
.api-vertex { background: var(--provider-vertex); }
```

## Testing

Run validation:
```bash
pnpm --filter @ai-agent-config/gui test
```

All tests pass? ✅ Tokens are consistent and WCAG AA verified.

## Common Mistakes

❌ **Wrong:** `color: var(--accent-success)` on text (might not have enough contrast)
✅ **Right:** `color: var(--accent-success-text)` on text

❌ **Wrong:** `background: var(--text-primary)` (semantically wrong)
✅ **Right:** `background: var(--bg-secondary)` (semantically correct)

❌ **Wrong:** Mixing old hex values with new tokens
✅ **Right:** Replace all hex with tokens in one pass (or file a follow-up)

---

See `packages/gui/src/theme/README.md` for full documentation.
