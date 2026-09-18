// ── Agent Ship — procedural low-poly 3D interior ─────────────────────────────
// Replaces the painted backdrop with a real modeled cutaway hull. Low-poly
// stylized homage to the painted art: chunky readable forms, emissive accents.
// Decks are OPEN (no partitions): bays are defined by rib pairs, floor seams
// and furniture; switchback steel stairs link the decks at each LADDERS x and
// the upper deck's cut edge carries a railing (merged mesh 'structure').
//
// Pure ES module. Deterministic (no Math.random — index-seeded sin-hash).
// All geometry/materials built ONCE at create; materials shared across meshes;
// static detail merged per-material; repeated props instanced.
//
// API:
//   const model = createShipModel(options?);
//     options.textures — optional { hull, wall, deck } (THREE.Texture or null
//     each; caller owns + disposes them). When present they map (and subtly
//     bump-map) the hull shell, room walls and deck slabs. No options = the
//     exact original flat-color look.
//   scene.add(model.group);
//   model.update(t);              // seconds — emissive flicker/pulse/throb
//   model.getStationAnchor(id);   // -> THREE.Vector3 (room center-front, floor)
//   model.dispose();

import * as THREE from 'three';
import {
  DECK_Y, DECK_CLEAR, ROOM_DEPTH, WALK_Z, HULL_3D, PALETTE, toSceneX,
} from './scene3dContract.js';
import { ROOMS, LADDERS, ENGINE_ROOM } from './world.js';
import { bayProfileAt, HULL_TOP_Y, HULL_BOTTOM_Y } from './hullGLB.js';

// ── deterministic variation ──────────────────────────────────────────────────
const hash01 = (i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

// ── matrix helper (build-time only) ──────────────────────────────────────────
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
function mat4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _scl.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_pos, _quat, _scl);
}

