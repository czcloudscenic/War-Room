// Shared OAuth helpers — state token storage/verification, Supabase access.
//
// Each platform (Instagram, TikTok, YouTube, LinkedIn) has its own callback,
// but they all share the state-token CSRF dance:
//   1. /start  → generate UUID, store (state, user_id, platform, expires_at) in oauth_states, return authorize URL
//   2. /callback ← Meta/TT/etc redirects here with ?code=...&state=...
//                 lookup state in oauth_states → verify user/platform/not-expired → delete the row → exchange code

const crypto = require("crypto");
const { encrypt } = require("./crypto");

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

async function sbSelect(table, params) {
  const res = await fetch(`${REST}/${table}?${params}`, {
    headers: sbHeaders(),
  });
  if (!res.ok) throw new Error(`sbSelect ${table} ${res.status}: ${await res.text()}`);
  return res.json();
}

function getHeader(event, name) {
  const headers = event?.headers || {};
  const wanted = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === wanted) return v;
  }
  return "";
}

function rawBody(event) {
  const body = event?.body || "";
  return event?.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
}

function parseRequestBody(event) {
  const body = rawBody(event);
  if (!body) return {};

  const contentType = getHeader(event, "content-type").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, "base64");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyMetaSignedRequest(signedRequest, secret) {
  if (!signedRequest || !secret) return { ok: false, reason: "Missing signed_request or app secret" };

  const parts = String(signedRequest).split(".");
  if (parts.length !== 2) return { ok: false, reason: "Malformed signed_request" };
  const [sigB64, payloadB64] = parts;
  const actualSig = base64UrlDecode(sigB64);
  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  if (!timingSafeEqual(actualSig, expectedSig)) {
    return { ok: false, reason: "Invalid signed_request signature" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "Invalid signed_request payload" };
  }
}

function parseTikTokSignature(header) {
  const out = {};
  for (const part of String(header || "").split(",")) {
    const [key, value] = part.split("=");
    if (key && value) out[key.trim()] = value.trim();
  }
  return out;
}

function verifyTikTokSignature(event, secret) {
  const header = getHeader(event, "TikTok-Signature");
  if (!header) return { present: false, ok: true };
  if (!secret) return { present: true, ok: false, reason: "Missing TikTok client secret" };

  const parsed = parseTikTokSignature(header);
  if (!parsed.t || !parsed.s) return { present: true, ok: false, reason: "Malformed TikTok signature" };

  const signedPayload = `${parsed.t}.${rawBody(event)}`;
  const expectedHex = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const actual = /^[a-f0-9]+$/i.test(parsed.s) ? Buffer.from(parsed.s, "hex") : Buffer.from(parsed.s);
  return timingSafeEqual(actual, expected)
    ? { present: true, ok: true }
    : { present: true, ok: false, reason: "Invalid TikTok signature" };
}

function extractPlatformAccountId(payload) {
  if (!payload || typeof payload !== "object") return null;
  const content = typeof payload.content === "string"
    ? (() => { try { return JSON.parse(payload.content); } catch { return {}; } })()
    : (payload.content || {});
  return (
    payload.platform_account_id ||
    payload.platformAccountId ||
    payload.user_id ||
    payload.userId ||
    payload.user_openid ||
    payload.open_id ||
    payload.openId ||
    payload.channel_id ||
    payload.channelId ||
    payload.account_id ||
    payload.accountId ||
    content.platform_account_id ||
    content.platformAccountId ||
    content.user_id ||
    content.userId ||
    content.user_openid ||
    content.open_id ||
    content.openId ||
    content.channel_id ||
    content.channelId ||
    content.account_id ||
    content.accountId ||
    null
  );
}

function confirmationCode() {
  return crypto.randomBytes(16).toString("hex");
}

function dataDeletionStatusUrl(code) {
  return `https://usevantus.com/api/oauth/data-deletion-status?code=${encodeURIComponent(code)}`;
}

// ── State token: CSRF protection ────────────────────────────────────────────

async function createOAuthState({ userId, platform, redirectTo }) {
  try {
    await sbDelete("oauth_states", `expires_at=lt.${encodeURIComponent(new Date().toISOString())}`);
  } catch (e) {
    console.warn("[oauth] expired state cleanup failed:", e.message);
  }

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
      access_token: encrypt(accessToken),
      refresh_token: encrypt(refreshToken),
      token_expires_at: expiresAt || null,
      scopes: scopes || null,
      updated_at: new Date().toISOString(),
    },
    "account_id"
  );
}

async function deleteConnectedAccountByPlatformId(platform, platformAccountId) {
  if (!platformAccountId) return { deleted: 0, accountIds: [] };
  const params =
    `platform=eq.${encodeURIComponent(platform)}` +
    `&platform_account_id=eq.${encodeURIComponent(String(platformAccountId))}` +
    `&select=id`;
  const rows = await sbSelect("connected_accounts", params);
  if (!rows.length) return { deleted: 0, accountIds: [] };
  await sbDelete(
    "connected_accounts",
    `platform=eq.${encodeURIComponent(platform)}&platform_account_id=eq.${encodeURIComponent(String(platformAccountId))}`
  );
  return { deleted: rows.length, accountIds: rows.map((row) => row.id) };
}

async function recordDataDeletionRequest({ platform, platformAccountId, confirmationCode, rawPayload }) {
  return sbInsert("data_deletion_requests", {
    confirmation_code: confirmationCode,
    platform,
    platform_account_id: platformAccountId ? String(platformAccountId) : null,
    status: "completed",
    raw_payload: rawPayload || {},
    completed_at: new Date().toISOString(),
  });
}

async function getDataDeletionRequest(confirmationCode) {
  return sbSelectOne(
    "data_deletion_requests",
    `confirmation_code=eq.${encodeURIComponent(confirmationCode)}&select=confirmation_code,platform,platform_account_id,status,requested_at,completed_at`
  );
}

module.exports = {
  createOAuthState,
  consumeOAuthState,
  upsertConnectedAccount,
  upsertAccountToken,
  deleteConnectedAccountByPlatformId,
  recordDataDeletionRequest,
  getDataDeletionRequest,
  parseRequestBody,
  verifyMetaSignedRequest,
  verifyTikTokSignature,
  extractPlatformAccountId,
  confirmationCode,
  dataDeletionStatusUrl,
  sbHeaders,
  REST,
};
