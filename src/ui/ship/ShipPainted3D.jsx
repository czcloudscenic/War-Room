import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_W, WORLD_H, ROOMS, DECKS, floorYAt } from '../../ship/world.js';
import { STATIONS } from '../../core/shipStations.js';
import { createShipSim } from '../../ship/shipEngine.js';
import { createCrewFigure } from '../../ship/crewGLB.js';
import { createShipArtFX } from '../../ship/shipArtFX.js';
import { createDrones } from '../../ship/drones.js';
import { createBeacons } from '../../ship/beacons.js';
import ShipHUD from './ShipHUD.jsx';

// ── The painted world in motion ──────────────────────────────────────────────
// Danny's requirement (9/11): it has to look like the concept art AND move.
// So the concept art IS the ship: the painting with its background removed
// rides a flight rig (bank, breathe, bob) while painted environment plates,
// generated in the same brushwork, stream behind it with parallax: a storm
// and city plate far back, a tunnel-wall plate that fades in for enclosed
// stretches, and a keyed foreground-structure layer closest to the hull. Rain
// falls in front. The crew, sentinels, beacons and receipt rules are unchanged.
const PLATES = {
  // v2 (9/11): the hull repainted into the armored hover-pad silhouette
  // Christian chose, interior layout unchanged; v1 kept as a fallback file.
  cutout: '/ship/ship-cutout-v2.webp',
  open: '/ship/plate-open.jpg',
  tunnel: '/ship/plate-tunnel.jpg',
  fg: '/ship/plate-fg.webp',
};
// Layer depths (scene z; camera at CAM_Z looking at z=0) and scroll speeds in
// texture units per second. The world streams toward +X, so offsets decrease.
const LAYERS = {
  open:   { z: -900, w: 4000, h: 1714, speed: 0.006 },   // far: sky + horizon towers
  mid:    { z: -520, w: 3000, h: 1286, speed: 0.022 },   // mid: the same plate, lower, faster, darker = a second city rank
  tunnel: { z: -350, w: 2700, h: 1157, speed: 0.048 },
  fg:     { z: -150, w: 2450, h: 1050, speed: 0.115 },
};
// Enclosed stretches: a 46 s cycle, tunnel walls up for 18 s with 2.5 s ramps.
const TUNNEL = { period: 46000, start: 24000, end: 42000, ramp: 2500 };
const tunnelPresence = (t) => {
  const c = t % TUNNEL.period;
  const up = Math.min(1, Math.max(0, (c - TUNNEL.start) / TUNNEL.ramp));
  const down = Math.min(1, Math.max(0, (TUNNEL.end - c) / TUNNEL.ramp));
  return Math.min(up, down);
};

// Crew scale: tuned against the artwork's furniture — figures read right at
// ~70-105 logical units (full art-measured human scale of 130 overwhelmed the
// bays). Scale follows x so crew match the painting's own depth.
const humanScaleAt = (x) => Math.min(74, Math.max(46, 43 + 0.035 * x)) / 34;

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

function ShipCutout() {
  const tex = useLoader(THREE.TextureLoader, PLATES.cutout);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[0, 0, 0]} renderOrder={3}>
      <planeGeometry args={[WORLD_W, WORLD_H]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.02} depthWrite />
    </mesh>
  );
}

// A streaming plate: mirrored repeat makes any plate tile seamlessly.
function Plate({ url, layer, opacityRef, renderOrder, alpha = false, tint = 0xffffff, opacity = 1, yOffset = 0 }) {
  const base = useLoader(THREE.TextureLoader, url);
  // Each Plate scrolls its own texture instance (the loader caches by URL).
  const tex = useMemo(() => { const t = base.clone(); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; }, [base]);
  const matRef = useRef(null);
  useFrame((state, delta) => {
    tex.offset.x -= layer.speed * delta;
    if (opacityRef && matRef.current) matRef.current.opacity = opacityRef.current * opacity;
  });
  const isTransparent = alpha || !!opacityRef || opacity < 1;
  return (
    <mesh position={[0, yOffset, layer.z]} renderOrder={renderOrder}>
      <planeGeometry args={[layer.w, layer.h]} />
      <meshBasicMaterial ref={matRef} map={tex} color={tint} transparent={isTransparent} alphaTest={alpha ? 0.02 : 0} depthWrite={!isTransparent} opacity={opacityRef ? 0 : opacity} />
    </mesh>
  );
}

