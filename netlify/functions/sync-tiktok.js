// /api/sync/tiktok
//
// Authenticated POST. Pulls recent videos + inline metrics from TikTok, upserts
// into account_posts, stamps fetched_at.
//
// Body: { accountId: <connected_accounts.id> }
//
// Caller must own the account (RLS via service-key bypass + user_id check).
// We don't expose tokens — they're read service-side from connected_account_tokens.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");
const { decrypt, encrypt } = require("./_lib/crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;

const VIDEO_LIMIT = 20;
const SYNC_TIKTOK_RATE_LIMIT_MAX = 10;
const SYNC_TIKTOK_RATE_LIMIT_WINDOW_MS = 60_000;

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

// ── TikTok API helpers ─────────────────────────────────────────────────────

async function refreshTikTokToken(refreshToken) {
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET missing");
  }
  if (!refreshToken) throw new Error("No refresh token stored");

  const body = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  const token = data?.data || data;
  if (!res.ok || !token?.access_token) {
    const msg = data.error_description || data.message || data.error || JSON.stringify(data);
    throw new Error(`TikTok refresh failed ${res.status}: ${msg}`);
  }
  return token;
}

async function tiktokPost(path, accessToken, body, queryParams = null) {
  // TikTok's V2 list endpoints require `fields` as a query-string param while
  // pagination args like `max_count` / `cursor` go in the JSON body. Codex's
  // first pass put fields in the body — TT rejects with 400 invalid_params
  // ("`fields` field is required but missed"). queryParams lets each caller
  // pass the right shape.
  const url = new URL(`https://open.tiktokapis.com${path}`);
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const code = data?.error?.code;
  if (!res.ok || (code && code !== "ok")) {
    const msg = data?.error?.message || data.message || JSON.stringify(data);
    throw new Error(`TikTok ${path} → ${res.status} (code ${code || "n/a"}): ${msg}`);
  }
  return data;
}

function asCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

  const rl = rateLimit("sync-tiktok:" + auth.user.id, SYNC_TIKTOK_RATE_LIMIT_MAX, SYNC_TIKTOK_RATE_LIMIT_WINDOW_MS);
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
  if (account.platform !== "tiktok") {
    return {
      statusCode: 400,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Account platform is ${account.platform}, not tiktok` }),
    };
  }
  // Admins can sync any account; non-admins must own the account.
  if (auth.user.role !== "admin" && account.user_id !== auth.user.id) {
    return unauthorized("Not your account", event);
  }

  // 2. Load token + refresh if it expires in the next minute
  let token;
  try {
    const row = await sbSelectOne(
      "connected_account_tokens",
      `account_id=eq.${accountId}&select=access_token,refresh_token,token_expires_at`
    );
    if (!row?.access_token) throw new Error("No access token stored");
    token = decrypt(row.access_token);
    const refreshToken = decrypt(row.refresh_token);

    if (row.token_expires_at && new Date(row.token_expires_at) <= new Date(Date.now() + 60_000)) {
      const refreshed = await refreshTikTokToken(refreshToken);
      const nextRefreshToken = refreshed.refresh_token || refreshToken;
      await sbPatch("connected_account_tokens", `account_id=eq.${accountId}`, {
        access_token: encrypt(refreshed.access_token),
        refresh_token: encrypt(nextRefreshToken),
        token_expires_at: refreshed.expires_in
          ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      });
      token = refreshed.access_token;
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Token lookup failed: ${e.message}` }),
    };
  }

  // 3. Pull recent video list. TikTok returns metrics inline on each video.
  let videoList;
  try {
    const FIELDS = [
      "id",
      "title",
      "video_description",
      "duration",
      "cover_image_url",
      "share_url",
      "create_time",
      "view_count",
      "like_count",
      "comment_count",
      "share_count",
    ].join(",");
    const data = await tiktokPost(
      "/v2/video/list/",
      token,
      { max_count: VIDEO_LIMIT },
      { fields: FIELDS },
    );
    videoList = data?.data?.videos || [];
  } catch (e) {
    return {
      statusCode: 502,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `TikTok video list failed: ${e.message}` }),
    };
  }

  // 4. Build upsert rows
  const rows = [];
  for (const v of videoList) {
    const views = asCount(v.view_count);
    const likes = asCount(v.like_count);
    const comments = asCount(v.comment_count);
    const shares = asCount(v.share_count);
    const metrics = {
      views,
      likes,
      comments,
      shares,
      engagement_rate: views && views > 0
        ? +(((likes || 0) + (comments || 0) + (shares || 0)) / views).toFixed(4)
        : null,
    };

    rows.push({
      account_id: accountId,
      platform_post_id: String(v.id),
      posted_at: v.create_time ? new Date(Number(v.create_time) * 1000).toISOString() : null,
      media_type: "video",
      caption: v.video_description || null,
      permalink: v.share_url || null,
      thumbnail_url: v.cover_image_url || null,
      metrics,
      raw: v,
      fetched_at: new Date().toISOString(),
    });
  }

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
    console.warn("[sync-tiktok] failed to stamp fetched_at:", e.message);
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
