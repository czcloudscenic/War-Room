// ── Agent Ship — greebles: dense industrial detail layer ─────────────────────
// The reference interior is cable-choked and machinery-packed; the base model
// is clean. This module layers deterministic industrial clutter over BOTH
// decks and the hull: sagging cable runs, hanging wires, pipes with valves,
// junction boxes with blinking indicators, vents, floor clutter, ceiling
// trusses and faint haze cards. Darkness matters — emissives stay tiny.
//
// Pure ES module. Deterministic (no Math.random — index-seeded sin-hash).
// Everything is merged per-material or instanced: ≤45 draw calls total.
//
// API:
//   const greebles = createGreebles();
//   scene.add(greebles.group);
//   greebles.update(t);   // seconds (ms-domain callers auto-detected per frame)
//   greebles.dispose();
//
// update() is delta-based: it accepts either a seconds or milliseconds clock
// (ShipWorld3D passes elapsedTime * 1000) and advances an internal seconds
// clock, so sway/blink/haze stay slow either way. ≤1ms per frame: 14 matrix
// composes + a handful of instance-color writes + 2 material opacities.

import * as THREE from 'three';
import {
  DECK_Y, DECK_CLEAR, ROOM_DEPTH, WALK_Z, PALETTE, toSceneX,
} from './scene3dContract.js';
import { ROOMS, LADDERS } from './world.js';

// ── deterministic variation (same hash family as shipModel) ──────────────────
const hash01 = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

// ── build-time matrix helper ─────────────────────────────────────────────────
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
function mat4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _scl.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_pos, _quat, _scl);
}
const IDENT = new THREE.Matrix4();

// ── merge bag: many transformed geometries -> one BufferGeometry ─────────────
class MergeBag {
  constructor() { this.pos = []; this.norm = []; this.idx = []; this.vcount = 0; }

