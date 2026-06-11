import * as THREE from 'three';
import { Viewer } from './viewer.js';
import { ClosureSolver } from './solver.js';
import { ClosureMarkers } from './markers.js';
import {
  filesFromDataTransfer,
  filesFromInput,
  loadURDFFromFiles,
  loadURDFFromString,
  loadURDFFromURL,
} from './loaders.js';
import { DEMO_URDF, DEMO_CLOSURES } from './demoHand.js';
import { HAND_CLOSURES, isHandRobot } from './handClosures.js';
import { ServoBus, radToTicks, CENTER_TICKS } from './servo.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const viewer = new Viewer(viewport);
const markers = new ClosureMarkers(viewer.overlay);

const state = {
  robot: null,
  robotName: null,
  solver: null,
  closures: [], // plain JSON specs (see solver.js)
  pick: null, // {closureIndex, side} while pick mode is active
};

// ---------------------------------------------------------------------------
// Robot loading

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function clearRobot() {
  if (state.robot) {
    viewer.scene.remove(state.robot);
    state.robot.traverse((c) => {
      c.geometry?.dispose?.();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose?.());
    });
  }
  state.robot = null;
  state.solver = null;
  state.closures = [];
}

function adoptRobot(robot, { closures = null } = {}) {
  clearRobot();
  state.robot = robot;
  state.robotName = robot.robotName || 'robot';

  // Near-black CAD materials are unreadable on the white background —
  // lift anything very dark to a light steel while keeping real colors.
  robot.traverse((c) => {
    if (!c.isMesh || !c.material) return;
    for (const m of Array.isArray(c.material) ? c.material : [c.material]) {
      if (!m.color) continue;
      const hsl = m.color.getHSL({});
      if (hsl.l < 0.35) m.color.setHSL(hsl.h, Math.min(hsl.s, 0.15), 0.62);
    }
  });

  viewer.scene.add(robot);
  applyOrientation(loadSavedOrientation());
  robot.updateMatrixWorld(true);
  viewer.fit(robot);

  const box = new THREE.Box3().setFromObject(robot);
  markers.setScale(box.getSize(new THREE.Vector3()).length() || 0.1);

  state.solver = new ClosureSolver(robot);
  state.closures = closures ?? loadSavedClosures() ?? [];
  state.solver.setClosures(state.closures);

  $('btn-add-closure').disabled = false;
  $('btn-export-closures').disabled = false;
  $('btn-import-closures').disabled = false;
  $('drive-all-row').hidden = false;

  buildJointUI();
  buildClosureUI();
  buildHardwareUI();
  resolveAndRefresh();
  setStatus(`Loaded ${state.robotName} — ${Object.keys(robot.joints).length} joints`);
}

// ---------------------------------------------------------------------------
// Model orientation (rotate the whole robot to match how the real hand sits)

function orientationKey() {
  return `urdf-hand-viewer:orient:${state.robotName}`;
}

function loadSavedOrientation() {
  try {
    return JSON.parse(localStorage.getItem(orientationKey())) ?? [0, 0, 0];
  } catch {
    return [0, 0, 0];
  }
}

function applyOrientation(deg) {
  if (!state.robot) return;
  const rad = deg.map((d) => (d * Math.PI) / 180);
  state.robot.rotation.set(rad[0], rad[1], rad[2]);
  state.robot.updateMatrixWorld(true);
  ['rot-x', 'rot-y', 'rot-z'].forEach((id, i) => ($(id).value = deg[i]));
}

for (const id of ['rot-x', 'rot-y', 'rot-z']) {
  $(id).addEventListener('change', () => {
    const deg = ['rot-x', 'rot-y', 'rot-z'].map((n) => parseFloat($(n).value) || 0);
    applyOrientation(deg);
    localStorage.setItem(orientationKey(), JSON.stringify(deg));
  });
}

$('btn-fit').addEventListener('click', () => state.robot && viewer.fit(state.robot));

