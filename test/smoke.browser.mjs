// Browser smoke test: loads the app in headless Chromium, loads the demo
// hand, drives the actuated joints, and asserts every closure gap stays
// closed. Run with the vite dev server already up (or pass a URL).
import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const URL_BASE = process.argv[2] || 'http://localhost:5173';

function findChromium() {
  const root = join(homedir(), 'Library/Caches/ms-playwright');
  const candidates = [
    'chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chromium_headless_shell-1161/chrome-mac/headless_shell',
  ];
  for (const rel of candidates) {
    try {
      const p = join(root, rel);
      readdirSync(join(p, '..'));
      return p;
    } catch {}
  }
  throw new Error('No cached playwright chromium found');
}

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto(URL_BASE, { waitUntil: 'networkidle' });
await page.click('#btn-demo');
await page.waitForFunction(() => document.getElementById('status').textContent.includes('Loaded'));
console.log('status:', await page.textContent('#status'));

const jointCount = await page.locator('.joint-row').count();
const closureCount = await page.locator('.closure-card').count();
console.log(`joint rows: ${jointCount}, closure cards: ${closureCount}`);
if (jointCount !== 9) throw new Error(`expected 9 joint rows, got ${jointCount}`);
if (closureCount !== 3) throw new Error(`expected 3 closure cards, got ${closureCount}`);

// Drive all actuated joints through their range and verify the loops close
for (const t of [0.25, 0.5, 0.75, 1.0]) {
  await page.locator('#drive-all').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, t);
  const gaps = await page.locator('.closure-card .gap').allTextContents();
  console.log(`drive=${t}: gaps = ${gaps.join(', ')}`);
  for (const g of gaps) {
    const ok = /µm/.test(g) && parseFloat(g) < 100;
    if (!ok) throw new Error(`closure gap not closed at drive=${t}: "${g}"`);
  }
}

// Passive joints must be tagged and disabled
const solvedTags = await page.locator('.joint-row .tag').count();
if (solvedTags !== 6) throw new Error(`expected 6 solved-tagged joints, got ${solvedTags}`);

await page.screenshot({ path: 'test/smoke-open.png' });
await page.locator('#drive-all').evaluate((el) => {
  el.value = 0.85;
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(300);
await page.screenshot({ path: 'test/smoke-flexed.png' });

if (errors.length) {
  console.error('Browser errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Smoke test passed.');
await browser.close();
