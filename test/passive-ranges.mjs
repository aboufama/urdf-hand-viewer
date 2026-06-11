import { readFileSync } from 'node:fs';
import { Object3D, Vector3, Quaternion, Euler } from 'three';
import { ClosureSolver } from '/Users/andreboufama/Documents/PersonalStuff/robothand/urdf-hand-viewer/src/solver.js';
const root = '/Users/andreboufama/Documents/PersonalStuff/robothand/urdf-hand-viewer';
const urdfText = readFileSync(root + '/Hand_description/urdf/Hand.urdf', 'utf8');
const { closures } = JSON.parse(readFileSync(root + '/Hand_description/Hand-closures.json', 'utf8'));

class Joint extends Object3D {
  constructor({ name, type, axis, lower, upper }) {
    super();
    this.name = name; this.jointType = type;
    this.axis = new Vector3(...axis);
    this.limit = { lower, upper };
    this.jointValue = [0];
    this._origQuat = new Quaternion();
  }
  setJointValue(v) {
    if (this.jointType === 'revolute') v = Math.min(this.limit.upper, Math.max(this.limit.lower, v));
    this.jointValue = [v];
    const q = new Quaternion().setFromAxisAngle(this.axis, v);
    this.quaternion.copy(this._origQuat).multiply(q);
  }
  get angle() { return this.jointValue[0]; }
}
const num = (s) => s.trim().split(/\s+/).map(Number);
const attr = (b, t, n) => b.match(new RegExp(`<${t}[^>]*\\b${n}="([^"]*)"`))?.[1];
const links = {};
for (const m of urdfText.matchAll(/<link name="([^"]+)">/g)) { const l = new Object3D(); l.name = m[1]; l.isURDFLink = true; links[m[1]] = l; }
const joints = {};
for (const m of urdfText.matchAll(/<joint name="([^"]+)" type="([^"]+)">([\s\S]*?)<\/joint>/g)) {
  const [, name, type, body] = m;
  const j = new Joint({ name, type, axis: num(attr(body,'axis','xyz') ?? '1 0 0'), lower: parseFloat(attr(body,'limit','lower') ?? '-Infinity'), upper: parseFloat(attr(body,'limit','upper') ?? 'Infinity') });
  j.position.set(...num(attr(body,'origin','xyz') ?? '0 0 0'));
  j._origQuat.setFromEuler(new Euler(...num(attr(body,'origin','rpy') ?? '0 0 0'), 'ZYX'));
  j.quaternion.copy(j._origQuat);
  links[body.match(/<parent link="([^"]+)"/)[1]].add(j);
  j.add(links[body.match(/<child link="([^"]+)"/)[1]]);
  if (type !== 'fixed') joints[name] = j;
}
const robot = new Object3D();
robot.add(links.base_link);
robot.joints = joints; robot.links = links;
const solver = new ClosureSolver(robot);
solver.setClosures(closures);
solver.solve();

const LOOPS = [
  ['Revolute_18', ['Revolute_19', 'revolute_1']],
  ['Revolute_26', ['Revolute_27', 'Revolute']],
  ['Revolute_22', ['Revolute_23', 'revolute']],
];
for (const [drive, passive] of LOOPS) {
  const j = joints[drive];
  const ranges = passive.map(() => ({ lo: Infinity, hi: -Infinity }));
  let worst = 0;
  for (let i = 0; i <= 48; i++) {
    j.setJointValue(j.limit.lower + (i / 48) * (j.limit.upper - j.limit.lower));
    const res = solver.solve();
    worst = Math.max(worst, res.error);
    passive.forEach((n, k) => {
      const v = joints[n].jointValue[0];
      ranges[k].lo = Math.min(ranges[k].lo, v);
      ranges[k].hi = Math.max(ranges[k].hi, v);
    });
  }
  j.setJointValue(0); solver.solve();
  console.log(drive, '-> worst closure', (worst*1000).toFixed(3), 'mm');
  passive.forEach((n, k) => console.log(`  ${n}: [${(ranges[k].lo*180/Math.PI).toFixed(1)}, ${(ranges[k].hi*180/Math.PI).toFixed(1)}] deg`));
}
