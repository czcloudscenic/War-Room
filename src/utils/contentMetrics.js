// src/utils/contentMetrics.js
// Content Intel rate math, ported from Studio Intel's src/lib/metrics.js.
// Browser-safe copy for the UI — the agent-action handler keeps its own copy
// because Netlify functions don't import from src/ (change both together).
// Everything reads the account_posts.metrics jsonb, tolerating Studio-style
// and Graph-API key names.

export const DEFAULT_BENCH = { send_rate: 0.013, follow_rate: 0.0006, save_rate: 0.005 };

export function readMetrics(post) {
  const m = (post && post.metrics) || {};
  const num = (v) => (v == null ? null : Number(v));
  const views = num(m.views ?? m.plays) || 0;
  const reach = num(m.reach) || 0;
  const saves = num(m.saves ?? m.saved) || 0;
  const shares = num(m.shares) || 0;
  const sends = num(m.sends) ?? shares; // Studio mapped sends <- shares (DM-sends never calibrated)
  const follows = m.follows == null ? null : Number(m.follows);
  const avg_watch_sec = m.avg_watch_sec != null
    ? Number(m.avg_watch_sec)
    : (m.ig_reels_avg_watch_time != null ? Number(m.ig_reels_avg_watch_time) / 1000 : null); // API returns ms
  const likes = num(m.likes) || 0;
  const comments = num(m.comments) || 0;
  return { views, reach, saves, shares, sends, follows, avg_watch_sec, likes, comments };
}

export function computeRates(n, videoLengthSec) {
  return {
    send_rate: n.views ? n.sends / n.views : 0,
    save_rate: n.views ? n.saves / n.views : 0,
    follow_rate: (n.reach && n.follows != null) ? n.follows / n.reach : null,
    hook_hold: (videoLengthSec && n.avg_watch_sec != null) ? n.avg_watch_sec / videoLengthSec : null,
  };
}

// Benchmark comparison: true when the value beats the bar.
export function beatsBar(value, bar) {
  if (value == null || bar == null) return null;
  return value >= bar;
}

export function fmtPct(x, dp = 2) { return x == null ? '?' : (x * 100).toFixed(dp) + '%'; }

export function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}