async function loadFromEntries(entries) {
  try {
    setStatus('Loading…');
    const { robot, urdfPath, missingMeshes, closures } = await loadURDFFromFiles(entries);
    adoptRobot(robot, { closures: closures ?? defaultClosuresFor(robot) });
    if (missingMeshes.length) {
      setStatus(
        `Loaded ${urdfPath}, but ${missingMeshes.length} mesh(es) not found — check console`,
        true,
      );
      console.warn('Missing meshes:', missingMeshes);
    }
  } catch (err) {
    console.error(err);
    setStatus(err.message, true);
  }
}

/**
 * Closures to apply when the robot ships no closures file: the built-in
 * Hand closures when the robot is the hand (they are the geometric truth —
 * derived from the CAD closing joints, so the back pushers drive the
 * fingertips with the real four-bar motion), else whatever was last saved.
 */
function defaultClosuresFor(robot) {
  if (isHandRobot(robot)) return structuredClone(HAND_CLOSURES);
  return loadSavedClosures(robot.robotName || 'robot');
}

async function loadBuiltInHand() {
  setStatus('Loading…');
  const { robot, missingMeshes } = await loadURDFFromURL('Hand_description/urdf/Hand.urdf', {
    packagePath: 'Hand_description',
  });
  adoptRobot(robot, { closures: structuredClone(HAND_CLOSURES) });
  if (missingMeshes.length) {
    setStatus(`Loaded Hand, but ${missingMeshes.length} mesh(es) failed — check console`, true);
    console.warn('Missing meshes:', missingMeshes);
  }
}

$('btn-load').addEventListener('click', () => $('file-folder').click());
$('file-folder').addEventListener('change', (e) => {
  if (e.target.files.length) loadFromEntries(filesFromInput(e.target));
  e.target.value = '';
});

$('btn-demo').addEventListener('click', () => {
  const robot = loadURDFFromString(DEMO_URDF);
  adoptRobot(robot, {
    closures: loadSavedClosures('demo_three_finger_hand') ?? structuredClone(DEMO_CLOSURES),
  });
});

$('btn-hand').addEventListener('click', () => {
  loadBuiltInHand().catch((err) => {
    console.error(err);
    setStatus(`Could not load the hand: ${err.message}`, true);
  });
});

// Open with the hand connected by default; fall back to the empty state if
// the Hand_description folder isn't being served (e.g. hosted build).
loadBuiltInHand().catch((err) => {
  console.warn('Built-in hand unavailable:', err);
  setStatus('Load a URDF folder to begin');
});

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  viewport.classList.add('dragover');
});
document.body.addEventListener('dragleave', (e) => {
  if (e.target === document.body || e.relatedTarget === null) viewport.classList.remove('dragover');
});
document.body.addEventListener('drop', async (e) => {
  e.preventDefault();
  viewport.classList.remove('dragover');
  const entries = await filesFromDataTransfer(e.dataTransfer);
  if (entries.length) loadFromEntries(entries);
});

// ---------------------------------------------------------------------------
// Joint helpers

function movableJoints() {
  if (!state.robot) return [];
  return Object.values(state.robot.joints).filter(
    (j) => j.jointType !== 'fixed' && !j.mimicJoint,
  );
}

function passiveNames() {
  return state.solver ? state.solver.passiveJointNames : new Set();
}

function jointValue(j) {
  return Array.isArray(j.jointValue) ? j.jointValue[0] : j.angle ?? 0;
}

function jointRange(j) {
  const lim = j.limit || {};
  let lo = typeof lim.lower === 'number' ? lim.lower : -Math.PI;
  let hi = typeof lim.upper === 'number' ? lim.upper : Math.PI;
  if (j.jointType === 'continuous' || (lo === 0 && hi === 0)) {
    lo = -Math.PI;
    hi = Math.PI;
  }
  return [lo, hi];
}

function formatJointValue(j) {
  const v = jointValue(j);
  return j.jointType === 'prismatic'
    ? `${(v * 1000).toFixed(1)}mm`
    : `${((v * 180) / Math.PI).toFixed(1)}°`;
}

// ---------------------------------------------------------------------------
// Joint panel

const jointWidgets = new Map(); // name -> {slider, valueEl}

