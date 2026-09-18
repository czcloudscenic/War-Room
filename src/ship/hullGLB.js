// ── hullGLB.js ───────────────────────────────────────────────────────────────
// The generated exterior hull (Meshy image-to-3D from Christian's reference,
// 9/11: armored plated hovercraft, forward cockpit block, cyan ring hover pads,
// antenna masts, twin turret). It replaces the procedural box shell in the
// modeled world, scaled UNIFORMLY so the room block sits in its belly with a
// real band of plating above and below, and CUT AWAY on the camera side with a
// clipping window so the procedural decks and rooms inside stay visible. A
// procedural "cut frame" (deck-edge beams, vertical ribs, top and bottom edge
// plates) dresses the opening so it reads as a section through a vessel, not
// a hole. The renderer needs localClippingEnabled.
//
//   const hull = createHullGLB({ onReady });
//   rig.add(hull.group); hull.update(t); hull.dispose();
//
// Exports for the other systems (sentinels dock on the armor):
//   HULL_BOUNDS      { x0, x1, y0, y1, z0, z1 } of the placed exterior, defaults
//                    from the intended numbers, exact after the GLB lands.
//   HULL_TOP_Y(x)    y of the top armor at scene x along the centerline.
//   HULL_BOTTOM_Y(x) y of the belly plating at scene x (hover pads and
//                    outriggers rejected, so a pad cannot poison a bin).
//   hullProfileAt(x) { top, bottom } in one call.
//   bayProfileAt(x, floor, ceil)  the INTERIOR edge for a bay column: the
//                    same measured silhouette mapped into a deck's band, so a
//                    bay under the sloping bow is short and slanted and a bay
//                    amidships is full height. roomWalls.js paints to it and
//                    shipModel.js builds its back panels to it, which is how
//                    the interior stops reading as flat rectangles pasted
//                    inside a curved vessel.
//   hullProfileVersion()  bumps once the real measurement replaces the
//                    defaults, so shaped geometry can rebuild.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HULL_3D, DECK_Y, DECK_CLEAR, WALK_Z, toSceneX } from './scene3dContract.js';
import { ROOMS } from './world.js';

export const HULL_URL = '/hull/hull.glb';

// Measured proportions of hull.glb (154k verts, decoded 9/14): bounding box
// height 0.4074 and depth 0.5013 of its length; along the centerline the top
// armor plating sits at about +0.14 L and the belly at about -0.11 L (the
// hover pads hang to -0.20 L, the masts and turret reach +0.20 L). The body
// is therefore only ~0.25 L tall, so to keep true proportions (no Y stretch)
// AND enclose the 450-tall room block with ~110 units of plating above the
// top-deck ceiling (210) and below the lower-deck floor (-140), the hull has
// to be ~1.92x the 1200 contract length: 2304 long, centered on the rooms.
const SCALE = 1.92;
const LENGTH = (HULL_3D.x1 - HULL_3D.x0) * SCALE;   // 2304
const PROP = { h: 0.4074, d: 0.5013 };
// The bounding-box center (masts and pads included) lands here. y 0 puts the
// belly plating at ~-253 and the top armor at ~+322; z -60 keeps the hull's
// centerline near the rooms' mid-depth so the top profile is honest at z≈0.
const OFFSET = { x: 0, y: 0, z: -60 };
const YAW = Math.PI;   // the generation puts the cockpit at +X; the contract wants the nose at -X

// The cutaway is a WINDOW, not a half: five planes with clipIntersection
// remove only fragments inside the box (x0..x1, y0..y1, z > zBack): exactly
// the interior plus a small margin, so the nose block, stern, top armor, keel
// and hover pads all survive and the rooms show through the opening. The
// rooms' own back panel closes the window.
export const CUT = {
  x0: -570, x1: 610,
  y0: DECK_Y[1] - 6,               // -146: lower-deck floor minus a lip
  y1: DECK_Y[0] + DECK_CLEAR + 6,  //  216: upper-deck ceiling plus a lip
  zBack: -150,
};

