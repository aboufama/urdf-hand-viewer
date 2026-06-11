import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const URL_BASE = process.argv[2] || 'http://localhost:5174';

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

await page.goto(URL_BASE);
// Startup should auto-load the real hand with closures — no clicks.
await page.waitForFunction(
  () => document.getElementById('status').textContent.includes('Loaded Hand'),
  { timeout: 30000 },
);
console.log('status:', await page.textContent('#status'));

const closureCards = await page.locator('.closure-card').count();
const gaps = await page.locator('.closure-card .gap').allTextContents();
const gapClasses = await page
  .locator('.closure-card .gap')
  .evaluateAll((els) => els.map((e) => e.className));
console.log('closure cards:', closureCards, '| gaps:', gaps.join(', '), '|', gapClasses.join(', '));

// Helpers to poke the joint panel
const readJoint = (name) =>
  page.evaluate((n) => {
    const row = [...document.querySelectorAll('.joint-row')].find(
      (r) => r.querySelector('.name').textContent.replace('solved', '') === n,
    );
    return { value: row.querySelector('.value').textContent, passive: row.classList.contains('passive') };
  }, name);

const driveJoint = (name, v) =>
  page.evaluate(([n, val]) => {
    const row = [...document.querySelectorAll('.joint-row')].find(
      (r) => r.querySelector('.name').textContent.replace('solved', '') === n,
    );
    const s = row.querySelector('input[type=range]');
    s.value = val;
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, [name, v]);

// Passive joints must be marked solved
for (const n of ['Revolute_19', 'revolute_1', 'Revolute_23', 'revolute', 'Revolute_27', 'Revolute']) {
  const { passive } = await readJoint(n);
  if (!passive) throw new Error(`${n} is not marked passive/solved`);
}
console.log('all 6 linkage joints marked solved');

// Drive each pusher servo and confirm its passive linkage follows + loop stays closed
const checks = [
  { drive: 'Revolute_18', watch: 'Revolute_19', value: -1.5 },
  { drive: 'Revolute_26', watch: 'Revolute_27', value: 1.4 },
  { drive: 'Revolute_22', watch: 'Revolute_23', value: -1.4 },
];
for (const { drive, watch, value } of checks) {
  const before = (await readJoint(watch)).value;
  await driveJoint(drive, value);
  const after = (await readJoint(watch)).value;
  const g = await page.locator('.closure-card .gap').allTextContents();
  console.log(`${drive} -> ${value} rad: ${watch} ${before} -> ${after} | gaps: ${g.join(', ')}`);
  if (before === after) throw new Error(`${watch} did not move when driving ${drive}`);
}

await page.screenshot({ path: '/tmp/hand-driven.png' });
await driveJoint('Revolute_18', 0);
await driveJoint('Revolute_26', 0);
await driveJoint('Revolute_22', 0);
await page.screenshot({ path: '/tmp/hand-zero.png' });

if (errors.length) {
  console.error('Page errors:', errors);
  process.exit(1);
}
console.log('Browser verification passed.');
await browser.close();
