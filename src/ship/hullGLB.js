// ── hullGLB.js ───────────────────────────────────────────────────────────────
// The generated exterior hull (Meshy image-to-3D from Christian's reference,
// 9/11: armored plated hovercraft, forward cockpit block, cyan ring hover pads,
// antenna masts, twin turret). It replaces the procedural box shell in the
// modeled world: scaled to the hull contract (length 1200 along X, nose at
// -X), and CUT AWAY on the camera side with a clipping plane so the procedural
// decks and rooms inside stay visible. The renderer needs localClippingEnabled.
//
//   const hull = createHullGLB({ onReady });
//   rig.add(hull.group); hull.update(t); hull.dispose();

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HULL_3D } from './scene3dContract.js';

export const HULL_URL = '/hull/hull.glb';
// The exterior must be BIGGER than the room block, or the cutaway window
// removes almost all of it: 1.22x the contract length puts the nose block and
// stern beyond the decks and the top armor and pad carriage outside the cut.
const LENGTH = (HULL_3D.x1 - HULL_3D.x0) * 1.22;   // 1464
// The cutaway is a WINDOW, not a half: five planes with clipIntersection
// remove only fragments inside the box (x0..x1, y0..y1, z > zBack), so the
// nose block, stern, top armor, keel and hover pads all survive and the rooms
// show through the opening. The rooms' own back panel closes the window.
const CUT = { x0: -556, x1: 598, y0: -198, y1: 252, zBack: -150 };
const PAD = { color: 0x2aabff, base: 0.55, pulse: 0.35 };

export function createHullGLB({ onReady } = {}) {
  const group = new THREE.Group();
  group.name = 'hullGLB';
  // Plane convention: a fragment is clipped where dot(normal, p) + constant < 0.
  // With clipIntersection, it is removed only when that holds for EVERY plane,
  // so each plane's clipped half-space must be the INSIDE of the box.
  const clip = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -CUT.x1),    // x - x1 < 0  : x < x1
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), CUT.x0),    // -x + x0 < 0 : x > x0
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -CUT.y1),    // y < y1
    new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT.y0),    // y > y0
    new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT.zBack), // -z + zBack < 0 : z > zBack
  ];
  const mats = [];
  let disposed = false;
  let ready = false;

  new GLTFLoader().load(HULL_URL, (gltf) => {
    if (disposed) return;
    const model = gltf.scene;
    // Normalize: center, scale to the contract length, nose toward -X.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const s = LENGTH / (size.x || 1);
    // The generation puts the cockpit block at +X; the contract wants the
    // nose at -X, so the model is turned about Y (symmetry was on, so both
    // flanks carry the outrigger rings).
    model.position.set(-c.x, -c.y, -c.z);
    const turn = new THREE.Group();
    turn.rotation.y = Math.PI;
    turn.add(model);
    // Taller than true proportion (1.32x in Y) so a real band of plating
    // survives above the top deck and below the lower one; a true-scale hull
    // is only 70 units taller than the room block and the cut ate it all.
    const wrap = new THREE.Group();
    wrap.scale.set(s, s * 1.32, s * 1.05);
    wrap.position.set(0, 30, -60);
    wrap.add(turn);
    model.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      // FrontSide on purpose: through the window we must NOT see the inside of
      // the shell (a grey cavity); with back faces culled the rooms' own back
      // panel closes the view instead.
      m.side = THREE.FrontSide;
      m.clippingPlanes = clip;
      m.clipIntersection = true;
      m.clipShadows = true;
      if (m.color) m.color.multiplyScalar(1.35);   // the bake is very dark; lift it toward the key
      if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 0.6, 0.74);
      if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0.4, 0.28);
      // The pads are the cyan parts of the base color: drive emissive from the
      // same map, tinted cyan, so plating stays matte and rings glow.
      if ('emissive' in m && m.map) {
        m.emissive = new THREE.Color(PAD.color);
        m.emissiveMap = m.map;
        m.emissiveIntensity = PAD.base;
      }
      o.castShadow = true; o.receiveShadow = true;
      mats.push(m);
    });
    group.add(wrap);
    ready = true;
    onReady?.({ size: size.clone().multiplyScalar(s) });
  }, undefined, () => { /* missing hull: the procedural shell stays */ });

  function update(t) {
    if (!ready) return;
    const k = PAD.base + PAD.pulse * (0.5 + 0.5 * Math.sin(t / 900));
    for (const m of mats) if ('emissiveIntensity' in m) m.emissiveIntensity = k;
  }
  function dispose() {
    disposed = true;
    group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose?.(); } });
    group.clear();
  }
  return { group, update, dispose, get ready() { return ready; } };
}