function buildJointUI() {
  const list = $('joint-list');
  list.innerHTML = '';
  jointWidgets.clear();
  const passive = passiveNames();

  for (const j of movableJoints()) {
    const [lo, hi] = jointRange(j);
    const isPassive = passive.has(j.name);

    const row = document.createElement('div');
    row.className = 'joint-row' + (isPassive ? ' passive' : '');

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = j.name;
    if (isPassive) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'solved';
      name.appendChild(tag);
    }

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = lo;
    slider.max = hi;
    slider.step = (hi - lo) / 1000 || 0.001;
    slider.value = jointValue(j);
    slider.disabled = isPassive;

    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = formatJointValue(j);

    slider.addEventListener('input', () => {
      j.setJointValue(parseFloat(slider.value));
      resolveAndRefresh();
    });

    // Editable limits (deg) — updates the joint and the slider range
    const toDeg = (r) => ((r * 180) / Math.PI).toFixed(1);
    const limits = document.createElement('div');
    limits.className = 'limits';
    const loInp = document.createElement('input');
    const hiInp = document.createElement('input');
    for (const inp of [loInp, hiInp]) {
      inp.type = 'number';
      inp.step = '5';
      inp.title = 'Joint limit (deg)';
    }
    loInp.value = toDeg(lo);
    hiInp.value = toDeg(hi);
    const applyLimits = () => {
      const nlo = (parseFloat(loInp.value) * Math.PI) / 180;
      const nhi = (parseFloat(hiInp.value) * Math.PI) / 180;
      if (!Number.isFinite(nlo) || !Number.isFinite(nhi) || nlo >= nhi) return;
      j.limit = { ...j.limit, lower: nlo, upper: nhi };
      slider.min = nlo;
      slider.max = nhi;
      slider.step = (nhi - nlo) / 1000 || 0.001;
      if (!isPassive) j.setJointValue(Math.min(nhi, Math.max(nlo, jointValue(j))));
      resolveAndRefresh();
    };
    loInp.addEventListener('change', applyLimits);
    hiInp.addEventListener('change', applyLimits);
    limits.append(loInp, hiInp);

    row.append(name, slider, value, limits);
    list.appendChild(row);
    jointWidgets.set(j.name, { joint: j, slider, value });
  }

  if (!jointWidgets.size) {
    list.innerHTML = '<p class="hint">No movable joints in this URDF.</p>';
  }
}

function refreshJointWidgets() {
  const passive = passiveNames();
  for (const [name, w] of jointWidgets) {
    w.value.textContent = formatJointValue(w.joint);
    if (passive.has(name)) w.slider.value = jointValue(w.joint);
  }
}

$('drive-all').addEventListener('input', (e) => {
  const t = parseFloat(e.target.value);
  const passive = passiveNames();
  for (const j of movableJoints()) {
    if (passive.has(j.name)) continue;
    const [lo, hi] = jointRange(j);
    j.setJointValue(lo + t * (hi - lo));
  }
  for (const [name, w] of jointWidgets) {
    if (!passive.has(name)) w.slider.value = jointValue(w.joint);
  }
  resolveAndRefresh();
});

$('btn-zero').addEventListener('click', () => {
  for (const j of movableJoints()) {
    const [lo, hi] = jointRange(j);
    j.setJointValue(Math.min(hi, Math.max(lo, 0)));
  }
  $('drive-all').value = 0;
  for (const w of jointWidgets.values()) w.slider.value = jointValue(w.joint);
  resolveAndRefresh();
});

// ---------------------------------------------------------------------------
// Solve + refresh

function resolveAndRefresh() {
  if (!state.robot) return;
  if (state.solver && $('chk-solve').checked) {
    state.solver.solve();
  } else {
    state.robot.updateMatrixWorld(true);
  }
  refreshJointWidgets();
  refreshClosureGaps();
  schedulePosePush();
}

$('chk-solve').addEventListener('change', resolveAndRefresh);
$('chk-markers').addEventListener('change', (e) => markers.setVisible(e.target.checked));

viewer.onTick(() => {
  if (state.robot) markers.update(state.closures, state.robot);
});

// ---------------------------------------------------------------------------
// Closure persistence

function storageKey(name = state.robotName) {
  return `urdf-hand-viewer:closures:${name}`;
}