export const HULL_BOUNDS = {
  x0: OFFSET.x - LENGTH / 2, x1: OFFSET.x + LENGTH / 2,                      // -1152 .. 1152
  y0: OFFSET.y - LENGTH * PROP.h / 2, y1: OFFSET.y + LENGTH * PROP.h / 2,    //  -469 ..  469
  z0: OFFSET.z - LENGTH * PROP.d / 2, z1: OFFSET.z + LENGTH * PROP.d / 2,    //  -637 ..  517
};

// Centerline top-armor profile, 40 bins nose→stern, as a fraction of the
// length (95th percentile of y within |z| < 0.06 L per bin, measured from the
// GLB; the dip at bins 7..11 is the low forward deck behind the nose block,
// bin 21 is the turret). Replaced by the live measurement once the GLB lands.
const TOP_PROFILE_DEFAULT = [
  0.019, 0.012, -0.006, -0.012, 0.010, -0.001, -0.012, -0.037, -0.039, -0.052,
  -0.061, -0.080, 0.081, 0.115, 0.126, 0.134, 0.135, 0.138, 0.150, 0.148,
  0.145, 0.203, 0.155, 0.132, 0.164, 0.125, 0.141, 0.114, 0.151, 0.145,
  0.151, 0.156, 0.120, 0.083, 0.061, 0.052, 0.043, 0.038, 0.015, -0.012,
];
let topProfile = TOP_PROFILE_DEFAULT.map((f) => OFFSET.y + f * LENGTH);

// Centerline BELLY profile, same 40 bins, same measurement, 5th percentile
// per bin — but only over samples above BELLY_REJECT. The ring hover pads and
// the outriggers hang to about -0.20 L; without the rejection one pad drags a
// whole bin 150 units under the real keel and the interior thinks it has
// belly room it does not have. Measured from hull.glb and smoothed 3-tap
// (the raw belly is greebled, and a jagged floor edge reads as noise).
const BELLY_REJECT_F = -0.135;   // fraction of LENGTH: below this is a pad, not the keel
const BELLY_SANE_F = -0.03;      // a belly sample above this means the bin saw no keel at all
const BOTTOM_PROFILE_DEFAULT = [
  -0.058, -0.075, -0.089, -0.099, -0.090, -0.086, -0.093, -0.109, -0.124, -0.128,
  -0.121, -0.120, -0.120, -0.121, -0.113, -0.116, -0.108, -0.115, -0.104, -0.113,
  -0.114, -0.124, -0.126, -0.114, -0.104, -0.094, -0.098, -0.091, -0.091, -0.086,
  -0.093, -0.099, -0.104, -0.108, -0.111, -0.105, -0.098, -0.088, -0.087, -0.086,
];
let bottomProfile = BOTTOM_PROFILE_DEFAULT.map((f) => OFFSET.y + f * LENGTH);

// Bin-interpolated read of a 40-bin profile at scene x, clamped to the ends.
function sampleProfile(profile, x) {
  const n = profile.length;
  const u = (x - HULL_BOUNDS.x0) / (HULL_BOUNDS.x1 - HULL_BOUNDS.x0) * n - 0.5;
  const i = Math.max(0, Math.min(n - 1, Math.floor(u)));
  const k = Math.max(0, Math.min(n - 1, i + 1));
  const t = Math.max(0, Math.min(1, u - i));
  return profile[i] + (profile[k] - profile[i]) * t;
}

// y of the top armor surface at scene x (centerline), 4 units under the
// plating so a docked machine sits ON it. Clamped to the hull's ends.
export function HULL_TOP_Y(x) {
  return sampleProfile(topProfile, x) - 4;
}

// y of the belly plating at scene x, 4 units above it (the mirror of the
// -4 above: an interior surface may sit ON the inner face, not through it).
export function HULL_BOTTOM_Y(x) {
  return sampleProfile(bottomProfile, x) + 4;
}

