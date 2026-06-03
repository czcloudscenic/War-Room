// /api/oauth/tiktok/start
//
// Authenticated endpoint. Caller's Vantus session token authorizes them; we
// generate a CSRF state, store it tied to their user_id, and return the TikTok
// authorize URL. Frontend then redirects the browser to that URL.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { createOAuthState } = require("./_lib/oauth");

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

// TikTok deprecated user.info.basic in their V2 scope catalog — its fields
// (username + avatar + display_name) rolled into user.info.profile. Dropping
// the dead scope here so TikTok doesn't reject the OAuth request with
// invalid_scope. The TT app dashboard only shows the 3 below as available.
const TIKTOK_SCOPES = [
  "user.info.profile",
  "user.info.stats",
  "video.list",
].join(",");

exports.handler = async (event) => {
  const cors = makeCors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  if (!TIKTOK_CLIENT_KEY || !TIKTOK_REDIRECT_URI) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server not configured: TIKTOK_CLIENT_KEY / TIKTOK_REDIRECT_URI missing" }),
    };
  }

  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);

  let payload = {};
  try { payload = JSON.parse(event.body || "{}"); } catch {}
  const redirectTo = typeof payload.redirectTo === "string" ? payload.redirectTo : null;

  let state;
  try {
    state = await createOAuthState({
      userId: auth.user.id,
      platform: "tiktok",
      redirectTo,
    });
  } catch (e) {
    console.error("[oauth-tiktok-start] state creation failed", e);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to create OAuth state" }),
    };
  }

  const authorizeUrl =
    `https://www.tiktok.com/v2/auth/authorize/` +
    `?client_key=${encodeURIComponent(TIKTOK_CLIENT_KEY)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(TIKTOK_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(TIKTOK_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}`;

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ authorizeUrl, state }),
  };
};
