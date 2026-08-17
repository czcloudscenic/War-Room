// ── Sentinel-class patrol machines ───────────────────────────────────────────
// Large ORIGINAL hunter-killer machines patrolling around the hull (our own
// design — squid-machine archetype, no film-machine likeness): armored head
// with a glowing eye cluster, eight long articulated tentacles that trail and
// writhe behind them, blinking nav light, a sweeping searchlight. Built to
// TRUE sentinel scale — the head alone is bigger than a crew member (humans
// are ~130 logical units in this world). Deterministic parametric flight
// paths in the painting's sky and city bands; one slow foreground crossing so
// depth reads. Pure three.js, no per-frame allocations, everything from t.

import * as THREE from 'three';

const toX = (lx) => lx - 640;
const toY = (ly) => 360 - ly;

// Flight paths in logical art coords — BACKGROUND ONLY: the storm sky above
// the hull and the city band below it. They never cross the ship interior;
// they're distant machines prowling around it (smaller + low z = depth).
const PATHS = [
  { cx: 200, cy: 72, rx: 140, ry: 10, period: 36000, phase: 0.0, z: 2.5, s: 0.5 },  // high sky, off the nose
  { cx: 1000, cy: 64, rx: 170, ry: 10, period: 46000, phase: 2.1, z: 2, s: 0.42 },  // high sky, stern side
  { cx: 640, cy: 46, rx: 430, ry: 8, period: 70000, phase: 1.2, z: 1.5, s: 0.34 },  // far crosser along the storm line
  { cx: 260, cy: 668, rx: 180, ry: 10, period: 40000, phase: 4.0, z: 2.5, s: 0.45 },// low over the city, under the bow
];

const TENTACLES = 8;
const SEGMENTS = 7;
const SEG_LEN = 16;

function makeTentacle(mat) {
  // Chain of tapered segments, each pivoting at its top — sway cascades down.
  const root = new THREE.Group();
  const segs = [];
  let parent = root;
  for (let j = 0; j < SEGMENTS; j++) {
    const r1 = 2.4 * (1 - j / SEGMENTS) + 0.4;
    const r2 = 2.4 * (1 - (j + 1) / SEGMENTS) + 0.35;
    const geo = new THREE.CylinderGeometry(r2, r1, SEG_LEN, 6);
    geo.translate(0, -SEG_LEN / 2, 0); // pivot at the top of the segment
    const seg = new THREE.Mesh(geo, mat);
    if (j > 0) seg.position.y = -SEG_LEN;
    parent.add(seg);
    segs.push(seg);
    parent = seg;
  }
  // barbed tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 5), mat);
  tip.geometry.translate(0, -3, 0);
  tip.position.y = -SEG_LEN;
  parent.add(tip);
  return { root, segs };
}

function buildSentinel(scale) {
  const g = new THREE.Group();
  // Lifted toward the storm-cloud gray — atmospheric haze so distant machines
  // read as shapes in the weather, not black blobs pasted on it.
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.45, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e2632, roughness: 0.6, metalness: 0.55 });

  // armored head — flattened, faces +x
  const head = new THREE.Mesh(new THREE.SphereGeometry(15, 14, 12), hullMat);
  head.scale.set(1.4, 0.95, 1.05);
  g.add(head);
  // dorsal ridge plate
  const ridge = new THREE.Mesh(new THREE.SphereGeometry(11, 10, 8), darkMat);
  ridge.scale.set(1.5, 0.55, 0.8);
  ridge.position.set(-2, 8.5, 0);
  g.add(ridge);
  // side pods
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(5.5, 8, 8), darkMat);
    pod.scale.set(1.4, 0.8, 0.8);
    pod.position.set(-4, -1, side * 14);
    g.add(pod);
  }

  // eye cluster — two arcs of cyan eyes + one central hunter eye
  const eyes = [];
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true });
  for (let k = 0; k < 6; k++) {
    const a = (k / 5 - 0.5) * 1.7;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 8), eyeMat.clone());
    eye.position.set(18.5, 2.5 + Math.cos(a) * -4.5 + 3.5, Math.sin(a) * 9);
    g.add(eye);
    eyes.push(eye);
  }
  const hunterEye = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff453a, transparent: true }));
  hunterEye.position.set(19.5, -2.5, 0);
  g.add(hunterEye);

  // eight tentacles fanned around the rear underside, trailing toward -x
  const tentacles = [];
  for (let k = 0; k < TENTACLES; k++) {
    const a = (k / TENTACLES) * Math.PI * 2;
    const t = makeTentacle(k % 2 ? hullMat : darkMat);
    t.root.position.set(-9, Math.cos(a) * 4.5 - 3, Math.sin(a) * 9);
    t.base = -0.55 + Math.cos(a) * 0.18; // trail backward, slightly fanned
    t.root.rotation.x = Math.sin(a) * 0.3; // fan across depth
    t.phase = a * 1.7;
    g.add(t.root);
    tentacles.push(t);
  }

  // nav blink + searchlight
  const nav = new THREE.Mesh(new THREE.SphereGeometry(1.3, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff453a, transparent: true }));
  nav.position.set(-6, 12, 0);
  g.add(nav);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(20, 100, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.position.set(6, -55, 0);
  g.add(beam);

  g.scale.setScalar(scale);
  g.userData = { eyes, hunterEye, nav, beam, tentacles };
  return g;
}

// One sentinel is ON the ship — hovering tight over the stern hull, firing
// laser bursts at the plating, trying to cut its way in. Nothing crazy: a
// thin red beam in bursts + a flickering impact glow.
const ATTACK = {
  hover: { x: 838, y: 95 },   // where it holds position, just off the hull top
  impact: { x: 895, y: 168 }, // where the beam hits the plating
  s: 0.55, z: 3.5,
};

