import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_W, WORLD_H, ROOMS, DECKS, floorYAt } from '../../ship/world.js';
import { STATIONS } from '../../core/shipStations.js';
import { createShipSim } from '../../ship/shipEngine.js';
import { createAgentFigure } from '../../ship/crewModels.js';
import { createShipArtFX } from '../../ship/shipArtFX.js';
import { createDrones } from '../../ship/drones.js';

// Crew scale: tuned against the artwork's furniture — figures read right at
// ~70-105 logical units (full art-measured human scale of 130 overwhelmed the
// bays). Scale follows x so crew match the painting's own depth.
const humanScaleAt = (x) => Math.min(105, Math.max(66, 62 + 0.05 * x)) / 34;

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
  // The living stage: an ambient cinemagraph loop of the artwork when
  // available (/ship-interior.mp4), the still painting as poster/fallback.
  const stillTex = useLoader(THREE.TextureLoader, '/ship-interior.jpg');
  stillTex.colorSpace = THREE.SRGBColorSpace;
  const [videoTex, setVideoTex] = useState(null);
  useEffect(() => {
    const video = document.createElement('video');
    video.src = '/ship-interior.mp4';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    let dead = false;
    const onReady = () => {
      if (dead) return;
      video.play().then(() => {
        const t = new THREE.VideoTexture(video);
        t.colorSpace = THREE.SRGBColorSpace;
        setVideoTex(t);
      }).catch(() => { /* autoplay refused — still image stands */ });
    };
    video.addEventListener('canplaythrough', onReady, { once: true });
    video.addEventListener('error', () => { /* no video shipped — still image stands */ }, { once: true });
    video.load();
    return () => { dead = true; video.pause(); video.removeAttribute('src'); video.load(); };
  }, []);
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[WORLD_W, WORLD_H]} />
      <meshBasicMaterial map={videoTex || stillTex} />
    </mesh>
  );
}

function SceneContent({ simRef, crew }) {
  const { scene, camera, pointer } = useThree();
  const figuresRef = useRef(new Map());
  const fxRef = useRef(null);
  const dronesRef = useRef(null);

  // FX group once
  useEffect(() => {
    const fx = createShipArtFX();
    fxRef.current = fx;
    scene.add(fx.group);
    const drones = createDrones();
    dronesRef.current = drones;
    scene.add(drones.group);
    return () => {
      scene.remove(fx.group); fx.dispose();
      scene.remove(drones.group); drones.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Figures follow the roster present in crew
  useEffect(() => {
    const map = figuresRef.current;
    for (const member of crew) {
      if (!map.has(member.name)) {
        const fig = createAgentFigure({ name: member.name, color: member.color, future: member.future });
        // Pop against the dark painting: near-black garments take the member's
        // signature color, and every surface self-glows so nobody reads as a
        // silhouette sunk into the hull.
        const tint = new THREE.Color(member.color || '#2AABFF');
        fig.group.traverse((o) => {
          if (o.isMesh && o.material && 'emissive' in o.material && o.material.color) {
            const m = o.material;
            const lum = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11;
            if (lum < 0.16) m.color.lerp(tint, 0.45);
            m.emissive.copy(m.color).multiplyScalar(0.4);
          }
        });
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
      // Applied after fig.update (which manages its own deck scale) so the
      // measured human-scale factor survives every animation state.
      fig.group.scale.multiplyScalar(humanScaleAt(sp.x));
    }
    fxRef.current?.update(t);
    dronesRef.current?.update(t);
    // parallax: camera drift toward the pointer + a slow living sway and a
    // barely-perceptible breathe on depth — the frame never sits fully still
    const targetX = pointer.x * 18 + Math.sin(t / 8000) * 9;
    const targetY = pointer.y * 10 + Math.cos(t / 10500) * 6;
    camera.position.x += (targetX - camera.position.x) * 0.04;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.position.z = CAM_Z + Math.sin(t / 14000) * 14;
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
        // Chips ride the painted deck slope: anchored above each bay's real
        // floor line instead of one flat row.
        const cxLogical = (r.x0 + r.x1) / 2;
        const top = ((floorYAt(r.deck, cxLogical) - (r.deck === 0 ? 152 : 160)) / WORLD_H) * 100;
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
