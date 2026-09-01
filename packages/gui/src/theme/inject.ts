/**
 * Theme injection utility — generates CSS variable declarations from tokens.
 *
 * Use: call `generateCSSVariablesDeclaration()` to generate the :root and
 * html[data-theme="dark"] CSS blocks for index.css. This keeps the token
 * definitions in TS and prevents drift between the source and the rendered CSS.
 */

import { CSSVariables } from './tokens';

/**
 * Generate the CSS text for :root (light theme defaults).
 */
export function generateLightThemeCSS(): string {
  const vars = CSSVariables.light;
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return lines.join('\n');
}

/**
 * Generate the CSS text for html[data-theme="dark"].
 */
export function generateDarkThemeCSS(): string {
  const vars = CSSVariables.dark;
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return lines.join('\n');
}

/**
 * Generate the complete CSS variable declaration block.
 * Outputs:
 *   :root { ... light theme ... }
 *   html[data-theme="dark"] { ... dark theme ... }
 */
export function generateCSSVariablesDeclaration(): string {
  const lightCSS = generateLightThemeCSS();
  const darkCSS = generateDarkThemeCSS();

  return `:root {
  color-scheme: light;
${lightCSS}
}

html[data-theme="dark"] {
  color-scheme: dark;
${darkCSS}
}`;
}

/**
 * Inject tokens into the live document's CSSStyleSheet.
 * Used for runtime theme updates (e.g., ThemeToggle switching between light/dark).
 *
 * This modifies the first stylesheet's :root rule in-place, so changes are
 * immediate and DOM re-renders are not forced.
 */
export function injectTokensIntoCSSVariables(isDark: boolean = false): void {
  const vars = isDark ? CSSVariables.dark : CSSVariables.light;

  // Update each CSS variable on the root element
  const root = document.documentElement;
  Object.entries(vars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}
