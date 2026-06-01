// Shared OAuth helpers — state token storage/verification, Supabase access.
//
// Each platform (Instagram, TikTok, YouTube, LinkedIn) has its own callback,
// but they all share the state-token CSRF dance:
//   1. /start  → generate UUID, store (state, user_id, platform, expires_at) in oauth_states, return authorize URL
//   2. /callback ← Meta/TT/etc redirects here with ?code=...&state=...
//                 lookup state in oauth_states → verify user/platform/not-expired → delete the row → exchange code

const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;

function sbHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function sbInsert(table, row) {
  const res = await fetch(`${REST}/${table}`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`sbInsert ${table} ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function sbUpsert(table, row, onConflict) {
  const url = `${REST}/${table}?on_conflict=${onConflict}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`sbUpsert ${table} ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function sbDelete(table, params) {
  const res = await fetch(`${REST}/${table}?${params}`, {
    method: "DELETE",
    headers: sbHeaders(),
  });
  if (!res.ok) throw new Error(`sbDelete ${table} ${res.status}: ${await res.text()}`);
}

async function sbSelectOne(table, params) {
  const res = await fetch(`${REST}/${table}?${params}&limit=1`, {
    headers: sbHeaders(),
  });
  if (!res.ok) throw new Error(`sbSelectOne ${table} ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

// ── State token: CSRF protection ────────────────────────────────────────────

async function createOAuthState({ userId, platform, redirectTo }) {
  const state = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await sbInsert("oauth_states", {
    state,
    user_id: userId,
    platform,
    redirect_to: redirectTo || null,
    expires_at: expiresAt,
  });
  return state;
}

async function consumeOAuthState({ state, platform }) {
  if (!state) return { ok: false, reason: "Missing state" };
  const row = await sbSelectOne(
    "oauth_states",
    `state=eq.${encodeURIComponent(state)}&platform=eq.${encodeURIComponent(platform)}`
  );
  if (!row) return { ok: false, reason: "Invalid or unknown state" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sbDelete("oauth_states", `state=eq.${encodeURIComponent(state)}`);
    return { ok: false, reason: "State expired" };
  }
  // Best-effort delete (consume once)
  await sbDelete("oauth_states", `state=eq.${encodeURIComponent(state)}`);
  return { ok: true, userId: row.user_id, redirectTo: row.redirect_to };
}

// ── Connected account storage ───────────────────────────────────────────────

async function upsertConnectedAccount({
  userId,
  platform,
  platformAccountId,
  handle,
  displayName,
  avatarUrl,
  meta,
}) {
  return sbUpsert(
    "connected_accounts",
    {
      user_id: userId,
      platform,
      platform_account_id: platformAccountId,
      handle: handle || null,
      display_name: displayName || null,
      avatar_url: avatarUrl || null,
      meta: meta || {},
      fetched_at: null,           // not synced yet
      updated_at: new Date().toISOString(),
    },
    "user_id,platform,platform_account_id"
  );
}

async function upsertAccountToken({ accountId, accessToken, refreshToken, expiresAt, scopes }) {
  return sbUpsert(
    "connected_account_tokens",
    {
      account_id: accountId,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_expires_at: expiresAt || null,
      scopes: scopes || null,
      updated_at: new Date().toISOString(),
    },
    "account_id"
  );
}

module.exports = {
  createOAuthState,
  consumeOAuthState,
  upsertConnectedAccount,
  upsertAccountToken,
  sbHeaders,
  REST,
};
