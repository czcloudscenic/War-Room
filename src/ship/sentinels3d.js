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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
// The perched model (public/sentinel/perched-a.glb), measured from its vertex
// cloud (scratchpad tooling, 62874 verts, quantised int16 x node scale 0.4897):
//   bbox 0.882 x 0.861 x 0.980 (x,y,z), legs splayed to the full x/z extent at
//   the bottom, one compact head/body blob at the top: x -0.06..0.30 (centre
//   +0.10), z +-0.14, y 0.20..0.43 (i.e. 0.73..1.0 of the height once the feet
//   are dropped to y = 0). So the head sits above the leg spread, its snout
//   offset forward (+x local, which is -x in the scene: the group is turned
//   PI so the eye faces the way the ship flies).
const PERCH = {
  width: 210,        // world units across the widest span (leg spread)
  sink: 6,           // feet set BELOW the plating: contact reads as pressure, no gap
  headX: 0.113,      // head centre, as a fraction of the model's x size
  muzzleY: 0.70,     // beam origin, as a fraction of the model's height (just under the head blob at 0.73)
  shadow: 0.46,      // contact-shadow radius, as a fraction of `width`
};
const SCAR_COUNT = 6, SCAR_LIFE = 6.0, SCAR_EVERY = 1000;   // glowing cut trail: ring of strips, s / ms

