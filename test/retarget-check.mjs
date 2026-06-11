import { chromium } from 'playwright-core';
import { homedir } from 'node:os';
import { join } from 'node:path';
const exe = join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:5174');
await page.waitForFunction(() => document.getElementById('status').textContent.includes('Loaded Hand'));

const results = await page.evaluate(() => {
  const r = window.__state.retarget;
  if (!r?.ready) return { error: 'retargeter not ready' };

  // Synthetic right hand, meters: palm faces -z, fingers +x, thumb +y
  const P = (x, y, z) => ({ x, y, z });
  const open = Array.from({ length: 21 }, () => P(0, 0, 0));
  open[1] = P(0.02, 0.03, -0.012); open[2] = P(0.045, 0.05, -0.012);
  open[3] = P(0.075, 0.065, -0.012); open[4] = P(0.10, 0.075, -0.012);
  open[5] = P(0.09, 0.025, 0); open[6] = P(0.13, 0.025, 0);
  open[7] = P(0.155, 0.025, 0); open[8] = P(0.175, 0.025, 0);
  open[9] = P(0.092, 0, 0); open[10] = P(0.135, 0, 0);
  open[11] = P(0.163, 0, 0); open[12] = P(0.185, 0, 0);

  const curled = open.map((p) => ({ ...p }));
  curled[6] = P(0.128, 0.025, -0.012); curled[7] = P(0.118, 0.025, -0.035); curled[8] = P(0.10, 0.025, -0.05);
  curled[10] = P(0.133, 0, -0.013); curled[11] = P(0.121, 0, -0.038); curled[12] = P(0.102, 0, -0.054);

  const pinch = open.map((p) => ({ ...p }));
  pinch[6] = P(0.128, 0.025, -0.012); pinch[7] = P(0.118, 0.025, -0.033); pinch[8] = P(0.103, 0.025, -0.045);
  pinch[3] = P(0.075, 0.045, -0.03); pinch[4] = P(0.103, 0.025, -0.045); // thumb tip == index tip

  const latIn = open.map((p) => ({ ...p }));   // thumb rotated toward fingers
  latIn[3] = P(0.08, 0.04, -0.02); latIn[4] = P(0.105, 0.02, -0.025);
  const latOut = open.map((p) => ({ ...p }));  // thumb spread away
  latOut[3] = P(0.07, 0.075, -0.012); latOut[4] = P(0.09, 0.10, -0.012);

  const mirror = (lm) => lm.map((p) => ({ x: p.x, y: -p.y, z: p.z }));
  const calibrate = (lm) => { r.resetCalibration(); for (let i = 0; i < 12; i++) r.addCalibration(lm); };
  const zeroAll = () => { for (const d of r.digits) for (const j of d.jointObjs) j.setJointValue(0); r.solver.solve(); };

  const solveCase = (lm) => {
    const targets = r.humanToTargets(lm);
    r.solve(targets, { iterations: 8 });
    const out = {};
    for (const d of r.digits) {
      const tip = r._tip(d);
      out[d.key] = {
        residual_mm: +(tip.distanceTo(targets[d.key]) * 1000).toFixed(2),
        tip: tip.toArray().map((v) => +v.toFixed(4)),
        joints: Object.fromEntries(d.jointObjs.map((j) => [j.name, +((Array.isArray(j.jointValue) ? j.jointValue[0] : 0) * 180 / Math.PI).toFixed(1)])),
      };
    }
    return out;
  };
  const tipDist = (res, a, b) => +(Math.hypot(...res[a].tip.map((v, i) => v - res[b].tip[i])) * 1000).toFixed(1);

  calibrate(open);
  const out = {};
  zeroAll();
  out.open = solveCase(open);
  out.restThumbIndex_mm = tipDist(out.open, 'thumb', 'index');
  out.curled = solveCase(curled);
  zeroAll();
  out.pinch = solveCase(pinch);
  out.pinchThumbIndex_mm = tipDist(out.pinch, 'thumb', 'index');
  zeroAll();
  out.latIn = solveCase(latIn).thumb;
  zeroAll();
  out.latOut = solveCase(latOut).thumb;

  // mirrored left hand, recalibrated with mirrored open pose
  calibrate(mirror(open));
  zeroAll();
  out.mirrorOpen = solveCase(mirror(open));
  zeroAll();
  out.mirrorLatIn = solveCase(mirror(latIn)).thumb;

  calibrate(open);
  zeroAll();
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) r.solve(r.humanToTargets(curled), { iterations: 4 });
  out.msPerSolve = +((performance.now() - t0) / 20).toFixed(2);
  return out;
});
console.log(JSON.stringify(results, null, 2));
await browser.close();
