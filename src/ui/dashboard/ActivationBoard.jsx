import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

// ── Activation-state dashboard (Phase A, v3 spec §3.A) ────────────────────────
// Rendered by DashboardRoute in place of the KPI grid while the book is
// under-configured. Shows the activation score, the next 5 actions (each
// deep-links via setActiveNav — there is no router), and the grouped
// deficiency lists. Every number derives from real configuration state via
// core/activation.js; nothing here is fabricated.

const ACCENT = '#2AABFF';
const card = { background: '#0f0d0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };
const mono = { fontFamily: "'Geist Mono', monospace" };

// Datasets the checklist needs beyond App state (clients/content arrive as
// props). skill_briefs tolerates a missing table so the app doesn't break if
// code deploys before the 20260805_activation migration is applied.
export function useActivationData() {
  const [accounts, setAccounts] = useState([]);
  const [clientUsers, setClientUsers] = useState([]);
  const [skillBriefs, setSkillBriefs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    (async () => {
      await sb.auth.getSession();
      const [acc, cu, briefs] = await Promise.all([
        sb.from('connected_accounts').select('id, client_id'),
        sb.from('client_users').select('id, client_id, status'),
        sb.from('skill_briefs').select('id, agent_name'),
      ]);
      if (cancelled) return;
      if (Array.isArray(acc.data)) setAccounts(acc.data);
      if (Array.isArray(cu.data)) setClientUsers(cu.data);
      if (briefs.error) console.warn('[activation] skill_briefs read failed (migration applied?)', briefs.error.message);
      if (Array.isArray(briefs.data)) setSkillBriefs(briefs.data);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return { accounts, clientUsers, skillBriefs, loaded };
}

function ScoreRing({ score }) {
  const r = 34, c = 2 * Math.PI * r;
  const color = score >= 80 ? '#30d158' : score >= 50 ? '#E5E5EA' : '#ff453a';
  return (
    <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
      <svg width="84" height="84" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 20, fontWeight: 700, color }}>
        {score}
      </div>
    </div>
  );
}

// book/loaded come from the caller (DashboardRoute runs useActivationData +
// bookActivation itself — it needs the same result to decide the KPI swap).
export default function ActivationBoard({ isMobile, book, loaded, setActiveNav, onPeek }) {
  // Deficiency groups: check label → failing client names.
  const groups = useMemo(() => {
    const g = new Map();
    for (const { client, activation } of book.perClient) {
      for (const check of activation.checks) {
        if (check.ok) continue;
        if (!g.has(check.key)) g.set(check.key, { label: check.label, nav: check.nav, critical: check.critical, names: [] });
        g.get(check.key).names.push(client.name);
      }
    }
    return [...g.values()].sort((a, b) => b.critical - a.critical || b.names.length - a.names.length);
  }, [book]);

  if (!loaded) {
    return <div style={{ ...card, padding: '22px 24px', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Reading configuration state…</div>;
  }

  return (
    <div style={{ marginBottom: isMobile ? 24 : 44, animation: 'fadeIn 0.4s ease' }}>
      {/* Header: score + framing + peek toggle */}
      <div style={{ ...card, padding: isMobile ? '18px 18px' : '24px 26px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 22, flexWrap: 'wrap' }}>
          <ScoreRing score={book.score} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(42,171,255,0.7)', ...mono, marginBottom: 6 }}>
              Activation state
            </div>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic', fontSize: isMobile ? 20 : 24, color: '#f5f5f7', letterSpacing: -0.5, lineHeight: 1.2 }}>
              {book.openActionCount === 0
                ? 'Fully configured. KPIs are live.'
                : `${book.openActionCount} configuration ${book.openActionCount === 1 ? 'gap' : 'gaps'} before the numbers mean anything.`}
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 6, lineHeight: 1.5, maxWidth: 560 }}>
              The score is computed only from real configuration — no fabricated metrics. Close the gaps below and the dashboard switches itself to live KPIs.
            </div>
          </div>
          <button onClick={onPeek}
            style={{ fontSize: 10, fontWeight: 700, ...mono, letterSpacing: 1, textTransform: 'uppercase', padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', flexShrink: 0 }}>
            View KPIs anyway
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: 14 }}>
        {/* Next 5 actions */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', ...mono, marginBottom: 12 }}>
            Next {Math.min(5, book.nextActions.length)} actions
          </div>
          {book.nextActions.length === 0 && (
            <div style={{ fontSize: 12, color: '#30d158' }}>Nothing left. The book is configured. ✓</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {book.nextActions.map((a, i) => (
              <button key={i} onClick={() => setActiveNav(a.nav)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', padding: '11px 13px', background: 'rgba(255,255,255,0.025)', border: `1px solid ${a.critical ? 'rgba(229,229,234,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: a.critical ? '#E5E5EA' : ACCENT, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#f5f5f7', lineHeight: 1.35 }}>{a.label}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 2, lineHeight: 1.4 }}>{a.detail}</span>
                </span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 2 }}>→</span>
              </button>
            ))}
          </div>
        </div>

        {/* Deficiency groups */}
        <div style={{ ...card, padding: '18px 20px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', ...mono, marginBottom: 12 }}>
            What's missing, by kind
          </div>
          {groups.length === 0 && book.agentsMissingBriefs.length === 0 && (
            <div style={{ fontSize: 12, color: '#30d158' }}>Every client passes every check. ✓</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.map(g => (
              <button key={g.label} onClick={() => setActiveNav(g.nav)}
                style={{ display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: g.critical ? '#E5E5EA' : 'rgba(255,255,255,0.8)', flexShrink: 0 }}>{g.label}</span>
                <span style={{ flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.names.join(' · ')}</span>
                <span style={{ ...mono, fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{g.names.length}</span>
              </button>
            ))}
            {book.agentsMissingBriefs.length > 0 && (
              <button onClick={() => setActiveNav('skills')}
                style={{ display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(229,229,234,0.25)', borderRadius: 9, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#E5E5EA', flexShrink: 0 }}>Agents without skill briefs</span>
                <span style={{ flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.agentsMissingBriefs.join(' · ')}</span>
                <span style={{ ...mono, fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{book.agentsMissingBriefs.length}</span>
              </button>
            )}
          </div>

          {/* Per-client score strip */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {book.perClient.map(({ client, activation }) => (
              <div key={client.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', width: isMobile ? 90 : 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{client.name}</span>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${activation.score}%`, background: activation.score >= 80 ? '#30d158' : activation.score >= 50 ? '#E5E5EA' : '#ff453a', borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ ...mono, fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', width: 34, textAlign: 'right', flexShrink: 0 }}>{activation.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
