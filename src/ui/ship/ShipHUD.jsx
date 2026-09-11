import React, { useEffect, useRef, useState } from 'react';

// ── Ship HUD: radar + comms, real signal only ────────────────────────────────
// Radar: a top-down sweep of the space around the hull. Every blip is a
// machine that exists in the scene at that position (getContacts); nothing is
// painted on for mood. Comms: the link home, driven by the same numbers the
// route already trusts (last backup export, last receipt, data reachability).
// Doctrine: if the panel says something, it is true, or the panel says unknown.

const mono = { fontFamily: "'Geist Mono', monospace" };
const INK = '#E5E5EA';
const RANGE = 1700; // scene units shown edge-to-edge on the radar

function fmtAge(ms) {
  if (ms == null) return 'no signal';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ShipHUD({ contactsRef, signals = {}, tunnelRef }) {
  const canvasRef = useRef(null);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(id); }, []);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let raf = 0; const start = performance.now();
    const draw = () => {
      const t = performance.now() - start;
      const w = c.width, h = c.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 4;
      ctx.clearRect(0, 0, w, h);
      // rings + cross
      ctx.strokeStyle = 'rgba(229,229,234,0.16)'; ctx.lineWidth = 1;
      for (const k of [0.33, 0.66, 1]) { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
      // sweep
      const ang = (t / 2600) * Math.PI * 2;
      const grad = ctx.createConicGradient ? ctx.createConicGradient(ang - Math.PI / 2, cx, cy) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(42,171,255,0.28)'); grad.addColorStop(0.18, 'rgba(42,171,255,0.0)'); grad.addColorStop(1, 'rgba(42,171,255,0.0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }
      // the hull (a short bar, nose to the left = -x)
      ctx.fillStyle = 'rgba(229,229,234,0.85)'; ctx.fillRect(cx - (600 / RANGE) * r, cy - 1.5, (1200 / RANGE) * r, 3);
      // contacts
      const contacts = contactsRef.current || [];
      for (const k of contacts) {
        const px = cx + (k.x / RANGE) * r * 2, py = cy - (k.z / RANGE) * r * 2; // +z toward camera = up on the radar
        if (Math.hypot(px - cx, py - cy) > r) continue;
        ctx.fillStyle = k.kind === 'pass' ? '#ff453a' : k.kind === 'far' ? 'rgba(229,229,234,0.5)' : INK;
        ctx.beginPath(); ctx.arc(px, py, k.kind === 'pass' ? 3.2 : 2.4, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [contactsRef]);

  const now = Date.now();
  const rows = [
    { k: 'HOME LINK', v: signals.linkOk == null ? 'unknown' : signals.linkOk ? 'ESTABLISHED' : 'LOST', ok: signals.linkOk },
    { k: 'LAST BACKUP', v: signals.backupOk == null ? 'unknown' : signals.backupOk ? 'OK' : 'FAILED', ok: signals.backupOk },
    { k: 'LAST RECEIPT', v: signals.lastReceiptTs ? fmtAge(now - new Date(signals.lastReceiptTs).getTime()) : 'none in 48h', ok: !!signals.lastReceiptTs },
    { k: 'CONTACTS', v: String((contactsRef.current || []).length), ok: true },
  ];
  const panel = { position: 'absolute', bottom: 12, background: 'rgba(6,8,13,0.72)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, ...mono };
  return (
    <>
      <div style={{ ...panel, left: 12, padding: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
        <canvas ref={canvasRef} width={96} height={96} style={{ width: 96, height: 96, display: 'block' }} />
        <div style={{ fontSize: 8.5, letterSpacing: 1.2, color: 'rgba(229,229,234,0.55)', textTransform: 'uppercase', lineHeight: 1.7 }}>
          <div style={{ color: INK }}>RADAR</div>
          <div>range {RANGE}</div>
          <div>{tunnelRef?.current?.enclosed ? 'ENCLOSED' : 'OPEN AIR'}</div>
        </div>
      </div>
      <div style={{ ...panel, right: 12, padding: '8px 12px', fontSize: 8.5, letterSpacing: 1.2, textTransform: 'uppercase', lineHeight: 1.9, minWidth: 190 }}>
        <div style={{ color: INK, marginBottom: 2 }}>COMMS · HOME</div>
        {rows.map(rw => (
          <div key={rw.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: 'rgba(229,229,234,0.55)' }}>
            <span>{rw.k}</span>
            <span style={{ color: rw.ok === false ? '#ff453a' : rw.ok ? '#30d158' : 'rgba(229,229,234,0.45)' }}>{rw.v}</span>
          </div>
        ))}
      </div>
    </>
  );
}
