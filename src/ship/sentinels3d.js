// ── sentinels3d.js ───────────────────────────────────────────────────────────
// Sentinel machines around the FLYING hull (the modeled world, scene coords).
// Same original squid-machine design as drones.js (shared builder), but flown
// as an escort: they hold loose formation with the ship, drift, bank, sweep
// searchlights across the plating, and one of them makes a close foreground
// pass every so often. Scale is true to the crew: a head is wider than a
// person is tall. Pure three.js; no per-frame allocations.
//
//   const s = createSentinels3D();
//   scene.add(s.group);         // NOT under the ship rig: they move relative to the banking hull
//   s.update(t /* ms */);
//   s.getContacts(out)          // fills out with {x, z, kind} for the radar
//   s.dispose();

import * as THREE from 'three';
import { buildSentinel } from './drones.js';
import { HULL_3D } from './scene3dContract.js';

// Escort slots in scene space. The ship flies toward -X; heads face -X.
const ESCORTS = [
  { name: 'stern-high', x: 590, y: HULL_3D.yTop + 45, z: -60, s: 2.2, drift: 40, period: 9000, phase: 0.0 },
  // tight = where each escort holds under pursuit (always OUTSIDE the hull)
  // Under the bow, in the lower band left of the under-hull glow (the camera
  // frames x -580..820 at hull depth; anything further left is off screen).
  { name: 'bow-low',    x: -560, y: HULL_3D.yBottom - 90, z: -120, s: 2.5, drift: 34, period: 11000, phase: 2.2, tight: { x: -440, y: HULL_3D.yBottom - 40, z: -60 } },
  { name: 'far-cross',  x: 0, y: 160, z: -720, s: 1.4, drift: 0, period: 34000, phase: 1.1, cross: true },
];
// The close pass: enters stage right in front of the hull, exits left.
const PASS = { every: 38000, duration: 1900, z: 620, y: 40, s: 3.4, x0: 1500, x1: -1500 };
// Pursuit ("Final Flight of the Osiris"): inside a tunnel the escorts tighten
// onto the hull and the stern-high machine docks on the plating and cuts.
const PURSUIT = {
  tighten: 0.55,                                  // escorts move this fraction of the way to the hull
  dock: { x: 470, y: HULL_3D.yTop + 20, z: 30 }, // where the cutter holds
  cut: { x: 500, y: HULL_3D.yTop + 2, z: 40 },   // where the beam hits the armor
};

