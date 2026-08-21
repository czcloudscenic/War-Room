import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { notifMeta } from '../../utils/constants.js';

// ── Cross-client notification digest (Phase A, v3 spec §3.A) ─────────────────
// The bell is scoped to the active client; this is the book-wide view, grouped
// client → type, with per-role filter tabs (Founder / Ops / Finance — the role
// each NOTIF_META type maps to). Admin RLS already permits the unscoped read;
// writes stay server-only via /api/notify. In-app only: email digests wait on
// RESEND_API_KEY (founder-side), and nothing here pretends otherwise.

const mono = { fontFamily: "'Geist Mono', monospace" };
const card = { background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };

const ROLE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'founder', label: 'Founder' },
  { key: 'ops', label: 'Ops' },
  { key: 'finance', label: 'Finance' },
];

export default function NotificationDigest({ isMobile, clients = [] }) {
  const [rows, setRows] = useState([]);
  const [role, setRole] = useState('all');
  const nameOf = (id) => (clients.find(c => c.id === id)?.name) || 'Unassigned';

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    (async () => {
      await sb.auth.getSession();
      const { data, error } = await sb
        .from('notifications')
        .select('id, ts, type, payload, read, client_id')
        .order('ts', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) { console.warn('[NotificationDigest] fetch error', error); return; }
      setRows(data || []);
    })();
    const ch = sb.channel('notifications_all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => setRows(prev => [payload.new, ...prev].slice(0, 200)))
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, []);

  // role filter → group by client, newest group first
  const groups = useMemo(() => {
    const filtered = role === 'all' ? rows : rows.filter(r => notifMeta(r.type).role === role);
    const byClient = new Map();
    for (const r of filtered) {
      const key = r.client_id || 'none';
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key).push(r);
    }
    return [...byClient.entries()]
      .map(([clientId, list]) => ({
        clientId,
        name: clientId === 'none' ? 'Unassigned' : nameOf(clientId),
        list: list.slice(0, 6),
        total: list.length,
        unread: list.filter(r => !r.read).length,
        latest: list[0]?.ts,
      }))
      .sort((a, b) => Date.parse(b.latest || 0) - Date.parse(a.latest || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, role, clients]);

  return (
    <div style={{ ...card, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', ...mono }}>
          Notification digest — all clients
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {ROLE_TABS.map(t => (
            <button key={t.key} onClick={() => setRole(t.key)}
              style={{ fontSize: 9.5, fontWeight: 700, ...mono, letterSpacing: 0.8, textTransform: 'uppercase', padding: '5px 10px', borderRadius: 7, cursor: 'pointer', background: role === t.key ? 'rgba(42,171,255,0.15)' : 'transparent', border: role === t.key ? '1px solid rgba(42,171,255,0.4)' : '1px solid rgba(255,255,255,0.1)', color: role === t.key ? '#2AABFF' : 'rgba(255,255,255,0.45)' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', padding: '8px 0' }}>
          Nothing in this lane yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 340, overflowY: 'auto' }}>
        {groups.map(g => (
          <div key={g.clientId}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#f5f5f7' }}>{g.name}</span>
              {g.unread > 0 && <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: '#ff453a' }}>{g.unread} new</span>}
              {g.total > g.list.length && <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)' }}>+{g.total - g.list.length} more</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {g.list.map(n => {
                const meta = notifMeta(n.type);
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '4px 2px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, flexShrink: 0, alignSelf: 'center', opacity: n.read ? 0.35 : 1 }} />
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: n.read ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>{meta.label}</span>
                    <span style={{ flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.payload?.item?.title || n.payload?.message || ''}</span>
                    <span style={{ ...mono, fontSize: 8.5, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                      {new Date(n.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
