// /api/oauth/tiktok/callback
//
// Hit by TikTok redirect AFTER the user authorizes. Carries ?code=...&state=...
// No bearer token (this is a top-level browser navigation from tiktok.com).
//
// Flow:
//   1. Verify state via oauth_states → get user_id
//   2. Exchange code → access_token + refresh_token
//   3. Fetch user profile (open_id, username, display_name, avatar)
//   4. Upsert connected_accounts + connected_account_tokens
//   5. Redirect user back to Vantus

const { consumeOAuthState, upsertConnectedAccount, upsertAccountToken } = require("./_lib/oauth");

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;

const APP_ORIGIN = "https://usevantus.com";

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: "" };
}

function errorRedirect(reason) {
  const url = `${APP_ORIGIN}/?tiktok_oauth_error=${encodeURIComponent(reason)}`;
  return redirect(url);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET || !TIKTOK_REDIRECT_URI) {
    console.error("[oauth-tiktok-callback] missing env: TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI");
    return errorRedirect("server_not_configured");
  }

  const params = event.queryStringParameters || {};
  const { code, state, error, error_description } = params;

  // User canceled or TikTok returned an error
  if (error) {
    console.warn("[oauth-tiktok-callback] TikTok returned error", { error, error_description });
    return errorRedirect(error_description || error);
  }
  if (!code || !state) return errorRedirect("missing_code_or_state");

  // 1. CSRF: verify state → get user_id
  const stateRes = await consumeOAuthState({ state, platform: "tiktok" });
  if (!stateRes.ok) {
    console.warn("[oauth-tiktok-callback] state verification failed", stateRes.reason);
    return errorRedirect(stateRes.reason);
  }
  const userId = stateRes.userId;

  // 2. Exchange code for access + refresh token
  let token;
  try {
    const body = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: TIKTOK_REDIRECT_URI,
    });
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    token = data?.data || data;
    if (!res.ok || !token?.access_token) {
      console.error("[oauth-tiktok-callback] token exchange failed", data);
      return errorRedirect(data.error_description || data.message || data.error || "token_exchange_failed");
    }
  } catch (e) {
    console.error("[oauth-tiktok-callback] token exchange threw", e);
    return errorRedirect("token_exchange_threw");
  }

  // 3. Fetch user profile
  let profile;
  try {
    const url =
      `https://open.tiktokapis.com/v2/user/info/` +
      `?fields=${encodeURIComponent("open_id,union_id,avatar_url,display_name,username,follower_count,video_count")}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const data = await res.json();
    profile = data?.data?.user || {};
    if (!res.ok || !profile.open_id) {
      console.error("[oauth-tiktok-callback] profile fetch failed", data);
      return errorRedirect(data.error?.message || data.message || "profile_fetch_failed");
    }
  } catch (e) {
    console.error("[oauth-tiktok-callback] profile fetch threw", e);
    return errorRedirect("profile_fetch_threw");
  }

  // 4. Upsert connected_accounts + connected_account_tokens
  try {
    const account = await upsertConnectedAccount({
      userId,
      platform: "tiktok",
      platformAccountId: String(profile.open_id),
      handle: profile.username || null,
      displayName: profile.display_name || profile.username || null,
      avatarUrl: profile.avatar_url || null,
      meta: {
        union_id: profile.union_id || null,
        follower_count: profile.follower_count ?? null,
        video_count: profile.video_count ?? null,
        connected_at: new Date().toISOString(),
      },
    });
    await upsertAccountToken({
      accountId: account.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      expiresAt: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      scopes: "user.info.profile,user.info.stats,video.list",
    });
  } catch (e) {
    console.error("[oauth-tiktok-callback] storage failed", e);
    return errorRedirect("storage_failed");
  }

  // 5. Success — redirect user back to Vantus with a hint
  const back = stateRes.redirectTo && stateRes.redirectTo.startsWith(APP_ORIGIN)
    ? stateRes.redirectTo
    : `${APP_ORIGIN}/?tiktok_connected=1`;
  return redirect(back);
};
