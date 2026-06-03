import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '../../services/supabaseClient.js';

// Visual language carried from Cloud Scenic OS analytics page:
// gold accent stat cards, purple area chart, dark gradient cards.
// Adapted to show CONTENT metrics across all connected platforms
// (Instagram live; TikTok / YouTube / LinkedIn slot in when wired).

// Baby-blue family — varied shades so platforms are still distinguishable
// but the whole page stays cohesive on one color.
const PLATFORM_META = {
  instagram: { label: 'Instagram', dot: '#7DD3FC', short: 'IG' },  // sky-300
  tiktok:    { label: 'TikTok',    dot: '#38BDF8', short: 'TT' },  // sky-400
  youtube:   { label: 'YouTube',   dot: '#0EA5E9', short: 'YT' },  // sky-500
  linkedin:  { label: 'LinkedIn',  dot: '#0284C7', short: 'LI' },  // sky-600
};

const CHART_METRICS = [
  { id: 'reach',           label: 'Reach' },
  { id: 'engagement',      label: 'Engagement' },
  { id: 'engagement_rate', label: 'Rate' },
  { id: 'posts',           label: 'Posts' },
];

function fmtNumber(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}

function fmtRate(r) {
  if (r == null || isNaN(r)) return '—';
  return (r * 100).toFixed(1) + '%';
}

function fmtDate(s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString([], opts);
}

// Bucket posts by week → returns [{ weekStart, count, reach, engagement, engagement_rate }]
function bucketByWeek(posts) {
  if (!posts.length) return [];
  const buckets = new Map();
  for (const p of posts) {
    if (!p.posted_at) continue;
    const d = new Date(p.posted_at);
    // Get Monday of that week
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString().slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, {
        weekStart: monday,
        count: 0,
        reach: 0,
        engagement: 0,
        rates: [],
      });
    }
    const b = buckets.get(key);
    b.count += 1;
    b.reach += (p.metrics?.reach || 0);
    const eng = (p.metrics?.likes || 0) + (p.metrics?.comments || 0) + (p.metrics?.saved || 0) + (p.metrics?.shares || 0);
    b.engagement += eng;
    if (p.metrics?.engagement_rate != null) b.rates.push(p.metrics.engagement_rate);
  }
  const arr = Array.from(buckets.values()).sort((a, b) => a.weekStart - b.weekStart);
  for (const b of arr) {
    b.engagement_rate = b.rates.length ? b.rates.reduce((s, r) => s + r, 0) / b.rates.length : 0;
    b.posts = b.count;
    delete b.rates;
  }
  return arr;
}

