import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { WORLD_W, ROOMS, DECKS as LOGICAL_DECKS } from '../../ship/world.js';
import { toSceneX, DECK_Y, DECK_CLEAR, WALK_Z, CAMERA } from '../../ship/scene3dContract.js';
import { STATIONS } from '../../core/shipStations.js';
import { createShipSim } from '../../ship/shipEngine.js';
import { createCrewFigure } from '../../ship/crewGLB.js';
import { createShipModel } from '../../ship/shipModel.js';
import { createEnvironment } from '../../ship/environment3d.js';
import { createGreebles } from '../../ship/greebles.js';
import { createTunnel } from '../../ship/tunnel.js';

// Grunge textures generated for the cinematic pass (public/textures/). Loaded
// leniently: a missing file just means that surface stays flat-colored.
function loadShipTextures(onDone) {
  const loader = new THREE.TextureLoader();
  const out = { hull: null, wall: null, deck: null };
  let pending = 3;
  const finish = () => { if (--pending === 0) onDone(out); };
  for (const key of ['hull', 'wall', 'deck']) {
    loader.load(
      `/textures/ship-${key}.jpg`,
      (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; out[key] = tex; console.log(`[ship] texture ok: ${key}`); finish(); },
      undefined,
      () => { console.warn(`[ship] texture FAILED: ${key}`); finish(); }
    );
  }
}

// Post chain: filmic tone mapping + bloom is what turns flat emissive quads
// into actual lights. Uses three's bundled passes — no new dependencies.
function Effects() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.35;
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

// logical y (2D engine) → scene y: standing = deck height, climbing lerps.
function sceneY(sp) {
  const span = (LOGICAL_DECKS[1].floorY - LOGICAL_DECKS[0].floorY) || 1;
  const p = Math.min(1, Math.max(0, (sp.y - LOGICAL_DECKS[0].floorY) / span));
  return DECK_Y[0] + (DECK_Y[1] - DECK_Y[0]) * p;
}

