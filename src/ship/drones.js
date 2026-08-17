// ── Patrol drones — the ship's escorts ───────────────────────────────────────
// Small ORIGINAL patrol machines drifting around the hull (our own design —
// no film-machine likenesses): dark capsule bodies, a cyan eye, blinking nav
// lights, a faint searchlight cone. Deterministic parametric flight paths in
// the painting's sky and city bands; one occasionally crosses in front of the
// hull with a scale-up so depth reads. Pure three.js, no allocations per
// frame, everything from t.

import * as THREE from 'three';

const toX = (lx) => lx - 640;
const toY = (ly) => 360 - ly;

// Flight paths in logical art coords: [cx, cy, radiusX, radiusY, period(ms), phase, z, scale]
const PATHS = [
  { cx: 190, cy: 120, rx: 150, ry: 26, period: 26000, phase: 0.0, z: 6, s: 0.7 },   // upper sky, over the nose
  { cx: 1020, cy: 95, rx: 190, ry: 22, period: 34000, phase: 2.1, z: 5, s: 0.6 },   // upper sky, stern side
  { cx: 250, cy: 640, rx: 210, ry: 18, period: 30000, phase: 4.0, z: 7, s: 0.55 },  // low over the city, port side
  { cx: 640, cy: 320, rx: 520, ry: 40, period: 58000, phase: 1.2, z: 13, s: 1.15 }, // slow foreground crossing
];

function buildDrone(scale) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(4.2, 7, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.6, metalness: 0.55 })
  );
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(6, 1.1, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x0f1218, roughness: 0.7, metalness: 0.4 })
  );
  fin.position.set(-4.5, 2.5, 0);
  fin.rotation.z = 0.5;
  g.add(fin);
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x2aabff })
  );
  eye.position.set(6.2, 0, 0);
  g.add(eye);
  const nav = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xff453a, transparent: true })
  );
  nav.position.set(-5.5, -1.2, 0);
  g.add(nav);
  // searchlight cone, additive and faint
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(9, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.position.set(2, -24, 0);
  g.add(beam);
  g.scale.setScalar(scale);
  g.userData = { eye, nav, beam };
  return g;
}

export function createDrones() {
  const group = new THREE.Group();
  const drones = PATHS.map((p) => {
    const d = buildDrone(p.s);
    d.position.z = p.z;
    group.add(d);
    return { g: d, p };
  });

  function update(t) {
    for (let i = 0; i < drones.length; i++) {
      const { g, p } = drones[i];
      const a = (t / p.period) * Math.PI * 2 + p.phase;
      const lx = p.cx + Math.sin(a) * p.rx;
      const ly = p.cy + Math.sin(a * 2 + p.phase) * p.ry;
      const prevX = g.position.x;
      g.position.x = toX(lx);
      g.position.y = toY(ly) + Math.sin(t / 900 + i * 2) * 2.2; // hover bob
      const dx = g.position.x - prevX;
      g.rotation.y = dx >= 0 ? 0 : Math.PI;            // face travel
      g.rotation.z = THREE.MathUtils.clamp(-dx * 0.06, -0.28, 0.28); // bank
      const ud = g.userData;
      ud.nav.material.opacity = (Math.sin(t / 260 + i * 1.7) > 0.55) ? 0.95 : 0.12; // nav blink
      ud.beam.material.opacity = 0.035 + 0.02 * Math.sin(t / 1700 + i);
      ud.beam.rotation.x = Math.sin(t / 5200 + i * 2.4) * 0.22;  // sweeping search
    }
  }

  function dispose() {
    group.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
    group.clear();
  }

  return { group, update, dispose };
}
