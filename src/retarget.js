import * as THREE from 'three';

/**
 * Fingertip retargeting: maps human fingertip positions (MediaPipe world
 * landmarks, meters) to robot fingertip targets, then solves the actuated
 * joints per digit with damped least squares so the simulated tips follow
 * the human tips. Closures are solved inside every FK evaluation, so the
 * four-bar linkage geometry stays exact throughout.
 *
 * Mapping (per digit, in polar form):
 * - extension ρ = |tip − knuckle| / digit length — measured on both sides
 *   with each side's own length (human: pose-invariant sum of segment
 *   lengths; robot: rest tip-to-knuckle distance), so the difference in
 *   digit proportions is compensated exactly.
 * - curl angle θ — the tip's angle around the knuckle toward the palm.
 * - lateral angle φ (thumb only) — the tip's angle toward/away from the
 *   other fingers, which drives the thumb's lateral joint through the IK
 *   with the geometrically correct sign.
 * Angles are offsets from a short open-hand reference captured when
 * tracking starts, and applied around the robot digit's own rest direction
 * — so an open hand maps exactly to the rest pose, and a full human curl
 * maps to a full robot curl, regardless of proportions or handedness.
 * The human palm frame is rebuilt every frame, so waving or rotating the
 * whole hand does not curl the fingers.
 */

// MediaPipe landmark indices
const LM = {
  wrist: 0,
  thumb: { cmc: 1, mcp: 2, ip: 3, tip: 4 },
  index: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  middle: { mcp: 9, pip: 10, dip: 11, tip: 12 },
};

const DIGITS = [
  // index ↔ finger chain A, middle ↔ finger chain B (matches mirrored preview)
  { key: 'index', tipLink: 'Hand_FINGERTIP_1', joints: ['Revolute_15', 'Revolute_18'], lm: LM.index },
  { key: 'middle', tipLink: 'FINGERTIP_2', joints: ['Revolute_17', 'Revolute_26'], lm: LM.middle },
  { key: 'thumb', tipLink: 'Hand_FINGERTIP_1_2', joints: ['Revolute_6', 'Revolute_14', 'Revolute_22'], lm: LM.thumb },
];

const CALIBRATION_FRAMES = 12;
const v3 = (...a) => new THREE.Vector3(...a);

export class TipRetargeter {
  constructor(robot, solver) {
    this.robot = robot;
    this.solver = solver;
    this.digits = [];
    for (const d of DIGITS) {
      const tipLink = robot.links?.[d.tipLink];
      const jointObjs = d.joints.map((n) => robot.joints?.[n]);
      if (!tipLink || jointObjs.some((j) => !j)) continue;
      this.digits.push({ ...d, tipLink, jointObjs, tipLocal: tipPointOf(tipLink) });
    }
    this.ready = this.digits.length === DIGITS.length;
    this.resetCalibration();
    if (this.ready) this._captureRest();
  }

  // -- FK helpers ----------------------------------------------------------

  _value(j) {
    return Array.isArray(j.jointValue) ? j.jointValue[0] : j.angle ?? 0;
  }

  _fk() {
    if (this.solver) this.solver.solve(); // self-heals on non-convergence
    else this.robot.updateMatrixWorld(true);
  }

  /** Tip position of a digit in robot-local coordinates (after FK). */
  _tip(d, out = v3()) {
    out.copy(d.tipLocal);
    d.tipLink.localToWorld(out);
    return this.robot.worldToLocal(out);
  }

  _jointPos(j, out = v3()) {
    j.getWorldPosition(out);
    return this.robot.worldToLocal(out);
  }

  // -- Rest-pose geometry ---------------------------------------------------