// Haze: big soft sprites drifting between the depth layers. Cheap volumetrics:
// they catch the parallax and read as air between the city and the hull.
function Haze() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.14)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }, []);
  const sprites = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
    x: (i / 9) * 2600 - 1300, y: -260 + ((i * 37) % 5) * 90, z: -640 + (i % 3) * 150, s: 520 + (i % 4) * 140, o: 0.05 + (i % 3) * 0.02, v: 26 + (i % 3) * 9,
  })), []);
  const refs = useRef([]);
  useFrame((state, delta) => {
    for (let i = 0; i < sprites.length; i++) {
      const sp = refs.current[i]; if (!sp) continue;
      sp.position.x += sprites[i].v * delta;
      if (sp.position.x > 1500) sp.position.x -= 3000;
    }
  });
  return (
    <>
      {sprites.map((h, i) => (
        <sprite key={i} ref={(el) => { refs.current[i] = el; }} position={[h.x, h.y, h.z]} scale={[h.s * 1.8, h.s, 1]} renderOrder={1}>
          <spriteMaterial map={tex} color={0x2a3a52} transparent opacity={h.o} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </>
  );
}

// Rain in front of everything: 320 streaks falling and wrapping, allocation-free.
function Rain() {
  const geo = useMemo(() => {
    const n = 320; const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 1600 - 800;
      const y = (Math.sin(i * 78.233) * 43758.5453 % 1) * 900 - 450;
      const len = 18 + ((i * 7) % 5) * 5;
      pos.set([x, y, 0, x - 3, y - len, 0], i * 6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
  }, []);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: 0x9fbfe0, transparent: true, opacity: 0.22, depthWrite: false }), []);
  useFrame((state, delta) => {
    const p = geo.attributes.position.array; const dy = 520 * delta; const dx = -140 * delta;
    for (let i = 0; i < p.length; i += 6) {
      p[i + 1] -= dy; p[i + 4] -= dy; p[i] += dx; p[i + 3] += dx;
      if (p[i + 4] < -460) { const len = p[i + 1] - p[i + 4]; p[i + 1] = 460; p[i + 4] = 460 - len; }
      if (p[i] < -820) { p[i] += 1640; p[i + 3] += 1640; }
    }
    geo.attributes.position.needsUpdate = true;
  });
  return <lineSegments geometry={geo} material={mat} position={[0, 0, 240]} renderOrder={6} />;
}

// Interaction model: click a station chip and the camera flies into that
// room; click it again (or press Escape) and it pulls back. The wheel zooms,
// dragging pans, and the pointer drives real parallax across the depth layers.
const VIEW_LIMITS = { zoomMin: 1, zoomMax: 2.4, stationZoom: 2.25, panX: 320, panY: 160 };

