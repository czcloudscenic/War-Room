// ── roomProps.js ─────────────────────────────────────────────────────────────
// Real 3D props for the modeled interior: one generated GLB per room kind
// (Tripo text-to-3D, 9/11), placed at each room's center on its floor, scaled
// to a target height in scene units (a person is ~70). Rooms whose prop has
// not loaded keep the procedural primitives, so the deck is never empty.
//
//   const props = createRoomProps({ rooms, onFirstReady });
//   rig.add(props.group); props.update(t); props.dispose();

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WALK_Z } from './scene3dContract.js';
import { stationLightFor } from './stationPalette.js';

// kind -> asset. height = target height in scene units; back = how far behind
// the walk lane the prop sits (so crew walk in front of it); yaw = facing.
export const PROP_MANIFEST = {
  bridge:   { url: '/props/bridge.glb',   height: 62, back: 70, yaw: 0.35 },
  consoles: { url: '/props/consoles.glb', height: 58, back: 80, yaw: 0.2 },
  grid:     { url: '/props/grid.glb',     height: 110, back: 118, yaw: 0, lift: 30 },
  lab:      { url: '/props/lab.glb',      height: 118, back: 60, yaw: 0 },
  security: { url: '/props/security.glb', height: 130, back: 50, yaw: 0 },
  core:     { url: '/props/core.glb',     height: 138, back: 40, yaw: 0 },
  machines: { url: '/props/machines.glb', height: 112, back: 100, yaw: 0 },
  bunks:    { url: '/props/bunks.glb',    height: 54, back: 70, yaw: -0.3 },
  vault:    { url: '/props/vault.glb',    height: 120, back: 95, yaw: 0.15 },
};

// Companion object per kind (9/11), placed off-center so a bay is never one
// object: dx = fraction of the room width from center, height in scene units.
export const PROP_SECONDARY = {
  bridge:   { url: '/props/bridge-2.glb',   height: 52, back: 30, dx: 0.30, yaw: -0.5 },
  consoles: { url: '/props/consoles-2.glb', height: 78, back: 100, dx: -0.32, yaw: 0.2 },
  grid:     { url: '/props/grid-2.glb',     height: 46, back: 40, dx: 0.30, yaw: 0.4 },
  lab:      { url: '/props/lab-2.glb',      height: 50, back: 95, dx: -0.30, yaw: 0 },
  security: { url: '/props/security-2.glb', height: 96, back: 110, dx: 0.32, yaw: 0 },
  core:     { url: '/props/core-2.glb',     height: 44, back: 20, dx: 0.34, yaw: -0.6 },
  machines: { url: '/props/machines-2.glb', height: 48, back: 40, dx: -0.30, yaw: 0.3 },
  bunks:    { url: '/props/bunks-2.glb',    height: 30, back: 40, dx: 0.30, yaw: 0.2 },
  vault:    { url: '/props/vault-2.glb',    height: 60, back: 60, dx: -0.30, yaw: 0.5 },
};

const loader = new GLTFLoader();
const cache = new Map(); // url -> Promise<gltf>
const load = (url) => { if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, res, undefined, rej))); return cache.get(url); };

export function createRoomProps({ rooms, onFirstReady } = {}) {
  const group = new THREE.Group();
  group.name = 'roomProps';
  const mats = [];
  let disposed = false, readyCount = 0;

  const place = (r, spec, dx) => load(spec.url).then((gltf) => {
    const pal = stationLightFor(r.id);
      if (disposed) return;
      const model = gltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const c = box.getCenter(new THREE.Vector3());
      const s = spec.height / (size.y || 1);
      const wrap = new THREE.Group();
      wrap.scale.setScalar(s);
      model.position.set(-c.x, -box.min.y, -c.z);       // feet on the floor, centered
      wrap.add(model);
      wrap.rotation.y = spec.yaw || 0;
      wrap.position.set(r.cx + (dx || 0) * r.w, r.floor + (spec.lift || 0), WALK_Z - spec.back);
      model.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const m = o.material;
        m.side = THREE.FrontSide;
        if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 0.7, 0.72);
        if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0.3, 0.3);
        if ('envMapIntensity' in m) m.envMapIntensity = 0.3;   // the bakes go chalk-white under full reflections
        // Low: the bakes carry white highlights that bloom into blobs at 0.28.
        // Tinted by the bay's identity colour, so a prop belongs to its cell.
        if ('emissive' in m && m.map) { m.emissive = new THREE.Color(pal.fill); m.emissiveMap = m.map; m.emissiveIntensity = 0.42; }
        if (m.color) m.color.lerp(new THREE.Color(pal.fill), 0.22);
        o.castShadow = true; o.receiveShadow = true;
        mats.push(m);
      });
      group.add(wrap);
      if (readyCount++ === 0) onFirstReady?.();
    }).catch(() => { /* prop missing: procedural stays for this room */ });
  for (const r of rooms) {
    const spec = PROP_MANIFEST[r.kind];
    if (spec) place(r, spec, 0);
    const sec = PROP_SECONDARY[r.kind];
    if (sec) place(r, sec, sec.dx);
  }

  function update(t) {
    const k = 0.40 + 0.08 * (0.5 + 0.5 * Math.sin(t / 1100));
    for (const m of mats) if ('emissiveIntensity' in m && m.emissiveMap) m.emissiveIntensity = k;
  }
  function dispose() {
    disposed = true;
    group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
    group.clear();
  }
  return { group, update, dispose, get readyCount() { return readyCount; } };
}