  /**
   * For each digit: knuckle position, rest tip, digit length, and an
   * orthonormal digit frame {e: rest tip direction, f: closing/palmar,
   * l: lateral toward the thumb side} probed numerically from the joints.
   */
  _captureRest() {
    const saved = [];
    for (const d of this.digits) {
      for (const j of d.jointObjs) {
        saved.push([j, this._value(j)]);
        j.setJointValue(0);
      }
    }
    this._fk();

    // The closure solver can leave continuous passive joints a full turn
    // off (same physical pose, wrapped value) after passing near a linkage
    // lockup. Renormalize so captured ranges and limits are meaningful.
    const passiveJoints = this.solver
      ? [...this.solver.passiveJointNames].map((n) => this.robot.joints[n]).filter(Boolean)
      : [];
    this._passive = passiveJoints;
    const wrapPassive = () => {
      for (const j of passiveJoints) {
        const v = this._value(j);
        if (Math.abs(v) > Math.PI) {
          j.setJointValue(v - 2 * Math.PI * Math.round(v / (2 * Math.PI)));
        }
      }
    };
    wrapPassive();
    this._fk();

    for (const d of this.digits) {
      d.knuckleJoint = d.jointObjs[d.key === 'thumb' ? 1 : 0];
      d.restTip = this._tip(d);
      d.knuckle = this._jointPos(d.knuckleJoint);
      d.length = d.restTip.distanceTo(d.knuckle);
      d.e = d.restTip.clone().sub(d.knuckle).normalize();
    }

    const [di, dm, dt] = ['index', 'middle', 'thumb'].map((k) =>
      this.digits.find((d) => d.key === k),
    );

    // closing = the larger-limit side of a joint's range
    const closingDelta = (j) =>
      Math.abs(j.limit.lower) > Math.abs(j.limit.upper) ? -0.3 : 0.3;

    // Each digit's bend+pusher mechanism is planar, but the knuckle joint
    // origin sits laterally offset from the fingertip's motion plane —
    // building polar targets around the raw origin would give every target
    // an unreachable out-of-plane component (for the thumb the IK would
    // absorb it by yawing the lateral joint). Find the plane normal from
    // two raw tangent probes and project the polar center into the plane
    // through the tip. The thumb is probed with its lateral joint at 0.
    const rawDir = (d, joint, delta) => {
      joint.setJointValue(delta);
      this._fk();
      const v = this._tip(d).sub(d.restTip).normalize();
      joint.setJointValue(0);
      this._fk();
      return v;
    };
    for (const d of this.digits) {
      const bend = d.knuckleJoint;
      const distal = d.jointObjs[d.jointObjs.length - 1];
      const bendDelta = d.key === 'thumb' ? 0.3 : closingDelta(bend);
      const fRaw = rawDir(d, bend, bendDelta);
      const gRaw = rawDir(d, distal, closingDelta(distal));
      const n = v3().crossVectors(fRaw, gRaw).normalize();
      d.knuckle.addScaledVector(n, -d.knuckle.clone().sub(d.restTip).dot(n));
      d.length = d.restTip.distanceTo(d.knuckle);
      d.e = d.restTip.clone().sub(d.knuckle).normalize();
      d.f = fRaw.clone().addScaledVector(d.e, -fRaw.dot(d.e)).normalize();
      d.baseSign = Math.sign(bendDelta);
    }
    const palmar = di.f.clone().add(dm.f).normalize();

    // Thumb closing direction: flip so its f points palm-ward like the fingers'
    if (dt.f.dot(palmar) < 0) {
      dt.f.negate();
      dt.baseSign = -dt.baseSign;
    }

    // Thumb lateral axis from its lateral joint, signed away from the fingers
    // (matching the human convention: thumb-side positive).
    const fingersMid = di.knuckle.clone().add(dm.knuckle).multiplyScalar(0.5);
    dt.jointObjs[0].setJointValue(0.3);
    this._fk();
    const latTipRel = this._tip(dt).sub(dt.knuckle);
    dt.jointObjs[0].setJointValue(0);
    this._fk();
    const latDisp = latTipRel.clone().sub(dt.restTip.clone().sub(dt.knuckle));
    dt.l = latDisp
      .addScaledVector(dt.e, -latDisp.dot(dt.e))
      .addScaledVector(dt.f, -latDisp.dot(dt.f))
      .normalize();
    if (dt.l.dot(fingersMid.clone().sub(dt.knuckle)) > 0) dt.l.negate();
    // lateral gain: tip lateral angle per radian of the lateral joint
    dt.kLat =
      Math.asin(
        Math.min(1, Math.max(-1, latTipRel.dot(dt.l) / (latTipRel.length() || 1))),
      ) / 0.3;

    // Radius envelope: how close each tip can pull toward its knuckle —
    // sweep the distal (pusher) joint across its limits. Human extension is
    // remapped onto [rMin, rest length], which absorbs the difference
    // between human and robot tip travel. The same sweep records the range
    // each passive linkage joint actually uses.
    const ranges = new Map(
      passiveJoints.map((j) => [j, { lo: this._value(j), hi: this._value(j) }]),
    );
    for (const d of this.digits) {
      const distal = d.jointObjs[d.jointObjs.length - 1];
      const { lower, upper } = distal.limit;
      const polarOf = () => {
        const rel = this._tip(d).sub(d.knuckle);
        return { q: this._value(distal), r: rel.length(), theta: Math.atan2(rel.dot(d.f), rel.dot(d.e)) };
      };
      d.lut = [polarOf()]; // distal angle -> tip (radius, angle), rest first
      // Walk out from rest in small steps, one direction at a time, so the
      // warm-started closure solver tracks the physical assembly branch —
      // jumping straight to a far limit can flip the four-bar inside out or
      // wrap a passive joint a full turn, poisoning the captured ranges.
      for (const end of [lower, upper]) {
        const steps = Math.max(2, Math.ceil(Math.abs(end) / 0.05));
        for (let i = 1; i <= steps; i++) {
          distal.setJointValue((end * i) / steps);
          this._fk();
          d.lut.push(polarOf());
          for (const [j, rng] of ranges) {
            const v = this._value(j);
            rng.lo = Math.min(rng.lo, v);
            rng.hi = Math.max(rng.hi, v);
          }
        }
        // Walk back home in steps too — snapping straight to 0 lets the
        // loop settle into the flipped branch and poisons the next pass.
        for (let i = steps - 1; i >= 0; i--) {
          distal.setJointValue((end * i) / steps);
          this._fk();
        }
      }
      d.rMin = Math.min(...d.lut.map((s) => s.r));
    }

    // Lock each passive joint to its observed range (plus margin). The
    // URDF declares them `continuous`, which lets the closure solver settle
    // into the mirrored four-bar assembly branch when the loop is stressed;
    // with real limits that branch is unreachable. Bands are re-anchored by
    // whole turns around the rest value before locking, just in case.
    const MARGIN = 0.2;
    for (const [j, rng] of ranges) {
      const shift = 2 * Math.PI * Math.round((rng.lo + rng.hi) / 2 / (2 * Math.PI));
      j.jointType = 'revolute';
      j.limit = { ...j.limit, lower: rng.lo - shift - MARGIN, upper: rng.hi - shift + MARGIN };
    }

    for (const [j, v] of saved) j.setJointValue(v);
    this._fk();
  }