export function hullProfileAt(x) {
  return { top: HULL_TOP_Y(x), bottom: HULL_BOTTOM_Y(x) };
}

// Bumped when the live measurement replaces the defaults. Shaped interior
// geometry polls this and rebuilds; nothing has to be wired through the host.
let profileVersion = 0;
export function hullProfileVersion() { return profileVersion; }

// ── The interior silhouette ──────────────────────────────────────────────────
// The room block is INSET in the hull: amidships there is ~110 units of
// plating over the top-deck ceiling and ~120 under the lower-deck floor, so a
// naive "clamp the bay to the hull" does nothing for eleven of twelve bays.
// The rule that actually tracks the exterior is the PLATING BAND: keep `above`
// units of armour over a bay and `below` under it, and where the hull cannot
// give that (the sloping bow, the thinning stern belly) take it out of the bay
// instead — the bay's ceiling slopes down with the crown, its floor rises with
// the keel. The hard clamp (never outside `top - inset` / `bottom + inset`)
// rides on top, so no interior surface can ever poke through the skin.
export const BAY = {
  above: 110, below: 120,   // design plating band over/under the room block
  inset: 10,                // hard clearance from the skin itself
  lip: 3,                   // the old 3-unit lip off floor and ceiling
  maxShrink: 0.5,           // a bay may lose at most half its clear height per edge
  minHeight: 0.32,          // ...and never drops under this share of it
};

export function bayProfileAt(x, floor, ceil) {
  const clear = ceil - floor;
  const t = HULL_TOP_Y(x);
  const b = HULL_BOTTOM_Y(x);
  const cap = BAY.maxShrink * clear;
  const drop = Math.min(cap, Math.max(0, BAY.above - (t - ceil)));
  const rise = Math.min(cap, Math.max(0, BAY.below - (floor - b)));
  let top = Math.min(ceil - BAY.lip - drop, t - BAY.inset);
  let bottom = Math.max(floor + BAY.lip + rise, b + BAY.inset);
  const minH = BAY.minHeight * clear;
  if (top - bottom < minH) {
    const c = (top + bottom) / 2;
    top = c + minH / 2; bottom = c - minH / 2;
    if (top > ceil - BAY.lip) { top = ceil - BAY.lip; bottom = top - minH; }
    if (bottom < floor + BAY.lip) { bottom = floor + BAY.lip; top = bottom + minH; }
  }
  return { top, bottom };
}

const PAD = { color: 0x2aabff, base: 0.55, pulse: 0.35 };

// ── Cut frame: the structure exposed by the section ──────────────────────────
// Deck-edge beams at each floor (top flush with the floor so crew walk on
// them), vertical ribs every 180 units that avoid the middle of every room,
// end posts, and a top and bottom edge plate. Dark steel, shadowed, no clip.
const FRAME = {
  color: 0x151a22, roughness: 0.7, metalness: 0.5,
  z: WALK_Z + 6,          // 46: the walk lane's front edge
  beam: { h: 14, d: 22 },
  rib: { w: 10, d: 18, every: 180, zProud: 8 },
  plate: { h: 30, d: 26 },
  inset: 4,               // frame ends sit just inside the window
};

function ribXs() {
  const x0 = CUT.x0 + FRAME.inset + FRAME.rib.w / 2;
  const x1 = CUT.x1 - FRAME.inset - FRAME.rib.w / 2;
  // A rib may not stand in the central 60% of any room on either deck.
  const blocked = ROOMS.map((r) => {
    const a = toSceneX(r.x0), b = toSceneX(r.x1), c = (a + b) / 2, w = b - a;
    return [c - 0.3 * w, c + 0.3 * w];
  });
  const xs = [x0, x1];
  for (let x = Math.ceil(x0 / FRAME.rib.every) * FRAME.rib.every; x < x1; x += FRAME.rib.every) {
    if (Math.abs(x - x0) < 60 || Math.abs(x - x1) < 60) continue;
    if (blocked.some(([a, b]) => x > a && x < b)) continue;
    xs.push(x);
  }
  return xs;
}

