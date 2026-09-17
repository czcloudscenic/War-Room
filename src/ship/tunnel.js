// ── tunnel.js ────────────────────────────────────────────────────────────────
// The sewer the ship flies through (Osiris: enclosed, dark, wet, industrial).
// The hull stays put in scene space and the WORLD streams past it toward +X
// (the ship flies nose-first toward -X). The camera sits on the open side of
// the trench, so the enclosure is: a back wall of plating, a ceiling slab
// spanning from the wall forward past the hull, a black water floor, and a
// low walkway ledge along the front edge so the trench reads closed without
// hiding the ship. Ring ribs, pipes, cable looms and cold lamps do the rest.
// There are NO open stretches any more: `enclosed` is always true.
//
// 2026-09-17 (widen + no weather):
//   * The bore is much bigger than the frame on purpose. The escort sentinels
//     fly above the hull (y ≈ 295 cruising, 320–400 docked) and the exterior
//     GLB reaches y ≈ ±469 with its masts, so the ceiling sits at y 670 and
//     the water at y -760 — nothing above the hull can touch either. Ceiling
//     and floor therefore run OUT of frame at the hull's depth; that is what
//     an enclosing tunnel does. Everything the camera must read (ribs, pipes,
//     looms, lamps) is re-spaced across the taller section so the visible band
//     (y ≈ -640..+620 at the hull, -855..+750 at the back wall) stays full.
//   * No weather. The old rain-like drip field is gone; what remains is a
//     handful (24) of slow vertical water drips hanging off the ceiling ribs
//     at the back of the trench, never across the cutaway.
//   * Ribs and lamps now land on EVERY segment and the default scroll is 384
//     u/s (was 240): the passing ribs and lamps are the motion cue.
//
// Pure ES module. Deterministic (index-seeded hash). Built once; update()
// only moves instance matrices and drip vertices — zero per-frame allocations.
//
//   const tunnel = createTunnel();
//   scene.add(tunnel.group);
//   tunnel.update(dt /* seconds */);
//   tunnel.speed = 384;              // units/sec, scenery only, never a lie
//   tunnel.dispose();

import * as THREE from 'three';
import { HULL_3D, PALETTE } from './scene3dContract.js';

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };

const SEG = 320;                 // one tunnel segment along X
const PATTERN = 22;              // segments per pattern (even: seg parity is stable across wrap)
const SPAN = SEG * PATTERN;      // total streamed length before the pattern repeats
const X_MIN = -SPAN / 2;
const WALL_Z = HULL_3D.zBack - 420;   // -580: back wall well behind the hull
const FRONT_Z = 540;                  // ceiling / floor reach this far toward the camera
const LEDGE_Z = 500;                  // the walkway ledge along the front edge
// Frame math (camera [180,150,2120], fov 33, target [10,-10,0], ~1.93:1):
// half-height ≈ 632 at the hull (z 0), ≈ 803 at the back wall (z -580), ≈ 473
// at the ledge (z 540); the view axis crosses y ≈ -10 / -53 / +30 there. So
// the visible band is y ≈ -642..+622 at the hull and -856..+750 at the wall.
// The ceiling (670) and water (-760) run past it — correct for an enclosure —
// while every rib, pipe, loom and lamp below is placed inside that band.
const CEIL_Y = HULL_3D.yTop + 420;      // 670: ceiling slab (underside faces the water)
const FLOOR_Y = HULL_3D.yBottom - 560;  // -760: black water plane
const LEDGE_TOP = HULL_3D.yBottom - 70; // -270: walkway ledge top; the keel (-200) stays clear
const HEIGHT = CEIL_Y - FLOOR_Y;        // 1430: floor-to-ceiling
const DEPTH = FRONT_Z - WALL_Z;         // 1120: wall → front edge
const MID_Z = (FRONT_Z + WALL_Z) / 2;   // -20
// Wall furniture, spread across the taller section and kept inside the band
// the camera sees at the back wall (y -856..750).
const LAMP_ROWS = [580, 300, -300, -620];     // four wall lamp rows, alternating per segment
const CEIL_LAMP_Y = CEIL_Y - 150;             // 520: caged lamp on a stalk, clear of the wall rows and always in frame
const PIPE_ROWS = [580, 324, 280, -260, -530]; // wall pipe runs
const LOOM_ROWS = [620, 470, -420, -600];      // cable looms
const BRACE_ROWS = [430, -470];                // horizontal wall braces between the ring ribs

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _zero = new THREE.Vector3(0, 0, 0);

