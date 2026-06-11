import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * In-browser URDF loading from a folder the user dropped or selected.
 * Mesh references (package://pkg/path, relative paths) are resolved against
 * the dropped files by longest matching path suffix, so the folder layout
 * doesn't have to match the package structure exactly.
 */

/** Collect {path, file} entries from a drag-and-drop DataTransfer (folders supported). */
export async function filesFromDataTransfer(dataTransfer) {
  const out = [];
  const entries = [...dataTransfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);

  async function walk(entry, prefix) {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      // readEntries returns batches; loop until empty
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      }
    }
  }

  for (const entry of entries) await walk(entry, '');
  if (!out.length && dataTransfer.files?.length) {
    for (const file of dataTransfer.files) out.push({ path: file.name, file });
  }
  return out;
}

/** Collect {path, file} entries from an <input webkitdirectory> change event. */
export function filesFromInput(input) {
  return [...input.files].map((file) => ({
    path: file.webkitRelativePath || file.name,
    file,
  }));
}

function findBySuffix(fileEntries, requested) {
  const wanted = requested
    .replace(/^package:\/\/[^/]+\//, '')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean);

  let best = null;
  let bestScore = 0;
  for (const entry of fileEntries) {
    const parts = entry.path.split('/');
    let score = 0;
    while (
      score < wanted.length &&
      score < parts.length &&
      parts[parts.length - 1 - score].toLowerCase() ===
        wanted[wanted.length - 1 - score].toLowerCase()
    ) {
      score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}

const stlLoader = new STLLoader();
const daeLoader = new ColladaLoader();
const objLoader = new OBJLoader();
const gltfLoader = new GLTFLoader();

const defaultMaterial = () =>
  new THREE.MeshPhongMaterial({ color: 0xc7cad1, shininess: 30 });

async function parseMeshFile(entry, onComplete) {
  const ext = entry.path.split('.').pop().toLowerCase();
  try {
    if (ext === 'stl') {
      const geometry = stlLoader.parse(await entry.file.arrayBuffer());
      onComplete(new THREE.Mesh(geometry, defaultMaterial()));
    } else if (ext === 'dae') {
      const result = daeLoader.parse(await entry.file.text(), '');
      onComplete(result.scene);
    } else if (ext === 'obj') {
      const obj = objLoader.parse(await entry.file.text());
      obj.traverse((c) => {
        if (c.isMesh && !c.material) c.material = defaultMaterial();
      });
      onComplete(obj);
    } else if (ext === 'glb' || ext === 'gltf') {
      gltfLoader.parse(
        await entry.file.arrayBuffer(),
        '',
        (gltf) => onComplete(gltf.scene),
        (err) => onComplete(null, err),
      );
    } else {
      onComplete(null, new Error(`Unsupported mesh format: .${ext}`));
    }
  } catch (err) {
    onComplete(null, err);
  }
}

/**
 * Parse a URDF from user-provided files. If the folder also contains a
 * closures file (`*-closures.json` or `closures.json`, as exported from the
 * closure editor), it is parsed and returned so loops can be hooked up
 * without a manual import.
 * @param {{path: string, file: File}[]} fileEntries
 * @returns {Promise<{robot, urdfPath: string, missingMeshes: string[], closures: object[]|null}>}
 */
export async function loadURDFFromFiles(fileEntries) {
  const urdfEntry = fileEntries.find((e) => e.path.toLowerCase().endsWith('.urdf'));
  if (!urdfEntry) throw new Error('No .urdf file found in the dropped files');
  const text = await urdfEntry.file.text();

  let closures = null;
  const closuresEntry = fileEntries.find((e) => {
    const name = e.path.split('/').pop().toLowerCase();
    return name.endsWith('-closures.json') || name === 'closures.json';
  });
  if (closuresEntry) {
    try {
      const data = JSON.parse(await closuresEntry.file.text());
      closures = Array.isArray(data) ? data : data.closures || null;
    } catch (err) {
      console.warn(`Ignoring unparsable closures file ${closuresEntry.path}:`, err);
    }
  }
  const missingMeshes = [];

  let pending = 0;
  let parseDone = false;
  let resolveAll;
  const allMeshes = new Promise((res) => (resolveAll = res));
  const settle = () => {
    if (parseDone && pending === 0) resolveAll();
  };

  const loader = new URDFLoader();
  loader.parseCollision = false;
  loader.loadMeshCb = (path, manager, onComplete) => {
    const entry = findBySuffix(fileEntries, path);
    if (!entry) {
      missingMeshes.push(path);
      onComplete(null, new Error(`Mesh not found: ${path}`));
      return;
    }
    pending++;
    parseMeshFile(entry, (obj, err) => {
      onComplete(obj, err);
      pending--;
      settle();
    });
  };

  const robot = loader.parse(text);
  parseDone = true;
  settle();
  await Promise.race([allMeshes, new Promise((res) => setTimeout(res, 20000))]);
  return { robot, urdfPath: urdfEntry.path, missingMeshes, closures };
}

/** Parse a URDF from a string (no external meshes — primitives only). */
export function loadURDFFromString(text) {
  const loader = new URDFLoader();
  loader.parseCollision = false;
  return loader.parse(text);
}

/**
 * Load a URDF served over HTTP (e.g. a robot folder inside the vite root).
 * package://pkg/... mesh references resolve against `packagePath`.
 * @returns {Promise<{robot, missingMeshes: string[]}>}
 */
export async function loadURDFFromURL(urdfUrl, { packagePath = '' } = {}) {
  const res = await fetch(urdfUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${urdfUrl}: ${res.status}`);
  const text = await res.text();
  const missingMeshes = [];

  let pending = 0;
  let parseDone = false;
  let resolveAll;
  const allMeshes = new Promise((r) => (resolveAll = r));
  const settle = () => {
    if (parseDone && pending === 0) resolveAll();
  };

  const loader = new URDFLoader();
  loader.parseCollision = false;
  loader.loadMeshCb = (path, manager, onComplete) => {
    const url = path.replace(/^package:\/\/[^/]+/, packagePath);
    pending++;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        // Response exposes text()/arrayBuffer() just like File
        return new Promise((resolve, reject) =>
          parseMeshFile({ path: url, file: r }, (obj, err) =>
            obj ? resolve(obj) : reject(err ?? new Error('mesh parse failed')),
          ),
        );
      })
      .then(
        (obj) => onComplete(obj),
        (err) => {
          missingMeshes.push(path);
          onComplete(null, err);
        },
      )
      .finally(() => {
        pending--;
        settle();
      });
  };

  const robot = loader.parse(text);
  parseDone = true;
  settle();
  await Promise.race([allMeshes, new Promise((r) => setTimeout(r, 20000))]);
  return { robot, missingMeshes };
}
