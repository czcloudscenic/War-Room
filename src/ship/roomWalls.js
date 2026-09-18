// ── roomWalls.js ─────────────────────────────────────────────────────────────
// Painted back walls per room kind (concept-art style panels, 9/11): one
// textured panel per room just in front of the procedural back panel, sized
// to the bay. Screens and lamps in the panel glow via a low emissive from the
// same map, so bays read like the painting under the same lamp rig. Rooms
// without a panel keep the procedural wall.
//
// 9/17 — SHAPED TO THE HULL. The panels and their cell glow used to be
// PlaneGeometry: axis-aligned rectangles inside a tapered hovercraft, which
// read as bright cards pasted on a curved vessel (and the additive blending
// made the mismatch louder, not quieter). Both meshes are now a profile-
// shaped BufferGeometry sampled across the bay's x range from
// `bayProfileAt` in hullGLB.js — the measured hull silhouette mapped into the
// deck's band. A bay under the sloping bow is short and slanted; a bay
// amidships is full height. The glow's falloff is baked into a per-vertex
// colour/alpha attribute that follows THAT shape instead of a radial canvas
// texture, so there is no rectangle left to see.
//
//   const walls = createRoomWalls({ rooms });  rig.add(walls.group); walls.update(t); walls.dispose();
//   walls.refresh();   // rebuild the shaped geometry (called automatically
//                      // once the hull GLB's real profile lands)

import * as THREE from 'three';
import { WALK_Z, ROOM_DEPTH, HULL_3D } from './scene3dContract.js';
import { stationLightFor } from './stationPalette.js';
import { bayProfileAt, hullProfileVersion } from './hullGLB.js';
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

// ── the shaped bay panel ─────────────────────────────────────────────────────
// COLS columns across the bay, ROWS rows up it. The rows exist for the glow:
// a two-row strip can only carry a falloff that is zero everywhere (both
// edges), so the gradient needs interior rows to live in.
const COLS = 12;
const ROWS = 8;
const EDGE_IN = 4;     // 4 in from each bay edge: neighbours never overlap

// Bright at the bay's middle, zero on the profile edge — the same falloff the
// radial canvas used to fake, except it now follows the SHAPE, so a slanted
// bow bay fades along its slant instead of inside an invisible rectangle.
const falloff = (u, v) => Math.pow(Math.sin(Math.PI * u), 0.6) * Math.pow(Math.sin(Math.PI * v), 0.6);

// One 3-tap pass over the sampled edges. The measured belly is greebled and
// an unsmoothed edge reads as noise rather than as a hull.
function smooth(a) {
  return a.map((v, i) => (a[Math.max(0, i - 1)] + v + a[Math.min(a.length - 1, i + 1)]) / 3);
}

