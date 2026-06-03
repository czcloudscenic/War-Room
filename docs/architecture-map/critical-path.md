# Critical Path — the Agent Action Spine

The most important code path in Vantus is the **AI agent action chain**: every AI button (write content, generate ideas, analyze performance, research) flows through one authenticated router. The newest feature — `scrappy_analyze_performance` ("Why these won") — rides this exact spine, so understanding it explains most of the app.

> Citations are `file:line`. Operation kind tagged per step.

| # | Step | Where | Kind |
|---|---|---|---|
| 1 | User clicks an AI action (e.g. "✨ Why these won") | `src/ui/routes/AnalyticsRoute.jsx:171` | UI |
| 2 | Call routed through the token-injecting fetch wrapper | `src/services/apiFetch.js:17` | — |
| 3 | Fresh access token pulled from the Supabase session | `src/services/apiFetch.js:18` → `src/services/supabaseClient.js:15` | `[AUTH]` |
| 4 | `POST /api/agent-action` with `{action, payload, client_id}` + Bearer token | `netlify.toml:14` → `netlify/functions/agent-action.js:1166` | `[HTTP]` |
| 5 | Auth gate: JWT verified against `/auth/v1/user`, then admin/approved-client check | `netlify/functions/_lib/requireUser.js:58` | `[AUTH]` |
| 6 | Rate limit: sliding window `agent-action:<user.id>`, 60/min | `netlify/functions/_lib/rateLimit.js:34` (called at `agent-action.js:1180`) | `[RL]` |
| 7 | Per-client brand voice loaded from `clients.brand_voice_md` (+ pillar parse) | `netlify/functions/agent-action.js:122` | `[DB]` |
| 8 | Switch dispatches to the matching handler (13 actions) | `netlify/functions/agent-action.js:1199` | — |
| 9a | **Analysis path:** read `account_posts` (limit 500) + `connected_accounts`, bucket by platform, median baseline, top 6 | `netlify/functions/agent-action.js:1087` | `[DB]` |
| 9b | **Write path (e.g. muse_ig_ideas):** read existing items, build prompt | `netlify/functions/agent-action.js:981` | `[DB]` |
| 10 | Claude call via shared `ai()` → `claude-haiku-4-5-20251001` | `netlify/functions/agent-action.js:166` | `[LLM]` |
| 11 | Result written back (insert `content_items`, or returned `insights`+`reasons`) | `netlify/functions/agent-action.js` | `[DB]` |
| 12 | Every invocation logged to `agent_events` (fire-and-forget) | `netlify/functions/agent-action.js:72` | `[DB]` |
| 13 | Mapped actions mirrored to Slack | `netlify/functions/agent-action.js:143` | `[API]` |
| 14 | JSON response returns → UI renders (insights panel + per-card reasons) | `src/ui/routes/AnalyticsRoute.jsx:178,501,596` | UI |

---

## Secondary spine — Connect → Sync → Analyze (the pivot data path)

This is the data pipeline the analyzer depends on. Worth reading alongside the agent-action spine.

| # | Step | Where | Kind |
|---|---|---|---|
| 1 | User clicks "Connect" on a platform | `src/ui/settings/ConnectedAccountsCard.jsx:71` | UI |
| 2 | `POST /api/oauth/<platform>/start` → mint CSRF state, return authorize URL | `netlify/functions/oauth-youtube-start.js:43` → `_lib/oauth.js:65` | `[DB]` |
| 3 | Browser redirects to platform consent; platform calls back | `netlify/functions/oauth-youtube-callback.js:52` | `[API]` |
| 4 | State consumed (once), code exchanged for tokens, profile fetched | `_lib/oauth.js:78` + callback | `[API]` |
| 5 | Upsert `connected_accounts` + `connected_account_tokens` (plaintext) | `_lib/oauth.js:96,122` | `[DB]` |
| 6 | User clicks "Sync now" → `POST /api/sync/<platform>` | `ConnectedAccountsCard.jsx:109` → `sync-youtube.js:108` | `[HTTP]` |
| 7 | (TT/YT) refresh token if expiring; pull recent posts + metrics | `sync-youtube.js:172` | `[API]` |
| 8 | Upsert into `account_posts` (conflict key `account_id,platform_post_id`) | `sync-youtube.js:264` | `[DB]` |
| 9 | AnalyticsRoute reads `account_posts` + realtime; renders metrics/top performers | `AnalyticsRoute.jsx:104,128` | `[DB]` |
| 10 | "Why these won" → re-enters the agent-action spine at step 9a above | `AnalyticsRoute.jsx:171` | — |

**Note:** Instagram differs — its callback does a 2-step token exchange and gets a **60-day token with no refresh** (re-auth required at expiry), while TikTok and YouTube store refresh tokens the sync functions auto-renew.
