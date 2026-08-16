import React, { useMemo, useState } from 'react';
import { STATIONS, stationById } from '../../core/shipStations.js';

// ── 3D View — the ship cross-section (spec §10, Danny's mood, our crew) ──────
// Matrix-hovercraft mood: hull cross-section, station pods on three decks, a
// holo-core amidships, the city glittering below. Pure SVG + CSS depth — no
// three.js, no new deps, and nothing moves without a receipt (positions come
// in via the crew prop, computed by core/shipStations.positionCrew).

const mono = { fontFamily: "'Geist Mono', monospace" };
const HOLO = '#2AABFF';

const STATE_STYLE = {
  working: { opacity: 1, glow: 0.9 },
  active:  { opacity: 1, glow: 0.45 },
  idle:    { opacity: 0.7, glow: 0 },
  future:  { opacity: 0.22, glow: 0 },
};

function crewAtStation(crew, stationId) {
  return crew.filter(c => c.station === stationId);
}

export default function ShipView3D({ crew = [], activity = {}, onStation, selectedStation }) {
  const [hover, setHover] = useState(null);

  // Deterministic city lights (no Math.random per render — stable skyline).
  const cityLights = useMemo(() => {
    const lights = [];
    for (let i = 0; i < 90; i++) {
      const x = 20 + ((i * 37 + (i * i % 13) * 11) % 960);
      const y = 508 + ((i * 23) % 40);
      lights.push({ x, y, o: 0.12 + ((i * 7) % 10) / 40 });
    }
    return lights;
  }, []);

  return (
    <div style={{ perspective: 1400, overflow: 'hidden', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'radial-gradient(ellipse at 50% -20%, #101a26 0%, #0a0c12 45%, #06070b 100%)' }}>
      <div style={{ transform: 'rotateX(7deg)', transformOrigin: '50% 65%' }}>
        <svg viewBox="0 0 1000 560" style={{ width: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="hullGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#161c26" />
              <stop offset="100%" stopColor="#0c0f16" />
            </linearGradient>
            <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={HOLO} stopOpacity="0.55" />
              <stop offset="45%" stopColor={HOLO} stopOpacity="0.14" />
              <stop offset="100%" stopColor={HOLO} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0a0c12" stopOpacity="0" />
              <stop offset="100%" stopColor="#0e1f33" stopOpacity="0.7" />
            </linearGradient>
            <filter id="podGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* city below */}
          <rect x="0" y="490" width="1000" height="70" fill="url(#cityGrad)" />
          {cityLights.map((l, i) => <circle key={i} cx={l.x} cy={l.y} r="1.1" fill={HOLO} opacity={l.o} />)}

          {/* hull — cross-section silhouette */}
          <path
            d="M 40 300 C 30 190, 120 60, 320 52 L 700 52 C 880 58, 968 160, 962 290 C 958 388, 900 448, 780 456 L 240 456 C 130 450, 52 386, 40 300 Z"
            fill="url(#hullGrad)" stroke="rgba(42,171,255,0.28)" strokeWidth="1.5"
          />
          {/* deck lines */}
          {[186, 298].map(y => <line key={y} x1="70" y1={y} x2="930" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />)}
          {/* engine wash */}
          <ellipse cx="500" cy="470" rx="330" ry="14" fill={HOLO} opacity="0.06" />

          {/* holo-core amidships */}
          <ellipse cx="500" cy="255" rx="120" ry="150" fill="url(#coreGrad)" />
          <line x1="500" y1="120" x2="500" y2="410" stroke={HOLO} strokeWidth="1" opacity="0.25" strokeDasharray="2 5" />

          {/* station pods */}
          {STATIONS.map(s => {
            const receipts = (activity[s.id] || []).length;
            const here = crewAtStation(crew, s.id);
            const lit = here.some(c => c.state === 'working' || c.state === 'active');
            const isSel = selectedStation === s.id;
            const isHover = hover === s.id;
            return (
              <g key={s.id} onClick={() => onStation?.(s.id)} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="10"
                  fill={lit ? 'rgba(42,171,255,0.10)' : 'rgba(255,255,255,0.03)'}
                  stroke={isSel ? HOLO : isHover ? 'rgba(42,171,255,0.55)' : lit ? 'rgba(42,171,255,0.35)' : 'rgba(255,255,255,0.10)'}
                  strokeWidth={isSel ? 1.8 : 1}
                  filter={lit ? 'url(#podGlow)' : undefined}
                />
                <text x={s.x + 10} y={s.y + 17} fill="rgba(255,255,255,0.35)" fontSize="8.5" fontWeight="700" style={mono}>{s.n}</text>
                <text x={s.x + 10} y={s.y + 32} fill={lit ? '#eaf6ff' : 'rgba(255,255,255,0.78)'} fontSize="11.5" fontWeight="600" fontFamily="Inter, sans-serif">{s.label}</text>
                <text x={s.x + 10} y={s.y + 46} fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="Inter, sans-serif">{s.sub}</text>
                {receipts > 0 && (
                  <g>
                    <rect x={s.x + s.w - 34} y={s.y + 8} width="26" height="14" rx="4" fill="rgba(42,171,255,0.12)" stroke="rgba(42,171,255,0.3)" strokeWidth="0.75" />
                    <text x={s.x + s.w - 21} y={s.y + 18.5} fill={HOLO} fontSize="8.5" fontWeight="700" textAnchor="middle" style={mono}>{receipts}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* crew — receipt-driven positions, animated between stations */}
          {crew.map((c, ci) => {
            const s = stationById(c.station);
            const mates = crewAtStation(crew, c.station);
            const idx = mates.findIndex(m => m.name === c.name);
            const cx = s.x + 18 + (idx % 5) * 24 + (c.station === 'quarters' ? 8 : 0);
            const cy = s.y + s.h - 9;
            const st = STATE_STYLE[c.state] || STATE_STYLE.idle;
            return (
              <g key={c.name} opacity={st.opacity} style={{ transition: 'transform 1.2s cubic-bezier(0.4,0,0.2,1)', transform: `translate(${cx}px, ${cy}px)` }}>
                <title>{`${c.name} · ${c.role} — ${c.state === 'future' ? 'future crew (not commissioned)' : c.state}${c.lastAction ? ` · last receipt: ${c.lastAction} ${new Date(c.lastTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' · no receipts in window'}`}</title>
                {c.state === 'working' && <circle r="10" fill={c.color} opacity="0.25"><animate attributeName="r" values="8;13;8" dur="1.6s" repeatCount="indefinite" /></circle>}
                <circle r="7" fill={`${c.color}22`} stroke={c.color} strokeWidth={c.state === 'future' ? 0.75 : 1.5} strokeDasharray={c.state === 'future' ? '2 2' : undefined} />
                <text y="3" textAnchor="middle" fill={c.color} fontSize="7.5" fontWeight="800" fontFamily="Inter, sans-serif">{c.name[0]}</text>
                <text y="17" textAnchor="middle" fill={c.state === 'future' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)'} fontSize="7" style={mono}>{c.name}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
