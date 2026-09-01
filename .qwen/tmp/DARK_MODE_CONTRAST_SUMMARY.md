# Dark Mode Contrast Fix — Phase 4, Task T3

## Summary
Implemented theme-aware background colors for image/icon containers to ensure WCAG AA contrast ratios (3:1 minimum for graphics) in both light and dark themes.

## Changes Made

### 1. Added CSS Variables
**File:** `packages/gui/src/index.css`

#### Light Theme (`:root`)
```css
--icon-bg-container: var(--bg-secondary);  /* #f0eef7 */
--icon-bg-container-hover: var(--bg-active);  /* #e3e0ec */
```

#### Dark Theme (`html[data-theme="dark"]`)
```css
--icon-bg-container: var(--bg-secondary);  /* #1c1c25 */
--icon-bg-container-hover: var(--bg-active);  /* #2b2b37 */
```

**Rationale:** Using the existing secondary surface color provides:
- Good contrast for all provider icon colors (pass WCAG AA 3:1)
- Semantic connection to card/container surfaces
- Automatic theme switching without duplication
- Hover state uses the active color for visual feedback

### 2. Updated Component Styles

#### `.ptype-icon` (Provider type icons in table/cards)
**Before:** `background: color-mix(in srgb, var(--ptype, var(--accent-info)) 13%, transparent);`
**After:** 
```css
background: var(--icon-bg-container);
border: 1px solid color-mix(in srgb, var(--ptype, var(--accent-info)) 20%, transparent);
```
- Added visual boundary with provider-specific border color
- Provides better contrast for provider icons
- Hover state transitions to darker surface

#### `.sidebar-brand-icon` (Logo in sidebar header)
**Before:** No background container
**After:**
```css
background: var(--icon-bg-container);
padding: 4px;
box-sizing: border-box;
```
- Logo now has proper background container
- Ensures light/white logos are visible on both themes
- Padding provides breathing room

#### `.avatar` (Agent avatar circles in "Installed On" column)
**Before:** `background: var(--bg-tertiary);` (always white)
**After:** `background: var(--icon-bg-container);`
- Now respects theme for better visual consistency
- Added transition for smooth hover effects

#### `.mcp-avatar-remove` (Remove button on MCP avatars)
**Before:** `background: var(--bg-tertiary);`
**After:** `background: var(--icon-bg-container);`
- Consistent with avatar styling

#### `.mcp-avatar-more` ("+N" count badge)
**Before:** `background: var(--bg-tertiary);`
**After:** `background: var(--icon-bg-container);`
- Consistent theming with other avatar elements

## Contrast Verification Results

### Light Theme
| Element | Icon/Logo | Container | Ratio | Required | ✓ Pass |
|---------|-----------|-----------|-------|----------|--------|
| Provider Anthropic | #8a6d26 | #f0eef7 | 4.25:1 | 3:1 | ✓ |
| Provider OpenAI | #3a6d8c | #f0eef7 | 4.88:1 | 3:1 | ✓ |
| Provider Bedrock | #9c5f22 | #f0eef7 | 4.49:1 | 3:1 | ✓ |
| Provider Vertex | #47598c | #f0eef7 | 5.94:1 | 3:1 | ✓ |
| Text secondary | #4c4959 | #f0eef7 | 7.6:1 | 4.5:1 | ✓ |

### Dark Theme
| Element | Icon/Logo | Container | Ratio | Required | ✓ Pass |
|---------|-----------|-----------|-------|----------|--------|
| Provider Anthropic | #d4b160 | #1c1c25 | 8.26:1 | 3:1 | ✓ |
| Provider OpenAI | #7fb3d5 | #1c1c25 | 7.5:1 | 3:1 | ✓ |
| Provider Bedrock | #e0a05c | #1c1c25 | 7.53:1 | 3:1 | ✓ |
| Provider Vertex | #8fa3d9 | #1c1c25 | 6.77:1 | 3:1 | ✓ |
| Text secondary | #b7b4c4 | #1c1c25 | 8.32:1 | 4.5:1 | ✓ |

**Result: 10/10 WCAG AA tests PASS ✓**

## Locations Updated

### Providers Table
- `.ptype-icon` — Provider type icon containers (Anthropic, OpenAI, Bedrock, Vertex)
- `.avatar` — Agent avatar circles in "Installed On" column
- `.avatar-pop-row` — Full agent list when hovering avatar stack

### Sidebar
- `.sidebar-brand-icon` — Logo in sidebar header (AI Config logo)
- `.mcp-avatar-remove` — Remove button on MCP agent avatars
- `.mcp-avatar-more` — "+N more" badge on MCP agent stacks

### Provider Details
- All provider icons now use the theme-aware container

## Visual Changes

### Light Mode
- Icon containers are slightly darker (secondary surface #f0eef7)
- Provides visual separation from white canvas background
- Icons remain clearly visible with excellent contrast

### Dark Mode
- Icon containers are darker (secondary surface #1c1c25)
- Perfectly complements dark theme aesthetic
- Light provider icons pop against darker background
- No more contrast issues with dark-on-dark icons

## Testing
- ✓ All contrast ratios verified to meet WCAG AA minimum (3:1 for graphics, 4.5:1 for text)
- ✓ No visual regressions — existing tests pass
- ✓ Both themes consistently styled
- ✓ Hover states provide visual feedback via darker background

## Exit Criteria Met
- ✓ All image containers have appropriate contrast in both themes
- ✓ WCAG AA contrast ratios maintained (verified in all 10 test cases)
- ✓ No visual regressions
- ✓ Dark/light themes are consistent
- ✓ CSS variables properly defined and applied
