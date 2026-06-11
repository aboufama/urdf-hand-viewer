import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Z-up Three.js scene with orbit controls, lights and a ground grid. */
export class Viewer {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.001, 100);
    this.camera.up.set(0, 0, 1); // URDF convention: Z up
    this.camera.position.set(0.25, -0.25, 0.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.1);
    hemi.position.set(0, 0, 1);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(0.5, -0.8, 1.2);
    this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dir2.position.set(-0.6, 0.7, 0.4);
    this.scene.add(dir2);

    this.grid = new THREE.GridHelper(1, 20, 0xb9bec8, 0xe2e5ea);
    this.grid.rotation.x = Math.PI / 2; // into the XY plane (Z up)
    this.scene.add(this.grid);

    this.overlay = new THREE.Group(); // markers etc., excluded from picking
    this.scene.add(this.overlay);

    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();

    this._tickers = [];
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      for (const fn of this._tickers) fn();
      this.renderer.render(this.scene, this.camera);
    });
  }

  onTick(fn) {
    this._tickers.push(fn);
  }

  _resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Frame the camera around an object and scale the grid to suit. */
  fit(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 0.1;

    this.controls.target.copy(center);
    const dir = new THREE.Vector3(1, -1, 0.7).normalize();
    this.camera.position.copy(center).addScaledVector(dir, size * 1.6);
    this.camera.near = size / 1000;
    this.camera.far = size * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();

    const gridSize = Math.pow(10, Math.ceil(Math.log10(size * 2)));
    this.grid.scale.setScalar(gridSize);
  }

  /** Raycast a pointer event against an object; returns {point, object} or null. */
  pick(event, root) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObject(root, true);
    return hits.length ? hits[0] : null;
  }
}
