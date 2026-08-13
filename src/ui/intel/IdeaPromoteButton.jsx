import React, { useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

const ACCENT = '#2AABFF';

export default function IdeaPromoteButton({ idea, client, onPromoted, disabled = false }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [errorLine, setErrorLine] = useState('');

  if (promoted) return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>In pipeline</span>;
  if (idea?.status !== 'approved') return null;

  async function promote() {
    if (!idea?.id || !client?.id || busy || disabled) return;
    setBusy(true);
    setErrorLine('');
    const now = new Date().toISOString();
    const row = {
      id: `${client.slug || 'item'}-${Date.now()}`,
      client_id: client.id,
      title: String(idea.hook || 'Untitled idea').slice(0, 80),
      description: idea.angle || '',
      script: idea.script || '',
      caption: '',
      cta: '',
      status: 'Ready For Copy Creation',
      stage: 'Ready For Copy Creation',
      approval_mode: client.approval_rule || 'internal',
      format: 'Reel',
      platform: 'instagram',
      type: 'reel',
      platforms: ['IG'],
      pillar: idea.pillar || '',
      notes: `From Content Intel · signal: ${idea.signal || '—'} · fit ${idea.fit_score}`,
      files: [],
    };

    try {
      const { error: insertError } = await sb.from('content_items').insert(row);
      if (insertError) throw insertError;
      const { error: updateError } = await sb.from('content_ideas').update({ status: 'posted', updated_at: now }).eq('id', idea.id);
      if (updateError) throw updateError;
      setPromoted(true);
      setConfirming(false);
      onPromoted?.();
    } catch {
      setErrorLine('This idea could not be sent to the pipeline.');
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ maxWidth: 210, textAlign: 'right', fontSize: 10.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.48)' }}>Create a pipeline item? Nothing will publish automatically.</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button disabled={busy || disabled} onClick={promote} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${ACCENT}55`, background: `${ACCENT}16`, color: ACCENT, fontSize: 10.5, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Sending…' : 'Confirm'}</button>
          <button disabled={busy} onClick={() => { setConfirming(false); setErrorLine(''); }} style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 10.5, cursor: busy ? 'wait' : 'pointer' }}>Cancel</button>
        </div>
        {errorLine ? <span style={{ maxWidth: 220, textAlign: 'right', fontSize: 10.5, color: '#ff453a' }}>{errorLine}</span> : null}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
      <button disabled={disabled} onClick={() => setConfirming(true)} style={{ padding: '6px 11px', borderRadius: 8, border: '1px solid rgba(42,171,255,0.35)', background: 'rgba(42,171,255,0.08)', color: disabled ? 'rgba(255,255,255,0.25)' : ACCENT, fontSize: 10.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer' }}>Send to Pipeline</button>
      {errorLine ? <span style={{ maxWidth: 220, textAlign: 'right', fontSize: 10.5, color: '#ff453a' }}>{errorLine}</span> : null}
    </div>
  );
}
