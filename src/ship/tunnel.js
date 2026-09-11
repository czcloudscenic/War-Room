// ── tunnel.js ────────────────────────────────────────────────────────────────
// The undercity the ship flies through. The hull stays put in scene space and
// the WORLD streams past it toward +X (the ship flies nose-first toward -X).
// The camera sits on the open side of a canyon, so the tunnel is a half-pipe:
// a back wall of plating, ceiling girders, wall lamps and pipes, with open
// stretches where the trench falls away and the city and storm show through.
// Pure ES module. Deterministic (index-seeded hash). Built once; update()
// only moves instance matrices — zero per-frame allocations.
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
const PATTERN = 22;              // segments per pattern; segments in GAP are open sky
const GAP = new Set([14, 15, 16, 17, 18, 19, 20]);
const SPAN = SEG * PATTERN;      // total streamed length before the pattern repeats
const X_MIN = -SPAN / 2, X_MAX = SPAN / 2;
const WALL_Z = HULL_3D.zBack - 300;   // back wall well behind the hull
// The camera frames roughly y -380..+370 at the hull. The hull itself spans
// -200..250, so the world can only be SEEN in two bands: above the top armor
// (250..370) and below the keel (-200..-380). Every passing element lives in
// one of those bands or it is decoration nobody sees.
const CEIL_Y = HULL_3D.yTop + 95;      // 345: girders cross the upper band
const FLOOR_Y = HULL_3D.yBottom - 150; // -350: grating crosses the lower band
const LAMP_TOP_Y = HULL_3D.yTop + 52;  // 302: wall lamps above the hull line
const LAMP_LOW_Y = HULL_3D.yBottom - 95; // -295: and below the keel

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export function createTunnel() {
  const group = new THREE.Group();
  group.name = 'tunnel';
  const geoms = [], mats = [];
  const lambert = (c, extra = {}) => { const m = new THREE.MeshLambertMaterial({ color: c, ...extra }); mats.push(m); return m; };
  const basic = (c, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color: c, ...extra }); mats.push(m); return m; };

  // Materials: near-black steel, plating with a hint of blue, neutral lamps.
  const matPlate = lambert(0x05070b);   // near-black: the key light and fog give it all the value it needs
  const matGirder = lambert(0x04060a);
  const matPipe = lambert(0x121721);
  const matLamp = basic(new THREE.Color(PALETTE.amber).multiplyScalar(0.9).getHex());
  const matLampHalo = basic(0xdfe6f0, { transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const matCable = lambert(0x07080b);

  // One streamed element = an instanced mesh with one instance per segment.
  // Each instance carries its pattern index; gap segments scale to zero.
  const parts = [];
  function streamed(geometry, material, perSeg, place) {
    geoms.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, PATTERN * perSeg);
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const base = [];   // per-instance local offset from the segment origin + rotation + scale
    for (let seg = 0; seg < PATTERN; seg++) {
      for (let k = 0; k < perSeg; k++) {
        const i = seg * perSeg + k;
        base.push(place(seg, k, i));
      }
    }
    parts.push({ mesh, base, perSeg });
    group.add(mesh);
    return mesh;
  }

  // Back wall plating: two stacked plates per segment, slight depth jitter.
  streamed(new THREE.BoxGeometry(SEG - 6, 560, 24), matPlate, 2, (seg, k, i) => ({
    x: 0, y: (k === 0 ? -160 : 400) + hash(i) * 30, z: WALL_Z + hash(i + 3) * 18, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
  }));
  // Ceiling girders: one I-beam across the canyon per segment, spanning toward the camera.
  streamed(new THREE.BoxGeometry(22, 26, 900), matGirder, 1, (seg, k, i) => ({
    x: 0, y: CEIL_Y + hash(i + 7) * 40, z: WALL_Z + 450, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
  }));
  // Wall pipes: long runs along X in both visible bands, small y jitter.
  streamed(new THREE.CylinderGeometry(9, 9, SEG + 2, 8), matPipe, 3, (seg, k, i) => ({
    x: 0, y: [HULL_3D.yTop + 30, HULL_3D.yTop + 74, HULL_3D.yBottom - 60][k] + hash(i + 11) * 10, z: WALL_Z + 30 + k * 10, rx: 0, ry: 0, rz: Math.PI / 2, sx: 1, sy: 1, sz: 1,
  }));
  // Wall lamps: one above the hull and one below per segment, neutral, each
  // with a soft halo card in front. These are the strongest motion cue.
  streamed(new THREE.BoxGeometry(54, 9, 6), matLamp, 2, (seg, k, i) => ({
    x: (hash(i + 29) - 0.5) * 60, y: k === 0 ? LAMP_TOP_Y : LAMP_LOW_Y, z: WALL_Z + 16, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
  }));
  streamed(new THREE.PlaneGeometry(300, 300), matLampHalo, 2, (seg, k, i) => ({
    x: (hash(i + 29) - 0.5) * 60, y: (k === 0 ? LAMP_TOP_Y : LAMP_LOW_Y) - 10, z: WALL_Z + 26, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
  }));
  // Floor grating far below, so the trench has a bottom when it is enclosed.
  streamed(new THREE.BoxGeometry(SEG - 4, 20, 700), matGirder, 1, (seg, k, i) => ({
    x: 0, y: FLOOR_Y, z: WALL_Z + 350, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
  }));
  // Foreground cables: thin, high, close to camera, pass fast for parallax.
  // They live at the top edge of frame so they never cross the cutaway.
  streamed(new THREE.CylinderGeometry(2.6, 2.6, SEG + 40, 5), matCable, 2, (seg, k, i) => ({
    x: 0, y: HULL_3D.yTop + 150 + k * 22 + hash(i + 19) * 16, z: 560 + k * 70, rx: 0, ry: 0, rz: Math.PI / 2 + (hash(i + 23) - 0.5) * 0.05, sx: 1, sy: 1, sz: 1,
  }));

  // Stream state: the pattern's origin slides toward +X and wraps every SEG,
  // so the visible set is always the same 22 segments, re-indexed.
  let scroll = 0;                       // 0..SEG
  let head = 0;                         // pattern index of the segment at X_MIN
  const api = { group, speed: 240, update, dispose, get enclosed() { return enclosedNow; } };
  let enclosedNow = true;

  function layout() {
    for (const part of parts) {
      const { mesh, base, perSeg } = part;
      for (let seg = 0; seg < PATTERN; seg++) {
        const patternIdx = (head + seg) % PATTERN;
        const open = GAP.has(patternIdx);
        const segX = X_MIN + seg * SEG + scroll;
        for (let k = 0; k < perSeg; k++) {
          const i = seg * perSeg + k;
          const b = base[patternIdx * perSeg + k];
          _p.set(segX + b.x, b.y, b.z);
          _e.set(b.rx, b.ry, b.rz); _q.setFromEuler(_e);
          _s.set(open ? 0 : b.sx, open ? 0 : b.sy, open ? 0 : b.sz);
          _m.compose(_p, _q, _s);
          mesh.setMatrixAt(i, _m);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // Is the stretch around the hull enclosed right now? (drives ship ambience)
    const midSeg = Math.floor((0 - X_MIN - scroll) / SEG);
    enclosedNow = !GAP.has((head + Math.max(0, Math.min(PATTERN - 1, midSeg))) % PATTERN);
  }

  function update(dt) {
    const d = Math.max(0, Math.min(0.1, dt)) * api.speed;
    scroll += d;
    while (scroll >= SEG) { scroll -= SEG; head = (head + PATTERN - 1) % PATTERN; }
    layout();
  }

  function dispose() {
    for (const g of geoms) g.dispose();
    for (const m of mats) m.dispose();
    for (const part of parts) part.mesh.dispose?.();
  }

  layout();
  return api;
}
