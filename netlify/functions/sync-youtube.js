// /api/sync/youtube
//
// Authenticated POST. Pulls recent videos + statistics from YouTube Data API
// v3, upserts into account_posts, stamps fetched_at.
//
// Body: { accountId: <connected_accounts.id> }
//
// Caller must own the account (RLS via service-key bypass + user_id check).
// We don't expose tokens — they're read service-side from connected_account_tokens.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const VIDEO_LIMIT = 20;

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

// ── YouTube API helpers ────────────────────────────────────────────────────

async function refreshYouTubeToken(refreshToken) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing");
  }
  if (!refreshToken) throw new Error("No refresh token stored");

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || JSON.stringify(data);
    throw new Error(`YouTube refresh failed ${res.status}: ${msg}`);
  }
  return data;
}

async function youtubeGet(path, accessToken, params = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`YouTube ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

function asCount(value) {
  if (value == null) return null;
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
  if (account.platform !== "youtube") {
    return {
      statusCode: 400,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Account platform is ${account.platform}, not youtube` }),
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
    token = row.access_token;

    if (row.token_expires_at && new Date(row.token_expires_at) <= new Date(Date.now() + 60_000)) {
      const refreshed = await refreshYouTubeToken(row.refresh_token);
      await sbPatch("connected_account_tokens", `account_id=eq.${accountId}`, {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || row.refresh_token,
        token_expires_at: refreshed.expires_in
          ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString()
          : row.token_expires_at,
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

  // 3. Resolve uploads playlist, list recent videos, then batch-fetch stats.
  // YouTube Analytics API can be added later for deeper per-video metrics like
  // impressions and watch time; Data API v3 statistics are enough for MVP.
  let videos;
  try {
    const channelData = await youtubeGet("/channels", token, {
      part: "contentDetails",
      mine: "true",
    });
    const uploadsPlaylistId = channelData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) throw new Error("Uploads playlist not found");

    const playlistData = await youtubeGet("/playlistItems", token, {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(VIDEO_LIMIT),
    });
    const videoIds = (playlistData.items || [])
      .map(item => item?.contentDetails?.videoId)
      .filter(Boolean);

    if (!videoIds.length) {
      videos = [];
    } else {
      const videoData = await youtubeGet("/videos", token, {
        part: "snippet,statistics,contentDetails",
        id: videoIds.join(","),
      });
      videos = videoData.items || [];
    }
  } catch (e) {
    return {
      statusCode: 502,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `YouTube video list failed: ${e.message}` }),
    };
  }

  // 4. Build upsert rows
  const rows = [];
  for (const v of videos) {
    const stats = v.statistics || {};
    const snippet = v.snippet || {};
    const thumbnails = snippet.thumbnails || {};
    const views = asCount(stats.viewCount);
    const likes = asCount(stats.likeCount);
    const comments = asCount(stats.commentCount);
    const metrics = {
      views,
      likes,
      comments,
      engagement_rate: views && views > 0
        ? +(((likes || 0) + (comments || 0)) / views).toFixed(4)
        : null,
    };

    rows.push({
      account_id: accountId,
      platform_post_id: String(v.id),
      posted_at: snippet.publishedAt || null,
      media_type: "video",
      caption: [snippet.title, snippet.description].filter(Boolean).join("\n") || null,
      permalink: v.id ? `https://youtu.be/${v.id}` : null,
      thumbnail_url: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null,
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
    console.warn("[sync-youtube] failed to stamp fetched_at:", e.message);
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
