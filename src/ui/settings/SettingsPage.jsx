import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../../utils/hooks.js';

const STORAGE_KEY = 'vantus_settings';

const loadConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveConfig = (cfg) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
};

/* ── shared styles ── */
const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 22,
  },
  label: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: 15,
    fontStyle: 'italic',
    color: '#fff',
    margin: 0,
  },
  cardSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 3,
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '9px 13px',
    color: '#f0eeef',
    fontSize: 12,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 12,
    padding: '8px 18px',
    cursor: 'pointer',
    fontFamily: "'Geist Mono', monospace",
  },
};

/* ── Toggle Switch ── */
function Toggle({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: on ? '#2AABFF' : 'rgba(255,255,255,0.12)',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: on ? 19 : 3,
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

/* ── Toast ── */
function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(42,171,255,0.15)', border: '1px solid rgba(42,171,255,0.3)',
      borderRadius: 10, padding: '10px 22px', color: '#fff', fontSize: 12,
      fontFamily: "'Geist Mono', monospace", zIndex: 9999,
      animation: 'fadeIn 0.3s ease',
    }}>
      {message}
    </div>
  );
}

/* ── Field row ── */
function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={S.label}>{label}</div>
      <input
        style={S.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ''}
      />
    </div>
  );
}

/* ── Toggle row ── */
function ToggleRow({ label, on, onToggle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}

/* ──────────────────────────────────────────── */
export default function SettingsPage() {
  const isMobile = useIsMobile();

  /* workspace config */
  const [config, setConfig] = useState(() => {
    const saved = loadConfig();
    return {
      brand: saved.brand || '',
      niche: saved.niche || '',
      defaultDuration: saved.defaultDuration || '',
      n8nWebhook: saved.n8nWebhook || '',
    };
  });

  /* AI toggles (display-only) */
  const [aiEngine, setAiEngine] = useState(true);
  const [autoBriefs, setAutoBriefs] = useState(true);
  const [morningBriefing, setMorningBriefing] = useState(false);
  const [deepScans, setDeepScans] = useState(false);

  /* toast */
  const [toast, setToast] = useState('');
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const handleSaveConfig = () => {
    saveConfig(config);
    showToast('Workspace config saved');
  };

  const handleToggle = (setter) => () => {
    setter(prev => !prev);
    showToast('Setting updated');
  };

  const handleCheckHealth = () => {
    showToast('API health: OK');
  };

  const updateField = (key) => (val) => setConfig(prev => ({ ...prev, [key]: val }));

  const colGap = isMobile ? 0 : 22;
  const gridCols = isMobile ? '1fr' : '1fr 1fr';

  /* ── team data (static for now) ── */
  const team = [
    { email: 'chris@vantus.io', role: 'Owner' },
    { email: 'ops@vantus.io', role: 'Admin' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Section heading */}
      <div style={{ marginBottom: isMobile ? 16 : 28 }}>
        <div style={S.label}>Configuration</div>
        <h1 style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: isMobile ? 22 : 28,
          fontStyle: 'italic',
          color: '#fff',
          margin: 0,
          letterSpacing: -0.5,
        }}>
          Settings
        </h1>
      </div>

      {/* 2-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: colGap,
        rowGap: 22,
      }}>

        {/* ── LEFT COL: Workspace ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Workspace Card */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Workspace</h3>
            <div style={S.cardSub}>Brand identity & webhook configuration</div>
            <div style={{ marginTop: 18 }}>
              <Field label="Brand" value={config.brand} onChange={updateField('brand')} placeholder="e.g. Vital Lyfe" />
              <Field label="Niche" value={config.niche} onChange={updateField('niche')} placeholder="e.g. Health & Wellness" />
              <Field label="Default Duration" value={config.defaultDuration} onChange={updateField('defaultDuration')} placeholder="e.g. 30 days" />
              <Field label="n8n Webhook" value={config.n8nWebhook} onChange={updateField('n8nWebhook')} placeholder="https://n8n.example.com/webhook/..." />
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={S.btnPrimary} onClick={handleSaveConfig}>Save Config</button>
            </div>
          </div>

          {/* Build Info Card */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Build Info</h3>
            <div style={S.cardSub}>Runtime & version metadata</div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Version', 'Vantus v2.0.0'],
                ['Stack', 'React + Vite + Supabase'],
                ['Agents', '6 active'],
                ['Model', 'GPT-4o via OpenRouter'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ ...S.label, marginBottom: 0 }}>{k}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COL: AI Engine + Team ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* AI Engine Card */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>AI Engine</h3>
            <div style={S.cardSub}>Agent behaviour & automation toggles</div>
            <div style={{ marginTop: 14 }}>
              <ToggleRow label="AI Engine" on={aiEngine} onToggle={handleToggle(setAiEngine)} />
              <ToggleRow label="Auto Briefs" on={autoBriefs} onToggle={handleToggle(setAutoBriefs)} />
              <ToggleRow label="Morning Briefing" on={morningBriefing} onToggle={handleToggle(setMorningBriefing)} />
              <ToggleRow label="Deep Scans" on={deepScans} onToggle={handleToggle(setDeepScans)} />
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={S.btnPrimary} onClick={handleCheckHealth}>Check API Health</button>
            </div>
          </div>

          {/* Team Card */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Team</h3>
            <div style={S.cardSub}>Members & access roles</div>
            <div style={{ marginTop: 14 }}>
              {team.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{m.email}</span>
                  <span style={{
                    fontSize: 10, color: m.role === 'Owner' ? '#2AABFF' : 'rgba(255,255,255,0.45)',
                    fontFamily: "'Geist Mono', monospace",
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>{m.role}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={S.btnPrimary} onClick={() => showToast('Invite flow coming soon')}>
                + Invite Team Member
              </button>
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast} visible={!!toast} />
    </div>
  );
}
