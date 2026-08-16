import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_W, WORLD_H, ROOMS, DECKS, floorYAt } from '../../ship/world.js';
import { STATIONS } from '../../core/shipStations.js';
import { createShipSim } from '../../ship/shipEngine.js';
import { createAgentFigure } from '../../ship/crewModels.js';
import { createHoloFX } from '../../ship/holoFX.js';

// ── Phase 1: the cinematic ship in real 3D (2.5D uplift) ─────────────────────
// The painted hull becomes a plane in a live three.js scene: parallax camera,
// volumetric holo-core FX, and the crew as articulated 3D figures walking the
// same receipt-driven engine paths as every other rendering. The simulation
// stays the single source of truth — this is a renderer, not a new reality.
// Original crew models only (no film likenesses, per the spec's likeness rule).

const CAM_Z = 1141; // fits the 1280×720 art plane exactly at fov 35
const mono = { fontFamily: "'Geist Mono', monospace" };

const toThreeX = (x) => x - WORLD_W / 2;
const toThreeY = (y) => WORLD_H / 2 - y;

// Feet projection onto the painted floor lines (same math as the 2D renderer).
function projectFeetY(sp) {
  const f0 = floorYAt(0, sp.x), f1 = floorYAt(1, sp.x);
  const span = (DECKS[1].floorY - DECKS[0].floorY) || 1;
  const p = Math.min(1, Math.max(0, (sp.y - DECKS[0].floorY) / span));
  return f0 + (f1 - f0) * p;
}

function ArtPlane() {
  const tex = useLoader(THREE.TextureLoader, '/ship-interior.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[WORLD_W, WORLD_H]} />
      <meshBasicMaterial map={tex} />
    </mesh>
  );
}

function SceneContent({ simRef, crew }) {
  const { scene, camera, pointer } = useThree();
  const figuresRef = useRef(new Map());
  const fxRef = useRef(null);

  // FX group once
  useEffect(() => {
    const fx = createHoloFX();
    fxRef.current = fx;
    scene.add(fx.group);
    return () => { scene.remove(fx.group); fx.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Figures follow the roster present in crew
  useEffect(() => {
    const map = figuresRef.current;
    for (const member of crew) {
      if (!map.has(member.name)) {
        const fig = createAgentFigure({ name: member.name, color: member.color, future: member.future });
        map.set(member.name, fig);
        scene.add(fig.group);
      }
    }
    return undefined;
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
    for (const sp of sprites) {
      const fig = figuresRef.current.get(sp.name);
      if (!fig) continue;
      const feetY = projectFeetY(sp);
      fig.group.position.set(toThreeX(sp.x), toThreeY(feetY), sp.deck === 1 ? 26 : 18);
      fig.update(sp, t);
    }
    fxRef.current?.update(t);
    // parallax: gentle camera drift toward the pointer + slow ambient sway
    const targetX = pointer.x * 14 + Math.sin(t / 9000) * 4;
    const targetY = pointer.y * 8 + Math.cos(t / 11000) * 3;
    camera.position.x += (targetX - camera.position.x) * 0.04;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      {/* Art is unlit (MeshBasicMaterial); these lights shape the CREW so they
          read against the dark painting instead of sinking into it. */}
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#7fb4e0', '#1a1410', 0.7]} />
      <directionalLight position={[-200, 300, 400]} intensity={0.5} color="#bcd9f5" />
      <Suspense fallback={null}>
        <ArtPlane />
      </Suspense>
    </>
  );
}

export default function ShipScene3D({ crew = [], activity = {}, onStation, selectedStation }) {
  const simRef = useRef(null);
  if (!simRef.current) simRef.current = createShipSim();
  useEffect(() => { simRef.current.setCrew(crew); }, [crew]);

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
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${WORLD_W} / ${WORLD_H}`, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: '#05060a' }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 35, near: 1, far: 4000, position: [0, 0, CAM_Z] }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SceneContent simRef={simRef} crew={crew} />
      </Canvas>

      {/* Station chips — HTML overlay anchored to the art (clickable) */}
      {ROOMS.map(r => {
        const meta = STATIONS.find(s => s.id === r.id);
        const cx = ((r.x0 + r.x1) / 2 / WORLD_W) * 100;
        const top = ((DECKS[r.deck].ceilY - 26) / WORLD_H) * 100;
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
              position: 'absolute', left: `${cx}%`, top: `${top}%`, transform: 'translateX(-50%)',
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
