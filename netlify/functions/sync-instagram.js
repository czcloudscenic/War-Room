// /api/sync/instagram
//
// Authenticated POST. Pulls recent media + insights from Meta Graph API for a
// connected Instagram account, upserts into account_posts, stamps fetched_at.
//
// Body: { accountId: <connected_accounts.id> }
//
// Caller must own the account (RLS via service-key bypass + user_id check).
// We don't expose tokens — they're read service-side from connected_account_tokens.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;

const MEDIA_LIMIT = 30;          // most recent N posts per sync
const INSIGHTS_TIMEOUT_MS = 8000; // bail out per-media if Meta is slow
const INSIGHTS_CONCURRENCY = 5;
const SYNC_INSTAGRAM_RATE_LIMIT_MAX = 10;
const SYNC_INSTAGRAM_RATE_LIMIT_WINDOW_MS = 60_000;

function sb() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sbSelectOne(table, params) {
  const res = await fetch(`${REST}/${table}?${params}&limit=1`, { headers: sb() });
  if (!res.ok) throw new Error(`sbSelectOne ${table} ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function sbPatch(table, params, body) {
  const res = await fetch(`${REST}/${table}?${params}`, {
    method: "PATCH",
    headers: sb(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbPatch ${table} ${res.status}: ${await res.text()}`);
}

async function sbUpsertPosts(rows) {
  if (!rows.length) return;
  const res = await fetch(
    `${REST}/account_posts?on_conflict=account_id,platform_post_id`,
    {
      method: "POST",
      headers: { ...sb(), Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    }
  );
  if (!res.ok) throw new Error(`sbUpsertPosts ${res.status}: ${await res.text()}`);
}

// ── Meta Graph API helpers ──────────────────────────────────────────────────

async function graphGet(path, accessToken, extraParams = {}, fetchOptions = {}) {
  const url = new URL(`https://graph.instagram.com${path}`);
  for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), fetchOptions);
  const data = await res.json();
  if (!res.ok) {
    const code = data?.error?.code;
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Meta Graph ${path} → ${res.status} (code ${code}): ${msg}`);
  }
  return data;
}

// Per-media insights — Meta returns different metrics by media_type.
// Use a sane default set; if the metric isn't available for that type
// Meta returns a 400 — catch and skip.
function metricsForType(mediaType) {
  // IMAGE / CAROUSEL_ALBUM / VIDEO / REELS
  const t = (mediaType || "").toUpperCase();
  if (t === "REELS" || t === "VIDEO") {
    return ["reach", "likes", "comments", "saved", "shares", "total_interactions", "views"];
  }
  if (t === "CAROUSEL_ALBUM") {
    return ["reach", "likes", "comments", "saved", "shares", "total_interactions"];
  }
  // IMAGE + fallback
  return ["reach", "likes", "comments", "saved", "shares", "total_interactions"];
}

async function fetchInsights(mediaId, mediaType, accessToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INSIGHTS_TIMEOUT_MS);
  try {
    const metrics = metricsForType(mediaType).join(",");
    const data = await graphGet(`/${mediaId}/insights`, accessToken, { metric: metrics }, { signal: controller.signal });
    const out = {};
    for (const m of data.data || []) {
      // Meta returns shape: { name, period, values: [{ value, end_time }] }
      const v = m.values?.[0]?.value;
      if (v != null) out[m.name] = v;
    }
    return out;
  } catch (e) {
    console.warn(`[sync-ig] insights failed for ${mediaId} (${mediaType}):`, e.message);
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const cors = makeCors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  const rl = rateLimit("sync-instagram:" + auth.user.id, SYNC_INSTAGRAM_RATE_LIMIT_MAX, SYNC_INSTAGRAM_RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch {}
  const accountId = payload.accountId;
  if (!accountId) {
    return {
      statusCode: 400,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "accountId required" }),
    };
  }

  // 1. Load account + verify ownership
  let account;
  try {
    account = await sbSelectOne(
      "connected_accounts",
      `id=eq.${accountId}&select=id,user_id,platform,platform_account_id,handle`
    );
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Account lookup failed: ${e.message}` }),
    };
  }
  if (!account) {
    return {
      statusCode: 404,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Account not found" }),
    };
  }
  if (account.platform !== "instagram") {
    return {
      statusCode: 400,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Account platform is ${account.platform}, not instagram` }),
    };
  }
  // Admins can sync any account; non-admins must own the account.
  if (auth.user.role !== "admin" && account.user_id !== auth.user.id) {
    return unauthorized("Not your account", event);
  }

  // 2. Load token
  let token;
  try {
    const row = await sbSelectOne(
      "connected_account_tokens",
      `account_id=eq.${accountId}&select=access_token,token_expires_at`
    );
    if (!row?.access_token) throw new Error("No access token stored");
    token = row.access_token;
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Token lookup failed: ${e.message}` }),
    };
  }

  // 3. Pull recent media list
  let mediaList;
  try {
    const data = await graphGet("/me/media", token, {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
      limit: String(MEDIA_LIMIT),
    });
    mediaList = data.data || [];
  } catch (e) {
    return {
      statusCode: 502,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Meta media list failed: ${e.message}` }),
    };
  }

  // 4. Per-media insights, then build upsert rows
  const rows = await mapWithConcurrency(mediaList, INSIGHTS_CONCURRENCY, async (m) => {
    const insights = await fetchInsights(m.id, m.media_type, token);
    const metrics = {
      reach: insights.reach ?? null,
      likes: insights.likes ?? null,
      comments: insights.comments ?? null,
      saved: insights.saved ?? null,
      shares: insights.shares ?? null,
      total_interactions: insights.total_interactions ?? null,
      views: insights.views ?? null,
    };
    // Engagement rate (rough): (likes + comments + saves + shares) / reach
    if (metrics.reach && metrics.reach > 0) {
      const interactions = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.saved || 0) + (metrics.shares || 0);
      metrics.engagement_rate = +(interactions / metrics.reach).toFixed(4);
    }

    return {
      account_id: accountId,
      platform_post_id: String(m.id),
      posted_at: m.timestamp || null,
      media_type: (m.media_type || "").toLowerCase() || null,
      caption: m.caption || null,
      permalink: m.permalink || null,
      thumbnail_url: m.thumbnail_url || m.media_url || null,
      metrics,
      raw: m,
      fetched_at: new Date().toISOString(),
    };
  });

  // 5. Upsert
  try {
    await sbUpsertPosts(rows);
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Upsert failed: ${e.message}` }),
    };
  }

  // 6. Stamp last fetch
  try {
    await sbPatch("connected_accounts", `id=eq.${accountId}`, {
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[sync-ig] failed to stamp fetched_at:", e.message);
  }

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      account: { id: account.id, handle: account.handle },
      synced: rows.length,
      fetched_at: new Date().toISOString(),
    }),
  };
};
