// shipArtFX.js — the LIFE layer for the cinematic ship artwork (ship-interior.jpg).
//
// The painting renders as a plane at z=0 in art space: logical 1280x720,
// world x = logicalX - 640, world y = 360 - logicalY. Everything here sits at
// z 2..12 — in front of the art, behind the crew (z 18+) — and only AMPLIFIES
// glow the painting already has: additive blending, low alpha, no solid shapes.
//
// Measured anchors (logical coords, from the 2048x1143 source):
//   HOLO-CORE  cylinder center (688, 478), glass column ~68x130, bright heart
//              (688, 512), base ring (691, 551).
//   SCREENS    16 cataloged — see SCREENS table below.
//   LAMPS      12 warm amber sources — see LAMPS table below.
//   CITY       visible below the port hull line: x 0..440, hull-bottom line
//              y = 470 + 0.30x, city band down to y ~712.
//   SKY        storm clouds across the top, y 0..140.
//   DECKS      upper interior x 170..900 / y 150..265, lower interior
//              x 230..1230 / y 330..570 (dust motes live here).
//
// Budget: 8 draw calls, all buffers built once, update() mutates in place
// (zero per-frame allocation).

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// coordinate helpers + deterministic hash (no Math.random anywhere)
// ---------------------------------------------------------------------------

const LX = (x) => x - 640;       // logical X -> world X
const LY = (y) => 360 - y;       // logical Y -> world Y

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// measured anchor tables
// ---------------------------------------------------------------------------

// [logicalX, logicalY, width, height, flickerType]
// flickerType: 0 slow breathe · 1 occasional quick double-blink · 2 fast subtle
const SCREENS = [
  [222, 214, 64, 70, 0],   //  0 upper-left deck: big cyan wireframe hologram (shimmer)
  [286, 219, 40, 22, 2],   //  1 upper-left desk monitor (green-cyan)
  [345, 227, 26, 13, 1],   //  2 teal panels right of that desk
  [409, 239, 20, 14, 2],   //  3 small aft monitor, upper-left deck
  [503, 180, 50, 50, 0],   //  4 upper-mid blue holo screen (shimmer)
  [545, 192, 26, 19, 1],   //  5 monitor beside the upper-mid holo
  [603, 450, 25, 18, 2],   //  6 monitor at left wall of the core room
  [759, 457, 30, 22, 1],   //  7 dual monitor right of the holo-core
  [803, 488, 88, 14, 2],   //  8 glowing console strip right of the core
  [481, 368, 32, 16, 0],   //  9 lower-left deck wall monitors
  [588, 444, 34, 16, 1],   // 10 twin laptops on the lower-left desk
  [1018, 306, 48, 58, 0],  // 11 green "matrix" screen, upper-right room (shimmer)
  [983, 343, 22, 25, 2],   // 12 round monitor with cyan blob, upper-right
  [1168, 340, 100, 108, 0],// 13 big blueprint panel, far right wall
  [1013, 520, 38, 30, 1],  // 14 small blue screen cluster, lower right
  [1149, 537, 50, 16, 2],  // 15 blue desk screen, far-right lower room
];
const SHIMMER_SCREENS = [0, 4, 11]; // refresh with a quick vertical shimmer

// [logicalX, logicalY, width, height]
const LAMPS = [
  [829, 199, 44, 44],    // upper-deck ceiling lamp, second room
  [1019, 267, 36, 36],   // ceiling lamp, upper-right console room
  [331, 335, 40, 34],    // lower-deck ceiling lamp row, left
  [427, 332, 40, 34],    // lower-deck ceiling lamp row, right
  [247, 381, 32, 32],    // port bunk-room lamp
  [572, 378, 32, 32],    // lower-deck lamp over the desks
  [625, 381, 30, 30],    // lower-deck lamp, aft of the desks
  [405, 409, 22, 34],    // amber rod light by the consoles
  [1098, 490, 34, 78],   // far-right vertical flame lamp (tall halo)
  [1172, 477, 96, 30],   // far-right warm shelf strip (wide halo)
  [956, 583, 40, 30],    // warm floor glow, lower-right walkway
  [1206, 501, 40, 36],   // warm cluster at the far-right wall
];

const CORE = { x: 688, y: 478, heartY: 512, colW: 68, colH: 130 };

const CLOUDS = [ // [logicalX, logicalY, width, height, driftSpeed(world units/s)]
  [200, 70, 340, 130, 3.2],
  [560, 55, 380, 120, 2.1],
  [900, 82, 320, 140, 4.0],
  [1180, 60, 300, 110, 2.7],
];

