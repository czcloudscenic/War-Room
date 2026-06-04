import React, { useState, useCallback } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';

// Idea Engine — set the funnel goal + format (or drop your own idea), generate
// compact concept tiles engineered on psychological levers, open one for a full
// shootable brief, then push it to the pipeline. Two-stage so Opus never blows
// the function timeout: the list is fast, each brief is built on open.

const FMT_TYPE = { 'Reel/Video': 'reel', 'Story Sequence': 'story', 'Carousel': 'carousel' };
const ACCENT = '#2AABFF';

export default function IdeaEngineRoute({ currentClient }) {
  const [inspiration, setInspiration] = useState('');
  const [ideas, setIdeas] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listMsg, setListMsg] = useState(null);
  const [error, setError] = useState(null);

  const [setupOpen, setSetupOpen] = useState(false);
  const [funnelStage, setFunnelStage] = useState('TOF');
  const [contentType, setContentType] = useState('Reel/Video');
  const [userIdea, setUserIdea] = useState('');

  const [open, setOpen] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const clientId = currentClient?.id || (() => { try { return localStorage.getItem('vantus_current_client_id'); } catch { return null; } })();

  const cook = useCallback(async () => {
    setSetupOpen(false);
    setListLoading(true); setError(null); setListMsg(null); setIdeas([]);
    try {
      const res = await apiFetch('/api/agent-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'muse_idea_list', payload: { inspiration: inspiration.trim(), funnelStage, contentType, userIdea: userIdea.trim() }, client_id: clientId }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || d.message || 'Generation failed');
      setIdeas(d.ideas || []); setListMsg(d.message || `${d.count} concepts`);
    } catch (e) { setError(e.message); }
    finally { setListLoading(false); }
  }, [inspiration, funnelStage, contentType, userIdea, clientId]);

  const openIdea = useCallback(async (idea) => {
    setOpen(idea); setBrief(null); setSent(false); setBriefLoading(true); setError(null);
    try {
      const res = await apiFetch('/api/agent-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'muse_film_brief', payload: { title: idea.title, concept: idea.angle || idea.concept, hook: idea.hook, lever: idea.lever, format: idea.format, pillar: idea.pillar, funnelStage }, client_id: clientId }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || d.message || 'Brief failed');
      setBrief(d.brief);
    } catch (e) { setError(e.message); }
    finally { setBriefLoading(false); }
  }, [clientId, funnelStage]);

  const sendToPipeline = useCallback(async () => {
    if (!brief) return;
    setSending(true);
    try {
      const fmt = brief.format || 'Reel/Video';
      const scriptText = [
        brief.shotBreakdown?.length ? 'BREAKDOWN\n' + brief.shotBreakdown.map(s =>
          `${s.time}\n  ${s.shot}\n  SCRIPT: ${s.script}${s.overlay && s.overlay !== '-' ? `\n  OVERLAY: ${s.overlay}` : ''}`).join('\n\n') : '',
        brief.script ? '\n\nSCRIPT\n' + brief.script : '',
      ].join('');
      const row = {
        id: `${(currentClient?.slug || 'ig')}-idea-${Date.now()}`,
        title: brief.title || open?.title || 'Untitled',
        description: [brief.concept, brief.message && `Message: ${brief.message}`, brief.setting && `Setting: ${brief.setting}`, brief.talent && `Talent: ${brief.talent}`].filter(Boolean).join(' · '),
        platform: 'instagram', type: FMT_TYPE[fmt] || 'reel', format: fmt,
        stage: 'Ready For Copy Creation', status: 'Ready For Copy Creation',
        pillar: brief.pillar || open?.pillar || '', platforms: ['IG'],
        script: scriptText.trim(), caption: '', cta: '',
        start_week: 1, duration: 1,
        ...(clientId ? { client_id: clientId } : {}),
      };
      const { error: e } = await sb.from('content_items').insert(row);
      if (e) throw e;
      setSent(true);
    } catch (e) { setError(e.message); }
    finally { setSending(false); }
  }, [brief, open, currentClient, clientId]);

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 26, flexWrap: 'wrap' }}>
        <div>
          <div style={eyebrow}>Muse</div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#f5f5f7', margin: 0, letterSpacing: -1, lineHeight: 1 }}>Idea Engine</h1>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
            Concepts engineered on psychological levers{currentClient?.name ? `, for ${currentClient.name}` : ''}.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {ideas.length > 0 && !listLoading && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {FUNNEL_LABEL[funnelStage]} · {contentType}{userIdea ? ' · your idea' : ''}
            </span>
          )}
          <button onClick={() => setSetupOpen(true)} disabled={listLoading} style={primaryBtn(listLoading)}>
            {listLoading ? 'Generating…' : ideas.length ? 'New batch' : 'New ideas'}
          </button>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}
      {listMsg && !error && <div style={{ marginBottom: 18, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{listMsg}</div>}

      {/* Empty state */}
      {!ideas.length && !listLoading && (
        <div style={{ marginTop: 28, padding: '52px 28px', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, textAlign: 'center', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{ fontSize: 15, color: '#f5f5f7', fontWeight: 600, marginBottom: 8 }}>Nothing generated yet</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>Set the funnel goal and format, optionally drop your own idea, and Muse engineers six concepts off your real top posts. Open any tile for the full breakdown.</div>
          <button onClick={() => setSetupOpen(true)} style={{ ...primaryBtn(false), marginTop: 20 }}>New ideas</button>
        </div>
      )}

      {/* Tiles */}
      {ideas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 12 }}>
          {ideas.map((idea, i) => (
            <button key={i} onClick={() => openIdea(idea)} style={tile}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                {idea.lever && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>{idea.lever}</span>}
                <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto', fontFamily: "'Geist Mono', monospace" }}>{idea.format}</span>
              </div>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 19, fontWeight: 600, color: '#f5f5f7', lineHeight: 1.2, marginBottom: 10, letterSpacing: -0.3 }}>
                {idea.hook ? `“${idea.hook}”` : idea.title}
              </div>
              {idea.whyItWorks && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 8 }}>{idea.whyItWorks}</div>}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{idea.angle || idea.concept}</div>
            </button>
          ))}
        </div>
      )}

      {/* Setup box */}
      {setupOpen && (
        <Modal onClose={() => setSetupOpen(false)} width={940}>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: -0.5, marginBottom: 6 }}>New ideas</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.42)', marginBottom: 30 }}>Set the goal and format. Muse structures the rest.</div>

          <div style={fieldLbl}>Funnel stage</div>
          <Segmented options={FUNNEL_OPTS.map(f => ({ value: f.id, label: f.id, sub: f.sub }))} value={funnelStage} onChange={setFunnelStage} />

          <div style={{ ...fieldLbl, marginTop: 26 }}>Content type</div>
          <Segmented options={['Reel/Video', 'Story Sequence', 'Carousel'].map(c => ({ value: c, label: c }))} value={contentType} onChange={setContentType} />

          <div style={{ ...fieldLbl, marginTop: 26 }}>Your idea <span style={optional}>optional — we structure it</span></div>
          <textarea value={userIdea} onChange={e => setUserIdea(e.target.value)} rows={13}
            placeholder="Drop a raw idea and we build six executions of it. Or leave blank for fresh concepts."
            style={{ ...input, resize: 'vertical', minHeight: 340, lineHeight: 1.6, fontSize: 16 }} />

          <div style={{ ...fieldLbl, marginTop: 22 }}>Creators to emulate <span style={optional}>optional</span></div>
          <input value={inspiration} onChange={e => setInspiration(e.target.value)} placeholder="e.g. Alex Hormozi, Nik Setting" style={input} />

          <div style={{ display: 'flex', gap: 10, marginTop: 30 }}>
            <button onClick={cook} style={{ ...primaryBtn(false), flex: 1, justifyContent: 'center', padding: '15px', fontSize: 15 }}>{userIdea.trim() ? 'Structure my idea' : 'Generate'}</button>
            <button onClick={() => setSetupOpen(false)} style={{ ...ghostBtn, padding: '15px 24px', fontSize: 14 }}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Breakdown */}
      {open && (
        <Modal onClose={() => setOpen(null)} width={760}>
          {briefLoading && (
            <div style={{ padding: '64px 0', textAlign: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block', animation: 'livePulse 1s infinite', marginBottom: 16 }} />
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Building the full brief…</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>{open.title}</div>
            </div>
          )}
          {!briefLoading && brief && (
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                {brief.filmLabel && <span style={{ ...eyebrow, marginBottom: 0 }}>{brief.filmLabel}</span>}
                {brief.lever && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>{brief.lever}</span>}
              </div>
              <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 30, fontWeight: 700, color: '#fff', margin: '0 0 20px', letterSpacing: -0.5, lineHeight: 1.1 }}>{brief.title}</h2>

              {brief.concept && <Section label="Concept">{brief.concept}</Section>}
              {brief.message && <Section label="The message">{brief.message}</Section>}
              {(brief.setting || brief.talent) && (
                <Section label="Setting & talent">
                  {brief.setting && <div><span style={{ color: 'rgba(255,255,255,0.45)' }}>Setting — </span>{brief.setting}</div>}
                  {brief.talent && <div style={{ marginTop: 4 }}><span style={{ color: 'rgba(255,255,255,0.45)' }}>Talent — </span>{brief.talent}</div>}
                </Section>
              )}

              {brief.shotBreakdown?.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={monoLbl}>Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                    {brief.shotBreakdown.map((s, i) => (
                      <div key={i} style={{ borderLeft: '1px solid rgba(255,255,255,0.14)', paddingLeft: 14 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: ACCENT, fontFamily: "'Geist Mono', monospace", marginBottom: 5 }}>{s.time}</div>
                        {s.shot && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{s.shot}</div>}
                        {s.script && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.55, marginTop: 3 }}>“{s.script}”</div>}
                        {s.overlay && s.overlay !== '-' && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginTop: 3, fontFamily: "'Geist Mono', monospace" }}>OVERLAY — {s.overlay}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {brief.script && (
                <div style={{ marginTop: 24 }}>
                  <div style={monoLbl}>Script</div>
                  <div style={{ marginTop: 10, padding: '16px 18px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{brief.script}</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
                <button onClick={sendToPipeline} disabled={sending || sent}
                  style={sent ? { ...ghostBtn, color: '#34C759', borderColor: 'rgba(52,199,89,0.3)' } : primaryBtn(false)}>
                  {sent ? 'Sent to pipeline' : sending ? 'Sending…' : 'Send to pipeline'}
                </button>
                <button onClick={() => openIdea(open)} disabled={briefLoading} style={ghostBtn}>Regenerate</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ── primitives ─────────────────────────────────────────────────────────── */
function Modal({ children, onClose, width }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: width, background: '#0e0e10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '36px 42px 44px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
        {children}
      </div>
    </div>
  );
}
function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, textAlign: 'center', padding: '16px 10px', borderRadius: 11, cursor: 'pointer',
            background: active ? 'rgba(42,171,255,0.1)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${active ? 'rgba(42,171,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
            color: active ? ACCENT : 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif',
          }}>
            <div style={{ fontSize: 15.5, fontWeight: 600 }}>{o.label}</div>
            {o.sub && <div style={{ fontSize: 11.5, color: active ? 'rgba(42,171,255,0.7)' : 'rgba(255,255,255,0.35)', marginTop: 3 }}>{o.sub}</div>}
          </button>
        );
      })}
    </div>
  );
}
function Section({ label, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={monoLbl}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.6, marginTop: 6 }}>{children}</div>
    </div>
  );
}

