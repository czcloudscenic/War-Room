import React, { useEffect, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { fetchVersions } from '../../core/versions.js';
import { versionDrift, blockReasonMeta } from '../../core/truth.js';

// ── Truth Drawer — the per-deliverable receipts surface (Phase B) ─────────────
// Answers the Phase B definition-of-done for any deliverable in one panel:
// which version was approved, by whom, did it actually post (with the live-URL
// receipt), what's blocking it, and who touched it. Read-only: this renders
// receipts, it never mutates state.
//
// Tolerant of the pre-migration world: every fetch degrades to a quiet empty
// line, never a white screen.

const head = { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontFamily: "'Geist Mono', monospace", marginBottom: 8 };
const card = { background: '#0f0d0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '13px 15px', marginBottom: 12 };
const mono = { fontFamily: "'Geist Mono', monospace" };
const dim = { fontSize: 12, color: 'rgba(255,255,255,0.45)' };

const fmt = (ts) => ts ? new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function Pill({ label, color }) {
  return <span style={{ fontSize: 8.5, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 700, ...mono, color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 4, padding: '2px 6px' }}>{label}</span>;
}

const VERIFY_META = {
  verified:    { label: 'Verified posted', color: '#30d158' },
  awaiting:    { label: 'Awaiting verification', color: '#E5E5EA' },
  failed:      { label: 'Publish failed', color: '#ff453a' },
  wrong_asset: { label: 'Wrong asset posted', color: '#ff453a' },
  unverified:  { label: 'No publish evidence', color: 'rgba(255,255,255,0.4)' },
};

export default function TruthDrawer({ item, clients = [], onClose }) {
  const [versions, setVersions] = useState(null);   // null = loading
  const [approvals, setApprovals] = useState(null);
  const [audit, setAudit] = useState(null);

  useEffect(() => {
    let dead = false;
    if (!item?.id || !sb) { setVersions([]); setApprovals([]); setAudit([]); return; }
    fetchVersions(item.id).then(v => { if (!dead) setVersions(v); });
    sb.from('approvals').select('*').eq('content_item_id', item.id).order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => { if (!dead) setApprovals(error ? [] : (data || [])); });
    sb.from('audit_log').select('*').eq('entity_type', 'content_item').eq('entity_id', String(item.id)).order('created_at', { ascending: false }).limit(40)
      .then(({ data, error }) => { if (!dead) setAudit(error ? [] : (data || [])); });
    return () => { dead = true; };
  }, [item?.id]);

  if (!item) return null;
  const client = clients.find(c => c.id === item.client_id);
  const approvedVersion = (versions || []).find(v => v.id === item.approved_version_id)
    || (versions || []).find(v => v.approved_at) || null;
  const drift = approvedVersion ? versionDrift(item, approvedVersion) : [];
  const verify = VERIFY_META[item.verification_status || 'unverified'] || VERIFY_META.unverified;
  const blockMeta = item.block_reason ? blockReasonMeta(item.block_reason) : null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 100%)', height: '100%', overflowY: 'auto', background: '#0d0907', borderLeft: '1px solid rgba(255,255,255,0.09)', padding: '26px 24px 40px', fontFamily: 'Inter, sans-serif', animation: 'slideIn 0.25s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: 600, ...mono }}>Cloud Scenic / Receipts</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic', fontSize: 26, fontWeight: 400, color: '#f5f5f7', margin: '6px 0 2px' }}>{item.title || 'Untitled'}</h2>
        <div style={{ ...dim, marginBottom: 20 }}>{client?.name || '—'} · {item.status || '—'}</div>

        {/* 1. Approved version */}
        <div style={card}>
          <div style={head}>Approved version</div>
          {versions === null ? <div style={dim}>Loading…</div> : approvedVersion ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Pill label={`v${approvedVersion.version_no}`} color="#2AABFF" />
                <span style={{ fontSize: 12.5, color: '#f5f5f7', fontWeight: 500 }}>approved by {approvedVersion.approved_by || '—'}</span>
              </div>
              <div style={dim}>{approvedVersion.approved_stage ? `${approvedVersion.approved_stage} gate · ` : ''}{fmt(approvedVersion.approved_at)}</div>
              {drift.length > 0 && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(229,229,234,0.07)', border: '1px solid rgba(229,229,234,0.25)', fontSize: 11.5, color: '#E5E5EA' }}>
                  Edited since approval: {drift.join(', ')} — the live item no longer matches the approved version.
                </div>
              )}
            </>
          ) : <div style={dim}>No approved version on record{(versions || []).length ? ' (versions exist, none stamped approved)' : ''}.</div>}
        </div>

        {/* 2. Publish receipt */}
        <div style={card}>
          <div style={head}>Publish receipt</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Pill label={verify.label} color={verify.color} />
            {item.verification_source && <span style={{ ...dim, fontSize: 10.5, ...mono }}>via {item.verification_source}</span>}
          </div>
          {item.live_url
            ? <a href={item.live_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2AABFF', wordBreak: 'break-all' }}>{item.live_url}</a>
            : <div style={dim}>No live URL recorded.</div>}
          <div style={{ ...dim, fontSize: 11, marginTop: 6 }}>
            {item.posted_at ? `Marked posted ${fmt(item.posted_at)}` : 'Not marked posted'}{item.verified_at ? ` · verified ${fmt(item.verified_at)}` : ''}{item.publish_date ? ` · planned ${item.publish_date}` : ''}
          </div>
        </div>

        {/* 3. Block state */}
        <div style={card}>
          <div style={head}>Blocking</div>
          {blockMeta ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Pill label={blockMeta.label} color="#E5E5EA" />
                {item.block_external && <Pill label="external · SLA paused" color="#64d2ff" />}
              </div>
              <div style={dim}>
                {item.blocked_since ? `Since ${fmt(item.blocked_since)}` : ''}{item.block_owner ? ` · owner: ${item.block_owner}` : ' · no unblock owner set'}{item.block_escalation_date ? ` · escalate by ${item.block_escalation_date}` : ''}
              </div>
            </>
          ) : item.qc_status === 'blocked'
            ? <div style={{ fontSize: 12, color: '#ff453a' }}>QC-blocked (factual mismatch) — see the QC panel in the Ledger.</div>
            : <div style={dim}>Not blocked.</div>}
        </div>

        {/* 4. Version history */}
        <div style={card}>
          <div style={head}>Versions</div>
          {versions === null ? <div style={dim}>Loading…</div> : (versions || []).length === 0 ? <div style={dim}>No versions yet — versions mint on creative edits and approvals.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {versions.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <Pill label={`v${v.version_no}`} color={v.id === item.approved_version_id ? '#2AABFF' : 'rgba(255,255,255,0.45)'} />
                  <span style={{ color: 'rgba(255,255,255,0.7)', flex: 1 }}>
                    {v.approved_at ? `approved${v.approved_stage ? ` · ${v.approved_stage}` : ''}` : v.source}
                    {v.created_by ? ` · ${v.created_by}` : ''}
                  </span>
                  <span style={{ ...dim, fontSize: 10.5, ...mono, flexShrink: 0 }}>{fmt(v.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Approval decisions */}
        <div style={card}>
          <div style={head}>Approval decisions</div>
          {approvals === null ? <div style={dim}>Loading…</div> : (approvals || []).length === 0 ? <div style={dim}>No decisions recorded.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {approvals.map(a => (
                <div key={a.id} style={{ fontSize: 12 }}>
                  <span style={{ color: a.decision === 'approved' ? '#30d158' : '#E5E5EA', fontWeight: 600 }}>{a.decision === 'approved' ? 'Approved' : 'Revisions'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>{a.stage ? ` · ${a.stage}` : ''} · {a.approver_email || 'unknown'}</span>
                  <span style={{ ...dim, fontSize: 10.5, ...mono }}> · {fmt(a.created_at)}</span>
                  {a.feedback && <div style={{ ...dim, fontSize: 11.5, marginTop: 2, fontStyle: 'italic' }}>"{a.feedback}"</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 6. Who touched it */}
        <div style={card}>
          <div style={head}>Change history</div>
          {audit === null ? <div style={dim}>Loading…</div> : (audit || []).length === 0 ? <div style={dim}>No recorded changes.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {audit.map(row => (
                <div key={row.id} style={{ fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>{row.actor_kind === 'human' ? (row.actor_email || 'someone') : row.actor_kind}</span>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}> changed <span style={{ ...mono, fontSize: 11 }}>{row.field || '—'}</span></span>
                  <div style={{ fontSize: 11.5, marginTop: 2 }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>{row.old_value ?? '—'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)' }}> → </span>
                    <span style={{ color: '#f5f5f7' }}>{row.new_value ?? '—'}</span>
                  </div>
                  <div style={{ ...dim, fontSize: 10.5, ...mono }}>{fmt(row.created_at)}{row.reason ? ` · ${row.reason}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