  /** Rest tip positions (robot-local), for easing home when the hand is lost. */
  restTargets() {
    const out = {};
    for (const d of this.digits) out[d.key] = d.restTip.clone();
    return out;
  }

  // -- Human side ------------------------------------------------------------

  /** Per-digit polar coordinates of the human tips in the palm frame. */
  _humanPolar(lm) {
    const p = (i) => v3(lm[i].x, lm[i].y, lm[i].z);
    const oH = p(LM.index.mcp).add(p(LM.middle.mcp)).multiplyScalar(0.5);
    // Palm-forward from stable landmarks (wrist -> knuckles); never from the
    // tips, which would rotate the frame along with the very curl we measure.
    const exH = oH.clone().sub(p(LM.wrist)).normalize();

    // Thumb side
    let eyH = p(LM.index.mcp).sub(p(LM.middle.mcp));
    eyH.addScaledVector(exH, -eyH.dot(exH)).normalize();
    const thumbBase = p(LM.thumb.cmc).add(p(LM.thumb.mcp)).multiplyScalar(0.5);
    if (thumbBase.clone().sub(oH).dot(eyH) < 0) eyH.negate();

    // Palmar side: the thumb column sits palmar of the knuckle plane
    let ezH = v3().crossVectors(exH, eyH).normalize();
    if (thumbBase.sub(oH).dot(ezH) < 0) ezH.negate();

    const seg = (a, b) => p(a).distanceTo(p(b));
    const out = {};
    for (const d of this.digits) {
      const l = d.lm;
      const lenH =
        d.key === 'thumb'
          ? seg(l.mcp, l.ip) + seg(l.ip, l.tip)
          : seg(l.mcp, l.pip) + seg(l.pip, l.dip) + seg(l.dip, l.tip);
      const rel = p(l.tip).sub(p(l.mcp));
      const a = rel.dot(exH); // forward
      const b = rel.dot(eyH); // thumb side
      const c = rel.dot(ezH); // palmar
      out[d.key] = {
        rho: rel.length() / (lenH || 1),
        theta: Math.atan2(c, a), // curl toward the palm
        phi: Math.asin(Math.min(1, Math.max(-1, b / (rel.length() || 1)))), // lateral
      };
    }
    return out;
  }

