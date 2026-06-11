// Verifies Hand_description/Hand-closures.json against the real Hand.urdf:
// sweeps each pusher servo across its limits and checks the ClosureSolver
// keeps every four-bar loop closed. Builds the kinematic tree from the URDF
// with the same joint behavior as urdf-loader (origin transform, then
// rotation about the local axis), since Node has no DOMParser.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Object3D, Vector3, Quaternion, Euler } from 'three';
import { ClosureSolver } from '../src/solver.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const urdfText = readFileSync(join(root, 'Hand_description/urdf/Hand.urdf'), 'utf8');
const { closures } = JSON.parse(
  readFileSync(join(root, 'Hand_description/Hand-closures.json'), 'utf8'),
);

class Joint extends Object3D {
  constructor({ name, type, axis, lower, upper }) {
    super();
    this.name = name;
    this.jointType = type;
    this.axis = new Vector3(...axis);
    this.limit = { lower, upper };
    this.jointValue = [0];
    this._origQuat = new Quaternion();
  }
  setJointValue(v) {
    if (this.jointType === 'revolute') {
      v = Math.min(this.limit.upper, Math.max(this.limit.lower, v));
    }
    this.jointValue = [v];
    const q = new Quaternion().setFromAxisAngle(this.axis, v);
    this.quaternion.copy(this._origQuat).multiply(q);
  }
  get angle() {
    return this.jointValue[0];
  }
}

const num = (s) => s.trim().split(/\s+/).map(Number);
const attr = (block, tag, name) =>
  block.match(new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`))?.[1];

const links = {};
for (const m of urdfText.matchAll(/<link name="([^"]+)">/g)) {
  const l = new Object3D();
  l.name = m[1];
  l.isURDFLink = true;
  links[m[1]] = l;
}

const joints = {};
for (const m of urdfText.matchAll(/<joint name="([^"]+)" type="([^"]+)">([\s\S]*?)<\/joint>/g)) {
  const [, name, type, body] = m;
  const xyz = num(attr(body, 'origin', 'xyz') ?? '0 0 0');
  const rpy = num(attr(body, 'origin', 'rpy') ?? '0 0 0');
  const axis = num(attr(body, 'axis', 'xyz') ?? '1 0 0');
  const lower = parseFloat(attr(body, 'limit', 'lower') ?? '-Infinity');
  const upper = parseFloat(attr(body, 'limit', 'upper') ?? 'Infinity');
  const parent = body.match(/<parent link="([^"]+)"/)[1];
  const child = body.match(/<child link="([^"]+)"/)[1];

  const j = new Joint({ name, type, axis, lower, upper });
  j.position.set(...xyz);
  j._origQuat.setFromEuler(new Euler(rpy[0], rpy[1], rpy[2], 'ZYX'));
  j.quaternion.copy(j._origQuat);
  links[parent].add(j);
  j.add(links[child]);
  if (type !== 'fixed') joints[name] = j;
}

const robot = new Object3D();
robot.add(links.base_link);
robot.joints = joints;
robot.links = links;
robot.updateMatrixWorld(true);

const solver = new ClosureSolver(robot);
solver.setClosures(closures);

// At the assembled zero pose every loop must already be closed.
const atZero = solver.closureErrors();
for (const { name, error } of atZero) {
  console.log(`${name}: gap at zero pose = ${(error * 1e6).toFixed(3)} µm`);
  if (error > 1e-6) {
    console.error('FAIL: loop not closed at export pose — anchors are wrong');
    process.exit(1);
  }
}

const DRIVES = [
  { joint: 'Revolute_18', loop: 'finger_second_loop' },
  { joint: 'Revolute_26', loop: 'finger_first_loop' },
  { joint: 'Revolute_22', loop: 'thumb_loop' },
];

let failures = 0;
for (const { joint: name, loop } of DRIVES) {
  const j = robot.joints[name];
  const { lower, upper } = j.limit;
  let worst = 0;
  const N = 30;
  for (let i = 0; i <= N; i++) {
    j.setJointValue(lower + (i / N) * (upper - lower));
    const { converged } = solver.solve();
    const err = solver.closureErrors().find((e) => e.name === loop).error;
    if (err > worst) worst = err;
    if (!converged) break;
  }
  j.setJointValue(0);
  solver.solve();
  const ok = worst < 1e-4;
  if (!ok) failures++;
  console.log(
    `${loop}: drive ${name} over [${lower.toFixed(3)}, ${upper.toFixed(3)}] rad — worst gap ${(worst * 1000).toFixed(4)} mm ${ok ? 'OK' : 'FAIL'}`,
  );
}

if (failures) {
  console.error(`${failures} loop(s) failed to close`);
  process.exit(1);
}
console.log('All hand closures verified.');
