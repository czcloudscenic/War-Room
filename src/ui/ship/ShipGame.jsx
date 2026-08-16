import React, { useEffect, useRef } from 'react';
import { WORLD_W, WORLD_H } from '../../ship/world.js';
import { createShipSim } from '../../ship/shipEngine.js';
import { renderShip, hitTestStation } from '../../ship/shipRenderer.js';

// ── The living ship (Terraria-style) ─────────────────────────────────────────
// Canvas host for the ship game: engine (src/ship/shipEngine.js) moves the
// crew, renderer (src/ship/shipRenderer.js) draws the world, and THIS file
// just runs the loop and bridges React state in. The movement rule holds all
// the way down: crew targets come from positionCrew(receipts) via props —
// nobody walks anywhere a receipt (or honest idleness) didn't send them.

export default function ShipGame({ crew = [], activity = {}, onStation, selectedStation }) {
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const frameRef = useRef({ activity: {}, selectedStation: null, hoverStation: null });

  // Keep latest props visible to the RAF loop without re-arming it.
  frameRef.current.activity = Object.fromEntries(Object.entries(activity).map(([k, v]) => [k, Array.isArray(v) ? v.length : v]));
  frameRef.current.selectedStation = selectedStation || null;

  if (!simRef.current) simRef.current = createShipSim();

  // Push crew targets whenever the receipt-driven positions change.
  useEffect(() => { simRef.current.setCrew(crew); }, [crew]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let dead = false;

    const fit = () => {
      const parentW = canvas.parentElement?.clientWidth || WORLD_W;
      const scale = parentW / WORLD_W;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(WORLD_W * scale * dpr);
      canvas.height = Math.round(WORLD_H * scale * dpr);
      canvas.style.width = `${Math.round(WORLD_W * scale)}px`;
      canvas.style.height = `${Math.round(WORLD_H * scale)}px`;
      canvas._logicalScale = scale * dpr;
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const loop = (now) => {
      if (dead) return;
      const dt = now - last;
      last = now;
      simRef.current.tick(dt, now);
      const s = canvas._logicalScale || 1;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      renderShip(ctx, {
        t: now,
        sprites: simRef.current.getSprites(),
        activity: frameRef.current.activity,
        selectedStation: frameRef.current.selectedStation,
        hoverStation: frameRef.current.hoverStation,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const toLogical = (e) => {
      const rect = canvas.getBoundingClientRect();
      return [
        (e.clientX - rect.left) * (WORLD_W / rect.width),
        (e.clientY - rect.top) * (WORLD_H / rect.height),
      ];
    };
    const onClick = (e) => {
      const [x, y] = toLogical(e);
      const id = hitTestStation(x, y);
      if (id) onStation?.(id);
    };
    const onMove = (e) => {
      const [x, y] = toLogical(e);
      const id = hitTestStation(x, y);
      frameRef.current.hoverStation = id;
      canvas.style.cursor = id ? 'pointer' : 'default';
    };
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousemove', onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: '#05060a', lineHeight: 0 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
