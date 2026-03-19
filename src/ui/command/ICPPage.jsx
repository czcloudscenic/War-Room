import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'vantus_icps';

const SECTIONS_CONFIG = [
  {
    key: 'demographics',
    number: '01',
    title: 'Demographics & Identity',
    purpose: 'Identify budget level, internal structure, and creative maturity. Helps qualify who\u2019s ready for a retainer vs. who just needs a one-off.',
    fields: [
      { key: 'businessType', label: 'What type of business are you? (restaurant, hospitality brand, tech startup, etc.)' },
      { key: 'revenueRange', label: 'What\u2019s your average monthly revenue range?' },
      { key: 'marketingHandler', label: 'Who handles your marketing/creative right now \u2014 owner, internal team, or freelancer?' },
      { key: 'postingFrequency', label: 'How often are you currently posting new photo/video content?' },
      { key: 'onlinePresence', label: 'How do you describe your brand\u2019s online presence when you talk to customers?' },
      { key: 'visualAspirations', label: 'What brands do you look up to or want to emulate visually?' },
    ],
  },
  {
    key: 'goals',
    number: '02',
    title: 'Goals & Dreams',
    purpose: 'Pull out emotional drivers \u2014 what they want the brand to represent. Use this to position your creative system as the bridge to that vision.',
    fields: [
      { key: 'successVision', label: 'What does success look like for your brand in the next 12 months?' },
      { key: 'motivation', label: 'What motivated you to start this brand or business in the first place?' },
      { key: 'idealBrandLook', label: 'If everything worked out perfectly, how would your brand look online?' },
      { key: 'emotionalResponse', label: 'What do you want people to feel when they see your content?' },
      { key: 'visibilityLevel', label: 'What\u2019s the \u201cnext level\u201d of visibility you\u2019re chasing \u2014 local domination, multi-location expansion, national attention?' },
    ],
  },
  {
    key: 'painPoints',
    number: '03',
    title: 'Current Situation & Pain Points',
    purpose: 'Expose the gap between their current inconsistency and your Consistency Engine. Use these answers to show why they need a system, not random shoots.',
    fields: [
      { key: 'whatsNotWorking', label: 'What\u2019s not working with your current content or marketing right now?' },
      { key: 'pastExperience', label: 'What have you tried in the past (freelancers, agencies, internal team)? What didn\u2019t work?' },
      { key: 'postingConsistency', label: 'Are you posting consistently or only when you have time or new products?' },
      { key: 'contentPlan', label: 'Do you have a clear content plan or are you winging it month to month?' },
      { key: 'biggestFrustration', label: 'What\u2019s your biggest frustration with agencies or creators you\u2019ve worked with before?' },
      { key: 'holdingBack', label: 'What\u2019s holding your brand back from showing up online the way you envision it?' },
    ],
  },
  {
    key: 'beliefs',
    number: '04',
    title: 'Beliefs & Objections',
    purpose: 'Uncover fears and limiting beliefs around creative spending. Reframe objections in your VSL and sales calls.',
    fields: [
      { key: 'contentNotConverting', label: 'What do you currently believe is the main reason your content isn\u2019t converting or driving customers?' },
      { key: 'retainerReaction', label: 'When you hear \u201ccreative agency\u201d or \u201cmonthly retainer,\u201d what\u2019s your first reaction?' },
      { key: 'hesitations', label: 'What\u2019s made you hesitant to invest in consistent creative before?' },
      { key: 'burnedBefore', label: 'Have you ever been burned by an agency or freelancer? What happened?' },
      { key: 'trustRequirements', label: 'What would need to be true for you to feel confident hiring a creative team long-term?' },
      { key: 'decisionInfluencers', label: 'Who influences your marketing decisions \u2014 owner, partner, investor, or manager?' },
    ],
  },
];

const EXAMPLE_USES = [
  'Build lead qualification forms \u2014 Typeform questions map directly to these',
  'Write VSL talking points \u2014 each section gives a story beat',
  'Guide sales calls \u2014 every question helps identify if they\u2019re fit',
  'Inject into agent prompts \u2014 all 8 agents understand the audience',
];