function SceneContent({ simRef, crew, onChipAnchors }) {
  const { scene, camera, pointer, size } = useThree();
  const figuresRef = useRef(new Map());
  const modelRef = useRef(null);
  const envRef = useRef(null);
  const greeblesRef = useRef(null);
  const tunnelRef = useRef(null);
  // Everything that IS the ship (hull, greebles, crew) hangs under one rig so
  // the whole vessel can bank and breathe while the world streams past it.
  const shipRigRef = useRef(null);
  if (!shipRigRef.current) { shipRigRef.current = new THREE.Group(); shipRigRef.current.name = 'shipRig'; }

  useEffect(() => {
    let model = null;
    let disposed = false;
    // Aerial haze: depth reads through fog, and the city falls away instead of
    // sitting flat behind the hull. Density tuned so the stern still reads.
    scene.fog = new THREE.FogExp2(0x070a10, 0.00052);
    const env = createEnvironment();
    const greebles = createGreebles();
    greebles.group.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshLambertMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    envRef.current = env;
    greeblesRef.current = greebles;
    const rig = shipRigRef.current;
    scene.add(rig);
    scene.add(env.group);
    rig.add(greebles.group);
    const tunnel = createTunnel();
    tunnelRef.current = tunnel;
    scene.add(tunnel.group);
    const textures = { current: null };
    loadShipTextures((tex) => {
      if (disposed) { for (const t of Object.values(tex)) t?.dispose(); return; }
      textures.current = tex;
      model = createShipModel({ textures: tex });
      modelRef.current = model;
      // Everything solid in the hull throws and catches shadow; emissive
      // accents (Basic materials) neither, or the shadow map fills with lamps.
      model.group.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshLambertMaterial) { o.castShadow = true; o.receiveShadow = true; } });
      shipRigRef.current.add(model.group);
    });
    return () => {
      disposed = true;
      if (model) { rig.remove(model.group); model.dispose(); }
      if (textures.current) for (const t of Object.values(textures.current)) t?.dispose();
      rig.remove(greebles.group); greebles.dispose();
      scene.remove(env.group); env.dispose();
      scene.remove(tunnel.group); tunnel.dispose();
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
      fig.group.position.set(toSceneX(sp.x), sceneY(sp), WALK_Z + ((i++ % 3) - 1) * 6);
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
    // Flight: a slow bank and a breathing pitch on the whole vessel, plus a
    // touch of bob. Amplitudes small enough that the station chips (projected
    // once, at rest) never drift off their rooms.
    const rig = shipRigRef.current;
    rig.rotation.z = Math.sin(t / 6100) * 0.014 + Math.sin(t / 2300) * 0.004;
    rig.rotation.x = Math.sin(t / 4700) * 0.010;
    rig.position.y = Math.sin(t / 3300) * 5;
    const tx = CAMERA.position[0] + pointer.x * CAMERA.parallax.x + Math.sin(t / 9000) * 6;
    const ty = CAMERA.position[1] + pointer.y * CAMERA.parallax.y + Math.cos(t / 12000) * 4;
    camera.position.x += (tx - camera.position.x) * 0.04;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.lookAt(...CAMERA.target);
  });

  return (
    <>
      {/* Cinematic rig: deep-shadow base + pools of warm lamp light per room —
          the reference's contrast instead of an even wash. Bloom (Effects)
          turns the emissives into real glow. */}
      <ambientLight intensity={0.30} color="#5a7492" />
      <hemisphereLight args={['#4a6a90', '#0b0d12', 0.45]} />
      {/* The one shadow-casting light: a cool key from high front-left, ortho
          frustum sized to the hull so the 2k map spends its texels on the ship. */}
      <directionalLight
        position={[-420, 620, 760]} intensity={2.4} color="#b9d3ee" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-760} shadow-camera-right={760} shadow-camera-top={420} shadow-camera-bottom={-320}
        shadow-camera-near={200} shadow-camera-far={2400} shadow-bias={-0.0006} shadow-normalBias={2}
      />
      {/* three r155+ uses physical falloff: at this scene scale (rooms ~200
          units) pooled lamps need candela-scale intensities to exist at all. */}
      {ROOMS.map(r => (
        <pointLight
          key={r.id}
          position={[toSceneX((r.x0 + r.x1) / 2), DECK_Y[r.deck] + DECK_CLEAR - 24, WALK_Z - 40]}
          intensity={70000}
          distance={340}
          decay={2}
          color={r.id === 'analytics' ? '#7fc4ff' : '#cfd8e6'}
        />
      ))}
      {/* soft cool front fill so the cutaway's nearest faces never go void */}
      <pointLight position={[0, 100, 700]} intensity={120000} distance={2000} decay={2} color="#5a7492" />
      <Effects />
    </>
  );
}

export default function ShipWorld3D({ crew = [], activity = {}, onStation, selectedStation }) {
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = createShipSim();
  useEffect(() => { simRef.current.setCrew(crew); }, [crew]);

  const [chipAnchors, setChipAnchors] = useState({});
  const [hover, setHover] = useState(null);
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
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: '#05060a' }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: CAMERA.fov, near: 1, far: 6000, position: CAMERA.position }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
        shadows={{ type: THREE.PCFShadowMap }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SceneContent simRef={simRef} crew={crew} onChipAnchors={setChipAnchors} />
      </Canvas>

      {ROOMS.map(r => {
        const a = chipAnchors[r.id];
        if (!a) return null;
        const meta = STATIONS.find(s => s.id === r.id);
        const lit = litStations.has(r.id);
        const isSel = selectedStation === r.id;
        const count = counts[r.id] || 0;
        return (
          <button
            key={r.id}
            onClick={() => onStation?.(r.id)}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(h => (h === r.id ? null : h))}
            style={{
              position: 'absolute', left: `${a.left}%`, top: `${a.top}%`, transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px',
              background: 'rgba(6,8,13,0.72)', backdropFilter: 'blur(4px)',
              border: `1px solid ${isSel ? '#2AABFF' : hover === r.id ? 'rgba(42,171,255,0.6)' : lit ? 'rgba(42,171,255,0.45)' : 'rgba(255,255,255,0.14)'}`,
              borderRadius: 5, cursor: 'pointer',
              fontSize: 8.5, letterSpacing: 0.8, textTransform: 'uppercase', ...mono,
              color: lit ? '#bfe3ff' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap',
            }}>
            {meta?.n} {meta?.label}
            {count > 0 && <span style={{ color: '#2AABFF', fontWeight: 700 }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