// ── merge bag: many transformed geometries -> one BufferGeometry ─────────────
class MergeBag {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.idx = [];
    this.vcount = 0;
  }

  add(geometry, matrix) {
    const p = geometry.attributes.position;
    const n = geometry.attributes.normal;
    const t = geometry.attributes.uv;
    const index = geometry.index;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyNormalMatrix(nm).normalize();
      this.norm.push(v.x, v.y, v.z);
      if (t) this.uv.push(t.getX(i), t.getY(i));
      else this.uv.push(0, 0);
    }
    for (let i = 0; i < index.count; i++) this.idx.push(index.getX(i) + this.vcount);
    this.vcount += p.count;
    geometry.dispose(); // data copied; template no longer needed
  }

  box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.add(new THREE.BoxGeometry(w, h, d), mat4(x, y, z, rx, ry, rz));
  }

  plane(w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
    this.add(new THREE.PlaneGeometry(w, h), mat4(x, y, z, rx, ry, rz));
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
export function createShipModel(options = {}) {
  const group = new THREE.Group();
  group.name = 'shipModel';

  const geoms = []; // for dispose
  const mats = [];  // for dispose

  // Derived layout constants (everything flows from the contract)
  const Z_ROOM_BACK = WALK_Z - ROOM_DEPTH;          // -140
  const SLAB_T = 14;
  const CEIL0 = DECK_Y[0] + DECK_CLEAR;             // 210
  const CEIL1 = DECK_Y[0] - SLAB_T;                 // 46 (underside of deck-0 slab)
  const Z_MID = (HULL_3D.zBack + HULL_3D.zFront) / 2; // -50

  // Scene-space room rects
  const rooms = ROOMS.map((r) => ({
    id: r.id,
    kind: r.kind,
    deck: r.deck,
    x0: toSceneX(r.x0),
    x1: toSceneX(r.x1),
    cx: toSceneX((r.x0 + r.x1) / 2),
    w: r.x1 - r.x0,
    floor: DECK_Y[r.deck],
    ceil: r.deck === 0 ? CEIL0 : CEIL1,
  }));
  const engine = {
    x0: toSceneX(ENGINE_ROOM.x0), x1: toSceneX(ENGINE_ROOM.x1),
    cx: toSceneX((ENGINE_ROOM.x0 + ENGINE_ROOM.x1) / 2),
    floor: DECK_Y[1],
  };
  const shaftXs = LADDERS.map((l) => toSceneX(l.x));

  // ── shared materials ───────────────────────────────────────────────────────
  // DoubleSide is load-bearing: the cutaway view shows the INSIDE of outward-
  // facing shell geometry, so single-sided lighting saw back faces and lit
  // them black under every lamp (ambient-only). Two-sided Lambert flips the
  // normal for back faces and the interior finally receives light.
  // shadowSide BackSide: an open two-sided shell self-shadows to black from the
  // front faces (rendering-traps.md, "Which side gets drawn"); render its
  // shadow pass from the back faces instead.
  // Standard (PBR) instead of Lambert: with an environment map in the scene
  // the plating picks up reflections and the wet deck reads as wet. Two-sided
  // with the shadow pass from the back faces (open shell, see rendering-traps).
  const lambert = (c) => { const m = new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, shadowSide: THREE.BackSide, roughness: 0.78, metalness: 0.35, envMapIntensity: 0.6 }); mats.push(m); return m; };
  const basic = (c, opts = {}) => { const m = new THREE.MeshBasicMaterial({ color: c, ...opts }); mats.push(m); return m; };

  const matHull = lambert(PALETTE.hull);
  const matHullDark = lambert(PALETTE.hullDark);
  const matDeck = lambert(PALETTE.deck);
  const matWall = lambert(PALETTE.wall);
  const matRib = lambert(PALETTE.rib);
  // Open-deck structure (ribs, stairs, railings): dark steel, single-sided
  // solids. Lives in its own merged mesh ('structure') so the host's
  // hide-by-name of 'props' (real GLB props landing) never takes the stairs.
  const matStructure = new THREE.MeshStandardMaterial({ color: 0x4a515c, roughness: 0.7, metalness: 0.5, envMapIntensity: 0.6 });
  mats.push(matStructure);

  // The big surfaces must be LIGHTABLE even with no textures (texture loads
  // can fail on a flaky connection): near-black albedo reflects nothing under
  // the cinematic lamp rig, so lift the base reflectance up front. applyMap's
  // own lerp below is toward the same family, so double application is safe.
  matHull.color.lerp(new THREE.Color(0x6d7684), 0.55);
  matWall.color.lerp(new THREE.Color(0x67707e), 0.55);
  matDeck.color.lerp(new THREE.Color(0x6d7684), 0.55);
  matRib.color.lerp(new THREE.Color(0x5a6270), 0.45);

  // Optional grunge textures on the big shared surfaces (caller owns/disposes
  // the textures — dispose() here never touches them). The material color is
  // lightened toward mid-grey so the map reads as the surface instead of
  // multiplying to black.
  const textures = options.textures || null;
  const applyMap = (material, texture, normal, repX, repY, opts = {}) => {
    if (!texture) return;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repX, repY);
    texture.needsUpdate = true;
    material.map = texture;
    if (normal) {
      normal.wrapS = THREE.RepeatWrapping; normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(repX, repY); normal.needsUpdate = true;
      material.normalMap = normal;
      material.normalScale = new THREE.Vector2(opts.normal ?? 0.9, opts.normal ?? 0.9);
    } else {
      material.bumpMap = texture; material.bumpScale = 0.4;
    }
    if (opts.roughness != null) material.roughness = opts.roughness;
    if (opts.metalness != null) material.metalness = opts.metalness;
    material.color.lerp(new THREE.Color(0x9096a2), 0.9);
    material.needsUpdate = true;
  };
  if (textures) {
    applyMap(matHull, textures.hull, textures.hullN, 6, 3, { roughness: 0.62, metalness: 0.55 });   // armor: metal
    applyMap(matWall, textures.wall, textures.wallN, 3, 2, { roughness: 0.74, metalness: 0.4 });    // bulkheads
    applyMap(matDeck, textures.deck, textures.deckN, 6, 3, { roughness: 0.42, metalness: 0.3, normal: 1.1 }); // wet deck: low roughness
  }

  const cRim = new THREE.Color(PALETTE.cyan).multiplyScalar(0.10); // was 0.38: the Tron outline
  const matRim = basic(cRim.getHex());                       // cutaway slice rim (low intensity)
  const matCyanA = basic(PALETTE.cyan);                      // cyan accents (static)
  const matAmberA = basic(PALETTE.amber);                    // amber accents (static)
  const matLamp = basic(PALETTE.amber, { side: THREE.DoubleSide });
  const matScreenA = basic(PALETTE.screen);                  // flickers (phase A)
  const matScreenB = basic(PALETTE.screen);                  // flickers (phase B)
  const matLED = basic(0xffffff);                            // blinks; per-instance tint
  const matGhost = basic(PALETTE.cyanSoft, {                 // holo cone / viewport / core glass
    transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const matCore = basic(PALETTE.cyanSoft);                   // pulses
  const matBeam = basic(PALETTE.cyan, {                      // QC scanner sweep
    transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const matReactor = basic(PALETTE.amber);                   // throbs
  const matThrust = basic(PALETTE.amberDeep, {               // thruster glow discs
    transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, depthWrite: false,
  });

  // Base colors kept for no-alloc modulation in update()
  const baseScreen = new THREE.Color(PALETTE.screen);
  const baseCore = new THREE.Color(PALETTE.cyanSoft);
  const baseReactor = new THREE.Color(PALETTE.amber);
  const baseThrust = new THREE.Color(PALETTE.amberDeep);

  // ── merge bags ─────────────────────────────────────────────────────────────
  const bagHull = new MergeBag();      // armored outer skin
  const bagHullDark = new MergeBag();  // back hull wall, seams, dark plating
  const bagDeck = new MergeBag();      // two floor slabs
  const bagWall = new MergeBag();      // deck end walls, room back panels, wall boards
  const bagProp = new MergeBag();      // desks, chairs, arches, rails, misc props
  const bagRim = new MergeBag();       // emissive cutaway rim + faint shaft edges
  const bagCyan = new MergeBag();      // bright cyan accents
  const bagAmber = new MergeBag();     // bright amber accents
  const bagGhost = new MergeBag();     // additive translucent cyan volumes
  const bagStructure = new MergeBag(); // open-deck steel: ribs, stairs, railings

  // ── stairwells (one per LADDERS x) ────────────────────────────────────────
  // Switchback stair between decks, flights running along z so the whole
  // thing fits in a 104-wide strip: the lower flight (A, on the -X side) climbs
  // from the walk lane toward the back wall, a landing turns it, and the upper
  // flight (B, centered just +X of the ladder x, where crew climb) comes back
  // toward the cutaway edge and arrives through a hole in the deck-0 slab.
  // Everything here is derived from the same numbers so the slab cut, rails
  // and treads agree.
  const STAIR = { rises: 14, tread: 22, pitch: 14, w: 52, landingD: 40, off: 10 };
  const stairwells = shaftXs.map((sx) => {
    const xB = sx + STAIR.off;             // upper flight center (crew climb at sx)
    const xA = xB - STAIR.w;               // lower flight center, side by side
    const zFirst = WALK_Z - 26;            // first tread center: one pitch behind the crew lane
    const zLast = zFirst - 5 * STAIR.pitch;// sixth tread center (-42)
    const zLandBack = zLast - STAIR.tread / 2 - STAIR.landingD; // -93
    return {
      sx, xB, xA, zFirst, zLast, zLandBack,
      hole: { x0: xB - STAIR.w / 2, x1: xB + STAIR.w / 2, z0: zLandBack, z1: 52 }, // deck-0 slab cut
    };
  });
  const inHole = (x) => stairwells.some((s) => x > s.hole.x0 - 2 && x < s.hole.x1 + 2);

  // ── 1. HULL SHELL ──────────────────────────────────────────────────────────
  // keel
  bagHull.box(1095, 26, 220, 67, -208, Z_MID);
  // top armor slab
  bagHull.box(1070, 18, 220, 75, HULL_3D.yTop, Z_MID);
  // nose taper (-X): sloped canopy + sloped keel + nose cap
  bagHull.box(215, 16, 220, -532, 172, Z_MID, 0, 0, 0.82);
  bagHull.box(215, 16, 220, -535, -122, Z_MID, 0, 0, -0.72);
  bagHull.box(34, 160, 210, -604, 25, -50);
  // stern armor block (+X) + fins
  bagHull.box(50, 450, 210, 645, 20, -55);
  bagHull.box(90, 20, 140, 618, 240, -60);
  bagHull.box(90, 20, 140, 620, -196, -60);

  // back hull wall (at zBack)
  bagHullDark.box(1090, 460, 14, 70, 22, HULL_3D.zBack + 7);
  // engine bay backdrop plate
  bagHullDark.box(10, 300, 180, engine.x1 - 4, -50, -60);

  // ribs: instanced frames along back wall + under top armor
  const ribGeom = new THREE.BoxGeometry(10, 440, 8);
  geoms.push(ribGeom);
  const ribMats = [];
  for (let i = 0; i < 14; i++) {
    const x = -440 + i * 77;
    ribMats.push(mat4(x, 22, HULL_3D.zBack + 18));                       // vertical, on back wall
    ribMats.push(mat4(x, HULL_3D.yTop - 13, Z_MID, Math.PI / 2, 0, 0, 1, 0.48, 1)); // ceiling rib
  }

  // ── 2. DECKS ───────────────────────────────────────────────────────────────
  // Nothing inside may run out past the exterior's own silhouette. Deck 0's
  // forward end reached x -545 where the measured top armour is still ~180
  // units BELOW the deck (the hull is a long low prow up to x ≈ -460), so the
  // slab poked out through the cutaway window. Walk each end inward until the
  // hull actually covers it — capped at SLAB_TRIM_MAX and never past a room,
  // so a bad profile can shorten a deck by at most a nose's worth.
  const SLAB_TRIM_MAX = 90;
  const deckSpan = (deck, x0, x1, ySurface, yUnder) => {
    const dr = rooms.filter((r) => r.deck === deck);
    const guardL = dr.length ? Math.min(...dr.map((r) => r.x0)) - 20 : x0;
    const guardR = dr.length ? Math.max(...dr.map((r) => r.x1)) + 20 : x1;
    const covered = (x) => HULL_TOP_Y(x) > ySurface + 8 && HULL_BOTTOM_Y(x) < yUnder - 8;
    let a = x0; const limA = Math.min(guardL, x0 + SLAB_TRIM_MAX);
    while (a < limA && !covered(a)) a += 5;
    let b = x1; const limB = Math.max(guardR, x1 - SLAB_TRIM_MAX);
    while (b > limB && !covered(b)) b -= 5;
    return [a, b];
  };
  const DECK0_SPAN = deckSpan(0, 22 - 1135 / 2, 22 + 1135 / 2, DECK_Y[0], DECK_Y[0] - SLAB_T);
  const DECK1_SPAN = deckSpan(1, 87 - 1065 / 2, 87 + 1065 / 2, DECK_Y[1], DECK_Y[1] - SLAB_T);

  // deck 0 (upper): drawn in pieces so each stairwell arrives through a real
  // opening (front z0..52 open in the hole's x-range; the back strip stays).
  {
    const D0 = { x0: DECK0_SPAN[0], x1: DECK0_SPAN[1], z0: -150, z1: 52, y: DECK_Y[0] - SLAB_T / 2 };
    const slab = (x0, x1, z0, z1) => { if (x1 - x0 > 0.5) bagDeck.box(x1 - x0, SLAB_T, z1 - z0, (x0 + x1) / 2, D0.y, (z0 + z1) / 2); };
    let cursor = D0.x0;
    for (const s of [...stairwells].sort((a, b) => a.hole.x0 - b.hole.x0)) {
      slab(cursor, s.hole.x0, D0.z0, D0.z1);              // full-depth run up to the hole
      slab(s.hole.x0, s.hole.x1, D0.z0, s.hole.z0);       // back strip behind the hole
      cursor = s.hole.x1;
    }
    slab(cursor, D0.x1, D0.z0, D0.z1);
  }
  // deck 1 (lower)
  bagDeck.box(DECK1_SPAN[1] - DECK1_SPAN[0], SLAB_T, 202, (DECK1_SPAN[0] + DECK1_SPAN[1]) / 2, DECK_Y[1] - SLAB_T / 2, -49);
  // panel seams (thin dark strips on the floor surface; none across a stairwell)
  for (let i = 0; i < 12; i++) {
    const x0 = -510 + i * 96;
    if (!inHole(x0)) bagHullDark.box(3, 1.6, 194, x0, DECK_Y[0] + 0.5, -49);
    if (i < 11) bagHullDark.box(3, 1.6, 194, -420 + i * 96, DECK_Y[1] + 0.5, -49);
  }

  // ── cutaway rim (slice at z ≈ zFront, like a cross-section diagram) ───────
  bagRim.box(1075, 5, 5, 75, HULL_3D.yTop - 7, 56);
  bagRim.box(1095, 5, 5, 67, -196, 56);
  bagRim.box(DECK0_SPAN[1] - DECK0_SPAN[0], 4, 4, (DECK0_SPAN[0] + DECK0_SPAN[1]) / 2, DECK_Y[0] - 3, 54);
  bagRim.box(DECK1_SPAN[1] - DECK1_SPAN[0], 4, 4, (DECK1_SPAN[0] + DECK1_SPAN[1]) / 2, DECK_Y[1] - 3, 54);
  bagRim.box(215, 5, 5, -532, 180, 56, 0, 0, 0.82);   // nose canopy slice
  bagRim.box(215, 5, 5, -535, -114, 56, 0, 0, -0.72); // nose keel slice
  bagRim.box(5, 168, 5, -604, 25, 57);                // nose cap slice
  bagRim.box(5, 448, 5, 645, 20, 52);                 // stern block slice

  // ── 3. ROOMS: open decks — structural ribs at bay boundaries + back panels ─
  // No partitions between bays any more (the owner wants open sightlines along
  // the whole deck, Nebuchadnezzar-style). Each former partition is a rib
  // pair: an I-beam column against the back wall and one at the cutaway edge,
  // tied by a ceiling cross-beam. Only the deck END walls stay solid.
  const partH = { 0: CEIL0 - DECK_Y[0], 1: CEIL1 - DECK_Y[1] };
  const partMidY = { 0: (CEIL0 + DECK_Y[0]) / 2, 1: (CEIL1 + DECK_Y[1]) / 2 };
  const partition = (x, deck) => {
    bagWall.box(10, partH[deck], 134, x, partMidY[deck], -73);
  };
  const Z_RIB_BACK = Z_ROOM_BACK + 10;   // -130: column face against the back panel
  const Z_RIB_FRONT = 58;                // at the cutaway slice, clear of the crew lane (z 34..46)
  // I-beam: web + two flanges, `h` tall, standing on `y0`
  const iBeam = (x, y0, z, h, ry = 0) => {
    const cy = y0 + h / 2;
    bagStructure.box(4, h, 14, x, cy, z, 0, ry);
    bagStructure.box(12, h, 3, x, cy, z - 8.5, 0, ry);
    bagStructure.box(12, h, 3, x, cy, z + 8.5, 0, ry);
  };
  const ribPair = (x, deck) => {
    const y0 = DECK_Y[deck]; const h = partH[deck];
    iBeam(x, y0, Z_RIB_BACK, h);
    iBeam(x, y0, Z_RIB_FRONT, h);
    // ceiling cross-beam joining the pair (12 wide, 14 deep in y)
    const zc = (Z_RIB_BACK + Z_RIB_FRONT) / 2;
    bagStructure.box(12, 14, Z_RIB_FRONT - Z_RIB_BACK, x, y0 + h - 7, zc);
    // gusset plates where the beam meets each column
    bagStructure.box(12, 10, 10, x, y0 + h - 19, Z_RIB_BACK + 12);
    bagStructure.box(12, 10, 10, x, y0 + h - 19, Z_RIB_FRONT - 12);
  };
  for (const deck of [0, 1]) {
    const dr = rooms.filter((r) => r.deck === deck).sort((a, b) => a.x0 - b.x0);
    for (let i = 0; i < dr.length - 1; i++) {
      const b = (dr[i].x1 + dr[i + 1].x0) / 2;
      if (shaftXs.some((sx) => Math.abs(sx - b) < 20)) continue; // stairwell seam: framed below
      ribPair(b, deck);
    }
  }
  partition(585, 0);                 // deck 0 aft end wall
  partition(-435, 1);                // deck 1 fore end wall
  // finance | engine bulkhead: back portion only, so the reactor stays clear
  bagWall.box(10, partH[1], 60, engine.x0 - 2, partMidY[1], -110);
  // Room back panels (in front of the hull back wall). Stepped to the SAME
  // hull profile roomWalls.js paints to (bayProfileAt), plus a 6-unit frame,
  // so the grey structural panel never shows above or below the lit painted
  // one where the hull tapers. Ten steps across a bay: the painted panel
  // covers all but a thin border, so the stepping is not visible.
  const PANEL_COLS = 10;
  for (const r of rooms) {
    const xa = r.cx - (r.w - 6) / 2, xb = r.cx + (r.w - 6) / 2;
    const step = (xb - xa) / PANEL_COLS;
    for (let i = 0; i < PANEL_COLS; i++) {
      const xc = xa + (i + 0.5) * step;
      const e = bayProfileAt(xc, r.floor, r.ceil);
      const top = Math.min(r.ceil, e.top + 6);
      const bot = Math.max(r.floor, e.bottom - 6);
      if (top - bot < 2) continue;
      bagWall.box(step + 0.6, top - bot, 6, xc, (top + bot) / 2, Z_ROOM_BACK + 3);
    }
  }

  // ── instanced prop collections ─────────────────────────────────────────────
  const screenAMats = []; const screenAColors = [];
  const screenBMats = []; const screenBColors = [];
  const lampMats = [];
  const bunkMats = [];
  const crateMats = [];
  const rackMats = [];
  const ledMats = []; const ledColors = [];
  const _c = new THREE.Color();

  const addScreen = (seed, x, y, z, rx = -0.16, ry = 0) => {
    const tint = 0.82 + 0.18 * hash01(seed);
    const m = mat4(x, y, z, rx, ry, 0);
    if (seed % 2 === 0) { screenAMats.push(m); screenAColors.push(new THREE.Color(tint, tint, tint)); }
    else { screenBMats.push(m); screenBColors.push(new THREE.Color(tint, tint, tint)); }
  };
  const addLamps = (cx, w, ceilY) => {
    lampMats.push(mat4(cx - w * 0.25, ceilY - 4, -55));
    lampMats.push(mat4(cx + w * 0.25, ceilY - 4, -55));
  };
  const addLED = (seed, x, y, z) => {
    ledMats.push(mat4(x, y, z));
    _c.set(hash01(seed) < 0.6 ? PALETTE.cyan : PALETTE.amber);
    ledColors.push(_c.clone());
  };

  // dynamic handles filled while building rooms
  let coreInner = null;
  let beam = null; let beamBaseX = 0;
  let pistonShaft = null; let pistonBaseY = 0;

  // ── per-kind room builders ─────────────────────────────────────────────────
  const buildConsoles = (r, ri) => {
    const deskW = r.w * 0.62;
    for (const [row, zRow] of [[0, -78], [1, -26]]) {
      bagProp.box(deskW, 30, 24, r.cx, r.floor + 15, zRow);
      const n = row === 0 ? (r.w > 150 ? 3 : 2) : 1;
      for (let k = 0; k < n; k++) {
        const x = r.cx + (k - (n - 1) / 2) * 34;
        addScreen(ri * 7 + row * 3 + k, x, r.floor + 50, zRow - 10, -0.16);
      }
    }
    // chairs (seat + backrest)
    for (const sx of [-1, 1]) {
      const x = r.cx + sx * r.w * 0.16;
      bagProp.box(14, 5, 14, x, r.floor + 13, -52);
      bagProp.box(14, 16, 4, x, r.floor + 23, -44);
    }
  };

  const buildBridge = (r) => {
    // angled viewport frame on the nose wall
    const vp = { x: -500, y: 150, z: -60, rz: 0.78 };
    const cos = Math.cos(vp.rz); const sin = Math.sin(vp.rz);
    const off = (ox, oy) => [vp.x + ox * cos - oy * sin, vp.y + ox * sin + oy * cos];
    let p = off(0, 38); bagProp.box(140, 7, 7, p[0], p[1], vp.z, 0, 0, vp.rz);
    p = off(0, -38); bagProp.box(140, 7, 7, p[0], p[1], vp.z, 0, 0, vp.rz);
    p = off(66, 0); bagProp.box(7, 83, 7, p[0], p[1], vp.z, 0, 0, vp.rz);
    p = off(-66, 0); bagProp.box(7, 83, 7, p[0], p[1], vp.z, 0, 0, vp.rz);
    bagGhost.plane(128, 70, vp.x, vp.y, vp.z, 0, 0, vp.rz); // viewport glass
    // holo table: base + emissive cyan projection cone
    bagProp.add(new THREE.CylinderGeometry(16, 20, 12, 12), mat4(r.cx, r.floor + 6, -55));
    bagCyan.add(new THREE.CylinderGeometry(13, 13, 3, 12), mat4(r.cx, r.floor + 13, -55));
    bagGhost.add(new THREE.ConeGeometry(26, 56, 14, 1, true), mat4(r.cx, r.floor + 42, -55, Math.PI, 0, 0));
    // two pilot consoles
    bagProp.box(46, 26, 20, r.cx - 60, r.floor + 13, -30);
    bagProp.box(46, 26, 20, r.cx + 60, r.floor + 13, -30);
    addScreen(101, r.cx - 60, r.floor + 44, -38, -0.22, 0.12);
    addScreen(102, r.cx + 60, r.floor + 44, -38, -0.22, -0.12);
  };

  const buildGrid = (r) => {
    // big wall board: 8 slots (cyan/amber mix)
    bagWall.box(124, 84, 5, r.cx, r.floor + 80, Z_ROOM_BACK + 7);
    const amberIdx = [1, 4, 6];
    for (let i = 0; i < 8; i++) {
      const col = i % 4; const row = (i / 4) | 0;
      const x = r.cx - 45 + col * 30;
      const y = r.floor + 62 + row * 30;
      const bag = amberIdx.includes(i) ? bagAmber : bagCyan;
      bag.plane(24, 15, x, y, Z_ROOM_BACK + 10.2);
    }
    bagProp.box(90, 24, 20, r.cx, r.floor + 12, -40); // ops console
  };

  const buildLab = (r) => {
    // scanner arch (half torus standing on the floor) + sweeping beam
    bagProp.add(new THREE.TorusGeometry(48, 5, 8, 16, Math.PI), mat4(r.cx, r.floor, -55));
    const beamGeom = new THREE.PlaneGeometry(10, 42);
    geoms.push(beamGeom);
    beam = new THREE.Mesh(beamGeom, matBeam);
    beam.position.set(r.cx, r.floor + 22, -55);
    beamBaseX = r.cx;
    group.add(beam);
    bagProp.box(70, 10, 30, r.cx, r.floor + 5, -55); // scan bed
  };

  const buildSecurity = (r) => {
    // vertical bar gate
    for (let k = 0; k < 5; k++) {
      bagCyan.box(3.5, 146, 3.5, r.cx - 36 + k * 18, r.floor + 73, 8);
    }
    bagProp.box(84, 5, 8, r.cx, r.floor + 148, 8); // gate header rail
    // status panel with blinking LEDs
    bagWall.box(22, 28, 5, r.cx + 70, r.floor + 60, Z_ROOM_BACK + 7);
    for (let k = 0; k < 4; k++) {
      addLED(900 + k, r.cx + 63 + (k % 2) * 14, r.floor + 54 + ((k / 2) | 0) * 12, Z_ROOM_BACK + 10.2);
    }
  };

  const buildCore = (r) => {
    // the visual heart amidships: glass chamber + pulsing inner core
    bagGhost.add(new THREE.CylinderGeometry(52, 52, 176, 18, 1, true), mat4(r.cx, r.floor + 88, -50));
    const coreGeom = new THREE.CylinderGeometry(15, 15, 150, 12);
    geoms.push(coreGeom);
    coreInner = new THREE.Mesh(coreGeom, matCore);
    coreInner.position.set(r.cx, r.floor + 85, -50);
    group.add(coreInner);
    bagProp.add(new THREE.CylinderGeometry(58, 62, 10, 18), mat4(r.cx, r.floor + 5, -50)); // pedestal
    bagCyan.add(new THREE.TorusGeometry(55, 2.5, 6, 24), mat4(r.cx, r.floor + 11, -50, Math.PI / 2, 0, 0));
    bagCyan.add(new THREE.TorusGeometry(55, 2.5, 6, 24), mat4(r.cx, r.ceil - 8, -50, Math.PI / 2, 0, 0));
  };

  const buildMachines = (r, ri) => {
    // server racks + LED dots
    for (let k = 0; k < 4; k++) {
      const x = r.x0 + 25 + k * 36;
      rackMats.push(mat4(x, r.floor + 46, -105));
      for (let j = 0; j < 4; j++) {
        addLED(ri * 31 + k * 4 + j, x - 8 + 16 * hash01(k * 9 + j), r.floor + 76 - j * 16, -89.4);
      }
    }
    // piston: housing + cycling shaft
    bagProp.add(new THREE.CylinderGeometry(11, 13, 36, 10), mat4(r.x1 - 22, r.floor + 18, -40));
    const shaftGeom = new THREE.BoxGeometry(9, 54, 9);
    geoms.push(shaftGeom);
    pistonShaft = new THREE.Mesh(shaftGeom, matRib);
    pistonBaseY = r.floor + 44;
    pistonShaft.position.set(r.x1 - 22, pistonBaseY, -40);
    group.add(pistonShaft);
    bagProp.box(26, 8, 26, r.x1 - 22, r.floor + 74, -40); // press head rest
  };

  const buildBunks = (r) => {
    // two rows of stacked bunk frames
    for (const colX of [r.cx - 47, r.cx + 47]) {
      for (const zRow of [-95, -45]) {
        for (const lvl of [32, 70]) {
          bunkMats.push(mat4(colX, r.floor + lvl, zRow));
        }
        // corner posts per stack
        bagProp.box(4, 76, 4, colX - 34, r.floor + 40, zRow + 16);
        bagProp.box(4, 76, 4, colX + 34, r.floor + 40, zRow + 16);
      }
    }
  };

  const buildVault = (r) => {
    // circular vault door on the back wall: torus + spokes + hub + glow ring
    const dy = r.floor + 72;
    bagProp.add(new THREE.TorusGeometry(34, 6, 8, 20), mat4(r.cx, dy, Z_ROOM_BACK + 8));
    for (let k = 0; k < 3; k++) {
      bagProp.box(58, 5, 5, r.cx, dy, Z_ROOM_BACK + 10, 0, 0, k * Math.PI / 3);
    }
    bagProp.add(new THREE.CylinderGeometry(9, 9, 10, 10), mat4(r.cx, dy, Z_ROOM_BACK + 10, Math.PI / 2, 0, 0));
    bagRim.add(new THREE.TorusGeometry(34, 1.6, 6, 20), mat4(r.cx, dy, Z_ROOM_BACK + 13));
    // crate stacks
    const spots = [
      [r.cx - 33, 13, -55], [r.cx - 3, 13, -45], [r.cx + 27, 13, -62],
      [r.cx - 18, 39, -50], [r.cx + 12, 39, -58], [r.cx - 43, 13, -20], [r.cx + 42, 13, -25],
    ];
    spots.forEach(([x, y, z], i) => {
      const s = 0.85 + 0.3 * hash01(i * 13 + 5);
      crateMats.push(mat4(x, r.floor + y * s, z, 0, hash01(i * 7) * 0.6 - 0.3, 0, s, s, s));
    });
  };

  // dispatch
  rooms.forEach((r, ri) => {
    addLamps(r.cx, r.w, r.ceil);
    switch (r.kind) {
      case 'bridge': buildBridge(r); break;
      case 'consoles': buildConsoles(r, ri); break;
      case 'grid': buildGrid(r); break;
      case 'lab': buildLab(r); break;
      case 'security': buildSecurity(r); break;
      case 'core': buildCore(r); break;
      case 'machines': buildMachines(r, ri); break;
      case 'bunks': buildBunks(r); break;
      case 'vault': buildVault(r); break;
      default: break;
    }
  });

  // ── 4. ENGINE ROOM (+X end, deck 1) ────────────────────────────────────────
  const reactorGeom = new THREE.CylinderGeometry(13, 15, 112, 14);
  geoms.push(reactorGeom);
  const reactor = new THREE.Mesh(reactorGeom, matReactor);
  reactor.position.set(engine.cx + 1, engine.floor + 58, -60);
  group.add(reactor);
  // containment rings
  for (const ry of [30, 58, 86]) {
    bagProp.add(new THREE.TorusGeometry(17, 3, 6, 14), mat4(engine.cx + 1, engine.floor + ry, -60, Math.PI / 2, 0, 0));
  }
  bagProp.box(30, 8, 36, engine.cx + 1, engine.floor + 4, -60); // reactor base
  lampMats.push(mat4(engine.cx, CEIL1 - 4, -60));
  // amber vents on the stern block face
  for (let k = 0; k < 3; k++) bagAmber.box(26, 5, 4, 640, 60 + k * 34, 53);

  // thruster cones poking out the +X hull, with amber glow discs
  const coneGeom = new THREE.ConeGeometry(16, 46, 10);
  coneGeom.rotateZ(Math.PI / 2); // apex -X (into hull), open base faces +X
  geoms.push(coneGeom);
  const coneMats = [];
  const glowGeom = new THREE.CircleGeometry(14, 16);
  glowGeom.rotateY(Math.PI / 2); // face +X
  geoms.push(glowGeom);
  const glowMats = [];
  for (const [i, zc] of [[0, -110], [1, -50], [2, 10]]) {
    coneMats.push(mat4(688, -60, zc));
    glowMats.push(mat4(713, -60, zc));
  }

  // ── 5. STAIRS + RAILINGS (replace the lift-shaft ladders) ──────────────────
  // Steel helpers. Cylinders are built axis-Y; rotate the template so the
  // axis lies along the run, then place it with mat4.
  const RAIL_R = 2.2; const MID_R = 1.6; const RAIL_H = 42; const MID_H = 21;
  const cylX = (x0, x1, y, z, r) => {
    const g = new THREE.CylinderGeometry(r, r, Math.abs(x1 - x0), 8); g.rotateZ(Math.PI / 2);
    bagStructure.add(g, mat4((x0 + x1) / 2, y, z));
  };
  const cylZ = (z0, z1, x, y, r) => {
    const g = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), 8); g.rotateX(Math.PI / 2);
    bagStructure.add(g, mat4(x, y, (z0 + z1) / 2));
  };
  // sloped member in the YZ plane from (z0,y0) to (z1,y1): cylinder or box
  const slopeRx = (dz, dy) => Math.atan2(-dy, dz);
  const cylSlope = (x, z0, y0, z1, y1, r) => {
    const L = Math.hypot(z1 - z0, y1 - y0);
    const g = new THREE.CylinderGeometry(r, r, L, 8); g.rotateX(Math.PI / 2);
    bagStructure.add(g, mat4(x, (y0 + y1) / 2, (z0 + z1) / 2, slopeRx(z1 - z0, y1 - y0)));
  };
  const boxSlope = (x, z0, y0, z1, y1, w, h) => {
    const L = Math.hypot(z1 - z0, y1 - y0);
    bagStructure.add(new THREE.BoxGeometry(w, h, L), mat4(x, (y0 + y1) / 2, (z0 + z1) / 2, slopeRx(z1 - z0, y1 - y0)));
  };
  const post = (x, y0, z, h = RAIL_H) => bagStructure.box(3, h, 3, x, y0 + h / 2, z);
  // straight double rail (top + mid) along x with posts every `every`
  const railX = (x0, x1, y0, z, every = 90) => {
    if (x1 - x0 < 6) return;
    cylX(x0, x1, y0 + RAIL_H, z, RAIL_R);
    cylX(x0, x1, y0 + MID_H, z, MID_R);
    const n = Math.max(1, Math.round((x1 - x0) / every));
    for (let k = 0; k <= n; k++) post(x0 + (x1 - x0) * (k / n), y0, z);
  };
  const railZ = (z0, z1, y0, x, every = 90) => {
    if (Math.abs(z1 - z0) < 6) return;
    cylZ(z0, z1, x, y0 + RAIL_H, RAIL_R);
    cylZ(z0, z1, x, y0 + MID_H, MID_R);
    const n = Math.max(1, Math.round(Math.abs(z1 - z0) / every));
    for (let k = 0; k <= n; k++) post(x, y0, z0 + (z1 - z0) * (k / n));
  };

  const RISE = (DECK_Y[0] - DECK_Y[1]) / STAIR.rises;   // 14.29 per step
  const stepY = (i) => DECK_Y[1] + i * RISE;             // tread top of rise i
  for (const s of stairwells) {
    const { xA, xB, zFirst, zLast, zLandBack } = s;
    const hw = STAIR.w / 2;
    const yLand = stepY(7);
    const zLandFront = zLast - STAIR.tread / 2;          // landing meets flight A's top tread
    // flight A (lower): treads 1..6 climbing toward the back wall
    for (let i = 1; i <= 6; i++) {
      const zc = zFirst - (i - 1) * STAIR.pitch;
      bagStructure.box(STAIR.w, 6, STAIR.tread, xA, stepY(i) - 3, zc);
      bagStructure.box(STAIR.w - 6, RISE - 6, 2, xA, stepY(i) - 3 - RISE / 2, zc + STAIR.tread / 2 - 1); // riser plate
    }
    // landing: spans both flights, turns the run
    bagStructure.box(STAIR.w * 2, 6, STAIR.landingD, (xA + xB) / 2, yLand - 3, (zLandBack + zLandFront) / 2);
    // flight B (upper): treads 8..13 climbing back toward the cutaway edge
    for (let i = 8; i <= 13; i++) {
      const zc = zLast + (i - 8) * STAIR.pitch;
      bagStructure.box(STAIR.w, 6, STAIR.tread, xB, stepY(i) - 3, zc);
      bagStructure.box(STAIR.w - 6, RISE - 6, 2, xB, stepY(i) - 3 - RISE / 2, zc - STAIR.tread / 2 + 1);
    }
    // arrival plate at deck level: fills the hole in front of the last tread
    const zArrive = zLast + 6 * STAIR.pitch - STAIR.tread / 2;  // where rise 14 (the deck) begins
    bagStructure.box(STAIR.w, 6, s.hole.z1 - zArrive, xB, DECK_Y[0] - 3, (zArrive + s.hole.z1) / 2);
    // stringers: one each side of each flight, running under the nosings
    // (endpoints sit on the nosing line: rise 0 on the lower deck, rise 7 the landing, rise 14 the deck)
    const aZ0 = zFirst + STAIR.tread / 2 + STAIR.pitch, aY0 = DECK_Y[1];
    const aZ1 = zFirst - 6 * STAIR.pitch + STAIR.tread / 2, aY1 = yLand;
    const bZ0 = zLast - STAIR.pitch - STAIR.tread / 2, bY0 = yLand;
    const bZ1 = zArrive, bY1 = DECK_Y[0];
    for (const dx of [-hw + 2, hw - 2]) {
      boxSlope(xA + dx, aZ0, aY0 - 8, aZ1, aY1 - 8, 4, 12);
      boxSlope(xB + dx, bZ0, bY0 - 8, bZ1, bY1 - 8, 4, 12);
    }
    // landing support: two columns to the lower deck + an edge beam
    bagStructure.box(6, yLand - DECK_Y[1], 6, xA - hw + 3, (yLand + DECK_Y[1]) / 2, zLandBack + 3);
    bagStructure.box(6, yLand - DECK_Y[1], 6, xB + hw - 3, (yLand + DECK_Y[1]) / 2, zLandBack + 3);
    bagStructure.box(STAIR.w * 2, 8, 4, (xA + xB) / 2, yLand - 10, zLandFront + 2);
    // handrails: outer edge of each flight (posts every 3 rises), then around the landing
    const xRailA = xA - hw; const xRailB = xB + hw;
    cylSlope(xRailA, aZ0 - STAIR.pitch, aY0 + 2 + RAIL_H, aZ1, aY1 + 2 + RAIL_H, RAIL_R);
    cylSlope(xRailA, aZ0 - STAIR.pitch, aY0 + 2 + MID_H, aZ1, aY1 + 2 + MID_H, MID_R);
    for (const i of [1, 4]) post(xRailA, stepY(i), zFirst - (i - 1) * STAIR.pitch + STAIR.tread / 2, RAIL_H + 2);
    cylSlope(xRailB, bZ0, bY0 + 2 + RAIL_H, bZ1 + STAIR.pitch, bY1 + 2 + RAIL_H, RAIL_R);
    cylSlope(xRailB, bZ0, bY0 + 2 + MID_H, bZ1 + STAIR.pitch, bY1 + 2 + MID_H, MID_R);
    for (const i of [8, 11]) post(xRailB, stepY(i), zLast + (i - 8) * STAIR.pitch - STAIR.tread / 2, RAIL_H + 2);
    railZ(zLandFront, zLandBack, yLand, xRailA, 60);     // landing -X edge
    railX(xRailA, xRailB, yLand, zLandBack, 60);         // landing back edge
    railZ(zLandBack, zLandFront, yLand, xRailB, 60);     // landing +X edge
    // center divider rail between the two flights (on the shared edge)
    post(xA + hw, DECK_Y[1], zFirst + STAIR.tread / 2 + 2, RAIL_H + 8);
    cylSlope(xA + hw, aZ0 - STAIR.pitch, aY0 + 2 + RAIL_H, aZ1, aY1 + 2 + RAIL_H, RAIL_R);
    cylSlope(xA + hw, bZ0, bY0 + 2 + RAIL_H, bZ1 + STAIR.pitch, bY1 + 2 + RAIL_H, RAIL_R);
    // stairwell frame: two full-height columns against the back wall tie the
    // decks together, with a beam under the deck-0 ceiling between them
    const H_ALL = CEIL0 - DECK_Y[1];
    iBeam(xA - hw - 8, DECK_Y[1], Z_RIB_BACK + 2, H_ALL);
    iBeam(xB + hw + 8, DECK_Y[1], Z_RIB_BACK + 2, H_ALL);
    bagStructure.box((xB + hw + 8) - (xA - hw - 8), 14, 14, (xA + xB) / 2, CEIL0 - 7, Z_RIB_BACK + 2);
    // hatch surround on deck 0: rails along both sides and the back of the opening
    const { x0: hx0, x1: hx1, z0: hz0, z1: hz1 } = s.hole;
    railZ(hz1 - 2, hz0 - 3, DECK_Y[0], hx0 - 3, 60);
    railZ(hz1 - 2, hz0 - 3, DECK_Y[0], hx1 + 3, 60);
    railX(hx0 - 3, hx1 + 3, DECK_Y[0], hz0 - 3, 60);
    // kick plate (coaming) around the opening
    bagStructure.box(4, 5, hz1 - hz0, hx0 - 2, DECK_Y[0] + 2.5, (hz0 + hz1) / 2);
    bagStructure.box(4, 5, hz1 - hz0, hx1 + 2, DECK_Y[0] + 2.5, (hz0 + hz1) / 2);
  }
  // deck-0 edge railing along the cutaway, broken only at the stair openings
  {
    const Z_EDGE = 48; const x0 = 22 - 1135 / 2 + 4; const x1 = 22 + 1135 / 2 - 4;
    let cursor = x0;
    for (const s of [...stairwells].sort((a, b) => a.hole.x0 - b.hole.x0)) {
      railX(cursor, s.hole.x0 - 3, DECK_Y[0], Z_EDGE);
      cursor = s.hole.x1 + 3;
    }
    railX(cursor, x1, DECK_Y[0], Z_EDGE);
  }

  // ── build merged meshes ────────────────────────────────────────────────────
  const addMerged = (bag, material, name) => {
    if (bag.vcount === 0) return null;
    const g = bag.build();
    geoms.push(g);
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };
  addMerged(bagHull, matHull, 'hull');
  addMerged(bagHullDark, matHullDark, 'hullDark');
  addMerged(bagDeck, matDeck, 'decks');
  addMerged(bagWall, matWall, 'walls');
  addMerged(bagProp, matRib, 'props');
  addMerged(bagRim, matRim, 'cutawayRim');
  addMerged(bagCyan, matCyanA, 'cyanAccents');
  addMerged(bagAmber, matAmberA, 'amberAccents');
  addMerged(bagGhost, matGhost, 'holoVolumes');
  addMerged(bagStructure, matStructure, 'structure');

  // ── build instanced meshes ─────────────────────────────────────────────────
  const instanced = [];
  const addInstanced = (geom, material, matrices, colors, name) => {
    if (!matrices.length) return null;
    geoms.push(geom);
    const im = new THREE.InstancedMesh(geom, material, matrices.length);
    for (let i = 0; i < matrices.length; i++) {
      im.setMatrixAt(i, matrices[i]);
      if (colors) im.setColorAt(i, colors[i]);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.name = name;
    group.add(im);
    instanced.push(im);
    return im;
  };
  addInstanced(ribGeom, matRib, ribMats, null, 'ribs');
  addInstanced(new THREE.PlaneGeometry(26, 16), matScreenA, screenAMats, screenAColors, 'screensA');
  addInstanced(new THREE.PlaneGeometry(26, 16), matScreenB, screenBMats, screenBColors, 'screensB');
  const lampGeom = new THREE.PlaneGeometry(16, 9);
  lampGeom.rotateX(Math.PI / 2); // horizontal quad under the ceiling
  addInstanced(lampGeom, matLamp, lampMats, null, 'lamps');
  addInstanced(new THREE.BoxGeometry(64, 6, 36), matWall, bunkMats, null, 'bunks');
  addInstanced(new THREE.BoxGeometry(26, 26, 26), matRib, crateMats, null, 'crates');
  addInstanced(new THREE.BoxGeometry(34, 92, 30), matHullDark, rackMats, null, 'racks');
  addInstanced(new THREE.PlaneGeometry(3.4, 3.4), matLED, ledMats, ledColors, 'leds');
  addInstanced(coneGeom, matHull, coneMats, null, 'thrusters');
  addInstanced(glowGeom, matThrust, glowMats, null, 'thrusterGlow');

  // ── 6. LIGHTS (≤3 real lights; host provides ambient) ──────────────────────
  const coreRoom = rooms.find((r) => r.kind === 'core');
  const lightCore = new THREE.PointLight(PALETTE.cyan, 1.6, 520, 1.8);
  lightCore.position.set(coreRoom.cx, coreRoom.floor + 90, 10);
  group.add(lightCore);
  const lightEngine = new THREE.PointLight(PALETTE.amber, 1.4, 420, 1.8);
  lightEngine.position.set(engine.cx, engine.floor + 80, -10);
  group.add(lightEngine);

  // ── anchors ────────────────────────────────────────────────────────────────
  const anchors = new Map();
  for (const r of rooms) anchors.set(r.id, new THREE.Vector3(r.cx, DECK_Y[r.deck], WALK_Z));
  anchors.set('engine', new THREE.Vector3(engine.cx, DECK_Y[1], WALK_Z));

  // ── update (zero allocations) ──────────────────────────────────────────────
  function update(t) {
    // screen flicker (two phase groups)
    const fA = 0.84 + 0.11 * Math.sin(t * 13.3) + 0.05 * Math.sin(t * 3.1 + 1.7);
    const fB = 0.84 + 0.11 * Math.sin(t * 11.1 + 2.4) + 0.05 * Math.sin(t * 4.2);
    matScreenA.color.copy(baseScreen).multiplyScalar(fA);
    matScreenB.color.copy(baseScreen).multiplyScalar(fB);

    // core pulse — the heartbeat amidships
    const p = 0.5 + 0.5 * Math.sin(t * 2.1);
    matCore.color.copy(baseCore).multiplyScalar(0.75 + 0.55 * p);
    lightCore.intensity = 1.1 + 1.1 * p;
    if (coreInner) {
      const cs = 1 + 0.05 * p;
      coreInner.scale.set(cs, 1, cs);
    }

    // reactor throb + thruster glow
    const rTh = 0.5 + 0.5 * Math.sin(t * 4.6 + 0.7);
    matReactor.color.copy(baseReactor).multiplyScalar(0.7 + 0.5 * rTh);
    lightEngine.intensity = 1.0 + 0.9 * rTh;
    matThrust.color.copy(baseThrust).multiplyScalar(0.8 + 0.6 * Math.sin(t * 9.3) * 0.5 + 0.3);

    // QC scanner beam sweep
    if (beam) beam.position.x = beamBaseX + 22 * Math.sin(t * 0.7);

    // automation piston cycle
    if (pistonShaft) pistonShaft.position.y = pistonBaseY + 14 * Math.sin(t * 1.15);

    // LED blink
    const blink = Math.sin(t * 6.1) > 0.15 ? 1 : 0.3;
    matLED.color.setRGB(blink, blink, blink);
  }

  // ── API ────────────────────────────────────────────────────────────────────
  return {
    group,
    rooms,
    update,
    getStationAnchor(id) {
      const a = anchors.get(id);
      return a ? a.clone() : null;
    },
    dispose() {
      for (const im of instanced) im.dispose();
      for (const g of geoms) g.dispose();
      for (const m of mats) m.dispose();
      if (group.parent) group.parent.remove(group);
      group.clear();
    },
  };
}
