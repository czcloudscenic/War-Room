import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

const ACCENT = '#2AABFF';
const card = { background: '#0f0d0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };
const mono = { fontFamily: "'Geist Mono', monospace" };
const head = { ...mono, fontSize: 8.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', fontWeight: 700 };
const input = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f5f5f7', fontSize: 12, outline: 'none' };

const DEFAULT_PILLARS = [
  { key: 'TOF', label: 'Reach', desc: 'Cold reach. Judged on views and shares.' },
  { key: 'MOF', label: 'Trust', desc: 'Proof, builds, teardowns. Judged on saves and watch time.' },
  { key: 'BOF', label: 'Offer', desc: 'Conversion posts. Judged on DM opens and joins.' },
];

function clientRows(client) {
  return Array.isArray(client?.content_pillars) && client.content_pillars.length
    ? client.content_pillars.map((row) => ({ key: String(row.key || ''), label: String(row.label || ''), desc: String(row.desc || '') }))
    : DEFAULT_PILLARS.map((row) => ({ ...row }));
}

export default function PillarsEditor({ client }) {
  const [rows, setRows] = useState(() => clientRows(client));
  const [baseline, setBaseline] = useState(() => clientRows(client));
  const [keyEdited, setKeyEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorLine, setErrorLine] = useState('');
  const pillarSignature = JSON.stringify(client?.content_pillars || null);

  useEffect(() => {
    const next = clientRows(client);
    setRows(next);
    setBaseline(next);
    setKeyEdited(false);
    setMessage('');
    setErrorLine('');
  }, [client?.id, pillarSignature]);

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(baseline), [baseline, rows]);

  function updateRow(index, field, value) {
    const nextValue = field === 'key' ? value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 6) : value;
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: nextValue } : row));
    if (field === 'key' && nextValue !== baseline[index]?.key) setKeyEdited(true);
    setMessage('');
  }

  function addRow() {
    setRows((current) => [...current, { key: '', label: '', desc: '' }]);
    setMessage('');
  }

  function deleteRow(index) {
    if (rows.length <= 1) return;
    if (!window.confirm('Delete this content pillar?')) return;
    if (baseline.some((row) => row.key === rows[index]?.key)) setKeyEdited(true);
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setMessage('');
  }

  async function save() {
    if (!client?.id || !dirty || busy) return;
    if (rows.some((row) => !row.key.trim() || !row.label.trim())) {
      setErrorLine('Every pillar needs a key and label.');
      return;
    }
    if (new Set(rows.map((row) => row.key)).size !== rows.length) {
      setErrorLine('Pillar keys must be unique.');
      return;
    }

    setBusy(true);
    setErrorLine('');
    setMessage('');
    try {
      const cleanRows = rows.map((row) => ({ key: row.key.trim(), label: row.label.trim(), desc: row.desc.trim() }));
      const { error } = await sb.from('clients').update({ content_pillars: cleanRows }).eq('id', client.id);
      if (error) throw error;
      setRows(cleanRows);
      setBaseline(cleanRows);
      setMessage('Saved');
    } catch {
      setErrorLine('Content pillars could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  if (!client?.id) return <div style={{ ...card, padding: 18, fontSize: 11.5, color: 'rgba(255,255,255,0.4)' }}>Select a client to edit content pillars.</div>;

  return (
    <section style={{ ...card, padding: '17px 19px' }}>
      <div style={head}>Content pillars</div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Labels used to classify analysis and generated ideas</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
        {rows.map((row, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '90px minmax(120px, 0.8fr) minmax(220px, 2fr) auto', alignItems: 'center', gap: 8, padding: '10px 11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
            <label><span style={{ ...head, display: 'block', marginBottom: 5 }}>Key</span><input aria-label={`Pillar ${index + 1} key`} maxLength={6} value={row.key} onChange={(event) => updateRow(index, 'key', event.target.value)} style={{ ...input, ...mono }} /></label>
            <label><span style={{ ...head, display: 'block', marginBottom: 5 }}>Label</span><input aria-label={`Pillar ${index + 1} label`} value={row.label} onChange={(event) => updateRow(index, 'label', event.target.value)} style={input} /></label>
            <label><span style={{ ...head, display: 'block', marginBottom: 5 }}>Description</span><input aria-label={`Pillar ${index + 1} description`} value={row.desc} onChange={(event) => updateRow(index, 'desc', event.target.value)} style={input} /></label>
            <button disabled={rows.length <= 1 || busy} onClick={() => deleteRow(index)} style={{ alignSelf: 'end', padding: '8px 9px', borderRadius: 8, border: '1px solid rgba(255,69,58,0.22)', background: 'rgba(255,69,58,0.06)', color: rows.length <= 1 ? 'rgba(255,255,255,0.2)' : '#ff453a', fontSize: 10.5, cursor: rows.length <= 1 || busy ? 'default' : 'pointer' }}>Delete</button>
          </div>
        ))}
      </div>

      {keyEdited ? <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.45, color: '#ff9f0a' }}>Existing analysis rows keep their old pillar tags until the next Run analysis.</div> : null}
      {errorLine ? <div style={{ marginTop: 10, fontSize: 11.5, color: '#ff453a' }}>{errorLine}</div> : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14 }}>
        <button disabled={busy} onClick={addRow} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)', fontSize: 11.5, cursor: busy ? 'wait' : 'pointer' }}>Add row</button>
        <button disabled={!dirty || busy} onClick={save} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${dirty ? `${ACCENT}55` : 'rgba(255,255,255,0.08)'}`, background: dirty ? `${ACCENT}16` : 'rgba(255,255,255,0.03)', color: dirty ? ACCENT : 'rgba(255,255,255,0.25)', fontSize: 11.5, fontWeight: 600, cursor: dirty && !busy ? 'pointer' : 'default' }}>{busy ? 'Saving…' : 'Save'}</button>
        {message ? <span style={{ fontSize: 11.5, color: '#30d158' }}>{message}</span> : null}
      </div>
    </section>
  );
}