function createCutFrame() {
  const g = new THREE.Group();
  g.name = 'hullCutFrame';
  const mat = new THREE.MeshStandardMaterial({ color: FRAME.color, roughness: FRAME.roughness, metalness: FRAME.metalness });
  const add = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const len = CUT.x1 - CUT.x0 - 2 * FRAME.inset;
  const cx = (CUT.x0 + CUT.x1) / 2;
  // Deck-edge beams: full length at each floor level, top flush with the floor.
  for (const deck of [0, 1]) add(len, FRAME.beam.h, FRAME.beam.d, cx, DECK_Y[deck] - FRAME.beam.h / 2, FRAME.z);
  // Top and bottom edge plates along the cut.
  add(len, FRAME.plate.h, FRAME.plate.d, cx, CUT.y1 + FRAME.plate.h / 2, FRAME.z);
  add(len, FRAME.plate.h, FRAME.plate.d, cx, CUT.y0 - FRAME.plate.h / 2, FRAME.z);
  // Vertical ribs spanning plate to plate, standing a little proud of the beams.
  const ribH = (CUT.y1 + FRAME.plate.h) - (CUT.y0 - FRAME.plate.h);
  const ribY = (CUT.y1 + CUT.y0) / 2;
  for (const x of ribXs()) add(FRAME.rib.w, ribH, FRAME.rib.d, x, ribY, FRAME.z + FRAME.rib.zProud);
  return g;
}

// Measure the placed hull in the group's own space: exact bounds, and the
// centerline top-armor profile (per-bin 95th percentile so the thin masts do
// not pull it up). Runs once, ~150k vertices.
function measure(group, wrap) {
  group.updateMatrixWorld(true);
  const toGroup = group.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const n = topProfile.length;
  const bins = Array.from({ length: n }, () => []);
  const bbins = Array.from({ length: n }, () => []);   // belly, pads rejected
  const reject = OFFSET.y + BELLY_REJECT_F * LENGTH;
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  wrap.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    m.multiplyMatrices(toGroup, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      box.expandByPoint(v);
      if (Math.abs(v.z - OFFSET.z) < 0.06 * LENGTH) {
        const b = Math.floor((v.x - HULL_BOUNDS.x0) / (HULL_BOUNDS.x1 - HULL_BOUNDS.x0) * n);
        if (b >= 0 && b < n) {
          bins[b].push(v.y);
          if (v.y >= reject) bbins[b].push(v.y);   // a hover pad must not poison the bin
        }
      }
    }
  });
  if (box.isEmpty()) return;
  Object.assign(HULL_BOUNDS, { x0: box.min.x, x1: box.max.x, y0: box.min.y, y1: box.max.y, z0: box.min.z, z1: box.max.z });
  // Fill empty bins from neighbours (shared by both profiles).
  const fill = (prof, fallback) => {
    for (let i = 0; i < n; i++) {
      if (prof[i] !== null) continue;
      let l = i - 1; while (l >= 0 && prof[l] === null) l--;
      let r = i + 1; while (r < n && prof[r] === null) r++;
      const a = l >= 0 ? prof[l] : null, b = r < n ? prof[r] : null;
      prof[i] = a !== null && b !== null ? (a + b) / 2 : (a ?? b ?? fallback[i]);
    }
    return prof;
  };
  const pct = (a, q) => { if (a.length < 10) return null; a.sort((p, o) => p - o); return a[Math.floor(q * (a.length - 1))]; };

  const prof = fill(bins.map((a) => pct(a, 0.95)), topProfile);
  // Knock out single-bin holes (a mast base with no centerline plating reads
  // as a pit otherwise).
  for (let i = 1; i < n - 1; i++) {
    const nb = Math.min(prof[i - 1], prof[i + 1]);
    if (prof[i] < nb - 0.08 * LENGTH) prof[i] = (prof[i - 1] + prof[i + 1]) / 2;
  }
  topProfile = prof;

  // Belly: 5th percentile of the surviving samples. A bin whose answer comes
  // out above BELLY_SANE_F saw only superstructure in the centerline band (no
  // keel at all) — treat it as empty and interpolate, then smooth 3-tap.
  const sane = OFFSET.y + BELLY_SANE_F * LENGTH;
  const bprof = fill(bbins.map((a) => { const y = pct(a, 0.05); return y === null || y > sane ? null : y; }), bottomProfile);
  bottomProfile = bprof.map((y, i) => (bprof[Math.max(0, i - 1)] + y + bprof[Math.min(n - 1, i + 1)]) / 3);
  profileVersion++;
}

