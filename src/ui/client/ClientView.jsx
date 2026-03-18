import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { sb } from '../../services/supabaseClient.js';
import { STATUS_COLOR, STATUSES, FORMATS, PILLARS_LIST, PLATFORMS_LIST, CAMPAIGNS } from '../../utils/constants.js';
import { VITAL_LYFE_SOP } from '../../data/seed.content.js';

// ── Theme Constants ──
const T = {
  bg: '#0d0907',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.06)',
  text: '#fff',
  textPrimary: '#f0eeef',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.35)',
  textFaint: 'rgba(255,255,255,0.25)',
  accent: '#2AABFF',
  hover: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.06)',
  shadow: 'rgba(0,0,0,0.3)',
};

const FONT = {
  heading: "'Instrument Serif', Georgia, serif",
  mono: "'Geist Mono', 'SF Mono', monospace",
  body: "'Inter', -apple-system, sans-serif",
};

// ── Status badge styling (dark theme) ──
function statusBadge(status) {
  const c = STATUS_COLOR[status] || '#999';
  return {
    fontSize: 10, fontWeight: 700, fontFamily: FONT.mono,
    color: c, background: `${c}18`, border: `1px solid ${c}30`,
    padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
    display: 'inline-block',
  };
}

// ── Tabs ──
const TABS = [
  'Content Tracker', 'Pillars', 'Count Tracker', 'Schedule Tracker',
  'Gantt Chart', 'Taxonomy Guide', 'SOPs',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Pillar colors ──
const PILLAR_COLORS = {
  Abundance: '#f59e0b', Access: '#3b82f6', Innovation: '#10b981',
  'Tierra Bomba': '#ef4444', 'Startup Diaries': '#8b5cf6',
  'Product Launch': '#ec4899', 'Meet the Makers': '#06b6d4',
};

// ── Format short codes ──
const FORMAT_SHORT = {
  'Reel': 'SHT', 'Graphics (IMG)': 'IMG', 'Carousel': 'CRS',
  'Thread': 'THD', 'Story': 'STY', 'YouTube': 'YTB', 'Short': 'SHT',
};

// ── Helper: weeks for schedule/gantt ──
function getWeeks(count = 8) {
  const weeks = [];
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay() + 1); // Monday
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    weeks.push({ num: i + 1, label: `W${i + 1}`, date: d });
  }
  return weeks;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function ClientView({ user, content, setContent, onSignOut, isPreview }) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('Content Tracker');
  const [viewMode, setViewMode] = useState('card'); // card | list
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterFormat, setFilterFormat] = useState('All');
  const [filterPillar, setFilterPillar] = useState('All');
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [filterCampaign, setFilterCampaign] = useState('All');
  const [expandedCard, setExpandedCard] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showScrapped, setShowScrapped] = useState(false);
  const [showFlow, setShowFlow] = useState(false);
  const [showAskFlow, setShowAskFlow] = useState(false);
  const [flowMessages, setFlowMessages] = useState([]);
  const [flowInput, setFlowInput] = useState('');
  const [flowLoading, setFlowLoading] = useState(false);
  const [askFlowMessages, setAskFlowMessages] = useState([]);
  const [askFlowInput, setAskFlowInput] = useState('');
  const [askFlowLoading, setAskFlowLoading] = useState(false);
  const flowEndRef = useRef(null);
  const askFlowEndRef = useRef(null);

  // ── Derived data ──
  const items = useMemo(() => {
    return (content || []).map(c => ({
      ...c,
      platforms: c.platforms || [],
      videoCopy: c.videoCopy || c.script || '',
    }));
  }, [content]);

  const activeItems = useMemo(() => items.filter(x => x.status !== 'Scrapped'), [items]);
  const scrappedItems = useMemo(() => items.filter(x => x.status === 'Scrapped'), [items]);

  const filtered = useMemo(() => {
    let list = showScrapped ? scrappedItems : activeItems;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(x =>
        (x.title || '').toLowerCase().includes(q) ||
        (x.campaign || '').toLowerCase().includes(q) ||
        (x.description || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'All') list = list.filter(x => x.status === filterStatus);
    if (filterFormat !== 'All') list = list.filter(x => x.format === filterFormat);
    if (filterPillar !== 'All') list = list.filter(x => x.pillar === filterPillar);
    if (filterPlatform !== 'All') list = list.filter(x => (x.platforms || []).includes(filterPlatform));
    if (filterCampaign !== 'All') list = list.filter(x => x.campaign === filterCampaign);
    return list;
  }, [activeItems, scrappedItems, showScrapped, search, filterStatus, filterFormat, filterPillar, filterPlatform, filterCampaign]);

  // ── Update helper ──
  const updateItem = async (item, changes) => {
    const updated = { ...item, ...changes };
    setContent(prev => prev.map(x => x.id === item.id ? updated : x));
    await sb.from('content_items').update(changes).eq('id', item.id);
  };

  // ── AI Chat helpers ──
  const callAI = async (system, messages, setMessages, setLoading) => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system,
          messages,
        }),
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || data?.choices?.[0]?.message?.content || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + e.message }]);
    }
    setLoading(false);
  };

  const sendFlow = () => {
    if (!flowInput.trim()) return;
    const msg = { role: 'user', content: flowInput };
    const updated = [...flowMessages, msg];
    setFlowMessages(updated);
    setFlowInput('');
    const sys = `You are The Flow, a creative content strategist AI for VitalLyfe. You help brainstorm content ideas, refine captions, suggest hooks, and optimize content strategy. Be creative, concise, and on-brand. Current content items: ${JSON.stringify(items.slice(0, 10).map(x => ({ title: x.title, status: x.status, pillar: x.pillar })))}`;
    callAI(sys, updated, setFlowMessages, setFlowLoading);
  };

  const sendAskFlow = () => {
    if (!askFlowInput.trim()) return;
    const msg = { role: 'user', content: askFlowInput };
    const updated = [...askFlowMessages, msg];
    setAskFlowMessages(updated);
    setAskFlowInput('');
    const sys = `You are Ask Flow, an analytical AI assistant for VitalLyfe's content tracker. You answer questions about the content pipeline, statuses, schedules, and provide data-driven insights. Current content summary: ${items.length} total items, ${activeItems.length} active. Status breakdown: ${JSON.stringify(STATUSES.map(s => ({ status: s, count: items.filter(x => x.status === s).length })))}`;
    callAI(sys, updated, setAskFlowMessages, setAskFlowLoading);
  };

  useEffect(() => { flowEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [flowMessages]);
  useEffect(() => { askFlowEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [askFlowMessages]);

  // ── Status counts ──
  const statusCounts = useMemo(() => {
    const counts = {};
    STATUSES.forEach(s => { counts[s] = activeItems.filter(x => x.status === s).length; });
    return counts;
  }, [activeItems]);

  // ── Pillar counts ──
  const pillarCounts = useMemo(() => {
    const counts = {};
    PILLARS_LIST.forEach(p => { counts[p] = activeItems.filter(x => x.pillar === p).length; });
    return counts;
  }, [activeItems]);

  // ── Weeks ──
  const weeks = useMemo(() => getWeeks(8), []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  RENDER HELPERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── Content Card ──
  const renderCard = (item) => {
    const isExpanded = expandedCard === item.id;
    const c = STATUS_COLOR[item.status] || '#999';
    const pillarC = PILLAR_COLORS[item.pillar] || '#888';
    return (
      <div key={item.id} style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s',
        borderLeft: `3px solid ${c}`,
      }} onClick={() => setExpandedCard(isExpanded ? null : item.id)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontFamily: FONT.mono, color: pillarC, background: `${pillarC}15`, padding: '2px 8px', borderRadius: 10 }}>{item.pillar}</span>
              <span style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted }}>{item.campaign}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: FONT.body, marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.4 }}>{item.description?.substring(0, 120)}{item.description?.length > 120 ? '...' : ''}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <span style={statusBadge(item.status)}>{item.status}</span>
            <span style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted }}>{item.format}{FORMAT_SHORT[item.format] ? ` (${FORMAT_SHORT[item.format]})` : ''}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {(item.platforms || []).map(p => (
                <span key={p} style={{ fontSize: 8, fontFamily: FONT.mono, color: T.textFaint, background: T.inputBg, padding: '1px 5px', borderRadius: 4 }}>{p}</span>
              ))}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
            {item.videoCopy && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Script / Video Copy</div>
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: T.inputBg, padding: 12, borderRadius: 8 }}>{item.videoCopy}</div>
              </div>
            )}
            {item.caption && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Caption</div>
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5 }}>{item.caption}</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {item.cta && <div><div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 2 }}>CTA</div><div style={{ fontSize: 11, color: T.textSecondary }}>{item.cta}</div></div>}
              {item.seoKeywords && <div><div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 2 }}>SEO Keywords</div><div style={{ fontSize: 11, color: T.textSecondary }}>{item.seoKeywords}</div></div>}
              {item.hashtags && <div><div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 2 }}>Hashtags</div><div style={{ fontSize: 11, color: T.accent }}>{item.hashtags}</div></div>}
              {item.notes && <div><div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 2 }}>Notes</div><div style={{ fontSize: 11, color: T.textSecondary }}>{item.notes}</div></div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select value={item.status} onChange={e => { e.stopPropagation(); updateItem(item, { status: e.target.value, stage: e.target.value }); }}
                onClick={e => e.stopPropagation()}
                style={{ fontSize: 11, fontFamily: FONT.mono, background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', outline: 'none' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={e => { e.stopPropagation(); setEditingItem(item); setEditDraft({ ...item }); }}
                style={{ fontSize: 11, fontFamily: FONT.mono, color: T.accent, background: `${T.accent}15`, border: `1px solid ${T.accent}30`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Content List Row ──
  const renderListRow = (item, i) => {
    const c = STATUS_COLOR[item.status] || '#999';
    return (
      <div key={item.id} style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '2fr 1fr 1fr auto auto',
        alignItems: 'center', gap: 12, padding: '12px 16px',
        borderBottom: `1px solid ${T.border}`, cursor: 'pointer',
        transition: 'background 0.15s',
      }}
        onClick={() => setExpandedCard(expandedCard === item.id ? null : item.id)}
        onMouseEnter={e => e.currentTarget.style.background = T.hover}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{item.title}</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{item.campaign} {'\u00B7'} {item.format}</div>
        </div>
        {!isMobile && <>
          <span style={{ fontSize: 10, fontFamily: FONT.mono, color: T.textMuted }}>{item.pillar}</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {(item.platforms || []).map(p => (
              <span key={p} style={{ fontSize: 8, fontFamily: FONT.mono, color: T.textFaint, background: T.inputBg, padding: '1px 5px', borderRadius: 4 }}>{p}</span>
            ))}
          </div>
        </>}
        <span style={statusBadge(item.status)}>{item.status}</span>
        <button onClick={e => { e.stopPropagation(); setEditingItem(item); setEditDraft({ ...item }); }}
          style={{ fontSize: 10, fontFamily: FONT.mono, color: T.accent, background: 'transparent', border: `1px solid ${T.accent}30`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
          Edit
        </button>
      </div>
    );
  };

  // ── Edit Modal ──
  const renderEditModal = () => {
    if (!editingItem || !editDraft) return null;
    const field = (label, key, textarea) => (
      <div key={key} style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>{label}</label>
        {textarea ? (
          <textarea value={editDraft[key] || ''} onChange={e => setEditDraft(d => ({ ...d, [key]: e.target.value }))}
            style={{ width: '100%', background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: FONT.body, minHeight: 80, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
        ) : (
          <input value={editDraft[key] || ''} onChange={e => setEditDraft(d => ({ ...d, [key]: e.target.value }))}
            style={{ width: '100%', background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: FONT.body, outline: 'none', boxSizing: 'border-box' }} />
        )}
      </div>
    );
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={() => { setEditingItem(null); setEditDraft(null); }}>
        <div style={{ background: '#1a1714', border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, margin: 0 }}>Edit Content</h3>
            <button onClick={() => { setEditingItem(null); setEditDraft(null); }}
              style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 20, cursor: 'pointer' }}>{'\u00D7'}</button>
          </div>
          {field('Title', 'title')}
          {field('Description', 'description', true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Status</label>
              <select value={editDraft.status || ''} onChange={e => setEditDraft(d => ({ ...d, status: e.target.value, stage: e.target.value }))}
                style={{ width: '100%', background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: FONT.mono, outline: 'none' }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Format</label>
              <select value={editDraft.format || ''} onChange={e => setEditDraft(d => ({ ...d, format: e.target.value }))}
                style={{ width: '100%', background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: FONT.mono, outline: 'none' }}>
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Pillar</label>
              <select value={editDraft.pillar || ''} onChange={e => setEditDraft(d => ({ ...d, pillar: e.target.value }))}
                style={{ width: '100%', background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: FONT.mono, outline: 'none' }}>
                {PILLARS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Campaign</label>
              <select value={editDraft.campaign || ''} onChange={e => setEditDraft(d => ({ ...d, campaign: e.target.value }))}
                style={{ width: '100%', background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: FONT.mono, outline: 'none' }}>
                {CAMPAIGNS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {field('Caption', 'caption', true)}
          {field('Script / Video Copy', 'script', true)}
          {field('CTA', 'cta')}
          {field('SEO Keywords', 'seoKeywords')}
          {field('Hashtags', 'hashtags')}
          {field('Notes', 'notes', true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('Start Week', 'startWeek')}
            {field('Duration (weeks)', 'duration')}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={async () => {
              const changes = { ...editDraft };
              delete changes.videoCopy; // use script field
              await updateItem(editingItem, changes);
              setEditingItem(null); setEditDraft(null);
            }}
              style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#fff', background: T.accent, border: 'none', borderRadius: 10, padding: '10px 0', cursor: 'pointer', fontFamily: FONT.body }}>
              Save Changes
            </button>
            <button onClick={() => { setEditingItem(null); setEditDraft(null); }}
              style={{ fontSize: 13, color: T.textMuted, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: FONT.body }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TAB: CONTENT TRACKER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderContentTracker = () => (
    <div>
      {/* Filters bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search content..."
          style={{ flex: isMobile ? '1 1 100%' : '0 1 220px', background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: FONT.body, outline: 'none' }} />
        {[
          ['Status', filterStatus, setFilterStatus, ['All', ...STATUSES]],
          ['Format', filterFormat, setFilterFormat, ['All', ...FORMATS]],
          ['Pillar', filterPillar, setFilterPillar, ['All', ...PILLARS_LIST]],
          ['Platform', filterPlatform, setFilterPlatform, ['All', ...PLATFORMS_LIST]],
          ['Campaign', filterCampaign, setFilterCampaign, ['All', ...CAMPAIGNS]],
        ].map(([label, val, setter, opts]) => (
          <select key={label} value={val} onChange={e => setter(e.target.value)}
            style={{ background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 11, fontFamily: FONT.mono, outline: 'none', cursor: 'pointer' }}>
            {opts.map(o => <option key={o} value={o}>{o === 'All' ? `All ${label}s` : o}</option>)}
          </select>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['card', 'list'].map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{ fontSize: 10, fontFamily: FONT.mono, color: viewMode === m ? T.accent : T.textMuted, background: viewMode === m ? `${T.accent}15` : 'transparent', border: `1px solid ${viewMode === m ? `${T.accent}30` : T.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', textTransform: 'uppercase' }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Scrapped toggle */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setShowScrapped(false)}
          style={{ fontSize: 11, fontFamily: FONT.mono, color: !showScrapped ? T.accent : T.textMuted, background: !showScrapped ? `${T.accent}15` : 'transparent', border: `1px solid ${!showScrapped ? `${T.accent}30` : T.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
          Active ({activeItems.length})
        </button>
        <button onClick={() => setShowScrapped(true)}
          style={{ fontSize: 11, fontFamily: FONT.mono, color: showScrapped ? '#ff453a' : T.textMuted, background: showScrapped ? 'rgba(255,69,58,0.1)' : 'transparent', border: `1px solid ${showScrapped ? 'rgba(255,69,58,0.2)' : T.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
          Scrapped ({scrappedItems.length})
        </button>
      </div>

      {/* Content items */}
      {viewMode === 'card' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(renderCard)}
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* List header */}
          {!isMobile && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, background: T.hover }}>
              {['Title', 'Pillar', 'Platforms', 'Status', ''].map(h => (
                <span key={h} style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</span>
              ))}
            </div>
          )}
          {filtered.map(renderListRow)}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: T.textMuted, fontFamily: FONT.mono, fontSize: 12 }}>
          No content found matching your filters.
        </div>
      )}
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TAB: PILLARS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderPillars = () => (
    <div>
      <h2 style={{ fontSize: 22, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, marginBottom: 20 }}>Content Pillars</h2>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {PILLARS_LIST.map(pillar => {
          const c = PILLAR_COLORS[pillar] || '#888';
          const pillarItems = activeItems.filter(x => x.pillar === pillar);
          const statusBreak = STATUSES.reduce((a, s) => { const n = pillarItems.filter(x => x.status === s).length; if (n > 0) a.push({ s, n }); return a; }, []);
          return (
            <div key={pillar} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', borderTop: `3px solid ${c}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT.body }}>{pillar}</div>
                <span style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: FONT.mono }}>{pillarItems.length}</span>
              </div>
              {/* Status breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {statusBreak.map(({ s, n }) => (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: T.textSecondary }}>{s}</span>
                    <span style={{ fontSize: 10, fontFamily: FONT.mono, color: STATUS_COLOR[s] }}>{n}</span>
                  </div>
                ))}
              </div>
              {/* Content list */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                {pillarItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ fontSize: 11, color: T.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{item.title}</span>
                    <span style={statusBadge(item.status)}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TAB: COUNT TRACKER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderCountTracker = () => {
    const formatCounts = FORMATS.reduce((a, f) => { a[f] = activeItems.filter(x => x.format === f).length; return a; }, {});
    const platformCounts = PLATFORMS_LIST.reduce((a, p) => { a[p] = activeItems.filter(x => (x.platforms || []).includes(p)).length; return a; }, {});
    const campaignCounts = CAMPAIGNS.reduce((a, c) => { a[c] = activeItems.filter(x => x.campaign === c).length; return a; }, {});
    const maxCount = Math.max(...Object.values(statusCounts), 1);

    return (
      <div>
        <h2 style={{ fontSize: 22, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, marginBottom: 20 }}>Count Tracker</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
          {/* By Status */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>By Status</div>
            {STATUSES.filter(s => s !== 'Scrapped').map(s => {
              const count = statusCounts[s] || 0;
              const pct = (count / maxCount) * 100;
              return (
                <div key={s} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: T.textSecondary }}>{s}</span>
                    <span style={{ fontSize: 11, fontFamily: FONT.mono, color: STATUS_COLOR[s] }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: T.inputBg, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLOR[s], borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* By Format */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>By Format</div>
            {FORMATS.map(f => {
              const count = formatCounts[f] || 0;
              return (
                <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{f}</span>
                  <span style={{ fontSize: 13, fontFamily: FONT.mono, fontWeight: 700, color: T.text }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* By Platform */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>By Platform</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {PLATFORMS_LIST.map(p => {
                const count = platformCounts[p] || 0;
                return (
                  <div key={p} style={{ background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 18px', textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT.mono, color: T.accent }}>{count}</div>
                    <div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginTop: 2 }}>{p}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Campaign */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>By Campaign</div>
            {CAMPAIGNS.map(c => {
              const count = campaignCounts[c] || 0;
              return (
                <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{c}</span>
                  <span style={{ fontSize: 13, fontFamily: FONT.mono, fontWeight: 700, color: T.text }}>{count}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Total Active</span>
              <span style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: T.accent }}>{activeItems.length}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TAB: SCHEDULE TRACKER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderScheduleTracker = () => {
    const scheduled = activeItems.filter(x => ['Scheduled', 'Ready For Schedule'].includes(x.status));
    return (
      <div>
        <h2 style={{ fontSize: 22, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, marginBottom: 20 }}>Schedule Tracker</h2>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 8, marginBottom: 20 }}>
          {weeks.map(w => (
            <div key={w.num} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontFamily: FONT.mono, fontWeight: 700, color: T.accent }}>{w.label}</div>
              <div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, marginTop: 2 }}>
                {w.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
        {/* Schedule rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scheduled.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, fontFamily: FONT.mono, fontSize: 12 }}>
              No scheduled or ready-to-schedule content.
            </div>
          )}
          {scheduled.map(item => {
            const sw = item.startWeek || 1;
            const dur = item.duration || 1;
            const c = STATUS_COLOR[item.status] || '#999';
            return (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 8 }}>
                {weeks.map(w => {
                  const inRange = w.num >= sw && w.num < sw + dur;
                  return (
                    <div key={w.num} style={{
                      background: inRange ? `${c}20` : 'transparent',
                      border: `1px solid ${inRange ? `${c}40` : T.border}`,
                      borderRadius: 8, padding: '8px 6px', minHeight: 44,
                    }}>
                      {w.num === sw && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: 8, fontFamily: FONT.mono, color: T.textMuted, marginTop: 2 }}>{item.format}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TAB: GANTT CHART
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderGantt = () => (
    <div>
      <h2 style={{ fontSize: 22, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, marginBottom: 20 }}>Gantt Chart</h2>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 700 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${weeks.length}, 1fr)`, gap: 0, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>Content</div>
            {weeks.map(w => (
              <div key={w.num} style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textAlign: 'center' }}>{w.label}</div>
            ))}
          </div>
          {/* Rows */}
          {activeItems.map(item => {
            const sw = item.startWeek || 1;
            const dur = item.duration || 1;
            const c = STATUS_COLOR[item.status] || '#999';
            return (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: `200px repeat(${weeks.length}, 1fr)`, gap: 0, alignItems: 'center', borderBottom: `1px solid ${T.border}`, padding: '4px 0' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  <span style={{ fontSize: 11, color: T.textSecondary }}>{item.title}</span>
                </div>
                {weeks.map(w => {
                  const inRange = w.num >= sw && w.num < sw + dur;
                  return (
                    <div key={w.num} style={{ padding: '2px 1px' }}>
                      {inRange && (
                        <div style={{ height: 18, background: `${c}40`, borderRadius: 4, border: `1px solid ${c}60` }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TAB: TAXONOMY GUIDE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderTaxonomy = () => (
    <div>
      <h2 style={{ fontSize: 22, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, marginBottom: 6 }}>Taxonomy Guide</h2>
      <p style={{ fontSize: 12, color: T.textMuted, fontFamily: FONT.body, marginBottom: 24 }}>Reference guide for all content classification categories used in this tracker.</p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Statuses */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Statuses</div>
          {STATUSES.map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[s], flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.textSecondary }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Formats */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Formats</div>
          {FORMATS.map(f => (
            <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 12, color: T.textSecondary }}>{f}</span>
              <span style={{ fontSize: 10, fontFamily: FONT.mono, color: T.textMuted }}>{FORMAT_SHORT[f] || '-'}</span>
            </div>
          ))}
        </div>

        {/* Pillars */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Content Pillars</div>
          {PILLARS_LIST.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PILLAR_COLORS[p] || '#888', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.textSecondary }}>{p}</span>
            </div>
          ))}
        </div>

        {/* Platforms */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Platforms</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PLATFORMS_LIST.map(p => (
              <span key={p} style={{ fontSize: 11, fontFamily: FONT.mono, color: T.textSecondary, background: T.inputBg, border: `1px solid ${T.border}`, padding: '6px 14px', borderRadius: 8 }}>{p}</span>
            ))}
          </div>
          <div style={{ fontSize: 13, fontFamily: FONT.mono, color: T.textMuted, marginTop: 20, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Campaigns</div>
          {CAMPAIGNS.map(c => (
            <div key={c} style={{ padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 12, color: T.textSecondary }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TAB: SOPs
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderSOPs = () => {
    const sop = VITAL_LYFE_SOP;
    return (
      <div>
        <h2 style={{ fontSize: 22, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, marginBottom: 4 }}>{sop.title}</h2>
        <p style={{ fontSize: 12, color: T.textMuted, fontFamily: FONT.mono, marginBottom: 24 }}>{sop.subtitle} {'\u00B7'} {sop.version}</p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sop.steps.map((step, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${T.accent}15`, border: `1px solid ${T.accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: T.accent }}>{step.num}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontFamily: FONT.mono, color: T.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{step.phase}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>{step.title}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>{step.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {step.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, background: T.inputBg, padding: '2px 8px', borderRadius: 6 }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tools & Platforms */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 14, marginTop: 24 }}>
          {[
            ['Tools', sop.tools],
            ['Platforms', sop.platforms],
            ['Content Pillars', sop.contentPillars],
          ].map(([label, items]) => (
            <div key={label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(item => (
                  <span key={item} style={{ fontSize: 10, fontFamily: FONT.mono, color: T.textSecondary, background: T.inputBg, padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.border}` }}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  AI PANELS: The Flow & Ask Flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const renderChatPanel = (show, setShow, messages, input, setInput, loading, sendFn, endRef, title, accent, placeholder) => {
    if (!show) return null;
    return (
      <div style={{
        position: 'fixed', bottom: 80, right: 20, width: 380, maxHeight: '60vh',
        background: '#1a1714', border: `1px solid ${T.border}`, borderRadius: 16,
        boxShadow: `0 8px 32px ${T.shadow}`, display: 'flex', flexDirection: 'column',
        zIndex: 9999, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${T.border}`, background: `${accent}08` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT.body }}>{title}</span>
          <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 18, cursor: 'pointer' }}>{'\u00D7'}</button>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200, maxHeight: 340 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: T.textMuted, fontSize: 12, fontFamily: FONT.mono }}>
              Start a conversation with {title}...
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
              background: m.role === 'user' ? `${accent}20` : T.card,
              border: `1px solid ${m.role === 'user' ? `${accent}30` : T.border}`,
            }}>
              <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: T.card, border: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 12, color: T.textMuted, fontFamily: FONT.mono }}>Thinking...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
        {/* Input */}
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFn(); } }}
            placeholder={placeholder}
            style={{ flex: 1, background: T.inputBg, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: FONT.body, outline: 'none' }} />
          <button onClick={sendFn} disabled={loading}
            style={{ background: accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: FONT.body }}>
            Send
          </button>
        </div>
      </div>
    );
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  MAIN RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONT.body, color: T.text }}>

      {/* ── HEADER ── */}
      <div style={{
        height: 56, background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14,
        position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 18, fontFamily: FONT.heading, fontStyle: 'italic', color: T.text, letterSpacing: -0.5 }}>Vantus</span>
          <span style={{ fontSize: 9, fontFamily: FONT.mono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 }}>Content Tracker</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontFamily: FONT.mono, color: T.textMuted }}>{isPreview ? 'client@vitallyfe.com' : user?.email}</span>
          {!isPreview && (
            <button onClick={onSignOut}
              style={{ fontSize: 11, color: T.textMuted, background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: FONT.mono }}>
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* ── STATUS SUMMARY CARDS ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {[
            ['Total Active', activeItems.length, T.accent],
            ['In Progress', statusCounts['Ready For Copy Creation'] + statusCounts['Ready For Content Creation'], '#f59e0b'],
            ['Needs Review', statusCounts['Need Copy Approval'] + statusCounts['Need Content Approval'], '#ff453a'],
            ['Scheduled', statusCounts['Scheduled'], '#64d2ff'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: isMobile ? '14px 12px' : '18px 20px' }}>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, fontFamily: FONT.mono, color, letterSpacing: -1 }}>{val}</div>
              <div style={{ fontSize: isMobile ? 8 : 10, fontFamily: FONT.mono, color: T.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TAB NAV ── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px',
        display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 24,
        overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              fontSize: 11, fontFamily: FONT.mono, color: tab === t ? T.accent : T.textMuted,
              background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${T.accent}` : '2px solid transparent',
              padding: '10px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 120px' }}>
        {tab === 'Content Tracker' && renderContentTracker()}
        {tab === 'Pillars' && renderPillars()}
        {tab === 'Count Tracker' && renderCountTracker()}
        {tab === 'Schedule Tracker' && renderScheduleTracker()}
        {tab === 'Gantt Chart' && renderGantt()}
        {tab === 'Taxonomy Guide' && renderTaxonomy()}
        {tab === 'SOPs' && renderSOPs()}
      </div>

      {/* ── BOTTOM MONTH BAR ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 44,
        background: 'rgba(13,9,7,0.95)', borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
        zIndex: 100, backdropFilter: 'blur(20px)',
      }}>
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => setSelectedMonth(i)}
            style={{
              fontSize: 10, fontFamily: FONT.mono,
              color: selectedMonth === i ? T.accent : T.textMuted,
              background: selectedMonth === i ? `${T.accent}12` : 'transparent',
              border: 'none', padding: '6px 12px', cursor: 'pointer',
              borderRadius: 6,
            }}>
            {m}
          </button>
        ))}
      </div>

      {/* ── AI FLOATING BUTTONS ── */}
      <div style={{ position: 'fixed', bottom: 54, right: 20, display: 'flex', gap: 8, zIndex: 9998 }}>
        <button onClick={() => { setShowFlow(!showFlow); setShowAskFlow(false); }}
          style={{
            fontSize: 11, fontWeight: 700, fontFamily: FONT.body,
            color: showFlow ? '#fff' : T.accent, background: showFlow ? T.accent : `${T.accent}15`,
            border: `1px solid ${T.accent}40`, borderRadius: 24, padding: '8px 18px',
            cursor: 'pointer', boxShadow: `0 4px 16px ${T.shadow}`,
          }}>
          The Flow
        </button>
        <button onClick={() => { setShowAskFlow(!showAskFlow); setShowFlow(false); }}
          style={{
            fontSize: 11, fontWeight: 700, fontFamily: FONT.body,
            color: showAskFlow ? '#fff' : '#10b981', background: showAskFlow ? '#10b981' : 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.4)', borderRadius: 24, padding: '8px 18px',
            cursor: 'pointer', boxShadow: `0 4px 16px ${T.shadow}`,
          }}>
          Ask Flow
        </button>
      </div>

      {/* ── AI CHAT PANELS ── */}
      {renderChatPanel(showFlow, setShowFlow, flowMessages, flowInput, setFlowInput, flowLoading, sendFlow, flowEndRef, 'The Flow', T.accent, 'Ask The Flow for content ideas...')}
      {renderChatPanel(showAskFlow, setShowAskFlow, askFlowMessages, askFlowInput, setAskFlowInput, askFlowLoading, sendAskFlow, askFlowEndRef, 'Ask Flow', '#10b981', 'Ask about your content pipeline...')}

      {/* ── EDIT MODAL ── */}
      {renderEditModal()}
    </div>
  );
}
