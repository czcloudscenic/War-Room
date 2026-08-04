import React, { useState, useEffect } from 'react';
import { ACTION_COLORS } from '../../data/seed.agents.js';
import { sb } from '../../services/supabaseClient.js';

// ── Cross-client agent feed (Phase A) ─────────────────────────────────────────
// The founder-grade variant of ActivityFeed: no client_id filter, each row
// carries a client chip. Same source of truth (agent_events receipts) — the
// per-client Dashboard feed and this one are two renderings of the same rows,
// per the one-spine rule.

function humanizeAction(key, summary) {
  if (!key) return summary || '';
  const map = {
    muse_write_content:     'wrote content',
    muse_from_brief:        'generated from brief',
    muse_generate_calendar: 'generated calendar',
    muse_save_calendar:     'saved calendar',
    muse_ig_ideas:          'generated IG ideas',
    sean_briefing:          'ran morning briefing',
    scrappy_research:       'ran research',
    scrappy_muse_collab:    '× Muse collab',
    scrappy_hook_analysis:  'analyzed hooks',
    cid_build_brief:        'built CID brief',
    cid_ab_variations:      'generated A/B variations',
    qc_review:              'ran QC review',
  };
  return map[key] || key.replace(/_/g, ' ');
}

export default function AllActivityFeed({ clients = [], limit = 40 }) {
  const [rows, setRows] = useState([]);
  const nameOf = (id) => (clients.find(c => c.id === id)?.name) || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await sb
          .from('agent_events')
          .select('id, ts, agent_name, action_key, result_status, result_summary, client_id')
          .order('ts', { ascending: false })
          .limit(limit);
        if (cancelled) return;
        if (error) { console.warn('[AllActivityFeed] fetch error', error); return; }
        setRows(data || []);
      } catch (e) { console.warn('[AllActivityFeed] fetch threw', e); }
    })();

    const channel = sb.channel('agent_events_all')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_events' },
        (payload) => setRows(prev => [payload.new, ...prev].slice(0, limit))
      ).subscribe();

    return () => { cancelled = true; sb.removeChannel(channel); };
  }, [limit]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: '12px 14px', fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', fontStyle: 'italic' }}>
        No agent receipts yet across the book.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {rows.map((row, i) => {
        const time = new Date(row.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const color = ACTION_COLORS[(row.agent_name || '').toLowerCase()] || ACTION_COLORS[row.agent_name] || '#2AABFF';
        const clientName = nameOf(row.client_id);
        return (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: i === 0 ? `${color}0a` : 'transparent', borderRadius: 8, borderLeft: i === 0 ? `2px solid ${color}` : '2px solid transparent' }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>{time}</span>
            <span style={{ fontSize: 10, color, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.agent_name}</span>
            <span style={{ flex: 1, fontSize: 10, color: row.result_status === 'error' ? '#ff453a' : 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {humanizeAction(row.action_key, row.result_summary)}
            </span>
            {clientName && (
              <span style={{ fontSize: 8.5, fontFamily: "'Geist Mono', monospace", color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{clientName}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
