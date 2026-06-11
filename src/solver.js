import { Vector3 } from 'three';

/**
 * Solves closed kinematic loops that URDF cannot represent.
 *
 * A "closure" declares that a point fixed on link A must coincide with a
 * point fixed on link B (the two halves of the joint that was disconnected
 * for URDF export). A set of passive joints is listed as the unknowns; the
 * solver finds passive joint values that close the loop, given whatever the
 * actuated joints are currently set to.
 *
 * Closure spec (plain JSON, serializable):
 * {
 *   name: "finger1_linkage",
 *   linkA: "finger1_coupler",  anchorA: [x, y, z],   // link-local, meters
 *   linkB: "finger1_distal",   anchorB: [x, y, z],
 *   passiveJoints: ["finger1_coupler_joint", "finger1_distal_joint"],
 *   enabled: true
 * }
 *
 * All enabled closures are solved simultaneously (they may share passive
 * joints) with damped least squares (Levenberg-Marquardt) over a numeric
 * Jacobian. Problems are tiny (a few unknowns per loop) so this runs well
 * within a frame.
 */
export class ClosureSolver {
  constructor(robot) {
    this.robot = robot;
    this.closures = [];
    this._resolved = [];
    this._unknowns = [];
  }

  setClosures(closures) {
    this.closures = closures;
    this._resolve();
  }

  _resolve() {
    this._resolved = [];
    const unknownSet = new Map();
    for (const c of this.closures) {
      if (c.enabled === false) continue;
      const linkA = this.robot.links?.[c.linkA];
      const linkB = this.robot.links?.[c.linkB];
      if (!linkA || !linkB) continue;
      const joints = (c.passiveJoints || [])
        .map((n) => this.robot.joints?.[n])
        .filter((j) => j && j.jointType !== 'fixed');
      if (joints.length === 0) continue;
      this._resolved.push({
        spec: c,
        linkA,
        linkB,
        anchorA: new Vector3().fromArray(c.anchorA),
        anchorB: new Vector3().fromArray(c.anchorB),
      });
      for (const j of joints) unknownSet.set(j.name, j);
    }
    this._unknowns = [...unknownSet.values()];
  }

  get passiveJointNames() {
    const names = new Set();
    for (const c of this.closures) {
      if (c.enabled === false) continue;
      for (const n of c.passiveJoints || []) names.add(n);
    }
    return names;
  }

  /** Residual vector: concatenated (pA - pB) for every enabled closure. */
  computeResiduals(out = []) {
    this.robot.updateMatrixWorld(true);
    out.length = 0;
    const pA = new Vector3();
    const pB = new Vector3();
    for (const c of this._resolved) {
      pA.copy(c.anchorA);
      c.linkA.localToWorld(pA);
      pB.copy(c.anchorB);
      c.linkB.localToWorld(pB);
      out.push(pA.x - pB.x, pA.y - pB.y, pA.z - pB.z);
    }
    return out;
  }

  /** Per-closure gap distances (meters), for UI display. */
  closureErrors() {
    const r = this.computeResiduals();
    const errs = [];
    for (let i = 0; i < this._resolved.length; i++) {
      const dx = r[3 * i], dy = r[3 * i + 1], dz = r[3 * i + 2];
      errs.push({
        name: this._resolved[i].spec.name,
        error: Math.hypot(dx, dy, dz),
      });
    }
    return errs;
  }

  _getValue(joint) {
    return Array.isArray(joint.jointValue) ? joint.jointValue[0] : joint.angle ?? 0;
  }

  _setValue(joint, v) {
    const { lower, upper } = this._limits(joint);
    joint.setJointValue(Math.min(upper, Math.max(lower, v)));
  }

  _limits(joint) {
    const lim = joint.limit || {};
    let lower = typeof lim.lower === 'number' ? lim.lower : -Infinity;
    let upper = typeof lim.upper === 'number' ? lim.upper : Infinity;
    if (joint.jointType === 'continuous' || (lower === 0 && upper === 0)) {
      lower = -Infinity;
      upper = Infinity;
    }
    return { lower, upper };
  }

  /**
   * Drive passive joints to close all loops. Warm-starts from current
   * values, so per-frame updates converge in a handful of iterations.
   */
  solve({ maxIterations = 50, tolerance = 1e-7, fdStep = 1e-5 } = {}) {
    const joints = this._unknowns;
    const n = joints.length;
    if (n === 0 || this._resolved.length === 0) {
      return { converged: true, error: 0, iterations: 0 };
    }

    let q = joints.map((j) => this._getValue(j));
    const apply = (vals) => {
      for (let i = 0; i < n; i++) this._setValue(joints[i], vals[i]);
    };

    apply(q);
    let r = this.computeResiduals();
    let err = norm(r);
    let lambda = 1e-6;
    let iter = 0;

    for (; iter < maxIterations && err > tolerance; iter++) {
      // Numeric Jacobian, m x n
      const m = r.length;
      const J = [];
      for (let i = 0; i < m; i++) J.push(new Array(n));
      for (let k = 0; k < n; k++) {
        const saved = q[k];
        this._setValue(joints[k], saved + fdStep);
        const rPlus = this.computeResiduals([]);
        this._setValue(joints[k], saved);
        for (let i = 0; i < m; i++) J[i][k] = (rPlus[i] - r[i]) / fdStep;
      }

      // (JtJ + lambda*I) dq = -Jt r, retried with larger damping on failure
      let improved = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const JtJ = [];
        const Jtr = new Array(n).fill(0);
        for (let a = 0; a < n; a++) {
          JtJ.push(new Array(n).fill(0));
          for (let b = 0; b < n; b++) {
            let s = 0;
            for (let i = 0; i < m; i++) s += J[i][a] * J[i][b];
            JtJ[a][b] = s;
          }
          for (let i = 0; i < m; i++) Jtr[a] += J[i][a] * r[i];
          JtJ[a][a] += lambda;
        }
        const dq = solveLinear(JtJ, Jtr.map((v) => -v));
        if (!dq) {
          lambda *= 10;
          continue;
        }
        const qTrial = q.map((v, i) => v + dq[i]);
        apply(qTrial);
        // Read back clamped values so limits are respected in state
        const qClamped = joints.map((j) => this._getValue(j));
        const rTrial = this.computeResiduals([]);
        const errTrial = norm(rTrial);
        if (errTrial < err) {
          q = qClamped;
          r = rTrial;
          err = errTrial;
          lambda = Math.max(lambda * 0.3, 1e-9);
          improved = true;
          break;
        }
        lambda *= 10;
      }
      if (!improved) break; // stuck (e.g. linkage at a lock-up); keep best
      apply(q);
    }

    apply(q);
    this.robot.updateMatrixWorld(true);
    return { converged: err <= Math.max(tolerance, 1e-5), error: err, iterations: iter };
  }
}

function norm(v) {
  let s = 0;
  for (const x of v) s += x * x;
  return Math.sqrt(s);
}

/** Gaussian elimination with partial pivoting. Returns null if singular. */
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    if (Math.abs(M[pivot][col]) < 1e-14) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
    }
  }
  const x = new Array(n);
  for (let row = n - 1; row >= 0; row--) {
    let s = M[row][n];
    for (let k = row + 1; k < n; k++) s -= M[row][k] * x[k];
    x[row] = s / M[row][row];
  }
  return x;
}
