import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
const exe = join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();
await page.goto('http://localhost:5174');
await page.waitForFunction(() => document.getElementById('status').textContent.includes('Loaded Hand'));
const out = await page.evaluate(() => {
  const r = window.__state.retarget;
  const P = (x, y, z) => ({ x, y, z });
  const open = Array.from({ length: 21 }, () => P(0, 0, 0));
  open[1] = P(0.02, 0.03, -0.012); open[2] = P(0.045, 0.05, -0.012);
  open[3] = P(0.075, 0.065, -0.012); open[4] = P(0.10, 0.075, -0.012);
  open[5] = P(0.09, 0.025, 0); open[6] = P(0.13, 0.025, 0);
  open[7] = P(0.155, 0.025, 0); open[8] = P(0.175, 0.025, 0);
  open[9] = P(0.092, 0, 0); open[10] = P(0.135, 0, 0);
  open[11] = P(0.163, 0, 0); open[12] = P(0.185, 0, 0);
  const latIn = open.map((p) => ({ ...p }));
  latIn[3] = P(0.08, 0.04, -0.02); latIn[4] = P(0.105, 0.02, -0.025);

  r.resetCalibration(); for (let i = 0; i < 12; i++) r.addCalibration(open);
  const zero = () => { for (const d of r.digits) for (const j of d.jointObjs) j.setJointValue(0); r.solver.solve(); };
  const dt = r.digits.find((d) => d.key === 'thumb');
  const fingerMid = r.digits.find((d) => d.key === 'index').knuckle.clone()
    .add(r.digits.find((d) => d.key === 'middle').knuckle).multiplyScalar(0.5);

  zero();
  r.solve(r.humanToTargets(open), { iterations: 8 });
  const restDist = r._tip(dt).distanceTo(fingerMid);
  zero();
  r.solve(r.humanToTargets(latIn), { iterations: 8 });
  const inDist = r._tip(dt).distanceTo(fingerMid);
  const R6 = +(((Array.isArray(dt.jointObjs[0].jointValue) ? dt.jointObjs[0].jointValue[0] : 0) * 180) / Math.PI).toFixed(1);
  return {
    restThumbToFingers_mm: +(restDist * 1000).toFixed(1),
    latInThumbToFingers_mm: +(inDist * 1000).toFixed(1),
    R6_deg: R6,
    movedTowardFingers: inDist < restDist,
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