  // -- Calibration -----------------------------------------------------------

  resetCalibration() {
    this.ref = null;
    this._calSamples = [];
  }

  get calibrated() {
    return !!this.ref;
  }

  /**
   * Feed open-hand frames until the reference is built. Returns true once
   * calibrated. The reference makes "your relaxed open hand" = "robot rest".
   */
  addCalibration(lm) {
    this._calSamples.push(this._humanPolar(lm));
    if (this._calSamples.length < CALIBRATION_FRAMES) return false;
    const ref = {};
    for (const d of this.digits) {
      const s = this._calSamples.map((x) => x[d.key]);
      const avg = (f) => s.reduce((acc, v) => acc + f(v), 0) / s.length;
      ref[d.key] = { rho: avg((v) => v.rho), theta: avg((v) => v.theta), phi: avg((v) => v.phi) };
    }
    this.ref = ref;
    this._calSamples = [];
    return true;
  }

  /**
   * Human world landmarks → robot-local tip targets: angle offsets from the
   * open-hand reference, applied around each robot digit's rest direction,
   * radius scaled by the robot digit length.
   */
  humanToTargets(lm) {
    const polar = this._humanPolar(lm);
    const HUMAN_RHO_MIN = 0.35; // a fully curled human tip pulls in to ~35%
    const out = {};
    for (const d of this.digits) {
      const h = polar[d.key];
      const ref = this.ref?.[d.key] ?? { rho: 1, theta: h.theta, phi: 0 };
      const dTheta = h.theta - ref.theta;

      // Human extension (1 = open) remapped onto the robot's reachable
      // radius range [rMin, rest length] for this digit.
      const rhoN = Math.min(1, Math.max(0, h.rho / (ref.rho || 1)));
      const t = Math.min(1, Math.max(0, (1 - rhoN) / (1 - HUMAN_RHO_MIN)));
      const radius = d.length - t * (d.length - d.rMin);

      const dir = d.e
        .clone()
        .multiplyScalar(Math.cos(dTheta))
        .addScaledVector(d.f, Math.sin(dTheta));
      if (d.l) {
        const dPhi = h.phi - (this.ref?.[d.key]?.phi ?? 0);
        dir.multiplyScalar(Math.cos(dPhi)).addScaledVector(d.l, Math.sin(dPhi));
      }
      out[d.key] = d.knuckle.clone().addScaledVector(dir, radius);
    }
    return out;
  }

  // -- IK ---------------------------------------------------------------------

  /**
   * Damped-least-squares IK per digit: drive the actuated joints so each
   * tip reaches its robot-local target. Joint limits are respected
   * (setJointValue clamps) and closures stay solved throughout.
   */
  solve(targets, { iterations = 4, tolerance = 5e-4 } = {}) {
    for (const d of this.digits) {
      const target = targets[d.key];
      if (target) this._solveDigit(d, target, iterations, tolerance);
    }
    this._fk();
  }

  _solveDigit(d, target, iterations, tolerance) {
    const err = this._iterate(d, target, iterations, tolerance);
    // Local-minimum escape: the mechanism decouples (base bend = tip angle,
    // pusher = tip radius), so a near-exact start can be read off the sweep
    // lookup. Retry from it and keep the better solution.
    if (err > 0.01) {
      const qSave = d.jointObjs.map((j) => this._value(j));
      this._initialGuess(d, target);
      const retryErr = this._iterate(d, target, iterations, tolerance);
      if (retryErr > err) {
        d.jointObjs.forEach((j, i) => j.setJointValue(qSave[i]));
        this._fk();
      }
    }
  }

