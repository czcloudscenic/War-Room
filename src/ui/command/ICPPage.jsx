import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'vantus_icps';

const PLATFORM_OPTIONS = ['IG', 'TT', 'YT', 'X', 'TH', 'LI', 'RD'];

const DEFAULT_ICPS = [
  {
    id: 'icp_1',
    name: 'Wellness Seekers',
    demographics: 'Millennials & Gen-Z, 22-38, urban/suburban, mid-to-high income',
    psychographics: 'Health-conscious, sustainability-focused, clean living, intentional consumption',
    painPoints: 'Overwhelmed by greenwashing, distrust of corporate wellness brands, want transparency',
    platforms: ['IG', 'TT'],
    contentPrefs: 'Short-form, raw/authentic, educational, aspirational wellness lifestyle',
    triggers: 'Social proof from micro-influencers, ingredient transparency, founder story',
    active: true,
  },
  {
    id: 'icp_2',
    name: 'Impact & Innovation',
    demographics: 'Startup founders, impact investors, 28-50, tech hubs, high income',
    psychographics: 'Tech-forward thinkers, mission-driven, values-aligned investing, systems thinkers',
    painPoints: 'Noise in the impact space, hard to find authentic mission-driven brands, due diligence fatigue',
    platforms: ['LI', 'X', 'YT'],
    contentPrefs: 'Long-form thought leadership, cinematic brand stories, data-driven content',
    triggers: 'Traction metrics, founder authenticity, community momentum, press/media coverage',
    active: true,
  },
  {
    id: 'icp_3',
    name: 'Adventure Lifestyle',
    demographics: 'Outdoor/travel enthusiasts, 24-42, global, mid income',
    psychographics: 'Experience-driven, off-grid curious, Tierra Bomba narrative, freedom-seekers',
    painPoints: 'Craving real adventure content (not tourist traps), want brands that match their lifestyle',
    platforms: ['TT', 'YT', 'IG'],
    contentPrefs: 'Cinematic travel, raw behind-the-scenes, short-form storytelling, vlog-style',
    triggers: 'FOMO from real experiences, community belonging, aspirational but accessible lifestyle',
    active: true,
  },
];

const loadICPs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ICPS));
  return DEFAULT_ICPS;
};

const saveICPs = (icps) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(icps));
};

const sLabel = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 2,
  color: 'rgba(255,255,255,0.35)',
  marginBottom: 5,
  fontWeight: 600,
};

const sValue = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.65)',
  lineHeight: 1.55,
};

const sInput = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  color: '#fff',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  resize: 'vertical',
};

const emptyICP = () => ({
  id: 'icp_' + Date.now(),
  name: '',
  demographics: '',
  psychographics: '',
  painPoints: '',
  platforms: [],
  contentPrefs: '',
  triggers: '',
  active: true,
});

