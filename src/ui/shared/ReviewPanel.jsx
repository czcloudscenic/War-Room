// ReviewPanel — the review-cut player + timestamped comment thread.
//
// Mounted in BOTH the admin EditContentModal and the client portal's
// PortalItemCard. Comments live in content_comments (RLS: admins full, clients
// scoped INSERT/SELECT with author bound to their JWT) and arrive live via
// realtime. When the item has a review cut in the review-media bucket it plays
// in a first-party <video> — comments can pin to the current playback time and
// clicking a timecode chip seeks the player. Without a video the thread still
// works as general feedback (copy items).
//
// Client comments also ring the admin bell via /api/notify (type
// client_comment) — fire-and-forget.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sb } from '../../services/supabaseClient';
import { apiFetch } from '../../services/apiFetch';

const fmtTime = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

export default function ReviewPanel({ item, role = 'admin', accent = '#2AABFF' }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [pinTime, setPinTime] = useState(true);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState({ email: '', name: '' });
  const videoRef = useRef(null);

  const itemId = item?.id;
  const videoUrl = item?.review_video_path && sb
    ? sb.storage.from('review-media').getPublicUrl(item.review_video_path)?.data?.publicUrl
    : null;

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      const u = data?.session?.user;
      if (u) setMe({ email: u.email || '', name: u.user_metadata?.full_name || u.email || '' });
    });
  }, []);

  const load = useCallback(async () => {
    if (!sb || !itemId) return;
    const { data, error } = await sb
      .from('content_comments')
      .select('*')
      .eq('content_item_id', itemId)
      .order('created_at', { ascending: true });
    if (!error) setComments(data || []);
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!sb || !itemId) return;
    const ch = sb.channel(`comments_${itemId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'content_comments', filter: `content_item_id=eq.${itemId}` },
        (payload) => setComments(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'content_comments', filter: `content_item_id=eq.${itemId}` },
        (payload) => setComments(prev => prev.map(c => c.id === payload.new.id ? payload.new : c)))
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [itemId]);

  const seek = (t) => {
    if (videoRef.current != null && t != null) {
      videoRef.current.currentTime = Number(t);
      videoRef.current.play?.().catch(() => {});
    }
  };

  const post = async () => {
    const text = body.trim();
    if (!text || busy || !sb) return;
    setBusy(true);
    const timecode = pinTime && videoUrl && videoRef.current ? Math.floor(videoRef.current.currentTime) : null;
    const row = {
      content_item_id: itemId,
      client_id: item.client_id || null,
      author_email: me.email,
      author_name: me.name,
      author_role: role,
      body: text,
      timecode_seconds: timecode,
    };
    const { data, error } = await sb.from('content_comments').insert(row).select().single();
    if (!error) {
      setBody('');
      if (data) setComments(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data]);
      if (role === 'client') {
        apiFetch('/api/notify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'client_comment',
            item: { id: itemId, title: item.title, comment_id: data?.id, author: me.name || me.email, body: text, timecode },
            client_id: item.client_id || null,
          }),
        }).catch(() => {});
      }
    }
    setBusy(false);
  };

  const resolve = async (c) => {
    if (role !== 'admin' || !sb) return;
    await sb.from('content_comments').update({ resolved_at: new Date().toISOString() }).eq('id', c.id);
  };

  return (
    <div>
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12 }}
        />
      )}

      {/* Thread */}
      {comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', opacity: c.resolved_at ? 0.45 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {c.timecode_seconds != null && (
                  <button
                    onClick={() => seek(c.timecode_seconds)}
                    style={{ fontSize: 10, fontWeight: 700, color: accent, background: 'rgba(42,171,255,0.1)', border: '1px solid rgba(42,171,255,0.25)', borderRadius: 6, padding: '2px 8px', cursor: videoUrl ? 'pointer' : 'default', fontFamily: 'inherit' }}
                  >
                    ▶ {fmtTime(c.timecode_seconds)}
                  </button>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color: c.author_role === 'client' ? '#64d2ff' : 'rgba(255,255,255,0.75)' }}>
                  {c.author_name || c.author_email}{c.author_role === 'client' ? ' (client)' : ''}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                {role === 'admin' && !c.resolved_at && (
                  <button onClick={() => resolve(c)} title="Mark handled" style={{ fontSize: 10, color: 'rgba(48,209,88,0.8)', background: 'none', border: '1px solid rgba(48,209,88,0.3)', borderRadius: 6, padding: '1px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                )}
                {c.resolved_at && <span style={{ fontSize: 9, color: 'rgba(48,209,88,0.7)' }}>resolved</span>}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>{c.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={videoUrl ? 'Comment — pause the video where you mean and it pins to that moment…' : 'Add a comment…'}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 60, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          {videoUrl && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.55)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={pinTime} onChange={(e) => setPinTime(e.target.checked)} style={{ accentColor: accent }} />
              Pin to current time
            </label>
          )}
          <button
            onClick={post}
            disabled={busy || !body.trim()}
            style={{ marginLeft: 'auto', padding: '8px 18px', border: 0, borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: busy || !body.trim() ? 'default' : 'pointer', background: body.trim() ? accent : 'rgba(255,255,255,0.1)', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
