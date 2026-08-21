import React, { useEffect, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

const mono = { fontFamily: "'Geist Mono', monospace" };
const quiet = { fontSize: 12, color: 'rgba(255,255,255,0.4)' };

function relativeTime(value) {
  const timestamp = Date.parse(value || '');
  if (Number.isNaN(timestamp)) return 'unknown time';

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function ActorChip({ row }) {
  const isHuman = row.actor_kind === 'human';
  const color = row.actor_kind === 'agent'
    ? '#64d2ff'
    : row.actor_kind === 'system'
      ? '#E5E5EA'
      : 'rgba(255,255,255,0.65)';
  const label = isHuman ? (row.actor_email || 'Unknown user') : row.actor_kind === 'agent' ? 'Agent' : 'System';

  return (
    <span style={{
      ...mono,
      display: 'inline-flex',
      maxWidth: '100%',
      padding: '2px 7px',
      borderRadius: 20,
      border: `1px solid ${color}35`,
      background: `${color}0f`,
      color,
      fontSize: 8.5,
      fontWeight: 700,
      letterSpacing: 0.5,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export default function AuditTrailPanel({
  entityType,
  entityId,
  clientId = null,
  limit = 50,
  title = 'History',
}) {
  const [rows, setRows] = useState(null);
  const [errorLine, setErrorLine] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!entityType || entityId == null) {
        setRows([]);
        setErrorLine('');
        return;
      }

      setRows(null);
      setErrorLine('');
      try {
        let query = sb
          .from('audit_log')
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', String(entityId))
          .order('created_at', { ascending: false })
          .limit(limit);
        if (clientId) query = query.eq('client_id', clientId);

        const { data, error } = await query;
        if (cancelled) return;
        if (error) {
          setRows([]);
          setErrorLine('Change history is not available yet.');
          return;
        }
        setRows(data || []);
      } catch {
        if (!cancelled) {
          setRows([]);
          setErrorLine('Change history is not available yet.');
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [clientId, entityId, entityType, limit]);

  return (
    <section style={{ background: '#0f0d0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ ...mono, marginBottom: 10, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
        {title}
      </div>

      {rows === null ? <div style={quiet}>Loading history…</div> : null}
      {rows !== null && errorLine ? <div style={quiet}>{errorLine}</div> : null}
      {rows !== null && !errorLine && rows.length === 0 ? <div style={quiet}>No recorded changes.</div> : null}

      {rows && rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((row, index) => (
            <div key={row.id} style={{ padding: '10px 0', borderBottom: index === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                <ActorChip row={row} />
                <span title={row.created_at ? new Date(row.created_at).toLocaleString() : undefined} style={{ ...mono, flexShrink: 0, fontSize: 9.5, color: 'rgba(255,255,255,0.32)' }}>
                  {relativeTime(row.created_at)}
                </span>
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>
                <span style={{ ...mono, color: 'rgba(255,255,255,0.55)' }}>{row.field || 'record'}:</span>{' '}
                <span style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>{row.old_value ?? '—'}</span>{' '}
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>{' '}
                <span style={{ color: '#f5f5f7' }}>{row.new_value ?? '—'}</span>
              </div>
              {row.reason ? <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.45, color: 'rgba(255,255,255,0.42)' }}>{row.reason}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