// Soft radial glow for the lamp halos and steam: a hard square card under
// bloom reads as a grey slab; a radial falloff reads as light or vapour.
function makeGlowTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); if (!g) return null;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

// ── ceiling drips: NOT weather ───────────────────────────────────────────────
// A few slow beads of water that let go of the ceiling ribs at the back of the
// trench and fall a short way before they wrap. Never over the cutaway, never
// dense enough to read as rain.
const DRIP_COUNT = 24;
const DRIP_RANGE = 3200;                // x wrap range in tunnel space
const DRIP_TOP = CEIL_Y - 24;           // they start on the rib underside
const DRIP_FALL = 300;                  // and only fall this far before wrapping
const DRIP_Z = [WALL_Z + 32, WALL_Z + 200, WALL_Z + 310]; // the ceiling rib / pipe lines

export function createTunnel() {
  const group = new THREE.Group();
  group.name = 'tunnel';
  const geoms = [], mats = [];
  const lambert = (c, extra = {}) => { const m = new THREE.MeshLambertMaterial({ color: c, ...extra }); mats.push(m); return m; };
  const basic = (c, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color: c, ...extra }); mats.push(m); return m; };

  // Materials: near-black steel with a hint of blue, neutral lamps, black water.
  // Palette doctrine: cold blue-black only; cyan comes from the ship's pads.
  const matPlate = lambert(0x05070b);   // the key light and fog give it all the value it needs
  const matCeiling = lambert(0x06080d);
  const matRib = lambert(0x0b0f16);     // a step lighter so the ribs read against the plating
  const matLedge = lambert(0x0a0d13);
  const matPipe = lambert(0x121721);
  const matCable = lambert(0x07080b);
  const matWater = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.15, metalness: 0.6 });
  mats.push(matWater);
  const glowTex = makeGlowTexture();
  // Lamps and their halos ignore the fog: they are the light sources, and in a
  // wet tunnel they punch through the haze instead of sinking into it.
  const matLamp = basic(new THREE.Color(PALETTE.amber).multiplyScalar(0.9).getHex(), { fog: false });
  // Halos obey the fog (a fog-immune additive card reads as a grey disc);
  // low opacity, the lamp box itself carries the point of light.
  const matLampHalo = basic(0xdfe6f0, { map: glowTex, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const matSteam = basic(0x6d7c8f, { map: glowTex, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const matPadWash = basic(PALETTE.cyan, { map: glowTex, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const matDrip = new THREE.LineBasicMaterial({ color: 0x8fb6d9, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  mats.push(matDrip);

  // One streamed element = an instanced mesh with one instance per segment
  // slot. place() may return null for a slot that is empty on that segment
  // (alternating lamp rows): it scales to zero.
  const parts = [];
  function streamed(geometry, material, perSeg, place, opts = {}) {
    geoms.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, PATTERN * perSeg);
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const base = [];   // per-slot local offset from the segment origin + rotation + scale
    for (let seg = 0; seg < PATTERN; seg++) {
      for (let k = 0; k < perSeg; k++) {
        const i = seg * perSeg + k;
        base.push(place(seg, k, i));
      }
    }
    parts.push({ mesh, base, perSeg, sway: opts.sway || 0 });
    group.add(mesh);
    return mesh;
  }
  const unit = { rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 };

  // Back wall plating: three stacked plates per segment covering the full
  // floor-to-ceiling height, slight depth jitter.
  const PLATE_H = HEIGHT / 3 + 10;
  streamed(new THREE.BoxGeometry(SEG - 6, PLATE_H, 24), matPlate, 3, (seg, k, i) => ({
    ...unit, x: 0, y: FLOOR_Y + (HEIGHT / 3) * (k + 0.5), z: WALL_Z + hash(i + 3) * 18,
  }));
  // Ceiling slab: one plate per segment from the back wall forward past the hull.
  streamed(new THREE.BoxGeometry(SEG - 2, 18, DEPTH), matCeiling, 1, () => ({
    ...unit, x: 0, y: CEIL_Y + 9, z: MID_Z,
  }));
  // Water floor: a shallow black plane, low roughness so the pad wash and the
  // lamps put a sheen on it. Opaque on purpose (transparency would show the void).
  streamed(new THREE.PlaneGeometry(SEG + 2, DEPTH), matWater, 1, () => ({
    ...unit, x: 0, y: FLOOR_Y, z: MID_Z, rx: -Math.PI / 2,
  }));
  // Front walkway ledge: a low wall from the water up to just under the keel line, plus a rail lip.
  streamed(new THREE.BoxGeometry(SEG - 2, LEDGE_TOP - FLOOR_Y, 44), matLedge, 1, () => ({
    ...unit, x: 0, y: (LEDGE_TOP + FLOOR_Y) / 2, z: LEDGE_Z,
  }));
  streamed(new THREE.BoxGeometry(SEG + 2, 7, 7), matPipe, 1, () => ({
    ...unit, x: 0, y: LEDGE_TOP + 4, z: LEDGE_Z - 16,
  }));
  // Ring ribs on EVERY segment now (the dominant motion cue): a floor-to-
  // ceiling post on the back wall, a beam across the ceiling and one across
  // the floor, wall → front edge. No front post: it would cross the cutaway.
  streamed(new THREE.BoxGeometry(34, HEIGHT, 30), matRib, 1, () => ({
    ...unit, x: 0, y: (CEIL_Y + FLOOR_Y) / 2, z: WALL_Z + 32,
  }));
  streamed(new THREE.BoxGeometry(30, 30, DEPTH), matRib, 2, (seg, k) => ({
    ...unit, x: 0, y: k === 0 ? CEIL_Y - 15 : FLOOR_Y + 15, z: MID_Z,
  }));
  // Horizontal wall braces tying the ring posts together at mid heights: they
  // fill the tall wall without ever crossing the cutaway (they hug the wall).
  streamed(new THREE.BoxGeometry(SEG + 2, 16, 18), matRib, BRACE_ROWS.length, (seg, k) => ({
    ...unit, x: 0, y: BRACE_ROWS[k], z: WALL_Z + 30,
  }));
  // Pipes: five runs along the wall spread over the full height, two under the
  // ceiling, small y jitter.
  streamed(new THREE.CylinderGeometry(9, 9, SEG + 2, 8), matPipe, PIPE_ROWS.length + 2, (seg, k, i) => (k < PIPE_ROWS.length
    ? { ...unit, x: 0, y: PIPE_ROWS[k] + hash(i + 11) * 10, z: WALL_Z + 30 + (k % 3) * 10, rz: Math.PI / 2 }
    : { ...unit, x: 0, y: CEIL_Y - 26 - (k - PIPE_ROWS.length) * 6, z: WALL_Z + 200 + (k - PIPE_ROWS.length) * 110, rz: Math.PI / 2 }));
  // Cable looms: four thin runs on the wall, tilted alternately per segment so they zigzag into a sag.
  streamed(new THREE.CylinderGeometry(3.5, 3.5, SEG + 12, 5), matCable, LOOM_ROWS.length, (seg, k, i) => ({
    ...unit, x: 0, y: LOOM_ROWS[k] + hash(i + 5) * 6,
    z: WALL_Z + 42 + k * 3, rz: Math.PI / 2 + (seg % 2 ? 0.035 : -0.035),
  }));
  // Loom drops: short verticals hanging from the ceiling pipes, two per segment.
  streamed(new THREE.CylinderGeometry(3, 3, 1, 5), matCable, 2, (seg, k, i) => {
    const len = 90 + hash(i + 41) * 130;
    return { ...unit, x: (hash(i + 43) - 0.5) * 200, y: CEIL_Y - 30 - len / 2, z: WALL_Z + 200 + k * 110, sy: len };
  });
  // Lamps: four wall rows up the height (each on alternate segments, so two
  // wall lamps pass per segment) plus a caged lamp under the ceiling on EVERY
  // segment. With the faster scroll these are the strongest motion cue.
  const NL = LAMP_ROWS.length;
  const lampSlot = (seg, k) => (k === NL ? true : (seg + k) % 2 === 0);
  const lampAt = (seg, k, i) => (k === NL
    ? { ...unit, x: 0, y: CEIL_LAMP_Y, z: WALL_Z + 340, sx: 0.8, sy: 1, sz: 7 }
    : { ...unit, x: (hash(i + 29) - 0.5) * 60, y: LAMP_ROWS[k], z: WALL_Z + 16 });
  streamed(new THREE.BoxGeometry(54, 9, 6), matLamp, NL + 1, (seg, k, i) => (!lampSlot(seg, k) ? null : lampAt(seg, k, i)));
  streamed(new THREE.PlaneGeometry(130, 130), matLampHalo, NL + 1, (seg, k, i) => {
    if (!lampSlot(seg, k)) return null;
    const b = lampAt(seg, k, i);
    return k === NL
      ? { ...unit, x: b.x, y: b.y - 6, z: b.z, sx: 0.8, sy: 0.8 }
      : { ...unit, x: b.x, y: b.y - 10, z: b.z + 10 };
  });
  // Stalks holding the ceiling lamps: one per segment.
  streamed(new THREE.CylinderGeometry(2.6, 2.6, 1, 5), matCable, 1, () => {
    const len = CEIL_Y - 18 - (CEIL_LAMP_Y + 5);
    return { ...unit, x: 0, y: (CEIL_Y - 18 + CEIL_LAMP_Y + 5) / 2, z: WALL_Z + 340, sy: len };
  });
  // Foreground cables: thin, high, close to camera, pass fast for parallax.
  // They live at the top edge of frame so they never cross the cutaway.
  streamed(new THREE.CylinderGeometry(2.6, 2.6, SEG + 40, 5), matCable, 2, (seg, k, i) => ({
    ...unit, x: 0, y: HULL_3D.yTop + 150 + k * 22 + hash(i + 19) * 16, z: 620 + k * 70, rz: Math.PI / 2 + (hash(i + 23) - 0.5) * 0.05,
  }));
  // Steam: soft grey cards drifting just above the water at the back of the trench.
  streamed(new THREE.PlaneGeometry(420, 220), matSteam, 1, (seg, k, i) => ({
    ...unit, x: (hash(i + 61) - 0.5) * 120, y: FLOOR_Y + 150 + hash(i + 67) * 40, z: WALL_Z + 120 + hash(i + 71) * 200, sx: 0.8 + hash(i + 73) * 0.6,
  }), { sway: 18 });

  // Pad wash on the water: the hover pads' cyan, reflected. Static under the
  // hull (the ship does not move in scene space), pulsing with the pads.
  // It sits well back: the water is 560 below the keel now, so only the far
  // part of it (z < ≈ -330) is inside the frame.
  const padWashGeo = new THREE.PlaneGeometry(1400, 700); geoms.push(padWashGeo);
  const padWash = new THREE.Mesh(padWashGeo, matPadWash);
  padWash.rotation.x = -Math.PI / 2;
  padWash.position.set(0, FLOOR_Y + 1.5, -420);
  padWash.frustumCulled = false;
  group.add(padWash);

  // Ceiling drips: one LineSegments, 24 short beads on the ceiling rib lines,
  // all behind the hull, streamed with the world in x.
  const dripPos = new Float32Array(DRIP_COUNT * 6);
  const drips = new Float32Array(DRIP_COUNT * 5); // x0, z, phase, speed, len
  for (let i = 0; i < DRIP_COUNT; i++) {
    drips[i * 5] = (hash(i + 103) - 0.5) * DRIP_RANGE;
    drips[i * 5 + 1] = DRIP_Z[i % DRIP_Z.length] + hash(i + 107) * 40;
    drips[i * 5 + 2] = hash(i + 113) * DRIP_FALL;
    drips[i * 5 + 3] = 70 + hash(i + 127) * 90;   // slow: a bead, not a streak
    drips[i * 5 + 4] = 9 + hash(i + 131) * 9;
    dripPos[i * 6 + 2] = dripPos[i * 6 + 5] = drips[i * 5 + 1];
  }
  const dripGeo = new THREE.BufferGeometry(); geoms.push(dripGeo);
  dripGeo.setAttribute('position', new THREE.BufferAttribute(dripPos, 3));
  const dripLines = new THREE.LineSegments(dripGeo, matDrip);
  dripLines.frustumCulled = false;
  group.add(dripLines);

  // Stream state: the pattern's origin slides toward +X and wraps every SEG,
  // so the visible set is always the same 22 segments, re-indexed.
  let scroll = 0;                       // 0..SEG
  let head = 0;                         // pattern index of the segment at X_MIN
  let travel = 0;                       // total distance streamed, for the drips
  let time = 0;
  const api = { group, speed: 384, update, dispose, get enclosed() { return true; } };

  function layout() {
    for (const part of parts) {
      const { mesh, base, perSeg, sway } = part;
      for (let seg = 0; seg < PATTERN; seg++) {
        const patternIdx = (head + seg) % PATTERN;
        const segX = X_MIN + seg * SEG + scroll;
        for (let k = 0; k < perSeg; k++) {
          const i = seg * perSeg + k;
          const b = base[patternIdx * perSeg + k];
          if (!b) { _m.compose(_zero, _q.identity(), _zero); mesh.setMatrixAt(i, _m); continue; }
          const dy = sway ? Math.sin(time * 0.5 + patternIdx * 1.7) * sway : 0;
          _p.set(segX + b.x, b.y + dy, b.z);
          _e.set(b.rx, b.ry, b.rz); _q.setFromEuler(_e);
          _s.set(b.sx, b.sy, b.sz);
          _m.compose(_p, _q, _s);
          mesh.setMatrixAt(i, _m);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // Drips: let go of the ceiling ribs, fall a short way, wrap. Columns ride
    // the stream so they pass with the tunnel instead of hanging in the air.
    for (let i = 0; i < DRIP_COUNT; i++) {
      let x = drips[i * 5] + travel;
      x -= Math.floor((x + DRIP_RANGE / 2) / DRIP_RANGE) * DRIP_RANGE; // wrap into ±DRIP_RANGE/2
      const cycle = (drips[i * 5 + 2] + drips[i * 5 + 3] * time) % DRIP_FALL;
      const y = DRIP_TOP - cycle;
      dripPos[i * 6] = x; dripPos[i * 6 + 1] = y;
      dripPos[i * 6 + 3] = x; dripPos[i * 6 + 4] = Math.min(DRIP_TOP, y + drips[i * 5 + 4]);
    }
    dripGeo.attributes.position.needsUpdate = true;
    matPadWash.opacity = 0.10 + 0.03 * Math.sin(time * 1.3);
  }

  function update(dt) {
    const step = Math.max(0, Math.min(0.1, dt));
    const d = step * api.speed;
    scroll += d; travel += d; time += step;
    while (scroll >= SEG) { scroll -= SEG; head = (head + PATTERN - 1) % PATTERN; }
    if (travel >= DRIP_RANGE) travel -= DRIP_RANGE;
    layout();
  }

  function dispose() {
    for (const g of geoms) g.dispose();
    for (const m of mats) m.dispose();
    glowTex?.dispose();
    for (const part of parts) part.mesh.dispose?.();
  }

  layout();
  return api;
}
