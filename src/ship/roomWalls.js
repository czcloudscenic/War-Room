// ── roomWalls.js ─────────────────────────────────────────────────────────────
// Painted back walls per room kind (concept-art style panels, 9/11): one
// textured plane per room just in front of the procedural back panel, sized
// to the bay. Screens and lamps in the panel glow via a low emissive from the
// same map, so bays read like the painting under the same lamp rig. Rooms
// without a panel keep the procedural wall.
//
//   const walls = createRoomWalls({ rooms });  rig.add(walls.group); walls.update(t); walls.dispose();

import * as THREE from 'three';
import { WALK_Z, ROOM_DEPTH, DECK_CLEAR, HULL_3D } from './scene3dContract.js';
import { stationLightFor } from './stationPalette.js';
const CEILING_URL = '/textures/ship-ceiling.jpg';

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

// Soft box falloff: bright in the middle of the bay, fading at the edges, so
// the glow reads as a lit room rather than a coloured rectangle.
let _cellTex = null;
function cellTexture() {
  if (_cellTex) return _cellTex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); if (!g) return null;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 70);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  _cellTex = new THREE.CanvasTexture(c); _cellTex.needsUpdate = true;
  return _cellTex;
}

export function createRoomWalls({ rooms, onReady } = {}) {
  const cells = [];
  const group = new THREE.Group();
  group.name = 'roomWalls';
  const mats = [];
  let disposed = false;
  // Readiness: the ceilings plus every room that HAS a panel. ShipWorld3D
  // holds the whole rig invisible until this (and the other big async
  // pieces) resolve, so the scene stops popping in layers. Failures count
  // too — a missing texture must never wedge the boot gate.
  let pending = 1 + rooms.filter((r) => WALL_MANIFEST[r.kind]).length;
  const settle = () => { if (--pending === 0 && !disposed) { try { onReady?.(); } catch { /* ignore */ } } };
  // Ceilings: one tiled plane per deck facing down, spanning the hull, at
  // the underside of that deck's ceiling (top armor for deck 0, the deck-0
  // slab for deck 1). Ribs, pipes and cable looms come from the tile.
  const ceils = new Map();
  for (const r of rooms) if (!ceils.has(r.deck)) ceils.set(r.deck, r.ceil);
  tex(CEILING_URL).then((t) => {
    if (disposed) return;
    const t2 = t.clone(); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(7, 1); t2.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ map: t2, color: 0xb8c2cc, emissive: 0x6f8fb0, emissiveMap: t2, emissiveIntensity: 0.06, roughness: 0.85, metalness: 0.3 });
    const w = HULL_3D.x1 - HULL_3D.x0, cx = (HULL_3D.x0 + HULL_3D.x1) / 2;
    for (const [, ceilY] of ceils) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM_DEPTH + 30), m);
      mesh.rotation.x = Math.PI / 2;                       // face down
      mesh.position.set(cx, ceilY - 1.5, WALK_Z - ROOM_DEPTH / 2 + 10);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }).catch(() => {}).finally(settle);
  for (const r of rooms) {
    const url = WALL_MANIFEST[r.kind];
    if (!url) continue;
    tex(url).then((t) => {
      if (disposed) return;
      const h = (r.ceil - r.floor) - 6;
      const w = r.w - 8;   // 4 in from each bay edge: neighbours never overlap now that no partition sits between them
      // Cover-fit: keep the panel's aspect, crop the overflow so nothing stretches.
      const img = t.image; const ia = img && img.width ? img.width / img.height : 1;
      const pa = w / h;
      // Each panel is tinted toward its station's identity colour and lit by
      // the same colour from the two-light bay rig, so the back wall is part
      // of the lit cell rather than one more grey plane behind it.
      const pal = stationLightFor(r.id);
      const m = new THREE.MeshStandardMaterial({ map: t, emissive: new THREE.Color(pal.fill), emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.82, metalness: 0.2 });
      m.color.lerp(new THREE.Color(pal.fill), 0.35);
      if (ia > pa) { m.map.repeat.set(pa / ia, 1); m.map.offset.set((1 - pa / ia) / 2, 0); }
      else { m.map.repeat.set(1, ia / pa); m.map.offset.set(0, (1 - ia / pa) / 2); }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      mesh.position.set(r.cx, r.floor + h / 2 + 3, Z_WALL);
      mesh.receiveShadow = true;
      group.add(mesh);
      mats.push(m);
      // ── The cell glow: the Fallout Shelter read, painted not lit ──────────
      // A soft additive card filling the bay opening in the station's colour.
      // This is what makes twelve distinct lit boxes out of one grey wash,
      // and it costs a transparent quad instead of two point lights (twelve
      // bays of real lamps measured 1.2 fps).
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: cellTexture(), color: new THREE.Color(pal.fill),
          transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending,
          depthWrite: false, fog: false, side: THREE.DoubleSide,
        })
      );
      glow.position.set(r.cx, r.floor + h / 2 + 3, Z_WALL + 26);
      glow.renderOrder = 4;
      group.add(glow);
      cells.push({ m: glow.material, base: 0.72, phase: (r.cx % 100) / 100 });
    }).catch(() => {}).finally(settle);
  }
  function update(t) {
    for (const c of cells) c.m.opacity = c.base * (0.88 + 0.12 * Math.sin(t / 2600 + c.phase * 6.28));
    // 0.85 base: the bay reads as a LIT ROOM (Fallout Shelter) rather than a
    // dark alcove. Real lamps are capped here (a dozen point lights once
    // blanked the frame), so the brightness is painted into the panel.
    const k = 0.85 + 0.09 * (0.5 + 0.5 * Math.sin(t / 1700));
    for (const m of mats) m.emissiveIntensity = k;
  }
  function dispose() { disposed = true; group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); group.clear(); }
  return { group, update, dispose };
}
