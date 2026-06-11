// Verifies the ClosureSolver closes the demo finger's four-bar loop across
// the knuckle's whole range. Builds the same kinematic chain as demoHand.js
// out of plain THREE Object3Ds with urdf-loader-compatible joint behavior.
import { Object3D, Vector3, Quaternion } from 'three';
import { ClosureSolver } from '../src/solver.js';

class MockJoint extends Object3D {
  constructor(name, axis, lower, upper) {
    super();
    this.name = name;
    this.jointType = 'revolute';
    this.axis = new Vector3(...axis);
    this.limit = { lower, upper };
    this.jointValue = [0];
    this._origQuat = new Quaternion();
  }
  setJointValue(v) {
    v = Math.min(this.limit.upper, Math.max(this.limit.lower, v));
    this.jointValue = [v];
    const q = new Quaternion().setFromAxisAngle(this.axis, v);
    this.quaternion.copy(this._origQuat).multiply(q);
  }
  get angle() {
    return this.jointValue[0];
  }
}

// Same numbers as demoHand.js
const L1 = 0.04;
const TAB = [0.012, 0.013, 0];
const COUPLER_PIVOT = [-0.01, 0.013, 0.008];
const COUPLER_LEN = Math.hypot(TAB[0] - COUPLER_PIVOT[0], L1 + TAB[2] - COUPLER_PIVOT[2]);

const robot = new Object3D();
const base = new Object3D();
base.name = 'base';
robot.add(base);

const knuckle = new MockJoint('knuckle', [0, 1, 0], 0, 1.45);
base.add(knuckle);
const proximal = new Object3D();
proximal.name = 'proximal';
knuckle.add(proximal);

const distalJoint = new MockJoint('distal_joint', [0, 1, 0], -0.3, 1.9);
distalJoint.position.set(0, 0, L1);
proximal.add(distalJoint);
const distal = new Object3D();
distal.name = 'distal';
distalJoint.add(distal);

const couplerJoint = new MockJoint('coupler_joint', [0, 1, 0], -0.5, 2.2);
couplerJoint.position.set(...COUPLER_PIVOT);
base.add(couplerJoint);
const coupler = new Object3D();
coupler.name = 'coupler';
couplerJoint.add(coupler);

robot.joints = { knuckle, distal_joint: distalJoint, coupler_joint: couplerJoint };
robot.links = { base, proximal, distal, coupler };

const solver = new ClosureSolver(robot);
solver.setClosures([
  {
    name: 'linkage',
    linkA: 'coupler',
    anchorA: [0, 0, COUPLER_LEN],
    linkB: 'distal',
    anchorB: TAB,
    passiveJoints: ['coupler_joint', 'distal_joint'],
  },
]);

let failures = 0;
let prevDistal = -Infinity;
console.log('knuckle(deg)  distal(deg)  coupler(deg)  gap(um)  iters');
for (let i = 0; i <= 29; i++) {
  const theta = (1.45 * i) / 29;
  knuckle.setJointValue(theta);
  const { converged, error, iterations } = solver.solve();
  const d = distalJoint.angle;
  const c = couplerJoint.angle;
  console.log(
    `${((theta * 180) / Math.PI).toFixed(1).padStart(11)}` +
      `${((d * 180) / Math.PI).toFixed(2).padStart(13)}` +
      `${((c * 180) / Math.PI).toFixed(2).padStart(14)}` +
      `${(error * 1e6).toFixed(2).padStart(9)}` +
      `${String(iterations).padStart(7)}`,
  );
  if (!converged || error > 1e-6) {
    console.error(`FAIL: did not close loop at knuckle=${theta.toFixed(3)} rad`);
    failures++;
  }
  if (d < prevDistal - 1e-3) {
    console.error(`FAIL: distal angle regressed at knuckle=${theta.toFixed(3)} rad`);
    failures++;
  }
  prevDistal = d;
}

// Sweep back down to confirm warm-start tracking both directions
for (let i = 29; i >= 0; i--) {
  knuckle.setJointValue((1.45 * i) / 29);
  const { error } = solver.solve();
  if (error > 1e-6) {
    console.error(`FAIL on downward sweep at step ${i}, gap=${error}`);
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll checks passed: loop closes across full range, both sweep directions.');
