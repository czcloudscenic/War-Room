import React, { Suspense, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WORLD_W, ROOMS, DECKS as LOGICAL_DECKS } from '../../ship/world.js';
import { toSceneX, DECK_Y, DECK_CLEAR, WALK_Z, ROOM_DEPTH, CAMERA, HULL_3D } from '../../ship/scene3dContract.js';
import { STATIONS } from '../../core/shipStations.js';
import { createShipSim } from '../../ship/shipEngine.js';
import { createCrewFigure } from '../../ship/crewGLB.js';
import { createShipModel } from '../../ship/shipModel.js';
import { createEnvironment } from '../../ship/environment3d.js';
import { createGreebles } from '../../ship/greebles.js';
import { createTunnel } from '../../ship/tunnel.js';
import { createSentinels3D } from '../../ship/sentinels3d.js';
import { createHullGLB } from '../../ship/hullGLB.js';
import { createRoomProps } from '../../ship/roomProps.js';
import { createRoomWalls } from '../../ship/roomWalls.js';
import { stationLightFor, RIM_RATIO } from '../../ship/stationPalette.js';
import { createLightShafts } from '../../ship/lightShafts.js';
import ShipHUD from './ShipHUD.jsx';

// Grunge textures generated for the cinematic pass (public/textures/). Loaded
// leniently: a missing file just means that surface stays flat-colored.
function loadShipTextures(onDone) {
  const loader = new THREE.TextureLoader();
  const out = { hull: null, wall: null, deck: null, hullN: null, wallN: null, deckN: null };
  let pending = 6;
  const finish = () => { if (--pending === 0) onDone(out); };
  for (const key of ['hull', 'wall', 'deck']) {
    loader.load(
      `/textures/ship-${key}.jpg`,
      (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; out[key] = tex; finish(); },
      undefined,
      () => { console.warn(`[ship] texture FAILED: ${key}`); finish(); }
    );
    // Sobel normal maps derived from the same tiles (linear, not sRGB).
    loader.load(
      `/textures/ship-${key}-n.jpg`,
      (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; out[key + 'N'] = tex; finish(); },
      undefined,
      () => { finish(); }
    );
  }
}

// Post chain: filmic tone mapping + bloom is what turns flat emissive quads
// into actual lights. Uses three's bundled passes — no new dependencies.
function Effects() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.7;
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    // Bloom is seasoning, not the dish: 0.75 turned every emissive into neon.
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.28, 0.5, 0.86));
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);
  useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size.width, size.height]);
  useFrame(() => composer.render(), 1);
  useEffect(() => () => composer.dispose(), [composer]);
  return null;
}

// ── Phase 2: the modeled ship ────────────────────────────────────────────────
// No more painted backdrop — a real low-poly cutaway hull with 12 built rooms,
// the city and storm outside, and the crew walking real floors. The 2D engine
// remains the single source of truth: logical positions map into 3D here and
// nowhere else. Movement rule unchanged: receipts move people, nothing else.

const mono = { fontFamily: "'Geist Mono', monospace" };
const WORLD_CREW_SCALE = 2.05;

// ── Painted backdrop behind the modeled world (the concept-art plates) ──────
// Same plates the painted view streams; here they sit behind the 3D city so
// the horizon and storm read as painting instead of gradient.
// 2026-09-14: none. The ship stays in the tunnel (tunnel.js encloses the hull),
// so no painted city plates; the list stays so a plate can come back later.
const BACKDROP = [];
function BackdropPlate({ url, z, w, h, speed, opacity = 1, y = 0, tint = 0xffffff }) {
  const base = useLoader(THREE.TextureLoader, url);
  const tex = useMemo(() => { const t = base.clone(); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; }, [base]);
  useFrame((state, delta) => { tex.offset.x -= speed * delta; });
  return (
    <mesh position={[0, y, z]} renderOrder={-2}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} color={tint} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} fog={false} />
    </mesh>
  );
}

// Interaction: fly into a station on click, wheel zoom, drag pan (same model
// as the painted view). Focus targets are room centers in scene space.
const VIEW_LIMITS = { zoomMin: 1, zoomMax: 2.6, stationZoom: 2.3, panX: 420, panY: 220 };

