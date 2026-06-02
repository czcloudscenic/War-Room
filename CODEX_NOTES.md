# CODEX_NOTES - TikTok + YouTube OAuth/fetchers

## 1. Summary

TikTok and YouTube are wired end-to-end in the same shape as the existing Instagram integration:

- Settings -> Connected Accounts can start TikTok and YouTube OAuth.
- OAuth callbacks upsert `connected_accounts` and `connected_account_tokens`.
- "Sync now" routes call platform fetchers and upsert recent videos into `account_posts`.
- Analytics should auto-light-up because `AnalyticsRoute.jsx` already has TikTok and YouTube in `PLATFORM_META`.

Validation completed locally:

- `npm run build` passed after every commit and once again before this report.
- `node --check` passed for all 10 new Netlify function files.

Live OAuth/API validation was not run because platform apps and Netlify env vars are not configured locally.

## 2. Files created

- `netlify/functions/oauth-tiktok-start.js` - 71 lines
- `netlify/functions/oauth-tiktok-callback.js` - 136 lines
- `netlify/functions/oauth-tiktok-deauthorize.js` - 25 lines
- `netlify/functions/oauth-tiktok-data-deletion.js` - 32 lines
- `netlify/functions/sync-tiktok.js` - 286 lines
- `netlify/functions/oauth-youtube-start.js` - 73 lines
- `netlify/functions/oauth-youtube-callback.js` - 137 lines
- `netlify/functions/oauth-youtube-deauthorize.js` - 24 lines
- `netlify/functions/oauth-youtube-data-deletion.js` - 32 lines
- `netlify/functions/sync-youtube.js` - 293 lines

## 3. Files modified

- `netlify.toml`
  - Added 5 TikTok redirects: start, callback, deauthorize, data-deletion, sync.
  - Added 5 YouTube redirects: start, callback, deauthorize, data-deletion, sync.
  - Added `[functions."sync-tiktok"] timeout = 26`.
  - Added `[functions."sync-youtube"] timeout = 26`.
  - Appended TikTok hosts to CSP `connect-src` and `form-action`.
  - Appended YouTube/Google hosts to CSP `connect-src` and `form-action`.
- `src/ui/settings/ConnectedAccountsCard.jsx`
  - Enabled TikTok by adding `/api/oauth/tiktok/start` and `/api/sync/tiktok`.
  - Enabled YouTube by adding `/api/oauth/youtube/start` and `/api/sync/youtube`.
  - Left LinkedIn as `comingSoon: true`.
- `CODEX_NOTES.md`
  - Overwritten with this report.

## 4. Env vars founder needs to set in Netlify

TikTok:

- `TIKTOK_CLIENT_KEY=<TikTok developer app client key>`
- `TIKTOK_CLIENT_SECRET=<TikTok developer app client secret>`
- `TIKTOK_REDIRECT_URI=https://usevantus.com/api/oauth/tiktok/callback`

YouTube:

- `GOOGLE_CLIENT_ID=<new Google Cloud OAuth client ID for YouTube access>`
- `GOOGLE_CLIENT_SECRET=<new Google Cloud OAuth client secret for YouTube access>`
- `YT_REDIRECT_URI=https://usevantus.com/api/oauth/youtube/callback`

Existing required env must remain set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Important: the YouTube OAuth client should be separate from Supabase Auth's Google credentials so the consent screen is for Vantus YouTube access, not Supabase sign-in.

## 5. Platform-side setup founder must do

TikTok:

- Create/configure a TikTok developer app at `developers.tiktok.com`.
- Add the redirect URI `https://usevantus.com/api/oauth/tiktok/callback`.
- Request/configure scopes: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`.
- Add Netlify env vars listed above.

YouTube / Google:

- Create a new OAuth 2.0 client in Google Cloud Console.
- Add the redirect URI `https://usevantus.com/api/oauth/youtube/callback`.
- Enable YouTube Data API v3.
- Enable YouTube Analytics API too if Google requires it for the `yt-analytics.readonly` consent scope.
- Configure OAuth consent screen with the YouTube readonly scopes.
- Add Netlify env vars listed above.

## 6. Quirks / gotchas hit

- TikTok access tokens expire quickly, so `sync-tiktok.js` refreshes when `token_expires_at` is within 60 seconds and preserves the old refresh token if TikTok does not return a new one.
- Google only issues a YouTube refresh token when the authorize URL includes `access_type=offline` and `prompt=consent`; both are included.
- YouTube `likeCount` and `commentCount` can be absent if disabled, so the sync maps those to null and excludes null values from the engagement numerator.
- YouTube sync uses Data API v3 `statistics` for MVP. There is a code comment noting YouTube Analytics API can be added later for deeper metrics like impressions and watch time.
- CSP `img-src` was intentionally not extended because the brief said not to touch other CSP directives. If TikTok/YouTube thumbnails are blocked in browser rendering, add the actual thumbnail/CDN hosts in a follow-up.

## 7. Test plan

1. Set the Netlify env vars above and deploy after merging.
2. In Vantus, open Settings -> Connected Accounts.
3. Click TikTok Connect, complete OAuth, return to Vantus, confirm a TikTok row appears in `connected_accounts`.
4. Click TikTok Sync now, confirm `account_posts` receives `platform='tiktok'` video rows with `views`, `likes`, `comments`, `shares`, and `engagement_rate` in `metrics`.
5. Open Analytics and confirm TikTok appears once data exists.
6. Repeat steps 3-5 for YouTube and confirm `account_posts` receives `platform='youtube'` video rows with `views`, `likes`, `comments`, and `engagement_rate`.
7. In Netlify logs, confirm no OAuth callback, token refresh, or sync errors.
8. Optional token refresh check: temporarily set a connected account token's `token_expires_at` to a past timestamp in a non-prod-safe test path and run Sync now to verify refresh succeeds.

## 8. Anything punted / skipped

- No live OAuth or API sync was run because credentials/platform apps are not available locally.
- TikTok and YouTube deauthorize/data-deletion endpoints are stubs, matching the current Instagram stub pattern.
- YouTube Analytics API deeper metrics were not fetched for MVP.
- No Supabase migrations were added; schema was left untouched per brief.
- LinkedIn was left as coming soon.
- Existing untracked `sprint-recap.html` was present before this task and was left untouched.
