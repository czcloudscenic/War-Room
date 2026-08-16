import React from 'react';
import { STATIONS } from '../../core/shipStations.js';

// ── 3D View — Danny's mockup, made real (spec §10) ───────────────────────────
// Architecture matches his frame exactly: a cinematic ship-interior artwork as
// the stage, LIVE station callout cards floating over the rooms. The artwork
// is an ORIGINAL generation in his reference's mood (public/ship-interior.jpg)
// — per the likeness rule, no film characters; the crew lives in the DATA
// layer, not baked into the art. Every chip on every card is receipt-driven:
// if a card says an agent is working, agent_events proves it.

const mono = { fontFamily: "'Geist Mono', monospace" };
const HOLO = '#2AABFF';

const STATE_META = {
  working: { dot: '#30d158', label: 'Working', pulse: true },
  active:  { dot: '#2AABFF', label: 'Active',  pulse: false },
  idle:    { dot: 'rgba(255,255,255,0.35)', label: 'Idle', pulse: false },
  future:  { dot: 'rgba(255,255,255,0.18)', label: 'Future', pulse: false },
};

const humanize = (key) => (key || '').replace(/^(muse|sean|scrappy|cid|qc|intel|ops)_/, '').replace(/_/g, ' ');

function CrewChip({ c }) {
  const meta = STATE_META[c.state] || STATE_META.idle;
  return (
    <span title={c.lastAction ? `last receipt: ${c.lastAction} · ${new Date(c.lastTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'no receipts in window'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, ...mono, color: c.state === 'future' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, boxShadow: meta.pulse ? `0 0 7px ${meta.dot}` : 'none', animation: meta.pulse ? 'livePulse 1.6s ease-in-out infinite' : 'none' }} />
      {c.name}
      <span style={{ color: 'rgba(255,255,255,0.38)' }}>· {c.state === 'working' && c.lastAction ? humanize(c.lastAction) : meta.label}</span>
    </span>
  );
}

export default function ShipView3D({ crew = [], activity = {}, onStation, selectedStation }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1376 / 768', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: '#06070b' }}>
      <img src="/ship-interior.jpg" alt="" draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' }} />
      {/* vignette so the cards read against the art */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(3,4,7,0.55) 100%)' }} />

      {STATIONS.map(s => {
        const here = crew.filter(c => c.station === s.id);
        const receipts = (activity[s.id] || []).length;
        const lit = here.some(c => c.state === 'working' || c.state === 'active');
        const working = here.some(c => c.state === 'working');
        const isSel = selectedStation === s.id;
        return (
          <button key={s.id} onClick={() => onStation?.(s.id)}
            style={{
              position: 'absolute', left: `${s.px}%`, top: `${s.py}%`, transform: 'translate(-50%, -50%)',
              minWidth: 128, maxWidth: 162, textAlign: 'left', cursor: 'pointer',
              background: 'rgba(7,9,14,0.78)', backdropFilter: 'blur(6px)',
              border: `1px solid ${isSel ? HOLO : working ? 'rgba(48,209,88,0.55)' : lit ? 'rgba(42,171,255,0.45)' : 'rgba(255,255,255,0.14)'}`,
              borderRadius: 10, padding: '7px 10px 8px',
              boxShadow: working ? '0 0 18px rgba(48,209,88,0.25)' : lit ? '0 0 16px rgba(42,171,255,0.18)' : '0 2px 12px rgba(0,0,0,0.5)',
              zIndex: isSel ? 3 : lit ? 2 : 1, transition: 'border-color 0.4s, box-shadow 0.4s',
            }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 8, fontWeight: 700, ...mono, color: HOLO }}>{s.n} //</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: '#eaf2fa', fontFamily: 'Inter, sans-serif', flex: 1, whiteSpace: 'nowrap' }}>{s.label}</span>
              {receipts > 0 && <span style={{ fontSize: 8, fontWeight: 700, ...mono, color: HOLO, background: 'rgba(42,171,255,0.12)', border: '1px solid rgba(42,171,255,0.3)', borderRadius: 3, padding: '0px 4px' }}>{receipts}</span>}
            </div>
            <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.42)', marginTop: 2, fontFamily: 'Inter, sans-serif' }}>{s.sub}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
              {here.length === 0
                ? <span style={{ fontSize: 8.5, ...mono, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>unmanned</span>
                : here.slice(0, 4).map(c => <CrewChip key={c.name} c={c} />)}
              {here.length > 4 && <span style={{ fontSize: 8, ...mono, color: 'rgba(255,255,255,0.35)' }}>+{here.length - 4} more</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
