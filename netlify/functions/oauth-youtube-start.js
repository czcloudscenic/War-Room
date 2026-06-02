// /api/oauth/youtube/start
//
// Authenticated endpoint. Caller's Vantus session token authorizes them; we
// generate a CSRF state, store it tied to their user_id, and return the Google
// authorize URL for YouTube access. Frontend then redirects the browser to
// that URL.

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { createOAuthState } = require("./_lib/oauth");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const YT_REDIRECT_URI = process.env.YT_REDIRECT_URI;

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

exports.handler = async (event) => {
  const cors = makeCors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  if (!GOOGLE_CLIENT_ID || !YT_REDIRECT_URI) {
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server not configured: GOOGLE_CLIENT_ID / YT_REDIRECT_URI missing" }),
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
      platform: "youtube",
      redirectTo,
    });
  } catch (e) {
    console.error("[oauth-youtube-start] state creation failed", e);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to create OAuth state" }),
    };
  }

  const authorizeUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(YT_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(YOUTUBE_SCOPES)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&include_granted_scopes=true` +
    `&state=${encodeURIComponent(state)}`;

  return {
    statusCode: 200,
    headers: { ...cors, "Content-Type": "application/json" },
    body: JSON.stringify({ authorizeUrl, state }),
  };
};
