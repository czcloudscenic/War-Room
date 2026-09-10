// ── Agent Ship crew models ────────────────────────────────────────────────────
// Procedural crew figures for the cinematic 2.5D ship scene.
// ORIGINAL stylized humans in a dark-cyberpunk wardrobe language — long leather
// coats, dark glasses, one striking red dress. NO film-character or real-actor
// likenesses: faces are simple original sculpts, with identity coming from
// silhouette, wardrobe, and color. The four commissioned crew use smooth
// anatomical profiles; the future roster keeps its existing wardrobe.
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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

const SCULPTED = new Set(['Sean', 'Muse', 'Scrappy', 'Slate']);

// Elliptical cross sections, smoothly interpolated along y. Unlike cylinders
// and boxes these describe a jaw, shoulders, waist, hips and a cloth hem.
// Profiles and their deterministic folds are cached, never rebuilt in update.
function profileGeom(id, profile, folds = 0, opening = 0) {
  return cachedGeom(`profile:${id}`, () => {
    const curve = new THREE.CatmullRomCurve3(profile.map(([y, x, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');
    const rows = (profile.length - 1) * 5, columns = 24;
    const positions = [], uv = [], indices = [];
    for (let i = 0; i <= rows; i++) {
      const p = curve.getPoint(i / rows);
      for (let j = 0; j <= columns; j++) {
        const a = opening + (Math.PI * 2 - opening * 2) * j / columns;
        const ripple = 1 + folds * Math.sin(a * 7 + p.y * 0.35) * Math.sin(Math.PI * i / rows);
        positions.push(Math.sin(a) * Math.max(0.015, p.x) * ripple, p.y, Math.cos(a) * Math.max(0.015, p.z) * ripple);
        uv.push(j / columns, i / rows);
        if (i < rows && j < columns) {
          const k = i * (columns + 1) + j;
          indices.push(k, k + columns + 1, k + 1, k + 1, k + columns + 1, k + columns + 2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    // The duplicated UV seam must share its normal on closed surfaces.
    if (!opening) {
      const normals = g.attributes.normal;
      const normal = new THREE.Vector3();
      for (let i = 0; i <= rows; i++) {
        const a = i * (columns + 1), b = a + columns;
        normal.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b)).normalize();
        normals.setXYZ(a, normal.x, normal.y, normal.z);
        normals.setXYZ(b, normal.x, normal.y, normal.z);
      }
    }
    return g;
  });
}

function ellipsoid(t, name, material, x, y, z, sx, sy, sz, parent = t.rig) {
  const m = t.part(name, sphereGeom(1, 16, 12), material, x, y, z, parent);
  m.scale.set(sx, sy, sz);
  return m;
}

function panelGeom(id, points) {
  return cachedGeom(`panel:${id}`, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap((_, i) => [i % 2, Math.floor(i / 2)]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  });
}

// Bake garment/skin colors into smooth geometry, then batch by articulation
// pivot. One neutral, lightable material cannot be repeatedly saturated by the
// host's per-mesh signature tint. Vertex colors carry cloth folds and subtle
// value variation; there is no emissive skin, eye glow, or extra texture load.
function finishSculpt(rig, material, ownedGeometries, tint) {
  for (const child of [...rig.children]) if (child.isGroup) finishSculpt(child, material, ownedGeometries, tint);
  const meshes = rig.children.filter(o => o.isMesh);
  if (!meshes.length) return;
  const geometries = meshes.map(mesh => {
    mesh.updateMatrix();
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrix);
    const p = g.attributes.position, n = g.attributes.normal;
    const colors = new Float32Array(p.count * 3);
    // Same rule ShipScene3D applies per mesh: near-black garments carry 45% of
    // the agent's signature color. Baked here because the merged figure has one
    // shared material the host can no longer tint part by part.
    const c = mesh.material.color.clone();
    const lum0 = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    if (tint && lum0 < 0.16) {
      // Signature hue, but KEEP the part's own value. Lerping alone collapsed
      // coat, shirt and belt onto one flat colour because every garment here is
      // near-black — that is what made the crew read as monochrome cut-outs.
      // Sean is the reference: a real character sits IN the dark ship, dark,
      // modelled by the key light. Tinting hard and lifting value turned the
      // procedural crew into glowing UI markers pasted ON the painting. Keep
      // them near their original darkness, take only a hint of signature hue,
      // and let the directional key describe the form.
      c.lerp(tint, 0.22);
      const target = 0.05 + 1.05 * lum0;           // 0.00-0.16 -> 0.05-0.22
      const cur = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
      if (cur > 0.001) c.multiplyScalar(target / cur);
    }
    for (let i = 0; i < p.count; i++) {
      // Low contrast surface variation, deterministic and independent of time.
      const grain = Math.sin(p.getX(i) * 17 + p.getY(i) * 29 + p.getZ(i) * 13) * 0.03;
      // A 12% spread cannot describe a body. Hemispheric term reads the form,
      // a small sideways term separates the silhouette edges from the torso.
      const ny = n.getY(i), nx = n.getX(i);
      const shade = 0.62 + 0.38 * (0.5 + 0.5 * ny) + 0.08 * nx + grain;
      colors[i * 3] = c.r * shade;
      colors[i * 3 + 1] = c.g * shade;
      colors[i * 3 + 2] = c.b * shade;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  ownedGeometries.push(merged);
  for (const mesh of meshes) rig.remove(mesh);
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = `${rig.name || 'body'}-surface`;
  mesh.userData.sculpted = true; // colors already baked — host must not tint again
  rig.add(mesh);
}

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
  const coat = t.cloth(0x4a505a), seam = t.cloth(0x7c828c), shirt = t.cloth(0x30343d);
  t.part('trench-body', profileGeom('sean-torso', [[15,3.4,1.9],[19,2.9,1.7],[23.5,4,2.05],[25.6,4.25,1.8],[27,2.15,1.4],[27.5,1.1,1]]), coat, 0,0,0);
  t.part('trench-flare', profileGeom('sean-hem', [[6.3,5.05,2.5],[10,4.5,2.3],[15,3.5,1.9],[19.5,2.95,1.7]], 0.035, 0.26), coat, 0,0,0);
  t.part('shirt-front', profileGeom('sean-shirt', [[19,1.8,1.7],[24,2.1,2],[26.6,1.2,1.5]]), shirt, 0,0,0.2);
  for (const side of [-1,1]) {
    t.part('trench-lapel', panelGeom('sean-lapel-' + side, [[side*1.1,27,1.5],[side*3.4,25.5,1.7],[side*1.3,21,2.05],[side*0.7,24,2.15]]), seam, 0,0,0.12);
  }
  t.part('trench-belt', profileGeom('sean-belt', [[18.7,3.1,1.85],[19.35,3.1,1.85]]), shirt, 0,0,0);
  t.P.armColor = 0x4a505a;
  t.P.armX = 4.0;
  t.P.legW = 2.5;
  t.P.legSwing = 0.42;
  const hair = t.cloth(0x343943);
  ellipsoid(t, 'short-hair', hair, 0,4.6,-0.25,1.82,0.95,1.55,t.headGroup);
  const glasses = t.cloth(0x353d48);
  for (const side of [-1,1]) ellipsoid(t, 'visor-lens', glasses, side*0.83,3.15,1.47,0.72,0.32,0.16,t.headGroup);
  t.part('visor-bridge', boxGeom(0.42,0.13,0.15), glasses, 0,3.15,1.59,t.headGroup);
}

// Muse — THE red dress: tapered knee-length satin silhouette in her color,
// blonde shoulder-length hair, no coat, elegant (subtler) idle.
function wardrobeMuse(t) {
  const dress = t.cloth(0xa43c53), seam = t.cloth(0x652d40);
  t.part('satin-dress', profileGeom('muse-dress', [[4.8,3.55,1.8],[8,3.05,1.65],[12.5,2.8,1.6],[16.3,3.45,1.9],[19.9,2.35,1.4],[22.5,2.95,1.8],[24.4,3.05,1.65]], 0.025, 0.11), dress, 0,0,0);
  const skin = t.cloth(0xb5abab);
  t.part('shoulders', profileGeom('muse-shoulders', [[23.2,2.9,1.6],[25.5,3.25,1.4],[26.45,2.6,1.15],[27.6,0.85,0.8]]), skin, 0,0,0);
  for (const side of [-1,1]) {
    t.part('dress-strap', panelGeom('muse-strap-' + side, [[side*2.35,24,1.5],[side*2.75,24,1.5],[side*2.4,26.1,1.1],[side*2.03,26.2,1.15]]), seam, 0,0,0.05);
  }
  // Hair lives behind and beside the face, never a box enclosing the head.
  const hair = t.cloth(0x9b9d98), strand = t.cloth(0x777d80);
  ellipsoid(t,'hair-crown',hair,0,4.2,-0.6,1.95,1.2,1.5,t.headGroup);
  ellipsoid(t,'hair-back',hair,0,1.9,-1.0,1.95,2.9,0.85,t.headGroup);
  for (const side of [-1,1]) {
    ellipsoid(t,'hair-lock',side === -1 ? hair : strand,side*1.72,1.9,-0.1,0.56,2.9,0.8,t.headGroup).rotation.z=side*0.12;
  }
  t.P.armColor = 0xb5abab;
  t.P.armX = 3.25;
  t.P.armRadius = 0.65;
  t.P.legW = 1.9;
  t.P.legColor = 0xa19a9e;
  t.P.legSwing = 0.24;
  t.P.kneeSwing = 0.32;
  t.P.armSwing = 0.25;
}

// Scrappy — the operator: chunky layered sweater (no coat), headset band with
// an emissive mic dot in his color, extra forward lean at the console.
function wardrobeScrappy(t) {
  const knit = t.cloth(0x636671), cuff = t.cloth(0x454a55);
  t.part('sweater', profileGeom('scrappy-knit', [[14.8,3.6,1.9],[16,4.1,2.15],[20,3.75,2.1],[23.5,4.4,2.15],[25.6,4.55,1.85],[27,2.25,1.3],[27.6,1.1,1]], 0.025), knit,0,0,0);
  t.part('sweater-hem', profileGeom('scrappy-hem', [[14.7,3.65,1.95],[15.65,3.85,2.05]],0.018),cuff,0,0,0);
  t.part('roll-neck', profileGeom('scrappy-neck', [[26.6,1.4,1.2],[27.7,1.2,1.1]]),cuff,0,0,0);
  const hair=t.cloth(0x3c4048), headset=t.cloth(0x808694);
  ellipsoid(t,'cropped-hair',hair,0,4.5,-0.3,1.85,1,1.55,t.headGroup);
  t.part('headset-band', torusGeom(2.02,0.16,8,32),headset,0,3.1,-0.2,t.headGroup);
  for(const side of [-1,1]) ellipsoid(t,'earcup',cuff,side*1.97,2.65,0,0.32,0.63,0.58,t.headGroup);
  const mic=t.part('mic-boom',cylinderGeom(0.12,0.12,1.8,8),headset,1.8,1.7,0.9,t.headGroup);
  mic.rotation.x=-0.8;
  ellipsoid(t,'mic-tip',cuff,1.7,1.05,1.5,0.24,0.2,0.3,t.headGroup);
  t.P.armX=4.4; t.P.armColor=0x636671; t.P.armRadius=1.02;
  t.P.workLean=0.07;
}

// Slate — the mentor: bald, broadest shoulders, longest coat, small oval
// glasses (two tiny emissive rings), deliberate slower walk.
function wardrobeSlate(t) {
  const coat=t.cloth(0x50565e), lapel=t.cloth(0x848993), shirt=t.cloth(0x383e49);
  t.part('greatcoat-body',profileGeom('slate-torso',[[15,3.7,2.1],[19.5,3.4,2.05],[23.4,4.6,2.4],[25.7,4.85,2.05],[27.3,2.4,1.45],[27.7,1.25,1.1]]),coat,0,0,0);
  t.part('greatcoat-hem',profileGeom('slate-hem',[[4.8,5.1,2.8],[10,4.8,2.6],[15,3.85,2.2],[19.5,3.4,2.05]],0.024,0.22),coat,0,0,0);
  t.part('undershirt',profileGeom('slate-shirt',[[19,1.8,2.05],[25,2.2,2.2],[27,1.3,1.5]]),shirt,0,0,0.15);
  for(const side of [-1,1]) {
    t.part('greatcoat-lapel',panelGeom('slate-lapel-'+side,[[side*1.2,27.3,1.6],[side*3.6,25.7,1.9],[side*1.5,20.5,2.2],[side*0.8,24.2,2.3]]),lapel,0,0,0.1);
    const glasses=t.part('spectacles',torusGeom(0.58,0.09,8,24),lapel,side*0.83,3.15,1.6,t.headGroup);
    glasses.scale.y=0.68;
  }
  t.part('spectacle-bridge',boxGeom(0.5,0.12,0.14),lapel,0,3.15,1.64,t.headGroup);
  t.P.armX=4.75; t.P.armColor=0x50565e; t.P.armRadius=1.04;
  t.P.walkFreq=0.85; t.P.legSwing=0.36;
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

  // ── Sculpt pass: one lightable material per articulation group ──────────────
  // Commissioned crew only; the future roster keeps its primitive wardrobe.
  // Merged per group so update() can still pose rig/head/arms/forearms/legs.
  const ownedGeometries = [];
  if (SCULPTED.has(String(name || ''))) {
    const surface = M(makeMat(0xffffff, { future }));
    surface.vertexColors = true;   // per-part color + cloth shading live in the mesh
    surface.flatShading = false;   // lofted profiles are smooth; boxes keep their own normals
    finishSculpt(rig, surface, ownedGeometries, agentColor);
  }

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
    for (const g of ownedGeometries) g.dispose(); // merged surfaces are per-figure, not cached
    if (tagTexture) tagTexture.dispose();
    if (group.parent) group.parent.remove(group);
  }

  return { group, update, dispose };
}