export default function ICPPage() {
  const [icps, setICPs] = useState(() => loadICPs());
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  useEffect(() => { saveICPs(icps); }, [icps]);

  const toggleActive = (id) => {
    setICPs(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const startEdit = (icp) => {
    setEditingId(icp.id);
    setDraft({ ...icp });
  };

  const cancelEdit = () => {
    // If it was a new unsaved ICP with empty name, remove it
    if (draft && !draft.name.trim()) {
      setICPs(prev => prev.filter(p => p.id !== editingId));
    }
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!draft.name.trim()) return;
    setICPs(prev => prev.map(p => p.id === draft.id ? { ...draft } : p));
    setEditingId(null);
    setDraft(null);
  };

  const deleteICP = (id) => {
    setICPs(prev => prev.filter(p => p.id !== id));
    if (editingId === id) { setEditingId(null); setDraft(null); }
  };

  const addICP = () => {
    const n = emptyICP();
    setICPs(prev => [...prev, n]);
    setEditingId(n.id);
    setDraft({ ...n });
  };

  const togglePlatform = (plat) => {
    setDraft(prev => ({
      ...prev,
      platforms: prev.platforms.includes(plat)
        ? prev.platforms.filter(p => p !== plat)
        : [...prev.platforms, plat],
    }));
  };

  const renderCard = (icp) => {
    const isEditing = editingId === icp.id;
    const data = isEditing ? draft : icp;

    return (
      <div key={icp.id} style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        borderLeft: icp.active
          ? '3px solid #2AABFF'
          : '3px solid rgba(255,255,255,0.12)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isEditing ? (
            <input
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="Segment name..."
              style={{ ...sInput, fontSize: 15, fontWeight: 700, fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', borderRadius: 0, padding: '4px 0', flex: 1 }}
            />
          ) : (
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' }}>
              {icp.name}
            </div>
          )}
          {/* Toggle */}
          <div
            onClick={() => toggleActive(icp.id)}
            style={{
              width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative',
              background: icp.active ? '#2AABFF' : 'rgba(255,255,255,0.12)',
              transition: 'background 0.2s',
              flexShrink: 0, marginLeft: 12,
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 8, background: '#fff',
              position: 'absolute', top: 2,
              left: icp.active ? 18 : 2,
              transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {/* Fields */}
        {isEditing ? (
          <>
            <Field label="Demographics">
              <textarea rows={2} value={draft.demographics} onChange={e => setDraft(d => ({ ...d, demographics: e.target.value }))} style={sInput} placeholder="Age range, location, income..." />
            </Field>
            <Field label="Psychographics">
              <textarea rows={2} value={draft.psychographics} onChange={e => setDraft(d => ({ ...d, psychographics: e.target.value }))} style={sInput} placeholder="Values, lifestyle, motivations..." />
            </Field>
            <Field label="Pain Points">
              <textarea rows={2} value={draft.painPoints} onChange={e => setDraft(d => ({ ...d, painPoints: e.target.value }))} style={sInput} placeholder="What problems they face..." />
            </Field>
            <Field label="Platforms">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PLATFORM_OPTIONS.map(p => {
                  const on = draft.platforms.includes(p);
                  return (
                    <div key={p} onClick={() => togglePlatform(p)} style={{
                      padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                      fontFamily: "'Geist Mono', monospace",
                      background: on ? 'rgba(42,171,255,0.12)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${on ? 'rgba(42,171,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      color: on ? '#2AABFF' : 'rgba(255,255,255,0.4)',
                      transition: 'all 0.15s',
                    }}>{p}</div>
                  );
                })}
              </div>
            </Field>
            <Field label="Content Preferences">
              <textarea rows={2} value={draft.contentPrefs} onChange={e => setDraft(d => ({ ...d, contentPrefs: e.target.value }))} style={sInput} placeholder="Short-form, educational, cinematic..." />
            </Field>
            <Field label="Purchase Triggers">
              <textarea rows={2} value={draft.triggers} onChange={e => setDraft(d => ({ ...d, triggers: e.target.value }))} style={sInput} placeholder="What makes them act..." />
            </Field>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={cancelEdit} style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                padding: '6px 14px', fontSize: 11, color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>Cancel</button>
              <button onClick={saveEdit} style={{
                background: '#2AABFF', border: 'none', borderRadius: 8,
                padding: '6px 14px', fontSize: 11, color: '#fff', cursor: 'pointer', fontWeight: 600,
                fontFamily: 'Inter, sans-serif', opacity: draft.name.trim() ? 1 : 0.4,
              }}>Save</button>
            </div>
          </>
        ) : (
          <>
            <Field label="Demographics"><span style={sValue}>{icp.demographics}</span></Field>
            <Field label="Psychographics"><span style={sValue}>{icp.psychographics}</span></Field>
            <Field label="Pain Points"><span style={sValue}>{icp.painPoints}</span></Field>
            <Field label="Platforms">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(icp.platforms || []).map(p => (
                  <span key={p} style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                    fontFamily: "'Geist Mono', monospace",
                    background: 'rgba(42,171,255,0.12)',
                    border: '1px solid rgba(42,171,255,0.3)',
                    color: '#2AABFF',
                  }}>{p}</span>
                ))}
              </div>
            </Field>
            <Field label="Content Preferences"><span style={sValue}>{icp.contentPrefs}</span></Field>
            <Field label="Purchase Triggers"><span style={sValue}>{icp.triggers}</span></Field>
            {/* Action row */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
              <button onClick={() => startEdit(icp)} style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
                padding: '5px 12px', fontSize: 10, color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: 1,
              }}>Edit</button>
              <button onClick={() => deleteICP(icp.id)} style={{
                background: 'none', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 8,
                padding: '5px 12px', fontSize: 10, color: 'rgba(255,59,48,0.6)', cursor: 'pointer',
                fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: 1,
              }}>Delete</button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontFamily: "'Geist Mono', monospace", fontSize: 9, textTransform: 'uppercase',
          letterSpacing: 3, color: 'rgba(255,255,255,0.55)', marginBottom: 8, fontWeight: 600,
        }}>COMMAND</div>
        <h1 style={{
          fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontStyle: 'italic',
          color: '#fff', margin: 0, fontWeight: 400,
        }}>Ideal Customer</h1>
        <p style={{
          fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '6px 0 0',
        }}>Define who you're creating for. Agents use this to write smarter content.</p>
      </div>

      {/* Add button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={addICP} style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>+</button>
      </div>

      {/* Card grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
        gap: 16,
      }}>
        {icps.map(renderCard)}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={sLabel}>{label}</div>
      {children}
    </div>
  );
}
