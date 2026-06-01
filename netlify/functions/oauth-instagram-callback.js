// /api/oauth/instagram/callback
//
// Hit by Instagram redirect AFTER the user authorizes. Carries ?code=...&state=...
// No bearer token (this is a top-level browser navigation from instagram.com).
//
// Flow:
//   1. Verify state via oauth_states → get user_id
//   2. Exchange code → short-lived access_token (Instagram API)
//   3. Exchange short-lived → long-lived (60-day) token (Graph API)
//   4. Fetch user profile (id, username, account_type)
//   5. Upsert connected_accounts + connected_account_tokens
//   6. Redirect user back to Vantus

const { consumeOAuthState, upsertConnectedAccount, upsertAccountToken } = require("./_lib/oauth");

const IG_APP_ID = process.env.META_INSTAGRAM_APP_ID;
const IG_APP_SECRET = process.env.META_INSTAGRAM_APP_SECRET;
const IG_REDIRECT_URI = process.env.META_INSTAGRAM_REDIRECT_URI;

const APP_ORIGIN = "https://usevantus.com";

function redirect(url) {
  return { statusCode: 302, headers: { Location: url }, body: "" };
}

function errorRedirect(reason) {
  const url = `${APP_ORIGIN}/?ig_oauth_error=${encodeURIComponent(reason)}`;
  return redirect(url);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  if (!IG_APP_ID || !IG_APP_SECRET || !IG_REDIRECT_URI) {
    console.error("[oauth-ig-callback] missing env: META_INSTAGRAM_APP_ID / META_INSTAGRAM_APP_SECRET / META_INSTAGRAM_REDIRECT_URI");
    return errorRedirect("server_not_configured");
  }

  const params = event.queryStringParameters || {};
  const { code, state, error, error_description } = params;

  // User canceled or Meta returned an error
  if (error) {
    console.warn("[oauth-ig-callback] Meta returned error", { error, error_description });
    return errorRedirect(error_description || error);
  }
  if (!code || !state) return errorRedirect("missing_code_or_state");

  // 1. CSRF: verify state → get user_id
  const stateRes = await consumeOAuthState({ state, platform: "instagram" });
  if (!stateRes.ok) {
    console.warn("[oauth-ig-callback] state verification failed", stateRes.reason);
    return errorRedirect(stateRes.reason);
  }
  const userId = stateRes.userId;

  // 2. Exchange code for short-lived token
  let shortToken;
  let igUserId;
  try {
    const body = new URLSearchParams({
      client_id: IG_APP_ID,
      client_secret: IG_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: IG_REDIRECT_URI,
      code,
    });
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      console.error("[oauth-ig-callback] short-token exchange failed", data);
      return errorRedirect(data.error_message || "short_token_exchange_failed");
    }
    shortToken = data.access_token;
    igUserId = String(data.user_id || data.data?.[0]?.user_id || "");
  } catch (e) {
    console.error("[oauth-ig-callback] short-token exchange threw", e);
    return errorRedirect("short_token_exchange_threw");
  }

  // 3. Exchange short-lived for long-lived (60-day) token
  let longToken;
  let expiresAt;
  try {
    const url =
      `https://graph.instagram.com/access_token` +
      `?grant_type=ig_exchange_token` +
      `&client_secret=${encodeURIComponent(IG_APP_SECRET)}` +
      `&access_token=${encodeURIComponent(shortToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      console.error("[oauth-ig-callback] long-token exchange failed", data);
      return errorRedirect(data.error?.message || "long_token_exchange_failed");
    }
    longToken = data.access_token;
    if (data.expires_in) {
      expiresAt = new Date(Date.now() + Number(data.expires_in) * 1000).toISOString();
    }
  } catch (e) {
    console.error("[oauth-ig-callback] long-token exchange threw", e);
    return errorRedirect("long_token_exchange_threw");
  }

  // 4. Fetch user profile (id, username, account_type, profile picture)
  let profile = {};
  try {
    const url =
      `https://graph.instagram.com/me` +
      `?fields=id,username,account_type,profile_picture_url` +
      `&access_token=${encodeURIComponent(longToken)}`;
    const res = await fetch(url);
    profile = await res.json();
    if (!res.ok || !profile.id) {
      console.warn("[oauth-ig-callback] profile fetch returned non-ok", profile);
      // Non-fatal — we still have the token. Fall back to the user_id from step 2.
      profile = { id: igUserId };
    }
  } catch (e) {
    console.warn("[oauth-ig-callback] profile fetch threw", e);
    profile = { id: igUserId };
  }

  // 5. Upsert connected_accounts + connected_account_tokens
  try {
    const account = await upsertConnectedAccount({
      userId,
      platform: "instagram",
      platformAccountId: String(profile.id),
      handle: profile.username || null,
      displayName: profile.username || null,
      avatarUrl: profile.profile_picture_url || null,
      meta: {
        account_type: profile.account_type || null,
        connected_at: new Date().toISOString(),
      },
    });
    await upsertAccountToken({
      accountId: account.id,
      accessToken: longToken,
      expiresAt,
      scopes: "instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish",
    });
  } catch (e) {
    console.error("[oauth-ig-callback] storage failed", e);
    return errorRedirect("storage_failed");
  }

  // 6. Success — redirect user back to Vantus with a hint
  const back = stateRes.redirectTo && stateRes.redirectTo.startsWith(APP_ORIGIN)
    ? stateRes.redirectTo
    : `${APP_ORIGIN}/?ig_connected=1`;
  return redirect(back);
};
