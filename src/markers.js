import * as THREE from 'three';

const COLOR_A = 0xff4f6d; // anchor on link A
const COLOR_B = 0x37d3a0; // anchor on link B

/**
 * Visualizes closure anchors: a sphere per anchor plus a line between the
 * pair. When the loop is closed the spheres coincide; when it isn't, the
 * line shows the gap the solver is trying to eliminate.
 */
export class ClosureMarkers {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.renderOrder = 10;
    parent.add(this.group);
    this._items = [];
    this._radius = 0.0025;
  }

  setScale(robotSize) {
    this._radius = Math.max(robotSize / 120, 1e-5);
    this.rebuildGeometry();
  }

  rebuildGeometry() {
    for (const item of this._items) {
      item.a.geometry.dispose();
      item.b.geometry.dispose();
      const geo = new THREE.SphereGeometry(this._radius, 16, 12);
      item.a.geometry = geo;
      item.b.geometry = geo.clone();
    }
  }

  /** One marker pair per closure; call when the closure list changes. */
  sync(count) {
    while (this._items.length < count) {
      const geo = new THREE.SphereGeometry(this._radius, 16, 12);
      const a = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: COLOR_A, depthTest: false, transparent: true, opacity: 0.9 }),
      );
      const b = new THREE.Mesh(
        geo.clone(),
        new THREE.MeshBasicMaterial({ color: COLOR_B, depthTest: false, transparent: true, opacity: 0.9 }),
      );
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xffcf5c, depthTest: false, transparent: true }),
      );
      a.renderOrder = b.renderOrder = line.renderOrder = 11;
      this.group.add(a, b, line);
      this._items.push({ a, b, line });
    }
    while (this._items.length > count) {
      const item = this._items.pop();
      for (const obj of [item.a, item.b, item.line]) {
        this.group.remove(obj);
        obj.geometry.dispose();
        obj.material.dispose();
      }
    }
  }

  /**
   * @param {Array<{linkA, anchorA, linkB, anchorB, enabled}>} closures resolved
   *   against robot.links (objects, not names) — pass nulls to hide an entry.
   */
  update(closures, robot) {
    this.sync(closures.length);
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    closures.forEach((c, i) => {
      const item = this._items[i];
      const linkA = robot?.links?.[c.linkA];
      const linkB = robot?.links?.[c.linkB];
      const show = c.enabled !== false && linkA && linkB;
      item.a.visible = item.b.visible = item.line.visible = !!show;
      if (!show) return;
      pA.fromArray(c.anchorA);
      linkA.localToWorld(pA);
      pB.fromArray(c.anchorB);
      linkB.localToWorld(pB);
      item.a.position.copy(pA);
      item.b.position.copy(pB);
      const positions = item.line.geometry.attributes.position;
      positions.setXYZ(0, pA.x, pA.y, pA.z);
      positions.setXYZ(1, pB.x, pB.y, pB.z);
      positions.needsUpdate = true;
    });
  }

  setVisible(v) {
    this.group.visible = v;
  }
}
