import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:4321';
const SHOTS = '/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager/.qwen/tmp/shots';

const findings: {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  view: string;
  title: string;
  description: string;
  steps: string[];
  expected: string;
  actual: string;
}[] = [];

const consoleErrors: { msg: string; stack?: string }[] = [];
const pageErrors: { msg: string; stack?: string }[] = [];

function wire(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ msg: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ msg: err.message || String(err), stack: err.stack });
  });
}

async function shot(page: Page, name: string) {
  try {
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  } catch {
    // Continue if screenshot fails
  }
}

async function gotoView(page: Page, label: string) {
  const nav = page.locator('.sidebar .nav-item', { hasText: label }).first();
  await nav.click({ timeout: 10000 });
  await page.waitForTimeout(600);
}

test.beforeEach(async ({ page }) => {
  wire(page);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const close = page.locator(".sidebar button[aria-label='Close sidebar']");
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => {});
    await page.waitForTimeout(300);
  }
});

test.afterAll(() => {
  console.log('\n\n===== QA FINDINGS =====\n');
  if (findings.length === 0) {
    console.log('✓ NO CRITICAL OR HIGH ISSUES FOUND\n');
  } else {
    findings.forEach((f) => {
      console.log(`[${f.severity}] ${f.view} — ${f.title}`);
      console.log(`  Description: ${f.description}`);
      console.log(`  Steps: ${f.steps.join(' → ')}`);
      console.log(`  Expected: ${f.expected}`);
      console.log(`  Actual: ${f.actual}`);
      console.log();
    });
  }

  if (consoleErrors.length > 0) {
    console.log('===== CONSOLE ERRORS =====');
    consoleErrors.forEach((e) => console.log(`  ${e.msg}`));
  }
  if (pageErrors.length > 0) {
    console.log('===== PAGE ERRORS =====');
    pageErrors.forEach((e) => console.log(`  ${e.msg}`));
  }
});

test('all views render without crashes', async ({ page }) => {
  const views = [
    'Overview',
    'Model Providers',
    'MCP Servers',
    'Agents',
    'Skills',
    'CLI Tools',
    'Environment',
    'Permissions',
    'Settings',
  ];

  for (const viewName of views) {
    try {
      await gotoView(page, viewName);
      const main = page.locator('main#main');
      const isVisible = await main.isVisible().catch(() => false);
      const isEmpty = await main.evaluate((el) => el.textContent?.trim().length === 0);

      if (!isVisible || isEmpty) {
        findings.push({
          severity: 'High',
          view: viewName,
          title: 'View did not render properly',
          description: `The "${viewName}" view appears empty or not visible`,
          steps: [`Click sidebar nav "${viewName}"`],
          expected: 'View renders with content or honest empty state',
          actual: `isVisible=${isVisible}, isEmpty=${isEmpty}`,
        });
      }
      await shot(page, `view-${viewName.replace(/ /g, '-').toLowerCase()}`);
    } catch (err) {
      findings.push({
        severity: 'High',
        view: viewName,
        title: 'Failed to navigate to view',
        description: `Error navigating to ${viewName}`,
        steps: [`Click sidebar nav "${viewName}"`],
        expected: 'View navigates successfully',
        actual: String(err),
      });
    }
  }
});

test('command palette (Cmd-K) works', async ({ page }) => {
  await page.keyboard.press('Meta+KeyK');
  await page.waitForTimeout(300);

  const palette = page.locator('[role="dialog"], [class*="palette"], [class*="command"]').first();
  const visible = await palette.isVisible().catch(() => false);

  if (!visible) {
    findings.push({
      severity: 'Medium',
      view: 'Global',
      title: 'Command palette did not open',
      description: 'Pressing Cmd-K did not open the command palette',
      steps: ['Press Cmd-K', 'Wait 300ms', 'Look for palette dialog'],
      expected: 'Palette dialog visible',
      actual: `visible=${visible}`,
    });
  } else {
    await shot(page, 'palette-open');
  }

  await page.keyboard.press('Escape');
});

test('theme toggle works', async ({ page }) => {
  const before = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );

  // Press 't' to toggle
  await page.keyboard.press('t');
  await page.waitForTimeout(400);

  const after = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme')
  );

  if (before === after) {
    findings.push({
      severity: 'Medium',
      view: 'Settings',
      title: 'Theme toggle did not work',
      description: 'Pressing "t" did not toggle the theme',
      steps: ['Record theme before', 'Press t', 'Record theme after'],
      expected: 'Theme changed (before !== after)',
      actual: `before=${before}, after=${after}`,
    });
  }
  await shot(page, `theme-after-toggle`);
});