function saveClosures() {
  if (!state.robotName) return;
  localStorage.setItem(storageKey(), JSON.stringify(state.closures));
}

function loadSavedClosures(name = undefined) {
  try {
    const raw = localStorage.getItem(storageKey(name ?? state.robotName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function closuresChanged({ rebuildJoints = true } = {}) {
  state.solver.setClosures(state.closures);
  saveClosures();
  if (rebuildJoints) buildJointUI();
  resolveAndRefresh();
}

$('btn-export-closures').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ robot: state.robotName, closures: state.closures }, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.robotName}-closures.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('btn-import-closures').addEventListener('click', () => $('file-json').click());
$('file-json').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    state.closures = Array.isArray(data) ? data : data.closures || [];
    buildClosureUI();
    closuresChanged();
    setStatus(`Imported ${state.closures.length} closure(s)`);
  } catch (err) {
    setStatus(`Import failed: ${err.message}`, true);
  }
});

// ---------------------------------------------------------------------------
// Closure editor UI

const gapEls = [];

function buildClosureUI() {
  const list = $('closure-list');
  list.innerHTML = '';
  gapEls.length = 0;
  state.closures.forEach((c, i) => list.appendChild(closureCard(c, i)));
}

function closureCard(c, index) {
  const card = document.createElement('div');
  card.className = 'closure-card';

  // Header: enable, name, gap, delete
  const head = document.createElement('div');
  head.className = 'head';
  const enable = document.createElement('input');
  enable.type = 'checkbox';
  enable.checked = c.enabled !== false;
  enable.title = 'Enable this closure';
  enable.addEventListener('change', () => {
    c.enabled = enable.checked;
    closuresChanged();
  });
  const name = document.createElement('input');
  name.type = 'text';
  name.value = c.name || `closure_${index}`;
  name.addEventListener('change', () => {
    c.name = name.value;
    closuresChanged({ rebuildJoints: false });
  });
  const gap = document.createElement('span');
  gap.className = 'gap';
  gap.textContent = '—';
  gapEls[index] = gap;
  const del = document.createElement('button');
  del.className = 'small';
  del.textContent = '✕';
  del.title = 'Delete closure';
  del.addEventListener('click', () => {
    state.closures.splice(index, 1);
    buildClosureUI();
    closuresChanged();
  });
  head.append(enable, name, gap, del);
  card.appendChild(head);

  card.appendChild(anchorBlock(c, 'A', index));
  card.appendChild(anchorBlock(c, 'B', index));
  card.appendChild(passiveBlock(c));
  return card;
}

function anchorBlock(c, side, closureIndex) {
  const linkKey = `link${side}`;
  const anchorKey = `anchor${side}`;
  c[anchorKey] ??= [0, 0, 0];

  const block = document.createElement('div');
  block.className = 'anchor-block';

  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = side === 'A' ? '#ff4f6d' : '#37d3a0';
  lbl.append(dot, `Anchor ${side} — link + local offset (mm)`);
  block.appendChild(lbl);

  const select = document.createElement('select');
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = '(choose link)';
  select.appendChild(blank);
  for (const linkName of Object.keys(state.robot?.links || {})) {
    const opt = document.createElement('option');
    opt.value = linkName;
    opt.textContent = linkName;
    select.appendChild(opt);
  }
  select.value = c[linkKey] || '';
  select.addEventListener('change', () => {
    c[linkKey] = select.value;
    closuresChanged({ rebuildJoints: false });
  });
  block.appendChild(select);

  const xyz = document.createElement('div');
  xyz.className = 'xyz';
  const inputs = [0, 1, 2].map((axis) => {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = '0.1';
    inp.value = (c[anchorKey][axis] * 1000).toFixed(2);
    inp.addEventListener('change', () => {
      c[anchorKey][axis] = parseFloat(inp.value) / 1000 || 0;
      closuresChanged({ rebuildJoints: false });
    });
    xyz.appendChild(inp);
    return inp;
  });

  const pickBtn = document.createElement('button');
  pickBtn.className = 'small';
  pickBtn.textContent = 'pick';
  pickBtn.title = 'Click a point on the robot to set this anchor';
  pickBtn.addEventListener('click', () => {
    startPick(closureIndex, side, (linkName, local) => {
      c[linkKey] = linkName;
      c[anchorKey] = [local.x, local.y, local.z];
      select.value = linkName;
      inputs.forEach((inp, axis) => (inp.value = (c[anchorKey][axis] * 1000).toFixed(2)));
      closuresChanged({ rebuildJoints: false });
    });
  });
  xyz.appendChild(pickBtn);
  block.appendChild(xyz);
  return block;
}

