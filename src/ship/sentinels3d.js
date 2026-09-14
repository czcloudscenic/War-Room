// ── sentinels3d.js ───────────────────────────────────────────────────────────
// Sentinel machines around the FLYING hull (the modeled world, scene coords).
// Same original squid-machine design as drones.js (shared builder), but flown
// as an escort: they hold loose formation with the ship, drift, bank, sweep
// searchlights across the plating, and one of them makes a close foreground
// pass every so often. Scale is true to the crew: a head is wider than a
// person is tall. Pure three.js; no per-frame allocations.
//
// Pursuit ("Final Flight of the Osiris"): while the tunnel is enclosed a
// `threat` value eases to 1. Past 0.6 the stern machine ATTACHES: its body
// rests on the top armor (HULL_TOP_Y from hullGLB.js), its arms curl down
// over the plating, and it cuts continuously with a bright weld point, sparks
// and a trail of glowing scars that fade. Every free-flying machine is hard
// clamped OUTSIDE the hull's bounding box (+40) so nothing passes through
// the ship.
//
//   const s = createSentinels3D();
//   scene.add(s.group);         // NOT under the ship rig: they move relative to the banking hull
//   s.update(t /* ms */, { enclosed });
//   s.getContacts(out)          // fills out with {x, z, kind} for the radar
//   s.dispose();

import * as THREE from 'three';
import { buildSentinel } from './drones.js';
import { HULL_3D } from './scene3dContract.js';
import * as Hull from './hullGLB.js';

// Hull surface + bounds come from hullGLB.js once it exports them; until then
// (or if the hull never loads) these approximations keep everything outside.
const DEFAULT_BOUNDS = { x0: -730, x1: 730, y0: -330, y1: 330, z0: -330, z1: 250 };
const hullTopY = (x) => {
  if (typeof Hull.HULL_TOP_Y === 'function') {
    const y = Hull.HULL_TOP_Y(x);
    if (Number.isFinite(y)) return y;
  }
  return HULL_3D.yTop + 30;
};
const hullBounds = () => Hull.HULL_BOUNDS || DEFAULT_BOUNDS;
const CLEARANCE = 40;
// Push a free-flying position out of the hull box (expanded by CLEARANCE)
// along the axis with the least penetration. In place, allocation-free.
function clampOutsideHull(p) {
  const b = hullBounds();
  const x0 = b.x0 - CLEARANCE, x1 = b.x1 + CLEARANCE;
  const y0 = b.y0 - CLEARANCE, y1 = b.y1 + CLEARANCE;
  const z0 = b.z0 - CLEARANCE, z1 = b.z1 + CLEARANCE;
  if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1 || p.z <= z0 || p.z >= z1) return;
  let best = p.x - x0, axis = 0;
  if (x1 - p.x < best) { best = x1 - p.x; axis = 1; }
  if (p.y - y0 < best) { best = p.y - y0; axis = 2; }
  if (y1 - p.y < best) { best = y1 - p.y; axis = 3; }
  if (p.z - z0 < best) { best = p.z - z0; axis = 4; }
  if (z1 - p.z < best) { best = z1 - p.z; axis = 5; }
  switch (axis) {
    case 0: p.x = x0; break;
    case 1: p.x = x1; break;
    case 2: p.y = y0; break;
    case 3: p.y = y1; break;
    case 4: p.z = z0; break;
    default: p.z = z1;
  }
}

// Escort slots in scene space. The ship flies toward -X; heads face -X.
const ESCORTS = [
  { name: 'stern-high', x: 590, y: HULL_3D.yTop + 45, z: -60, s: 3.4, drift: 40, period: 9000, phase: 0.0 },
  // tight = where each escort holds under pursuit (always OUTSIDE the hull)
  // Under the bow, in the lower band left of the under-hull glow (the camera
  // frames x -580..820 at hull depth; anything further left is off screen).
  { name: 'bow-low',    x: -560, y: HULL_3D.yBottom - 90, z: -120, s: 2.5, drift: 34, period: 11000, phase: 2.2, tight: { x: -440, y: HULL_3D.yBottom - 40, z: -60 } },
  { name: 'far-cross',  x: 0, y: 160, z: -720, s: 1.4, drift: 0, period: 34000, phase: 1.1, cross: true },
];
// The close pass: enters stage right in front of the hull, exits left.
const PASS = { every: 38000, duration: 1900, z: 620, y: 40, s: 3.4, x0: 1500, x1: -1500 };
// Pursuit: inside a tunnel the escorts tighten onto the hull and the
// stern-high machine lands on the top armor and cuts.
const PURSUIT = {
  attachAt: 0.6,                                   // threat past this: the cutter lands
  dock: { x: 470, z: 30 },                         // where the cutter sits on the armor (y from the surface)
  crawl: 40,                                       // it creeps +-this along x, slowly (period ~50 s => ~5 u/s)
  pitch: -0.7,                                     // body nose-down so the eyes look at the plating
  headLen: 44,                                     // modeled head length at scale 1 (drones.js)
  // Grip: arms splay RADIALLY around the body like the film (some reach
  // forward over the head, some aft, the sides reach over the flanks), each
  // arcing down until the tip meets the plating. Not a bunch under the body.
  grip: { base: -0.1, spread: 0.9, curl: 0.17, fan: 1.25 },
};
const SCAR_COUNT = 6, SCAR_LIFE = 6.0, SCAR_EVERY = 1000;   // glowing cut trail: ring of strips, s / ms

