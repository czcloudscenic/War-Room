import React, { useMemo, useState } from 'react';
import { recordApproval } from '../../core/approvals.js';
import { clientRunway } from '../../utils/runway.mjs';
import { STATUS_COLOR } from '../../utils/constants.js';

// ── Internal approvals inbox v1 (Phase A, v3 spec §3.A) ───────────────────────
// The agency-side twin of the client portal's approval queue: every deliverable
// sitting at a gate, across ALL clients, with a derived risk level, the business
// effect of the wait, and a recommendation — then Approve / Edit / Reject.
//
// Risk, effect, and recommendation are RULE-BASED from real signals only
// (qc_status, revision cap, due dates, runway severity) — no generated text.
// Decisions wire straight into core/approvals.recordApproval, the same path the
// portal uses, so the audit trail and revision-cap triggers are identical.
// App realtime updates `content`, which drops the item out of the queue here.

const GATE_STATUSES = ['Need Copy Approval', 'Need Content Approval'];
const DAY_MS = 86400000;
const ACCENT = '#2AABFF';
const mono = { fontFamily: "'Geist Mono', monospace" };
const card = { background: '#0f0d0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };

const RISK = {
  high: { label: 'High', color: '#ff453a' },
  med:  { label: 'Medium', color: '#ff9f0a' },
  low:  { label: 'Low', color: '#30d158' },
};

// Derive { risk, effect, recommendation } for one gated item. Pure rules.
function assess(item, client, runwaySnap) {
  const reasons = [];
  let risk = 'low';
  const bump = (level) => { if (level === 'high' || (level === 'med' && risk === 'low')) risk = level; };

  if (item.qc_status === 'blocked') {
    bump('high');
    reasons.push('QC hard-blocked this version (factual issue)');
  } else if (item.qc_status === 'flagged') {
    bump('med');
    reasons.push('QC flagged issues for review');
  }

  const cap = client?.included_revisions != null ? Number(client.included_revisions) : null;
  const revs = Number(item.revision_count) || 0;
  if (cap != null && revs >= cap) {
    bump('high');
    reasons.push(`revision cap hit (${revs}/${cap}) — further kickbacks are out-of-scope work`);
  }

  if (item.due_date) {
    const due = Date.parse(item.due_date);
    if (!Number.isNaN(due)) {
      const days = (due - Date.now()) / DAY_MS;
      if (days < 0) { bump('high'); reasons.push(`due date passed ${Math.ceil(-days)}d ago`); }
      else if (days < 2) { bump('med'); reasons.push('due within 48h'); }
    }
  }

  if (runwaySnap?.severity === 'critical' || runwaySnap?.severity === 'empty') {
    bump('med');
    reasons.push(`content runway ${runwaySnap.severity} — approving unlocks ready inventory`);
  }

  const waitingDays = item.updated_at ? Math.floor((Date.now() - Date.parse(item.updated_at)) / DAY_MS) : null;
  if (waitingDays != null && waitingDays >= 3) {
    bump('med');
    reasons.push(`sitting at this gate ${waitingDays}d`);
  }

  const effect = reasons.length > 0
    ? reasons.join(' · ')
    : 'No pressure signals — normal queue flow.';

  const recommendation =
    item.qc_status === 'blocked' ? 'Reject with the QC notes — do not approve over a factual block.'
    : cap != null && revs >= cap ? 'Approve if publishable; another revision cycle becomes billable scope.'
    : (runwaySnap?.severity === 'critical' || runwaySnap?.severity === 'empty') ? 'Prioritize — this client is out of ready content.'
    : waitingDays != null && waitingDays >= 3 ? 'Decide today — this is aging into a bottleneck.'
    : 'Review and decide in normal course.';

  return { risk, effect, recommendation, waitingDays };
}

function RiskBadge({ risk }) {
  const r = RISK[risk];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: `${r.color}14`, border: `1px solid ${r.color}45` }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: r.color }} />
      <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, color: r.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{r.label} risk</span>
    </span>
  );
}