const DEFAULT_CLIENTS = [
  {
    id: 'client_vitallyfe',
    name: 'VitalLyfe',
    active: true,
    sections: {
      demographics: {
        businessType: '',
        revenueRange: '',
        marketingHandler: '',
        postingFrequency: '',
        onlinePresence: '',
        visualAspirations: '',
      },
      goals: {
        successVision: '',
        motivation: '',
        idealBrandLook: '',
        emotionalResponse: '',
        visibilityLevel: '',
      },
      painPoints: {
        whatsNotWorking: '',
        pastExperience: '',
        postingConsistency: '',
        contentPlan: '',
        biggestFrustration: '',
        holdingBack: '',
      },
      beliefs: {
        contentNotConverting: '',
        retainerReaction: '',
        hesitations: '',
        burnedBefore: '',
        trustRequirements: '',
        decisionInfluencers: '',
      },
    },
  },
];

const loadClients = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.length && parsed[0].sections) return parsed;
    }
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CLIENTS));
  return DEFAULT_CLIENTS;
};

const saveClients = (clients) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
};

const makeEmptyClient = (name) => ({
  id: 'client_' + Date.now(),
  name: name || '',
  active: false,
  sections: {
    demographics: { businessType: '', revenueRange: '', marketingHandler: '', postingFrequency: '', onlinePresence: '', visualAspirations: '' },
    goals: { successVision: '', motivation: '', idealBrandLook: '', emotionalResponse: '', visibilityLevel: '' },
    painPoints: { whatsNotWorking: '', pastExperience: '', postingConsistency: '', contentPlan: '', biggestFrustration: '', holdingBack: '' },
    beliefs: { contentNotConverting: '', retainerReaction: '', hesitations: '', burnedBefore: '', trustRequirements: '', decisionInfluencers: '' },
  },
});

// ── Styles ──

const sCard = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  marginBottom: 14,
  overflow: 'hidden',
};

const sSectionHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px',
  cursor: 'pointer',
  userSelect: 'none',
};

const sSectionNumber = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  color: '#2AABFF',
  fontWeight: 700,
  marginRight: 10,
};

const sSectionTitle = {
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
};

const sPurpose = {
  background: 'rgba(42,171,255,0.06)',
  borderLeft: '2px solid rgba(42,171,255,0.3)',
  padding: '10px 14px',
  fontSize: 11,
  color: 'rgba(255,255,255,0.5)',
  fontStyle: 'italic',
  margin: '0 18px 14px',
  borderRadius: '0 6px 6px 0',
  lineHeight: 1.5,
};

const sQuestionLabel = {
  fontSize: 12,
  color: 'rgba(255,255,255,0.65)',
  marginBottom: 4,
  lineHeight: 1.4,
};

const sTextarea = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '9px 13px',
  color: '#f0eeef',
  fontSize: 12,
  fontFamily: 'Inter, sans-serif',
  minHeight: 44,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
  lineHeight: 1.5,
};

const sExampleCard = {
  background: 'rgba(255,159,10,0.06)',
  border: '1px solid rgba(255,159,10,0.15)',
  borderRadius: 14,
  padding: '18px 20px',
  marginTop: 24,
};

// ── Arrow component ──

function CollapseArrow({ open }) {
  return (
    <svg
      width="12" height="12"
      viewBox="0 0 12 12"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }}
    >
      <path d="M2 4.5L6 8.5L10 4.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Section Card ──

