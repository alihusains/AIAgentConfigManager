# Styling Reference Guide

## CSS Variables & Design Tokens

### Color System

#### Light Mode (Default)
```css
--bg-canvas: #f7f6fb;        /* Page background */
--bg-primary: #ffffff;        /* Cards, modals */
--bg-secondary: #f0eef7;      /* Secondary surfaces */
--bg-tertiary: #ffffff;       /* Raised elements */
--bg-hover: #f0eef7;          /* Hover states */
--bg-active: #e3e0ec;         /* Active states */

--text-primary: #17151f;      /* Main text */
--text-secondary: #4c4959;    /* Secondary text */
--text-tertiary: #5f5c6e;     /* Tertiary text, labels */
--text-inverse: #f7f6fb;      /* Text on dark backgrounds */

--accent-primary: #6a3ff0;    /* Brand color (fills/borders) */
--accent-primary-text: #5326d1; /* Text-safe variant */
--accent-success: #0f9d70;    /* Success color (fills) */
--accent-success-text: #0b7a57; /* Success text */
--accent-error: #d1364c;      /* Error color (fills) */
--accent-error-text: #ad2038; /* Error text */
--accent-info: #2f68c9;       /* Info color (fills) */
--accent-info-text: #2454a3;  /* Info text */
```

#### Dark Mode (`html[data-theme="dark"]`)
```css
--bg-canvas: #0e0e13;         /* Dark page background */
--bg-primary: #16161d;        /* Dark cards, modals */
--bg-secondary: #1c1c25;      /* Dark secondary surfaces */
--bg-tertiary: #22222d;       /* Dark raised elements */

--text-primary: #f3f2f8;      /* Light text */
--text-secondary: #b7b4c4;    /* Light secondary text */
--text-tertiary: #8b899b;     /* Light tertiary text */
--text-inverse: #0e0e13;      /* Text on light backgrounds */

--accent-primary: #8d70ff;    /* Brand color adjusted for dark */
--accent-primary-text: #b6a3ff;
--accent-success: #22e6a0;
--accent-error: #ff5c72;
--accent-info: #5b9dff;
```

### Spacing Scale (4px Grid)

```css
--space-1: 4px    /* Micro spacing */
--space-2: 8px    /* Small gaps */
--space-3: 12px   /* Form inputs, labels */
--space-4: 16px   /* Card padding, gaps */
--space-5: 20px   /* Spacing between sections */
--space-6: 24px   /* Larger gaps */
--space-7: 32px   /* Large section spacing */
--space-8: 40px   /* Page gutters, large gaps */
```

### Typography Scale

```css
--text-size-xs: 12px      /* Captions, badges */
--text-size-sm: 13px      /* Body text, buttons */
--text-size-base: 14px    /* Standard text */
--text-size-md: 15px      /* Emphasis text */
--text-size-lg: 16px      /* Subheadings */
--text-size-xl: 20px      /* Headings */
--text-size-2xl: 24px     /* Page titles */
--text-size-3xl: 32px     /* Hero titles */
```

### Border Radius

```css
--radius-sm: 8px      /* Buttons, inputs */
--radius-md: 12px     /* Cards, modals */
--radius-lg: 16px     /* Panels, large elements */
--radius-full: 999px  /* Pill shapes, circles */
```

### Shadows & Elevation

```css
--elevation-1: 0 1px 2px 0 rgb(23 21 31 / 0.05);
--elevation-2: 0 4px 12px -2px rgb(23 21 31 / 0.07), 0 2px 4px -2px rgb(23 21 31 / 0.05);
--elevation-3: 0 16px 32px -8px rgb(23 21 31 / 0.14), 0 6px 12px -6px rgb(23 21 31 / 0.08);

/* In dark mode, shadows are stronger for better depth */
--elevation-1: 0 1px 2px 0 rgb(0 0 0 / 0.35);
--elevation-2: 0 6px 14px -3px rgb(0 0 0 / 0.42), 0 2px 4px -2px rgb(0 0 0 / 0.32);
--elevation-3: 0 20px 40px -10px rgb(0 0 0 / 0.55), 0 8px 16px -8px rgb(0 0 0 / 0.42);
```

