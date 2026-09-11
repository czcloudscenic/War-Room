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
  // Under the bow, in the lower band left of the under-hull glow (the camera
  // frames x -580..820 at hull depth; anything further left is off screen).
  { name: 'bow-low',    x: -560, y: HULL_3D.yBottom - 90, z: -120, s: 2.5, drift: 34, period: 11000, phase: 2.2 },
  { name: 'far-cross',  x: 0, y: 160, z: -720, s: 1.4, drift: 0, period: 34000, phase: 1.1, cross: true },
];
// The close pass: enters stage right in front of the hull, exits left.
const PASS = { every: 38000, duration: 1900, z: 620, y: 40, s: 3.4, x0: 1500, x1: -1500 };

export function createSentinels3D() {
  const group = new THREE.Group();
  group.name = 'sentinels3d';
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

  function update(t) {
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
        const a = t / e.period * Math.PI * 2 + e.phase;
        g.position.x = e.x + Math.sin(a) * e.drift;
        g.position.y = e.y + Math.sin(a * 2 + e.phase) * e.drift * 0.35 + Math.sin(t / 900 + i) * 4;
        g.position.z = e.z + Math.cos(a) * e.drift * 0.3;
        g.rotation.y = Math.PI;
        g.rotation.z = Math.cos(a) * 0.12;   // bank into the drift
        g.rotation.x = Math.sin(a * 2) * 0.05;
      }
      animateBody(g, t, i);
    }
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

  return { group, update, getContacts, dispose };
}
