// /api/oauth/youtube/callback
//
// Hit by Google redirect AFTER the user authorizes YouTube access. Carries
// ?code=...&state=... No bearer token (this is a top-level browser navigation
// from accounts.google.com).
//
// Flow:
//   1. Verify state via oauth_states → get user_id
//   2. Exchange code → access_token + refresh_token
//   3. Fetch channel profile (id, title, customUrl, thumbnails, statistics)
//   4. Upsert connected_accounts + connected_account_tokens
//   5. Redirect user back to Vantus

const { consumeOAuthState, upsertConnectedAccount, upsertAccountToken } = require("./_lib/oauth");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const YT_REDIRECT_URI = process.env.YT_REDIRECT_URI;

const APP_ORIGIN = "https://usevantus.com";
const YOUTUBE_SCOPES = "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly";

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: "" };
}

function errorRedirect(reason) {
  const url = `${APP_ORIGIN}/?youtube_oauth_error=${encodeURIComponent(reason)}`;
  return redirect(url);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !YT_REDIRECT_URI) {
    console.error("[oauth-youtube-callback] missing env: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / YT_REDIRECT_URI");
    return errorRedirect("server_not_configured");
  }

  const params = event.queryStringParameters || {};
  const { code, state, error, error_description } = params;

  // User canceled or Google returned an error
  if (error) {
    console.warn("[oauth-youtube-callback] Google returned error", { error, error_description });
    return errorRedirect(error_description || error);
  }
  if (!code || !state) return errorRedirect("missing_code_or_state");

  // 1. CSRF: verify state → get user_id
  const stateRes = await consumeOAuthState({ state, platform: "youtube" });
  if (!stateRes.ok) {
    console.warn("[oauth-youtube-callback] state verification failed", stateRes.reason);
    return errorRedirect(stateRes.reason);
  }
  const userId = stateRes.userId;

  // 2. Exchange code for access + refresh token
  let token;
  try {
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: YT_REDIRECT_URI,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    token = await res.json();
    if (!res.ok || !token.access_token) {
      console.error("[oauth-youtube-callback] token exchange failed", token);
      return errorRedirect(token.error_description || token.error || "token_exchange_failed");
    }
  } catch (e) {
    console.error("[oauth-youtube-callback] token exchange threw", e);
    return errorRedirect("token_exchange_threw");
  }

  // 3. Fetch channel profile
  let channel;
  try {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const data = await res.json();
    channel = data?.items?.[0];
    if (!res.ok || !channel?.id) {
      console.error("[oauth-youtube-callback] channel fetch failed", data);
      return errorRedirect(data.error?.message || "channel_fetch_failed");
    }
  } catch (e) {
    console.error("[oauth-youtube-callback] channel fetch threw", e);
    return errorRedirect("channel_fetch_threw");
  }

  // 4. Upsert connected_accounts + connected_account_tokens
  try {
    const snippet = channel.snippet || {};
    const stats = channel.statistics || {};
    const thumbs = snippet.thumbnails || {};
    const account = await upsertConnectedAccount({
      userId,
      platform: "youtube",
      platformAccountId: String(channel.id),
      handle: snippet.customUrl || snippet.title || null,
      displayName: snippet.title || snippet.customUrl || null,
      avatarUrl: thumbs.high?.url || thumbs.default?.url || null,
      meta: {
        view_count: stats.viewCount ?? null,
        subscriber_count: stats.subscriberCount ?? null,
        video_count: stats.videoCount ?? null,
        connected_at: new Date().toISOString(),
      },
    });
    await upsertAccountToken({
      accountId: account.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      scopes: token.scope || YOUTUBE_SCOPES,
    });
  } catch (e) {
    console.error("[oauth-youtube-callback] storage failed", e);
    return errorRedirect("storage_failed");
  }

  // 5. Success — redirect user back to Vantus with a hint
  const back = stateRes.redirectTo && stateRes.redirectTo.startsWith(APP_ORIGIN)
    ? stateRes.redirectTo
    : `${APP_ORIGIN}/?youtube_connected=1`;
  return redirect(back);
};