/* ── tokens ─────────────────────────────────────────────────────────────── */
const ACCENT_C = ACCENT;
const eyebrow = { fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: "'Geist Mono', monospace", fontWeight: 700, marginBottom: 9 };
const monoLbl = { fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', fontFamily: "'Geist Mono', monospace", fontWeight: 700 };
const fieldLbl = { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 11 };
const optional = { color: 'rgba(255,255,255,0.3)', fontWeight: 400 };
const FUNNEL_OPTS = [{ id: 'TOF', sub: 'Awareness' }, { id: 'MOF', sub: 'Nurture' }, { id: 'BOF', sub: 'Sell' }];
const FUNNEL_LABEL = { TOF: 'TOF', MOF: 'MOF', BOF: 'BOF' };
const tile = { textAlign: 'left', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: 17, cursor: 'pointer', transition: 'border-color .15s', fontFamily: 'Inter, sans-serif' };
const input = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.11)', borderRadius: 10, padding: '13px 15px', fontSize: 15, color: '#f5f5f7', outline: 'none', fontFamily: 'Inter, sans-serif' };
const errorBox = { marginBottom: 16, padding: '10px 14px', background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 10, fontSize: 12, color: '#ff453a' };
const primaryBtn = (loading) => ({ background: loading ? 'rgba(255,255,255,0.08)' : '#f5f5f7', color: loading ? 'rgba(255,255,255,0.5)' : '#0e0e10', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 8 });
const ghostBtn = { background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
