// ── Agent Ship crew models ────────────────────────────────────────────────────
// Procedural low-poly crew figures for the cinematic 2.5D ship scene.
// Original stylized humans in a long-dark-coat silhouette (no film likenesses):
// dark charcoal wardrobe that reads as a silhouette against the painted ship,
// with a single emissive rim + visor strip in the agent's brand color.
//
// Pure ES module: three.js only. No React, no DOM requirement (the name-tag
// canvas is skipped gracefully outside a browser), no Math.random — every
// per-figure variation derives from a hash of the agent's name, so replays
// and multi-mount renders are stable.
//
//   const fig = createAgentFigure({ name, color, future });
//   scene.add(fig.group);            // group origin = FEET center
//   fig.update(sprite, t);           // sprite from shipEngine.getSprites(), t = ms
//   fig.dispose();

import * as THREE from 'three';

// ── Palette / proportions (world units; figure stands ~34 tall) ──────────────
const COAT_COLOR = 0x12151c;
const HEAD_COLOR = 0x1a1e27;
const LIMB_COLOR = 0x0e1118;
const STATUS_GREEN = 0x37ff8b;
const STATUS_GRAY = 0x3a4150;

const H = {
  hipY: 15,        // leg pivot height
  legLen: 15,
  shoulderY: 25.5, // arm pivot height
  upperArm: 6,
  foreArm: 5.5,
  headY: 30.4,     // head center
  tagY: 41,
  lightY: 36.5,
};

const LOWER_DECK_SCALE = 38 / 34; // deck 1 (nearer camera) figures read larger
const FUTURE_OPACITY = 0.3;

// FNV-1a name hash → stable phase offset so crew never move in lockstep.
function hashName(name) {
  let h = 2166136261;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Name-tag texture: 24px Geist Mono in the agent color on transparent bg.
// Returns null in non-DOM environments (headless tests) — the tag sprite
// simply renders as a blank transparent sprite there.
function makeNameTexture(name, color) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '24px "Geist Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(String(name || '').toUpperCase(), canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function makeMat(colorHex, { emissive = 0x000000, emissiveIntensity = 0, future = false } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.85,
    metalness: 0.1,
    emissive,
    emissiveIntensity,
    flatShading: true,
  });
  if (future) {
    m.transparent = true;
    m.opacity = FUTURE_OPACITY;
  }
  return m;
}

