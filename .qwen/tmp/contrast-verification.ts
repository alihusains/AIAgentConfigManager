/**
 * Contrast ratio verification for icon/logo containers
 * Ensures WCAG AA minimum (3:1 for graphics, 4.5:1 for text)
 */

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// WCAG relative luminance
function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((x) => {
    x = x / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// WCAG contrast ratio
function getContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Test data
const colors = {
  // Light theme
  light: {
    canvas: '#f7f6fb',
    primary: '#ffffff',
    secondary: '#f0eef7',
    tertiary: '#ffffff',
    textPrimary: '#17151f',
    textSecondary: '#4c4959',
    iconBg: '#eae6f5', // NEW
    iconBgHover: '#dcd5ed', // NEW
    providerAnthropicIcon: '#8a6d26',
    providerOpenaiIcon: '#3a6d8c',
    providerBedrockIcon: '#9c5f22',
    providerVertexIcon: '#47598c',
  },
  // Dark theme
  dark: {
    canvas: '#0e0e13',
    primary: '#16161d',
    secondary: '#1c1c25',
    tertiary: '#22222d',
    textPrimary: '#f3f2f8',
    textSecondary: '#b7b4c4',
    iconBg: '#e8e6f0', // NEW
    iconBgHover: '#ddd9e8', // NEW
    providerAnthropicIcon: '#d4b160',
    providerOpenaiIcon: '#7fb3d5',
    providerBedrockIcon: '#e0a05c',
    providerVertexIcon: '#8fa3d9',
  },
};

console.log('='.repeat(80));
console.log('ICON CONTAINER CONTRAST RATIO VERIFICATION (WCAG AA)');
console.log('='.repeat(80));

// Light theme
console.log('\n📍 LIGHT THEME');
console.log('-'.repeat(80));

const lightTests = [
  {
    name: 'Icon container on light canvas',
    fg: colors.light.iconBg,
    bg: colors.light.canvas,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Icon container hover on light canvas',
    fg: colors.light.iconBgHover,
    bg: colors.light.canvas,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Text secondary on icon container',
    fg: colors.light.textSecondary,
    bg: colors.light.iconBg,
    minRatio: 4.5,
    graphicsOnly: false,
  },
  {
    name: 'Provider Anthropic icon on icon container',
    fg: colors.light.providerAnthropicIcon,
    bg: colors.light.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Provider OpenAI icon on icon container',
    fg: colors.light.providerOpenaiIcon,
    bg: colors.light.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Provider Bedrock icon on icon container',
    fg: colors.light.providerBedrockIcon,
    bg: colors.light.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Provider Vertex icon on icon container',
    fg: colors.light.providerVertexIcon,
    bg: colors.light.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
];

let lightPass = 0;
let lightFail = 0;

lightTests.forEach(({ name, fg, bg, minRatio, graphicsOnly }) => {
  const ratio = getContrastRatio(fg, bg);
  const pass = ratio >= minRatio;
  const status = pass ? '✓ PASS' : '✗ FAIL';
  const criterion = graphicsOnly ? '(graphics 3:1)' : '(text 4.5:1)';

  console.log(`${status} ${name}`);
  console.log(`      ${fg} on ${bg}`);
  console.log(`      Ratio: ${ratio.toFixed(2)}:1 (need ${minRatio}:1) ${criterion}`);

  if (pass) lightPass++;
  else lightFail++;
});

// Dark theme
console.log('\n📍 DARK THEME');
console.log('-'.repeat(80));

const darkTests = [
  {
    name: 'Icon container on dark canvas',
    fg: colors.dark.iconBg,
    bg: colors.dark.canvas,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Icon container hover on dark canvas',
    fg: colors.dark.iconBgHover,
    bg: colors.dark.canvas,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Text secondary on icon container',
    fg: colors.dark.textSecondary,
    bg: colors.dark.iconBg,
    minRatio: 4.5,
    graphicsOnly: false,
  },
  {
    name: 'Provider Anthropic icon on icon container',
    fg: colors.dark.providerAnthropicIcon,
    bg: colors.dark.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Provider OpenAI icon on icon container',
    fg: colors.dark.providerOpenaiIcon,
    bg: colors.dark.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Provider Bedrock icon on icon container',
    fg: colors.dark.providerBedrockIcon,
    bg: colors.dark.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
  {
    name: 'Provider Vertex icon on icon container',
    fg: colors.dark.providerVertexIcon,
    bg: colors.dark.iconBg,
    minRatio: 3,
    graphicsOnly: true,
  },
];

let darkPass = 0;
let darkFail = 0;

darkTests.forEach(({ name, fg, bg, minRatio, graphicsOnly }) => {
  const ratio = getContrastRatio(fg, bg);
  const pass = ratio >= minRatio;
  const status = pass ? '✓ PASS' : '✗ FAIL';
  const criterion = graphicsOnly ? '(graphics 3:1)' : '(text 4.5:1)';

  console.log(`${status} ${name}`);
  console.log(`      ${fg} on ${bg}`);
  console.log(`      Ratio: ${ratio.toFixed(2)}:1 (need ${minRatio}:1) ${criterion}`);

  if (pass) darkPass++;
  else darkFail++;
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Light theme: ${lightPass}/${lightTests.length} passed${lightFail > 0 ? ` (${lightFail} failed)` : ''}`);
console.log(`Dark theme:  ${darkPass}/${darkTests.length} passed${darkFail > 0 ? ` (${darkFail} failed)` : ''}`);
console.log(
  `\nOverall: ${lightPass + darkPass}/${lightTests.length + darkTests.length} WCAG AA tests passed`
);

if (lightFail + darkFail === 0) {
  console.log('\n✓ All contrast ratios meet WCAG AA standards');
  process.exit(0);
} else {
  console.log(`\n✗ ${lightFail + darkFail} contrast ratio test(s) failed`);
  process.exit(1);
}
