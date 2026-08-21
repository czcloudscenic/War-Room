import React, { useCallback, useEffect, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

const mono = { fontFamily: "'Geist Mono', monospace" };
const quiet = { fontSize: 12, color: 'rgba(255,255,255,0.4)' };
const CHECKLIST = [
  'Download latest export from storage',
  'Decrypt with the backup key',
  'Create a fresh Supabase project (or local instance)',
  'Apply supabase/migrations/ in filename order',
  'Import the export tables',
  'Verify row counts against the manifest',
  'Log the test with the button',
];

function dateTime(value) {
  const timestamp = Date.parse(value || '');
  if (Number.isNaN(timestamp)) return '—';
  return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function byteSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${unit}`;
}

function StatusPill({ status }) {
  const color = status === 'ok' ? '#30d158' : status === 'failed' ? '#ff453a' : '#E5E5EA';
  return (
    <span style={{ ...mono, display: 'inline-flex', padding: '2px 7px', borderRadius: 20, border: `1px solid ${color}35`, background: `${color}12`, color, fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {status || 'unknown'}
    </span>
  );
}

export default function BackupsCard({ compact = false }) {
  const [runs, setRuns] = useState(null);
  const [latestExport, setLatestExport] = useState(null);
  const [latestRestore, setLatestRestore] = useState(null);
  const [errorLine, setErrorLine] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErrorLine('');
    try {
      const [recentResult, exportResult, restoreResult] = await Promise.all([
        sb.from('backup_runs').select('*').order('started_at', { ascending: false }).limit(10),
        sb.from('backup_runs').select('*').eq('kind', 'export').order('started_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('backup_runs').select('*').eq('kind', 'restore_test').order('completed_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (recentResult.error || exportResult.error || restoreResult.error) {
        setRuns([]);
        setLatestExport(null);
        setLatestRestore(null);
        setErrorLine('Backup history is not available yet.');
        return;
      }

      setRuns(recentResult.data || []);
      setLatestExport(exportResult.data || null);
      setLatestRestore(restoreResult.data || null);
    } catch {
      setRuns([]);
      setLatestExport(null);
      setLatestRestore(null);
      setErrorLine('Backup history is not available yet.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logRestoreTest() {
    const notes = window.prompt('Notes for this restore test (optional):', '');
    if (notes === null) return;

    setBusy(true);
    setErrorLine('');
    try {
      const { error } = await sb.from('backup_runs').insert({
        kind: 'restore_test',
        status: 'ok',
        completed_at: new Date().toISOString(),
        notes: notes.trim() || null,
      });
      if (error) {
        setErrorLine('The restore test could not be logged.');
        return;
      }
      await load();
    } catch {
      setErrorLine('The restore test could not be logged.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: compact ? 16 : 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 15, fontWeight: 400, fontStyle: 'italic' }}>Backups</h3>
          <div style={{ marginTop: 3, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Exports, restore verification, and recovery steps</div>
        </div>
        <button disabled={busy || Boolean(errorLine)} onClick={logRestoreTest} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, ...mono, cursor: busy ? 'wait' : 'pointer', opacity: errorLine ? 0.45 : 1 }}>
          {busy ? 'Logging…' : 'Log restore test'}
        </button>
      </div>

      {errorLine ? <div style={{ ...quiet, marginTop: 14 }}>{errorLine}</div> : null}
      {runs === null ? <div style={{ ...quiet, marginTop: 14 }}>Loading backup history…</div> : null}

      {runs !== null && !errorLine ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 10, marginTop: 16 }}>
            <div style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ ...mono, marginBottom: 7, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>Latest export</div>
              {latestExport ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StatusPill status={latestExport.status} /><span style={{ fontSize: 12, color: '#f5f5f7' }}>{dateTime(latestExport.completed_at || latestExport.started_at)}</span></div>
                  <div style={{ marginTop: 7, fontSize: 10.5, color: 'rgba(255,255,255,0.42)' }}>{byteSize(latestExport.bytes)} · {latestExport.tables_included?.length || 0} tables</div>
                </>
              ) : <div style={quiet}>No exports recorded.</div>}
            </div>

            <div style={{ background: '#0e0e0e', border: `1px solid ${latestRestore ? 'rgba(255,255,255,0.07)' : 'rgba(255,69,58,0.22)'}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ ...mono, marginBottom: 7, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>Restore readiness</div>
              {latestRestore
                ? <div style={{ fontSize: 12, color: '#f5f5f7' }}>Last tested restore: {dateTime(latestRestore.completed_at)}</div>
                : <div style={{ fontSize: 12, color: '#ff453a' }}>Restore has never been tested</div>}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ ...mono, marginBottom: 9, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>Restore checklist</div>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.58)' }}>
              {CHECKLIST.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>

          <div style={{ marginTop: 18, overflowX: 'auto' }}>
            <div style={{ ...mono, marginBottom: 9, fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>Last 10 runs</div>
            {runs.length === 0 ? <div style={quiet}>No backup runs recorded.</div> : (
              <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ ...mono, textAlign: 'left', fontSize: 8.5, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)' }}>
                    <th style={{ padding: '7px 8px' }}>Kind</th><th style={{ padding: '7px 8px' }}>Status</th><th style={{ padding: '7px 8px' }}>When</th><th style={{ padding: '7px 8px' }}>Size</th><th style={{ padding: '7px 8px' }}>Location / notes</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.58)' }}>
                      <td style={{ padding: '9px 8px', color: '#f5f5f7' }}>{String(run.kind || '—').replace(/_/g, ' ')}</td>
                      <td style={{ padding: '9px 8px' }}><StatusPill status={run.status} /></td>
                      <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>{dateTime(run.completed_at || run.started_at)}</td>
                      <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>{byteSize(run.bytes)}</td>
                      <td title={run.error || run.notes || run.location || ''} style={{ padding: '9px 8px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: run.error ? '#ff453a' : 'rgba(255,255,255,0.42)' }}>{run.error || run.notes || run.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
