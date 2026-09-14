// ── lightShafts.js ───────────────────────────────────────────────────────────
// Cheap volumetrics for the cutaway: a soft additive cone under each room lamp
// (light falling through the air), and dust motes drifting in the bays. Both
// are scenery: they never claim anything about the agents. Pure three.js,
// no per-frame allocation.
//
//   const shafts = createLightShafts({ rooms, lampY, lampZ });
//   rig.add(shafts.group); shafts.update(t); shafts.dispose();

import * as THREE from 'three';
import { WALK_Z, ROOM_DEPTH } from './scene3dContract.js';

function makeShaftTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  // Bright at the lamp, fading to nothing at the floor; soft edges.
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,255,255,0.42)'); v.addColorStop(0.55, 'rgba(255,255,255,0.14)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v; g.fillRect(0, 0, 128, 256);
  const h = g.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.25, 'rgba(0,0,0,0)'); h.addColorStop(0.75, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

export function createLightShafts({ rooms, lampDrop = 30, lampZ = WALK_Z + 14 } = {}) {
  const group = new THREE.Group();
  group.name = 'lightShafts';
  const tex = makeShaftTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xa9c4e0, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shafts = [];
  for (const r of rooms) {
    const h = (r.ceil - r.floor) - lampDrop;
    // Two crossed cards make the cone read from the front and in fly-ins.
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.PlaneGeometry(r.w * 0.62, h);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(r.cx, r.floor + h / 2, lampZ - 30);
      m.rotation.y = k === 0 ? 0 : Math.PI / 2;
      m.renderOrder = 5;
      group.add(m);
      shafts.push({ m, phase: (r.cx * 0.01) % 6.28 });
    }
  }
  // Dust motes: one Points cloud across the whole cutaway.
  const N = 900;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const x0 = Math.min(...rooms.map(r => r.x0)), x1 = Math.max(...rooms.map(r => r.x1));
  const y0 = Math.min(...rooms.map(r => r.floor)), y1 = Math.max(...rooms.map(r => r.ceil));
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    pos[i * 3] = x0 + rnd() * (x1 - x0); pos[i * 3 + 1] = y0 + rnd() * (y1 - y0); pos[i * 3 + 2] = WALK_Z - ROOM_DEPTH + rnd() * ROOM_DEPTH;
    vel[i * 3] = (rnd() - 0.5) * 6; vel[i * 3 + 1] = -2 - rnd() * 5; vel[i * 3 + 2] = (rnd() - 0.5) * 3;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfdcee, size: 1.6, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  motes.frustumCulled = false;
  group.add(motes);
  let lastT = null;
  function update(t) {
    const dt = lastT == null ? 0.016 : Math.min(0.1, (t - lastT) / 1000); lastT = t;
    for (const s of shafts) s.m.material.opacity = 0.085 + 0.02 * Math.sin(t / 1900 + s.phase);
    for (let i = 0; i < N; i++) {
      pos[i * 3] += (vel[i * 3] + Math.sin(t / 1300 + i) * 2) * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < y0) pos[i * 3 + 1] = y1;
      if (pos[i * 3] < x0) pos[i * 3] = x1; else if (pos[i * 3] > x1) pos[i * 3] = x0;
    }
    geo.attributes.position.needsUpdate = true;
  }
  function dispose() { tex.dispose(); mat.dispose(); geo.dispose(); motes.material.dispose(); group.clear(); }
  return { group, update, dispose };
}
