# Roadmap — Numbered Fixes

> Regenerated 2026-06-03. Numbering matches the FIXES badges in `architecture-map.html` and the references in [known-bugs.md](known-bugs.md) / [open-items.md](open-items.md).

### #1 — Repair the CID write path
**Touches:** `src/apps/competitor-intel/CIDPage.jsx:368,381,442`
- Stop writing `content_items` / `cid_performance` with bare `SUPABASE_URL`/`SUPABASE_KEY` (undefined → ReferenceError).
- Route both writes through `sb.from(...).insert(...)` so RLS + the user's auth token apply, OR add a service-role Netlify function and POST through `apiFetch`.
- Drop the client-set `id: Date.now()` and let Postgres generate it.
- **Unblocks:** the entire "Send to Content Tracker" + "Log Results" feature (currently dead on click).

### #2 — Add baseline migrations for `cid_library` + `cid_performance`
**Touches:** `supabase/migrations/`, `agent-action.js:822`, `CIDPage.jsx:442`
- Write `CREATE TABLE IF NOT EXISTS` migrations mirroring the `content_items` baseline pattern, with admin + scoped-user RLS.
- Capture the column shapes documented in `agent-action.js:759-763` and the `cid_performance` insert body.
- **Unblocks:** removes the two HIGH schema-drift risks; makes the CID feature reproducible from the repo.

### #3 — Scope "Why these won" to true top performers + unify ranking
**Touches:** `src/ui/routes/AnalyticsRoute.jsx:262`, `netlify/functions/agent-action.js:1087`
- Agree one ranking metric (engagement_rate, not raw views) and use it in both the backend `top` selection and the frontend `topPerformers` sort.
- Limit per-post "why it won" reasons to the genuine top N (e.g. top 3), not a broad set across many cards.
- Confirm `reasons[p.id]` keys line up with the displayed cards.
- **Operator-flagged this morning. Highest-visibility quick win.**

### #4 — Add rate limiting to ungated functions
**Touches:** `apify-scrape.js`, `unsplash.js`, `sync-instagram.js`, `sync-tiktok.js`, `sync-youtube.js`, `notify.js`, `_lib/rateLimit.js`
- Import `rateLimit`/`tooManyRequests` and gate each with a sensible per-user cap (e.g. apify 20/min, sync 10/min, notify 20/min).
- **Unblocks:** bounds Apify spend, paid-API hammering, and email/Slack/n8n fanout abuse.

### #5 — Implement OAuth deauthorize + data-deletion
**Touches:** the 6 `oauth-*-deauthorize.js` / `oauth-*-data-deletion.js`, `_lib/oauth.js`
- Verify the platform `signed_request`/signature, resolve the platform account id, and delete the matching `connected_accounts` + `connected_account_tokens` rows.
- Return a real, persisted confirmation code for data-deletion.
- **Unblocks:** platform App Review compliance; closes the "revoked token persists" gap.

### #6 — Encrypt OAuth tokens at rest
**Touches:** `_lib/oauth.js:122`, `connected_account_tokens`, `sync-*.js`
- Encrypt `access_token`/`refresh_token` (pgcrypto or app-level envelope encryption / Supabase Vault); decrypt only inside the sync/refresh functions.
- **Depends on:** nothing; pairs naturally with #5.

### #7 — Escape user input in notify.js email/Slack
**Touches:** `notify.js:123,138-144`
- HTML-escape `title`, `campaign`, `platform`, `pillar`, `client_note` before interpolating into the email body; sanitize Slack text too.

### #8 — Validate the chat.js forward
**Touches:** `chat.js:43-52`
- Allowlist `model`, clamp `max_tokens`, reject oversized bodies before forwarding to Anthropic.

### #9 — Scope `content_items` realtime + initial load by client
**Touches:** `App.jsx:134,489`
- Add `filter: client_id=eq.<id>` to the content channel (re-subscribe on `currentClient.id` change) and scope the initial select — mirror the notifications subscription pattern (`:586`).
- **Unblocks:** removes the multi-tenant realtime leak if an external client role ever reaches the main shell.

### #10 — Tighten `profiles` RLS
**Touches:** `002_profiles.sql:20`
- Drop the `FOR ALL USING(true)` policy (service role bypasses RLS anyway); keep self-read + admins-read-all.

### #11 — Remove dead code
**Touches:** `agent-action.js:669` (`muse_from_brief`), `App.jsx:12,20,32,33` (OPS_INIT, QuickActionsDashboard, TypingTask, PlaceholderPage)
- Delete the unused handler and imports; optionally delete the orphaned component files.

### #12 — Fix sync-instagram insight fetching
**Touches:** `sync-instagram.js:18,89,197`
- Wire the declared `INSIGHTS_TIMEOUT_MS` into an `AbortController` in `fetchInsights`; parallelize the per-media loop with `Promise.all` + a concurrency cap to stay under the 26s function timeout.

### #13 — Fix stuckGuard comment drift
**Touches:** `App.jsx:238`
- Update the comment to 8s, or lower the timeout to the documented intent (cancel-on-resolve guard makes ~4-5s safe UX).

### #14 — Clean up expired `oauth_states`
**Touches:** `supabase/migrations/`, scheduled function
- Add a pg_cron job or scheduled Netlify function deleting `where expires_at < now()`.

### #15 — Make SettingsPage toggles real (or honest)
**Touches:** `SettingsPage.jsx:154-157,297`
- Persist the AI toggles + invite to a settings table, or relabel as "coming soon" / disable.

### #16 — De-couple tenant seed + parameterize dev proxy
**Touches:** migrations, `vite.config.js:12`
- Move the VitalLyfe seed out of the canonical migration set into a dev-only seed file; pull the dev proxy target from an env var.

### #17 — Harden CORS + reconcile agent-count copy
**Touches:** `_lib/requireUser.js:26`; `TeamBroadcast.jsx:76`, `AgentChatPage.jsx:216`, `SkillsPage.jsx:44`
- Reject (403) state-changing requests from non-allowlisted origins instead of fail-open.
- Reconcile the "8 agents" / "7 Agents" strings to the real count (4).

---

## Suggested attack order

See [open-items.md](open-items.md#suggested-attack-order) for the ranked plan — the short version: **#3 first** (operator-flagged, high visibility, contained), then **#1 + #2 paired** (broken CID write + its missing migrations), then the security batch **#4 + #5 + #6 + #7**.
