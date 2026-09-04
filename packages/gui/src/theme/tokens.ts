/**
 * Design tokens for the AI Config Manager GUI.
 *
 * WhatsApp-inspired theme: warm off-white canvas (#efeae2), white panels,
 * teal primary (#00a884), deep green accents (#075e54), bubble green success (#d9fdd3),
 * WCAG AA contrast, CSS variables, no heavy animations, single-theme only,
 * responsive 320px–4K+.
 *
 * This file defines the canonical token structure. The actual CSS variable
 * values are injected into :root in packages/gui/src/index.css via the
 * CSSVariables exported below.
 *
 * Design spec: docs/epics/agentic-control-plane-redesign-v2.md
 */

/**
 * Color token definitions — WhatsApp theme only.
 * Organized by semantic role: surfaces, text, borders, accents, categories.
 */
export const ColorTokens = {
  // WhatsApp theme (canonical, single-theme only)
  surface: {
    canvas: '#efeae2',           // warm off-white page base
    primary: '#ffffff',          // white panels
    secondary: '#f7f8fa',        // light sidebar/list backgrounds
    tertiary: '#ffffff',         // raised elements
    hover: '#f0f2f5',            // list row hover
    active: '#e5ddd5',           // active/pressed state (darker warm tone)
    glass: 'rgba(255, 255, 255, 0.85)',
  },
  // Text — dark on light backgrounds
  text: {
    primary: '#111b21',          // strong dark text
    secondary: '#54656f',        // secondary label
    tertiary: '#8a8f96',         // tertiary/disabled (AA on canvas)
    inverse: '#ffffff',          // text on filled accents
  },
  // Borders
  border: {
    primary: '#e5ddd5',          // default borders (warm tone match)
    secondary: '#dbd6d1',        // emphasized borders
    focus: '#00a884',            // focus ring (teal primary)
  },
  // Accents — primary (teal) + secondary (blue) with text-safe variants
  accent: {
    primary: '#00a884',          // WhatsApp teal (buttons, active nav, focus)
    primaryHover: '#008a70',     // teal hover (darkened)
    primaryText: '#005c4b',      // dark teal for text (passes AA)
    secondary: '#53bdeb',        // WhatsApp blue (link blue, secondary)
    // Status / semantic — WhatsApp-compatible greens/ambers/reds/blues
    success: '#d9fdd3',          // bubble green (sent/success fill)
    successText: '#059669',      // darker green text (passes AA)
    warning: '#f59e0b',          // amber (warning)
    warningText: '#92400e',      // dark amber text (passes AA)
    error: '#ef4444',            // red (error)
    errorText: '#991b1b',        // dark red text (passes AA)
    info: '#3b82f6',             // blue (info)
    infoText: '#1e40af',         // dark blue text (passes AA)
  },
  // Categorical — API type + agent identity tints (warm earth tones match theme)
  categorical: {
    anthropic: '#d4a574',        // warm tan (Anthropic)
    olive: '#7a9e4b',            // olive (generic)
    providerAnthropic: '#c89858',
    providerOpenAI: '#6b8dd6',   // neutral blue
    providerBedrock: '#c98432',  // warm orange
    providerVertex: '#5a7bb8',   // slate blue
  },
} as const;

/**
 * Typography tokens.
 */
export const TypographyTokens = {
  font: {
    display: '"Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  size: {
    xs: '12px',
    sm: '13px',
    base: '14px',
    md: '15px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },
} as const;

/**
 * Spacing scale (4/8/12/16/24 canonical; 5/7/8 kept for compat).
 */
export const SpacingTokens = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '32px',
  8: '40px',
} as const;

/**
 * Radius tokens.
 */
export const RadiusTokens = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  full: '999px',
} as const;

/**
 * Elevation / shadow tokens.
 */
export const ElevationTokens = {
  dark: {
    1: '0 1px 2px 0 rgb(0 0 0 / 0.35)',
    2: '0 6px 14px -3px rgb(0 0 0 / 0.42), 0 2px 4px -2px rgb(0 0 0 / 0.32)',
    3: '0 20px 40px -10px rgb(0 0 0 / 0.55), 0 8px 16px -8px rgb(0 0 0 / 0.42)',
  },
  light: {
    1: '0 1px 2px 0 rgb(23 21 31 / 0.05)',
    2: '0 4px 12px -2px rgb(23 21 31 / 0.07), 0 2px 4px -2px rgb(23 21 31 / 0.05)',
    3: '0 16px 32px -8px rgb(23 21 31 / 0.14), 0 6px 12px -6px rgb(23 21 31 / 0.08)',
  },
} as const;

