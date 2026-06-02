import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '../../services/supabaseClient.js';

const PLATFORM_META = {
  instagram: { label: 'Instagram', dot: '#dc2743' },
  tiktok:    { label: 'TikTok',    dot: '#ff0050' },
  youtube:   { label: 'YouTube',   dot: '#ff0000' },
  linkedin:  { label: 'LinkedIn',  dot: '#0a66c2' },
};

const SORT_OPTIONS = [
  { id: 'engagement_rate', label: 'Engagement' },
  { id: 'reach',           label: 'Reach' },
  { id: 'likes',           label: 'Likes' },
  { id: 'posted_at',       label: 'Newest' },
];

function fmtNumber(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function fmtRate(r) {
  if (r == null) return '—';
  return (r * 100).toFixed(1) + '%';
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InsightsRoute() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [sortBy, setSortBy] = useState('engagement_rate');
  const [error, setError] = useState(null);

  // Load connected accounts (gated on auth being ready — see fix for #18)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Force supabase-js to finish restoring session before querying.
        // Without this, the query fires anonymously on hard-refresh, RLS
        // returns empty, and the page looks like there's no data.
        await sb.auth.getSession();
        const { data, error } = await sb
          .from('connected_accounts')
          .select('id,platform,handle,display_name,avatar_url,fetched_at,meta')
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (error) throw error;
        setAccounts(data || []);
        if ((data || []).length > 0) setSelectedAccountId(prev => prev || data[0].id);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load accounts');
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load posts for selected account
  const reloadPosts = useCallback(async () => {
    if (!selectedAccountId) { setPosts([]); return; }
    setLoadingPosts(true);
    try {
      await sb.auth.getSession();
      const { data, error } = await sb
        .from('account_posts')
        .select('id,platform_post_id,posted_at,media_type,caption,permalink,thumbnail_url,metrics,fetched_at')
        .eq('account_id', selectedAccountId)
        .order('posted_at', { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load posts');
    } finally {
      setLoadingPosts(false);
    }
  }, [selectedAccountId]);

  useEffect(() => { reloadPosts(); }, [reloadPosts]);

  // Realtime: re-fetch when account_posts changes for the selected account
  useEffect(() => {
    if (!selectedAccountId) return;
    const ch = sb.channel(`account_posts:${selectedAccountId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'account_posts', filter: `account_id=eq.${selectedAccountId}` },
        () => reloadPosts()
      )
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [selectedAccountId, reloadPosts]);

  const sortedPosts = useMemo(() => {
    const arr = [...posts];
    arr.sort((a, b) => {
      if (sortBy === 'engagement_rate') return (b.metrics?.engagement_rate || 0) - (a.metrics?.engagement_rate || 0);
      if (sortBy === 'reach')           return (b.metrics?.reach || 0) - (a.metrics?.reach || 0);
      if (sortBy === 'likes')           return (b.metrics?.likes || 0) - (a.metrics?.likes || 0);
      if (sortBy === 'posted_at')       return new Date(b.posted_at || 0) - new Date(a.posted_at || 0);
      return 0;
    });
    return arr;
  }, [posts, sortBy]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Summary stats
  const summary = useMemo(() => {
    if (!posts.length) return null;
    const totalReach = posts.reduce((s, p) => s + (p.metrics?.reach || 0), 0);
    const totalLikes = posts.reduce((s, p) => s + (p.metrics?.likes || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.metrics?.comments || 0), 0);
    const engagementRates = posts.map(p => p.metrics?.engagement_rate).filter(r => r != null);
    const avgEngagement = engagementRates.length
      ? engagementRates.reduce((s, r) => s + r, 0) / engagementRates.length
      : null;
    return { totalReach, totalLikes, totalComments, avgEngagement };
  }, [posts]);

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <h1 style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 32, fontWeight: 700, color: '#f5f5f7',
        marginBottom: 6, letterSpacing: -1,
      }}>Insights</h1>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
        Published content + engagement from your connected accounts.
      </p>

      {/* Account picker */}
      {loadingAccounts ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading accounts…</div>
      ) : accounts.length === 0 ? (
        <div style={{
          padding: '32px 24px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, color: '#f5f5f7', marginBottom: 6, fontWeight: 600 }}>No accounts connected yet</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Go to <strong>Settings → Connected Accounts</strong> to link Instagram.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {accounts.map(a => {
              const meta = PLATFORM_META[a.platform] || {};
              const isActive = a.id === selectedAccountId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccountId(a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12, padding: '8px 14px',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: meta.dot || '#999' }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f7' }}>{meta.label || a.platform}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>@{a.handle || a.display_name || a.id}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary stats */}
          {selectedAccount && summary && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10, marginBottom: 24,
            }}>
              {[
                { label: 'Posts', value: posts.length },
                { label: 'Total reach', value: fmtNumber(summary.totalReach) },
                { label: 'Total likes', value: fmtNumber(summary.totalLikes) },
                { label: 'Total comments', value: fmtNumber(summary.totalComments) },
                { label: 'Avg engagement', value: fmtRate(summary.avgEngagement) },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f7' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Sort controls */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginRight: 6 }}>Sort by</span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                style={{
                  fontSize: 11, fontWeight: 600,
                  color: sortBy === opt.id ? '#2AABFF' : 'rgba(255,255,255,0.55)',
                  background: sortBy === opt.id ? 'rgba(42,171,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${sortBy === opt.id ? 'rgba(42,171,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, padding: '5px 12px',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Post grid */}
          {loadingPosts ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '32px 0' }}>Loading posts…</div>
          ) : sortedPosts.length === 0 ? (
            <div style={{
              padding: '32px 24px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, color: '#f5f5f7', marginBottom: 6, fontWeight: 600 }}>No posts synced yet</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Hit <strong>Sync now</strong> on the account in Settings to pull the latest 30 posts.
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}>
              {sortedPosts.map(p => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </>
      )}

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

function PostCard({ post }) {
  const m = post.metrics || {};
  const captionPreview = (post.caption || '').slice(0, 140);
  const isVideo = post.media_type === 'video' || post.media_type === 'reels';

  const openPermalink = () => {
    if (post.permalink) window.open(post.permalink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={openPermalink}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: post.permalink ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}>
      {/* Thumbnail */}
      <div style={{
        width: '100%', aspectRatio: '1 / 1',
        background: '#1a1a1a',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {post.thumbnail_url ? (
          <img src={post.thumbnail_url} alt={captionPreview || 'post'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'rgba(255,255,255,0.25)', fontSize: 11,
          }}>No preview</div>
        )}
        {isVideo && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '3px 7px',
            borderRadius: 5, textTransform: 'uppercase', letterSpacing: 0.8,
          }}>{post.media_type === 'reels' ? 'Reel' : 'Video'}</div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
          {fmtDate(post.posted_at)}
        </div>
        {captionPreview && (
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5,
            marginBottom: 10,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{captionPreview}{post.caption && post.caption.length > 140 ? '…' : ''}</div>
        )}

        {/* Metrics grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginTop: 10 }}>
          <Metric label="Reach"      value={fmtNumber(m.reach)} />
          <Metric label="Engagement" value={fmtRate(m.engagement_rate)} accent={m.engagement_rate && m.engagement_rate > 0.05} />
          <Metric label="Likes"      value={fmtNumber(m.likes)} />
          <Metric label="Comments"   value={fmtNumber(m.comments)} />
          <Metric label="Saves"      value={fmtNumber(m.saved)} />
          <Metric label="Shares"     value={fmtNumber(m.shares)} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div style={{
      padding: '6px 8px',
      background: accent ? 'rgba(42,171,255,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(42,171,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
      borderRadius: 7,
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: accent ? '#2AABFF' : '#f5f5f7', marginTop: 2 }}>{value}</div>
    </div>
  );
}