  /** Analytic seed: pusher from the radius lookup, base from the angle. */
  _initialGuess(d, target) {
    const rel = target.clone().sub(d.knuckle);
    const rT = rel.length();
    const thetaT = Math.atan2(rel.dot(d.f), rel.dot(d.e));
    let best = d.lut[0];
    for (const s of d.lut) if (Math.abs(s.r - rT) < Math.abs(best.r - rT)) best = s;

    const joints = d.jointObjs;
    if (d.key === 'thumb') {
      const phiT = Math.asin(Math.min(1, Math.max(-1, rel.dot(d.l) / (rT || 1))));
      joints[0].setJointValue(d.kLat ? phiT / d.kLat : 0);
      joints[1].setJointValue(d.baseSign * (thetaT - best.theta));
    } else {
      joints[0].setJointValue(d.baseSign * (thetaT - best.theta));
    }
    // The pusher moves the four-bar — ramp it so the closure tracks
    const distal = joints[joints.length - 1];
    const from = this._value(distal);
    const steps = Math.max(1, Math.ceil(Math.abs(best.q - from) / 0.1));
    for (let i = 1; i <= steps; i++) {
      distal.setJointValue(from + ((best.q - from) * i) / steps);
      this._fk();
    }
  }

  _iterate(d, target, iterations, tolerance) {
    const joints = d.jointObjs;
    const n = joints.length;
    const h = 1e-3;
    let lambda = 1e-4;

    for (let iter = 0; iter < iterations; iter++) {
      const q0 = joints.map((j) => this._value(j));
      this._fk();
      const base = this._tip(d);
      const r = base.clone().sub(target);
      if (r.length() < tolerance) break;

      // Numeric Jacobian, 3 x n (closures re-solved per column). Probe away
      // from a clamping limit — a +h probe at the upper limit is a no-op and
      // would zero the column, freezing that joint at the limit.
      const J = [];
      for (let k = 0; k < n; k++) {
        const upper = joints[k].limit?.upper;
        const hk = typeof upper === 'number' && q0[k] + h > upper ? -h : h;
        joints[k].setJointValue(q0[k] + hk);
        this._fk();
        const tk = this._tip(d);
        joints[k].setJointValue(q0[k]);
        J.push(tk.sub(base).divideScalar(hk));
      }

      // (JtJ + lambda I) dq = -Jt r
      const A = [];
      const b = new Array(n);
      for (let a = 0; a < n; a++) {
        A.push(new Array(n));
        for (let c = 0; c < n; c++) A[a][c] = J[a].dot(J[c]) + (a === c ? lambda : 0);
        b[a] = -J[a].dot(r);
      }
      const dq = solveLinear(A, b);
      if (!dq) {
        lambda *= 10;
        continue;
      }
      for (let k = 0; k < n; k++) {
        const step = Math.max(-0.2, Math.min(0.2, dq[k]));
        joints[k].setJointValue(q0[k] + step);
      }
    }
    this._fk();
    return this._tip(d).distanceTo(target);
  }
}

/** Farthest mesh vertex from the link origin = the fingertip point. */
function tipPointOf(link) {
  link.updateWorldMatrix(true, true);
  const invLink = link.matrixWorld.clone().invert();
  const rel = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const best = new THREE.Vector3();
  let bestD = -1;
  link.traverse((c) => {
    if (!c.isMesh) return;
    let p = c.parent;
    while (p && !p.isURDFLink) p = p.parent;
    if (p !== link) return; // belongs to a nested child link
    rel.multiplyMatrices(invLink, c.matrixWorld);
    const pos = c.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(rel);
      const dist = v.lengthSq();
      if (dist > bestD) {
        bestD = dist;
        best.copy(v);
      }
    }
  });
  return best;
}

/** Gaussian elimination with partial pivoting (tiny systems). */
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