export function createSentinels3D() {
  const group = new THREE.Group();
  group.name = 'sentinels3d';
  let threat = 0;                                  // 0 open air .. 1 full pursuit, eased
  let attach = 0;                                  // 0 flying .. 1 resting on the armor, eased
  // Cutting beam + sparks (Points burst, allocation-free)
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xe5e5ea, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 1, 8, 1, true), beamMat);
  group.add(beam);
  const impact = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  group.add(impact);
  const SPARKS = 140;
  const sparkPos = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
  const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  sparks.frustumCulled = false;
  group.add(sparks);
  for (let i = 0; i < SPARKS; i++) sparkLife[i] = -1;
  const impactLight = new THREE.PointLight(0xdfe6f0, 0, 420, 2);
  group.add(impactLight);
  // Scars: a ring of thin additive strips laid flat on the top armor along the
  // cut trail, white-blue, fading over SCAR_LIFE seconds.
  const scarGeo = new THREE.PlaneGeometry(90, 6);
  const scars = [];
  for (let k = 0; k < SCAR_COUNT; k++) {
    const m = new THREE.Mesh(scarGeo, new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;   // lie flat, facing up
    m.visible = false;
    group.add(m);
    scars.push({ mesh: m, born: -1 });
  }
  let scarNext = 0, scarLastAt = -Infinity;
  let sparkSeed = 1;
  const rnd = () => { sparkSeed = (sparkSeed * 16807) % 2147483647; return sparkSeed / 2147483647; };
  const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _muzzle = new THREE.Vector3(), _hit = new THREE.Vector3();
  const _free = new THREE.Vector3(), _lightOff = new THREE.Vector3(0, 30, 40);
  let lastT = null;
  const units = ESCORTS.map((e) => {
    const g = buildSentinel(e.s);
    g.position.set(e.x, e.y, e.z);
    g.rotation.y = Math.PI; // face -X (direction of flight)
    group.add(g);
    return { g, e };
  });
  const cutterUnit = units.find(u => u.e.name === 'stern-high');
  const cutter = cutterUnit.g;
  const lift = 0.45 * PURSUIT.headLen * cutterUnit.e.s;   // body rests on the surface, not in it
  const passer = buildSentinel(PASS.s);
  passer.visible = false;
  group.add(passer);

  // grip 0..1 blends the trailing slipstream pose into the gripping pose: the
  // first segment swings back to PURSUIT.grip.base (arms lie along the
  // plating), each following segment curls a further `curl` toward the
  // surface (positive rotation.z swings a segment toward the head, i.e. down
  // and under once the base points aft), the roots fan outward in z so the
  // side arms reach over the flanks, and a slow writhe keeps them alive.
  function animateBody(g, t, i, agitation = 1, grip = 0) {
    const ud = g.userData;
    ud.nav.material.opacity = (Math.sin(t / 300 + i * 1.7) > 0.55) ? 0.95 : 0.1;
    ud.hunterEye.material.opacity = 0.55 + 0.45 * Math.sin(t / 480 + i);
    for (let e = 0; e < ud.eyes.length; e++) ud.eyes[e].material.opacity = 0.75 + 0.25 * Math.sin(t / 340 + i + e * 0.9);
    ud.beam.material.opacity = 0.05 + 0.03 * Math.sin(t / 1900 + i);
    ud.beam.rotation.x = Math.sin(t / 5200 + i * 2.4) * 0.35;     // searchlight sweeps the plating
    ud.beam.rotation.z = 0.55 + Math.sin(t / 7100 + i) * 0.25;
    const G = PURSUIT.grip;
    for (let k = 0; k < ud.tentacles.length; k++) {
      const tt = ud.tentacles[k];
      const ring = tt.ring ?? (tt.phase / 1.7);
      if (grip > 0) tt.root.rotation.x = Math.sin(ring) * (0.3 * (1 - grip) + G.fan * grip);
      else tt.root.rotation.x = Math.sin(ring) * 0.3;
      for (let j = 0; j < tt.segs.length; j++) {
        // Trailing in the slipstream: a travelling wave down each arm, faster
        // and wider than the painting's idle writhe.
        const trail = (j === 0 ? tt.base : -0.10)
          + Math.sin(t / (520 / agitation) + tt.phase + j * 0.6 + i * 2) * (0.12 + j * 0.028);
        let z = trail;
        if (grip > 0) {
          const hold = (j === 0 ? (G.base + G.spread * Math.cos(ring)) : G.curl * j)
            + Math.sin(t / 1400 + tt.phase + j * 0.5) * (0.03 + j * 0.006);   // small writhe: it is still alive
          z = trail + (hold - trail) * grip;
        }
        tt.segs[j].rotation.z = z;
        tt.segs[j].rotation.x = Math.sin(t / 1100 + tt.phase * 1.3 + j * 0.4) * 0.07 * (1 - 0.6 * grip);
      }
    }
  }

  function update(t, opts = {}) {
    const dt = lastT == null ? 0.016 : Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    const want = opts.enclosed ? 1 : 0;
    threat += (want - threat) * Math.min(1, dt * (want ? 0.9 : 0.5));
    const wantAttach = threat > PURSUIT.attachAt ? 1 : 0;
    attach += (wantAttach - attach) * Math.min(1, dt * (wantAttach ? 1.1 : 1.6));
    const land = attach * attach * (3 - 2 * attach);   // smoothstep for the position blend
    // The cutter's seat on the armor: creeps along x, y from the surface.
    const dockX = PURSUIT.dock.x + Math.sin(t / 8000) * PURSUIT.crawl;
    const dockZ = PURSUIT.dock.z;
    const seatY = hullTopY(dockX) + lift;
    for (let i = 0; i < units.length; i++) {
      const { g, e } = units[i];
      if (e.cross) {
        // Far machine overtaking on a long line, then looping back out of frame.
        const p = ((t + e.phase * 1000) % e.period) / e.period;
        g.position.x = 1100 - p * 2200;
        g.position.y = e.y + Math.sin(t / 2300) * 20;
        g.position.z = e.z;
        g.rotation.y = Math.PI;
        g.rotation.z = -0.06;
        clampOutsideHull(g.position);
      } else {
        // Loose formation: a slow lissajous drift around the slot + hover bob.
        // Under threat the slot slides toward the hull (tighten); the free
        // position is always clamped outside the hull box.
        const a = t / e.period * Math.PI * 2 + e.phase;
        const isCutter = g === cutter;
        const tight = e.tight || e;
        const tx = e.x + (tight.x - e.x) * threat;
        const ty = e.y + (tight.y - e.y) * threat;
        const tz = e.z + (tight.z - e.z) * threat;
        _free.set(
          tx + Math.sin(a) * e.drift,
          ty + Math.sin(a * 2 + e.phase) * e.drift * 0.35 + Math.sin(t / 900 + i) * 4,
          tz + Math.cos(a) * e.drift * 0.3,
        );
        clampOutsideHull(_free);
        const freeZ = Math.cos(a) * 0.12, freeX = Math.sin(a * 2) * 0.05;   // bank into the drift
        if (isCutter && land > 0) {
          // ATTACHED: body on the top armor, creeping, a fast low shudder from the cut.
          const sx = dockX + Math.sin(t / 130) * 1.2 * land;
          const sy = seatY + Math.cos(t / 170) * 0.8 * land;
          g.position.set(
            _free.x + (sx - _free.x) * land,
            _free.y + (sy - _free.y) * land,
            _free.z + (dockZ - _free.z) * land,
          );
          g.rotation.z = freeZ * (1 - land) + PURSUIT.pitch * land;   // nose down at the plating
          g.rotation.x = freeX * (1 - land) + Math.sin(t / 2100) * 0.02 * land;
        } else {
          g.position.copy(_free);
          g.rotation.z = freeZ;
          g.rotation.x = freeX;
        }
        g.rotation.y = Math.PI;
      }
      animateBody(g, t, i, 1 + threat * 1.4, g === cutter ? attach : 0);
    }
    // Cutting: continuous while attached. Beam from the head's muzzle (the
    // eyes, local +X, which faces -X and down once pitched) to the weld point
    // on the armor just ahead of the seat; the point drags with the crawl.
    const cutting = attach > 0.5;
    const cutX = dockX - 30 + Math.sin(t / 1300) * 4;
    _hit.set(cutX, hullTopY(cutX) + 1, dockZ + 10 + Math.cos(t / 1700) * 3);
    _muzzle.set(20, -4, 0).multiplyScalar(cutterUnit.e.s).applyEuler(cutter.rotation).add(cutter.position);
    _dir.subVectors(_hit, _muzzle);
    const len = _dir.length();
    beam.position.copy(_muzzle).addScaledVector(_dir, 0.5);
    beam.scale.set(1, len, 1);
    beam.quaternion.setFromUnitVectors(_up, _dir.normalize());
    const on = cutting ? attach : 0;
    beamMat.opacity = on * (0.55 + 0.35 * Math.abs(Math.sin(t / 45)));
    impact.position.copy(_hit);
    impact.material.opacity = on * (0.5 + 0.4 * Math.abs(Math.sin(t / 40)));
    const is = cutting ? 0.9 + 0.5 * Math.abs(Math.sin(t / 60)) : 0.001;
    impact.scale.set(is, is, is);
    impactLight.position.copy(_hit).add(_lightOff);
    impactLight.intensity = on * (60000 + 40000 * Math.abs(Math.sin(t / 50)));
    // Sparks: a steady spray off the weld point, fall under gravity, die
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt;
        sparkVel[i * 3 + 1] -= 900 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt; sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
        if (sparkLife[i] <= 0) { sparkPos[i * 3 + 1] = -99999; }
      } else if (cutting && rnd() < 0.07) {
        sparkLife[i] = 0.35 + rnd() * 0.5;
        sparkPos[i * 3] = _hit.x; sparkPos[i * 3 + 1] = _hit.y; sparkPos[i * 3 + 2] = _hit.z;
        const ang = rnd() * Math.PI * 2, sp = 180 + rnd() * 260;
        sparkVel[i * 3] = Math.cos(ang) * sp; sparkVel[i * 3 + 1] = 120 + rnd() * 320; sparkVel[i * 3 + 2] = Math.sin(ang) * sp * 0.6 + 80;
      } else if (sparkLife[i] < 0) { sparkPos[i * 3 + 1] = -99999; }
    }
    sparkGeo.attributes.position.needsUpdate = true;
    // Scars: lay a new strip under the weld point every SCAR_EVERY while
    // cutting; every strip fades out over SCAR_LIFE.
    if (cutting && t - scarLastAt >= SCAR_EVERY) {
      const s = scars[scarNext]; scarNext = (scarNext + 1) % SCAR_COUNT; scarLastAt = t;
      s.born = t;
      s.mesh.position.set(_hit.x, _hit.y + 1.5, _hit.z);
      s.mesh.visible = true;
    }
    for (let k = 0; k < SCAR_COUNT; k++) {
      const s = scars[k];
      if (s.born < 0) continue;
      const age = (t - s.born) / 1000;
      if (age >= SCAR_LIFE) { s.born = -1; s.mesh.visible = false; s.mesh.material.opacity = 0; continue; }
      const f = 1 - age / SCAR_LIFE;
      s.mesh.material.opacity = f * f * 0.85 + (age < 0.4 ? 0.15 * Math.abs(Math.sin(t / 37)) : 0);
    }
    // Close pass (z = 620 is in front of the hull, outside the box; clamped anyway)
    const cycle = t % PASS.every;
    if (cycle < PASS.duration) {
      const p = cycle / PASS.duration;
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      passer.visible = true;
      passer.position.set(PASS.x0 + (PASS.x1 - PASS.x0) * ease, PASS.y + Math.sin(p * Math.PI) * 60, PASS.z);
      clampOutsideHull(passer.position);
      passer.rotation.y = Math.PI;
      passer.rotation.z = -0.22 + Math.sin(p * Math.PI) * 0.1;
      animateBody(passer, t, 7, 2.2);
    } else {
      passer.visible = false;
    }
  }

  // Radar contacts: scene x (along the hull) and z (depth) per machine.
  function getContacts(out) {
    out.length = 0;
    for (const { g, e } of units) out.push({ x: g.position.x, z: g.position.z, y: g.position.y, kind: e.cross ? 'far' : 'escort' });
    if (passer.visible) out.push({ x: passer.position.x, z: passer.position.z, y: passer.position.y, kind: 'pass' });
    return out;
  }

  function dispose() {
    group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    group.clear();
  }

  return { group, update, getContacts, dispose, get threat() { return threat; } };
}
