import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { ACTION_COLORS } from '../../data/seed.agents.js';
import { blockReasonMeta } from '../../core/truth.js';
import Card from '../shared/Card.jsx';

// ── The Founder Rail — List View of the Agent Ship (spec §10, ship-the-rail-first) ──
// Danny's mockup, verbatim tiers: DONE last 48h (receipts) / WORKING NOW /
// QUEUED NEXT / BLOCKED / APPROVALS with Review Now — plus the real-numbers
// bottom bar. Every row is driven by receipts (agent_events) or real record
// state; nothing is animated into existence. The movement rule starts here:
// if this rail says an agent did something, a receipt proves it. When the Map
// and 3D ship views land (Phase E), they render THESE tiers — same spine.
//
// Honesty notes:
// - WORKING NOW is empty today ON PURPOSE: current agent actions complete in
//   seconds (request→receipt), so there is no persistent in-flight state to
//   show. The tier exists because queued/long-running agents (Route, Phase D)
//   will fill it — until then an honest empty beats theater.
// - DONE shows successes; failures are counted, not hidden.

const mono = { fontFamily: "'Geist Mono', monospace" };
const DAY_MS = 86400000;
const GATE_STATUSES = ['Need Copy Approval', 'Need Content Approval'];

const tierHead = (color) => ({ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color, ...mono, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 6px' });
const countPill = (color) => ({ fontSize: 9, fontWeight: 700, ...mono, color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 4, padding: '1px 6px' });
const emptyLine = { padding: '2px 14px 10px', fontSize: 10.5, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' };

function humanizeAction(key) {
  if (!key) return '';
  const map = {
    muse_write_content: 'wrote content', muse_from_brief: 'generated from brief',
    muse_generate_calendar: 'generated calendar', muse_save_calendar: 'saved calendar',
    muse_ig_ideas: 'generated IG ideas', muse_idea_list: 'listed ideas', muse_film_brief: 'built film brief',
    sean_briefing: 'ran morning briefing', scrappy_research: 'ran research',
    scrappy_muse_collab: 'collabed with Muse', scrappy_hook_analysis: 'analyzed hooks',
    scrappy_analyze_performance: 'analyzed performance',
    cid_build_brief: 'built CID brief', cid_ab_variations: 'generated A/B variations',
    qc_review: 'ran QC review',
    intel_score_content: 'scored content vs benchmarks', intel_generate_ideas: 'generated intel ideas',
    intel_set_idea_status: 'updated idea status',
  };
  return map[key] || key.replace(/_/g, ' ');
}

const fmtT = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AgentRail({ isMobile, clients = [], content = [], tasks = [], setActiveNav }) {
  const [events, setEvents] = useState([]);
  const [failCount, setFailCount] = useState(0);
  const [lastBackup, setLastBackup] = useState(null);
  const [openReceipt, setOpenReceipt] = useState(null); // event id | null
  const nameOf = (id) => (clients.find(c => c.id === id)?.name) || null;

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    const since = new Date(Date.now() - 2 * DAY_MS).toISOString();
    (async () => {
      const [{ data: ev }, { data: bk }] = await Promise.all([
        sb.from('agent_events').select('id, ts, agent_name, action_key, result_status, result_summary, payload, client_id, content_item_id').gte('ts', since).order('ts', { ascending: false }).limit(120),
        sb.from('backup_runs').select('status, started_at').eq('kind', 'export').order('started_at', { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      const rows = ev || [];
      setEvents(rows.filter(r => r.result_status === 'success'));
      setFailCount(rows.filter(r => r.result_status === 'error').length);
      setLastBackup(bk?.[0] || null);
    })();

    const ch = sb.channel('agent_rail_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_events' }, (payload) => {
        const row = payload.new;
        if (row.result_status === 'success') setEvents(prev => [row, ...prev].slice(0, 120));
        else if (row.result_status === 'error') setFailCount(n => n + 1);
      })
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(ch); };
  }, []);

  // QUEUED NEXT: open agent-created work, why it's next comes from tasks.reason.
  const queued = useMemo(
    () => (tasks || []).filter(t => t.source === 'ai_ops' && t.status !== 'done').slice(0, 8),
    [tasks]
  );

  // BLOCKED: explicit block records + QC hard-blocks — real state, with owners.
  const blocked = useMemo(() => {
    const out = [];
    for (const x of content || []) {
      if (['Posted', 'Scrapped'].includes(x.status)) continue;
      if (x.block_reason) {
        const meta = blockReasonMeta(x.block_reason);
        out.push({ id: x.id, title: x.title, clientName: nameOf(x.client_id), why: meta?.label || x.block_reason, owner: x.block_owner || 'no owner', paused: !!x.block_external });
      } else if (x.qc_status === 'blocked') {
        out.push({ id: x.id, title: x.title, clientName: nameOf(x.client_id), why: 'QC factual block', owner: 'fix + re-run QC', paused: false });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, clients]);

  // APPROVALS: everything sitting at a gate, internal vs client-court.
  const approvals = useMemo(
    () => (content || []).filter(x => GATE_STATUSES.includes(x.status)),
    [content]
  );

  const activeAgents = useMemo(() => new Set(events.map(e => e.agent_name)).size, [events]);
  const lastReceiptAge = events[0] ? Math.round((Date.now() - new Date(events[0].ts).getTime()) / 3600000) : null;

  const stat = (value, label, color = '#f5f5f7') => (
    <div key={label} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '8px 4px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, ...mono, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 7.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* WORKING NOW */}
      <div style={tierHead('#64d2ff')}>Working now <span style={countPill('#64d2ff')}>0</span></div>
      <div style={emptyLine}>Nothing mid-flight — today's agents complete in seconds; the receipt lands below. Long-running crew (Route) fills this tier in Phase D.</div>

      {/* QUEUED NEXT */}
      <div style={tierHead('#bf5af2')}>Queued next <span style={countPill('#bf5af2')}>{queued.length}</span></div>
      {queued.length === 0 ? <div style={emptyLine}>Nothing agent-queued.</div> : queued.map(t => (
        <button key={t.id} onClick={() => setActiveNav?.('operations')} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
          <span style={{ fontSize: 8.5, ...mono, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{t.reason || t.priority}</span>
        </button>
      ))}

      {/* BLOCKED */}
      <div style={tierHead('#E5E5EA')}>Blocked <span style={countPill('#E5E5EA')}>{blocked.length}</span></div>
      {blocked.length === 0 ? <div style={emptyLine}>Nothing blocked.</div> : blocked.slice(0, 8).map(b => (
        <button key={b.id} onClick={() => setActiveNav?.('ledger')} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title || 'Untitled'}{b.clientName ? ` · ${b.clientName}` : ''}</span>
          <span style={{ fontSize: 8.5, ...mono, color: '#E5E5EA', whiteSpace: 'nowrap' }}>{b.why}{b.paused ? ' · SLA paused' : ''} · {b.owner}</span>
        </button>
      ))}

      {/* APPROVALS */}
      <div style={tierHead('#2AABFF')}>
        Approvals <span style={countPill('#2AABFF')}>{approvals.length}</span>
        {approvals.length > 0 && (
          <button onClick={() => setActiveNav?.('approvals')} style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, ...mono, letterSpacing: 1, textTransform: 'uppercase', color: '#2AABFF', background: 'rgba(42,171,255,0.1)', border: '1px solid rgba(42,171,255,0.35)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            Review now
          </button>
        )}
      </div>
      {approvals.length === 0 ? <div style={emptyLine}>Nothing at a gate.</div> : approvals.slice(0, 6).map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px' }}>
          <span style={{ flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || 'Untitled'}{nameOf(a.client_id) ? ` · ${nameOf(a.client_id)}` : ''}</span>
          <span style={{ fontSize: 8.5, ...mono, color: a.approval_mode === 'client' ? '#64d2ff' : '#bf5af2', whiteSpace: 'nowrap' }}>{a.approval_mode === 'client' ? "client's court" : 'internal'}</span>
        </div>
      ))}

      {/* DONE LAST 48H — receipts, expandable */}
      <div style={tierHead('#30d158')}>
        Done — last 48h <span style={countPill('#30d158')}>{events.length}</span>
        {failCount > 0 && <span style={{ ...countPill('#ff453a'), marginLeft: 4 }}>{failCount} failed</span>}
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', paddingBottom: 6 }}>
        {events.length === 0 ? <div style={emptyLine}>No receipts in the window.</div> : events.map(e => {
          const color = ACTION_COLORS[(e.agent_name || '').toLowerCase()] || ACTION_COLORS[e.agent_name] || '#2AABFF';
          const open = openReceipt === e.id;
          return (
            <div key={e.id}>
              <button onClick={() => setOpenReceipt(open ? null : e.id)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '4px 14px', background: open ? 'rgba(255,255,255,0.03)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 8.5, ...mono, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{fmtT(e.ts)}</span>
                <span style={{ fontSize: 10, color, fontWeight: 700, whiteSpace: 'nowrap' }}>{e.agent_name}</span>
                <span style={{ flex: 1, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{humanizeAction(e.action_key)}</span>
                {nameOf(e.client_id) && <span style={{ fontSize: 8, ...mono, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{nameOf(e.client_id)}</span>}
              </button>
              {open && (
                <div style={{ margin: '2px 14px 8px', padding: '8px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{e.result_summary || 'No summary recorded.'}</div>
                  <div style={{ fontSize: 9, ...mono, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>
                    receipt: {e.action_key}{e.content_item_id ? ` · item ${String(e.content_item_id).slice(0, 24)}` : ''}{e.payload && Object.keys(e.payload).length ? ` · inputs ${JSON.stringify(e.payload).slice(0, 120)}` : ''}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BOTTOM BAR — real numbers only */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
        {stat(activeAgents, 'agents active', '#2AABFF')}
        {stat(0, 'in progress', 'rgba(255,255,255,0.5)')}
        {stat(events.length, 'done 48h', '#30d158')}
        {stat(blocked.length, 'blocked', blocked.length ? '#E5E5EA' : 'rgba(255,255,255,0.5)')}
        {stat(approvals.length, 'approvals', approvals.length ? '#2AABFF' : 'rgba(255,255,255,0.5)')}
        {stat(
          lastBackup ? (lastBackup.status === 'ok' ? 'OK' : 'FAIL') : '—',
          `backup${lastReceiptAge != null ? ` · rcpt ${lastReceiptAge}h` : ''}`,
          lastBackup?.status === 'ok' ? '#30d158' : lastBackup ? '#ff453a' : 'rgba(255,255,255,0.5)'
        )}
      </div>
    </Card>
  );
}
