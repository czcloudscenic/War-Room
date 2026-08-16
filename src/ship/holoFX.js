// ── holoFX.js — ambient 3D effects layered over the painted ship ─────────────
// Subtle life on top of the cinematic art plane (1280×720 at z=0):
//   1. holo-core particle column + pulsing cyan light (analytics room)
//   2. barely-visible warm dust motes drifting through both deck interiors
//   3. faint additive light shafts breathing from the upper windows
//   4. warm engine flicker (glow quad + point light) at the stern
//
// Pure ES module, imports only from 'three'. No DOM, no Math.random —
// everything is seeded deterministically by index. All buffers are built
// once; update(t) only mutates existing attribute arrays / material scalars.
//
// Coordinate contract (matches shipRendererArt): three.x = logicalX - 640,
// three.y = 360 - logicalY. Effects live at z 4..16 (in front of the art,
// behind the crew at z 18+).

import * as THREE from 'three';

// ── logical → three helpers ──────────────────────────────────────────────────
const TX = (lx) => lx - 640;
const TY = (ly) => 360 - ly;

// Deterministic pseudo-random in [0,1) from an integer index + salt.
function srand(i, salt) {
  const s = Math.sin(i * 127.1 + salt * 311.7 + 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

// ── procedural sprite textures (DataTexture — no canvas/DOM) ─────────────────
function makeRadialTexture(size) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c, dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = Math.max(0, 1 - d);
      const v = Math.round(255 * a * a); // soft quadratic falloff
      const o = (y * size + x) * 4;
      data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = v;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Vertical gradient (bright at top → transparent at bottom) for light shafts.
function makeShaftTexture(h) {
  const data = new Uint8Array(h * 4);
  for (let y = 0; y < h; y++) {
    // DataTexture row 0 = bottom of the UV space; fade toward the bottom.
    const f = y / (h - 1);              // 0 bottom → 1 top
    const a = Math.round(255 * f * f);
    const o = y * 4;
    data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = a;
  }
  const tex = new THREE.DataTexture(data, 1, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ── constants ─────────────────────────────────────────────────────────────────
// Holo-core (analytics room): logical center x≈650, column logical y 440..560.
const CORE = {
  n: 120,
  cx: TX(650),          //  10
  yTop: TY(440),        // -80
  yBottom: TY(560),     // -200
  radius: 26,
  z: 10,
};
CORE.height = CORE.yTop - CORE.yBottom;                 // 130 (rise upward in three-y)
CORE.cy = (CORE.yTop + CORE.yBottom) / 2;               // -140

// Dust motes across the two painted deck interiors (logical bands).
const DUST = {
  n: 80,
  x0: 100, x1: 1180,
  bands: [ { y0: 180, y1: 300 }, { y0: 400, y1: 560 } ],
};

// Light shafts from upper windows (deck-0 ceiling ≈ logical y 165).
const SHAFTS = [
  { lx: 200, phase: 0.0 },
  { lx: 500, phase: 2.1 },
  { lx: 900, phase: 4.4 },
];

// Engine glow at the stern.
const ENGINE = { x: TX(1210), y: TY(520), z: 8 };       // (570, -160)

// ── factory ───────────────────────────────────────────────────────────────────
export function createHoloFX() {
  const group = new THREE.Group();
  group.name = 'holoFX';

  const disposables = [];
  const spriteTex = makeRadialTexture(32);
  const shaftTex = makeShaftTexture(64);
  disposables.push(spriteTex, shaftTex);

  // ── 1. holo-core particle column ────────────────────────────────────────────
  const corePos = new Float32Array(CORE.n * 3);
  // per-particle params, seeded by index: radius, start angle, start height,
  // rise speed (px/s), swirl speed (rad/s)
  const coreR = new Float32Array(CORE.n);
  const coreTh = new Float32Array(CORE.n);
  const coreY0 = new Float32Array(CORE.n);
  const coreRise = new Float32Array(CORE.n);
  const coreSwirl = new Float32Array(CORE.n);
  for (let i = 0; i < CORE.n; i++) {
    coreR[i] = CORE.radius * Math.sqrt(srand(i, 1));
    coreTh[i] = srand(i, 2) * Math.PI * 2;
    coreY0[i] = srand(i, 3) * CORE.height;
    coreRise[i] = 7 + 11 * srand(i, 4);
    coreSwirl[i] = 0.12 + 0.22 * srand(i, 5);
  }
  const coreGeo = new THREE.BufferGeometry();
  coreGeo.setAttribute('position', new THREE.BufferAttribute(corePos, 3));
  const coreMat = new THREE.PointsMaterial({
    color: 0x2aabff,
    size: 2.5,
    map: spriteTex,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const corePoints = new THREE.Points(coreGeo, coreMat);
  corePoints.name = 'holoCoreColumn';
  corePoints.frustumCulled = false; // positions move every frame; skip bound recompute
  group.add(corePoints);
  disposables.push(coreGeo, coreMat);

  // Soft cyan core light — distance-limited so it kisses the nearby crew
  // figures (z 18+) without washing the painted scene.
  const coreLight = new THREE.PointLight(0x2aabff, 0.8, 180, 2);
  coreLight.position.set(CORE.cx, CORE.cy, 14);
  coreLight.name = 'holoCoreLight';
  group.add(coreLight);

  // ── 2. dust motes ───────────────────────────────────────────────────────────
  const dustPos = new Float32Array(DUST.n * 3);
  const dustLX = new Float32Array(DUST.n);   // logical base x
  const dustLY = new Float32Array(DUST.n);   // logical base y
  const dustVX = new Float32Array(DUST.n);   // logical px/s
  const dustVY = new Float32Array(DUST.n);
  const dustBand = new Uint8Array(DUST.n);
  for (let i = 0; i < DUST.n; i++) {
    const b = i % 2;
    const band = DUST.bands[b];
    dustBand[i] = b;
    dustLX[i] = DUST.x0 + srand(i, 6) * (DUST.x1 - DUST.x0);
    dustLY[i] = band.y0 + srand(i, 7) * (band.y1 - band.y0);
    dustVX[i] = (srand(i, 8) - 0.5) * 11;    // slow lateral drift
    dustVY[i] = (srand(i, 9) - 0.5) * 3.5;   // slower vertical drift
    dustPos[i * 3 + 2] = 5 + srand(i, 10) * 4; // z 5..9
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xffd9a0,
    size: 2,
    map: spriteTex,
    transparent: true,
    opacity: 0.1,             // barely visible (≤0.12)
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.name = 'dustMotes';
  dustPoints.frustumCulled = false;
  group.add(dustPoints);
  disposables.push(dustGeo, dustMat);

  // ── 3. faint light shafts ───────────────────────────────────────────────────
  const shaftMeshes = [];
  const shaftGeo = new THREE.PlaneGeometry(70, 250);
  disposables.push(shaftGeo);
  for (let s = 0; s < SHAFTS.length; s++) {
    const def = SHAFTS[s];
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbfd8ff,
      map: shaftTex,
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(shaftGeo, mat);
    // Top anchored at the deck-0 ceiling (logical y≈165), leaning down-left.
    mesh.position.set(TX(def.lx) - 30, TY(165) - 118, 6);
    mesh.rotation.z = -0.26; // clockwise: bottom edge swings left
    mesh.name = 'lightShaft' + s;
    group.add(mesh);
    shaftMeshes.push({ mesh, mat, phase: def.phase });
    disposables.push(mat);
  }

  // ── 4. engine flicker ───────────────────────────────────────────────────────
  const engineGeo = new THREE.PlaneGeometry(72, 72);
  const engineMat = new THREE.MeshBasicMaterial({
    color: 0xffa040,
    map: spriteTex,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const engineQuad = new THREE.Mesh(engineGeo, engineMat);
  engineQuad.position.set(ENGINE.x, ENGINE.y, ENGINE.z);
  engineQuad.name = 'engineGlow';
  group.add(engineQuad);
  disposables.push(engineGeo, engineMat);

  const engineLight = new THREE.PointLight(0xff9944, 0.6, 160, 2);
  engineLight.position.set(ENGINE.x, ENGINE.y, ENGINE.z + 4);
  engineLight.name = 'engineLight';
  group.add(engineLight);

  // ── update ──────────────────────────────────────────────────────────────────
  const dustXRange = DUST.x1 - DUST.x0;
  const coreAttr = coreGeo.getAttribute('position');
  const dustAttr = dustGeo.getAttribute('position');

  function update(t) {
    const ts = t * 0.001; // seconds

    // holo-core column: rise + wrap + slow swirl
    for (let i = 0; i < CORE.n; i++) {
      const yy = (coreY0[i] + coreRise[i] * ts) % CORE.height;
      const th = coreTh[i] + coreSwirl[i] * ts;
      const r = coreR[i];
      const o = i * 3;
      corePos[o] = CORE.cx + Math.cos(th) * r;
      corePos[o + 1] = CORE.yBottom + yy;
      corePos[o + 2] = CORE.z + Math.sin(th) * (r / CORE.radius) * 5; // z 5..15
    }
    coreAttr.needsUpdate = true;
    coreMat.opacity = 0.55 + 0.2 * Math.sin(t * 0.0012);           // gentle pulse
    coreLight.intensity = 0.8 + 0.2 * Math.sin(t * 0.0016);        // 0.6..1.0

    // dust motes: slow drift, wrapping at band edges (computed in logical px)
    for (let i = 0; i < DUST.n; i++) {
      const band = DUST.bands[dustBand[i]];
      const yRange = band.y1 - band.y0;
      let lx = dustLX[i] - DUST.x0 + dustVX[i] * ts;
      let ly = dustLY[i] - band.y0 + dustVY[i] * ts;
      lx = ((lx % dustXRange) + dustXRange) % dustXRange + DUST.x0;
      ly = ((ly % yRange) + yRange) % yRange + band.y0;
      const o = i * 3;
      dustPos[o] = lx - 640;      // TX inline (no call overhead in the loop)
      dustPos[o + 1] = 360 - ly;  // TY inline
    }
    dustAttr.needsUpdate = true;

    // light shafts: very slow opacity breathing, capped at 0.045 (≤0.05)
    for (let s = 0; s < shaftMeshes.length; s++) {
      const sh = shaftMeshes[s];
      sh.mat.opacity = 0.03 + 0.015 * Math.sin(t * 0.00045 + sh.phase);
    }

    // engine flicker: deterministic sum of two sines
    const flick = 0.55 + 0.25 * Math.sin(t * 0.011) + 0.18 * Math.sin(t * 0.037 + 1.7);
    engineLight.intensity = flick;
    engineMat.opacity = 0.1 + 0.16 * Math.max(0, flick);
  }

  // ── dispose ─────────────────────────────────────────────────────────────────
  function dispose() {
    for (const d of disposables) d.dispose();
    group.clear();
  }

  return { group, update, dispose };
}