### Transitions

```css
--transition-fast: 150ms ease-out     /* Quick interactions */
--transition-normal: 200ms ease-out   /* Standard transitions */
--transition-slow: 220ms ease-out     /* Slower animations */

/* Composite transitions */
--transition-all: all var(--transition-normal);
--transition-shadow: box-shadow var(--transition-fast), border-color var(--transition-fast);
--transition-hover: background-color var(--transition-fast), transform var(--transition-fast);
```

### Font Families

```css
--font-sans: "Inter", system-ui      /* UI text */
--font-mono: "JetBrains Mono"        /* Code, identifiers */
--font-display: "Space Grotesk"      /* Headers, display text */
```

## Component Styling Guide

### Buttons

#### Primary Button
```css
.btn-primary {
  background: var(--accent-primary);
  color: var(--text-inverse);
  box-shadow: var(--elevation-1);
  border-radius: var(--radius-full);
  padding: 8px 18px;
  transition: background-color, border-color, box-shadow, color, transform
    var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-primary-hover);
  box-shadow: var(--elevation-2), 0 0 0 4px rgba(accent-primary, 0.18);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: var(--elevation-1);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  box-shadow: var(--elevation-1);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-secondary);
  box-shadow: var(--elevation-2);
  transform: translateY(-1px);
}
```

#### Button States
```css
/* Focus visible */
.btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* Disabled */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Loading */
.btn-loading {
  opacity: 0.8;
  pointer-events: none;
}

.btn-loading::before {
  content: "";
  animation: spin 0.8s linear infinite;
}
```

### Input Fields

#### Base Input
```css
.input {
  width: 100%;
  padding: 8px 14px;
  font-size: var(--text-size-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  transition: border-color, box-shadow, background-color
    var(--transition-fast);
}

.input:hover:not(:focus) {
  border-color: var(--border-secondary);
  background-color: color-mix(in srgb, var(--bg-primary) 98%, var(--accent-primary));
}

.input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(accent-primary, 0.20);
  outline: none;
}
```

#### Error State
```css
.input-error {
  border-color: var(--accent-error);
}

.input-error:focus {
  border-color: var(--accent-error);
  box-shadow: 0 0 0 3px rgba(accent-error, 0.20);
}

.input-error:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--accent-error) 70%, var(--border-primary));
}
```

### Cards

#### Base Card
```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 16px;
  transition: box-shadow, border-color, background-color
    var(--transition-normal);
}

.card:hover {
  border-color: color-mix(in srgb, var(--accent-primary) 30%, var(--border-primary));
  box-shadow: var(--elevation-2);
}
```

#### Bento Card (Dashboard Stats)
```css
.bento-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  background: radial-gradient(
    130% 130% at 100% 0%,
    color-mix(in srgb, var(--bento-tint) 15%, transparent) 0%,
    color-mix(in srgb, var(--bento-tint) 4%, transparent) 42%,
    transparent 72%
  ), var(--bg-secondary);
  cursor: pointer;
  transition: border-color, box-shadow, transform
    var(--transition-normal);
}

.bento-card:hover {
  border-color: color-mix(in srgb, var(--bento-tint) 45%, var(--border-primary));
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### Navigation Items

#### Active Navigation
```css
.nav-item.active {
  background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: 0 0 0 1px rgba(accent-primary, 0.25),
              0 0 14px 2px rgba(accent-primary, 0.22);
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: translateX(4px);
}
```

### Modals

#### Modal Structure
```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  animation: fadeIn 150ms ease;
}

.modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(accent-primary, 0.10);
  max-width: 780px;
  max-height: 90vh;
  animation: slideUp 200ms ease;
}
```

### Badges

#### Badge Styling
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--radius-full);
}

.badge-primary {
  background: color-mix(in srgb, var(--accent-primary) 15%, transparent);
  color: var(--accent-primary-text);
}

.badge-success {
  background: color-mix(in srgb, var(--accent-success) 15%, transparent);
  color: var(--accent-success-text);
}

.badge-error {
  background: color-mix(in srgb, var(--accent-error) 15%, transparent);
  color: var(--accent-error-text);
}
```

### Responsive Design

#### Breakpoints
- **Phone**: ≤ 640px (dense tables, single-column stats, tightened modals)
- **Mobile**: ≤ 768px (app drawer sidebar, compressed gutters)
- **Tablet**: ≤ 900px (two-column grids collapse to single column)

#### Mobile Adjustments
```css
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    transform: translateX(-100%);
    transition: transform var(--transition-normal);
  }

  .modal {
    max-height: calc(100dvh - 20px);
    border-radius: var(--radius-md);
  }
}
```

## Theme Switching

### How Dark Mode Works

1. **Auto-Detection**: On page load, check stored preference or OS preference
2. **Storage**: Save user preference to localStorage
3. **DOM Update**: Set `data-theme="dark"` or remove it
4. **CSS Application**: Dark mode variables automatically apply via `html[data-theme="dark"]`
5. **No Flash**: Theme applied in pre-paint script to prevent flash

### Implementation
```html
<!-- In HTML head (pre-paint script) -->
<script>
  const theme = localStorage.getItem('theme') || 
                (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
</script>

<!-- In React component -->
import { useEffect } from 'react';

export function ThemeToggle() {
  const handleToggle = () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return <button onClick={handleToggle}>Toggle Theme</button>;
}
```

## Accessibility Guidelines

### Color Contrast
- **AA Compliant**: All text-size variants meet 4.5:1 minimum
- **Text Variants**: Use `--accent-*-text` for readable text
- **Fill vs Text**: Brand hexes used for fills/borders only

### Focus Management
- **Outline**: 2px solid, 2px offset, proper color per theme
- **Focus Color**: Uses `--border-focus` variable
- **Visibility**: Never remove focus outline
- **Keyboard Tab Order**: Logical and predictable

### Motion & Animation
- **Reduced Motion**: Respects `prefers-reduced-motion` media query
- **Duration**: All animations 0.01ms when motion reduced
- **No Auto-Play**: Animations only on interaction
- **Purpose**: Micro-interactions enhance, not distract

## Performance Tips

### CSS Optimization
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating colors in favor of `background-color`
- Use `will-change` sparingly (only when needed)
- Limit shadow blur radius (expensive)

### Transition Timing
- **Fast**: 150ms for hover, focus effects
- **Normal**: 200ms for standard transitions
- **Slow**: 220ms for dramatic movements
- **Rule**: 0.1ms per 10px of movement is comfortable

## Testing Checklist

- [ ] Light mode colors are readable (WCAG AA)
- [ ] Dark mode colors are readable (WCAG AA)
- [ ] Focus states visible and clear
- [ ] Hover states distinguish interactive elements
- [ ] Disabled states clearly indicate non-interaction
- [ ] Touch targets ≥ 44px
- [ ] Keyboard navigation works
- [ ] Screen reader announcements clear
- [ ] Animations smooth (60fps)
- [ ] Mobile responsive on all breakpoints

## Future Enhancements

1. **CSS-in-JS**: Extract tokens to TypeScript for design-dev sync
2. **Storybook**: Document component states visually
3. **Theme Variants**: Add high-contrast, printer-friendly themes
4. **Animation Library**: GSAP for complex sequences
5. **Design System**: Comprehensive component library with Figma sync

---

**Last Updated**: 2026-09-02
**Version**: 2.0 (Professional Polish)
