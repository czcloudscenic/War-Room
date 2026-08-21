import React, { useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';
import { useSupabaseRows } from '../../utils/hooks.js';
import { readMetrics, computeRates, beatsBar, fmtPct, fmtNum, DEFAULT_BENCH } from '../../utils/contentMetrics.js';
import BenchmarksCard from '../intel/BenchmarksCard.jsx';
import PillarsEditor from '../intel/PillarsEditor.jsx';
import IdeaPromoteButton from '../intel/IdeaPromoteButton.jsx';

// ── Content Intel ─────────────────────────────────────────────────────────────
// Ranked post performance vs benchmarks + the AI idea queue, per client.
// Ported from Studio Intel's IntelRoute, generalized multi-tenant. Reads the
// IG posts the platform sync already lands in account_posts; benchmarks come
// from content_benchmarks with Studio's proven defaults as fallback.
// Approving an idea NEVER posts anything — it only feeds the taste loop.

const ACCENT = '#2AABFF';
const GOOD = '#30d158';
const BAD = '#ff453a';
const WARN = '#E5E5EA';
const card = { background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const mono = { fontFamily: "'Geist Mono', monospace" };

const SORTS = [
  { key: 'send_rate', label: 'Send-rate' },
  { key: 'save_rate', label: 'Save-rate' },
  { key: 'views', label: 'Views' },
];

async function callAgentAction(action, clientId, payload = {}) {
  const res = await apiFetch('/api/agent-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload, client_id: clientId || null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${action} failed (${res.status})`);
  return data.result ?? data;
}

function RateCell({ value, bar }) {
  if (value == null) return <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>;
  const beats = beatsBar(value, bar);
  const color = beats == null ? '#f5f5f7' : beats ? GOOD : BAD;
  return (
    <span style={{ color, fontSize: 12, ...mono }}>
      {fmtPct(value)}
      {beats != null && <span style={{ fontSize: 9, marginLeft: 3 }}>{beats ? '▲' : '▼'}</span>}
    </span>
  );
}

export default function ContentIntelRoute({ isMobile, clients = [], currentClient = null }) {
  const [clientId, setClientId] = useState(currentClient?.id || '');
  const [sort, setSort] = useState('send_rate');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState(null);
  const [summary, setSummary] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const { rows: accounts } = useSupabaseRows(
    () => sb.from('connected_accounts').select('id,client_id,platform'), [reloadKey]);
  const { rows: posts } = useSupabaseRows(
    () => sb.from('account_posts').select('*').order('posted_at', { ascending: false }).limit(200), [reloadKey]);
  const { rows: analysis } = useSupabaseRows(
    () => clientId
      ? sb.from('content_analysis').select('*').eq('client_id', clientId)
      : Promise.resolve({ data: [], error: null }), [clientId, reloadKey]);
  const { rows: ideas } = useSupabaseRows(
    () => clientId
      ? sb.from('content_ideas').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [], error: null }), [clientId, reloadKey]);
  const { rows: benchRows } = useSupabaseRows(
    () => clientId
      ? sb.from('content_benchmarks').select('key,value').eq('client_id', clientId)
      : Promise.resolve({ data: [], error: null }), [clientId, reloadKey]);

  const bench = useMemo(() => {
    const b = { ...DEFAULT_BENCH };
    for (const r of benchRows || []) if (r.value != null) b[r.key] = Number(r.value);
    return b;
  }, [benchRows]);

  const igAccountIds = useMemo(
    () => new Set((accounts || [])
      .filter(a => a.client_id === clientId && String(a.platform || '').toLowerCase().includes('instagram'))
      .map(a => a.id)),
    [accounts, clientId]
  );

  const analysisByPost = useMemo(
    () => Object.fromEntries((analysis || []).map(a => [String(a.account_post_id), a])),
    [analysis]
  );

  const rows = useMemo(() => {
    const list = (posts || [])
      .filter(p => igAccountIds.has(p.account_id))
      .map(post => {
        const n = readMetrics(post);
        const r = computeRates(n, null);
        return { post, n, ...r, ai: analysisByPost[String(post.id)] };
      });
    list.sort((a, b) => {
      const av = a[sort] ?? a.n[sort] ?? -1;
      const bv = b[sort] ?? b.n[sort] ?? -1;
      return bv - av;
    });
    return list;
  }, [posts, igAccountIds, analysisByPost, sort]);

  async function runAction(action) {
    if (!clientId) return;
    setBusy(action); setErr(null);
    try {
      const out = await callAgentAction(action, clientId, { client_id: clientId });
      if (out?.error) setErr(out.error);
      if (out?.summary) setSummary(out.summary);
      setReloadKey(k => k + 1);
    } catch (e) { setErr(e.message); }
    finally { setBusy(''); }
  }

  async function setIdeaStatus(id, status) {
    setErr(null);
    try {
      await callAgentAction('intel_set_idea_status', clientId, { id, status });
      setReloadKey(k => k + 1);
    } catch (e) { setErr(e.message); }
  }

  const btn = (active) => ({
    padding: '6px 13px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
    fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
    background: active ? 'rgba(42,171,255,0.15)' : 'rgba(255,255,255,0.04)',
    color: active ? ACCENT : 'rgba(255,255,255,0.55)',
    borderColor: active ? 'rgba(42,171,255,0.4)' : 'rgba(255,255,255,0.12)',
  });
  const col = (w, extra = {}) => ({ flex: w, minWidth: 0, ...extra });

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ marginBottom: isMobile ? 22 : 32, paddingBottom: isMobile ? 18 : 26, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', ...mono, marginBottom: 12 }}>Cloud Scenic / Content Intel</div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: 'italic', color: '#fff', margin: 0, letterSpacing: -1, lineHeight: 1 }}>Content Intel</h1>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: '12px 0 0', maxWidth: 560 }}>What actually grows the account — every synced post vs the bars to beat, plus the idea queue. Approval never posts anything.</p>
      </div>

      {/* Client picker + actions */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={clientId} onChange={e => { setClientId(e.target.value); setSummary(''); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: '#191919', color: '#f5f5f7', fontSize: 12.5, fontFamily: 'Inter, sans-serif' }}>
          <option value="">Select client…</option>
          {(clients || []).filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={btn(false)} disabled={!clientId || !!busy} onClick={() => runAction('intel_score_content')}>
          {busy === 'intel_score_content' ? 'Scoring…' : 'Run analysis'}
        </button>
        <button style={btn(false)} disabled={!clientId || !!busy} onClick={() => runAction('intel_generate_ideas')}>
          {busy === 'intel_generate_ideas' ? 'Generating…' : 'Generate ideas'}
        </button>
      </div>

      {err && <div style={{ marginBottom: 14, padding: '9px 13px', borderRadius: 9, background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', color: BAD, fontSize: 12 }}>{err}</div>}

      {/* Bars to beat */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        {[['Send-rate to beat', bench.send_rate, 2], ['Save-rate to beat', bench.save_rate, 2], ['Follow-rate to beat', bench.follow_rate, 3]].map(([label, v, dp]) => (
          <div key={label} style={{ ...card, flex: 1, minWidth: 150, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, ...mono, color: '#f5f5f7', lineHeight: 1 }}>{fmtPct(v, dp)}</div>
            <div style={{ ...head, marginTop: 7 }}>{label}</div>
          </div>
        ))}
      </div>

      {summary && (
        <div style={{ ...card, padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: '#f5f5f7', borderLeft: `2px solid ${WARN}`, lineHeight: 1.5 }}>
          {summary}
        </div>
      )}

      {/* Benchmark + pillar config (Codex v1.1 pack) — per-client knobs */}
      {clientId && (() => {
        const clientRow = (clients || []).find(c => c.id === clientId);
        if (!clientRow) return null;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 26 }}>
            <BenchmarksCard client={clientRow} posts={rows.map(r => r.post)} />
            <PillarsEditor client={clientRow} />
          </div>
        );
      })()}

      {/* Ranked posts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={head}>Posts, ranked by what grows the account</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SORTS.map(s => (
            <button key={s.key} onClick={() => setSort(s.key)} style={btn(sort === s.key)}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ ...card, overflow: 'hidden', marginBottom: 26 }}>
        {!isMobile && (
          <div style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ ...head, ...col(3) }}>Post</div>
            <div style={{ ...head, ...col(1), textAlign: 'right' }}>Views</div>
            <div style={{ ...head, ...col(1), textAlign: 'right' }}>Send</div>
            <div style={{ ...head, ...col(1), textAlign: 'right' }}>Save</div>
            <div style={{ ...head, ...col(1), textAlign: 'right' }}>Pillar</div>
            <div style={{ ...head, ...col(1), textAlign: 'right' }}>Verdict</div>
          </div>
        )}
        {!clientId ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12.5 }}>Pick a client.</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 26, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12.5 }}>No synced Instagram posts for this client yet — connect the account in Settings and let the sync run.</div>
        ) : rows.map(({ post, n, send_rate, save_rate, ai }) => (
          <div key={post.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div style={col(3)}>
              <a href={post.permalink || undefined} target="_blank" rel="noreferrer"
                style={{ fontSize: 12.5, color: '#f5f5f7', fontWeight: 500, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(post.caption || 'Untitled').replace(/\s+/g, ' ').slice(0, 70) || 'Untitled'}
              </a>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', ...mono, marginTop: 2 }}>
                {(post.media_type || '?').toLowerCase()}{post.posted_at ? ' · ' + new Date(post.posted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                {n.avg_watch_sec != null ? ` · watch ${n.avg_watch_sec.toFixed(1)}s` : ''}
              </div>
            </div>
            <div style={{ ...col(1), textAlign: 'right', fontSize: 12.5, ...mono, color: '#f5f5f7' }}>{fmtNum(n.views)}</div>
            <div style={{ ...col(1), textAlign: 'right' }}><RateCell value={send_rate} bar={bench.send_rate} /></div>
            <div style={{ ...col(1), textAlign: 'right' }}><RateCell value={save_rate} bar={bench.save_rate} /></div>
            <div style={{ ...col(1), textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.55)', ...mono }}>{ai?.pillar || '—'}</div>
            <div style={{ ...col(1), textAlign: 'right', fontSize: 11, fontWeight: 700, ...mono, color: ai?.ai_verdict === 'winner' ? GOOD : ai?.ai_verdict === 'loser' ? BAD : 'rgba(255,255,255,0.4)' }}>
              {ai?.ai_verdict || '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Idea queue */}
      <div style={{ ...head, marginBottom: 8 }}>Idea queue — approval never posts anything</div>
      <div style={{ ...card, overflow: 'hidden' }}>
        {(ideas || []).length === 0 ? (
          <div style={{ padding: 22, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 12.5 }}>{clientId ? 'No ideas yet. Generate some.' : 'Pick a client.'}</div>
        ) : (ideas || []).map(i => (
          <div key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 42, fontSize: 10, color: ACCENT, ...mono, paddingTop: 2, flexShrink: 0 }}>{i.pillar || '?'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: '#f5f5f7', fontWeight: 600 }}>{i.hook}</div>
              {i.angle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{i.angle}</div>}
              {i.script && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{i.script}</div>}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', ...mono, marginTop: 5 }}>
                fit {Number(i.fit_score || 0).toFixed(2)} · {i.status}{i.signal ? ` · rides: ${i.signal}` : ''}
              </div>
            </div>
            {i.status === 'draft' && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button style={{ ...btn(false), color: GOOD, borderColor: 'rgba(48,209,88,0.35)' }} onClick={() => setIdeaStatus(i.id, 'approved')}>Approve</button>
                <button style={{ ...btn(false), color: BAD, borderColor: 'rgba(255,69,58,0.3)' }} onClick={() => setIdeaStatus(i.id, 'rejected')}>Kill</button>
              </div>
            )}
            {i.status === 'approved' && (
              <IdeaPromoteButton idea={i} client={(clients || []).find(c => c.id === clientId) || null} onPromoted={() => setReloadKey(k => k + 1)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