// Bay geometry in LOCAL space: x about the bay centre, y about the profile's
// mid height (the mesh carries the offset). UVs run 0..1 on both axes so the
// existing cover-fit mapping is unchanged. userData carries the numbers the
// caller needs to place the mesh and fit the texture.
function bayGeometry(r) {
  const xa = r.x0 + EDGE_IN, xb = r.x1 - EDGE_IN;
  const xs = [], tops = [], bots = [];
  for (let i = 0; i <= COLS; i++) {
    const x = xa + (xb - xa) * (i / COLS);
    const e = bayProfileAt(x, r.floor, r.ceil);
    xs.push(x); tops.push(e.top); bots.push(e.bottom);
  }
  const top = smooth(tops), bot = smooth(bots);
  let sumMid = 0, sumH = 0;
  for (let i = 0; i <= COLS; i++) { sumMid += (top[i] + bot[i]) / 2; sumH += top[i] - bot[i]; }
  const yRef = sumMid / (COLS + 1);
  const avgH = sumH / (COLS + 1);

  const pos = [], nor = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= COLS; i++) {
    const u = i / COLS;
    for (let j = 0; j <= ROWS; j++) {
      const v = j / ROWS;
      pos.push(xs[i] - r.cx, bot[i] + (top[i] - bot[i]) * v - yRef, 0);
      nor.push(0, 0, 1);
      uv.push(u, v);
      const f = falloff(u, v);
      col.push(f, f, f, f);
    }
  }
  const at = (i, j) => i * (ROWS + 1) + j;
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1));
      idx.push(at(i, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.userData = { yRef, avgH, w: xb - xa };
  return g;
}

// Cover-fit: keep the panel's aspect, crop the overflow so nothing stretches.
// The aspect now comes from the bay's AVERAGE height (the shaped panel has no
// single height any more).
function coverFit(map, imgAspect, w, h) {
  const pa = w / h;
  if (imgAspect > pa) { map.repeat.set(pa / imgAspect, 1); map.offset.set((1 - pa / imgAspect) / 2, 0); }
  else { map.repeat.set(1, imgAspect / pa); map.offset.set(0, (1 - imgAspect / pa) / 2); }
}

export function createRoomWalls({ rooms, onReady, profileReady } = {}) {
  const cells = [];
  const bays = [];   // { r, geom, panel, glow, mat, ia }
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
      const geom = bayGeometry(r);
      const { yRef, avgH, w } = geom.userData;
      const img = t.image; const ia = img && img.width ? img.width / img.height : 1;
      // Each panel is tinted toward its station's identity colour and lit by
      // the same colour from the two-light bay rig, so the back wall is part
      // of the lit cell rather than one more grey plane behind it.
      const pal = stationLightFor(r.id);
      const m = new THREE.MeshStandardMaterial({ map: t, emissive: new THREE.Color(pal.fill), emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.82, metalness: 0.2 });
      m.color.lerp(new THREE.Color(pal.fill), 0.35);
      coverFit(m.map, ia, w, avgH);
      const panel = new THREE.Mesh(geom, m);
      panel.position.set(r.cx, yRef, Z_WALL);
      panel.receiveShadow = true;
      group.add(panel);
      mats.push(m);
      // ── The cell glow: the Fallout Shelter read, painted not lit ──────────
      // The same geometry, so the glow fills the panel EXACTLY. Additive, but
      // its falloff is a per-vertex colour/alpha attribute keyed to the bay's
      // own outline, so it dies on the profile edge instead of stopping at a
      // rectangle. This is what makes twelve distinct lit boxes out of one
      // grey wash, and it costs a transparent mesh instead of two point
      // lights (twelve bays of real lamps measured 1.2 fps).
      const glow = new THREE.Mesh(
        geom,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(pal.fill), vertexColors: true,
          transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending,
          depthWrite: false, fog: false, side: THREE.DoubleSide,
        })
      );
      glow.position.set(r.cx, yRef, Z_WALL + 26);
      glow.renderOrder = 4;
      group.add(glow);
      cells.push({ m: glow.material, base: 0.72, phase: (r.cx % 100) / 100 });
      bays.push({ r, geom, panel, glow, mat: m, ia });
    }).catch(() => {}).finally(settle);
  }

  // Rebuild every bay's shaped geometry. Cheap (12 bays × 234 triangles) and
  // idempotent: called once the hull GLB's measured profile replaces the
  // pre-load defaults, and safe to call by hand.
  function refresh() {
    if (disposed) return;
    for (const b of bays) {
      const geom = bayGeometry(b.r);
      const { yRef, avgH, w } = geom.userData;
      b.panel.geometry = geom;
      b.glow.geometry = geom;
      b.panel.position.y = yRef;
      b.glow.position.y = yRef;
      if (b.mat.map) { coverFit(b.mat.map, b.ia, w, avgH); b.mat.map.needsUpdate = true; }
      b.geom.dispose();
      b.geom = geom;
    }
  }

  // The hull GLB lands after us, so the first build uses the measured
  // defaults baked into hullGLB.js and this picks up the live numbers when
  // they arrive. Poll once a second for ten seconds, or take a promise.
  let poll = null;
  if (profileReady && typeof profileReady.then === 'function') {
    profileReady.then(() => { if (!disposed) refresh(); }).catch(() => {});
  }
  if (typeof setInterval === 'function') {
    const v0 = hullProfileVersion();
    let tries = 0;
    poll = setInterval(() => {
      if (disposed || ++tries > 10) { clearInterval(poll); poll = null; return; }
      if (hullProfileVersion() !== v0) { clearInterval(poll); poll = null; refresh(); }
    }, 1000);
  }

  function update(t) {
    for (const c of cells) c.m.opacity = c.base * (0.88 + 0.12 * Math.sin(t / 2600 + c.phase * 6.28));
    // 0.85 base: the bay reads as a LIT ROOM (Fallout Shelter) rather than a
    // dark alcove. Real lamps are capped here (a dozen point lights once
    // blanked the frame), so the brightness is painted into the panel.
    const k = 0.85 + 0.09 * (0.5 + 0.5 * Math.sin(t / 1700));
    for (const m of mats) m.emissiveIntensity = k;
  }
  function dispose() {
    disposed = true;
    if (poll) { clearInterval(poll); poll = null; }
    const seen = new Set();
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (!seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      o.material.dispose();
    });
    group.clear();
  }
  return { group, update, refresh, dispose };
}
