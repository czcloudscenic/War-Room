// Lightweight per-user rate limit for Netlify functions.
//
// Design: in-memory sliding-window counter keyed by user.id + endpoint.
// Persists in the function's hot instance (Netlify reuses warm instances
// for ~minutes). Cold starts reset the counter — that's a feature, not a
// bug: the worst-case attacker has to wait for fresh instances and also
// trips the auth gate first.
//
// This is NOT a perfect rate limiter. It catches the obvious abuse
// pattern (one authenticated user hammering an endpoint) without
// requiring external infra (Redis, Upstash, etc.). If we ever need
// distributed rate limiting, swap the Map for Supabase-backed counters.

const buckets = new Map();

// Drop expired buckets periodically so the Map doesn't grow forever.
// Runs at most once per minute regardless of call volume.
let lastSweep = 0;
function maybeSweep(now) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (now - v.windowStart > v.windowMs) buckets.delete(k);
  }
}

/**
 * Check + consume a token.
 * @param {string} key      Stable identifier (e.g. `${user.id}:${endpoint}`)
 * @param {number} max      Max requests per window (default 30)
 * @param {number} windowMs Window length in ms (default 60_000)
 * @returns {{ok:true} | {ok:false, retryAfter:number, count:number}}
 */
function rateLimit(key, max = 30, windowMs = 60_000) {
  const now = Date.now();
  maybeSweep(now);
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now, windowMs });
    return { ok: true };
  }
  if (b.count >= max) {
    const retryAfter = Math.max(1, Math.ceil((b.windowStart + windowMs - now) / 1000));
    return { ok: false, retryAfter, count: b.count };
  }
  b.count++;
  return { ok: true };
}

// Build a 429 response. Caller composes corsHeaders + this.
function tooManyRequests(retryAfter, corsHeaders) {
  return {
    statusCode: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
    },
    body: JSON.stringify({
      error: "Rate limit exceeded",
      retryAfter,
    }),
  };
}

module.exports = { rateLimit, tooManyRequests };
