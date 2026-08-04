import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { commandDigest } from '../../core/commandDigest.js';
import AllActivityFeed from './AllActivityFeed.jsx';
import NotificationDigest from './NotificationDigest.jsx';
import Card from '../shared/Card.jsx';

// ── Founder daily command view (Phase A, v3 spec §3.A) ────────────────────────
// One screen answering "what needs attention now" across the whole book, in
// priority tiers: critical / requires you / due today / blocked / at risk —
// plus the cross-client agent receipts feed (routine tier). Tiering is pure
// (core/commandDigest.js); this component only fetches the datasets App state
// doesn't hold (open tasks, invoices, pending portal users) and renders.

const mono = { fontFamily: "'Geist Mono', monospace" };
const card = { background: '#0f0d0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };

const TIERS = [
  { key: 'critical', label: 'Critical', color: '#ff453a' },
  { key: 'founder',  label: 'Requires you', color: '#bf5af2' },
  { key: 'dueToday', label: 'Due today', color: '#ff9f0a' },
  { key: 'blocked',  label: 'Blocked', color: '#f97316' },
  { key: 'atRisk',   label: 'At risk', color: '#64d2ff' },
];

export default function CommandView({ isMobile, clients, content, setActiveNav }) {
  const [tasks, setTasks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [expanded, setExpanded] = useState(null); // tier key | null

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    (async () => {
      await sb.auth.getSession();
      const [t, inv, pu] = await Promise.all([
        sb.from('tasks').select('id, title, status, priority, client_id, due_date').neq('status', 'done'),
        sb.from('invoices').select('id, number, client_id, amount, status, due_date').in('status', ['sent', 'overdue']),
        sb.from('client_users').select('id, client_id, email, status').eq('status', 'pending'),
      ]);
      if (cancelled) return;
      if (Array.isArray(t.data)) setTasks(t.data);
      if (Array.isArray(inv.data)) setInvoices(inv.data);
      if (Array.isArray(pu.data)) setPendingUsers(pu.data);
    })();
    return () => { cancelled = true; };
  }, []);

  const digest = useMemo(
    () => commandDigest({ clients, content, tasks, invoices, pendingUsers, now: Date.now() }),
    [clients, content, tasks, invoices, pendingUsers]
  );

  const totalOpen = TIERS.reduce((s, t) => s + digest[t.key].length, 0);

  return (
    <div style={{ marginBottom: isMobile ? 24 : 44 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 20 : 24, fontWeight: 400, fontStyle: 'italic', color: '#f0eeef', margin: 0, letterSpacing: -0.5 }}>
          Today.
        </h2>
        <span style={{ fontSize: 11, color: totalOpen === 0 ? '#30d158' : 'rgba(255,255,255,0.4)' }}>
          {totalOpen === 0 ? 'Nothing needs attention. Rare — enjoy it.' : `${totalOpen} item${totalOpen === 1 ? '' : 's'} need attention`}
        </span>
      </div>

      {/* Tier summary row — click a tier to expand its list */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 8, marginBottom: expanded ? 10 : 0 }}>
        {TIERS.map(t => {
          const n = digest[t.key].length;
          const active = expanded === t.key;
          return (
            <button key={t.key} onClick={() => setExpanded(active ? null : n > 0 ? t.key : null)}
              style={{ ...card, padding: '12px 14px', textAlign: 'left', cursor: n > 0 ? 'pointer' : 'default', borderColor: active ? `${t.color}55` : n > 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ ...mono, fontSize: 20, fontWeight: 700, color: n > 0 ? t.color : 'rgba(255,255,255,0.25)', lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: n > 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)', marginTop: 6, fontWeight: 600, ...mono }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Expanded tier list */}
      {expanded && digest[expanded].length > 0 && (
        <div style={{ ...card, padding: '6px 8px', marginBottom: 4 }}>
          {digest[expanded].map((e, i) => (
            <button key={i} onClick={() => setActiveNav(e.nav)}
              style={{ display: 'flex', alignItems: 'baseline', gap: 10, width: '100%', textAlign: 'left', padding: '9px 10px', background: 'transparent', border: 'none', borderBottom: i < digest[expanded].length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#f5f5f7', lineHeight: 1.4 }}>{e.label}</span>
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', flexShrink: 0, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      )}

      {/* Routine tier: agent receipts + the cross-client notification digest */}
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', ...mono, marginBottom: 10 }}>
            What agents completed — all clients
          </div>
          <Card style={{ padding: '4px 0', maxHeight: 340, overflowY: 'auto' }}>
            <AllActivityFeed clients={clients} limit={40} />
          </Card>
        </div>
        <div style={{ paddingTop: isMobile ? 0 : 21 }}>
          <NotificationDigest isMobile={isMobile} clients={clients} />
        </div>
      </div>
    </div>
  );
}