export function createSentinels3D() {
  const group = new THREE.Group();
  group.name = 'sentinels3d';
  let threat = 0;                                  // 0 open air .. 1 full pursuit, eased
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
  let sparkSeed = 1;
  const rnd = () => { sparkSeed = (sparkSeed * 16807) % 2147483647; return sparkSeed / 2147483647; };
  const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _muzzle = new THREE.Vector3(), _hit = new THREE.Vector3(PURSUIT.cut.x, PURSUIT.cut.y, PURSUIT.cut.z);
  let lastT = null;
  const units = ESCORTS.map((e) => {
    const g = buildSentinel(e.s);
    g.position.set(e.x, e.y, e.z);
    g.rotation.y = Math.PI; // face -X (direction of flight)
    group.add(g);
    return { g, e };
  });
  const passer = buildSentinel(PASS.s);
  passer.visible = false;
  group.add(passer);

  function animateBody(g, t, i, agitation = 1) {
    const ud = g.userData;
    ud.nav.material.opacity = (Math.sin(t / 300 + i * 1.7) > 0.55) ? 0.95 : 0.1;
    ud.hunterEye.material.opacity = 0.55 + 0.45 * Math.sin(t / 480 + i);
    for (let e = 0; e < ud.eyes.length; e++) ud.eyes[e].material.opacity = 0.75 + 0.25 * Math.sin(t / 340 + i + e * 0.9);
    ud.beam.material.opacity = 0.05 + 0.03 * Math.sin(t / 1900 + i);
    ud.beam.rotation.x = Math.sin(t / 5200 + i * 2.4) * 0.35;     // searchlight sweeps the plating
    ud.beam.rotation.z = 0.55 + Math.sin(t / 7100 + i) * 0.25;
    for (let k = 0; k < ud.tentacles.length; k++) {
      const tt = ud.tentacles[k];
      for (let j = 0; j < tt.segs.length; j++) {
        // Trailing in the slipstream: a travelling wave down each arm, faster
        // and wider than the painting's idle writhe.
        tt.segs[j].rotation.z = (j === 0 ? tt.base : -0.10)
          + Math.sin(t / (520 / agitation) + tt.phase + j * 0.6 + i * 2) * (0.12 + j * 0.028);
        tt.segs[j].rotation.x = Math.sin(t / 1100 + tt.phase * 1.3 + j * 0.4) * 0.07;
      }
    }
  }

  function update(t, opts = {}) {
    const dt = lastT == null ? 0.016 : Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    const want = opts.enclosed ? 1 : 0;
    threat += (want - threat) * Math.min(1, dt * (want ? 0.9 : 0.5));
    for (let i = 0; i < units.length; i++) {
      const { g, e } = units[i];
      if (e.cross) {
        // Far machine overtaking on a long line, then looping back out of frame.
        const p = ((t + e.phase * 1000) % e.period) / e.period;
        g.position.x = 1100 - p * 2200;
        g.position.y = e.y + Math.sin(t / 2300) * 20;
        g.rotation.y = Math.PI;
        g.rotation.z = -0.06;
      } else {
        // Loose formation: a slow lissajous drift around the slot + hover bob.
        // Under threat the slot slides toward the hull (tighten) and the stern
        // machine docks on the plating and holds.
        const a = t / e.period * Math.PI * 2 + e.phase;
        const docking = e.name === 'stern-high' ? threat : 0;
        const tight = e.tight || e;
        const tx = e.x + (tight.x - e.x) * threat * (1 - docking) + (PURSUIT.dock.x - e.x) * docking;
        const ty = e.y + (tight.y - e.y) * threat * (1 - docking) + (PURSUIT.dock.y - e.y) * docking;
        const tz = e.z + (tight.z - e.z) * threat * (1 - docking) + (PURSUIT.dock.z - e.z) * docking;
        const drift = e.drift * (1 - 0.8 * docking);
        g.position.x = tx + Math.sin(a) * drift + Math.sin(t / 130) * 2.5 * docking;
        g.position.y = ty + Math.sin(a * 2 + e.phase) * drift * 0.35 + Math.sin(t / 900 + i) * 4 * (1 - docking) + Math.cos(t / 170) * 2 * docking;
        g.position.z = tz + Math.cos(a) * drift * 0.3;
        g.rotation.y = Math.PI;
        g.rotation.z = Math.cos(a) * 0.12 * (1 - docking) - 0.55 * docking;   // bank into the drift; pitch down to cut
        g.rotation.x = Math.sin(a * 2) * 0.05;
      }
      animateBody(g, t, i, 1 + threat * 1.4);
    }
    // Cutting: the docked machine fires in bursts; sparks fly off the armor.
    const cutter = units.find(u => u.e.name === 'stern-high')?.g;
    const cutting = threat > 0.85 && cutter && ((t % 3200) < 1500);
    if (cutter) {
      _muzzle.set(cutter.position.x - 10, cutter.position.y - 14, cutter.position.z);
      _dir.subVectors(_hit, _muzzle);
      const len = _dir.length();
      beam.position.copy(_muzzle).addScaledVector(_dir, 0.5);
      beam.scale.set(1, len, 1);
      beam.quaternion.setFromUnitVectors(_up, _dir.normalize());
    }
    beamMat.opacity = cutting ? 0.55 + 0.35 * Math.abs(Math.sin(t / 45)) : 0;
    impact.position.copy(_hit);
    impact.material.opacity = cutting ? 0.5 + 0.4 * Math.abs(Math.sin(t / 40)) : 0;
    const is = cutting ? 0.9 + 0.5 * Math.abs(Math.sin(t / 60)) : 0.001;
    impact.scale.set(is, is, is);
    impactLight.position.copy(_hit).add(new THREE.Vector3(0, 30, 40));
    impactLight.intensity = cutting ? 60000 + 40000 * Math.abs(Math.sin(t / 50)) : 0;
    // Sparks: spawn while cutting, fall under gravity, die
    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] > 0) {
        sparkLife[i] -= dt;
        sparkVel[i * 3 + 1] -= 900 * dt;
        sparkPos[i * 3] += sparkVel[i * 3] * dt; sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
        if (sparkLife[i] <= 0) { sparkPos[i * 3 + 1] = -99999; }
      } else if (cutting && rnd() < 0.25) {
        sparkLife[i] = 0.35 + rnd() * 0.5;
        sparkPos[i * 3] = _hit.x; sparkPos[i * 3 + 1] = _hit.y; sparkPos[i * 3 + 2] = _hit.z;
        const ang = rnd() * Math.PI * 2, sp = 180 + rnd() * 260;
        sparkVel[i * 3] = Math.cos(ang) * sp; sparkVel[i * 3 + 1] = 120 + rnd() * 320; sparkVel[i * 3 + 2] = Math.sin(ang) * sp * 0.6 + 80;
      } else if (sparkLife[i] < 0) { sparkPos[i * 3 + 1] = -99999; }
    }
    sparkGeo.attributes.position.needsUpdate = true;
    // Close pass
    const cycle = t % PASS.every;
    if (cycle < PASS.duration) {
      const p = cycle / PASS.duration;
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      passer.visible = true;
      passer.position.set(PASS.x0 + (PASS.x1 - PASS.x0) * ease, PASS.y + Math.sin(p * Math.PI) * 60, PASS.z);
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
