import React, { useEffect, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

// ── Source-of-Truth Registry card (Phase B, §3.B.6) ──────────────────────────
// Per data domain: which system is authoritative, sync direction, last sync,
// conflict state. Doctrine on display: Sprout owns the publishing schedule,
// Stripe owns payment status, Vantus owns deliverable/approval state — and
// anything mirrored INTO Vantus renders read-only where it appears.
// Rows are seeded by the 20260813_truth migration; this card is the honest
// dashboard of that contract, not an editor.

const DIR_LABEL = { none: 'native', pull: 'pull → Vantus', push: 'Vantus → push', two_way: 'two-way' };
const CONFLICT_COLOR = { clean: '#30d158', conflict: '#ff453a', unknown: '#ff9f0a' };

export default function TruthRegistryCard({ S }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let dead = false;
    if (!sb) { setRows([]); return; }
    sb.from('truth_registry').select('*').order('domain')
      .then(({ data, error }) => {
        if (dead) return;
        if (error) { setErr(error.message); setRows([]); }
        else setRows(data || []);
      });
    return () => { dead = true; };
  }, []);

  return (
    <div style={S.card}>
      <h3 style={S.cardTitle}>Source of Truth</h3>
      <div style={S.cardSub}>Who owns which data — mirrored data is read-only in Vantus</div>
      <div style={{ marginTop: 14 }}>
        {rows === null && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading…</div>}
        {rows !== null && rows.length === 0 && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {err ? 'Registry not available yet — apply the 20260813_truth migration.' : 'No registry rows.'}
          </div>
        )}
        {(rows || []).map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{String(r.domain).replace(/_/g, ' ')}</div>
              {r.notes && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{r.notes}</div>}
            </div>
            <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: '#2AABFF', background: 'rgba(42,171,255,0.08)', border: '1px solid rgba(42,171,255,0.25)', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>{r.authoritative_system}</span>
            <span style={{ fontSize: 9.5, fontFamily: "'Geist Mono', monospace", color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{DIR_LABEL[r.sync_direction] || r.sync_direction}</span>
            <span title={r.last_synced_at ? `last sync ${new Date(r.last_synced_at).toLocaleString()}` : 'never synced'} style={{ width: 7, height: 7, borderRadius: '50%', background: CONFLICT_COLOR[r.conflict_state] || CONFLICT_COLOR.unknown, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