export function createHullGLB({ onReady } = {}) {
  const group = new THREE.Group();
  group.name = 'hullGLB';
  // Plane convention: a fragment is clipped where dot(normal, p) + constant < 0.
  // With clipIntersection, it is removed only when that holds for EVERY plane,
  // so each plane's clipped half-space must be the INSIDE of the box.
  const clip = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -CUT.x1),    // x - x1 < 0  : x < x1
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), CUT.x0),    // -x + x0 < 0 : x > x0
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -CUT.y1),    // y < y1
    new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT.y0),    // y > y0
    new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT.zBack), // -z + zBack < 0 : z > zBack
  ];
  const mats = [];
  let disposed = false;
  let ready = false;

  // The frame is procedural: it is there from the first frame, so the section
  // never pops in after the hull.
  group.add(createCutFrame());

  new GLTFLoader().load(HULL_URL, (gltf) => {
    if (disposed) return;
    const model = gltf.scene;
    // Normalize: center on the bounding box, uniform scale to LENGTH, nose
    // toward -X (turned about Y; symmetry was on, so both flanks carry the
    // outrigger rings), then offset so the rooms sit in the belly.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const s = LENGTH / (size.x || 1);
    model.position.set(-c.x, -c.y, -c.z);
    const turn = new THREE.Group();
    turn.rotation.y = YAW;
    turn.add(model);
    const wrap = new THREE.Group();
    wrap.scale.setScalar(s);
    wrap.position.set(OFFSET.x, OFFSET.y, OFFSET.z);
    wrap.add(turn);
    model.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      // FrontSide on purpose: through the window we must NOT see the inside of
      // the shell (a grey cavity); with back faces culled the rooms' own back
      // panel closes the view instead.
      m.side = THREE.FrontSide;
      m.clippingPlanes = clip;
      m.clipIntersection = true;
      m.clipShadows = true;
      if (m.color) m.color.multiplyScalar(1.35);   // the bake is very dark; lift it toward the key
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 0.6, 0.74);
      if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0.4, 0.28);
      // The pads are the cyan parts of the base color: drive emissive from the
      // same map, tinted cyan, so plating stays matte and rings glow.
      if ('emissive' in m && m.map) {
        m.emissive = new THREE.Color(PAD.color);
        m.emissiveMap = m.map;
        m.emissiveIntensity = PAD.base;
      }
      o.castShadow = true; o.receiveShadow = true;
      mats.push(m);
    });
    group.add(wrap);
    measure(group, wrap);
    ready = true;
    onReady?.({ size: size.clone().multiplyScalar(s), bounds: { ...HULL_BOUNDS } });
  }, undefined, () => { /* missing hull: the procedural shell stays */ });

  function update(t) {
    if (!ready) return;
    const k = PAD.base + PAD.pulse * (0.5 + 0.5 * Math.sin(t / 900));
    for (const m of mats) if ('emissiveIntensity' in m) m.emissiveIntensity = k;
  }
  function dispose() {
    disposed = true;
    group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } });
    group.clear();
  }
  return { group, update, dispose, get ready() { return ready; } };
}