function passiveBlock(c) {
  const block = document.createElement('div');
  block.className = 'passive-block';
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.textContent = 'Passive joints (solved to close the loop)';
  block.appendChild(lbl);

  c.passiveJoints ??= [];
  for (const j of movableJoints()) {
    const label = document.createElement('label');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = c.passiveJoints.includes(j.name);
    chk.addEventListener('change', () => {
      if (chk.checked) c.passiveJoints.push(j.name);
      else c.passiveJoints = c.passiveJoints.filter((n) => n !== j.name);
      closuresChanged();
    });
    label.append(chk, ` ${j.name}`);
    block.appendChild(label);
  }
  return block;
}

function refreshClosureGaps() {
  if (!state.solver) return;
  const errs = state.solver.closureErrors();
  const byName = new Map(errs.map((e) => [e.name, e.error]));
  state.closures.forEach((c, i) => {
    const el = gapEls[i];
    if (!el) return;
    if (c.enabled === false) {
      el.textContent = 'off';
      el.className = 'gap';
      return;
    }
    const err = byName.get(c.name);
    if (err === undefined) {
      el.textContent = 'incomplete';
      el.className = 'gap bad';
      return;
    }
    const ok = err < 1e-4;
    el.textContent = err < 1e-3 ? `${(err * 1e6).toFixed(0)}µm` : `${(err * 1000).toFixed(2)}mm`;
    el.className = 'gap ' + (ok ? 'ok' : 'bad');
  });
}

$('btn-add-closure').addEventListener('click', () => {
  state.closures.push({
    name: `closure_${state.closures.length}`,
    linkA: '',
    anchorA: [0, 0, 0],
    linkB: '',
    anchorB: [0, 0, 0],
    passiveJoints: [],
    enabled: true,
  });
  buildClosureUI();
  closuresChanged({ rebuildJoints: false });
});

// ---------------------------------------------------------------------------
// Hardware: Waveshare/Feetech ST3215 serial bus servos over USB (Web Serial).
// Actuated joints mirror their sliders; passive (solved) joints have no
// servo. All writes are broadcast sync-writes — no reply traffic on the
// half-duplex bus — and angles are clamped to the joint limits with bounded
// speed/acceleration before they reach the wire.

const bus = new ServoBus();

function servoMapKey() {
  return `urdf-hand-viewer:servo-map:${state.robotName}`;
}

function actuatedJoints() {
  const passive = passiveNames();
  return movableJoints().filter((j) => !passive.has(j.name));
}

function loadServoMap() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(servoMapKey())) ?? {};
  } catch {}
  const map = {};
  actuatedJoints().forEach((j, i) => {
    map[j.name] = { id: i + 1, sign: 1, center: CENTER_TICKS, enabled: true, ...saved[j.name] };
  });
  return map;
}

function saveServoMap(map) {
  localStorage.setItem(servoMapKey(), JSON.stringify(map));
}

let servoMap = {};

