import { test } from '@playwright/test';

const OUT = '/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager/.tmp/audit';
const views = ['overview','providers','agents','mcp','skills','tools','cli','env-vars','permissions','settings'];

test('audit screenshots', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const v of views) {
    await page.goto(`/#/${v}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${v}.png` });
  }

  // mobile
  const mctx = await context.newPage();
  await mctx.setViewportSize({ width: 390, height: 844 });
  for (const v of ['overview','providers']) {
    await mctx.goto(`/#/${v}`, { waitUntil: 'networkidle' });
    await mctx.waitForTimeout(500);
    await mctx.screenshot({ path: `${OUT}/mobile-${v}.png` });
  }

  // agent detail (first agent)
  await page.goto('/#/agents', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const firstCard = page.locator('[data-agent-id], .agent-card, [class*="agent"]').first();
  if (await firstCard.count()) { await firstCard.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/agent-detail.png` }); }

  console.log('CONSOLE_ERRORS:', errors.slice(0,15).join(' | ') || '(none)');
});