export default function AnalyticsRoute() {
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [enabledPlatforms, setEnabledPlatforms] = useState({}); // { instagram: true, ... }
  const [chartMetric, setChartMetric] = useState('reach');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncBusy, setSyncBusy] = useState({});
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await sb.auth.getSession();
      const [accountsRes, postsRes] = await Promise.all([
        sb.from('connected_accounts')
          .select('id,platform,handle,display_name,avatar_url,fetched_at,meta')
          .order('created_at', { ascending: false }),
        sb.from('account_posts')
          .select('id,account_id,platform_post_id,posted_at,media_type,caption,permalink,thumbnail_url,metrics')
          .order('posted_at', { ascending: false })
          .limit(500),
      ]);
      if (accountsRes.error) throw accountsRes.error;
      if (postsRes.error) throw postsRes.error;
      setAccounts(accountsRes.data || []);
      setPosts(postsRes.data || []);
      const present = new Set((accountsRes.data || []).map(a => a.platform));
      const init = {};
      for (const p of Object.keys(PLATFORM_META)) init[p] = present.has(p);
      setEnabledPlatforms(prev => Object.keys(prev).length ? prev : init);
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when posts table changes
  useEffect(() => {
    const ch = sb.channel('account_posts_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_posts' }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [load]);

  // Sync all connected accounts
  const syncAll = async () => {
    const connected = accounts.filter(a => a.platform === 'instagram'); // others: when wired
    for (const a of connected) {
      setSyncBusy(b => ({ ...b, [a.id]: true }));
    }
    try {
      await Promise.all(connected.map(async (a) => {
        const { data: { session } } = await sb.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`/api/sync/${a.platform}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ accountId: a.id }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `${a.platform} sync ${res.status}`);
        }
      }));
      await load();
    } catch (e) {
      setError(e.message || 'Sync failed');
    } finally {
      setSyncBusy({});
    }
  };

  // Map account_id → platform for filtering posts by platform
  const accountPlatform = useMemo(() => {
    const m = {};
    for (const a of accounts) m[a.id] = a.platform;
    return m;
  }, [accounts]);

  // Filter posts by enabled platforms
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      const platform = accountPlatform[p.account_id];
      if (!platform) return false;
      return enabledPlatforms[platform] !== false;
    });
  }, [posts, accountPlatform, enabledPlatforms]);

  // Stat-card values across filteredPosts
  const stats = useMemo(() => {
    const reach = filteredPosts.reduce((s, p) => s + (p.metrics?.reach || 0), 0);
    const likes = filteredPosts.reduce((s, p) => s + (p.metrics?.likes || 0), 0);
    const comments = filteredPosts.reduce((s, p) => s + (p.metrics?.comments || 0), 0);
    const saved = filteredPosts.reduce((s, p) => s + (p.metrics?.saved || 0), 0);
    const shares = filteredPosts.reduce((s, p) => s + (p.metrics?.shares || 0), 0);
    const engagement = likes + comments + saved + shares;
    const rates = filteredPosts.map(p => p.metrics?.engagement_rate).filter(r => r != null);
    const avgRate = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null;

    // Per-platform totals (for the breakdown card)
    const byPlatform = {};
    for (const p of filteredPosts) {
      const plat = accountPlatform[p.account_id];
      if (!plat) continue;
      if (!byPlatform[plat]) byPlatform[plat] = { reach: 0, engagement: 0, posts: 0 };
      byPlatform[plat].reach += (p.metrics?.reach || 0);
      byPlatform[plat].engagement += (p.metrics?.likes || 0) + (p.metrics?.comments || 0) + (p.metrics?.saved || 0) + (p.metrics?.shares || 0);
      byPlatform[plat].posts += 1;
    }
    // Top platform by reach
    const topPlatform = Object.entries(byPlatform).sort((a, b) => b[1].reach - a[1].reach)[0]?.[0] || null;

    return {
      reach, likes, comments, engagement,
      avgRate,
      posts: filteredPosts.length,
      byPlatform,
      topPlatform,
    };
  }, [filteredPosts, accountPlatform]);

  // Chart series: bucket by week, value = the selected metric
  const chartSeries = useMemo(() => {
    const weeks = bucketByWeek(filteredPosts);
    return weeks.map(w => ({
      x: w.weekStart,
      y: w[chartMetric] ?? 0,
      label: fmtDate(w.weekStart, { month: 'short', day: 'numeric' }),
    }));
  }, [filteredPosts, chartMetric]);

  // SVG path for the area chart
  const chartPath = useMemo(() => {
    if (chartSeries.length === 0) return { area: '', line: '', maxY: 0 };
    const W = 800, H = 120;
    const maxY = Math.max(...chartSeries.map(s => s.y), 1);
    const step = chartSeries.length > 1 ? W / (chartSeries.length - 1) : 0;
    const points = chartSeries.map((s, i) => {
      const x = chartSeries.length > 1 ? i * step : W / 2;
      const y = H - (s.y / maxY) * (H - 10) - 4;
      return { x, y };
    });
    const lineD = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');
    const areaD = `${lineD} L ${points[points.length - 1].x},${H} L ${points[0].x},${H} Z`;
    return { area: areaD, line: lineD, maxY };
  }, [chartSeries]);

  const topPerformers = useMemo(() => {
    return [...filteredPosts]
      .sort((a, b) => (b.metrics?.engagement_rate || 0) - (a.metrics?.engagement_rate || 0))
      .slice(0, 5);
  }, [filteredPosts]);

  const tablePosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredPosts;
    return filteredPosts.filter(p =>
      (p.caption || '').toLowerCase().includes(q) ||
      accountPlatform[p.account_id]?.toLowerCase().includes(q)
    );
  }, [filteredPosts, accountPlatform, search]);

  // ── render ────────────────────────────────────────────────────────────────

  // Single accent palette — baby blue. Page is monochrome on this color.
  const BLUE = '#7DD3FC';
  const BLUE_DIM = 'rgba(125,211,252,0.7)';
  const BLUE_BG = 'rgba(125,211,252,0.12)';
  const BLUE_BORDER = 'rgba(125,211,252,0.25)';

  const statCard = (label, value, delta, accent = BLUE) => (
    <div style={{
      background: 'linear-gradient(135deg,#0e1416 0%,#0a1014 100%)',
      border: `1px solid rgba(125,211,252,0.15)`,
      borderRadius: 14, padding: 18,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 10,
      }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 11, color: accent, marginTop: 8, fontWeight: 600 }}>{delta}</div>
      )}
    </div>
  );

  if (loading && !accounts.length) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease', padding: '40px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Loading analytics…
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease' }}>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#f5f5f7', marginBottom: 6, letterSpacing: -1 }}>Analytics</h1>
        <div style={{
          marginTop: 24, padding: '40px 28px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, color: '#f5f5f7', marginBottom: 6, fontWeight: 600 }}>No accounts connected</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Go to <strong>Settings → Connected Accounts</strong> to link Instagram and start pulling data.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{
            fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: BLUE_DIM, fontFamily: "'Geist Mono', monospace", fontWeight: 700, marginBottom: 8,
          }}>Vantus · Content Analytics</div>
          <h1 style={{
            fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 700,
            color: '#f5f5f7', margin: 0, letterSpacing: -1, lineHeight: 1,
          }}>Analytics</h1>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
            {stats.posts} posts · {accounts.map(a => `@${a.handle || a.platform}`).join(' · ')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Platform toggles */}
          <div style={{ display: 'flex', gap: 6 }}>
            {Object.entries(PLATFORM_META).map(([id, meta]) => {
              const acc = accounts.find(a => a.platform === id);
              const isConnected = !!acc;
              const isEnabled = enabledPlatforms[id] !== false;
              return (
                <button
                  key={id}
                  disabled={!isConnected}
                  onClick={() => setEnabledPlatforms(p => ({ ...p, [id]: !isEnabled }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: isConnected && isEnabled ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: `1px solid ${isConnected && isEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8, padding: '6px 11px',
                    fontSize: 11, fontFamily: 'Inter, sans-serif',
                    color: isConnected ? (isEnabled ? '#f5f5f7' : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.2)',
                    cursor: isConnected ? 'pointer' : 'default',
                    opacity: isConnected ? 1 : 0.4,
                  }}
                  title={isConnected ? '' : 'Not connected'}>
                  <div style={{ width: 7, height: 7, borderRadius: 4, background: meta.dot }} />
                  {meta.short}
                </button>
              );
            })}
          </div>
          <button onClick={syncAll} disabled={Object.values(syncBusy).some(Boolean)}
            style={{
              background: BLUE_BG, border: `1px solid ${BLUE_BORDER}`, borderRadius: 8,
              padding: '7px 16px', fontSize: 12, color: BLUE, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontWeight: 600,
              opacity: Object.values(syncBusy).some(Boolean) ? 0.5 : 1,
            }}>
            {Object.values(syncBusy).some(Boolean) ? 'Syncing…' : '↻ Sync now'}
          </button>
        </div>
      </div>

      {/* STAT CARDS — 5 across on desktop, wraps on mobile */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24,
      }}>
        {statCard('Total Reach',     fmtNumber(stats.reach),     stats.reach > 0 ? `↑ ${stats.posts} posts` : null)}
        {statCard('Engagement',      fmtNumber(stats.engagement), `${fmtNumber(stats.likes)} likes`)}
        {statCard('Avg Engagement',  fmtRate(stats.avgRate),     (stats.avgRate || 0) > 0.05 ? 'above benchmark' : 'below benchmark', BLUE)}
        {statCard('Posts Published', String(stats.posts),         accounts.length > 0 ? `${accounts.length} account${accounts.length > 1 ? 's' : ''}` : null)}
        {statCard('Top Platform',    stats.topPlatform ? (PLATFORM_META[stats.topPlatform]?.label || stats.topPlatform) : '—', stats.topPlatform ? `${fmtNumber(stats.byPlatform[stats.topPlatform]?.reach)} reach` : null)}
      </div>

      {/* CHART + BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 24 }}>
        {/* Area chart */}
        <div style={{
          background: 'linear-gradient(135deg,#131013 0%,#0d0b0f 100%)',
          border: '1px solid rgba(125,211,252,0.15)', borderRadius: 14, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(125,211,252,0.7)', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>All platforms · {CHART_METRICS.find(m => m.id === chartMetric)?.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 6 }}>
                {chartMetric === 'engagement_rate'
                  ? fmtRate(stats.avgRate)
                  : chartMetric === 'posts'
                    ? String(stats.posts)
                    : fmtNumber(stats[chartMetric] ?? stats.engagement)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3 }}>
              {CHART_METRICS.map(m => (
                <button key={m.id} onClick={() => setChartMetric(m.id)}
                  style={{
                    fontSize: 10, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                    background: chartMetric === m.id ? 'rgba(125,211,252,0.15)' : 'transparent',
                    color: chartMetric === m.id ? '#7DD3FC' : 'rgba(255,255,255,0.5)',
                    border: 'none', borderRadius: 6, padding: '5px 10px',
                    cursor: 'pointer',
                  }}>{m.label}</button>
              ))}
            </div>
          </div>

          <svg viewBox="0 0 800 120" preserveAspectRatio="none" style={{ width: '100%', height: 120, display: 'block' }}>
            <defs>
              <linearGradient id="babyBlueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.55"/>
                <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.02"/>
              </linearGradient>
            </defs>
            {chartPath.area && <path d={chartPath.area} fill="url(#babyBlueGrad)" />}
            {chartPath.line && <path d={chartPath.line} fill="none" stroke="#7DD3FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: "'Geist Mono', monospace" }}>
              {chartSeries[0] ? fmtDate(chartSeries[0].x, { month: 'short', day: 'numeric' }) : ''}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: "'Geist Mono', monospace" }}>
              {chartSeries[chartSeries.length - 1] ? fmtDate(chartSeries[chartSeries.length - 1].x, { month: 'short', day: 'numeric' }) : ''}
            </span>
          </div>
        </div>

        {/* Platform breakdown */}
        <div style={{
          background: 'linear-gradient(135deg,#131013 0%,#0d0b0f 100%)',
          border: '1px solid rgba(125,211,252,0.15)', borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(125,211,252,0.7)', fontFamily: "'Geist Mono', monospace", fontWeight: 700, marginBottom: 16 }}>Reach by Platform</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(PLATFORM_META).map(([id, meta]) => {
              const v = stats.byPlatform[id];
              const total = Object.values(stats.byPlatform).reduce((s, x) => s + (x.reach || 0), 0);
              const pct = total > 0 && v ? (v.reach / total) * 100 : 0;
              const isConnected = accounts.some(a => a.platform === id);
              return (
                <div key={id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: meta.dot, opacity: isConnected ? 1 : 0.3 }} />
                      <span style={{ fontSize: 12, color: isConnected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>{meta.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#fff', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>
                      {isConnected ? fmtNumber(v?.reach || 0) : 'not connected'}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: meta.dot, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TOP PERFORMERS */}
      {topPerformers.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>Top Performers</div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'Geist Mono', monospace" }}>Ranked by engagement rate</span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12,
          }}>
            {topPerformers.map((p, i) => {
              const platform = accountPlatform[p.account_id];
              const meta = PLATFORM_META[platform] || {};
              return (
                <div key={p.id}
                  onClick={() => p.permalink && window.open(p.permalink, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12, overflow: 'hidden',
                    cursor: p.permalink ? 'pointer' : 'default',
                  }}>
                  <div style={{
                    width: '100%', aspectRatio: platform === 'youtube' ? '16 / 9' : platform === 'tiktok' ? '9 / 16' : '1 / 1',
                    background: '#1a1a1a', position: 'relative', overflow: 'hidden',
                  }}>
                    {p.thumbnail_url && (
                      <img src={p.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      background: 'rgba(0,0,0,0.7)', color: '#fff',
                      fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: meta.dot }} />
                      {meta.short || platform}
                    </div>
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(125,211,252,0.9)', color: '#000',
                      fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5,
                    }}>#{i + 1}</div>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{
                      fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      minHeight: 30,
                    }}>{p.caption?.slice(0, 80) || ''}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: '#7DD3FC', fontWeight: 700 }}>{fmtRate(p.metrics?.engagement_rate)}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{fmtNumber(p.metrics?.reach)} reach</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALL POSTS TABLE */}
      <div style={{
        background: 'linear-gradient(135deg,#131210 0%,#0e0c0b 100%)',
        border: `1px solid ${BLUE_BORDER}`, borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>All Posts ({tablePosts.length})</div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search caption or platform…"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7, padding: '6px 12px',
              fontSize: 11, color: 'rgba(255,255,255,0.85)',
              outline: 'none', width: 200, fontFamily: 'Inter, sans-serif',
            }} />
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '60px 2fr 0.8fr 0.9fr 0.7fr 0.8fr 50px',
          padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 12,
        }}>
          {['', 'Caption', 'Platform', 'Posted', 'Reach', 'Engagement', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: "'Geist Mono', monospace", fontWeight: 700 }}>{h}</div>
          ))}
        </div>

        {tablePosts.length === 0 ? (
          <div style={{ padding: '40px 18px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            No posts match your filters.
          </div>
        ) : (
          tablePosts.map(p => {
            const platform = accountPlatform[p.account_id];
            const meta = PLATFORM_META[platform] || {};
            const rate = p.metrics?.engagement_rate;
            return (
              <div key={p.id}
                onClick={() => p.permalink && window.open(p.permalink, '_blank', 'noopener,noreferrer')}
                style={{
                  display: 'grid', gridTemplateColumns: '60px 2fr 0.8fr 0.9fr 0.7fr 0.8fr 50px',
                  padding: '12px 18px', alignItems: 'center', gap: 12,
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: p.permalink ? 'pointer' : 'default',
                }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: '#1a1a1a', overflow: 'hidden', flexShrink: 0 }}>
                  {p.thumbnail_url && <img src={p.thumbnail_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{p.caption?.slice(0, 100) || <span style={{ color: 'rgba(255,255,255,0.3)' }}>No caption</span>}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: meta.dot }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{meta.short || platform}</span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: "'Geist Mono', monospace" }}>{fmtDate(p.posted_at, { month: 'short', day: 'numeric' })}</span>
                <span style={{ fontSize: 12, color: '#fff', fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>{fmtNumber(p.metrics?.reach)}</span>
                <span style={{
                  fontSize: 12, fontFamily: "'Geist Mono', monospace", fontWeight: 600,
                  color: rate != null && rate > 0.05 ? '#7DD3FC' : '#fff',
                }}>{fmtRate(rate)}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>↗</span>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: 'rgba(255,69,58,0.06)',
          border: '1px solid rgba(255,69,58,0.2)',
          borderRadius: 10, fontSize: 12, color: '#ff453a',
        }}>{error}</div>
      )}
    </div>
  );
}