function SectionCard({ config, sectionData, onFieldChange }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={sCard}>
      <div style={sSectionHeader} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={sSectionNumber}>{config.number}</span>
          <span style={sSectionTitle}>{config.title}</span>
        </div>
        <CollapseArrow open={open} />
      </div>

      {open && (
        <div>
          <div style={sPurpose}>{config.purpose}</div>
          <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {config.fields.map(f => (
              <div key={f.key}>
                <div style={sQuestionLabel}>{f.label}</div>
                <textarea
                  style={sTextarea}
                  value={sectionData[f.key] || ''}
                  onChange={e => onFieldChange(config.key, f.key, e.target.value)}
                  rows={1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function ICPPage() {
  const [clients, setClients] = useState(() => loadClients());
  const [activeClientId, setActiveClientId] = useState(() => {
    const loaded = loadClients();
    return loaded.length ? loaded[0].id : null;
  });
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  const activeClient = clients.find(c => c.id === activeClientId) || clients[0] || null;

  // Persist on change
  useEffect(() => { saveClients(clients); }, [clients]);

  const handleFieldChange = useCallback((sectionKey, fieldKey, value) => {
    setClients(prev => prev.map(c => {
      if (c.id !== activeClientId) return c;
      return {
        ...c,
        sections: {
          ...c.sections,
          [sectionKey]: {
            ...c.sections[sectionKey],
            [fieldKey]: value,
          },
        },
      };
    }));
  }, [activeClientId]);

  const toggleClientActive = useCallback(() => {
    setClients(prev => prev.map(c =>
      c.id === activeClientId ? { ...c, active: !c.active } : c
    ));
  }, [activeClientId]);

  const addClient = () => {
    const name = newClientName.trim();
    if (!name) return;
    const nc = makeEmptyClient(name);
    setClients(prev => [...prev, nc]);
    setActiveClientId(nc.id);
    setNewClientName('');
    setAddingClient(false);
  };

  const deleteClient = (id) => {
    setClients(prev => {
      const next = prev.filter(c => c.id !== id);
      if (activeClientId === id && next.length) {
        setActiveClientId(next[0].id);
      }
      return next;
    });
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "'Geist Mono', monospace", fontSize: 9, textTransform: 'uppercase',
          letterSpacing: 3, color: 'rgba(255,255,255,0.55)', marginBottom: 8, fontWeight: 600,
        }}>COMMAND</div>
        <h1 style={{
          fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontStyle: 'italic',
          color: '#fff', margin: 0, fontWeight: 400,
        }}>Ideal Customer</h1>
        <p style={{
          fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '6px 0 0', lineHeight: 1.5,
        }}>Deep client discovery framework. Define who you serve across 4 dimensions so every agent writes smarter, every sales call converts harder.</p>
      </div>

      {/* ── Client Selector ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        {clients.map(c => (
          <div
            key={c.id}
            onClick={() => setActiveClientId(c.id)}
            style={{
              padding: '7px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: c.id === activeClientId ? 'rgba(42,171,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${c.id === activeClientId ? 'rgba(42,171,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: c.id === activeClientId ? '#2AABFF' : 'rgba(255,255,255,0.55)',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {c.active && (
              <span style={{
                width: 6, height: 6, borderRadius: 3,
                background: '#34C759', flexShrink: 0,
              }} />
            )}
            {c.name}
            {clients.length > 1 && c.id === activeClientId && (
              <span
                onClick={e => { e.stopPropagation(); deleteClient(c.id); }}
                style={{
                  marginLeft: 4, fontSize: 10, color: 'rgba(255,59,48,0.6)',
                  cursor: 'pointer', lineHeight: 1,
                }}
              >&times;</span>
            )}
          </div>
        ))}

        {addingClient ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              autoFocus
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addClient(); if (e.key === 'Escape') { setAddingClient(false); setNewClientName(''); } }}
              placeholder="Client name..."
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 12,
                color: '#fff',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                width: 140,
              }}
            />
            <button onClick={addClient} style={{
              background: '#2AABFF', border: 'none', borderRadius: 8,
              padding: '6px 10px', fontSize: 10, color: '#fff', cursor: 'pointer', fontWeight: 600,
            }}>Add</button>
            <button onClick={() => { setAddingClient(false); setNewClientName(''); }} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              padding: '6px 8px', fontSize: 10, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            }}>&times;</button>
          </div>
        ) : (
          <div
            onClick={() => setAddingClient(true)}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16,
              transition: 'all 0.15s',
            }}
          >+</div>
        )}
      </div>

      {/* ── Active Toggle ── */}
      {activeClient && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
        }}>
          <div
            onClick={toggleClientActive}
            style={{
              width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative',
              background: activeClient.active ? '#2AABFF' : 'rgba(255,255,255,0.12)',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 8, background: '#fff',
              position: 'absolute', top: 2,
              left: activeClient.active ? 18 : 2,
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 12, color: activeClient.active ? '#fff' : 'rgba(255,255,255,0.4)' }}>
            {activeClient.active
              ? `${activeClient.name} ICP is active \u2014 injected into all agent prompts`
              : `${activeClient.name} ICP is paused \u2014 agents won\u2019t see this profile`
            }
          </span>
        </div>
      )}

      {/* ── 4 Section Cards ── */}
      {activeClient && SECTIONS_CONFIG.map(config => (
        <SectionCard
          key={config.key}
          config={config}
          sectionData={activeClient.sections[config.key] || {}}
          onFieldChange={handleFieldChange}
        />
      ))}

      {/* ── Example Use Footer ── */}
      <div style={sExampleCard}>
        <div style={{
          fontFamily: "'Geist Mono', monospace", fontSize: 9, textTransform: 'uppercase',
          letterSpacing: 2, color: 'rgba(255,159,10,0.7)', fontWeight: 600, marginBottom: 10,
        }}>EXAMPLE USE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EXAMPLE_USES.map((use, i) => (
            <div key={i} style={{
              fontSize: 12, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', lineHeight: 1.5,
              paddingLeft: 12,
              borderLeft: '2px solid rgba(255,159,10,0.2)',
            }}>
              {use}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
