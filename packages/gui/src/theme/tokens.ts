/**
 * Design tokens for the AI Agent Config Manager GUI.
 *
 * Dark & Minimal ultramodern theme: near-black background (#0a0e27), dark gray
 * accents (#1a1f3a), purple primary (#6b5cff), cyan secondary (#00e5cc), soft
 * shadows, subtle gradients, light text on dark, WCAG AA contrast, CSS variables,
 * no heavy animations, dark mode only, responsive 320px–4K+.
 *
 * This file defines the canonical token structure. The actual CSS variable
 * values are injected into :root in packages/gui/src/index.css via the
 * CSSVariables exported below.
 *
 * Design spec: docs/epics/agentic-control-plane-redesign-v2.md
 */

/**
 * Color token definitions.
 * Organized by semantic role: surfaces, text, borders, accents, categories.
 */
export const ColorTokens = {
  // Dark theme (canonical)
  dark: {
    // Surfaces: canvas (page) → primary (panels) → secondary (cards) → tertiary (raised)
    surface: {
      canvas: '#0e0e13',
      primary: '#16161d',
      secondary: '#1c1c25',
      tertiary: '#22222d',
      hover: '#22222d',
      active: '#2b2b37',
      glass: 'rgba(28, 28, 37, 0.62)',
    },
    // Text
    text: {
      primary: '#f3f2f8',
      secondary: '#b7b4c4',
      tertiary: '#8b899b',
      inverse: '#0e0e13',
    },
    // Borders
    border: {
      primary: '#2b2b37',
      secondary: '#3a3a4a',
      focus: '#b6a3ff',
    },
    // Accents — primary (actions, active nav, focus) + secondary (links, info)
    accent: {
      primary: '#8d70ff',
      primaryHover: '#9a8cff',
      primaryText: '#b6a3ff',
      secondary: '#8ab8ff',
      // Status / semantic — brand vs text
      success: '#22e6a0',
      successText: '#5eeab8',
      warning: '#ffb020',
      warningText: '#ffb020', // passes AA on dark
      error: '#ff5c72',
      errorText: '#ff8a9a',
      info: '#5b9dff',
      infoText: '#8ab8ff',
    },
    // Categorical — API type + agent identity tints
    categorical: {
      anthropic: '#e8927c',
      olive: '#b3bd8a',
      providerAnthropic: '#d4b160',
      providerOpenAI: '#7fb3d5',
      providerBedrock: '#e0a05c',
      providerVertex: '#8fa3d9',
    },
  },

  // Light theme (full mirror)
  light: {
    surface: {
      canvas: '#f7f6fb',
      primary: '#ffffff',
      secondary: '#f0eef7',
      tertiary: '#ffffff',
      hover: '#f0eef7',
      active: '#e3e0ec',
      glass: 'rgba(255, 255, 255, 0.68)',
    },
    text: {
      primary: '#17151f',
      secondary: '#4c4959',
      tertiary: '#6b687a',
      inverse: '#f7f6fb',
    },
    border: {
      primary: '#e3e0ec',
      secondary: '#cfccdc',
      focus: '#6a3ff0',
    },
    accent: {
      primary: '#6a3ff0',
      primaryHover: '#5f34e0',
      primaryText: '#5326d1',
      secondary: '#2f68c9',
      success: '#0f9d70',
      successText: '#0b7a57',
      warning: '#b3690a',
      warningText: '#8f5407',
      error: '#d1364c',
      errorText: '#ad2038',
      info: '#2f68c9',
      infoText: '#2454a3',
    },
    categorical: {
      anthropic: '#b3542e',
      olive: '#6b744c',
      providerAnthropic: '#8a6d26',
      providerOpenAI: '#3a6d8c',
      providerBedrock: '#9c5f22',
      providerVertex: '#47598c',
    },
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
 * CSS variable definitions for injection into :root and html[data-theme="dark"].
 * 
 * Light theme (applied to :root) includes all variables. Dark theme (html[data-theme="dark"])
 * only includes variables that differ from light — CSS cascade handles the rest.
 */
export const CSSVariables = {
  // Light theme defaults (applied to :root) — ALL variables
  light: {
    // Surfaces
    '--bg-canvas': ColorTokens.light.surface.canvas,
    '--bg-primary': ColorTokens.light.surface.primary,
    '--bg-secondary': ColorTokens.light.surface.secondary,
    '--bg-tertiary': ColorTokens.light.surface.tertiary,
    '--bg-hover': ColorTokens.light.surface.hover,
    '--bg-active': ColorTokens.light.surface.active,
    '--surface-glass': ColorTokens.light.surface.glass,

    // Text
    '--text-primary': ColorTokens.light.text.primary,
    '--text-secondary': ColorTokens.light.text.secondary,
    '--text-tertiary': ColorTokens.light.text.tertiary,
    '--text-inverse': ColorTokens.light.text.inverse,

    // Borders
    '--border-primary': ColorTokens.light.border.primary,
    '--border-secondary': ColorTokens.light.border.secondary,
    '--border-focus': ColorTokens.light.border.focus,

    // Accents
    '--accent-primary': ColorTokens.light.accent.primary,
    '--accent-primary-hover': ColorTokens.light.accent.primaryHover,
    '--accent-primary-text': ColorTokens.light.accent.primaryText,
    '--accent-secondary': ColorTokens.light.accent.secondary,
    '--accent-success': ColorTokens.light.accent.success,
    '--accent-success-text': ColorTokens.light.accent.successText,
    '--accent-warning': ColorTokens.light.accent.warning,
    '--accent-warning-text': ColorTokens.light.accent.warningText,
    '--accent-error': ColorTokens.light.accent.error,
    '--accent-error-text': ColorTokens.light.accent.errorText,
    '--accent-info': ColorTokens.light.accent.info,
    '--accent-info-text': ColorTokens.light.accent.infoText,

    // Categorical
    '--anthropic-accent': ColorTokens.light.categorical.anthropic,
    '--cat-olive': ColorTokens.light.categorical.olive,
    '--provider-anthropic': ColorTokens.light.categorical.providerAnthropic,
    '--provider-openai': ColorTokens.light.categorical.providerOpenAI,
    '--provider-bedrock': ColorTokens.light.categorical.providerBedrock,
    '--provider-vertex': ColorTokens.light.categorical.providerVertex,

    // Elevation / shadow
    '--elevation-1': ElevationTokens.light[1],
    '--elevation-2': ElevationTokens.light[2],
    '--elevation-3': ElevationTokens.light[3],
    '--shadow-sm': ElevationTokens.light[1],
    '--shadow-md': ElevationTokens.light[2],
    '--shadow-lg': ElevationTokens.light[3],
    '--shadow-elevated': ElevationTokens.light[3],

    // Typography (stable across themes)
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

    // Spacing (stable across themes)
    '--space-1': SpacingTokens[1],
    '--space-2': SpacingTokens[2],
    '--space-3': SpacingTokens[3],
    '--space-4': SpacingTokens[4],
    '--space-5': SpacingTokens[5],
    '--space-6': SpacingTokens[6],
    '--space-7': SpacingTokens[7],
    '--space-8': SpacingTokens[8],

    // Radius (stable across themes)
    '--radius-sm': RadiusTokens.sm,
    '--radius-md': RadiusTokens.md,
    '--radius-lg': RadiusTokens.lg,
    '--radius-full': RadiusTokens.full,

    // Motion (stable across themes)
    '--transition-fast': MotionTokens.fast,
    '--transition-normal': MotionTokens.normal,
    '--transition-slow': MotionTokens.slow,

    // Atmosphere (stable across themes)
    '--glass-blur': AtmosphereTokens.glassBlur,
  },

  // Dark theme overrides (applied to html[data-theme="dark"]) — ONLY overridden variables
  // Typography, spacing, radius, motion, and atmosphere do not change, so they are omitted
  // to reduce CSS size. The cascade will use the light theme values defined in :root.
  dark: {
    // Surfaces
    '--bg-canvas': ColorTokens.dark.surface.canvas,
    '--bg-primary': ColorTokens.dark.surface.primary,
    '--bg-secondary': ColorTokens.dark.surface.secondary,
    '--bg-tertiary': ColorTokens.dark.surface.tertiary,
    '--bg-hover': ColorTokens.dark.surface.hover,
    '--bg-active': ColorTokens.dark.surface.active,
    '--surface-glass': ColorTokens.dark.surface.glass,

    // Text
    '--text-primary': ColorTokens.dark.text.primary,
    '--text-secondary': ColorTokens.dark.text.secondary,
    '--text-tertiary': ColorTokens.dark.text.tertiary,
    '--text-inverse': ColorTokens.dark.text.inverse,

    // Borders
    '--border-primary': ColorTokens.dark.border.primary,
    '--border-secondary': ColorTokens.dark.border.secondary,
    '--border-focus': ColorTokens.dark.border.focus,

    // Accents
    '--accent-primary': ColorTokens.dark.accent.primary,
    '--accent-primary-hover': ColorTokens.dark.accent.primaryHover,
    '--accent-primary-text': ColorTokens.dark.accent.primaryText,
    '--accent-secondary': ColorTokens.dark.accent.secondary,
    '--accent-success': ColorTokens.dark.accent.success,
    '--accent-success-text': ColorTokens.dark.accent.successText,
    '--accent-warning': ColorTokens.dark.accent.warning,
    '--accent-warning-text': ColorTokens.dark.accent.warningText,
    '--accent-error': ColorTokens.dark.accent.error,
    '--accent-error-text': ColorTokens.dark.accent.errorText,
    '--accent-info': ColorTokens.dark.accent.info,
    '--accent-info-text': ColorTokens.dark.accent.infoText,

    // Categorical
    '--anthropic-accent': ColorTokens.dark.categorical.anthropic,
    '--cat-olive': ColorTokens.dark.categorical.olive,
    '--provider-anthropic': ColorTokens.dark.categorical.providerAnthropic,
    '--provider-openai': ColorTokens.dark.categorical.providerOpenAI,
    '--provider-bedrock': ColorTokens.dark.categorical.providerBedrock,
    '--provider-vertex': ColorTokens.dark.categorical.providerVertex,

    // Elevation / shadow
    '--elevation-1': ElevationTokens.dark[1],
    '--elevation-2': ElevationTokens.dark[2],
    '--elevation-3': ElevationTokens.dark[3],
    '--shadow-sm': ElevationTokens.dark[1],
    '--shadow-md': ElevationTokens.dark[2],
    '--shadow-lg': ElevationTokens.dark[3],
    '--shadow-elevated': ElevationTokens.dark[3],
  },
} as const;

/**
 * Helper to get a token value from the appropriate theme.
 * Returns the light theme value by default (system theme OR light preference).
 * Pass `isDark=true` to get the dark theme value.
 */
export function getTokenValue(
  tokenName: keyof typeof CSSVariables.light,
  isDark: boolean = false
): string {
  const theme = isDark ? CSSVariables.dark : CSSVariables.light;
  return (theme as Record<string, string>)[tokenName] ?? '';
}

/**
 * Verify that all dark-theme variables are also defined in light theme
 * (invariant: dark theme only has overrides, light theme is the source of truth).
 * Also verify no phantom variables exist in dark theme.
 */
export function validateTokenConsistency(): {
  valid: boolean;
  missing: { theme: 'light' | 'dark'; tokens: string[] };
} {
  const lightKeys = new Set(Object.keys(CSSVariables.light));
  const darkKeys = new Set(Object.keys(CSSVariables.dark));

  // Dark theme variables must all exist in light theme (dark only has overrides)
  const darkNotInLight = [...darkKeys].filter((k) => !lightKeys.has(k));

  if (darkNotInLight.length === 0) {
    return { valid: true, missing: { theme: 'light', tokens: [] } };
  }

  return {
    valid: false,
    missing: { theme: 'light', tokens: darkNotInLight },
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
 * Verify WCAG AA contrast (4.5:1 minimum for all text contexts in both themes).
 * Returns { valid: boolean; failures: Array<{ token: string; bg: string; ratio: number }> }
 */
export function validateContrast(): {
  valid: boolean;
  failures: Array<{ token: string; theme: 'light' | 'dark'; bg: string; ratio: number }>;
} {
  const failures: Array<{ token: string; theme: 'light' | 'dark'; bg: string; ratio: number }> = [];
  const threshold = 4.5;

  // Text tokens to check (not brand colors)
  const textTokens = [
    { name: '--text-primary', isText: true },
    { name: '--text-secondary', isText: true },
    { name: '--text-tertiary', isText: true },
    { name: '--accent-primary-text', isText: true },
    { name: '--accent-success-text', isText: true },
    { name: '--accent-warning-text', isText: true },
    { name: '--accent-error-text', isText: true },
    { name: '--accent-info-text', isText: true },
  ];

  // Backgrounds to test against
  const bgTokens = [
    { name: '--bg-canvas', key: 'canvas' as const },
    { name: '--bg-primary', key: 'primary' as const },
    { name: '--bg-secondary', key: 'secondary' as const },
  ];

  // Test light theme
  for (const textToken of textTokens) {
    for (const bgToken of bgTokens) {
      const fgHex = getTokenValue(textToken.name as keyof typeof CSSVariables.light, false);
      const bgHex = getTokenValue(bgToken.name as keyof typeof CSSVariables.light, false);
      if (fgHex && bgHex && fgHex.startsWith('#') && bgHex.startsWith('#')) {
        const ratio = getContrastRatio(fgHex, bgHex);
        if (ratio < threshold) {
          failures.push({
            token: textToken.name,
            theme: 'light',
            bg: bgToken.name,
            ratio: parseFloat(ratio.toFixed(2)),
          });
        }
      }
    }
  }

  // Test dark theme
  for (const textToken of textTokens) {
    for (const bgToken of bgTokens) {
      const fgHex = getTokenValue(textToken.name as keyof typeof CSSVariables.light, true);
      const bgHex = getTokenValue(bgToken.name as keyof typeof CSSVariables.light, true);
      if (fgHex && bgHex && fgHex.startsWith('#') && bgHex.startsWith('#')) {
        const ratio = getContrastRatio(fgHex, bgHex);
        if (ratio < threshold) {
          failures.push({
            token: textToken.name,
            theme: 'dark',
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