// ── Crew placement ───────────────────────────────────────────────────────────
// Standing/walking crew: x = logical x, y = deck height, z = walk lane (+lane).
// Climbing crew (anim 'climb', climbDir ≠ 0) walk the switchback stair built
// by shipModel.js at the same LADDERS x instead of levitating: the engine's
// climbT (0 start floor → 1 target floor) is mapped by arc length onto a
// polyline through the real treads. Numbers mirror shipModel's STAIR block
// (off 10, w 52, pitch 14, tread 22, landing z -107..-67, 14 rises of 200/14):
//   lower flight A center x = sx-42, tread-center line y = -140 + (30 - z), z 30 → -70
//   landing            y = -40 (mid deck), z -70 → -84, x crosses sx-42 → sx+10
//   upper flight B center x = sx+10, tread-center line y = -40 + (z+70)·100/98, z -70 → 28
// Path (climb UP; descents run it backwards), cumulative fraction of 420 units:
//   walk lane → foot of A 0.10 → top of A 0.44 → landing crossed 0.60 → foot of B 0.63
//   → top of B 0.96 → hatch plate/walk lane 1.0.
const STAIR_PATHS = new Map();
function stairPath(sx, lane) {
  const key = sx + ':' + lane;
  let path = STAIR_PATHS.get(key);
  if (path) return path;
  const xA = sx - 42 + lane * 0.5, xB = sx + 10 + lane * 0.5;
  const yMid = (DECK_Y[0] + DECK_Y[1]) / 2;
  const pts = [
    [sx, DECK_Y[1], WALK_Z + lane],  // walk lane, deck 1
    [xA, DECK_Y[1], 30],             // foot of flight A (rise 0 nosing)
    [xA, yMid, -70],                 // top of flight A, onto the landing
    [xA, yMid, -84],                 // into the landing
    [xB, yMid, -84],                 // across the landing
    [xB, yMid, -70],                 // foot of flight B
    [xB, DECK_Y[0], 28],             // top of flight B (rise 14 = deck 0)
    [sx, DECK_Y[0], WALK_Z + lane],  // hatch arrival plate → walk lane, deck 0
  ];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, az] = pts[i - 1], [bx, by, bz] = pts[i];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
  }
  path = { pts, cum, total: cum[cum.length - 1] };
  STAIR_PATHS.set(key, path);
  return path;
}
const isClimbing = (sp) => sp.anim === 'climb' && (sp.climbDir === 1 || sp.climbDir === -1);
const _stairOut = [0, 0, 0];
// Point on the stair path for a climbing sprite (u = distance fraction; a
// descent is the same path walked from the deck-0 end).
function stairPoint(sp, lane) {
  const path = stairPath(toSceneX(sp.x), lane);
  const t = Math.min(1, Math.max(0, Number(sp.climbT) || 0));
  const d = (sp.climbDir === -1 ? 1 - t : t) * path.total;
  let i = 1;
  while (i < path.cum.length - 1 && path.cum[i] < d) i++;
  const a = path.pts[i - 1], b = path.pts[i];
  const seg = path.cum[i] - path.cum[i - 1] || 1;
  const k = Math.min(1, Math.max(0, (d - path.cum[i - 1]) / seg));
  _stairOut[0] = a[0] + (b[0] - a[0]) * k;
  _stairOut[1] = a[1] + (b[1] - a[1]) * k;
  _stairOut[2] = a[2] + (b[2] - a[2]) * k;
  return _stairOut;
}
function sceneX(sp, lane = 0) {
  return isClimbing(sp) ? stairPoint(sp, lane)[0] : toSceneX(sp.x);
}
// logical y (2D engine) → scene y: standing = deck height, climbing follows the treads.
function sceneY(sp, lane = 0) {
  if (isClimbing(sp)) return stairPoint(sp, lane)[1];
  const span = (LOGICAL_DECKS[1].floorY - LOGICAL_DECKS[0].floorY) || 1;
  const p = Math.min(1, Math.max(0, (sp.y - LOGICAL_DECKS[0].floorY) / span));
  return DECK_Y[0] + (DECK_Y[1] - DECK_Y[0]) * p;
}
function sceneZ(sp, lane = 0) {
  return isClimbing(sp) ? stairPoint(sp, lane)[2] : WALK_Z + lane;
}