export function createSentinels3D() {
  const group = new THREE.Group();
  group.name = 'sentinels3d';
  let threat = 0;                                  // 0 open air .. 1 full pursuit, eased
  // The docked cutter is a purpose-generated model in the wrapped, gripping
  // pose (public/sentinel/perched-a.glb): once the animated machine has
  // landed it hands off to this, which sits with its legs on the plating.
  const perched = new THREE.Group();
  perched.visible = false;
  group.add(perched);
  // Model-local (feet at y = 0, unscaled) geometry of the machine, filled in
  // from the loaded bbox: the height, and where its head/muzzle sits.
  let perchedScale = 1, perchedH = 100, perchedReady = false;
  let mdlH = 1, mdlHeadX = 0, mdlMuzzleY = 1;
  new GLTFLoader().load('/sentinel/perched-a.glb', (g) => {
    const m = g.scene;
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    perchedScale = PERCH.width / (Math.max(size.x, size.z) || 1);   // ~210 units across the leg spread
    m.position.set(-c.x, -box.min.y, -c.z);                    // feet on y = 0
    mdlH = size.y;
    mdlHeadX = PERCH.headX * size.x;                           // head centre, model units, local +x
    mdlMuzzleY = PERCH.muzzleY * size.y;                       // beam leaves the head's underside
    perchedH = size.y * perchedScale;
    if (import.meta.env?.DEV) console.log('[sentinels3d] perched-a bbox', size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3), '-> scale', perchedScale.toFixed(1), 'height', perchedH.toFixed(1), 'muzzle', (mdlMuzzleY * perchedScale).toFixed(1), 'headX', (mdlHeadX * perchedScale).toFixed(1));
    m.traverse((o) => { if (o.isMesh && o.material) { const mm = o.material; if ('roughness' in mm) mm.roughness = Math.max(mm.roughness ?? 0.6, 0.5); if ('metalness' in mm) mm.metalness = Math.max(mm.metalness ?? 0.5, 0.75); if ('envMapIntensity' in mm) mm.envMapIntensity = 0.6; o.castShadow = true; } });
    perched.add(m);
    perched.rotation.y = Math.PI;                              // its eye faces +X; the ship flies -X
    perchedReady = true;
  }, undefined, () => {});
  let attach = 0;                                  // 0 flying .. 1 resting on the armor, eased
  // Cutting beam + sparks (Points burst, allocation-free)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, fog: false,   // the machine must never occlude its own cut
  });
  const beamHazeMat = new THREE.MeshBasicMaterial({
    color: 0xbfe3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, fog: false, side: THREE.DoubleSide,
  });
  // Narrow: the cut is a few centimetres of plating away, not a ship gun.
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 5.2, 1, 10, 1, true), beamMat);
  beam.renderOrder = 20;
  beam.frustumCulled = false;
  const beamHaze = new THREE.Mesh(new THREE.CylinderGeometry(11, 15, 1, 10, 1, true), beamHazeMat);
  beamHaze.renderOrder = 19;
  beamHaze.frustumCulled = false;
  group.add(beam);
  group.add(beamHaze);
  const impact = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }));
  impact.renderOrder = 21;
  group.add(impact);
  // The molten weld: a disc lying FLAT on the plating under the core, so the
  // cut reads as burning into the surface rather than floating above it.
  const weld = new THREE.Mesh(new THREE.CircleGeometry(16, 20), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  weld.rotation.x = -Math.PI / 2;
  group.add(weld);
  // Contact shadow: a soft dark ellipse under the perched body, anchoring it.
  const contact = new THREE.Mesh(new THREE.CircleGeometry(PERCH.width * PERCH.shadow, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.scale.set(1, 1, 1.05);           // an ellipse matching the leg footprint (189 x 210)
  contact.visible = false;
  group.add(contact);
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
  const scarGeo = new THREE.PlaneGeometry(46, 5);   // short: the cut crawls, it does not slash
  const scars = [];
  for (let k = 0; k < SCAR_COUNT; k++) {
    const m = new THREE.Mesh(scarGeo, new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;   // lie flat, facing up
    m.visible = false;
    group.add(m);
    scars.push({ mesh: m, born: -1 });
  }
  let scarNext = 0, scarLastAt = -Infinity, perchedSc = 1;
  let sparkSeed = 1;
  const rnd = () => { sparkSeed = (sparkSeed * 16807) % 2147483647; return sparkSeed / 2147483647; };
  const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _muzzle = new THREE.Vector3(), _hit = new THREE.Vector3(), _head = new THREE.Vector3();
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
    const cut = Math.max(0.4, Math.min(1, opts.cut ?? 0.4));   // from the oldest blocker's age
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
          // Hand-off to the perched model once landed; the animated machine
          // hides so the two never overlap.
          const swap = perchedReady && land > 0.5;
          g.visible = !swap;
          perched.visible = swap;
          if (swap) {
            const k = (land - 0.5) * 2;
            const sc = perchedScale * (0.85 + 0.15 * k) * (1 + Math.sin(t / 900) * 0.01);
            perched.scale.setScalar(sc);
            perchedSc = sc;
            // SEATED: the model's feet are at y = 0 of its group, so dropping
            // the group below the plating sinks the leg tips into it - contact
            // reads as pressure, and there is no gap to see under the body.
            perched.position.set(dockX + Math.sin(t / 130) * 1.2, hullTopY(dockX) - PERCH.sink + Math.cos(t / 170) * 0.5, dockZ);
            perched.rotation.z = Math.sin(t / 2100) * 0.02;
          }
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
    // Cutting: continuous while attached, from the head's muzzle STRAIGHT DOWN
    // into the plating the machine is standing on - a short weld, not a ray.
    const cutting = attach > 0.5;
    // The weld point is DIRECTLY BENEATH THE HEAD, not off to one side: the
    // head's local +x offset, turned into the scene by the group's own
    // rotation, so the beam is short and near vertical (about 120 units, and
    // the machine is 210 across).
    let cutX, cutZ;
    if (perched.visible) {
      _head.set(mdlHeadX * perchedSc, 0, 0).applyEuler(perched.rotation);
      cutX = perched.position.x + _head.x + Math.sin(t / 1300) * 3;
      cutZ = perched.position.z + _head.z + Math.cos(t / 1700) * 2;
      _muzzle.set(cutX, perched.position.y + mdlMuzzleY * perchedSc, perched.position.z + _head.z);
    } else {
      cutX = dockX - 30 + Math.sin(t / 1300) * 4;
      cutZ = dockZ + 10 + Math.cos(t / 1700) * 3;
      _muzzle.set(20, -4, 0).multiplyScalar(cutterUnit.e.s).applyEuler(cutter.rotation).add(cutter.position);
    }
    _hit.set(cutX, hullTopY(cutX), cutZ);
    _dir.subVectors(_hit, _muzzle);
    const len = _dir.length();
    beam.position.copy(_muzzle).addScaledVector(_dir, 0.5);
    beam.scale.set(1, len, 1);
    beam.quaternion.setFromUnitVectors(_up, _dir.normalize());
    const on = cutting ? attach : 0;
    beamMat.opacity = on * cut * (0.80 + 0.20 * Math.abs(Math.sin(t / 45)));
    beamHazeMat.opacity = on * cut * (0.16 + 0.10 * Math.abs(Math.sin(t / 70)));
    beamHaze.position.copy(beam.position);
    beamHaze.scale.copy(beam.scale);
    beamHaze.quaternion.copy(beam.quaternion);
    impact.position.copy(_hit);
    impact.material.opacity = on * (0.5 + 0.4 * Math.abs(Math.sin(t / 40)));
    const is = cutting ? 0.9 + 0.5 * Math.abs(Math.sin(t / 60)) : 0.001;
    impact.scale.set(is, is, is);
    // Molten pool flat on the plating, pulsing with the cut.
    weld.position.set(_hit.x, _hit.y + 0.5, _hit.z);
    weld.material.opacity = on * cut * (0.32 + 0.3 * Math.abs(Math.sin(t / 55)));
    const ws = cutting ? 0.8 + 0.3 * Math.abs(Math.sin(t / 90)) : 0.001;
    weld.scale.set(ws, ws, ws);
    // Contact shadow: anchors the body to the plating it is standing on.
    contact.visible = perched.visible;
    if (contact.visible) {
      contact.position.set(perched.position.x, hullTopY(perched.position.x) + 1, perched.position.z);
      contact.material.opacity = 0.5 * Math.min(1, (attach - 0.5) * 2);
    }
    impactLight.position.copy(_hit).add(_lightOff);
    impactLight.intensity = on * cut * (60000 + 40000 * Math.abs(Math.sin(t / 50)));
    // Sparks: a steady spray off the weld point, fall under gravity, die
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt;
        sparkVel[i * 3 + 1] -= 900 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt; sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
        // They land back on the plating and skitter rather than falling through it.
        if (sparkPos[i * 3 + 1] < _hit.y && sparkVel[i * 3 + 1] < 0) {
          sparkPos[i * 3 + 1] = _hit.y;
          sparkVel[i * 3 + 1] *= -0.25;
          sparkVel[i * 3] *= 0.7; sparkVel[i * 3 + 2] *= 0.7;
        }
        if (sparkLife[i] <= 0) { sparkPos[i * 3 + 1] = -99999; }
      } else if (cutting && rnd() < 0.07 * cut) {
        sparkLife[i] = 0.35 + rnd() * 0.5;
        sparkPos[i * 3] = _hit.x; sparkPos[i * 3 + 1] = _hit.y; sparkPos[i * 3 + 2] = _hit.z;
        // Spray ALONG the plating: mostly sideways off the weld, only a modest
        // lift, so they skitter across the armour instead of flying into space.
        const ang = rnd() * Math.PI * 2, sp = 240 + rnd() * 320;
        sparkVel[i * 3] = Math.cos(ang) * sp; sparkVel[i * 3 + 1] = 50 + rnd() * 150; sparkVel[i * 3 + 2] = Math.sin(ang) * sp * 0.85;
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
