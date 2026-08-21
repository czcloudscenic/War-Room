import React, { useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { useSupabaseRows } from '../../utils/hooks.js';
import { readMetrics, computeRates, fmtPct, DEFAULT_BENCH } from '../../utils/contentMetrics.js';

const ACCENT = '#2AABFF';
const card = { background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };
const mono = { fontFamily: "'Geist Mono', monospace" };
const head = { ...mono, fontSize: 8.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', fontWeight: 700 };
const quiet = { fontSize: 11.5, color: 'rgba(255,255,255,0.4)' };
const input = { width: 88, boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#f5f5f7', fontSize: 12, outline: 'none', ...mono };

const BARS = [
  { key: 'send_rate', label: 'Send-rate to beat' },
  { key: 'save_rate', label: 'Save-rate to beat' },
  { key: 'follow_rate', label: 'Follow-rate to beat' },
];

function postLabel(post) {
  const caption = String(post.caption || 'Untitled post').replace(/\s+/g, ' ').trim();
  return caption.slice(0, 58) || 'Untitled post';
}

export default function BenchmarksCard({ client, posts = [] }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [editingKey, setEditingKey] = useState('');
  const [draftPercent, setDraftPercent] = useState('');
  const [controlId, setControlId] = useState('');
  const [busy, setBusy] = useState('');
  const [writeError, setWriteError] = useState('');

  const clientId = client?.id || '';
  const { rows: benchmarkRows, loading, error: readError } = useSupabaseRows(
    () => clientId
      ? sb.from('content_benchmarks').select('*').eq('client_id', clientId)
      : Promise.resolve({ data: [], error: null }),
    [clientId, reloadKey]
  );

  const benchmarkByKey = useMemo(
    () => new Map((benchmarkRows || []).map((row) => [row.key, row])),
    [benchmarkRows]
  );
  const sortedPosts = useMemo(
    () => [...(posts || [])].sort((a, b) => (Date.parse(b.posted_at || '') || 0) - (Date.parse(a.posted_at || '') || 0)),
    [posts]
  );

  function beginEdit(key, value) {
    setEditingKey(key);
    setDraftPercent(String(Number((value * 100).toFixed(4))));
    setWriteError('');
  }

  async function saveBar(bar) {
    const percent = Number(draftPercent);
    if (!Number.isFinite(percent) || percent < 0) {
      setWriteError('Enter a valid percentage of zero or more.');
      return;
    }
    setBusy(bar.key);
    setWriteError('');
    try {
      const { error } = await sb.from('content_benchmarks').upsert({
        client_id: clientId,
        key: bar.key,
        value: percent / 100,
        label: bar.label,
        source: 'manual',
      }, { onConflict: 'client_id,key' });
      if (error) throw error;
      setEditingKey('');
      setReloadKey((key) => key + 1);
    } catch {
      setWriteError('Benchmark could not be saved.');
    } finally {
      setBusy('');
    }
  }

  async function resetBar(key) {
    setBusy(key);
    setWriteError('');
    try {
      const { error } = await sb.from('content_benchmarks').delete().eq('client_id', clientId).eq('key', key);
      if (error) throw error;
      setEditingKey('');
      setReloadKey((value) => value + 1);
    } catch {
      setWriteError('Benchmark could not be reset.');
    } finally {
      setBusy('');
    }
  }

  async function setFromControl() {
    const post = sortedPosts.find((row) => String(row.id) === controlId);
    if (!post) return;
    const rates = computeRates(readMetrics(post), null);
    const sourceCaption = String(post.caption || '').slice(0, 50);
    const source = `control:${sourceCaption}`;
    setBusy('control');
    setWriteError('');
    try {
      const { error } = await sb.from('content_benchmarks').upsert([
        { client_id: clientId, key: 'send_rate', value: rates.send_rate, label: 'Send-rate to beat', source },
        { client_id: clientId, key: 'save_rate', value: rates.save_rate, label: 'Save-rate to beat', source },
      ], { onConflict: 'client_id,key' });
      if (error) throw error;
      setReloadKey((value) => value + 1);
    } catch {
      setWriteError('Control-post benchmarks could not be saved.');
    } finally {
      setBusy('');
    }
  }

  if (!clientId) return <div style={{ ...card, padding: 18, ...quiet }}>Select a client to edit benchmarks.</div>;

  return (
    <section style={{ ...card, padding: '17px 19px' }}>
      <div style={head}>Bars to beat</div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Client-specific performance thresholds</div>

      {loading ? <div style={{ ...quiet, marginTop: 14 }}>Loading benchmarks…</div> : null}
      {readError ? <div style={{ ...quiet, marginTop: 14 }}>Benchmarks are not available.</div> : null}

      {!loading && !readError ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(150px, 1fr))', gap: 10, marginTop: 14 }}>
          {BARS.map((bar) => {
            const savedRow = benchmarkByKey.get(bar.key);
            const value = savedRow?.value == null ? DEFAULT_BENCH[bar.key] : Number(savedRow.value);
            const isEditing = editingKey === bar.key;
            return (
              <div key={bar.key} style={{ padding: '13px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <input type="number" min="0" step="0.01" aria-label={`${bar.label} percent`} value={draftPercent} onChange={(event) => setDraftPercent(event.target.value)} style={input} />
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>%</span>
                    </div>
                  ) : <div style={{ color: '#f5f5f7', fontSize: 22, fontWeight: 700, lineHeight: 1, ...mono }}>{fmtPct(value)}</div>}
                  <button disabled={Boolean(busy)} onClick={() => isEditing ? saveBar(bar) : beginEdit(bar.key, value)} style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${ACCENT}35`, background: `${ACCENT}10`, color: ACCENT, fontSize: 10.5, cursor: busy ? 'wait' : 'pointer' }}>
                    {isEditing ? (busy === bar.key ? 'Saving…' : 'Save') : 'Edit'}
                  </button>
                </div>
                <div style={{ ...head, marginTop: 8 }}>{bar.label}</div>
                <div title={savedRow?.source || 'Studio default'} style={{ marginTop: 5, minHeight: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>
                  {savedRow?.source || 'Studio default'}
                </div>
                <button disabled={!savedRow || Boolean(busy)} onClick={() => resetBar(bar.key)} style={{ marginTop: 8, padding: 0, border: 'none', background: 'transparent', color: savedRow ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.2)', fontSize: 10.5, cursor: savedRow && !busy ? 'pointer' : 'default' }}>
                  Reset to default
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {!readError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ ...head, marginRight: 2 }}>Set bars from a control post</span>
          <select value={controlId} onChange={(event) => setControlId(event.target.value)} style={{ minWidth: 220, flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: '#191919', color: '#f5f5f7', fontSize: 11.5 }}>
            <option value="">Select post…</option>
            {sortedPosts.map((post) => <option key={post.id} value={String(post.id)}>{postLabel(post)}</option>)}
          </select>
          <button disabled={!controlId || Boolean(busy)} onClick={setFromControl} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: controlId ? '#f5f5f7' : 'rgba(255,255,255,0.3)', fontSize: 11.5, cursor: controlId && !busy ? 'pointer' : 'default' }}>
            {busy === 'control' ? 'Setting…' : 'Use post'}
          </button>
          {sortedPosts.length === 0 ? <span style={quiet}>No posts available.</span> : null}
        </div>
      ) : null}

      {writeError ? <div style={{ marginTop: 10, fontSize: 11.5, color: '#ff453a' }}>{writeError}</div> : null}
    </section>
  );
}