function SceneContent({ simRef, crew, activityCount = {}, alerts = {}, contactsRef, enclosedRef, selectedStation, viewRef, chipEls }) {
  const _anchor = useRef(new THREE.Vector3());
  const { scene, camera, pointer } = useThree();
  const focus = useRef({ x: 0, y: 0, zoom: 1 });
  const figuresRef = useRef(new Map());
  // The ship rig: cutout + crew + station FX bank and breathe together.
  const rigRef = useRef(null);
  if (!rigRef.current) { rigRef.current = new THREE.Group(); rigRef.current.name = 'paintedShipRig'; }
  const tunnelOpacity = useRef(0);
  const fxRef = useRef(null);
  const dronesRef = useRef(null);
  const beaconsRef = useRef(null);
  const alertsRef = useRef(alerts);   // kept fresh below without re-running the scene effect

  // FX group once
  useEffect(() => {
    const rig = rigRef.current;
    scene.add(rig);
    const fx = createShipArtFX();
    fxRef.current = fx;
    rig.add(fx.group);
    const drones = createDrones();
    dronesRef.current = drones;
    scene.add(drones.group);
    const beacons = createBeacons();
    beaconsRef.current = beacons;
    scene.add(beacons.group);
    return () => {
      scene.remove(beacons.group); beacons.dispose();
      rig.remove(fx.group); fx.dispose();
      scene.remove(drones.group); drones.dispose();
      scene.remove(rig);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Figures follow the roster present in crew
  useEffect(() => {
    const map = figuresRef.current;
    for (const member of crew) {
      // Future crew don't render in the painting — their ghost meshes read as
      // glitch boxes against the art. They stay listed in Map/List views.
      if (member.future) continue;
      if (!map.has(member.name)) {
        const fig = createCrewFigure({ name: member.name, color: member.color, future: member.future });
        // Pop against the dark painting: near-black garments take the member's
        // signature color, and every surface self-glows so nobody reads as a
        // silhouette sunk into the hull. Future crew stay ghosted — glowing
        // them turns the Quarters bunks into colored noise.
        const tint = new THREE.Color(member.color || '#2AABFF');
        fig.group.traverse((o) => {
          // Sculpted crew already carry the tint in their vertex colors; the
          // merged figure shares one material, so tinting it here would wash
          // the whole body one color instead of just the near-black garments.
          if (o.userData && o.userData.sculpted) return;
          // Rigged GLB crew carry real textures and a glTF material whose
          // emissiveIntensity defaults to 1 — the 0.4 self-glow below is a
          // legibility hack for flat procedural figures and simply bleaches
          // a real character. Leave skinned meshes alone.
          if (o.isSkinnedMesh) return;
          if (o.isMesh && o.material && 'emissive' in o.material && o.material.color) {
            const m = o.material;
            const lum = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11;
            if (lum < 0.16) m.color.lerp(tint, 0.45);
            m.emissive.copy(m.color).multiplyScalar(0.4);
          }
        });
        map.set(member.name, fig);
        rigRef.current.add(fig.group);
      }
    }
    // Dev-only hook for tests/ship-scene.html: lets the harness measure bones,
    // materials and positions of the live figures. Stripped from prod builds.
    if (import.meta.env.DEV && typeof window !== 'undefined') window.__shipPainted = { scene, figures: map, sim: simRef.current, rig: rigRef.current };
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew]);

  useEffect(() => () => {
    for (const fig of figuresRef.current.values()) { fig.group.parent?.remove(fig.group); fig.dispose(); }
    figuresRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  alertsRef.current = alerts;

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
    fxRef.current?.update(t, activityCount);
    // The hunter tracks the cursor: pointer (NDC) -> the art plane at z=0.
    if (dronesRef.current?.setPointer) {
      const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      const halfW = halfH * camera.aspect;
      dronesRef.current.setPointer(camera.position.x + pointer.x * halfW, camera.position.y + pointer.y * halfH);
    }
    dronesRef.current?.update(t);
    if (contactsRef && dronesRef.current?.getContacts) dronesRef.current.getContacts(contactsRef.current);
    beaconsRef.current?.update(t, alertsRef.current);
    // Flight: bank, breathe, bob; a little more shake inside the tunnels.
    const presence = tunnelPresence(t);
    tunnelOpacity.current = presence;
    if (enclosedRef) enclosedRef.current = presence > 0.5;
    const rig = rigRef.current;
    const shake = 1 + presence * 0.8;
    rig.rotation.z = (Math.sin(t / 6100) * 0.012 + Math.sin(t / 2300) * 0.004) * shake;
    rig.rotation.x = Math.sin(t / 4700) * 0.008 * shake;
    rig.position.y = Math.sin(t / 3300) * 5 * shake;
    rig.position.x = Math.sin(t / 5100) * 4;
    // Where the camera wants to be: a station's room when one is selected,
    // otherwise the pan point; zoom stacks the wheel on top of station zoom.
    const v = viewRef?.current || { zoom: 1, panX: 0, panY: 0 };
    const room = selectedStation ? ROOMS.find(r => r.id === selectedStation) : null;
    const f = focus.current;
    const wantX = room ? toThreeX((room.x0 + room.x1) / 2) : v.panX;
    const wantY = room ? toThreeY(floorYAt(room.deck, (room.x0 + room.x1) / 2) - 70) : v.panY;
    const wantZoom = (room ? VIEW_LIMITS.stationZoom : 1) * v.zoom;
    f.x += (wantX - f.x) * 0.06; f.y += (wantY - f.y) * 0.06; f.zoom += (wantZoom - f.zoom) * 0.06;
    // Parallax: the pointer moves the camera across the depth stack; every
    // plate sits at its own z, so the shift IS the parallax. Damped when zoomed.
    const par = 1 / f.zoom;
    const targetX = f.x + (pointer.x * 42 + Math.sin(t / 8000) * 9) * par;
    const targetY = f.y + (pointer.y * 24 + Math.cos(t / 10500) * 6) * par;
    camera.position.x += (targetX - camera.position.x) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.06;
    camera.position.z = CAM_Z / f.zoom + Math.sin(t / 14000) * 14;
    camera.lookAt(f.x, f.y, 0);
    // Station chips live INSIDE their bays (low, at the floor line) and are
    // projected through the live camera and the banking rig every frame, so
    // they stay on their rooms through flight, zoom and pan.
    if (chipEls?.current) {
      camera.updateMatrixWorld();
      const rig = rigRef.current;
      for (const r of ROOMS) {
        const el = chipEls.current.get(r.id); if (!el) continue;
        const cx = r.x0 + 14;
        const v = _anchor.current.set(toThreeX(cx), toThreeY(floorYAt(r.deck, cx) - 16), 22);
        rig.localToWorld(v).project(camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
        el.style.left = ((v.x + 1) / 2 * 100) + '%';
        el.style.top = ((1 - v.y) / 2 * 100) + '%';
        el.style.opacity = onScreen ? '' : '0';
      }
    }
  });

  return (
    <>
      {/* Art is unlit (MeshBasicMaterial); these lights shape the CREW so they
          read against the dark painting instead of sinking into it. */}
      {/* Ambient carries no direction, so it cannot describe a body. At 1.15
          against a 0.5 key it was drowning the only light that models form —
          which is why the crew read as flat cut-outs regardless of geometry.
          Key now leads; ambient and hemisphere are lift, not illumination.
          The painted plate is MeshBasicMaterial (unlit), so this moves the crew
          and drones only and cannot touch the artwork. Keep tests/ship-visual.html
          identical or the harness stops predicting production. */}
      {/* Rig matches the plate: low fill, a cool key from the screen wall, and
          a cyan rim from behind so the silhouette separates from the hull the
          way the painted figures' would. Crew materials are graded to sit
          under this (crewGLB.js GRADE). Mirror any change in tests/ship-visual.html. */}
      <ambientLight intensity={0.20} />
      <hemisphereLight args={['#6f9fcc', '#0e1014', 0.34]} />
      <directionalLight position={[-260, 220, 520]} intensity={1.35} color="#b8d4f0" />
      <directionalLight position={[240, 260, -320]} intensity={1.10} color="#4fa8e8" />
      <Suspense fallback={null}>
        <Plate url={PLATES.open} layer={LAYERS.open} renderOrder={0} />
        <Plate url={PLATES.open} layer={LAYERS.mid} renderOrder={1} opacity={0.62} tint={0x8aa0bc} yOffset={-330} />
        <Haze />
        <Plate url={PLATES.tunnel} layer={LAYERS.tunnel} opacityRef={tunnelOpacity} renderOrder={2} />
        <Plate url={PLATES.fg} layer={LAYERS.fg} renderOrder={2} alpha />
        <primitive object={rigRef.current}>
          <ShipCutout />
        </primitive>
        <Rain />
      </Suspense>
    </>
  );
}

export default function ShipPainted3D({ crew = [], activity = {}, alerts = {}, onStation, selectedStation, signals = {} }) {
  const simRef = useRef(null);
  const contactsRef = useRef([]);
  const enclosedRef = useRef(false);
  // View state lives in a ref (no re-render per wheel tick); DOM handlers below.
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const chipEls = useRef(new Map());
  const dragRef = useRef(null);
  const onWheel = (e) => {
    const v = viewRef.current;
    v.zoom = Math.min(VIEW_LIMITS.zoomMax, Math.max(VIEW_LIMITS.zoomMin, v.zoom * (1 - e.deltaY * 0.0012)));
  };
  const onPointerDown = (e) => { if (e.button !== 0) return; dragRef.current = { x: e.clientX, y: e.clientY, moved: 0 }; };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
    const v = viewRef.current; const k = 0.9 / v.zoom;
    v.panX = Math.max(-VIEW_LIMITS.panX, Math.min(VIEW_LIMITS.panX, v.panX - dx * k));
    v.panY = Math.max(-VIEW_LIMITS.panY, Math.min(VIEW_LIMITS.panY, v.panY + dy * k));
  };
  const onPointerUp = () => { dragRef.current = null; };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && selectedStation) onStation?.(selectedStation); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedStation, onStation]);
  const tunnelLike = useRef({ get enclosed() { return enclosedRef.current; } });
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
    <div onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      style={{ position: 'relative', width: '100%', aspectRatio: `${WORLD_W} / ${WORLD_H}`, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: '#05060a', cursor: dragRef.current ? 'grabbing' : 'default', touchAction: 'none' }}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 35, near: 1, far: 4000, position: [0, 0, CAM_Z] }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.NoToneMapping }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <SceneContent simRef={simRef} crew={crew} activityCount={counts} alerts={alerts} contactsRef={contactsRef} enclosedRef={enclosedRef} selectedStation={selectedStation} viewRef={viewRef} chipEls={chipEls} />
      </Canvas>
      {/* Vignette: pulls the eye to the hull and kills the flat-plate read at the edges */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(3,4,7,0.55) 100%)' }} />
      <ShipHUD contactsRef={contactsRef} signals={signals} tunnelRef={tunnelLike} />

      {/* Station chips — HTML overlay anchored to the art (clickable) */}
      {/* Zoomed in: the other chips are anchored to the rest framing and would
          float over the wrong rooms, so they clear out and the selected one
          becomes the way back. */}
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
        // Position is written every frame by SceneContent (projected anchor).
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
              borderLeft: `2px solid ${lit ? '#2AABFF' : 'rgba(229,229,234,0.35)'}`,
              borderRadius: 3, cursor: 'pointer', transition: 'opacity 200ms',
              fontSize: 7.5, letterSpacing: 0.9, textTransform: 'uppercase', ...mono,
              color: lit ? '#bfe3ff' : 'rgba(229,229,234,0.62)', whiteSpace: 'nowrap',
            }}>
            <span style={{ color: 'rgba(229,229,234,0.4)' }}>{meta?.n}</span> {meta?.label}
            {count > 0 && <span style={{ color: '#2AABFF', fontWeight: 700 }}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
