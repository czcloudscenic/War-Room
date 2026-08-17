import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_W, ROOMS, DECKS as LOGICAL_DECKS } from '../../ship/world.js';
import { toSceneX, DECK_Y, DECK_CLEAR, WALK_Z, CAMERA } from '../../ship/scene3dContract.js';
import { STATIONS } from '../../core/shipStations.js';
import { createShipSim } from '../../ship/shipEngine.js';
import { createAgentFigure } from '../../ship/crewModels.js';
import { createShipModel } from '../../ship/shipModel.js';
import { createEnvironment } from '../../ship/environment3d.js';

// ── Phase 2: the modeled ship ────────────────────────────────────────────────
// No more painted backdrop — a real low-poly cutaway hull with 12 built rooms,
// the city and storm outside, and the crew walking real floors. The 2D engine
// remains the single source of truth: logical positions map into 3D here and
// nowhere else. Movement rule unchanged: receipts move people, nothing else.

const mono = { fontFamily: "'Geist Mono', monospace" };

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

  useEffect(() => {
    const model = createShipModel();
    const env = createEnvironment();
    modelRef.current = model;
    envRef.current = env;
    scene.add(env.group);
    scene.add(model.group);
    return () => {
      scene.remove(model.group); model.dispose();
      scene.remove(env.group); env.dispose();
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
        const fig = createAgentFigure({ name: member.name, color: member.color, future: member.future });
        map.set(member.name, fig);
        scene.add(fig.group);
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
    }
    modelRef.current?.update(t);
    envRef.current?.update(t);
    const tx = CAMERA.position[0] + pointer.x * CAMERA.parallax.x + Math.sin(t / 9000) * 6;
    const ty = CAMERA.position[1] + pointer.y * CAMERA.parallax.y + Math.cos(t / 12000) * 4;
    camera.position.x += (tx - camera.position.x) * 0.04;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.lookAt(...CAMERA.target);
  });

  return (
    <>
      <ambientLight intensity={1.0} color="#93b4d4" />
      <hemisphereLight args={['#6f93bd', '#2a2014', 0.9]} />
      <directionalLight position={[-300, 500, 600]} intensity={0.9} color="#b7d3ee" />
      {/* warm interior fill from the cutaway side, like the art's work lamps */}
      <directionalLight position={[200, -50, 900]} intensity={0.45} color="#ffb45c" />
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
