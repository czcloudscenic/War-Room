// /api/oauth/instagram/start
//
// Authenticated endpoint. Caller's Vantus session token authorizes them; we
// generate a CSRF state, store it tied to their user_id, and return the
// Instagram authorize URL. Frontend then redirects the browser to that URL.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { createOAuthState } = require("./_lib/oauth");

const IG_APP_ID = process.env.META_INSTAGRAM_APP_ID;
const IG_REDIRECT_URI = process.env.META_INSTAGRAM_REDIRECT_URI;

// Scopes match what was checked in Meta's Business login settings.
// Keeping the four "manage_*" + "content_publish" + "manage_insights" + "basic"
// to avoid re-auth when we later add publish/comment features.
const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
].join(",");

exports.handler = async (event) => {
  const cors = makeCors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  if (!IG_APP_ID || !IG_REDIRECT_URI) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server not configured: META_INSTAGRAM_APP_ID / META_INSTAGRAM_REDIRECT_URI missing" }),
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
      platform: "instagram",
      redirectTo,
    });
  } catch (e) {
    console.error("[oauth-ig-start] state creation failed", e);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to create OAuth state" }),
    };
  }

  const authorizeUrl =
    `https://www.instagram.com/oauth/authorize` +
    `?force_reauth=true` +
    `&client_id=${encodeURIComponent(IG_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(IG_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(IG_SCOPES)}` +
    `&state=${encodeURIComponent(state)}`;

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ authorizeUrl, state }),
  };
};
