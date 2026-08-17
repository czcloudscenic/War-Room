// ── environment3d.js ─────────────────────────────────────────────────────────
// The world OUTSIDE the Agent Ship's modeled hull: storm sky, the endless
// cyber-city glittering far below, rain, aerial haze, and the cool hover-wash
// under the hull. Pure ES module — imports only from 'three'. Everything is
// built once in createEnvironment(); update(t) mutates buffers only (zero
// per-frame allocations). No Math.random — all variation is index-seeded.
//
// Draw calls: sky(1) + clouds(1 instanced) + city towers(3 instanced layers)
//           + window lights(1 Points) + rain(1 LineSegments) + haze planes(3)
//           + under-hull glow(1) = 11.
// Particles: 400 window lights + 300 rain streaks = 700.

import * as THREE from 'three';
import { HULL_3D } from './scene3dContract.js';

// ── deterministic sin-hash ───────────────────────────────────────────────────
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
// per-index, per-salt uniform in [0,1)
function rnd(i, salt) {
  return hash(i * 1.618033 + salt * 7.77 + 0.1231);
}

// ── palette (cool blue-grey storm world) ─────────────────────────────────────
const SKY_TOP = new THREE.Color(0x04050a);      // near-black zenith
const SKY_HORIZON = new THREE.Color(0x1a2333);  // deep blue-grey band
const SKY_BELOW = new THREE.Color(0x0a0e17);    // falls back to dark under horizon
const TOWER_NEAR = 0x0d1017;
const TOWER_MID = 0x0a0d13;
const TOWER_FAR = 0x07090e;
const HAZE = 0x0c1220;
const RAIN_COLOR = 0x8fb6d9;
const GLOW_COLOR = 0x5fb9ff;
const WINDOW_WARM = new THREE.Color(0xffc478);
const WINDOW_COOL = new THREE.Color(0x7fd4ff);

// ── texture helpers (radial gradients as DataTexture) ────────────────────────
function makeRadialTexture(size, innerAlpha, power, roughSalt) {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half + 0.5) / half;
      const dy = (y - half + 0.5) / half;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (roughSalt > 0) {
        // irregular cloud rim: wobble the radius by angle-seeded hash
        const ang = Math.atan2(dy, dx);
        d += 0.14 * (hash(Math.floor((ang + Math.PI) * 5.093) + roughSalt) - 0.5);
      }
      const fall = Math.max(0, 1 - d);
      const a = Math.pow(fall, power) * innerAlpha;
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.min(255, Math.round(a * 255));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ── sky dome ─────────────────────────────────────────────────────────────────
function buildSky() {
  const geo = new THREE.SphereGeometry(3400, 28, 18);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ny = pos.getY(i) / 3400; // -1..1
    if (ny >= 0) {
      // horizon → zenith: deep blue-grey up to near-black
      c.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(Math.min(1, ny * 1.6), 0.7));
    } else {
      // horizon → nadir: sink into darkness (city haze owns this zone)
      c.copy(SKY_HORIZON).lerp(SKY_BELOW, Math.min(1, -ny * 2.2));
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

// ── storm cloud billboards (one InstancedMesh) ───────────────────────────────
const CLOUD_COUNT = 8;
function buildClouds(tex) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: 0x39424f,
    transparent: true,
    opacity: 0.16, // ≤0.2 — very dim
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, CLOUD_COUNT);
  mesh.renderOrder = -9;
  mesh.frustumCulled = false;
  const base = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    base.push({
      x: (rnd(i, 1) - 0.5) * 3600,
      y: 220 + rnd(i, 2) * 520,
      z: -900 - rnd(i, 3) * 550, // z ≈ -900..-1450, behind the ship
      w: 900 + rnd(i, 4) * 800,
      h: 280 + rnd(i, 5) * 260,
      phase: rnd(i, 6) * Math.PI * 2,
      speed: 0.010 + rnd(i, 7) * 0.014, // extremely slow drift
      amp: 40 + rnd(i, 8) * 70,
    });
  }
  return { mesh, base };
}

