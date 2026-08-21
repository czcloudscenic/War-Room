// ── Agent Ship crew models ────────────────────────────────────────────────────
// Procedural low-poly crew figures for the cinematic 2.5D ship scene.
// ORIGINAL stylized humans in a dark-cyberpunk wardrobe language — long leather
// coats, dark glasses, one striking red dress. NO film-character or real-actor
// likenesses: heads stay featureless beyond the emissive visor / eye-light
// language, so identity comes purely from silhouette, wardrobe, and color.
//
// Every named ROSTER member (src/core/shipStations.js) gets a distinct
// wardrobe built from primitive geometry:
//   Sean    — full-length flared trench + knee-length tail, slim visor strip
//   Muse    — THE red dress (tapered satin skirt, blonde shoulder hair)
//   Scrappy — chunky sweater + headset band with emissive mic dot
//   Slate   — bald mentor: broadest shoulders, longest coat, oval glasses
//   Route   — utility vest + pockets + flat cap
//   Tally   — straight neat blazer + thin visor
//   Frame   — hooded jacket (hood block behind head)
//   Echo    — neck scarf + mid-length jacket
//   Quill   — shirt + suspender strips, no coat
//   Vault   — segmented armored vest, stocky
// Unknown names fall back to the original generic long-coat look.
//
// Pure ES module: three.js only. No React, no DOM requirement (the name-tag
// canvas is skipped gracefully outside a browser), no Math.random — every
// per-figure variation derives from a hash of the agent's name, so replays
// and multi-mount renders are stable, and two figures with the same name are
// byte-identical in pose at the same inputs.
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

// ── Shared geometry cache ─────────────────────────────────────────────────────
// Identical primitives are built once at module level and shared by every
// figure (10 crew × ~15 meshes would otherwise allocate a lot of duplicate
// buffers). Cached geometries live for the module lifetime and are NEVER
// disposed by a figure's dispose() — the set is small and bounded by the
// distinct dimensions used below.
const GEOM_CACHE = new Map();
function cachedGeom(key, make) {
  let g = GEOM_CACHE.get(key);
  if (!g) { g = make(); GEOM_CACHE.set(key, g); }
  return g;
}
const boxGeom = (w, h, d) =>
  cachedGeom(`b:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const capsuleGeom = (r, len, cs, rs) =>
  cachedGeom(`c:${r},${len},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs));
const cylinderGeom = (rt, rb, h, seg) =>
  cachedGeom(`y:${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const torusGeom = (r, tube, rs, ts) =>
  cachedGeom(`t:${r},${tube},${rs},${ts}`, () => new THREE.TorusGeometry(r, tube, rs, ts));
const sphereGeom = (r, ws, hs) =>
  cachedGeom(`s:${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));