function InboxCard({ item, client, assessment, isMobile, busy, onApprove, onReject, onEdit }) {
  const [feedback, setFeedback] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const stageColor = STATUS_COLOR[item.status] || ACCENT;

  return (
    <div style={{ ...card, padding: isMobile ? '16px 16px' : '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>{client?.name || '—'}</span>
            <span style={{ ...mono, fontSize: 9.5, color: stageColor, textTransform: 'uppercase', letterSpacing: 0.8 }}>{item.status}</span>
            {item.platform && <span style={{ ...mono, fontSize: 9.5, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{item.platform}</span>}
            {item.due_date && <span style={{ ...mono, fontSize: 9.5, color: 'rgba(255,255,255,0.35)' }}>due {item.due_date}</span>}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: '#f5f5f7', lineHeight: 1.3 }}>{item.title || 'Untitled'}</div>
        </div>
        <RiskBadge risk={assessment.risk} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          <span style={{ ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginRight: 8 }}>Effect</span>
          {assessment.effect}
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
          <span style={{ ...mono, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: ACCENT, marginRight: 8 }}>Call</span>
          {assessment.recommendation}
        </div>
      </div>

      {rejecting ? (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={feedback} onChange={e => setFeedback(e.target.value)} autoFocus
            placeholder="What needs to change? (required — this goes on the audit trail)"
            style={{ flex: 1, minWidth: 220, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,69,58,0.35)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f5f5f7', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
          <button disabled={!feedback.trim() || busy} onClick={() => onReject(feedback.trim())}
            style={{ fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: (!feedback.trim() || busy) ? 'not-allowed' : 'pointer', background: (!feedback.trim() || busy) ? 'rgba(255,255,255,0.08)' : '#ff453a', color: (!feedback.trim() || busy) ? 'rgba(255,255,255,0.4)' : '#fff' }}>
            {busy ? 'Sending…' : 'Send back'}
          </button>
          <button disabled={busy} onClick={() => { setRejecting(false); setFeedback(''); }}
            style={{ fontSize: 12, padding: '9px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={onApprove}
            style={{ fontSize: 12, fontWeight: 600, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: busy ? 'wait' : 'pointer', background: busy ? 'rgba(255,255,255,0.08)' : '#30d158', color: busy ? 'rgba(255,255,255,0.4)' : '#04270f' }}>
            {busy ? 'Working…' : 'Approve'}
          </button>
          <button disabled={busy} onClick={onEdit}
            style={{ fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
            Edit
          </button>
          <button disabled={busy} onClick={() => setRejecting(true)}
            style={{ fontSize: 12, fontWeight: 600, padding: '9px 16px', borderRadius: 8, background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.3)', color: '#ff453a', cursor: 'pointer' }}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsRoute({ isMobile, clients = [], content = [], currentUser, onEdit }) {
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState(null);
  const clientById = useMemo(() => new Map((clients || []).map(c => [c.id, c])), [clients]);

  // Per-client runway snapshots feed the risk rules (only for tracked clients).
  const runwayByClient = useMemo(() => {
    const m = new Map();
    for (const c of clients || []) {
      if (!c.content_tracking_enabled) continue;
      const items = (content || []).filter(x => x.client_id === c.id);
      m.set(c.id, clientRunway(c, items, { now: Date.now() }));
    }
    return m;
  }, [clients, content]);

  const { internalQueue, clientWait } = useMemo(() => {
    const gated = (content || []).filter(x => GATE_STATUSES.includes(x.status));
    const internal = [];
    const waiting = [];
    for (const item of gated) {
      (item.approval_mode === 'client' ? waiting : internal).push(item);
    }
    const rank = { high: 0, med: 1, low: 2 };
    const assessed = internal.map(item => ({
      item,
      client: clientById.get(item.client_id),
      assessment: assess(item, clientById.get(item.client_id), runwayByClient.get(item.client_id)),
    })).sort((a, b) =>
      rank[a.assessment.risk] - rank[b.assessment.risk] ||
      (Date.parse(a.item.due_date || '') || Infinity) - (Date.parse(b.item.due_date || '') || Infinity)
    );
    return { internalQueue: assessed, clientWait: waiting };
  }, [content, clientById, runwayByClient]);

  async function decide(item, decision, feedback) {
    setBusyId(item.id); setErr(null);
    const stage = item.status === 'Need Copy Approval' ? 'copy' : 'content';
    try {
      await recordApproval({ item, decision, stage, feedback: feedback || null, approver: currentUser });
      // App's realtime content subscription removes the item from the queue.
    } catch (e) {
      setErr(`${item.title || item.id}: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ marginBottom: isMobile ? 22 : 32, paddingBottom: isMobile ? 18 : 26, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', ...mono, marginBottom: 12 }}>Cloud Scenic / Approvals</div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: 'italic', color: '#fff', margin: 0, letterSpacing: -1, lineHeight: 1 }}>Approvals.</h1>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: '12px 0 0' }}>
          {internalQueue.length} awaiting your call
          {clientWait.length > 0 && <span> · {clientWait.length} with clients</span>}
        </p>
      </div>

      {err && (
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 10, fontSize: 12, color: '#ff453a' }}>
          Decision failed — {err}
        </div>
      )}

      {internalQueue.length === 0 ? (
        <div style={{ padding: '48px 30px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16, marginBottom: 22 }}>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontStyle: 'italic', color: '#f5f5f7', marginBottom: 6 }}>Inbox zero.</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>Nothing is waiting on an internal approval right now.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 26 }}>
          {internalQueue.map(({ item, client, assessment }) => (
            <InboxCard
              key={item.id}
              item={item}
              client={client}
              assessment={assessment}
              isMobile={isMobile}
              busy={busyId === item.id}
              onApprove={() => decide(item, 'approved')}
              onReject={(feedback) => decide(item, 'revision_requested', feedback)}
              onEdit={() => onEdit(item)}
            />
          ))}
        </div>
      )}

      {/* Read-only strip: items in the client's court. Deciding here would
          bypass the client's own approval mode — chase, don't override. */}
      {clientWait.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', ...mono, marginBottom: 10 }}>
            Waiting on clients — not your call
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clientWait.map(item => {
              const c = clientById.get(item.client_id);
              const waitDays = item.updated_at ? Math.floor((Date.now() - Date.parse(item.updated_at)) / DAY_MS) : null;
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, flexWrap: 'wrap' }}>
                  <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.name || '—'}</span>
                  <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: '#f5f5f7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Untitled'}</span>
                  <span style={{ ...mono, fontSize: 9.5, color: waitDays >= 3 ? '#ff9f0a' : 'rgba(255,255,255,0.4)' }}>
                    {waitDays != null ? `${waitDays}d in client court` : 'with client'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
