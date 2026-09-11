// ── roomWalls.js ─────────────────────────────────────────────────────────────
// Painted back walls per room kind (concept-art style panels, 9/11): one
// textured plane per room just in front of the procedural back panel, sized
// to the bay. Screens and lamps in the panel glow via a low emissive from the
// same map, so bays read like the painting under the same lamp rig. Rooms
// without a panel keep the procedural wall.
//
//   const walls = createRoomWalls({ rooms });  rig.add(walls.group); walls.update(t); walls.dispose();

import * as THREE from 'three';
import { WALK_Z, ROOM_DEPTH, DECK_CLEAR } from './scene3dContract.js';

export const WALL_MANIFEST = {
  bridge:   '/walls/wall-bridge.jpg',
  consoles: '/walls/wall-consoles.jpg',
  grid:     '/walls/wall-consoles.jpg',
  lab:      '/walls/wall-lab.jpg',
  security: '/walls/wall-lab.jpg',
  core:     '/walls/wall-consoles.jpg',
  machines: '/walls/wall-machines.jpg',
  bunks:    '/walls/wall-quarters.jpg',
  vault:    '/walls/wall-vault.jpg',
};
const Z_WALL = WALK_Z - ROOM_DEPTH + 6;   // just in front of the procedural back panel
const loader = new THREE.TextureLoader();
const cache = new Map();
const tex = (url) => { if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; res(t); }, undefined, rej))); return cache.get(url); };

export function createRoomWalls({ rooms } = {}) {
  const group = new THREE.Group();
  group.name = 'roomWalls';
  const mats = [];
  let disposed = false;
  for (const r of rooms) {
    const url = WALL_MANIFEST[r.kind];
    if (!url) continue;
    tex(url).then((t) => {
      if (disposed) return;
      const h = (r.ceil - r.floor) - 6;
      const w = r.w - 8;
      // Cover-fit: keep the panel's aspect, crop the overflow so nothing stretches.
      const img = t.image; const ia = img && img.width ? img.width / img.height : 1;
      const pa = w / h;
      const m = new THREE.MeshLambertMaterial({ map: t, emissive: 0x9fd8ff, emissiveMap: t, emissiveIntensity: 0.2 });
      if (ia > pa) { m.map.repeat.set(pa / ia, 1); m.map.offset.set((1 - pa / ia) / 2, 0); }
      else { m.map.repeat.set(1, ia / pa); m.map.offset.set(0, (1 - ia / pa) / 2); }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      mesh.position.set(r.cx, r.floor + h / 2 + 3, Z_WALL);
      mesh.receiveShadow = true;
      group.add(mesh);
      mats.push(m);
    }).catch(() => {});
  }
  function update(t) {
    const k = 0.17 + 0.06 * (0.5 + 0.5 * Math.sin(t / 1700));
    for (const m of mats) m.emissiveIntensity = k;
  }
  function dispose() { disposed = true; group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); group.clear(); }
  return { group, update, dispose };
}
