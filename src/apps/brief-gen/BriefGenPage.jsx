import React, { useState } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import Card from '../../ui/shared/Card.jsx';

export default function BriefGenPage({ onContentAdded }) {
  const isMobile = useIsMobile();
  const [brief, setBrief]         = useState('');
  const [campaign, setCampaign]   = useState('Drip Campaign');
  const [reels, setReels]         = useState(8);
  const [stories, setStories]     = useState(4);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);

  const run = async () => {
    if (!brief.trim() || brief.trim().length < 10) {
      setError('Brief is too short — add more detail about the content you need.');
      return;
    }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch('/api/agent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: 'Muse',
          action: 'muse_from_brief',
          payload: { brief, campaign, reels, stories },
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Agent action failed');
      setResult(d);
      if (onContentAdded) onContentAdded(d.items || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const S = {
    label: { fontSize: 9, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 6 },
    input: { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', transition: 'border-color 0.2s' },
    numInput: { width: 64, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif', textAlign: 'center' },
    btn: { background: loading ? 'rgba(42,171,255,0.15)' : '#2AABFF', border: 'none', borderRadius: 12, color: loading ? '#2AABFF' : '#fff', cursor: loading ? 'default' : 'pointer', padding: '12px 28px', fontSize: 13, fontWeight: 700, fontFamily: 'Inter, sans-serif', opacity: loading ? 0.8 : 1, display: 'flex', alignItems: 'center', gap: 8 },
  };

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight: 700, color: '#f5f5f7', marginBottom: 4, letterSpacing: -1 }}>
          Brief → Content
        </h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
          Paste your creative brief. Muse reads it and generates production-ready content ideas — saved straight to the tracker.
        </p>
      </div>

      {/* How it works */}
      <Card style={{ padding: '16px 20px', marginBottom: 24, background: 'rgba(42,171,255,0.04)', border: '1px solid rgba(42,171,255,0.12)' }}>
        <div style={{ display: 'flex', gap: isMobile ? 12 : 24, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {[
            { step: '01', label: 'Write Brief', desc: 'Describe the visual direction, locations, mood, campaign goals' },
            { step: '02', label: 'Muse Reads', desc: 'Agent generates titles, descriptions, director notes per item' },
            { step: '03', label: 'Saved to Tracker', desc: 'All items go straight into Content Tracker' },
            { step: '04', label: 'Scout Footage', desc: 'Head to ArtGrid Scout — your items are ready to scout' },
          ].map(s => (
            <div key={s.step} style={{ flex: isMobile ? '1 0 calc(50% - 6px)' : 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(42,171,255,0.6)', letterSpacing: 1.5, marginBottom: 4 }}>{s.step}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f7', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Brief input */}
      <Card style={{ padding: '22px 24px', marginBottom: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <label style={S.label}>Creative Brief</label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={`Example:\n\nWe need footage of water in nature — oceans, rivers, creeks, waterfalls. No people. Locations: Pacific coast, mountain streams, camping/van life settings. Mood: calm, cinematic, abundance. Slow motion preferred for hero shots. This is for a drip campaign launching April 2026.`}
            style={{ ...S.input, minHeight: 180, resize: 'vertical', lineHeight: 1.6 }}
            onFocus={e => e.target.style.borderColor = 'rgba(42,171,255,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 6 }}>
            {brief.length} chars — the more detail you give, the better the output
          </div>
        </div>

        {/* Config row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 22, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={S.label}>Campaign Name</label>
            <input
              value={campaign}
              onChange={e => setCampaign(e.target.value)}
              style={S.input}
              onFocus={e => e.target.style.borderColor = 'rgba(42,171,255,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>
          <div>
            <label style={S.label}>Reels</label>
            <input type="number" min={1} max={20} value={reels} onChange={e => setReels(Number(e.target.value))} style={S.numInput} />
          </div>
          <div>
            <label style={S.label}>Stories</label>
            <input type="number" min={0} max={20} value={stories} onChange={e => setStories(Number(e.target.value))} style={S.numInput} />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', paddingBottom: 11 }}>
            = {reels + stories} total items
          </div>
        </div>

        {/* Run button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={run} disabled={loading} style={S.btn}>
            {loading ? (
              <><div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2AABFF', animation: 'livePulse 1s infinite' }} /> Muse is writing…</>
            ) : '✍️ Generate Content Ideas'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2AABFF', animation: 'livePulse 2.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Muse · Ready</span>
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.2)', borderRadius: 12, marginBottom: 16, fontSize: 12, color: '#ff453a' }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && result.success && (
        <Card style={{ padding: '20px 24px', border: '1px solid rgba(42,171,255,0.2)', background: 'rgba(42,171,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#30d158' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#30d158' }}>{result.message}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Reels', count: (result.items || []).filter(i => i.format === 'Reel').length, color: '#2AABFF' },
              { label: 'Stories', count: (result.items || []).filter(i => i.format === 'Stories').length, color: '#bf5af2' },
              { label: 'Total Saved', count: result.savedCount, color: '#30d158' },
            ].map(m => (
              <div key={m.label} style={{ padding: '8px 16px', background: `${m.color}10`, border: `1px solid ${m.color}25`, borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.count}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: 1 }}>{m.label.toUpperCase()}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(result.items || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: item.format === 'Reel' ? '#2AABFF' : '#bf5af2', background: item.format === 'Reel' ? 'rgba(42,171,255,0.12)' : 'rgba(191,90,242,0.12)', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap', marginTop: 1 }}>
                  {item.format}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f7', marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{item.description}</div>
                  {item.notes && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontStyle: 'italic' }}>🎬 {item.notes}</div>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            ✅ All items saved to Content Tracker — head to <strong style={{ color: '#2AABFF' }}>ArtGrid Scout</strong> to generate footage queries for your Reels.
          </div>
        </Card>
      )}
    </div>
  );
}
