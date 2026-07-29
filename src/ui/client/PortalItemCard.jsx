// PortalItemCard — one reviewable item in the client portal.
//
// Shows the deliverable (copy, caption, attached previews) and records the
// client's decision via POST /api/approval (Mode A — session bearer). Never
// writes approvals/content_items directly: RLS reserves those writes for
// admins and the service key.

import React, { useState, useMemo } from 'react';
import { apiFetch } from '../../services/apiFetch';

const isImage = (f) => /\.(png|jpe?g|gif|webp|avif)$/i.test(f?.name || '');

export default function PortalItemCard({ item, client, accent = '#2AABFF', showClientName = false }) {
  const [mode, setMode] = useState(null);          // null | 'changes'
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);          // 'approved' | 'revision_requested'
  const [error, setError] = useState(null);

  const gate = item.status === 'Need Copy Approval' ? 'Copy' : 'Content';
  const round = Number(item.revision_count) || 0;
  const cap = client?.included_revisions != null ? Number(client.included_revisions) : null;
  const images = useMemo(() => (item.files || []).filter(isImage), [item.files]);
  const otherFiles = useMemo(() => (item.files || []).filter(f => !isImage(f)), [item.files]);

  const decide = async (decision) => {
    if (busy) return;
    if (decision === 'revision_requested' && !feedback.trim()) {
      setError('Add a note about what should change.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const res = await apiFetch('/api/approval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, decision, feedback: feedback.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setDone(decision);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{ padding: '18px 20px', marginBottom: 14, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18 }}>{done === 'approved' ? '✅' : '✎'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{done === 'approved' ? 'Approved' : 'Change request sent'}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>"{item.title}" — the team has been notified.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.035)', overflow: 'hidden' }}>
      {/* Card head */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20 }}>{gate} approval</span>
          {item.platform && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{item.platform}</span>}
          {showClientName && client?.name && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>· {client.name}</span>}
          {round > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 'auto', color: cap != null && round >= cap ? '#ff9f0a' : 'rgba(255,255,255,0.45)' }}>
              Round {round}{cap != null ? ` of ${cap} included` : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>{item.title}</div>
        {item.campaign && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{item.campaign}</div>}
      </div>

      {/* Deliverable body */}
      <div style={{ padding: '14px 20px' }}>
        {item.description && <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.75)' }}>{item.description}</p>}
        {item.caption && (
          <div style={{ margin: '0 0 12px', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Caption</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>{item.caption}</div>
          </div>
        )}
        {item.script && gate === 'Content' && (
          <div style={{ margin: '0 0 12px', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Script</div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>{item.script}</div>
          </div>
        )}

        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 12px' }}>
            {images.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer">
                <img src={f.url} alt={f.name} style={{ width: 108, height: 108, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }} />
              </a>
            ))}
          </div>
        )}
        {otherFiles.length > 0 && (
          <div style={{ margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {otherFiles.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: accent, textDecoration: 'none' }}>
                📎 {f.name || 'Attachment'}
              </a>
            ))}
          </div>
        )}

        {/* Decision row */}
        {mode !== 'changes' ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={() => decide('approved')}
              disabled={busy}
              style={{ flex: 1, padding: '13px 0', border: 0, borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#1e8e3e,#34a853)', opacity: busy ? 0.6 : 1 }}
            >
              ✓ Approve
            </button>
            <button
              onClick={() => { setMode('changes'); setError(null); }}
              disabled={busy}
              style={{ flex: 1, padding: '13px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)' }}
            >
              ✎ Request changes
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 4 }}>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What should change?"
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 84, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            />
            {cap != null && round >= cap && (
              <div style={{ fontSize: 11, color: '#ff9f0a', margin: '8px 0 0' }}>
                Heads up — this would be revision round {round + 1}; your plan includes {cap}. Additional rounds may be billed.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => decide('revision_requested')}
                disabled={busy}
                style={{ flex: 1, padding: '12px 0', border: 0, borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', cursor: busy ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#b25c00,#e37400)', opacity: busy ? 0.6 : 1 }}
              >
                Send change request
              </button>
              <button
                onClick={() => setMode(null)}
                disabled={busy}
                style={{ padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.6)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <div style={{ fontSize: 12, color: '#ff453a', marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  );
}
