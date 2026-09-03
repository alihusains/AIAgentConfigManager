/**
 * Theme injection utility — generates CSS variable declarations from tokens.
 *
 * Use: call `generateCSSVariablesDeclaration()` to generate the :root
 * CSS block for index.css. This keeps the token definitions in TS and
 * prevents drift between the source and the rendered CSS.
 *
 * WhatsApp theme only (single-theme).
 */

import { CSSVariables } from './tokens';

/**
 * Generate the CSS text for :root (WhatsApp theme).
 */
export function generateLightThemeCSS(): string {
  const vars = CSSVariables.root;
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return lines.join('\n');
}

/**
 * @deprecated — kept for backward compatibility, returns empty string
 */
export function generateDarkThemeCSS(): string {
  return '';
}

/**
 * Generate the complete CSS variable declaration block.
 * Outputs:
 *   :root { ... WhatsApp theme ... }
 *
 * Dark theme is no longer supported (single-theme only).
 */
export function generateCSSVariablesDeclaration(): string {
  const lightCSS = generateLightThemeCSS();

  return `:root {
  color-scheme: light;
${lightCSS}
}`;
}

/**
 * Inject tokens into the live document's CSSStyleSheet.
 * WhatsApp theme only — isDark parameter is ignored for backward compatibility.
 *
 * This modifies the root element's inline styles in-place, so changes are
 * immediate and DOM re-renders are not forced.
 */
export function injectTokensIntoCSSVariables(isDark: boolean = false): void {
  // WhatsApp theme only — isDark is ignored
  const vars = CSSVariables.root;

  // Update each CSS variable on the root element
  const root = document.documentElement;
  Object.entries(vars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}