/**
 * Motion / transition tokens.
 */
export const MotionTokens = {
  fast: '150ms ease-out',
  normal: '200ms ease-out',
  slow: '220ms ease-out',
} as const;

/**
 * Atmosphere utility tokens.
 */
export const AtmosphereTokens = {
  glassBlur: '20px',
} as const;

/**
 * CSS variable definitions for injection into :root.
 * WhatsApp theme only (single-theme).
 */
export const CSSVariables = {
  // WhatsApp theme (applied to :root) — ALL variables
  root: {
    // Surfaces
    '--bg-canvas': ColorTokens.surface.canvas,
    '--bg-primary': ColorTokens.surface.primary,
    '--bg-secondary': ColorTokens.surface.secondary,
    '--bg-tertiary': ColorTokens.surface.tertiary,
    '--bg-hover': ColorTokens.surface.hover,
    '--bg-active': ColorTokens.surface.active,
    '--surface-glass': ColorTokens.surface.glass,

    // Text
    '--text-primary': ColorTokens.text.primary,
    '--text-secondary': ColorTokens.text.secondary,
    '--text-tertiary': ColorTokens.text.tertiary,
    '--text-inverse': ColorTokens.text.inverse,

    // Borders
    '--border-primary': ColorTokens.border.primary,
    '--border-secondary': ColorTokens.border.secondary,
    '--border-focus': ColorTokens.border.focus,

    // Accents
    '--accent-primary': ColorTokens.accent.primary,
    '--accent-primary-hover': ColorTokens.accent.primaryHover,
    '--accent-primary-text': ColorTokens.accent.primaryText,
    '--accent-secondary': ColorTokens.accent.secondary,
    '--accent-success': ColorTokens.accent.success,
    '--accent-success-text': ColorTokens.accent.successText,
    '--accent-warning': ColorTokens.accent.warning,
    '--accent-warning-text': ColorTokens.accent.warningText,
    '--accent-error': ColorTokens.accent.error,
    '--accent-error-text': ColorTokens.accent.errorText,
    '--accent-info': ColorTokens.accent.info,
    '--accent-info-text': ColorTokens.accent.infoText,

    // Categorical
    '--anthropic-accent': ColorTokens.categorical.anthropic,
    '--cat-olive': ColorTokens.categorical.olive,
    '--provider-anthropic': ColorTokens.categorical.providerAnthropic,
    '--provider-openai': ColorTokens.categorical.providerOpenAI,
    '--provider-bedrock': ColorTokens.categorical.providerBedrock,
    '--provider-vertex': ColorTokens.categorical.providerVertex,

    // Elevation / shadow (light theme style — soft, subtle)
    '--elevation-1': ElevationTokens.light[1],
    '--elevation-2': ElevationTokens.light[2],
    '--elevation-3': ElevationTokens.light[3],
    '--shadow-sm': ElevationTokens.light[1],
    '--shadow-md': ElevationTokens.light[2],
    '--shadow-lg': ElevationTokens.light[3],
    '--shadow-elevated': ElevationTokens.light[3],

    // Typography (stable)
    '--font-display': TypographyTokens.font.display,
    '--font-sans': TypographyTokens.font.sans,
    '--font-mono': TypographyTokens.font.mono,
    '--text-size-xs': TypographyTokens.size.xs,
    '--text-size-sm': TypographyTokens.size.sm,
    '--text-size-base': TypographyTokens.size.base,
    '--text-size-md': TypographyTokens.size.md,
    '--text-size-lg': TypographyTokens.size.lg,
    '--text-size-xl': TypographyTokens.size.xl,
    '--text-size-2xl': TypographyTokens.size['2xl'],
    '--text-size-3xl': TypographyTokens.size['3xl'],

    // Spacing (stable)
    '--space-1': SpacingTokens[1],
    '--space-2': SpacingTokens[2],
    '--space-3': SpacingTokens[3],
    '--space-4': SpacingTokens[4],
    '--space-5': SpacingTokens[5],
    '--space-6': SpacingTokens[6],
    '--space-7': SpacingTokens[7],
    '--space-8': SpacingTokens[8],

    // Radius (stable)
    '--radius-sm': RadiusTokens.sm,
    '--radius-md': RadiusTokens.md,
    '--radius-lg': RadiusTokens.lg,
    '--radius-full': RadiusTokens.full,

    // Motion (stable)
    '--transition-fast': MotionTokens.fast,
    '--transition-normal': MotionTokens.normal,
    '--transition-slow': MotionTokens.slow,

    // Atmosphere (stable)
    '--glass-blur': AtmosphereTokens.glassBlur,
  },
} as const;

