import { expect, test } from '@playwright/test';

/**
 * Responsive layout regression tests.
 *
 * Each test runs under one of the three viewport projects defined in
 * playwright.config.ts (320px, 375px, 1200px). The tests are written
 * viewport-agnostically and assert invariants that must hold at every size.
 *
 * Note: below 768px the sidebar is a fixed overlay that is OPEN by default
 * (see App.tsx / .sidebar.open). A fixed overlay extends body.scrollWidth,
 * so overflow invariants are measured with the sidebar explicitly closed.
 */

test.describe('responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10_000 });
  });

  /** Close the mobile sidebar overlay if it is open (no-op on desktop). */
  async function closeMobileSidebar(page: import('@playwright/test').Page) {
    const close = page.locator(".sidebar button[aria-label='Close sidebar']");
    if (await close.isVisible()) {
      await close.click();
      // Wait for the translateX(-100%) transition to settle.
      await page.waitForTimeout(300);
    }
  }

  test('no horizontal overflow', async ({ page }) => {
    await closeMobileSidebar(page);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(
      scrollWidth,
      `body scrollWidth ${scrollWidth}px exceeds viewport ${innerWidth}px`
    ).toBeLessThanOrEqual(innerWidth);
  });

  test('sidebar is overlay, not a layout element, on small viewports', async ({ page }) => {
    const main = page.locator('main#main');
    await expect(main).toBeVisible();

    // With the mobile sidebar open, the fixed overlay must NOT push the main
    // content off-screen: main stays at x=0 spanning the full viewport width.
    const openBox = await main.boundingBox();
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(openBox, 'main content has no bounding box').not.toBeNull();
    if (openBox) {
      expect(openBox.x).toBeGreaterThanOrEqual(0);
      expect(openBox.x + openBox.width).toBeLessThanOrEqual(innerWidth + 1);
    }

    // After closing the sidebar, main must still be fully visible and
    // unchanged in width — proof the sidebar never participates in layout.
    await closeMobileSidebar(page);
    const closedBox = await main.boundingBox();
    if (openBox && closedBox) {
      expect(closedBox.width).toBe(openBox.width);
      expect(closedBox.x + closedBox.width).toBeLessThanOrEqual(innerWidth + 1);
    }
  });

  test('app renders content at this viewport', async ({ page }) => {
    await closeMobileSidebar(page);
    const main = page.locator('main#main');
    await expect(main).not.toBeEmpty();
  });
});
