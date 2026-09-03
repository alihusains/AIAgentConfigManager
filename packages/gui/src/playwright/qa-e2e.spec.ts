import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:4321';
const SHOTS = '/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager/.qwen/tmp/shots';

/** Collect console errors + page errors across the whole run. */
const consoleErrors: string[] = [];
const pageErrors: string[] = [];
const failedRequests: string[] = [];

function wire(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/api/')) {
      failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

/** Navigate to a view via the sidebar nav and wait for it to settle. */
async function gotoView(page: Page, label: string) {
  // The sidebar is an overlay on mobile; on desktop it's always visible.
  const nav = page.locator('.sidebar .nav-item', { hasText: label }).first();
  await nav.click({ timeout: 10000 });
  await page.waitForTimeout(600);
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  wire(page);
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  // Close mobile sidebar if present so it doesn't overlay content.
  const close = page.locator(".sidebar button[aria-label='Close sidebar']");
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => {});
    await page.waitForTimeout(300);
  }
});

test('collect console/page errors across all views', async ({ page }) => {
  const views = [
    ['overview', 'Overview'],
    ['providers', 'Model Providers'],
    ['mcp', 'MCP'],
    ['agents', 'Agents'],
    ['skills', 'Skills'],
    ['tools', 'CLI Tools'],
    ['env-vars', 'Environment'],
    ['permissions', 'Permissions'],
    ['settings', 'Settings'],
  ] as const;

  for (const [id, title] of views) {
    await page.goto(`${BASE}/#/${id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    // Verify the view actually rendered (a heading or main content is non-empty)
    const main = page.locator('main#main');
    await expect(main).not.toBeEmpty();
    await shot(page, `view-${id}`);
  }

  // Log all collected errors (do not fail here; we report them).
  console.log('\n===== CONSOLE ERRORS =====');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
  console.log('\n===== PAGE ERRORS =====');
  console.log(pageErrors.length ? pageErrors.join('\n') : '(none)');
  console.log('\n===== FAILED/4xx API REQUESTS =====');
  console.log(failedRequests.length ? failedRequests.join('\n') : '(none)');
});

test('command palette opens with Cmd-K and navigates', async ({ page }) => {
  await page.keyboard.press('Meta+KeyK');
  await page.waitForTimeout(400);
  // Palette should be visible
  const palette = page.locator('[role="dialog"], .command-palette, [class*="palette"]').first();
  const visible = await palette.isVisible().catch(() => false);
  console.log('PALETTE VISIBLE:', visible);
  await shot(page, 'palette-open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const stillVisible = await palette.isVisible().catch(() => false);
  console.log('PALETTE CLOSED AFTER ESC:', !stillVisible);
});

test('keyboard navigation: Tab reaches interactive elements', async ({ page }) => {
  await page.goto(`${BASE}/#/providers`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // Tab a few times and record what's focused
  const focused: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return '(none)';
      return el.tagName + (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : '') + (el.textContent?.trim().slice(0, 30) || '');
    });
    focused.push(label);
  }
  console.log('TAB ORDER:', JSON.stringify(focused));
});
