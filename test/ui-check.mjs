import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function findChromium() {
  const root = join(homedir(), 'Library/Caches/ms-playwright');
  for (const rel of [
    'chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chromium_headless_shell-1161/chrome-mac/headless_shell',
  ]) {
    try { readdirSync(join(root, rel, '..')); return join(root, rel); } catch {}
  }
  throw new Error('No cached playwright chromium');
}

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(process.argv[2] || 'http://localhost:5174');
await page.waitForFunction(() => document.getElementById('status').textContent.includes('Loaded Hand'), { timeout: 30000 });
console.log('status:', await page.textContent('#status'));
console.log('gaps:', (await page.locator('.closure-card .gap').allTextContents()).join(', '));
console.log('hw rows:', await page.locator('.hw-row').count(), '| hw status:', await page.textContent('#hw-status'));

// curl all fingers via pusher servos, rotate the model upright-ish
for (const [name, v] of [['Revolute_18', -1.2], ['Revolute_26', 1.2], ['Revolute_22', -1.2]]) {
  await page.evaluate(([n, val]) => {
    const row = [...document.querySelectorAll('.joint-row')].find((r) => r.querySelector('.name').textContent.replace('solved', '') === n);
    const s = row.querySelector('input[type=range]');
    s.value = val;
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, [name, v]);
}
await page.fill('#rot-x', '-90');
await page.dispatchEvent('#rot-x', 'change');
await page.click('#btn-fit');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/hand-ui.png' });
console.log('gaps after curl+rotate:', (await page.locator('.closure-card .gap').allTextContents()).join(', '));
if (errors.length) { console.error('ERRORS:', errors); process.exit(1); }
console.log('UI check passed.');
await browser.close();