const CITY = { x0: 0, x1: 440, slope: 0.30, lineY: 470, yMax: 712 };
const DECKS = [
  { x0: 170, x1: 900, y0: 150, y1: 265 },   // upper interior
  { x0: 230, x1: 1230, y0: 330, y1: 570 },  // lower interior
];

const RAIN_COUNT = 200;
const CITY_COUNT = 80;
const DUST_COUNT = 40;
const CORE_PARTICLES = 40;

// ---------------------------------------------------------------------------
// procedural textures (DataTexture — no canvas, no DOM)
// ---------------------------------------------------------------------------

function makeRadialTexture(size, power) {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      let a = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy));
      a = Math.pow(a, power);
      const i = (y * size + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function makeSoftRectTexture(size, edge) {
  // alpha = 1 in the middle, smooth falloff over `edge` fraction at each border
  const data = new Uint8Array(size * size * 4);
  const smooth = (u) => {
    const t = Math.max(0, Math.min(1, u / edge));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const a = smooth(Math.min(u, 1 - u)) * smooth(Math.min(v, 1 - v));
      const i = (y * size + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// merged quad batch: N textured quads in ONE mesh, per-quad brightness via
// vertex colors (additive blending => scaling color == scaling opacity)
// ---------------------------------------------------------------------------

function buildQuadBatch(count, texture, z, dynamicPositions) {
  const pos = new Float32Array(count * 4 * 3);
  const col = new Float32Array(count * 4 * 3);
  const uv = new Float32Array(count * 4 * 2);
  const idx = new Uint16Array(count * 6);
  for (let i = 0; i < count; i++) {
    const u = i * 8;
    uv[u] = 0; uv[u + 1] = 0;
    uv[u + 2] = 1; uv[u + 3] = 0;
    uv[u + 4] = 1; uv[u + 5] = 1;
    uv[u + 6] = 0; uv[u + 7] = 1;
    const v = i * 4, f = i * 6;
    idx[f] = v; idx[f + 1] = v + 1; idx[f + 2] = v + 2;
    idx[f + 3] = v; idx[f + 4] = v + 2; idx[f + 5] = v + 3;
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const colAttr = new THREE.BufferAttribute(col, 3);
  if (dynamicPositions) posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', colAttr);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.position.z = z;
  return { mesh, geo, mat, pos, col, posAttr, colAttr };
}

function setQuad(pos, i, cx, cy, w, h) {
  const hw = w / 2, hh = h / 2, p = i * 12;
  pos[p] = cx - hw; pos[p + 1] = cy - hh; pos[p + 2] = 0;
  pos[p + 3] = cx + hw; pos[p + 4] = cy - hh; pos[p + 5] = 0;
  pos[p + 6] = cx + hw; pos[p + 7] = cy + hh; pos[p + 8] = 0;
  pos[p + 9] = cx - hw; pos[p + 10] = cy + hh; pos[p + 11] = 0;
}

function setQuadColor(col, i, r, g, b) {
  const p = i * 12;
  col[p] = r; col[p + 1] = g; col[p + 2] = b;
  col[p + 3] = r; col[p + 4] = g; col[p + 5] = b;
  col[p + 6] = r; col[p + 7] = g; col[p + 8] = b;
  col[p + 9] = r; col[p + 10] = g; col[p + 11] = b;
}

function buildPoints(count, texture, z, size, opacity) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const colAttr = new THREE.BufferAttribute(col, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', colAttr);
  const mat = new THREE.PointsMaterial({
    map: texture,
    size,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.position.z = z;
  return { points, geo, mat, pos, col, posAttr, colAttr };
}

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

export function createShipArtFX() {
  const group = new THREE.Group();
  group.name = 'shipArtFX';
  const disposables = [];

  const glowTex = makeRadialTexture(64, 2.2);   // lamps, core glow, motes
  const softTex = makeRadialTexture(64, 1.2);   // clouds (wider falloff)
  const rectTex = makeSoftRectTexture(64, 0.35);// screens
  const dotTex = makeRadialTexture(32, 1.8);    // city / core particles
  disposables.push(glowTex, softTex, rectTex, dotTex);

  // -- 1. HOLO-CORE ---------------------------------------------------------
  const coreGeo = new THREE.PlaneGeometry(96, 168);
  const coreMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0x5fd4ff,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const coreGlow = new THREE.Mesh(coreGeo, coreMat);
  coreGlow.position.set(LX(CORE.x), LY(CORE.y + 8), 5);
  coreGlow.frustumCulled = false;
  group.add(coreGlow);
  disposables.push(coreGeo, coreMat);

  const coreP = buildPoints(CORE_PARTICLES, dotTex, 6, 3.2, 1);
  {
    // static seeds; positions written every frame
    for (let i = 0; i < CORE_PARTICLES; i++) {
      coreP.col[i * 3] = 0.35; coreP.col[i * 3 + 1] = 0.8; coreP.col[i * 3 + 2] = 1;
    }
    coreP.colAttr.needsUpdate = true;
  }
  group.add(coreP.points);
  disposables.push(coreP.geo, coreP.mat);

  const coreLight = new THREE.PointLight(0x66ddff, 11500, 200, 2);
  coreLight.position.set(LX(CORE.x), LY(CORE.y + 18), 10);
  group.add(coreLight);
  disposables.push(coreLight);

  // -- 2. SCREENS (16 quads + 3 shimmer bars, one mesh) ----------------------
  const nScreens = SCREENS.length;
  const nShim = SHIMMER_SCREENS.length;
  const scr = buildQuadBatch(nScreens + nShim, rectTex, 3, true);
  for (let i = 0; i < nScreens; i++) {
    const s = SCREENS[i];
    setQuad(scr.pos, i, LX(s[0]), LY(s[1]), s[2], s[3]);
    setQuadColor(scr.col, i, 0.04, 0.05, 0.055); // cyan-white, ~base 0.05
  }
  for (let k = 0; k < nShim; k++) {
    const s = SCREENS[SHIMMER_SCREENS[k]];
    setQuad(scr.pos, nScreens + k, LX(s[0]), LY(s[1]), s[2] * 0.92, 3);
    setQuadColor(scr.col, nScreens + k, 0, 0, 0);
  }
  scr.posAttr.needsUpdate = true;
  scr.colAttr.needsUpdate = true;
  group.add(scr.mesh);
  disposables.push(scr.geo, scr.mat);

  // -- 3. LAMPS (one mesh) ----------------------------------------------------
  const nLamps = LAMPS.length;
  const lamps = buildQuadBatch(nLamps, glowTex, 4, false);
  for (let i = 0; i < nLamps; i++) {
    const L = LAMPS[i];
    setQuad(lamps.pos, i, LX(L[0]), LY(L[1]), L[2] * 2.2, L[3] * 2.2);
    setQuadColor(lamps.col, i, 0.07, 0.045, 0.02);
  }
  lamps.posAttr.needsUpdate = true;
  lamps.colAttr.needsUpdate = true;
  group.add(lamps.mesh);
  disposables.push(lamps.geo, lamps.mat);

  // -- 4. RAIN (one LineSegments) --------------------------------------------
  const rainPos = new Float32Array(RAIN_COUNT * 2 * 3);
  const rainX = new Float32Array(RAIN_COUNT);
  const rainOff = new Float32Array(RAIN_COUNT);
  const rainSpd = new Float32Array(RAIN_COUNT);
  const rainLen = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainX[i] = hash(i * 7 + 1) * 1400 - 700;
    rainOff[i] = hash(i * 7 + 2) * 840;
    rainSpd[i] = 520 + hash(i * 7 + 3) * 340;
    rainLen[i] = 22 + hash(i * 7 + 4) * 12;
  }
  const rainGeo = new THREE.BufferGeometry();
  const rainAttr = new THREE.BufferAttribute(rainPos, 3);
  rainAttr.setUsage(THREE.DynamicDrawUsage);
  rainGeo.setAttribute('position', rainAttr);
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x9fb8cc,
    transparent: true,
    opacity: 0.09,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.position.z = 11;
  group.add(rain);
  disposables.push(rainGeo, rainMat);

  // -- 5. CITY TWINKLE (one Points) -------------------------------------------
  const city = buildPoints(CITY_COUNT, dotTex, 2, 2.6, 0.35);
  const cityWarm = new Uint8Array(CITY_COUNT);
  for (let i = 0; i < CITY_COUNT; i++) {
    const cx = CITY.x0 + hash(i * 5 + 11) * (CITY.x1 - CITY.x0);
    const yMin = CITY.lineY + CITY.slope * cx + 8;
    const cy = yMin + hash(i * 5 + 12) * Math.max(4, CITY.yMax - yMin);
    city.pos[i * 3] = LX(cx);
    city.pos[i * 3 + 1] = LY(cy);
    city.pos[i * 3 + 2] = 0;
    cityWarm[i] = hash(i * 5 + 13) < 0.62 ? 1 : 0;
  }
  city.posAttr.needsUpdate = true;
  group.add(city.points);
  disposables.push(city.geo, city.mat);

  // -- 6. CLOUD DRIFT (one mesh, 4 quads) --------------------------------------
  const nClouds = CLOUDS.length;
  const clouds = buildQuadBatch(nClouds, softTex, 9, true);
  for (let i = 0; i < nClouds; i++) {
    const C = CLOUDS[i];
    setQuad(clouds.pos, i, LX(C[0]), LY(C[1]), C[2], C[3]);
    setQuadColor(clouds.col, i, 0.055, 0.06, 0.07); // faint grey, alpha <= 0.10
  }
  clouds.posAttr.needsUpdate = true;
  clouds.colAttr.needsUpdate = true;
  group.add(clouds.mesh);
  disposables.push(clouds.geo, clouds.mat);

  // -- 7. DUST MOTES (one Points) ----------------------------------------------
  const dust = buildPoints(DUST_COUNT, glowTex, 8, 1.9, 0.07);
  const dustBX = new Float32Array(DUST_COUNT);
  const dustBY = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    const deck = DECKS[i < 16 ? 0 : 1];
    dustBX[i] = LX(deck.x0 + hash(i * 9 + 21) * (deck.x1 - deck.x0));
    dustBY[i] = LY(deck.y0 + hash(i * 9 + 22) * (deck.y1 - deck.y0));
    dust.col[i * 3] = 0.55; dust.col[i * 3 + 1] = 0.45; dust.col[i * 3 + 2] = 0.3;
  }
  dust.colAttr.needsUpdate = true;
  group.add(dust.points);
  disposables.push(dust.geo, dust.mat);

  // ---------------------------------------------------------------------------
  // update — mutation only, zero allocation
  // ---------------------------------------------------------------------------

  const coreTopY = LY(CORE.y - CORE.colH / 2 + 6);   // world y of column top
  const coreBotY = LY(CORE.y + CORE.colH / 2 + 12);  // world y of column bottom
  const coreSpan = coreTopY - coreBotY;
  const coreCX = LX(CORE.x);
  const rainTop = 410, rainWrap = 840;
  const cloudWrap = 1920;

  function update(t) {
    const s = t * 0.001;

    // 1. holo-core: breathing glow + rising particles + pulsing light
    coreMat.opacity = 0.16 + 0.048 * Math.sin(s * 0.8) + 0.01 * Math.sin(s * 5.3);
    coreLight.intensity = 11500 + 3200 * Math.sin(s * 1.1) + 280 * Math.sin(s * 9.7);
    for (let i = 0; i < CORE_PARTICLES; i++) {
      const r = 26 * Math.sqrt(hash(i * 11 + 41));
      const ang = hash(i * 11 + 42) * 6.2832 + s * (0.3 + hash(i * 11 + 43) * 0.4);
      const u = (s * (0.06 + hash(i * 11 + 44) * 0.08) + hash(i * 11 + 45)) % 1;
      const p3 = i * 3;
      coreP.pos[p3] = coreCX + r * Math.cos(ang);
      coreP.pos[p3 + 1] = coreBotY + u * coreSpan;
      coreP.pos[p3 + 2] = 0;
      const fade = Math.sin(u * 3.1416); // fade in/out along the rise
      coreP.col[p3] = 0.3 * fade;
      coreP.col[p3 + 1] = 0.75 * fade;
      coreP.col[p3 + 2] = fade;
    }
    coreP.posAttr.needsUpdate = true;
    coreP.colAttr.needsUpdate = true;

    // 2. screens: per-screen flicker via vertex colors
    for (let i = 0; i < nScreens; i++) {
      const type = SCREENS[i][4];
      const ph = hash(i * 13 + 61) * 6.2832;
      let a;
      if (type === 0) {
        a = 0.05 + 0.024 * Math.sin(s * (0.5 + hash(i * 13 + 62) * 0.5) + ph);
      } else if (type === 1) {
        a = 0.045 + 0.012 * Math.sin(s * 0.9 + ph);
        const period = 3.5 + hash(i * 13 + 63) * 4.5;
        const u = (s + hash(i * 13 + 64) * period) % period;
        if (u < 0.07 || (u > 0.15 && u < 0.22)) a += 0.16; // quick double-blink
      } else {
        a = 0.05 + 0.018 * Math.sin(s * 3.1 + ph) + 0.009 * Math.sin(s * 7.3 + ph * 2);
      }
      if (a < 0.012) a = 0.012;
      setQuadColor(scr.col, i, a * 0.78, a * 0.94, a); // cyan-white tint
    }
    // shimmer bars: quick vertical refresh sweep on 3 screens
    for (let k = 0; k < nShim; k++) {
      const S = SCREENS[SHIMMER_SCREENS[k]];
      const qi = nScreens + k;
      const period = 5 + hash(k * 17 + 91) * 4;
      const u = (s + hash(k * 17 + 92) * period) % period;
      const cy0 = LY(S[1]);
      if (u < 0.45) {
        const f = u / 0.45;
        const barY = cy0 + S[3] / 2 - f * S[3];
        setQuad(scr.pos, qi, LX(S[0]), barY, S[2] * 0.92, 3);
        const a = 0.2 * Math.sin(f * 3.1416);
        setQuadColor(scr.col, qi, a * 0.8, a * 0.95, a);
      } else {
        setQuadColor(scr.col, qi, 0, 0, 0);
      }
    }
    scr.posAttr.needsUpdate = true;
    scr.colAttr.needsUpdate = true;

    // 3. lamps: gentle independent warm flicker (0.04..0.10)
    for (let i = 0; i < nLamps; i++) {
      const ph = hash(i * 19 + 71) * 6.2832;
      let a = 0.07
        + 0.022 * Math.sin(s * (0.7 + hash(i * 19 + 72) * 0.9) + ph)
        + 0.008 * Math.sin(s * (5 + hash(i * 19 + 73) * 4) + ph * 2);
      if (a < 0.04) a = 0.04;
      if (a > 0.10) a = 0.10;
      setQuadColor(lamps.col, i, a, a * 0.62, a * 0.28);
    }
    lamps.colAttr.needsUpdate = true;

    // 4. rain: fast fall with slight slant, wrapping
    for (let i = 0; i < RAIN_COUNT; i++) {
      const y0 = rainTop - ((s * rainSpd[i] + rainOff[i]) % rainWrap);
      const p6 = i * 6;
      rainPos[p6] = rainX[i];
      rainPos[p6 + 1] = y0;
      rainPos[p6 + 2] = 0;
      rainPos[p6 + 3] = rainX[i] + rainLen[i] * 0.14;
      rainPos[p6 + 4] = y0 + rainLen[i];
      rainPos[p6 + 5] = 0;
    }
    rainAttr.needsUpdate = true;

    // 5. city twinkle: deterministic per-point brightness
    for (let i = 0; i < CITY_COUNT; i++) {
      const w = 0.6 + hash(i * 5 + 14) * 2.4;
      const ph = hash(i * 5 + 15) * 6.2832;
      let tw = 0.5 + 0.5 * Math.sin(s * w + ph);
      if ((i & 3) === 0) tw = tw * tw * tw; // some snap sharply
      const b = 0.3 + 0.7 * tw;
      const p3 = i * 3;
      if (cityWarm[i]) {
        city.col[p3] = b; city.col[p3 + 1] = b * 0.72; city.col[p3 + 2] = b * 0.42;
      } else {
        city.col[p3] = b * 0.65; city.col[p3 + 1] = b * 0.82; city.col[p3 + 2] = b;
      }
    }
    city.colAttr.needsUpdate = true;

    // 6. clouds: extremely slow sideways drift with wrap
    for (let i = 0; i < nClouds; i++) {
      const C = CLOUDS[i];
      const x = ((LX(C[0]) + C[4] * s + 960) % cloudWrap + cloudWrap) % cloudWrap - 960;
      setQuad(clouds.pos, i, x, LY(C[1]), C[2], C[3]);
    }
    clouds.posAttr.needsUpdate = true;

    // 7. dust motes: slow drift inside the deck interiors
    for (let i = 0; i < DUST_COUNT; i++) {
      const sp = 0.05 + hash(i * 9 + 23) * 0.1;
      const ph = hash(i * 9 + 24) * 6.2832;
      const p3 = i * 3;
      dust.pos[p3] = dustBX[i] + 14 * Math.sin(s * sp * 2.1 + ph);
      dust.pos[p3 + 1] = dustBY[i] + 7 * Math.sin(s * sp * 1.4 + ph * 1.7);
      dust.pos[p3 + 2] = 0;
    }
    dust.posAttr.needsUpdate = true;
  }

  function dispose() {
    for (let i = 0; i < disposables.length; i++) disposables[i].dispose();
    group.clear();
    if (group.parent) group.parent.remove(group);
  }

  update(0);

  return { group, update, dispose };
}
