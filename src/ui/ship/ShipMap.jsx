import React from 'react';
import { STATIONS } from '../../core/shipStations.js';

// ── Map View — the flat 2D station diagram (spec §10 middle rendering) ──────
// Same spine as the 3D view: STATIONS + receipt-driven crew positions, drawn
// as a schematic grid instead of the hull. Faster to scan, zero decoration.

const mono = { fontFamily: "'Geist Mono', monospace" };
const STATE_DOT = { working: '#30d158', active: '#2AABFF', idle: 'rgba(255,255,255,0.35)', future: 'rgba(255,255,255,0.18)' };

export default function ShipMap({ crew = [], activity = {}, onStation, selectedStation }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
      {STATIONS.map(s => {
        const here = crew.filter(c => c.station === s.id);
        const receipts = (activity[s.id] || []).length;
        const lit = here.some(c => c.state === 'working' || c.state === 'active');
        const isSel = selectedStation === s.id;
        return (
          <button key={s.id} onClick={() => onStation?.(s.id)}
            style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
              background: lit ? 'rgba(42,171,255,0.06)' : '#0f0d0e',
              border: `1px solid ${isSel ? '#2AABFF' : lit ? 'rgba(42,171,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
              fontFamily: 'Inter, sans-serif',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)', ...mono }}>{s.n}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#f5f5f7', flex: 1 }}>{s.label}</span>
              {receipts > 0 && <span style={{ fontSize: 9, fontWeight: 700, ...mono, color: '#2AABFF', background: 'rgba(42,171,255,0.1)', border: '1px solid rgba(42,171,255,0.3)', borderRadius: 4, padding: '1px 6px' }}>{receipts}</span>}
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{s.sub}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 9, minHeight: 16, flexWrap: 'wrap' }}>
              {here.length === 0
                ? <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>unmanned</span>
                : here.map(c => (
                  <span key={c.name} title={`${c.role} — ${c.state}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, ...mono, color: c.state === 'future' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATE_DOT[c.state], boxShadow: c.state === 'working' ? `0 0 6px ${STATE_DOT[c.state]}` : 'none' }} />
                    {c.name}{c.state === 'future' ? ' (future)' : ''}
                  </span>
                ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
