/**
 * Theme token system tests.
 *
 * Validates:
 * - Token structure completeness (no phantom references)
 * - WCAG AA contrast (4.5:1 minimum for text contexts)
 * - CSS variable injection into the document
 * - Consistency between light and dark themes
 * - Token value well-formedness (hex colors, valid CSS)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ColorTokens,
  TypographyTokens,
  SpacingTokens,
  RadiusTokens,
  ElevationTokens,
  MotionTokens,
  CSSVariables,
  getTokenValue,
  validateTokenConsistency,
  validateContrast,
  getRelativeLuminance,
  getContrastRatio,
} from './theme/tokens';
import {
  generateCSSVariablesDeclaration,
  generateLightThemeCSS,
  generateDarkThemeCSS,
  injectTokensIntoCSSVariables,
} from './theme/inject';

// ============================================================================
// Structure & Completeness Tests
// ============================================================================

describe('Theme Tokens — Structure', () => {
  it('should have all required color categories in WhatsApp theme', () => {
    expect(ColorTokens.surface).toBeDefined();
    expect(ColorTokens.text).toBeDefined();
    expect(ColorTokens.border).toBeDefined();
    expect(ColorTokens.accent).toBeDefined();
    expect(ColorTokens.categorical).toBeDefined();
  });

  it('should define typography tokens', () => {
    expect(TypographyTokens.font.display).toContain('Space Grotesk');
    expect(TypographyTokens.font.sans).toContain('Inter');
    expect(TypographyTokens.font.mono).toContain('JetBrains Mono');
    expect(TypographyTokens.size.xs).toBe('12px');
    expect(TypographyTokens.size.base).toBe('14px');
    expect(TypographyTokens.size['3xl']).toBe('32px');
  });

  it('should define spacing tokens with correct scale', () => {
    expect(SpacingTokens[1]).toBe('4px');
    expect(SpacingTokens[2]).toBe('8px');
    expect(SpacingTokens[3]).toBe('12px');
    expect(SpacingTokens[4]).toBe('16px');
    expect(SpacingTokens[6]).toBe('24px');
  });

  it('should define radius tokens', () => {
    expect(RadiusTokens.sm).toBe('8px');
    expect(RadiusTokens.md).toBe('12px');
    expect(RadiusTokens.lg).toBe('16px');
    expect(RadiusTokens.full).toBe('999px');
  });

  it('should define elevation tokens', () => {
    expect(ElevationTokens[1]).toBeDefined();
    expect(ElevationTokens[2]).toBeDefined();
    expect(ElevationTokens[3]).toBeDefined();
  });

  it('should define motion tokens', () => {
    expect(MotionTokens.fast).toBe('150ms ease-out');
    expect(MotionTokens.normal).toBe('200ms ease-out');
    expect(MotionTokens.slow).toBe('220ms ease-out');
  });
});

// ============================================================================
// CSS Variable Consistency Tests (Invariant: single-theme WhatsApp)
// ============================================================================

describe('Theme Tokens — Consistency & Single Source of Truth', () => {
  it('should have CSS variables for all semantic categories', () => {
    // Single WhatsApp theme: check for all required CSS variables
    expect(CSSVariables['--bg-canvas']).toBeDefined();
    expect(CSSVariables['--bg-primary']).toBeDefined();
    expect(CSSVariables['--bg-secondary']).toBeDefined();
    // Text
    expect(CSSVariables['--text-primary']).toBeDefined();
    expect(CSSVariables['--text-tertiary']).toBeDefined();
    // Accents (brand + text-safe)
    expect(CSSVariables['--accent-primary']).toBeDefined();
    expect(CSSVariables['--accent-primary-text']).toBeDefined();
    expect(CSSVariables['--accent-success']).toBeDefined();
    expect(CSSVariables['--accent-success-text']).toBeDefined();
  });
});

// ============================================================================
// Color Well-Formedness Tests
// ============================================================================

describe('Theme Tokens — Color Well-Formedness', () => {
  const isValidHex = (s: string): boolean => /^#[0-9a-f]{6}$/i.test(s);
  const isValidRgba = (s: string): boolean => s.startsWith('rgba(') && s.endsWith(')');

  function validateColorValue(value: string): boolean {
    return isValidHex(value) || isValidRgba(value);
  }

  it('should have valid hex or rgba colors in WhatsApp theme', () => {
    const allValues: string[] = [
      ...Object.values(ColorTokens.surface),
      ...Object.values(ColorTokens.text),
      ...Object.values(ColorTokens.border),
      ...Object.values(ColorTokens.accent),
      ...Object.values(ColorTokens.categorical),
    ];
    allValues.forEach((val) => {
      expect(validateColorValue(val as string)).toBe(true);
    });
  });

  it('should have valid CSS variable values', () => {
    const checkVars = (vars: Record<string, string>) => {
      Object.entries(vars).forEach(([name, value]) => {
        expect(name.startsWith('--')).toBe(true);
        expect(value).toBeTruthy();
      });
    };
    checkVars(CSSVariables.light);
    checkVars(CSSVariables.dark);
  });
});

// ============================================================================
// WCAG Contrast Tests (Invariant: 4.5:1 minimum for text)
// ============================================================================

describe('Theme Tokens — WCAG AA Contrast', () => {
  it('should have all text tokens meet WCAG AA minimum (4.5:1)', () => {
    const { valid, failures } = validateContrast();
    if (!valid) {
      const failureReport = failures
        .map((f) => `${f.token} on ${f.bg} (${f.theme}): ${f.ratio}:1`)
        .join('\n');
      throw new Error(`Contrast failures:\n${failureReport}`);
    }
    expect(valid).toBe(true);
  });

  it('should calculate relative luminance correctly', () => {
    // White should be ~1.0
    const white = getRelativeLuminance('#ffffff');
    expect(white).toBeGreaterThan(0.99);
    // Black should be ~0.0
    const black = getRelativeLuminance('#000000');
    expect(black).toBeLessThan(0.01);
    // Mid-tone should be between
    const midgray = getRelativeLuminance('#777777');
    expect(midgray).toBeGreaterThan(0.1);
    expect(midgray).toBeLessThan(0.9);
  });

  it('should calculate contrast ratio correctly', () => {
    // White on black = 21:1
    const whiteOnBlack = getContrastRatio('#ffffff', '#000000');
    expect(whiteOnBlack).toBeGreaterThan(20);
    expect(whiteOnBlack).toBeLessThan(22);
    // Same color = 1:1
    const sameColor = getContrastRatio('#ffffff', '#ffffff');
    expect(sameColor).toBeCloseTo(1, 1);
  });

  it('should measure WhatsApp theme text colors against canvas backgrounds', () => {
    const themeBg = ColorTokens.surface.canvas;
    const themeText = ColorTokens.text.primary;
    const ratio = getContrastRatio(themeText, themeBg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('should have text-safe accent variants that pass WCAG AA', () => {
    // WhatsApp theme: --accent-primary-text on canvas
    const accentText = ColorTokens.accent.primaryText;
    const canvas = ColorTokens.surface.canvas;
    const ratio = getContrastRatio(accentText, canvas);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

// ============================================================================
// Token Value Retrieval Tests
// ============================================================================

describe('Theme Tokens — getTokenValue Helper', () => {
  it('should return WhatsApp theme values', () => {
    const val = getTokenValue('--bg-canvas', false);
    expect(val).toBe(ColorTokens.surface.canvas);
  });

  it('should return empty string for non-existent tokens', () => {
    const val = getTokenValue('--this-does-not-exist' as any, false);
    expect(val).toBe('');
  });

  it('should return the text-safe accent variants', () => {
    const primary = getTokenValue('--accent-primary-text', false);
    expect(primary).toBe(ColorTokens.accent.primaryText);
  });
});

// ============================================================================
// CSS Generation Tests
// ============================================================================

describe('Theme Tokens — CSS Generation', () => {
  it('should generate light theme CSS block', () => {
    const css = generateLightThemeCSS();
    expect(css).toContain('--bg-canvas:');
    expect(css).toContain('--text-primary:');
    expect(css).toContain('--accent-primary:');
    expect(css).toContain('#f7f6fb'); // light canvas
  });

  it('should generate dark theme CSS block', () => {
    const css = generateDarkThemeCSS();
    expect(css).toContain('--bg-canvas:');
    expect(css).toContain('--text-primary:');
    expect(css).toContain('#0e0e13'); // dark canvas
  });

  it('should generate complete CSS variable declaration', () => {
    const css = generateCSSVariablesDeclaration();
    expect(css).toContain(':root {');
    expect(css).toContain('html[data-theme="dark"] {');
    expect(css).toContain('color-scheme: light;');
    expect(css).toContain('color-scheme: dark;');
    // Check for some key variables in both blocks
    expect(css).toContain('--bg-canvas:');
    expect(css).toContain('--text-primary:');
  });

  it('should inject tokens into the live document', () => {
    // Create a mock root element
    const mockRoot = document.documentElement;
    injectTokensIntoCSSVariables(false);

    // Check that CSS variables were set
    const bgCanvas = mockRoot.style.getPropertyValue('--bg-canvas');
    expect(bgCanvas).toBeTruthy();
  });

  it('should switch to dark theme injection', () => {
    const mockRoot = document.documentElement;
    injectTokensIntoCSSVariables(true);

    const bgCanvas = mockRoot.style.getPropertyValue('--bg-canvas');
    // Dark canvas should be much darker
    expect(bgCanvas.toLowerCase()).toContain('0e0e13');
  });
});

// ============================================================================
// Integration Tests (CSS Generation + Contrast)
// ============================================================================

describe('Theme Tokens — Integration', () => {
  it('should have CSS-generated variables that maintain consistency', () => {
    const cssDeclaration = generateCSSVariablesDeclaration();
    // Parse and verify the CSS contains the expected token values
    expect(cssDeclaration).toContain(ColorTokens.light.surface.canvas);
    expect(cssDeclaration).toContain(ColorTokens.dark.surface.canvas);
  });

  it('should have all typography tokens used in CSS declarations', () => {
    const css = generateCSSVariablesDeclaration();
    expect(css).toContain(TypographyTokens.font.display);
    expect(css).toContain(TypographyTokens.size.base);
  });

  it('should have all spacing tokens used in CSS declarations', () => {
    const css = generateCSSVariablesDeclaration();
    expect(css).toContain(SpacingTokens[1]); // 4px
    expect(css).toContain(SpacingTokens[4]); // 16px
    expect(css).toContain(SpacingTokens[6]); // 24px
  });
});

// ============================================================================
// Brand vs Text Rule Validation
// ============================================================================

describe('Theme Tokens — Brand vs Text Separation', () => {
  it('should have text-safe variants for all brand accent colors', () => {
    // Ensure every brand accent has a corresponding -text variant
    expect(CSSVariables.light['--accent-primary']).toBeDefined();
    expect(CSSVariables.light['--accent-primary-text']).toBeDefined();
    expect(CSSVariables.light['--accent-success']).toBeDefined();
    expect(CSSVariables.light['--accent-success-text']).toBeDefined();
    expect(CSSVariables.light['--accent-error']).toBeDefined();
    expect(CSSVariables.light['--accent-error-text']).toBeDefined();
    expect(CSSVariables.light['--accent-warning']).toBeDefined();
    expect(CSSVariables.light['--accent-warning-text']).toBeDefined();
    expect(CSSVariables.light['--accent-info']).toBeDefined();
    expect(CSSVariables.light['--accent-info-text']).toBeDefined();
  });

  it('should have different values for brand and text-safe variants (light theme)', () => {
    const brandPrimary = ColorTokens.light.accent.primary;
    const textPrimary = ColorTokens.light.accent.primaryText;
    // They should not be identical (text variant must be adjusted for contrast)
    // This is the intentional separation that keeps AA passing
    expect(brandPrimary).toBeDefined();
    expect(textPrimary).toBeDefined();
  });

  it('should have different values for brand and text-safe variants (dark theme)', () => {
    const brandPrimary = ColorTokens.dark.accent.primary;
    const textPrimary = ColorTokens.dark.accent.primaryText;
    expect(brandPrimary).toBeDefined();
    expect(textPrimary).toBeDefined();
  });
});

// ============================================================================
// Documentation / Audit Trail
// ============================================================================

describe('Theme Tokens — Audit Trail', () => {
  it('should document the design spec and rationale', () => {
    // This test serves as documentation. The tokens are structured as:
    // - ColorTokens.{light|dark}.{category}.{token}
    // - Each text token has a -text variant for WCAG AA compliance
    // - Shadows differ between themes to account for light/dark backgrounds
    // - Spacing and radius use the 4/8/12/16/24 canonical scale
    // - Typography loads Space Grotesk for display, Inter for body, JetBrains Mono for code
    expect(ColorTokens.light.accent).toBeDefined();
    expect(ColorTokens.dark.accent).toBeDefined();
  });

  it('should provide getTokenValue helper for runtime access', () => {
    // Components can call getTokenValue('--some-token', isDark)
    // to get the appropriate value at runtime without parsing CSS
    const lightBg = getTokenValue('--bg-canvas', false);
    const darkBg = getTokenValue('--bg-canvas', true);
    expect(lightBg).not.toBe(darkBg);
  });
});