export function createDrones() {
  const group = new THREE.Group();
  const drones = PATHS.map((p) => {
    const d = buildSentinel(p.s);
    d.position.z = p.z;
    group.add(d);
    return { g: d, p };
  });

  // the attacker + its laser rig (beam and glow live in world space)
  const attacker = buildSentinel(ATTACK.s);
  attacker.position.set(toX(ATTACK.hover.x), toY(ATTACK.hover.y), ATTACK.z);
  group.add(attacker);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff5340, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const laser = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 1, 6, 1, true), beamMat);
  group.add(laser);
  const impactGlow = new THREE.Mesh(
    new THREE.SphereGeometry(7, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffa270, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  impactGlow.position.set(toX(ATTACK.impact.x), toY(ATTACK.impact.y), ATTACK.z);
  group.add(impactGlow);
  const _muzzle = new THREE.Vector3();
  const _hit = new THREE.Vector3(toX(ATTACK.impact.x), toY(ATTACK.impact.y), ATTACK.z);
  const _dir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  function updateAttacker(t) {
    const g = attacker;
    // agitated hover: tight lissajous drift + bob, always facing the hull
    g.position.x = toX(ATTACK.hover.x) + Math.sin(t / 1400) * 6;
    g.position.y = toY(ATTACK.hover.y) + Math.cos(t / 1900) * 4 + Math.sin(t / 800) * 2;
    g.rotation.y = 0; // impact is to its +x
    g.rotation.z = -0.35 + Math.sin(t / 1100) * 0.05; // pitched down toward the plating
    const ud = g.userData;
    ud.nav.material.opacity = (Math.sin(t / 220) > 0.4) ? 0.95 : 0.1;
    ud.hunterEye.material.opacity = 0.75 + 0.25 * Math.sin(t / 240);
    for (let e = 0; e < ud.eyes.length; e++) {
      ud.eyes[e].material.opacity = 0.8 + 0.2 * Math.sin(t / 200 + e * 0.9);
    }
    ud.beam.material.opacity = 0; // no searchlight — it's busy
    for (let k = 0; k < ud.tentacles.length; k++) {
      const tt = ud.tentacles[k];
      for (let j = 0; j < tt.segs.length; j++) {
        tt.segs[j].rotation.z = (j === 0 ? tt.base : -0.08)
          + Math.sin(t / 420 + tt.phase + j * 0.55) * (0.13 + j * 0.025); // agitated writhe
        tt.segs[j].rotation.x = Math.sin(t / 900 + tt.phase * 1.3 + j * 0.4) * 0.08;
      }
    }
    // laser bursts: ~1.4s on, ~2.4s off, with a fast cutting flicker while on
    const firing = (t % 3800) < 1400;
    _muzzle.set(g.position.x + 10, g.position.y - 4, ATTACK.z);
    _dir.subVectors(_hit, _muzzle);
    const len = _dir.length();
    laser.position.copy(_muzzle).addScaledVector(_dir, 0.5);
    laser.scale.set(1, len, 1);
    laser.quaternion.setFromUnitVectors(_up, _dir.normalize());
    laser.material.opacity = firing ? 0.35 + 0.3 * Math.abs(Math.sin(t / 55)) : 0;
    impactGlow.material.opacity = firing ? 0.3 + 0.3 * Math.abs(Math.sin(t / 45)) : 0;
    const s = firing ? 0.8 + 0.45 * Math.abs(Math.sin(t / 70)) : 0.001;
    impactGlow.scale.set(s, s, s);
  }

  function update(t) {
    updateAttacker(t);
    for (let i = 0; i < drones.length; i++) {
      const { g, p } = drones[i];
      const a = (t / p.period) * Math.PI * 2 + p.phase;
      const lx = p.cx + Math.sin(a) * p.rx;
      const ly = p.cy + Math.sin(a * 2 + p.phase) * p.ry;
      const prevX = g.position.x;
      g.position.x = toX(lx);
      g.position.y = toY(ly) + Math.sin(t / 1100 + i * 2) * 3; // heavy hover bob
      const dx = g.position.x - prevX;
      g.rotation.y = dx >= 0 ? 0 : Math.PI;            // face travel
      g.rotation.z = THREE.MathUtils.clamp(-dx * 0.05, -0.22, 0.22); // bank
      const ud = g.userData;
      ud.nav.material.opacity = (Math.sin(t / 300 + i * 1.7) > 0.55) ? 0.95 : 0.1;   // nav blink
      ud.hunterEye.material.opacity = 0.55 + 0.45 * Math.sin(t / 480 + i);            // hunter eye pulse
      for (let e = 0; e < ud.eyes.length; e++) {
        ud.eyes[e].material.opacity = 0.75 + 0.25 * Math.sin(t / 340 + i + e * 0.9);  // cluster shimmer
      }
      ud.beam.material.opacity = 0.03 + 0.018 * Math.sin(t / 1900 + i);
      ud.beam.rotation.x = Math.sin(t / 6000 + i * 2.4) * 0.25;                       // sweeping search
      for (let k = 0; k < ud.tentacles.length; k++) {
        const tt = ud.tentacles[k];
        for (let j = 0; j < tt.segs.length; j++) {
          // sway cascades down each tentacle with a travelling wave + slow curl
          tt.segs[j].rotation.z = (j === 0 ? tt.base : -0.08)
            + Math.sin(t / 700 + tt.phase + j * 0.55 + i * 2) * (0.1 + j * 0.022);
          tt.segs[j].rotation.x = Math.sin(t / 1300 + tt.phase * 1.3 + j * 0.4) * 0.06;
        }
      }
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
