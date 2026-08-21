import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

const DAY_MS = 86400000;
const ACCENT = '#2AABFF';
const mono = { fontFamily: "'Geist Mono', monospace" };
const card = { background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };
const input = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 11px', color: '#f5f5f7', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' };
const label = { ...mono, display: 'block', marginBottom: 6, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' };
const quiet = { fontSize: 12, color: 'rgba(255,255,255,0.4)' };
const emptyDraft = {
  question: '',
  client_id: '',
  entity_type: '',
  source: '',
  follow_up_owner: '',
  blocks_count: 0,
};

function age(value) {
  const timestamp = Date.parse(value || '');
  if (Number.isNaN(timestamp)) return 'age unknown';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / DAY_MS));
  if (days === 0) return 'today';
  return `${days}d old`;
}

function shortDate(value) {
  const timestamp = Date.parse(value || '');
  if (Number.isNaN(timestamp)) return '—';
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Field({ title, children }) {
  return <label><span style={label}>{title}</span>{children}</label>;
}

function DecisionForm({ initial = emptyDraft, clients, busy, submitLabel, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => ({ ...emptyDraft, ...initial }));
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  function submit(event) {
    event.preventDefault();
    if (!draft.question.trim() || busy) return;
    onSubmit({
      question: draft.question.trim(),
      client_id: draft.client_id || null,
      entity_type: draft.entity_type || null,
      source: draft.source.trim() || null,
      follow_up_owner: draft.follow_up_owner.trim() || null,
      blocks_count: Math.max(0, Number.parseInt(draft.blocks_count, 10) || 0),
    });
  }

  return (
    <form onSubmit={submit} style={{ ...card, padding: '16px 18px', marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(2, minmax(130px, 1fr))', gap: 12 }}>
        <Field title="Question">
          <input autoFocus required value={draft.question} onChange={(event) => set('question', event.target.value)} placeholder="What decision needs to be made?" style={input} />
        </Field>
        <Field title="Client">
          <select value={draft.client_id || ''} onChange={(event) => set('client_id', event.target.value)} style={input}>
            <option value="">Book-level</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field title="Entity type">
          <select value={draft.entity_type || ''} onChange={(event) => set('entity_type', event.target.value)} style={input}>
            <option value="">None</option>
            {['client', 'campaign', 'deliverable', 'fact', 'invoice'].map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </Field>
        <Field title="Source">
          <input value={draft.source || ''} onChange={(event) => set('source', event.target.value)} placeholder="call, email, slack" style={input} />
        </Field>
        <Field title="Follow-up owner">
          <input value={draft.follow_up_owner || ''} onChange={(event) => set('follow_up_owner', event.target.value)} placeholder="Name or email" style={input} />
        </Field>
        <Field title="Blocked items">
          <input type="number" min="0" value={draft.blocks_count} onChange={(event) => set('blocks_count', event.target.value)} style={input} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="submit" disabled={busy || !draft.question.trim()} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: ACCENT, color: '#05131d', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: !draft.question.trim() ? 0.45 : 1 }}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={{ padding: '9px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', fontSize: 12, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RecordDecisionForm({ busy, onSubmit, onCancel }) {
  const [draft, setDraft] = useState({ decision: '', decider: '', evidence_url: '' });

  function submit(event) {
    event.preventDefault();
    if (!draft.decision.trim() || busy) return;
    onSubmit({
      decision: draft.decision.trim(),
      decider: draft.decider.trim() || null,
      evidence_url: draft.evidence_url.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <Field title="Decision">
        <textarea autoFocus required value={draft.decision} onChange={(event) => setDraft((current) => ({ ...current, decision: event.target.value }))} placeholder="Record the decision" style={{ ...input, minHeight: 78, resize: 'vertical', lineHeight: 1.5 }} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <Field title="Decider">
          <input value={draft.decider} onChange={(event) => setDraft((current) => ({ ...current, decider: event.target.value }))} placeholder="Name or email" style={input} />
        </Field>
        <Field title="Evidence URL">
          <input type="url" value={draft.evidence_url} onChange={(event) => setDraft((current) => ({ ...current, evidence_url: event.target.value }))} placeholder="https://" style={input} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit" disabled={busy || !draft.decision.trim()} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: '#30d158', color: '#04270f', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: !draft.decision.trim() ? 0.45 : 1 }}>
          {busy ? 'Saving…' : 'Save decision'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={{ padding: '8px 13px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
      </div>
    </form>
  );
}

function OpenCard({ row, clientName, busy, recording, editing, onRecord, onEdit, onDelete, onCancel, onSaveDecision, onSaveEdit, clients }) {
  if (editing) {
    return <DecisionForm initial={row} clients={clients} busy={busy} submitLabel="Save changes" onSubmit={onSaveEdit} onCancel={onCancel} />;
  }

  return (
    <article style={{ ...card, padding: '17px 19px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ marginBottom: 7, fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, color: '#f5f5f7' }}>{row.question}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
            <span style={{ ...mono, color: 'rgba(255,255,255,0.55)' }}>{clientName}</span>
            {row.source ? <span>via {row.source}</span> : null}
            {row.follow_up_owner ? <span>owner: {row.follow_up_owner}</span> : null}
            <span>{age(row.created_at)}</span>
          </div>
        </div>
        <span style={{ ...mono, flexShrink: 0, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.28)', color: '#ff453a', fontSize: 8.5, fontWeight: 700 }}>
          blocks {Number(row.blocks_count) || 0} items
        </span>
      </div>

      {recording ? <RecordDecisionForm busy={busy} onSubmit={onSaveDecision} onCancel={onCancel} /> : (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={onRecord} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: ACCENT, color: '#05131d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Record decision</button>
          <button disabled={busy} onClick={onEdit} style={{ padding: '8px 13px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.72)', fontSize: 12, cursor: 'pointer' }}>Edit</button>
          <button disabled={busy} onClick={onDelete} style={{ padding: '8px 13px', borderRadius: 8, background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.22)', color: '#ff453a', fontSize: 12, cursor: 'pointer' }}>Delete</button>
        </div>
      )}
    </article>
  );
}

function DecidedCard({ row, clientName }) {
  return (
    <article style={{ ...card, padding: '17px 19px' }}>
      <div style={{ ...mono, marginBottom: 6, fontSize: 9.5, color: 'rgba(255,255,255,0.4)' }}>{clientName} · {shortDate(row.decided_at)}</div>
      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,0.68)' }}>{row.question}</div>
      <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55, color: '#f5f5f7' }}>{row.decision || '—'}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
        <span>decided by {row.decider || 'unknown'}</span>
        {row.evidence_url ? <a href={row.evidence_url} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>View evidence</a> : null}
      </div>
    </article>
  );
}

export default function DecisionLogRoute({ clients = [], activeClientId = null }) {
  const [rows, setRows] = useState(null);
  const [fallbackClients, setFallbackClients] = useState([]);
  const [tab, setTab] = useState('open');
  const [clientFilter, setClientFilter] = useState(activeClientId || 'all');
  const [showCreate, setShowCreate] = useState(false);
  const [recordingId, setRecordingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [errorLine, setErrorLine] = useState('');

  const availableClients = clients.length > 0 ? clients : fallbackClients;
  const clientById = useMemo(() => new Map(availableClients.map((client) => [client.id, client.name])), [availableClients]);

  useEffect(() => {
    setClientFilter(activeClientId || 'all');
  }, [activeClientId]);

  const load = useCallback(async () => {
    setErrorLine('');
    try {
      const requests = [sb.from('decisions').select('*')];
      if (clients.length === 0) requests.push(sb.from('clients').select('id,name').order('name'));
      const results = await Promise.all(requests);
      const decisionResult = results[0];
      if (decisionResult.error) {
        setRows([]);
        setErrorLine('Decision log is not available yet.');
        return;
      }
      setRows(decisionResult.data || []);
      if (results[1] && !results[1].error) setFallbackClients(results[1].data || []);
    } catch {
      setRows([]);
      setErrorLine('Decision log is not available yet.');
    }
  }, [clients.length]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const filtered = (rows || []).filter((row) => {
      if (clientFilter === 'all') return true;
      if (clientFilter === 'book') return !row.client_id;
      return row.client_id === clientFilter;
    });
    return filtered.sort((a, b) => {
      if (tab === 'open') {
        return (Number(b.blocks_count) || 0) - (Number(a.blocks_count) || 0)
          || (Date.parse(a.created_at || '') || Infinity) - (Date.parse(b.created_at || '') || Infinity);
      }
      return (Date.parse(b.decided_at || '') || 0) - (Date.parse(a.decided_at || '') || 0);
    });
  }, [clientFilter, rows, tab]);

  const tabRows = visibleRows.filter((row) => row.status === tab);
  const counts = useMemo(() => ({
    open: (rows || []).filter((row) => row.status === 'open').length,
    decided: (rows || []).filter((row) => row.status === 'decided').length,
  }), [rows]);

  async function write(id, operation) {
    setBusyId(id);
    setErrorLine('');
    try {
      const { error } = await operation();
      if (error) {
        setErrorLine('The decision could not be saved.');
        return false;
      }
      await load();
      return true;
    } catch {
      setErrorLine('The decision could not be saved.');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function createDecision(values) {
    const now = new Date().toISOString();
    const saved = await write('create', () => sb.from('decisions').insert({ ...values, status: 'open', created_at: now, updated_at: now }));
    if (saved) setShowCreate(false);
  }

  async function updateDecision(row, values) {
    const saved = await write(row.id, () => sb.from('decisions').update({ ...values, updated_at: new Date().toISOString() }).eq('id', row.id));
    if (saved) setEditingId(null);
  }

  async function recordDecision(row, values) {
    const now = new Date().toISOString();
    const saved = await write(row.id, () => sb.from('decisions').update({ ...values, status: 'decided', decided_at: now, updated_at: now }).eq('id', row.id));
    if (saved) setRecordingId(null);
  }

  async function deleteDecision(row) {
    if (!window.confirm(`Delete this decision log entry?\n\n${row.question}`)) return;
    await write(row.id, () => sb.from('decisions').delete().eq('id', row.id));
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ marginBottom: 26, paddingBottom: 22, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ ...mono, marginBottom: 10, fontSize: 9, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Cloud Scenic / Truth</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: '#fff', fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 42, fontWeight: 400, fontStyle: 'italic', letterSpacing: -1, lineHeight: 1 }}>Decision log.</h1>
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{counts.open} open · {counts.decided} decided</p>
          </div>
          <button onClick={() => { setShowCreate(true); setEditingId(null); setRecordingId(null); }} style={{ padding: '10px 17px', border: 'none', borderRadius: 8, background: ACCENT, color: '#05131d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Log a decision</button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['open', `Open (Decision Debt) · ${counts.open}`], ['decided', `Decided · ${counts.decided}`]].map(([value, text]) => (
            <button key={value} onClick={() => setTab(value)} style={{ padding: '8px 12px', borderRadius: 20, border: `1px solid ${tab === value ? `${ACCENT}55` : 'rgba(255,255,255,0.1)'}`, background: tab === value ? `${ACCENT}14` : 'transparent', color: tab === value ? ACCENT : 'rgba(255,255,255,0.5)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>{text}</button>
          ))}
        </div>
        <select aria-label="Filter decisions by client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} style={{ ...input, width: 'auto', minWidth: 170 }}>
          <option value="all">All clients</option>
          <option value="book">Book-level only</option>
          {availableClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </div>

      {showCreate ? <DecisionForm clients={availableClients} busy={busyId === 'create'} submitLabel="Log decision" onSubmit={createDecision} onCancel={() => setShowCreate(false)} /> : null}
      {errorLine ? <div style={{ ...quiet, marginBottom: 14 }}>{errorLine}</div> : null}
      {rows === null ? <div style={quiet}>Loading decisions…</div> : null}
      {rows !== null && !errorLine && tabRows.length === 0 ? <div style={{ ...card, padding: '28px 20px', ...quiet }}>{tab === 'open' ? 'No open decisions.' : 'No decided entries.'}</div> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tabRows.map((row) => {
          const clientName = row.client_id ? (clientById.get(row.client_id) || 'Unknown client') : 'Book-level';
          return tab === 'open' ? (
            <OpenCard
              key={row.id}
              row={row}
              clientName={clientName}
              clients={availableClients}
              busy={busyId === row.id}
              recording={recordingId === row.id}
              editing={editingId === row.id}
              onRecord={() => { setRecordingId(row.id); setEditingId(null); setShowCreate(false); }}
              onEdit={() => { setEditingId(row.id); setRecordingId(null); setShowCreate(false); }}
              onDelete={() => deleteDecision(row)}
              onCancel={() => { setEditingId(null); setRecordingId(null); }}
              onSaveDecision={(values) => recordDecision(row, values)}
              onSaveEdit={(values) => updateDecision(row, values)}
            />
          ) : <DecidedCard key={row.id} row={row} clientName={clientName} />;
        })}
      </div>
    </div>
  );
}