test('providers page interactions', async ({ page }) => {
  await gotoView(page, 'Model Providers');
  
  // Check if there's an "Add Provider" button
  const addBtn = page.locator('button', { hasText: /Add Provider|Add/ }).first();
  const btnExists = await addBtn.isVisible().catch(() => false);

  if (!btnExists) {
    findings.push({
      severity: 'Medium',
      view: 'Model Providers',
      title: 'Add Provider button not found',
      description: 'The "Add Provider" button is not visible on the providers page',
      steps: ['Navigate to Model Providers', 'Look for Add Provider button'],
      expected: 'Add Provider button is visible and clickable',
      actual: 'Button not found',
    });
  }

  await shot(page, 'providers-view');
});

test('mcp page loads tools', async ({ page }) => {
  await gotoView(page, 'MCP Servers');
  await page.waitForTimeout(2000); // Wait for MCP tool counts to load

  // Check for any "list failed" error badges
  const failedBadges = page.locator('.mcp-tools-failed, [class*="failed"]');
  const failedCount = await failedBadges.count().catch(() => 0);

  if (failedCount > 0) {
    findings.push({
      severity: 'High',
      view: 'MCP Servers',
      title: 'MCP tool listing failures',
      description: `${failedCount} MCP server(s) failed to list their tools`,
      steps: ['Navigate to MCP Servers', 'Wait for tool counts to load'],
      expected: 'All MCP servers show tool counts without errors',
      actual: `${failedCount} tool listing failures visible`,
    });
  }

  await shot(page, 'mcp-view');
});

test('no unhandled errors in console', async ({ page }) => {
  await page.goto(BASE + '/#/overview', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  if (consoleErrors.length > 0) {
    const criticalErrors = consoleErrors.filter(
      (e) => e.msg && (e.msg.includes('Error') || e.msg.includes('cannot') || e.msg.includes('404'))
    );
    if (criticalErrors.length > 0) {
      findings.push({
        severity: 'Medium',
        view: 'Global',
        title: 'Console errors detected',
        description: `${consoleErrors.length} console error(s) logged`,
        steps: ['Load any view', 'Check browser console'],
        expected: 'No critical errors in console',
        actual: `${consoleErrors.length} error(s): ${consoleErrors.map((e) => e.msg).join('; ')}`,
      });
    }
  }
});

test('responsive: sidebar collapses on small viewport', async ({ browser }) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage({ viewport: { width: 375, height: 667 } });
  wire(page);

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const sidebar = page.locator('.sidebar');
  const sidebarOpen = await sidebar.evaluate((el) => el.classList.contains('open'));

  if (sidebarOpen) {
    // Check that main content is still 375px wide (sidebar is overlay, not layout shift)
    const main = page.locator('main#main');
    const mainBox = await main.boundingBox();
    const windowWidth = await page.evaluate(() => window.innerWidth);

    if (mainBox && mainBox.width < windowWidth * 0.9) {
      findings.push({
        severity: 'High',
        view: 'Layout',
        title: 'Sidebar layout shift at mobile',
        description: 'On mobile, the sidebar is pushing main content instead of overlaying',
        steps: ['Set viewport to 375×667', 'Sidebar is open by default', 'Measure main width'],
        expected: 'Main content stays full width (sidebar is overlay)',
        actual: `mainWidth=${mainBox.width}, windowWidth=${windowWidth}`,
      });
    }
  }

  await context.close();
});

test('keyboard navigation: tab through elements', async ({ page }) => {
  await page.goto(BASE + '/#/providers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const focused: string[] = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    const activeTag = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? el.tagName : 'none';
    });
    if (activeTag && activeTag !== 'BODY' && activeTag !== 'HTML') {
      focused.push(activeTag);
    }
  }

  if (focused.length === 0) {
    findings.push({
      severity: 'Medium',
      view: 'Keyboard Navigation',
      title: 'Tab key does not navigate',
      description: 'Pressing Tab multiple times does not move focus to interactive elements',
      steps: ['Go to Providers', 'Press Tab 5 times', 'Check what gets focused'],
      expected: 'Tab navigates through BUTTON, INPUT, A elements',
      actual: `No elements focused (all were BODY/HTML)`,
    });
  }
});