  add(geometry, matrix) {
    const p = geometry.attributes.position;
    const n = geometry.attributes.normal;
    const index = geometry.index;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyNormalMatrix(nm).normalize();
      this.norm.push(v.x, v.y, v.z);
    }
    if (index) {
      for (let i = 0; i < index.count; i++) this.idx.push(index.getX(i) + this.vcount);
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(i + this.vcount);
    }
    this.vcount += p.count;
    geometry.dispose();
  }

  box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.add(new THREE.BoxGeometry(w, h, d), mat4(x, y, z, rx, ry, rz));
  }

  plane(w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.add(new THREE.PlaneGeometry(w, h), mat4(x, y, z, rx, ry, rz));
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
export function createGreebles() {
  const group = new THREE.Group();
  group.name = 'greebles';

  const geoms = [];
  const mats = [];
  const instanced = [];

  // Derived layout (all from the contract — matches shipModel's constants)
  const Z_ROOM_BACK = WALK_Z - ROOM_DEPTH;        // -140
  const Z_PANEL_FACE = Z_ROOM_BACK + 6;           // -134 (front of room back panels)
  const SLAB_T = 14;
  const CEIL = { 0: DECK_Y[0] + DECK_CLEAR, 1: DECK_Y[0] - SLAB_T }; // 210 / 46
  const FLOOR = { 0: DECK_Y[0], 1: DECK_Y[1] };
  const shaftXs = LADDERS.map((l) => toSceneX(l.x));
  const nearShaft = (x) => shaftXs.some((sx) => Math.abs(sx - x) < 26);
  const R = {};
  for (const r of ROOMS) {
    R[r.id] = { deck: r.deck, x0: toSceneX(r.x0), x1: toSceneX(r.x1), cx: toSceneX((r.x0 + r.x1) / 2) };
  }

  // ── shared materials ───────────────────────────────────────────────────────
  const lambert = (c) => { const m = new THREE.MeshLambertMaterial({ color: c }); mats.push(m); return m; };
  const basic = (c, opts = {}) => { const m = new THREE.MeshBasicMaterial({ color: c, ...opts }); mats.push(m); return m; };

  const matCableA = lambert(0x08090c);            // near-black rubber
  const matCableB = lambert(0x0c0e13);            // dark rubber
  const matCableC = lambert(0x11141b);            // sheathed loom
  const matPipe = lambert(0x141821);              // dark industrial metal
  const matDark = lambert(0x05060a);              // grille slits, conduits (blackest)
  const matBox = lambert(PALETTE.hullDark);       // junction boxes, vents
  const matClutter = lambert(0x121620);           // crates
  const matBarrel = lambert(0x0e1118);            // barrels / chests
  const matStrut = lambert(0x151b26);             // ceiling trusses

  const matDot = basic(0xffffff);                 // indicator dots (instanceColor tinted)
  const matVentGlow = basic(PALETTE.cyan, {       // faint interior glow behind 2 grilles
    transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  matVentGlow.color.multiplyScalar(0.3);
  const matHazeA = basic(PALETTE.amberDeep, {     // engine-end steam cards
    transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const matHazeB = basic(PALETTE.cyanSoft, {      // haze under the core
    transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false,
  });

  // ── merge bags ─────────────────────────────────────────────────────────────
  const bagCableA = new MergeBag();
  const bagCableB = new MergeBag();
  const bagCableC = new MergeBag();
  const bagPipe = new MergeBag();   // pipes, elbows, stubs, valve stems, collars
  const bagDark = new MergeBag();   // conduit strips + vent grille slits
  const bagGlow = new MergeBag();   // vent interior glow quads
  const bagHazeA = new MergeBag();
  const bagHazeB = new MergeBag();

  // ── 1. CABLE RUNS (sagging catenary bundles along each deck ceiling) ──────
  const cableBags = [bagCableA, bagCableB, bagCableC];
  const cableCurve = (x0, x1, y, z, sag, seed) => {
    const len = x1 - x0;
    const spans = Math.max(2, Math.round(len / 150));
    const pts = [];
    for (let i = 0; i < spans; i++) {
      const xa = x0 + (len * i) / spans;
      const xb = x0 + (len * (i + 1)) / spans;
      if (i === 0) pts.push(new THREE.Vector3(xa, y, z));
      const droop = sag * (0.7 + 0.6 * hash01(seed * 17.3 + i));
      pts.push(new THREE.Vector3(
        (xa + xb) / 2,
        y - droop,
        z + 4 * (hash01(seed * 29.7 + i) - 0.5),
      ));
      pts.push(new THREE.Vector3(xb, y - 2 * hash01(seed * 7.1 + i), z));
    }
    return new THREE.CatmullRomCurve3(pts);
  };
  const addCable = (deck, x0, x1, z, seed, r) => {
    const y = CEIL[deck] - 4 - 5 * hash01(seed);
    const curve = cableCurve(x0, x1, y, z, 8 + 9 * hash01(seed + 3.7), seed);
    const segs = Math.min(48, Math.max(16, Math.round((x1 - x0) / 20)));
    const bag = cableBags[Math.floor(hash01(seed + 11.3) * 3) % 3];
    bag.add(new THREE.TubeGeometry(curve, segs, r, 5, false), IDENT);
  };
  // deck 0 (2 full-length runs cross every room, plus shorter multi-room runs)
  const D0 = [[-540, 565], [-535, 560], [-520, -180], [-340, -20], [-140, 180],
    [30, 360], [200, 560], [-480, -260], [90, 300], [330, 555]];
  // deck 1 (2 full-length runs, plus shorter)
  const D1 = [[-420, 575], [-415, 570], [-400, -120], [-220, 60], [-60, 270],
    [140, 450], [250, 570], [-350, -40], [60, 330], [390, 580]];
  // stagger the runs in depth across z -122..-44
  const cableZ = (i, off) => -122 + 78 * hash01(i * 19.3 + off);
  D0.forEach(([a, b], i) => addCable(0, a, b, cableZ(i, 0.7), i * 3 + 1, 1.5 + 1.1 * hash01(i * 5 + 2)));
  D1.forEach(([a, b], i) => addCable(1, a, b, cableZ(i, 9.1), i * 3 + 40, 1.5 + 1.1 * hash01(i * 5 + 61)));

  // ── cable → wall drops into junction boxes ────────────────────────────────
  const addDrop = (x, deck, boxY, seed) => {
    const yTop = CEIL[deck] - 5;
    const pts = [
      new THREE.Vector3(x, yTop, -96),
      new THREE.Vector3(x + 3 * (hash01(seed) - 0.5), yTop - 9, -118),
      new THREE.Vector3(x, (yTop + boxY) / 2, -129),
      new THREE.Vector3(x, boxY + 8, -131),
      new THREE.Vector3(x, boxY, -131),
    ];
    const bag = cableBags[Math.floor(hash01(seed + 5.9) * 3) % 3];
    bag.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 1.5, 5, false), IDENT);
  };

  // ── 2. HANGING WIRES (swaying in update) ──────────────────────────────────
  const wires = [];
  for (let i = 0; i < 14; i++) {
    const deck = i < 7 ? 0 : 1;
    const lo = deck === 0 ? -530 : -410;
    const hi = deck === 0 ? 560 : 575;
    wires.push({
      x: lo + (hi - lo) * ((i % 7) / 6) + 30 * (hash01(i * 13.7) - 0.5),
      y: CEIL[deck] - 2,
      z: -112 + 96 * hash01(i * 7.9),
      len: 16 + 20 * hash01(i * 3.3),
      amp: 0.05 + 0.05 * hash01(i * 9.1),
      speed: 0.5 + 0.6 * hash01(i * 4.7),
      phase: hash01(i * 6.1) * Math.PI * 2,
    });
  }
  const wireGeom = new THREE.CylinderGeometry(0.5, 0.5, 1, 5);
  wireGeom.translate(0, -0.5, 0); // pivot at the ceiling anchor
  geoms.push(wireGeom);
  const wireMesh = new THREE.InstancedMesh(wireGeom, matCableB, wires.length);
  wireMesh.name = 'hangingWires';
  wires.forEach((w, i) => wireMesh.setMatrixAt(i, mat4(w.x, w.y, w.z, 0, 0, 0, 1, w.len, 1)));
  wireMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wireMesh.instanceMatrix.needsUpdate = true;
  group.add(wireMesh);
  instanced.push(wireMesh);

  // ── 3. PIPES (2 fat runs low on each back wall + verticals between decks) ─
  const Z_PIPE = -127; // in front of room back panels, behind all furniture
  const valveMats = [];
  const fatPipe = (deck, x0, x1, dy, r, valveEvery, seed) => {
    const y = FLOOR[deck] + dy;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    bagPipe.add(new THREE.CylinderGeometry(r, r, len, 8), mat4(cx, y, Z_PIPE, 0, 0, Math.PI / 2));
    // elbows: sphere joint + vertical stub at both ends
    for (const [ex, dir] of [[x0, 1], [x1, 1]]) {
      bagPipe.add(new THREE.SphereGeometry(r + 1.1, 8, 6), mat4(ex, y, Z_PIPE));
      bagPipe.add(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 26, 8), mat4(ex, y + dir * 15, Z_PIPE));
    }
    if (valveEvery) {
      for (let x = x0 + valveEvery * 0.4; x < x1 - 30; x += valveEvery) {
        const vx = x + 26 * (hash01(seed + x) - 0.5);
        if (nearShaft(vx)) continue;
        bagPipe.add(new THREE.CylinderGeometry(1.1, 1.1, 7, 6), mat4(vx, y, Z_PIPE + r + 1.5, Math.PI / 2, 0, 0));
        valveMats.push(mat4(vx, y, Z_PIPE + r + 5.5));
      }
    }
  };
  fatPipe(0, -540, 540, 11, 6, 200, 1.7);   // deck 0, low fat pipe with valves
  fatPipe(0, -520, 560, 25, 4.5, 0, 2.9);   // deck 0, upper thin-fat pipe
  fatPipe(1, -420, 585, 11, 6, 200, 4.1);   // deck 1
  fatPipe(1, -400, 570, 25, 4.5, 0, 5.3);
  // vertical thin pipes between decks (through the deck-0 slab)
  const V_PIPES = [-505, -390, -280, -60, 240, 335, 500];
  for (const vx of V_PIPES) {
    bagPipe.add(new THREE.CylinderGeometry(2, 2, 360, 6), mat4(vx, 34, -130));
    bagPipe.add(new THREE.CylinderGeometry(3.2, 3.2, 6, 6), mat4(vx, DECK_Y[0] - SLAB_T / 2, -130)); // slab collar
    bagPipe.add(new THREE.CylinderGeometry(3.2, 3.2, 6, 6), mat4(vx, DECK_Y[1] - SLAB_T / 2, -130));
  }

  // ── 4. JUNCTION BOXES + CONDUIT + INDICATOR DOTS ──────────────────────────
  // [x, deck, dy above floor] — curated clear of every room centerpiece
  const JBOX = [
    [-520, 0, 90], [-370, 0, 60], [-180, 0, 120], [-120, 0, 90],
    [198, 0, 60], [340, 0, 60], [410, 0, 110], [520, 0, 115],
    [-410, 1, 110], [-260, 1, 80], [-215, 1, 140], [155, 1, 100],
    [270, 1, 130], [320, 1, 115], [445, 1, 120], [560, 1, 90],
  ];
  const jboxMats = [];
  const dotMats = []; const dotColors = [];
  const blinkers = [];
  const _c = new THREE.Color();
  JBOX.forEach(([x, deck, dy], i) => {
    const y = FLOOR[deck] + dy;
    jboxMats.push(mat4(x, y, Z_PANEL_FACE + 2.5));
    // conduit: thin strip up to the ceiling or down to the fat pipe
    if (hash01(i * 3.1 + 1) < 0.5) {
      const top = CEIL[deck] - 2;
      bagDark.box(2.2, top - (y + 4.5), 1.6, x, (top + y + 4.5) / 2, Z_PANEL_FACE + 0.8);
    } else {
      const bot = FLOOR[deck] + 11;
      bagDark.box(2.2, (y - 4.5) - bot, 1.6, x, (y - 4.5 + bot) / 2, Z_PANEL_FACE + 0.8);
    }
    // 1-2 tiny emissive indicator dots
    const nDots = hash01(i * 5.3 + 2) > 0.45 ? 2 : 1;
    for (let k = 0; k < nDots; k++) {
      const seed = i * 17 + k * 7 + 3;
      dotMats.push(mat4(x + (k === 0 ? -3.2 : 3.2), y - 1.8, Z_PANEL_FACE + 5.3));
      _c.set(hash01(seed) < 0.6 ? PALETTE.cyan : PALETTE.amber).multiplyScalar(0.85);
      const idx = dotColors.length;
      dotColors.push(_c.clone());
      if (hash01(seed + 4.9) < 0.38) {
        blinkers.push({
          idx,
          base: _c.clone(),
          speed: 0.5 + 0.5 * hash01(seed + 8.3),
          phase: hash01(seed + 2.2) * Math.PI * 2,
        });
      }
    }
  });
  // drop cables terminate at four of the boxes
  addDrop(-180, 0, FLOOR[0] + 120 + 4.5, 21);
  addDrop(340, 0, FLOOR[0] + 60 + 4.5, 22);
  addDrop(155, 1, FLOOR[1] + 100 + 4.5, 23);
  addDrop(445, 1, FLOOR[1] + 120 + 4.5, 24);

  // ── 5. VENTS + GRILLES (near ceilings; 2 with faint interior glow) ────────
  const VENTS = [
    [-450, 0], [-300, 0], [-30, 0], [160, 0], [300, 0], [450, 0],
    [-380, 1], [-140, 1], [220, 1], [520, 1],
  ];
  const GLOW_VENTS = [2, 9];
  const ventMats = [];
  VENTS.forEach(([x, deck], i) => {
    const y = CEIL[deck] - 14;
    ventMats.push(mat4(x, y, -130));
    for (const sdy of [-3.5, 0, 3.5]) bagDark.box(20, 1.5, 0.8, x, y + sdy, -124.9);
    if (GLOW_VENTS.includes(i)) bagGlow.plane(20, 9, x, y, -125.5);
  });

  // ── 6. FLOOR CLUTTER (room edges only — never in the walk lane band) ──────
  // Walk lane: z >= WALK_Z - 12 at floor level is crew space; keep z < WALK_Z - 15.
  const crateMats = [];
  const CRATES = [ // [x, deck, z]
    [R.intel.x0 + 10, 0, -118], [R.foundry.x1 - 10, 0, 8], [R.qc.x0 + 8, 0, -110],
    [R.quarters.x1 - 7, 1, -20], [R.comm.x0 + 10, 1, -110],
  ];
  CRATES.forEach(([x, deck, z], i) => {
    const s = 0.8 + 0.45 * hash01(i * 11.3 + 1);
    crateMats.push(mat4(x, FLOOR[deck] + 7.5 * s, z, 0, 0.7 * (hash01(i * 5.7) - 0.5), 0, s, s, s));
  });
  { // one double-stack at the intel edge
    const s = 0.62;
    crateMats.push(mat4(R.intel.x0 + 12, FLOOR[0] + 15 * (0.8 + 0.45 * hash01(1.3)) + 7.5 * s, -116,
      0, 0.5, 0, s, s, s));
  }
  const barrelMats = [];
  const BARRELS = [
    [R.gateway.x0 + 12, 0, -100], [R.gateway.x1 - 5, 0, -60],
    [R.quarters.x0 + 12, 1, -70], [R.analytics.x1 - 12, 1, 12], [R.comm.x1 - 13, 1, -100],
  ];
  BARRELS.forEach(([x, deck, z], i) => {
    const s = 0.85 + 0.3 * hash01(i * 7.7 + 4);
    barrelMats.push(mat4(x, FLOOR[deck] + 8 * s, z, 0, hash01(i * 3.9) * Math.PI, 0, s, s, s));
  });
  const chestMats = [];
  const CHESTS = [
    [R.cockpit.x0 + 14, 0, -80], [R.pipeline.x0 + 17, 0, -112],
    [R.finance.x0 + 12, 1, -105], [R.finance.x1 - 13, 1, -30],
  ];
  CHESTS.forEach(([x, deck, z], i) => {
    chestMats.push(mat4(x, FLOOR[deck] + 5.5, z, 0, 0.5 * (hash01(i * 9.1 + 6) - 0.5), 0));
  });

  // ── 7. CEILING STRUTS (cross-beam trusses under each deck ceiling) ────────
  const strutMats = [];
  const STRUTS0 = [-470, -390, -230, -80, 70, 250, 430, 530];
  const STRUTS1 = [-390, -300, -190, -50, 90, 200, 340, 500];
  for (const x of STRUTS0) if (!nearShaft(x)) strutMats.push(mat4(x, CEIL[0] - 4, -56));
  for (const x of STRUTS1) if (!nearShaft(x)) strutMats.push(mat4(x, CEIL[1] - 4, -56));

  // ── 8. STEAM / HAZE CARDS (engine end + under the core) ───────────────────
  bagHazeA.plane(55, 115, 596, FLOOR[1] + 60, -30, 0, 0.2, 0);
  bagHazeA.plane(45, 100, 574, FLOOR[1] + 52, -12, 0, -0.3, 0);
  bagHazeB.plane(50, 100, R.analytics.cx - 30, FLOOR[1] + 52, -20, 0, 0.25, 0);
  bagHazeB.plane(44, 90, R.analytics.cx + 28, FLOOR[1] + 47, -32, 0, -0.2, 0);

  // ── build merged meshes ────────────────────────────────────────────────────
  const addMerged = (bag, material, name) => {
    if (bag.vcount === 0) return null;
    const g = bag.build();
    geoms.push(g);
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };
  addMerged(bagCableA, matCableA, 'cablesA');
  addMerged(bagCableB, matCableB, 'cablesB');
  addMerged(bagCableC, matCableC, 'cablesC');
  addMerged(bagPipe, matPipe, 'pipes');
  addMerged(bagDark, matDark, 'darkDetail');
  addMerged(bagGlow, matVentGlow, 'ventGlow');
  addMerged(bagHazeA, matHazeA, 'hazeEngine');
  addMerged(bagHazeB, matHazeB, 'hazeCore');

  // ── build instanced meshes ─────────────────────────────────────────────────
  const addInstanced = (geom, material, matrices, colors, name) => {
    if (!matrices.length) { geom.dispose(); return null; }
    geoms.push(geom);
    const im = new THREE.InstancedMesh(geom, material, matrices.length);
    for (let i = 0; i < matrices.length; i++) {
      im.setMatrixAt(i, matrices[i]);
      if (colors) im.setColorAt(i, colors[i]);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.name = name;
    group.add(im);
    instanced.push(im);
    return im;
  };
  addInstanced(new THREE.TorusGeometry(5.5, 1.1, 6, 12), matPipe, valveMats, null, 'valveWheels');
  addInstanced(new THREE.BoxGeometry(12, 9, 5), matBox, jboxMats, null, 'junctionBoxes');
  const dotMesh = addInstanced(new THREE.PlaneGeometry(2.2, 2.2), matDot, dotMats, dotColors, 'indicatorDots');
  addInstanced(new THREE.BoxGeometry(26, 14, 8), matBox, ventMats, null, 'vents');
  addInstanced(new THREE.BoxGeometry(15, 15, 15), matClutter, crateMats, null, 'crates');
  addInstanced(new THREE.CylinderGeometry(5.5, 5.5, 16, 10), matBarrel, barrelMats, null, 'barrels');
  addInstanced(new THREE.BoxGeometry(24, 11, 13), matBarrel, chestMats, null, 'toolChests');
  addInstanced(new THREE.BoxGeometry(7, 5, 164), matStrut, strutMats, null, 'ceilingStruts');

  // ── update (zero allocations; seconds- or ms-domain clock accepted) ───────
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _e = new THREE.Euler();
  const _m = new THREE.Matrix4();
  const _cc = new THREE.Color();
  let lastT = null;
  let clock = 0;

  function update(t) {
    if (lastT !== null) {
      let dt = t - lastT;
      if (dt > 1.5) dt /= 1000;             // caller is on a millisecond clock
      if (dt > 0) clock += Math.min(dt, 0.1);
    }
    lastT = t;

    // hanging wires: tiny slow sway around the ceiling anchor
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      _e.set(
        w.amp * 0.6 * Math.sin(clock * w.speed * 0.83 + w.phase * 2.1),
        0,
        w.amp * Math.sin(clock * w.speed + w.phase),
      );
      _q.setFromEuler(_e);
      _p.set(w.x, w.y, w.z);
      _s.set(1, w.len, 1);
      _m.compose(_p, _q, _s);
      wireMesh.setMatrixAt(i, _m);
    }
    wireMesh.instanceMatrix.needsUpdate = true;

    // slow deterministic indicator blinks (subset only)
    if (dotMesh) {
      for (let i = 0; i < blinkers.length; i++) {
        const b = blinkers[i];
        const on = Math.sin(clock * b.speed + b.phase) > 0.35 ? 1 : 0.16;
        _cc.copy(b.base).multiplyScalar(on);
        dotMesh.setColorAt(b.idx, _cc);
      }
      if (dotMesh.instanceColor) dotMesh.instanceColor.needsUpdate = true;
    }

    // haze breathing (kept ≤0.06)
    matHazeA.opacity = 0.042 + 0.016 * Math.sin(clock * 0.5);
    matHazeB.opacity = 0.038 + 0.02 * Math.sin(clock * 0.37 + 2.1);
  }

  // ── API ────────────────────────────────────────────────────────────────────
  return {
    group,
    update,
    dispose() {
      for (const im of instanced) im.dispose();
      for (const g of geoms) g.dispose();
      for (const m of mats) m.dispose();
      if (group.parent) group.parent.remove(group);
      group.clear();
    },
  };
}
