// ── tunnel.js ────────────────────────────────────────────────────────────────
// The sewer the ship flies through (Osiris: enclosed, dark, wet, industrial).
// The hull stays put in scene space and the WORLD streams past it toward +X
// (the ship flies nose-first toward -X). The camera sits on the open side of
// the trench, so the enclosure is: a back wall of plating, a ceiling slab
// spanning from the wall forward past the hull, a black water floor, and a
// low walkway ledge along the front edge so the trench reads closed without
// hiding the ship. Ring ribs, pipes, cable looms, sparse cold lamps, steam
// near the water and drips falling from the ceiling do the rest. There are
// NO open stretches any more: `enclosed` is always true.
// Pure ES module. Deterministic (index-seeded hash). Built once; update()
// only moves instance matrices and drip vertices — zero per-frame allocations.
//
//   const tunnel = createTunnel();
//   scene.add(tunnel.group);
//   tunnel.update(dt /* seconds */);
//   tunnel.speed = 240;              // units/sec, scenery only, never a lie
//   tunnel.dispose();

import * as THREE from 'three';
import { HULL_3D, PALETTE } from './scene3dContract.js';

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };

const SEG = 320;                 // one tunnel segment along X
const PATTERN = 22;              // segments per pattern (even: seg parity is stable across wrap)
const SPAN = SEG * PATTERN;      // total streamed length before the pattern repeats
const X_MIN = -SPAN / 2;
const WALL_Z = HULL_3D.zBack - 300;   // -460: back wall well behind the hull
const FRONT_Z = 420;                  // ceiling / floor reach this far toward the camera
const LEDGE_Z = 380;                  // the walkway ledge along the front edge
// Frame math (camera y 110, z 1420, fov 33, target y -10): the frame spans
// y ≈ -605..+509 at the back wall, ≈ -410..+430 at the hull, ≈ -296..+330 at
// the ledge. The hull itself spans -200..250. Placements below keep every
// enclosure surface INSIDE that frame: the ceiling underside is seen from the
// wall out to z ≈ -80, the water from the wall out to z ≈ -145, and the ledge
// lip crosses the very bottom of the frame without touching the keel.
const CEIL_Y = HULL_3D.yTop + 170;      // 420: ceiling slab (underside faces the water)
const FLOOR_Y = HULL_3D.yBottom - 300;  // -500: black water plane
const LEDGE_TOP = HULL_3D.yBottom - 70; // -270: walkway ledge top; the keel (-200) stays clear
const LAMP_TOP_Y = HULL_3D.yTop + 52;   // 302: wall lamps above the hull line
const LAMP_LOW_Y = HULL_3D.yBottom - 95; // -295: and below the keel
const DEPTH = FRONT_Z - WALL_Z;         // 880: wall → front edge
const MID_Z = (FRONT_Z + WALL_Z) / 2;   // -20

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

