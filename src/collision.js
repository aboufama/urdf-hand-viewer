import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

/**
 * Self-collision checker for a URDF robot.
 *
 * Links are grouped into "branches" (the subtrees hanging off the root
 * link — for the hand: each finger and the thumb). Only links from
 * different branches, or a branch link vs the root link, are tested:
 * links within one digit are articulated together and their contacts are
 * by design. Mesh-vs-mesh tests use BVHs (three-mesh-bvh) with a world
 * AABB prefilter, so a full check is sub-millisecond for a hand.
 *
 * Pairs that already touch in the load pose (press fits, mounting
 * contact) are captured as a baseline and ignored thereafter.
 */
export class CollisionChecker {
  constructor(robot) {
    this.robot = robot;
    this.baseline = new Set();

    // Root link = the URDFLink directly under the robot object
    const rootLink = Object.values(robot.links).find(
      (l) => l.parent === robot || !l.parent?.isURDFLink,
    );

    // Branch = highest ancestor link below the root link
    const branchOf = (link) => {
      let n = link;
      while (n.parent && n.parent !== rootLink && n.parent !== robot) n = n.parent;
      return n === link && link === rootLink ? null : n;
    };

    // Meshes whose nearest URDFLink ancestor is the given link
    const meshesOf = (link) => {
      const out = [];
      link.traverse((c) => {
        if (!c.isMesh) return;
        let p = c.parent;
        while (p && !p.isURDFLink) p = p.parent;
        if (p === link) out.push(c);
      });
      return out;
    };

    this.entries = [];
    for (const link of Object.values(robot.links)) {
      const meshes = meshesOf(link);
      if (!meshes.length) continue;
      for (const m of meshes) {
        if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
      }
      this.entries.push({
        link,
        meshes,
        branch: link === rootLink ? null : branchOf(link),
        box: new THREE.Box3(),
      });
    }

    this.pairs = [];
    for (let a = 0; a < this.entries.length; a++) {
      for (let b = a + 1; b < this.entries.length; b++) {
        const A = this.entries[a];
        const B = this.entries[b];
        if (A.branch === B.branch) continue; // same digit (or both root)
        this.pairs.push([A, B]);
      }
    }
  }

  /** Call once in a known-good pose; contacts present now are ignored later. */
  captureBaseline() {
    this.baseline = new Set(this._collide().map(([a, b]) => `${a}|${b}`));
  }

  /** Names of newly colliding link pairs (excludes baseline contacts). */
  check() {
    return this._collide().filter(([a, b]) => !this.baseline.has(`${a}|${b}`));
  }

  _collide() {
    this.robot.updateMatrixWorld(true);
    for (const e of this.entries) {
      e.box.makeEmpty();
      for (const m of e.meshes) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        e.box.union(_tmpBox.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld));
      }
    }
    const hits = [];
    for (const [A, B] of this.pairs) {
      if (!A.box.intersectsBox(B.box)) continue;
      if (this._meshesIntersect(A.meshes, B.meshes)) hits.push([A.link.name, B.link.name]);
    }
    return hits;
  }

  _meshesIntersect(meshesA, meshesB) {
    for (const a of meshesA) {
      _invA.copy(a.matrixWorld).invert();
      for (const b of meshesB) {
        _aToB.multiplyMatrices(_invA, b.matrixWorld);
        if (a.geometry.boundsTree.intersectsGeometry(b.geometry, _aToB)) return true;
      }
    }
    return false;
  }
}

const _tmpBox = new THREE.Box3();
const _invA = new THREE.Matrix4();
const _aToB = new THREE.Matrix4();