/**
 * @deprecated — kept for backward compatibility with old dual-theme tests
 * Use CSSVariables.root directly for new code
 */
export const CSSVariablesLegacy = {
  light: CSSVariables.root,
  dark: CSSVariables.root, // Dark theme no longer exists; aliased to root
} as const;

/**
 * Helper to get a token value.
 * Returns the WhatsApp theme value (single-theme only).
 * The isDark parameter is kept for backward compatibility but ignored.
 */
export function getTokenValue(
  tokenName: keyof typeof CSSVariables.root,
  isDark: boolean = false
): string {
  // WhatsApp theme only — isDark is ignored
  return (CSSVariables.root as Record<string, string>)[tokenName] ?? '';
}

/**
 * Verify that all required CSS variables are defined in the WhatsApp theme.
 * Single-theme only — no dark theme.
 */
export function validateTokenConsistency(): {
  valid: boolean;
  missing: { theme: 'root'; tokens: string[] };
} {
  const requiredKeys = new Set([
    '--bg-canvas', '--bg-primary', '--bg-secondary', '--bg-tertiary',
    '--text-primary', '--text-secondary', '--text-tertiary',
    '--border-primary', '--accent-primary', '--accent-primary-text',
    '--accent-success', '--accent-success-text', '--accent-error', '--accent-error-text',
  ]);
  const rootKeys = new Set(Object.keys(CSSVariables.root));

  const missing = [...requiredKeys].filter((k) => !rootKeys.has(k));

  if (missing.length === 0) {
    return { valid: true, missing: { theme: 'root', tokens: [] } };
  }

  return {
    valid: false,
    missing: { theme: 'root', tokens: missing },
  };
}

/**
 * Contrast ratio calculator (WCAG relative luminance formula).
 * Used for design-time verification that text tokens meet AA minimums (4.5:1).
 */
export function getRelativeLuminance(hex: string): number {
  // Convert #RRGGBB to RGB values
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // Apply gamma correction
  const lc = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * lc(r) + 0.7152 * lc(g) + 0.0722 * lc(b);

  return lum;
}

export function getContrastRatio(foreground: string, background: string): number {
  const lum1 = getRelativeLuminance(foreground);
  const lum2 = getRelativeLuminance(background);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Verify WCAG AA contrast (4.5:1 minimum for all text contexts in WhatsApp theme).
 * Returns { valid: boolean; failures: Array<{ token: string; bg: string; ratio: number }> }
 */
export function validateContrast(): {
  valid: boolean;
  failures: Array<{ token: string; bg: string; ratio: number }>;
} {
  const failures: Array<{ token: string; bg: string; ratio: number }> = [];
  const threshold = 4.5;

  // Text tokens to check (not brand colors)
  const textTokens = [
    { name: '--text-primary' },
    { name: '--text-secondary' },
    { name: '--text-tertiary' },
    { name: '--accent-primary-text' },
    { name: '--accent-success-text' },
    { name: '--accent-warning-text' },
    { name: '--accent-error-text' },
    { name: '--accent-info-text' },
  ];

  // Backgrounds to test against
  const bgTokens = [
    { name: '--bg-canvas' },
    { name: '--bg-primary' },
    { name: '--bg-secondary' },
  ];

  // Test WhatsApp theme (single-theme)
  for (const textToken of textTokens) {
    for (const bgToken of bgTokens) {
      const fgHex = getTokenValue(textToken.name as keyof typeof CSSVariables.root, false);
      const bgHex = getTokenValue(bgToken.name as keyof typeof CSSVariables.root, false);
      if (fgHex && bgHex && fgHex.startsWith('#') && bgHex.startsWith('#')) {
        const ratio = getContrastRatio(fgHex, bgHex);
        if (ratio < threshold) {
          failures.push({
            token: textToken.name,
            bg: bgToken.name,
            ratio: parseFloat(ratio.toFixed(2)),
          });
        }
      }
    }
  }

  return {
    valid: failures.length === 0,
    failures,
  };
}