// ── drips: sparse water falling from the ceiling, streamed with the world ───
const DRIP_COUNT = 80;
const DRIP_RANGE = 3200;                // x wrap range in tunnel space (±1600 is past the frame edge)
const DRIP_FALL = CEIL_Y - FLOOR_Y;     // 920

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
  const matDrip = new THREE.LineBasicMaterial({ color: 0x8fb6d9, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  mats.push(matDrip);

  // One streamed element = an instanced mesh with one instance per segment
  // slot. place() may return null for a slot that is empty on that segment
  // (sparse lamps, ribs every other segment): it scales to zero.
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

  // Back wall plating: two stacked plates per segment (floor to ceiling), slight depth jitter.
  streamed(new THREE.BoxGeometry(SEG - 6, 540, 24), matPlate, 2, (seg, k, i) => ({
    ...unit, x: 0, y: (k === 0 ? -270 : 270) + hash(i) * 20, z: WALL_Z + hash(i + 3) * 18,
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
  // Ring ribs every other segment: a floor-to-ceiling post on the back wall
  // and a beam across the ceiling and one across the floor, wall → front edge.
  // No front post: it would cross the cutaway.
  streamed(new THREE.BoxGeometry(30, CEIL_Y - FLOOR_Y, 30), matRib, 1, (seg) => (seg % 2 ? null : {
    ...unit, x: 0, y: (CEIL_Y + FLOOR_Y) / 2, z: WALL_Z + 32,
  }));
  streamed(new THREE.BoxGeometry(30, 30, DEPTH), matRib, 2, (seg, k) => (seg % 2 ? null : {
    ...unit, x: 0, y: k === 0 ? CEIL_Y - 15 : FLOOR_Y + 15, z: MID_Z,
  }));
  // Pipes: three runs along the wall (two above the hull, one below the keel)
  // and two under the ceiling, small y jitter.
  streamed(new THREE.CylinderGeometry(9, 9, SEG + 2, 8), matPipe, 5, (seg, k, i) => (k < 3
    ? { ...unit, x: 0, y: [HULL_3D.yTop + 30, HULL_3D.yTop + 74, HULL_3D.yBottom - 60][k] + hash(i + 11) * 10, z: WALL_Z + 30 + k * 10, rz: Math.PI / 2 }
    : { ...unit, x: 0, y: CEIL_Y - 26 - (k - 3) * 6, z: WALL_Z + 200 + (k - 3) * 110, rz: Math.PI / 2 }));
  // Cable looms: four thin runs on the wall, tilted alternately per segment so they zigzag into a sag.
  streamed(new THREE.CylinderGeometry(3.5, 3.5, SEG + 12, 5), matCable, 4, (seg, k, i) => ({
    ...unit, x: 0, y: (k < 2 ? HULL_3D.yTop + 112 + k * 16 : HULL_3D.yBottom - 118 - (k - 2) * 16) + hash(i + 5) * 6,
    z: WALL_Z + 42 + k * 3, rz: Math.PI / 2 + (seg % 2 ? 0.035 : -0.035),
  }));
  // Loom drops: short verticals hanging from the ceiling pipes, two per segment.
  streamed(new THREE.CylinderGeometry(3, 3, 1, 5), matCable, 2, (seg, k, i) => {
    const len = 50 + hash(i + 41) * 90;
    return { ...unit, x: (hash(i + 43) - 0.5) * 200, y: CEIL_Y - 30 - len / 2, z: WALL_Z + 200 + k * 110, sy: len };
  });
  // Sparse cold lamps: a wall lamp above the hull on even segments, below the
  // keel on odd segments, and a caged ceiling lamp between the ribs. Each has
  // a soft halo card. These are the strongest motion cue.
  const lampSlot = (seg, k) => (k === 0 && seg % 2 === 0) || (k === 1 && seg % 2 === 1) || (k === 2 && seg % 2 === 1);
  streamed(new THREE.BoxGeometry(54, 9, 6), matLamp, 3, (seg, k, i) => (!lampSlot(seg, k) ? null : (k < 2
    ? { ...unit, x: (hash(i + 29) - 0.5) * 60, y: k === 0 ? LAMP_TOP_Y : LAMP_LOW_Y, z: WALL_Z + 16 }
    : { ...unit, x: 0, y: CEIL_Y - 5, z: WALL_Z + 340, sx: 0.8, sy: 1, sz: 7 })));
  streamed(new THREE.PlaneGeometry(130, 130), matLampHalo, 3, (seg, k, i) => (!lampSlot(seg, k) ? null : (k < 2
    ? { ...unit, x: (hash(i + 29) - 0.5) * 60, y: (k === 0 ? LAMP_TOP_Y : LAMP_LOW_Y) - 10, z: WALL_Z + 26 }
    : { ...unit, x: 0, y: CEIL_Y - 46, z: WALL_Z + 340, sx: 0.8, sy: 0.8 })));
  // Foreground cables: thin, high, close to camera, pass fast for parallax.
  // They live at the top edge of frame so they never cross the cutaway.
  streamed(new THREE.CylinderGeometry(2.6, 2.6, SEG + 40, 5), matCable, 2, (seg, k, i) => ({
    ...unit, x: 0, y: HULL_3D.yTop + 150 + k * 22 + hash(i + 19) * 16, z: 560 + k * 70, rz: Math.PI / 2 + (hash(i + 23) - 0.5) * 0.05,
  }));
  // Steam: soft grey cards drifting just above the water at the back of the trench.
  streamed(new THREE.PlaneGeometry(420, 220), matSteam, 1, (seg, k, i) => ({
    ...unit, x: (hash(i + 61) - 0.5) * 120, y: FLOOR_Y + 90 + hash(i + 67) * 40, z: WALL_Z + 120 + hash(i + 71) * 200, sx: 0.8 + hash(i + 73) * 0.6,
  }), { sway: 18 });

  // Pad wash on the water: the hover pads' cyan, reflected. Static under the
  // hull (the ship does not move in scene space), pulsing with the pads.
  const padWashGeo = new THREE.PlaneGeometry(1400, 520); geoms.push(padWashGeo);
  const padWash = new THREE.Mesh(padWashGeo, matPadWash);
  padWash.rotation.x = -Math.PI / 2;
  padWash.position.set(0, FLOOR_Y + 1.5, -250);
  padWash.frustumCulled = false;
  group.add(padWash);

  // Drips: one LineSegments, columns in tunnel space so they stream with the
  // world. Columns sit behind the hull (70%) or in front of it (30%), never
  // through the cutaway.
  const dripPos = new Float32Array(DRIP_COUNT * 6);
  const drips = new Float32Array(DRIP_COUNT * 5); // x0, z, phase, speed, len
  for (let i = 0; i < DRIP_COUNT; i++) {
    const behind = hash(i + 101) < 0.7;
    drips[i * 5] = (hash(i + 103) - 0.5) * DRIP_RANGE;
    drips[i * 5 + 1] = behind ? WALL_Z + 30 + hash(i + 107) * 150 : 190 + hash(i + 109) * 160;
    drips[i * 5 + 2] = hash(i + 113) * DRIP_FALL;
    drips[i * 5 + 3] = 620 + hash(i + 127) * 320;
    drips[i * 5 + 4] = 26 + hash(i + 131) * 26;
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
  const api = { group, speed: 240, update, dispose, get enclosed() { return true; } };

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
    // Drips: fall from the ceiling, wrap at the water; columns ride the stream.
    for (let i = 0; i < DRIP_COUNT; i++) {
      let x = drips[i * 5] + travel;
      x -= Math.floor((x + DRIP_RANGE / 2) / DRIP_RANGE) * DRIP_RANGE; // wrap into ±DRIP_RANGE/2
      const cycle = (drips[i * 5 + 2] + drips[i * 5 + 3] * time) % DRIP_FALL;
      const y = CEIL_Y - cycle;
      dripPos[i * 6] = x; dripPos[i * 6 + 1] = y;
      dripPos[i * 6 + 3] = x; dripPos[i * 6 + 4] = Math.min(CEIL_Y, y + drips[i * 5 + 4]);
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