// Image-based lighting: a neutral room environment, low, so metals and the
// wet deck have something to reflect. Its own effect so it cannot disturb the
// scene-build effect; the key/rim rig still leads.
function EnvironmentLight() {
  const { scene, gl } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    // 0.12, down from 0.32: the room env was the grey wash. It lifted every
    // surface in the frame by the same amount and the same hue, which is
    // exactly what flattened hull, props, walls and crew into one value.
    // The per-bay rig below does the lighting now; this only feeds metals
    // and the wet deck something to reflect.
    scene.environmentIntensity = 0.12;
    return () => { if (scene.environment === tex) scene.environment = null; tex.dispose(); pmrem.dispose(); };
  }, [scene, gl]);
  return null;
}

function SceneContent({ simRef, crew, onChipAnchors, contactsRef, tunnelOut, selectedStation, viewRef, chipEls, cutRef, onBooted }) {
  const { scene, camera, pointer, size, gl } = useThree();
  const focus = useRef({ x: CAMERA.target[0], y: CAMERA.target[1], zoom: 1 });
  // Which bays a receipt says are live (the outer component has its own copy
  // for the chips; SceneContent needs one for the bay lamps).
  const litStations = useMemo(() => {
    const lit = new Set();
    for (const m of crew) if (!m.future && (m.state === 'working' || m.state === 'active')) lit.add(m.station);
    return lit;
  }, [crew]);
  const _anchor = useRef(new THREE.Vector3());
  const figuresRef = useRef(new Map());
  const modelRef = useRef(null);
  const envRef = useRef(null);
  const greeblesRef = useRef(null);
  const tunnelRef = useRef(null);
  const sentinelsRef = useRef(null);
  const hullRef = useRef(null);
  const propsRef = useRef(null);
  const wallsRef = useRef(null);
  const shaftsRef = useRef(null);
  // Everything that IS the ship (hull, greebles, crew) hangs under one rig so
  // the whole vessel can bank and breathe while the world streams past it.
  const shipRigRef = useRef(null);
  if (!shipRigRef.current) { shipRigRef.current = new THREE.Group(); shipRigRef.current.name = 'shipRig'; }
  // Light budget: the rig below is 24 point lights + 2 pad + 1 fill. The
  // 9/14 note in HANDOFF records a frame going fully black (no console
  // error) when the point-light count crossed this GPU's fragment-uniform
  // limit, so the rims — the optional half of the rig — are only mounted
  // where there is headroom. Losing them costs shape, never the colour.
  const rimLights = (gl?.capabilities?.maxFragmentUniforms ?? 1024) >= 512;

  useEffect(() => {
    let model = null;
    let disposed = false;
    // Tunnel haze: dense and near-black so the trench ends fall away into
    // nothing. Density is the limit for the hull still reading (see below).
    scene.fog = new THREE.FogExp2(0x04060a, 0.00042);
    const env = createEnvironment();
    const greebles = createGreebles();
    greebles.group.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshLambertMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    envRef.current = env;
    greeblesRef.current = greebles;
    const rig = shipRigRef.current;
    scene.add(rig);
    // ── BOOT GATE ────────────────────────────────────────────────────────────
    // The scene used to pop in layers — stand-in crew, then the hull GLB, then
    // props, then walls — which reads as a glitch before the ship appears. The
    // whole rig stays invisible until the four big async pieces have landed
    // (ship textures, hull GLB, first room prop, room walls) or 6 s have
    // passed, whichever comes first; the overlay in ShipWorld3D fades out over
    // 400 ms on the signal. Failures count as landed, so nothing can wedge it.
    rig.visible = false;
    const boot = { done: 0, need: 4, fired: false, timer: 0 };
    const reveal = () => {
      if (boot.fired) return;
      boot.fired = true;
      clearTimeout(boot.timer);
      if (disposed) return;
      rig.visible = true;
      onBooted?.();
    };
    const bootPiece = () => { if (++boot.done >= boot.need) reveal(); };
    boot.timer = setTimeout(reveal, 6000);   // never block past 6 s
    scene.add(env.group);
    rig.add(greebles.group);
    const tunnel = createTunnel();
    tunnelRef.current = tunnel;
    if (tunnelOut) tunnelOut.current = tunnel;
    scene.add(tunnel.group);
    const sentinels = createSentinels3D();
    sentinelsRef.current = sentinels;
    scene.add(sentinels.group);
    // Dev-only hook for tests/ship-scene.html: toggle layers, read positions.
    if (import.meta.env.DEV && typeof window !== 'undefined') window.__shipWorld = {
      scene, rig, env, greebles, tunnel, sentinels, figures: figuresRef.current,
      model: () => modelRef.current, hull: () => hullRef.current,
      // Harness capture: the automated browser throttles rAF to 1 fps, so
      // Playwright's screenshot (which waits for a presented frame) times out.
      // This renders one frame on demand and hands back a PNG data URL.
      grab: () => { gl.render(scene, camera); return gl.domElement.toDataURL('image/png'); },
      camera,
      // Does the whole hull sit inside the frame? Projects the hull's world
      // bbox corners and returns the worst |NDC|; <= 1 is on-screen. Guessing
      // this from a screenshot wastes a round trip per attempt.
      fit: () => {
        const h = hullRef.current;
        const obj = h && (h.isObject3D ? h : h.group);   // createHullGLB returns an API, not the Object3D
        if (!obj) return null;
        const box = new THREE.Box3().setFromObject(obj);
        camera.updateMatrixWorld();
        const mvp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        let mx = 0, my = 0;
        const p = new THREE.Vector3();
        for (let i = 0; i < 8; i++) {
          p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
          p.applyMatrix4(mvp);
          mx = Math.max(mx, Math.abs(p.x)); my = Math.max(my, Math.abs(p.y));
        }
        return { worstX: +mx.toFixed(3), worstY: +my.toFixed(3), fits: mx <= 1 && my <= 1,
                 box: { x: [box.min.x | 0, box.max.x | 0], y: [box.min.y | 0, box.max.y | 0], z: [box.min.z | 0, box.max.z | 0] },
                 camZ: +camera.position.z.toFixed(0), aspect: +camera.aspect.toFixed(3) };
      },
    };
    const textures = { current: null };
    loadShipTextures((tex) => {
      if (disposed) { for (const t of Object.values(tex)) t?.dispose(); return; }
      bootPiece();                                   // piece 1/4: ship textures
      textures.current = tex;
      model = createShipModel({ textures: tex });
      modelRef.current = model;
      // Everything solid in the hull throws and catches shadow; emissive
      // accents (Basic materials) neither, or the shadow map fills with lamps.
      model.group.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshLambertMaterial) { o.castShadow = true; o.receiveShadow = true; } });
      // Fallout Shelter separates its lit cells with DARK structure. Here the
      // frame was reading at the same value as the rooms, so nothing popped.
      // Knock the merged hull / deck / bulkhead materials down to 55% of their
      // authored colour — in this view only, shipModel.js is untouched — and
      // the twelve coloured bays become the only bright things in frame.
      const dimmed = new Set();
      for (const name of ['hull', 'hullDark', 'decks', 'walls']) {
        const o = model.group.getObjectByName(name);
        const m = o && o.material;
        if (m && m.color && !dimmed.has(m)) { m.color.multiplyScalar(0.55); dimmed.add(m); }
      }
      shipRigRef.current.add(model.group);
      // The generated hull replaces the procedural shell once it lands; the
      // decks, rooms and props inside stay exactly as calibrated.
      // The procedural shell stays: inside the GLB it is hidden anyway, and
      // its top armor slab caps the rooms so the window never shows a cavity.
      const hull = createHullGLB({ onReady: () => {
        const rim = model.group.getObjectByName('cutawayRim');
        if (rim) rim.visible = false;
        bootPiece();                                 // piece 2/4: hull GLB
      } });
      hullRef.current = hull;
      shipRigRef.current.add(hull.group);
      // Real props replace the primitive furniture room by room as they load.
      const props = createRoomProps({ rooms: model.rooms, onFirstReady: () => {
        // Primitive furniture and the neutral accent bars (finance stacks,
        // board slots) retire once real props land; cyan accents (holo cone,
        // core glass) stay because the props do not replace them.
        for (const name of ['props', 'amberAccents']) { const o = model.group.getObjectByName(name); if (o) o.visible = false; }
        bootPiece();                                 // piece 3/4: first room prop
      } });
      propsRef.current = props;
      shipRigRef.current.add(props.group);
      const walls = createRoomWalls({ rooms: model.rooms, onReady: bootPiece });  // piece 4/4
      wallsRef.current = walls;
      shipRigRef.current.add(walls.group);
      const shafts = createLightShafts({ rooms: model.rooms });
      shaftsRef.current = shafts;
      shipRigRef.current.add(shafts.group);
    });
    return () => {
      disposed = true;
      clearTimeout(boot.timer);
      if (model) { rig.remove(model.group); model.dispose(); }
      if (hullRef.current) { rig.remove(hullRef.current.group); hullRef.current.dispose(); hullRef.current = null; }
      if (propsRef.current) { rig.remove(propsRef.current.group); propsRef.current.dispose(); propsRef.current = null; }
      if (wallsRef.current) { rig.remove(wallsRef.current.group); wallsRef.current.dispose(); wallsRef.current = null; }
      if (shaftsRef.current) { rig.remove(shaftsRef.current.group); shaftsRef.current.dispose(); shaftsRef.current = null; }
      if (textures.current) for (const t of Object.values(textures.current)) t?.dispose();
      rig.remove(greebles.group); greebles.dispose();
      scene.remove(env.group); env.dispose();
      scene.remove(tunnel.group); tunnel.dispose();
      scene.remove(sentinels.group); sentinels.dispose();
      scene.remove(rig);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Project station chip anchors to screen % whenever the viewport changes.
  useEffect(() => {
    camera.position.set(...CAMERA.position);
    camera.lookAt(...CAMERA.target);
    camera.updateMatrixWorld();
    const anchors = {};
    for (const r of ROOMS) {
      const cx = toSceneX((r.x0 + r.x1) / 2);
      const v = new THREE.Vector3(cx, DECK_Y[r.deck] + DECK_CLEAR - 4, WALK_Z);
      v.project(camera);
      anchors[r.id] = { left: ((v.x + 1) / 2) * 100, top: ((1 - v.y) / 2) * 100 };
    }
    onChipAnchors(anchors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  useEffect(() => {
    const map = figuresRef.current;
    for (const member of crew) {
      if (!map.has(member.name)) {
        const fig = createCrewFigure({ name: member.name, color: member.color, future: member.future });
        fig.group.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = true; });
        map.set(member.name, fig);
        shipRigRef.current.add(fig.group);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew]);

  useEffect(() => () => {
    for (const fig of figuresRef.current.values()) { fig.group.parent?.remove(fig.group); fig.dispose(); }
    figuresRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime * 1000;
    simRef.current.tick(Math.min(delta * 1000, 100), t);
    const sprites = simRef.current.getSprites();
    let i = 0;
    for (const sp of sprites) {
      const fig = figuresRef.current.get(sp.name);
      if (!fig) continue;
      const lane = ((i++ % 3) - 1) * 6; fig.group.position.set(sceneX(sp, lane), sceneY(sp, lane), sceneZ(sp, lane));
      fig.update(sp, t);
      // Figures are authored 34 units tall against a 150-unit deck clearance
      // (23%); a person in a 3.5 m deck is about half of it. Scale after
      // update(), which owns the per-deck factor.
      fig.group.scale.multiplyScalar(WORLD_CREW_SCALE);
    }
    modelRef.current?.update(t);
    envRef.current?.update(t);
    greeblesRef.current?.update(t);
    tunnelRef.current?.update(delta);
    hullRef.current?.update(t);
    propsRef.current?.update(t);
    const threat = sentinelsRef.current?.threat || 0;
    wallsRef.current?.update(t);
    shaftsRef.current?.update(t);
    sentinelsRef.current?.update(t, { enclosed: !!tunnelRef.current?.enclosed, cut: cutRef?.current ?? 0.4 });
    if (contactsRef) sentinelsRef.current?.getContacts(contactsRef.current);
    // Flight: a slow bank and a breathing pitch on the whole vessel, plus a
    // touch of bob. Amplitudes small enough that the station chips (projected
    // once, at rest) never drift off their rooms.
    // Under pursuit the vessel shudders: fast low-amplitude shake stacked on
    // the cruise sway, and the camera goes hand-held.
    const rig = shipRigRef.current;
    const shake = threat;
    // Calm by request (9/17): a slow cruise sway only. The pursuit no longer
    // shakes the hull or the camera; it shows in the cutter, sparks and the
    // bars instead, so the chips stay still enough to click.
    rig.rotation.z = Math.sin(t / 9000) * 0.006;
    rig.rotation.x = Math.sin(t / 7400) * 0.004;
    rig.position.y = Math.sin(t / 4800) * 2.5;
    rig.position.x = 0;
    void shake;
    // Camera: station focus + wheel zoom + pan, eased; parallax damped when zoomed.
    const v = viewRef?.current || { zoom: 1, panX: 0, panY: 0 };
    const room = selectedStation ? ROOMS.find(r => r.id === selectedStation) : null;
    const f = focus.current;
    const wantX = room ? toSceneX((room.x0 + room.x1) / 2) : CAMERA.target[0] + v.panX;
    const wantY = room ? DECK_Y[room.deck] + 60 : CAMERA.target[1] + v.panY;
    const wantZoom = (room ? VIEW_LIMITS.stationZoom : 1) * v.zoom;
    f.x += (wantX - f.x) * 0.06; f.y += (wantY - f.y) * 0.06; f.zoom += (wantZoom - f.zoom) * 0.06;
    const par = 1 / f.zoom;
    const dx = CAMERA.position[0] - CAMERA.target[0], dy = CAMERA.position[1] - CAMERA.target[1];
    const tx = f.x + (dx + pointer.x * CAMERA.parallax.x * 0.9 + Math.sin(t / 9000) * 4) * par;
    const ty = f.y + (dy + pointer.y * CAMERA.parallax.y * 0.9 + Math.cos(t / 12000) * 3) * par;
    camera.position.x += (tx - camera.position.x) * 0.06;
    camera.position.y += (ty - camera.position.y) * 0.06;
    camera.position.z = CAMERA.position[2] / f.zoom;
    camera.lookAt(f.x, f.y, 0);
    // Station chips: low inside each bay, projected through the live camera
    // and the flight rig every frame.
    if (chipEls?.current) {
      camera.updateMatrixWorld();
      const rigNode = shipRigRef.current;
      for (const r of ROOMS) {
        const el = chipEls.current.get(r.id); if (!el) continue;
        const p = _anchor.current.set(toSceneX(r.x0 + 14), DECK_Y[r.deck] + 6, WALK_Z + 12);
        rigNode.localToWorld(p).project(camera);
        const onScreen = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
        el.style.left = ((p.x + 1) / 2 * 100) + '%';
        el.style.top = ((1 - p.y) / 2 * 100) + '%';
        el.style.opacity = onScreen ? '' : '0';
      }
    }
  });

  return (
    <>
      {/* Cinematic rig: deep-shadow base + pools of warm lamp light per room —
          the reference's contrast instead of an even wash. Bloom (Effects)
          turns the emissives into real glow. */}
      <ambientLight intensity={0.95} color="#6d8aa8" />
      <hemisphereLight args={['#5c80a8', '#0a0e14', 1.0]} />
      {/* The one shadow-casting light: a cool key from high front-left, ortho
          frustum sized to the hull so the 2k map spends its texels on the ship. */}
      <directionalLight
        position={[-420, 620, 760]} intensity={3.4} color="#b9d3ee" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-1320} shadow-camera-right={1260} shadow-camera-top={1030} shadow-camera-bottom={-970}
        shadow-camera-near={10} shadow-camera-far={2300} shadow-bias={-0.0006} shadow-normalBias={2}
      />
      {/* three r155+ uses physical falloff: at this scene scale (rooms ~200
          units) pooled lamps need candela-scale intensities to exist at all. */}
      <EnvironmentLight />
      <Suspense fallback={null}>
        {BACKDROP.map((b, i) => <BackdropPlate key={i} {...b} />)}
      </Suspense>
      {/* ── THE TWELVE CELLS ───────────────────────────────────────────────
          One uniform grey lamp per room is what made the ship read as a
          single washed value. Each bay now gets its own two-light rig from
          STATION_PALETTE: a bright short-range FILL at the front of the bay
          carrying the station's identity colour, and a low RIM behind the
          crew, at 30%, in a deeper tone of the same family. The fill's
          distance is the bay's own width (floored at 190 so a narrow bay's
          lamp still reaches its floor, ~120 units below), so a cell lights
          itself and stops at its neighbour instead of bleeding across the
          deck. All twelve colours stay inside the cold/neutral band — see
          the doctrine note in stationPalette.js. */}
      {/* Bay light: ONE point light per bay, and only for the bays a receipt
          says are live. Twelve fills plus twelve rims measured 1.2 fps in the
          harness (30 point lights: every material recompiles and every
          fragment loops them all). Fallout Shelter does not light its rooms
          dynamically either — the room reads bright because it is PAINTED
          bright. So colour identity now comes from the additive cell glow and
          the tinted wall panel in roomWalls.js, and these few lamps only pick
          out the bays that are actually working. */}
      {ROOMS.filter(r => litStations.has(r.id)).slice(0, 4).map(r => {
        const pal = stationLightFor(r.id);
        const cx = toSceneX((r.x0 + r.x1) / 2);
        return (
          <pointLight
            key={r.id}
            position={[cx, DECK_Y[r.deck] + DECK_CLEAR - 30, WALK_Z + 14]}
            intensity={pal.intensity * 0.9} distance={Math.max((r.x1 - r.x0) * 1.15, 190)} decay={2} color={pal.fill}
          />
        );
      })}
      {/* Hover-pad underglow: the cyan rings throw light down onto the undercity */}
      {[-300, 300].map((x, i) => (
        <pointLight key={'pad' + i} position={[x, HULL_3D.yBottom - 140, 60]} intensity={70000} distance={800} decay={2} color="#2aabff" />
      ))}
      {/* Soft cool front fill so the cutaway's nearest faces never go void.
          Cut to a third (200k → 66k): at full strength this single lamp was
          re-flattening everything the per-bay rig separates. It is a floor
          now, not a light. */}
      <pointLight position={[0, 100, 700]} intensity={66000} distance={2400} decay={2} color="#6f8db0" />
      <Effects />
    </>
  );
}

export default function ShipWorld3D({ crew = [], activity = {}, incidents = null, morale = {}, onStation, selectedStation, signals = {} }) {
  // The sentinel cuts harder the longer the oldest blocker has been open (rules doc).
  const cutRef = useRef(0.4);
  cutRef.current = incidents?.cutIntensity ?? 0.4;
  const simRef = useRef(null);
  const contactsRef = useRef([]);
  const tunnelOut = useRef(null);
  if (!simRef.current) simRef.current = createShipSim();
  useEffect(() => { simRef.current.setCrew(crew); }, [crew]);

  const [chipAnchors, setChipAnchors] = useState({});
  const [hover, setHover] = useState(null);
  // Boot gate (see SceneContent): the rig stays hidden and this black overlay
  // covers the canvas until every big async piece has landed — or 6 s pass —
  // so the ship arrives whole instead of assembling itself on screen. Then the
  // overlay fades over 400 ms and is unmounted.
  const [booted, setBooted] = useState(false);
  const [overlayGone, setOverlayGone] = useState(false);
  const onBooted = useCallback(() => setBooted(true), []);
  useEffect(() => {
    if (!booted) return undefined;
    const id = setTimeout(() => setOverlayGone(true), 440);
    return () => clearTimeout(id);
  }, [booted]);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const chipEls = useRef(new Map());
  const dragRef = useRef(null);
  const onWheel = (e) => { const v = viewRef.current; v.zoom = Math.min(VIEW_LIMITS.zoomMax, Math.max(VIEW_LIMITS.zoomMin, v.zoom * (1 - e.deltaY * 0.0012))); };
  const onPointerDown = (e) => { if (e.button !== 0) return; dragRef.current = { x: e.clientX, y: e.clientY }; };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
    const v = viewRef.current; const k = 1.1 / v.zoom;
    v.panX = Math.max(-VIEW_LIMITS.panX, Math.min(VIEW_LIMITS.panX, v.panX - dx * k));
    v.panY = Math.max(-VIEW_LIMITS.panY, Math.min(VIEW_LIMITS.panY, v.panY + dy * k));
  };
  const onPointerUp = () => { dragRef.current = null; };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && selectedStation) onStation?.(selectedStation); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedStation, onStation]);
  const counts = useMemo(
    () => Object.fromEntries(Object.entries(activity).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])),
    [activity]
  );
  const litStations = useMemo(() => {
    const lit = new Set();
    for (const m of crew) if (!m.future && (m.state === 'working' || m.state === 'active')) lit.add(m.station);
    return lit;
  }, [crew]);

  return (
    <div onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: '#05060a', touchAction: 'none' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: CAMERA.fov, near: 1, far: 6000, position: CAMERA.position }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: import.meta.env.DEV }}
        shadows={{ type: THREE.PCFShadowMap }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SceneContent simRef={simRef} crew={crew} onChipAnchors={setChipAnchors} contactsRef={contactsRef} tunnelOut={tunnelOut} selectedStation={selectedStation} viewRef={viewRef} chipEls={chipEls} cutRef={cutRef} onBooted={onBooted} />
      </Canvas>
      <ShipHUD contactsRef={contactsRef} signals={signals} tunnelRef={tunnelOut} />
      {!overlayGone && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#05060a',
          opacity: booted ? 0 : 1, transition: 'opacity 400ms ease-out',
          pointerEvents: booted ? 'none' : 'auto',
        }}>
          <span style={{
            ...mono, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            color: 'rgba(191,227,255,0.72)', animation: 'livePulse 1.6s ease-in-out infinite',
          }}>Booting ship</span>
        </div>
      )}

      {selectedStation && (
        <button onClick={() => onStation?.(selectedStation)} style={{
          position: 'absolute', left: 12, top: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 10px',
          background: 'rgba(6,8,13,0.78)', backdropFilter: 'blur(4px)', border: '1px solid #2AABFF', borderRadius: 6, cursor: 'pointer',
          fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', ...mono, color: '#bfe3ff', whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>←</span>
          {STATIONS.find(s => s.id === selectedStation)?.n} {STATIONS.find(s => s.id === selectedStation)?.label}
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>· ESC</span>
        </button>
      )}
      {ROOMS.map(r => {
        const meta = STATIONS.find(s => s.id === r.id);
        const lit = litStations.has(r.id);
        const isSel = selectedStation === r.id;
        const count = counts[r.id] || 0;
        const inc = incidents?.byStation?.[r.id];
        return (
          <button
            key={r.id}
            ref={(el) => { if (el) chipEls.current.set(r.id, el); else chipEls.current.delete(r.id); }}
            onClick={() => onStation?.(r.id)}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(h => (h === r.id ? null : h))}
            style={{
              position: 'absolute', left: '-100%', top: '-100%', transform: 'translate(0, -100%)',
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '1px 6px',
              background: 'rgba(4,6,10,0.62)', backdropFilter: 'blur(3px)',
              borderTop: `1px solid ${isSel ? '#2AABFF' : hover === r.id ? 'rgba(42,171,255,0.6)' : lit ? 'rgba(42,171,255,0.4)' : 'rgba(255,255,255,0.10)'}`,
              borderRight: `1px solid ${isSel ? '#2AABFF' : hover === r.id ? 'rgba(42,171,255,0.6)' : lit ? 'rgba(42,171,255,0.4)' : 'rgba(255,255,255,0.10)'}`,
              borderBottom: `1px solid ${isSel ? '#2AABFF' : hover === r.id ? 'rgba(42,171,255,0.6)' : lit ? 'rgba(42,171,255,0.4)' : 'rgba(255,255,255,0.10)'}`,
              borderLeft: `2px solid ${inc ? '#ff453a' : lit ? '#2AABFF' : 'rgba(229,229,234,0.35)'}`,
              borderRadius: 3, cursor: 'pointer', transition: 'opacity 200ms',
              fontSize: 7.5, letterSpacing: 0.9, textTransform: 'uppercase', ...mono,
              color: inc ? '#ffb3ad' : lit ? '#bfe3ff' : 'rgba(229,229,234,0.62)', whiteSpace: 'nowrap',
              animation: inc ? 'livePulse 1.1s ease-in-out infinite' : 'none',
            }}>
            <span style={{ color: 'rgba(229,229,234,0.4)' }}>{meta?.n}</span> {meta?.label}
            {count > 0 && <span style={{ color: '#2AABFF', fontWeight: 700 }}>{count}</span>}
            {inc && <span style={{ color: '#ff453a', fontWeight: 700 }} title={`${inc.count} blocked · oldest ${Math.round(inc.oldestHours)}h${inc.spread ? ' · spread' : ''}`}>!{inc.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