export function createAgentFigure({ name, color, future = false }) {
  const agentColor = new THREE.Color(color || '#8be9fd');
  const phase = ((hashName(name) % 1000) / 1000) * Math.PI * 2;

  const geoms = [];
  const mats = [];
  const G = (g) => { geoms.push(g); return g; };
  const M = (m) => { mats.push(m); return m; };

  // group origin = feet center. rig carries the body pose (bob / lean / facing /
  // sleep rotation); tag + status light live on group so they stay overhead.
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  // ── Legs (pivot at hip) ─────────────────────────────────────────────────────
  const legGeom = G(new THREE.BoxGeometry(2.6, H.legLen, 3.0));
  const legMat = M(makeMat(LIMB_COLOR, { future }));
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-1.8, H.hipY, 0);
  legR.position.set(1.8, H.hipY, 0);
  const legLMesh = new THREE.Mesh(legGeom, legMat);
  const legRMesh = new THREE.Mesh(legGeom, legMat);
  legLMesh.position.y = -H.legLen / 2;
  legRMesh.position.y = -H.legLen / 2;
  legL.add(legLMesh);
  legR.add(legRMesh);
  rig.add(legL, legR);

  // ── Long coat torso: flared lower skirt + tapered upper + collar ────────────
  const coatMat = M(makeMat(COAT_COLOR, { future }));
  const coatLower = new THREE.Mesh(G(new THREE.BoxGeometry(10, 10.5, 5.4)), coatMat);
  coatLower.position.y = 15; // hem sweeps below the hip — the long-coat read
  const coatUpper = new THREE.Mesh(G(new THREE.BoxGeometry(8.2, 8, 4.8)), coatMat);
  coatUpper.position.y = 23.2;
  const collar = new THREE.Mesh(G(new THREE.BoxGeometry(7, 2.2, 5.2)), coatMat);
  collar.position.y = 27.3;
  rig.add(coatLower, coatUpper, collar);

  // ── Emissive rim accent down one coat edge (agent color) ────────────────────
  const rimMat = M(makeMat(COAT_COLOR, {
    emissive: agentColor.getHex(),
    emissiveIntensity: 0.6,
    future,
  }));
  const rim = new THREE.Mesh(G(new THREE.BoxGeometry(0.7, 16.5, 0.7)), rimMat);
  rim.position.set(4.3, 18.2, 2.5);
  rig.add(rim);

  // ── Head + visor strip ──────────────────────────────────────────────────────
  const headGroup = new THREE.Group();
  headGroup.position.y = 28.4; // neck pivot — head turns from here
  const head = new THREE.Mesh(
    G(new THREE.CapsuleGeometry(2.5, 1.6, 2, 8)),
    M(makeMat(HEAD_COLOR, { future })),
  );
  head.position.y = H.headY - 28.4;
  const visor = new THREE.Mesh(
    G(new THREE.BoxGeometry(4.4, 1.1, 0.5)),
    M(makeMat(HEAD_COLOR, {
      emissive: agentColor.getHex(),
      emissiveIntensity: 0.35,
      future,
    })),
  );
  visor.position.set(0, H.headY - 28.4 + 0.4, 2.4);
  headGroup.add(head, visor);
  rig.add(headGroup);

  // ── Arms: shoulder pivot + forearm pivot (for typing bob) ───────────────────
  const upperArmGeom = G(new THREE.BoxGeometry(2.2, H.upperArm, 2.6));
  const foreArmGeom = G(new THREE.BoxGeometry(2.0, H.foreArm, 2.3));
  const armMat = M(makeMat(COAT_COLOR, { future }));

  function buildArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 5.2, H.shoulderY, 0);
    const upper = new THREE.Mesh(upperArmGeom, armMat);
    upper.position.y = -H.upperArm / 2;
    const fore = new THREE.Group(); // elbow pivot
    fore.position.y = -H.upperArm;
    const foreMesh = new THREE.Mesh(foreArmGeom, armMat);
    foreMesh.position.y = -H.foreArm / 2;
    fore.add(foreMesh);
    arm.add(upper, fore);
    return { arm, fore };
  }
  const { arm: armL, fore: foreL } = buildArm(-1);
  const { arm: armR, fore: foreR } = buildArm(1);
  rig.add(armL, armR);

  // ── Status light (above head, on group so it never lies down) ───────────────
  const statusMat = M(new THREE.MeshStandardMaterial({
    color: 0x111318,
    emissive: STATUS_GRAY,
    emissiveIntensity: 0.5,
    transparent: future,
    opacity: future ? FUTURE_OPACITY : 1,
  }));
  const statusLight = new THREE.Mesh(G(new THREE.SphereGeometry(0.9, 8, 6)), statusMat);
  statusLight.position.y = H.lightY;
  group.add(statusLight);

  // Precomputed status colors — no per-frame allocation in update().
  const colGreen = new THREE.Color(STATUS_GREEN);
  const colAgent = agentColor.clone();
  const colGray = new THREE.Color(STATUS_GRAY);

  // ── Name tag sprite (canvas texture, generated once) ────────────────────────
  const tagTexture = makeNameTexture(name, `#${agentColor.getHexString()}`);
  const tagMat = M(new THREE.SpriteMaterial({
    map: tagTexture || null,
    transparent: true,
    opacity: future ? 0.3 : 1,
    depthWrite: false,
  }));
  const tag = new THREE.Sprite(tagMat);
  tag.scale.set(28, 7, 1);
  tag.position.y = H.tagY;
  group.add(tag);

  const baseTagOpacity = future ? 0.3 : 1;

  // ── Per-frame pose ──────────────────────────────────────────────────────────
  function update(sprite, t) {
    const anim = sprite?.anim || 'idle';
    const animT = sprite?.animT || 0;
    const facing = sprite?.facing === -1 ? -1 : 1;
    const time = (Number(t) || 0) * 0.001; // seconds
    const isFuture = future || !!sprite?.future;

    // Deck scale: lower/nearer deck reads slightly larger.
    group.scale.setScalar(sprite?.deck === 1 ? LOWER_DECK_SCALE : 1);

    // Reset the pose baseline every frame, then layer the anim on top.
    rig.rotation.set(0, 0, 0);
    rig.position.set(0, 0, 0);
    legL.rotation.x = 0; legR.rotation.x = 0;
    armL.rotation.set(0, 0, 0); armR.rotation.set(0, 0, 0);
    foreL.rotation.x = 0; foreR.rotation.x = 0;
    headGroup.rotation.y = 0;
    tag.material.opacity = baseTagOpacity;
    statusLight.scale.setScalar(1);

    // 3/4 turn toward travel/console (climb + sleep override below).
    const faceY = facing === 1 ? 0.35 : Math.PI - 0.35;

    if (anim === 'walk') {
      const w = animT * 0.001 * Math.PI * 2 * 1.5 + phase; // ~1.5 strides/sec
      rig.rotation.y = faceY;
      legL.rotation.x = Math.sin(w) * 0.55;
      legR.rotation.x = -Math.sin(w) * 0.55;
      armL.rotation.x = -Math.sin(w) * 0.45; // counter-swing
      armR.rotation.x = Math.sin(w) * 0.45;
      rig.position.y = Math.abs(Math.sin(w)) * 1.2; // body bob ±1.2
      rig.rotation.x = 0.04; // faint forward intent
    } else if (anim === 'climb') {
      const w = animT * 0.001 * Math.PI * 2 * 1.2 + phase;
      rig.rotation.y = Math.PI; // face away from camera, into the ladder
      armL.rotation.x = -2.7 + Math.sin(w) * 0.4;        // alternating overhead reach
      armR.rotation.x = -2.7 + Math.sin(w + Math.PI) * 0.4;
      legL.rotation.x = -0.35 + Math.sin(w + Math.PI) * 0.4; // alternating step
      legR.rotation.x = -0.35 + Math.sin(w) * 0.4;
      foreL.rotation.x = -0.25;
      foreR.rotation.x = -0.25;
    } else if (anim === 'work') {
      rig.rotation.y = faceY;
      rig.rotation.x = 0.12; // slight forward lean into the console
      armL.rotation.x = -1.15; // raised forward at console height
      armR.rotation.x = -1.15;
      const type = time * 12 + phase;
      foreL.rotation.x = -0.45 + Math.sin(type) * 0.09;          // typing bob
      foreR.rotation.x = -0.45 + Math.sin(type + Math.PI) * 0.09;
      rig.position.y = Math.sin(time * 1.4 + phase) * 0.3;
    } else if (anim === 'sleep') {
      rig.rotation.y = 0;
      rig.rotation.z = Math.PI / 2; // lying horizontal on the ground plane
      rig.position.y = 2.7;         // rest on body half-depth, not sunk in the floor
      armL.rotation.x = -0.2;
      armR.rotation.x = -0.2;
      tag.material.opacity = Math.min(baseTagOpacity, 0.12); // tag very dim
    } else { // idle
      rig.rotation.y = faceY;
      rig.position.y = Math.sin(time * 1.1 + phase) * 0.5; // slow breathing bob
      const sway = Math.sin(time * 0.9 + phase) * 0.05;
      armL.rotation.x = sway;
      armR.rotation.x = -sway;
      // Occasional slow head turn: long period + per-name phase so it feels
      // like someone glancing across the deck, not a metronome.
      headGroup.rotation.y = Math.sin(time * 0.22 + phase) * 0.55;
    }

    // Status light: green when working, agent color when active, dim gray idle.
    if (anim === 'work') {
      statusMat.emissive.copy(colGreen);
      statusMat.emissiveIntensity = 0.9 + Math.sin(time * 3.6 + phase) * 0.3; // gentle pulse
      statusLight.scale.setScalar(1 + Math.sin(time * 3.6 + phase) * 0.18);
    } else if (sprite?.state === 'active') {
      statusMat.emissive.copy(colAgent);
      statusMat.emissiveIntensity = 0.8;
    } else {
      statusMat.emissive.copy(colGray);
      statusMat.emissiveIntensity = isFuture ? 0.2 : 0.4;
    }
  }

  function dispose() {
    for (const g of geoms) g.dispose();
    for (const m of mats) m.dispose();
    if (tagTexture) tagTexture.dispose();
    if (group.parent) group.parent.remove(group);
  }

  return { group, update, dispose };
}