// ── city layers (instanced dark towers) ──────────────────────────────────────
const GROUND_Y = -1500;
function buildCityLayer(count, z, colorHex, seedSalt, heightScale) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex, fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const s = i + seedSalt * 1000;
    const w = 40 + rnd(s, 11) * 110;
    const d = 40 + rnd(s, 12) * 100;
    const hr = rnd(s, 13);
    const h = (180 + hr * hr * 760) * heightScale; // few tall spires, many squat blocks
    dummy.position.set(
      (rnd(s, 14) - 0.5) * 5000,        // endless: x ±2500
      GROUND_Y + h / 2,
      z + (rnd(s, 15) - 0.5) * 160,
    );
    dummy.scale.set(w, h, d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// ── window lights (one additive Points cloud, deterministic twinkle) ─────────
const WINDOW_COUNT = 400;
function buildWindows() {
  const positions = new Float32Array(WINDOW_COUNT * 3);
  const colors = new Float32Array(WINDOW_COUNT * 3);
  const baseColors = new Float32Array(WINDOW_COUNT * 3); // untwinkled reference
  const twinkle = new Float32Array(WINDOW_COUNT * 2);    // speed, phase
  for (let i = 0; i < WINDOW_COUNT; i++) {
    positions[i * 3] = (rnd(i, 21) - 0.5) * 5000;
    positions[i * 3 + 1] = -1350 + rnd(i, 22) * 730;     // y -1350..-620, on the towers
    positions[i * 3 + 2] = -960 + rnd(i, 23) * 700;      // z -960..-260, across the layers
    const warm = rnd(i, 24) < 0.55;
    const c = warm ? WINDOW_WARM : WINDOW_COOL;
    const dim = 0.35 + rnd(i, 25) * 0.65;
    baseColors[i * 3] = c.r * dim;
    baseColors[i * 3 + 1] = c.g * dim;
    baseColors[i * 3 + 2] = c.b * dim;
    colors[i * 3] = baseColors[i * 3];
    colors[i * 3 + 1] = baseColors[i * 3 + 1];
    colors[i * 3 + 2] = baseColors[i * 3 + 2];
    twinkle[i * 2] = 0.4 + rnd(i, 26) * 1.8;             // speed (rad/s)
    twinkle[i * 2 + 1] = rnd(i, 27) * Math.PI * 2;       // phase
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 7,
    vertexColors: true,
    transparent: true,
    opacity: 0.45, // ≤0.5
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, baseColors, twinkle };
}

// ── rain (one LineSegments of thin streaks, outside the hull only) ───────────
const RAIN_COUNT = 300;
const RAIN_Y_MAX = 400;
const RAIN_Y_MIN = -350;
const RAIN_RANGE = RAIN_Y_MAX - RAIN_Y_MIN;
// hull exclusion box (padded so no drop clips the cutaway interior)
const RX = 700;                       // |x| < RX is "over the hull"
const RZ0 = HULL_3D.zBack - 100;      // -260
const RZ1 = HULL_3D.zFront + 100;     // 160
function buildRain() {
  const positions = new Float32Array(RAIN_COUNT * 2 * 3);
  const drops = new Float32Array(RAIN_COUNT * 4); // x, z, y0(offset), speed
  for (let i = 0; i < RAIN_COUNT; i++) {
    let x = 0;
    let z = 0;
    let salt = 0;
    // deterministic rejection: re-hash until the column is outside the hull box
    do {
      x = (rnd(i, 31 + salt) - 0.5) * 2800;   // x ±1400
      z = -650 + rnd(i, 47 + salt) * 900;     // z -650..250
      salt += 101;
    } while (Math.abs(x) < RX && z > RZ0 && z < RZ1);
    drops[i * 4] = x;
    drops[i * 4 + 1] = z;
    drops[i * 4 + 2] = rnd(i, 33) * RAIN_RANGE;      // phase offset in the fall cycle
    drops[i * 4 + 3] = 950 + rnd(i, 34) * 450;       // fast fall, units/s
    const len = 42 + rnd(i, 35) * 30;
    // head vertex
    positions[i * 6] = x;
    positions[i * 6 + 1] = RAIN_Y_MAX;
    positions[i * 6 + 2] = z;
    // tail vertex (streak above the head, slight wind slant)
    positions[i * 6 + 3] = x + 6;
    positions[i * 6 + 4] = RAIN_Y_MAX + len;
    positions[i * 6 + 5] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: RAIN_COLOR,
    transparent: true,
    opacity: 0.22, // ≤0.25
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { lines, drops };
}

// ── aerial haze planes (between city layers — no THREE.Fog, ship stays clear) ─
function buildHazePlane(z, opacity) {
  const geo = new THREE.PlaneGeometry(7600, 2000);
  const mat = new THREE.MeshBasicMaterial({
    color: HAZE,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -1050, z);
  mesh.frustumCulled = false;
  return mesh;
}

// ── under-hull glow (hover-emitter wash over the city) ───────────────────────
function buildGlow(tex) {
  const geo = new THREE.PlaneGeometry(2000, 1100);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: GLOW_COLOR,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, HULL_3D.yBottom - 130, -60); // just beneath the ship
  mesh.frustumCulled = false;
  return mesh;
}

// ── public API ───────────────────────────────────────────────────────────────
export function createEnvironment() {
  const group = new THREE.Group();
  group.name = 'environment3d';

  const cloudTex = makeRadialTexture(64, 1.0, 2.2, 17);
  const glowTex = makeRadialTexture(64, 1.0, 1.6, 0);

  const sky = buildSky();
  const clouds = buildClouds(cloudTex);
  const cityNear = buildCityLayer(60, -350, TOWER_NEAR, 1, 1.0);
  const cityMid = buildCityLayer(80, -620, TOWER_MID, 2, 1.1);
  const cityFar = buildCityLayer(100, -900, TOWER_FAR, 3, 1.25);
  const windows = buildWindows();
  const rain = buildRain();
  const haze0 = buildHazePlane(-280, 0.16);
  const haze1 = buildHazePlane(-500, 0.20);
  const haze2 = buildHazePlane(-770, 0.24);
  const glow = buildGlow(glowTex);

  group.add(
    sky, clouds.mesh,
    cityFar, cityMid, cityNear,
    windows.points, rain.lines,
    haze2, haze1, haze0,
    glow,
  );

  // preallocated scratch (zero per-frame allocations)
  const dummy = new THREE.Object3D();
  const rainPos = rain.lines.geometry.attributes.position;
  const rainArr = rainPos.array;
  const drops = rain.drops;
  const winColorAttr = windows.points.geometry.attributes.color;
  const winArr = winColorAttr.array;
  const winBase = windows.baseColors;
  const winTw = windows.twinkle;
  const glowMat = glow.material;

  function update(t) {
    const tSec = t * 0.001;

    // rain: deterministic fall + wrap, mutate both streak vertices
    for (let i = 0; i < RAIN_COUNT; i++) {
      const speed = drops[i * 4 + 3];
      const cycle = (drops[i * 4 + 2] + speed * tSec) % RAIN_RANGE;
      const y = RAIN_Y_MAX - cycle;
      const len = rainArr[i * 6 + 4] - rainArr[i * 6 + 1]; // preserved streak length
      rainArr[i * 6 + 1] = y;
      rainArr[i * 6 + 4] = y + len;
    }
    rainPos.needsUpdate = true;

    // window twinkle: index+t deterministic brightness pulse
    for (let i = 0; i < WINDOW_COUNT; i++) {
      const b = 0.72 + 0.28 * Math.sin(tSec * winTw[i * 2] + winTw[i * 2 + 1]);
      winArr[i * 3] = winBase[i * 3] * b;
      winArr[i * 3 + 1] = winBase[i * 3 + 1] * b;
      winArr[i * 3 + 2] = winBase[i * 3 + 2] * b;
    }
    winColorAttr.needsUpdate = true;

    // clouds: extremely slow lateral drift + faint vertical breathing
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const b = clouds.base[i];
      dummy.position.set(
        b.x + Math.sin(tSec * b.speed + b.phase) * b.amp,
        b.y + Math.sin(tSec * b.speed * 0.6 + b.phase * 1.7) * 12,
        b.z,
      );
      dummy.scale.set(b.w, b.h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      clouds.mesh.setMatrixAt(i, dummy.matrix);
    }
    clouds.mesh.instanceMatrix.needsUpdate = true;

    // under-hull glow: soft hover-emitter pulse
    glowMat.opacity = 0.24 + 0.06 * Math.sin(tSec * 1.3);
  }

  function dispose() {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
    group.clear();
  }

  return { group, update, dispose };
}