function setHwStatus(text, isError = false) {
  const el = $('hw-status');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function buildHardwareUI() {
  servoMap = loadServoMap();
  const list = $('hw-map');
  list.innerHTML = '';
  for (const j of actuatedJoints()) {
    const cfg = servoMap[j.name];
    const row = document.createElement('div');
    row.className = 'hw-row';

    const enable = document.createElement('input');
    enable.type = 'checkbox';
    enable.checked = cfg.enabled;
    enable.title = 'Send this joint to hardware';

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = j.name;

    const id = document.createElement('input');
    id.type = 'number';
    id.min = 1;
    id.max = 253;
    id.value = cfg.id;
    id.title = 'Servo bus ID';

    const inv = document.createElement('label');
    inv.className = 'chk';
    const invChk = document.createElement('input');
    invChk.type = 'checkbox';
    invChk.checked = cfg.sign < 0;
    inv.append(invChk, ' inv');
    inv.title = 'Invert rotation direction';

    const center = document.createElement('input');
    center.type = 'number';
    center.min = 0;
    center.max = 4095;
    center.value = cfg.center;
    center.title = 'Servo ticks at joint zero (calibration)';

    const update = () => {
      cfg.enabled = enable.checked;
      cfg.id = parseInt(id.value, 10) || 1;
      cfg.sign = invChk.checked ? -1 : 1;
      cfg.center = parseInt(center.value, 10) ?? CENTER_TICKS;
      saveServoMap(servoMap);
      schedulePosePush();
    };
    for (const el of [enable, id, invChk, center]) el.addEventListener('change', update);

    row.append(enable, name, id, inv, center);
    list.appendChild(row);
  }
}

let posePushTimer = null;

function schedulePosePush() {
  if (!bus.connected || !$('chk-torque').checked || posePushTimer) return;
  posePushTimer = setTimeout(() => {
    posePushTimer = null;
    pushPose().catch((err) => {
      console.error(err);
      setHwStatus(`write failed: ${err.message}`, true);
    });
  }, 50); // coalesce slider drags to ~20 Hz
}

async function pushPose() {
  if (!bus.connected) return;
  const speed = parseInt($('hw-speed').value, 10) || 800;
  const targets = [];
  for (const j of actuatedJoints()) {
    const cfg = servoMap[j.name];
    if (!cfg?.enabled) continue;
    const [lower, upper] = jointRange(j);
    targets.push({
      id: cfg.id,
      ticks: radToTicks(jointValue(j), { lower, upper, sign: cfg.sign, center: cfg.center }),
      speed,
      acc: 50,
    });
  }
  if (targets.length) await bus.writePositions(targets);
}

async function setAllTorque(on) {
  const rows = actuatedJoints()
    .filter((j) => servoMap[j.name]?.enabled)
    .map((j) => ({ id: servoMap[j.name].id, on }));
  if (rows.length) await bus.setTorque(rows);
}

$('btn-connect').addEventListener('click', async () => {
  try {
    if (bus.connected) {
      await setAllTorque(false);
      await bus.disconnect();
      $('btn-connect').textContent = 'Connect USB';
      setHwStatus('disconnected');
      return;
    }
    if (!bus.supported) {
      setHwStatus('Web Serial unavailable — use Chrome/Edge', true);
      return;
    }
    await bus.connect();
    $('btn-connect').textContent = 'Disconnect';
    setHwStatus('connected');
    if ($('chk-torque').checked) {
      await setAllTorque(true);
      await pushPose();
    }
  } catch (err) {
    console.error(err);
    setHwStatus(err.message, true);
  }
});

$('chk-torque').addEventListener('change', async (e) => {
  if (!bus.connected) return;
  try {
    await setAllTorque(e.target.checked);
    if (e.target.checked) await pushPose();
  } catch (err) {
    setHwStatus(err.message, true);
  }
});

// ---------------------------------------------------------------------------
// Anchor picking

function startPick(closureIndex, side, onPicked) {
  state.pick = { closureIndex, side, onPicked };
  viewport.classList.add('picking');
  $('pick-banner').hidden = false;
}

function endPick() {
  state.pick = null;
  viewport.classList.remove('picking');
  $('pick-banner').hidden = true;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.pick) endPick();
});

viewport.addEventListener('pointerdown', (e) => {
  if (!state.pick || !state.robot) return;
  const hit = viewer.pick(e, state.robot);
  if (!hit) return;
  e.stopPropagation();

  let obj = hit.object;
  while (obj && !obj.isURDFLink) obj = obj.parent;
  if (!obj) {
    setStatus('Could not resolve a URDF link from that mesh', true);
    endPick();
    return;
  }
  const local = obj.worldToLocal(hit.point.clone());
  state.pick.onPicked(obj.name, local);
  setStatus(`Anchor set on ${obj.name} at [${local.toArray().map((v) => (v * 1000).toFixed(1)).join(', ')}] mm`);
  endPick();
}, true);