// Name-tag texture: 24px Geist Mono in the agent color on transparent bg.
// Returns null in non-DOM environments (headless tests) — the tag sprite
// simply renders as a blank transparent sprite there.
export function makeNameTexture(name, color) {
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

function makeMat(colorHex, {
  emissive = 0x000000,
  emissiveIntensity = 0,
  future = false,
  roughness = 0.85,
  metalness = 0.1,
} = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness,
    metalness,
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

// ── Wardrobe builders ─────────────────────────────────────────────────────────
// Each builder receives a toolkit `t`:
//   t.part(name, geom, mat, x, y, z, parent?)  → mesh added to rig (default)
//   t.cloth(hex, opts?)                        → tracked standard material
//   t.glow(hex, intensity, glowHex?)           → tracked emissive material
//   t.rig / t.headGroup                        → parents (headGroup y=28.4)
//   t.agentColor                               → THREE.Color
//   t.P                                        → anim/limb params to mutate:
//     armX, armColor, legW, legD, legVisible (shorten for dresses — legs still
//     scissor from the hip, only the visible shin block is shorter, so no hem
//     clipping), walkFreq, legSwing, armSwing, workLean extra, idleBob, idleSway
// headGroup-relative y: head center = 2.0, eye line ≈ 2.4, head top ≈ 4.3.

function addDefaultVisor(t, w = 4.4, h = 1.1, intensity = 0.35) {
  t.part('visor', boxGeom(w, h, 0.5), t.glow(HEAD_COLOR, intensity),
    0, 2.4, 2.4, t.headGroup);
}
function addRim(t, x, y, z, height, width = 0.7, intensity = 0.6) {
  t.part('rim', boxGeom(width, height, width), t.glow(COAT_COLOR, intensity), x, y, z);
}

// Unknown names keep the original generic long-coat look, exactly as before.
function wardrobeGeneric(t) {
  const coat = t.cloth(COAT_COLOR);
  t.part('coat-lower', boxGeom(10, 10.5, 5.4), coat, 0, 15, 0);
  t.part('coat-upper', boxGeom(8.2, 8, 4.8), coat, 0, 23.2, 0);
  t.part('collar', boxGeom(7, 2.2, 5.2), coat, 0, 27.3, 0);
  addRim(t, 4.3, 18.2, 2.5, 16.5);
  addDefaultVisor(t);
}

// Sean — the calm lead: full-length black trench, slightly flared, knee-length
// tail, slim rectangular dark visor strip, short dark hair, upright posture.
function wardrobeSean(t) {
  const trench = t.cloth(0x101319, { roughness: 0.6, metalness: 0.2 }); // leather sheen
  t.part('trench-lower', boxGeom(10.8, 13, 5.6), trench, 0, 13.8, 0); // hem at the knee
  t.part('trench-upper', boxGeom(8.2, 8, 4.8), trench, 0, 23.2, 0);
  t.part('trench-collar', boxGeom(7.2, 2.4, 5.4), trench, 0, 27.4, 0);
  t.part('trench-belt', boxGeom(8.6, 1.4, 4.6), t.cloth(0x0b0e14), 0, 19.2, 0.6);
  t.part('coat-tail', boxGeom(7.6, 8.5, 1.3), trench, 0, 10.5, -3.1); // knee-length tail
  addRim(t, 4.6, 16.8, 2.7, 18);
  t.part('hair-short', boxGeom(4.6, 1.5, 4.4), t.cloth(0x141821), 0, 4.4, -0.2, t.headGroup);
  // Slim rectangular dark shades strip — wider + flatter than the generic visor.
  t.part('visor-strip', boxGeom(5.2, 0.9, 0.55), t.glow(0x0c0f15, 0.3), 0, 2.4, 2.4, t.headGroup);
}

// Muse — THE red dress: tapered knee-length satin silhouette in her color,
// blonde shoulder-length hair, no coat, elegant (subtler) idle.
function wardrobeMuse(t) {
  const dressHex = t.agentColor.clone().multiplyScalar(0.82).getHex();
  const dress = t.cloth(dressHex, { roughness: 0.35, metalness: 0.18 });
  // slight emissive lift so the satin catches light among the dark coats
  dress.emissive.copy(t.agentColor);
  dress.emissiveIntensity = 0.12;
  // Tapered skirt: hem at y=7 (knee). Legs are shortened to a 6-unit visible
  // shin (still hip-pivoted) so the scissor never clips the hem.
  t.part('dress-skirt', cylinderGeom(4.0, 3.6, 15, 8), dress, 0, 14.5, 0);
  t.part('dress-bodice', boxGeom(6.2, 5, 3.8), dress, 0, 24, 0);
  t.part('hair-blonde', boxGeom(5.6, 6.6, 5.0), t.cloth(0xd9c489, { roughness: 0.7 }),
    0, 2.4, -0.5, t.headGroup); // falls to the shoulders
  t.part('eye-light', boxGeom(3.8, 0.7, 0.5), t.glow(HEAD_COLOR, 0.3), 0, 2.4, 2.4, t.headGroup);
  addRim(t, 3.6, 14.5, 1.4, 13, 0.5, 0.5);
  t.P.armColor = 0x20242f;   // sleeveless read
  t.P.legW = 2.2; t.P.legD = 2.6;
  t.P.legVisible = 6;        // shin only — hem owns the rest
  t.P.legSwing = 0.44;       // stride stays under the hem
  t.P.idleBob = 0.5;         // elegant, subtler bob
  t.P.idleSway = 0.6;
}

// Scrappy — the operator: chunky layered sweater (no coat), headset band with
// an emissive mic dot in his color, extra forward lean at the console.
function wardrobeScrappy(t) {
  const knit = t.cloth(0x2c313d, { roughness: 0.95, metalness: 0.05 }); // lighter charcoal
  t.part('sweater-lower', boxGeom(11, 9, 6), knit, 0, 17.5, 0); // wider torso box
  t.part('sweater-upper', boxGeom(9.6, 7, 5.4), knit, 0, 23.7, 0);
  t.part('sweater-roll', boxGeom(7.8, 1.8, 5.8), knit, 0, 27.2, 0);
  addRim(t, 5.0, 17.5, 2.8, 12, 0.6, 0.55);
  t.part('headset-band', torusGeom(2.85, 0.32, 6, 12), t.cloth(0x161a22),
    0, 2.0, 0, t.headGroup); // over-the-head band
  t.part('headset-mic', sphereGeom(0.42, 6, 5), t.glow(0x0c0f15, 0.9),
    1.9, 0.7, 2.4, t.headGroup); // tiny mic dot in his color
  addDefaultVisor(t);
  t.P.armColor = 0x2c313d;
  t.P.workLean = 0.07; // a few degrees more hunch in 'work'
}

// Slate — the mentor: bald, broadest shoulders, longest coat, small oval
// glasses (two tiny emissive rings), deliberate slower walk.
function wardrobeSlate(t) {
  const coat = t.cloth(0x10141b, { roughness: 0.65, metalness: 0.18 });
  t.part('coat-longest', boxGeom(11, 15, 5.8), coat, 0, 12.5, 0); // hem at mid-shin
  t.part('coat-broad', boxGeom(9.4, 8, 5.2), coat, 0, 23.2, 0);   // broader shoulders
  t.part('coat-collar', boxGeom(8, 2.4, 5.6), coat, 0, 27.4, 0);
  addRim(t, 4.9, 15, 2.8, 19);
  const ring = torusGeom(0.55, 0.13, 5, 10);
  const lens = t.glow(0x0c0f15, 0.55);
  t.part('glasses-l', ring, lens, -1.05, 2.4, 2.45, t.headGroup); // small oval glasses
  t.part('glasses-r', ring, lens, 1.05, 2.4, 2.45, t.headGroup);
  t.P.armX = 5.9;      // wider shoulder set
  t.P.walkFreq = 0.85; // deliberate pace
}

// Route — utility vest over shirt, flat cap.
function wardrobeRoute(t) {
  const shirt = t.cloth(0x262b36);
  const vest = t.cloth(0x171b25, { roughness: 0.6 });
  t.part('shirt', boxGeom(8, 9.5, 4.6), shirt, 0, 19.5, 0);
  t.part('vest', boxGeom(8.8, 6.2, 5.4), vest, 0, 21.6, 0);
  t.part('vest-pocket-l', boxGeom(2.3, 1.9, 0.7), vest, -2.3, 19.2, 2.85);
  t.part('vest-pocket-r', boxGeom(2.3, 1.9, 0.7), vest, 2.3, 19.2, 2.85);
  t.part('belt', boxGeom(7, 1.6, 4.8), t.cloth(0x11141b), 0, 14.6, 0);
  const cap = t.cloth(0x1c212c);
  t.part('cap-crown', boxGeom(4.9, 1.3, 4.9), cap, 0, 4.4, 0, t.headGroup); // flat cap
  t.part('cap-brim', boxGeom(4.4, 0.5, 2.0), cap, 0, 4.0, 3.1, t.headGroup);
  addRim(t, 4.5, 18.5, 2.5, 11, 0.6, 0.55);
  addDefaultVisor(t);
  t.P.armColor = 0x262b36;
}

// Tally — neat blazer: straight box, no flare, thin visor.
function wardrobeTally(t) {
  const blazer = t.cloth(0x161a24, { roughness: 0.7 });
  t.part('blazer', boxGeom(8.4, 12, 5), blazer, 0, 19.5, 0); // one straight box
  t.part('blazer-collar', boxGeom(7, 1.8, 5.2), blazer, 0, 26.4, 0);
  addRim(t, 4.3, 19, 2.5, 12, 0.6, 0.55);
  t.part('visor-thin', boxGeom(4.6, 0.6, 0.5), t.glow(HEAD_COLOR, 0.4), 0, 2.5, 2.4, t.headGroup);
}

// Frame — hooded jacket, hood block resting behind the head.
function wardrobeFrame(t) {
  const jacket = t.cloth(0x141822, { roughness: 0.8 });
  t.part('jacket-lower', boxGeom(9.6, 10, 5.4), jacket, 0, 16, 0);
  t.part('jacket-upper', boxGeom(8.4, 7.5, 5), jacket, 0, 23.4, 0);
  t.part('jacket-collar', boxGeom(7.4, 2, 5.4), jacket, 0, 27.2, 0);
  t.part('hood', boxGeom(5.6, 3.8, 2.8), jacket, 0, 28.8, -3.0); // hood down, behind head
  addRim(t, 4.3, 17, 2.6, 13, 0.6, 0.55);
  addDefaultVisor(t);
}

// Echo — scarf block at the neck, mid-length jacket.
function wardrobeEcho(t) {
  const jacket = t.cloth(0x13161f);
  t.part('jacket-mid', boxGeom(9.4, 8, 5.2), jacket, 0, 16.6, 0); // mid-length hem
  t.part('jacket-upper', boxGeom(8.2, 7.5, 4.8), jacket, 0, 23.2, 0);
  const scarfHex = new THREE.Color(COAT_COLOR).lerp(t.agentColor, 0.25).getHex();
  t.part('scarf', boxGeom(7, 2.8, 5.8), t.cloth(scarfHex, { roughness: 0.95 }), 0, 27.5, 0);
  addRim(t, 4.3, 17.5, 2.5, 12, 0.6, 0.55);
  addDefaultVisor(t);
}

// Quill — shirt + suspenders feel, no coat.
function wardrobeQuill(t) {
  const shirt = t.cloth(0x3a4150);
  t.part('shirt', boxGeom(7.8, 10.5, 4.4), shirt, 0, 20, 0);
  const strap = t.cloth(0x11141b);
  t.part('suspender-l', boxGeom(0.9, 9.5, 0.35), strap, -2.0, 20.2, 2.35); // thin dark strips
  t.part('suspender-r', boxGeom(0.9, 9.5, 0.35), strap, 2.0, 20.2, 2.35);
  t.part('belt', boxGeom(7, 1.5, 4.6), strap, 0, 14.8, 0);
  addRim(t, 4.1, 19.5, 2.3, 10, 0.5, 0.5);
  addDefaultVisor(t);
  t.P.armColor = 0x3a4150; // shirt sleeves
}

// Vault — armored vest with segmented chest plates, stocky build.
function wardrobeVault(t) {
  const armor = t.cloth(0x1a2029, { roughness: 0.5, metalness: 0.35 });
  const plate = t.cloth(0x2a3140, { roughness: 0.45, metalness: 0.4 });
  t.part('vest-body', boxGeom(10.4, 10.5, 6.4), armor, 0, 19.8, 0); // stocky torso
  t.part('plate-top', boxGeom(8.8, 2.7, 1.0), plate, 0, 22.6, 3.6); // segmented chest
  t.part('plate-mid', boxGeom(8.8, 2.7, 1.0), plate, 0, 19.4, 3.6);
  t.part('plate-low', boxGeom(8.8, 2.7, 1.0), plate, 0, 16.2, 3.6);
  t.part('neck-guard', boxGeom(7.8, 2, 5.8), armor, 0, 26.6, 0);
  addRim(t, 5.4, 19, 3.0, 12);
  addDefaultVisor(t);
  t.P.armX = 6.2;                    // wide set
  t.P.armColor = 0x1a2029;
  t.P.legW = 3.4; t.P.legD = 3.8;    // heavy legs
}

const WARDROBES = {
  Sean: wardrobeSean,
  Muse: wardrobeMuse,
  Scrappy: wardrobeScrappy,
  Slate: wardrobeSlate,
  Route: wardrobeRoute,
  Tally: wardrobeTally,
  Frame: wardrobeFrame,
  Echo: wardrobeEcho,
  Quill: wardrobeQuill,
  Vault: wardrobeVault,
};

export function createAgentFigure({ name, color, future = false }) {
  const agentColor = new THREE.Color(color || '#8be9fd');
  const phase = ((hashName(name) % 1000) / 1000) * Math.PI * 2;

  const mats = [];
  const M = (m) => { mats.push(m); return m; };

  // group origin = feet center. rig carries the body pose (bob / lean / facing /
  // sleep rotation); tag + status light live on group so they stay overhead.
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  // Head shell first so wardrobes can hang headgear off headGroup.
  const headGroup = new THREE.Group();
  headGroup.position.y = 28.4; // neck pivot — head turns from here
  const head = new THREE.Mesh(
    capsuleGeom(2.5, 1.6, 2, 8),
    M(makeMat(HEAD_COLOR, { future })),
  );
  head.position.y = H.headY - 28.4;
  headGroup.add(head);
  rig.add(headGroup);

  // ── Wardrobe: per-name silhouette + anim params ─────────────────────────────
  const P = {
    armX: 5.2, armColor: COAT_COLOR,
    legW: 2.6, legD: 3.0, legVisible: H.legLen,
    walkFreq: 1, legSwing: 0.55, armSwing: 0.45,
    workLean: 0, idleBob: 1, idleSway: 1,
  };
  const parts = [];
  const toolkit = {
    rig, headGroup, agentColor, P,
    part(partName, geom, material, x, y, z, parent = rig) {
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      parts.push(partName);
      return mesh;
    },
    cloth(hex, opts = {}) { return M(makeMat(hex, { ...opts, future })); },
    glow(hex, intensity, glowHex = agentColor.getHex()) {
      return M(makeMat(hex, { emissive: glowHex, emissiveIntensity: intensity, future }));
    },
  };
  (WARDROBES[String(name || '')] || wardrobeGeneric)(toolkit);
  group.userData.wardrobeParts = parts; // debug/QA: silhouette manifest

  // ── Legs (pivot at hip; wardrobe may shorten the visible shin) ──────────────
  const legGeom = boxGeom(P.legW, P.legVisible, P.legD);
  const legMat = M(makeMat(LIMB_COLOR, { future }));
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-1.8, H.hipY, 0);
  legR.position.set(1.8, H.hipY, 0);
  const legLMesh = new THREE.Mesh(legGeom, legMat);
  const legRMesh = new THREE.Mesh(legGeom, legMat);
  legLMesh.position.y = -(H.legLen - P.legVisible / 2); // foot always at y=0
  legRMesh.position.y = -(H.legLen - P.legVisible / 2);
  legL.add(legLMesh);
  legR.add(legRMesh);
  rig.add(legL, legR);

  // ── Arms: shoulder pivot + forearm pivot (for typing bob) ───────────────────
  const upperArmGeom = boxGeom(2.2, H.upperArm, 2.6);
  const foreArmGeom = boxGeom(2.0, H.foreArm, 2.3);
  const armMat = M(makeMat(P.armColor, { future }));

  function buildArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * P.armX, H.shoulderY, 0);
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
  const statusLight = new THREE.Mesh(sphereGeom(0.9, 8, 6), statusMat);
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
      const w = animT * 0.001 * Math.PI * 2 * 1.5 * P.walkFreq + phase; // strides/sec × pace
      rig.rotation.y = faceY;
      legL.rotation.x = Math.sin(w) * P.legSwing;
      legR.rotation.x = -Math.sin(w) * P.legSwing;
      armL.rotation.x = -Math.sin(w) * P.armSwing; // counter-swing
      armR.rotation.x = Math.sin(w) * P.armSwing;
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
      rig.rotation.x = 0.12 + P.workLean; // lean into the console (Scrappy hunches more)
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
      rig.position.y = Math.sin(time * 1.1 + phase) * 0.5 * P.idleBob; // breathing bob
      const sway = Math.sin(time * 0.9 + phase) * 0.05 * P.idleSway;
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
    // Geometries are module-level shared cache — intentionally NOT disposed
    // here (other live figures reuse them; the cache is small and bounded).
    for (const m of mats) m.dispose();
    if (tagTexture) tagTexture.dispose();
    if (group.parent) group.parent.remove(group);
  }

  return { group, update, dispose };
}
