# Nodes — full catalog

> Every node from `architecture-map.html`, grouped by cluster. **critical** = on the QC-gate spine.

**ToC:** [Client](#client-browser) · [Server entry](#server-entry) · [Netlify Functions](#netlify-functions) · [Supabase data](#supabase-data) · [External APIs](#external-apis)

## Client (browser)

### App.jsx — root · 1,414 lines · critical
`src/App.jsx` · Root component: 4-way auth gate, owner of global state, all realtime subscriptions, QC auto-trigger. **Plain:** the heart of the browser app — decides who you are, keeps the live data, and automatically summons the QC agent when a deliverable reaches the approval gate. Notes: setupSession 82-239; handleSave 713-753 (QC fire at 743-749); realtime content_items 491-522 unfiltered, clients 554-560, notifications 602-615; global content fetch at 476.

### EditContentModal.jsx — SOP gates + Drive upload · critical
`src/ui/pipeline/EditContentModal.jsx` · Deliverable form with hard QC gate and Google Drive resumable upload (anyone-with-link at 105-109). **Plain:** where content is written and files attached; refuses to schedule a QC-blocked item. Notes: SOP gates 16-47; QC hard gate 37-44; camelCase hydration fixed 7/3.

### LedgerRoute.jsx — approval surface · critical
`src/ui/routes/LedgerRoute.jsx` · Approve / Request revisions / Mark posted / Run QC with QC verdict panel. **Plain:** the screen where work gets approved — blocked items are refused with the reason. Notes: doApprove gate 74-78; doQC 85-99.

### core/approvals.js — audit + advance + notify · critical
`src/core/approvals.js` · recordApproval 28-66: audit row → status advance → /api/notify. **Plain:** the bookkeeping for every yes/no. Bug: patches status not stage (45-47); markPosted at 77 sets runtime-only "Posted".

### SetupRoute + FactsAndReports — data entry
`src/ui/routes/SetupRoute.jsx` (317) + `src/ui/settings/FactsAndReports.jsx` (269) · Retainers/scope, account mapping, owners/dates, roster, Facts of Record, monthly report uploads. **Plain:** where humans teach Vantus the truth QC checks against. Notes: roster emails empty (0/7); worst mobile page (7/4 audit).

### VaultRoute.jsx — billing profiles + cards
`src/ui/routes/VaultRoute.jsx` (205) · Per-client billing profile + Stripe-vaulted card-on-file. **Plain:** billing details page; card numbers only ever typed on Stripe's page.

### BillingRoute.jsx — invoices
`src/ui/routes/BillingRoute.jsx` (213) · Invoice CRUD, Stripe create-path, Resend fallback email (fires only on Stripe failure, 104-112).

### IdeaEngineRoute.jsx — ideation → pipeline
`src/ui/routes/IdeaEngineRoute.jsx` (290) · muse_idea_list / muse_film_brief actions; browser-side insert of picked ideas (content_items at 83).

### Reports · ClientAnalytics · Operations — scoreboards + tasks
`src/ui/routes/ReportsRoute.jsx` (181) · `ClientAnalyticsRoute.jsx` (250) · `OperationsRoute.jsx` (254) · Approval scoreboard, per-client social analytics, DB-backed task board with ops_assign.

### AgentChatPage + CommandInput — chat · sonnet
`src/ui/agents/AgentChatPage.jsx` (438, model at :178) + `src/core/routeTask.js` (:34) + TeamBroadcast (:37) · All chat via /api/chat on claude-sonnet-4-6. Context scoped to the active client since 7/3.

### SettingsPage + ConnectedAccountsCard — OAuth + sync
`src/ui/settings/ConnectedAccountsCard.jsx` (233) · Platform connect (oauth start) + manual sync triggers (lines 7-9).

### apiFetch + supabaseClient — shared plumbing
`src/services/apiFetch.js` (25) · `src/services/supabaseClient.js` (28) · Bearer-token fetch wrapper (26+ call sites) and the sb singleton.

### QuickActionsDashboard · PlaceholderPage · TypingTask — DEAD, zero render sites
`src/ui/dashboard/QuickActionsDashboard.jsx` (122) · `src/ui/shared/PlaceholderPage.jsx` (16) · `src/ui/shared/TypingTask.jsx` (13) · Imported at App.jsx:20/25/26, rendered nowhere. Delete (Fix #6).

## Server entry

### netlify.toml — /api/* redirects · critical
Maps every /api path to its function; 26s timeouts on the heavy ones; HSTS/CSP/Permissions-Policy headers live here too.

### cron 13:00 UTC — send-monthly-reports
`schedule = "0 13 * * *"` · report send pass + missing-PDF nag pass. Test path gated by CRON_TEST_KEY since 7/3.

### cron 14:00 UTC — chase-overdue-tasks
`schedule = "0 14 * * *"` · overdue-task nudges.

### Provider callbacks — Stripe · Meta · TikTok · Google
Stripe webhook (signature-verified), OAuth callbacks (CSRF state), deauth/data-deletion (HMAC for Meta/TikTok; Google unsigned — no scheme offered).

## Netlify Functions

### agent-action.js — dispatcher · 1,753 lines · critical
16-action switch. ai() default haiku-4-5 (:176); aiVision() sonnet-4-6 (:201). Tiers: haiku ×10 · sonnet ×4 (qc_review, muse_ig_ideas, muse_idea_list, muse_film_brief) · opus ×1 (scrappy_analyze_performance :1582). Dead N8N constant :21. Every run → agent_events + Slack.

### qc_review — hybrid vision gate · critical
`netlify/functions/agent-action.js:333` · Load item + facts → fetchDriveImage (:235, 3 imgs, 4.5MB, image/*) → sonnet vision strict-JSON → runExactFactChecks (offers/prices/phones = blockers) → PATCH qc_* (:441). Video not frame-checked (v1, warning emitted).

### chat.js — Anthropic proxy
88 lines · model allowlist sonnet/haiku (:16), default sonnet-4-6 (:17), 30/min rate limit.

### notify.js — fan-out · 385 lines · critical
Bell row (dedupe-gated since 7/3) → Resend email → per-client-or-global Slack (:246) → n8n (:369). invoice_sent template path at :205. From notifications@cloudscenic.com (domain verified 7/3).

### billing-stripe.js — create + vault + webhook
234 lines · handleCreate (:64, unproven live), vault_link/vault_sync (setup-mode Checkout, card stub sync), webhook invoice.paid/voided → invoices PATCH (:220-226).

### send-monthly-reports.js — cron mailer
197 lines · send pass (sent_at-gated) + nag pass (28th + days 1-5, once/client/day dedupe). Reads private client-reports bucket via service key. Nag verified live 7/3.

### chase-overdue-tasks.js — cron nudger
161 lines · overdue scan → Resend digests + Slack + bell rows. Blocked in practice by empty roster emails.

### sync-instagram/tiktok/youtube — metrics pull ×3
283/309/302 lines · pull posts/metrics into account_posts; TikTok/YouTube token refresh + AES re-encrypt.

### oauth-* ×11 — connect + compliance
start (CSRF state) / callback (code→token, encrypted) / deauthorize + data-deletion (HMAC Meta/TikTok) + public deletion-status page. States expire in 10 min.

### _lib/ — requireUser · rateLimit · crypto · oauth
Auth gate + CORS allowlist (141) · in-memory rate limits (66) · AES-256-GCM with PLAINTEXT fallback if key unset (59, :7) · OAuth state/store helpers (328).

### unsplash.js · apify-scrape.js — research proxies
62 / 315 lines · both requireUser-gated.

## Supabase data

### content_items — the deliverables · critical
TEXT id; pipeline status/stage; ledger cols; qc_status/qc_issues/qc_ran_at. publish_date is TEXT (:47 of baseline). RLS: admins full, clients scoped SELECT/UPDATE, anon zero.

### clients — tenants + facts of record · critical
Brand voice, scope/retainer, client_facts JSONB (hours/locations/prices/offers), facts_updated_at staleness. Deprecated slack_channel_id column still present.

### approvals — decision audit trail
Who/what/when/stage/feedback. Admin write, clients read own.

### notifications — bell + dedupe key
unique(type, content_item_id) = permanent first-writer-wins dedupe across bell AND (since 7/3) Slack/email.

### agent_events — agent activity log
One row per action run; realtime feeds the dashboard ActivityFeed.

### client_reports + client-reports bucket — monthly PDFs
unique(client_id, month); private bucket (anon gets "Bucket not found" — verified 7/3).

### client_vault — billing profiles
Admin-only RLS, no client/anon policies; card stubs only (brand/last4/expiry + Stripe ids).

### invoices + stripe_customers — money rows
Local ledger with stripe linkage; webhook keeps paid/void in sync.

### tasks + team_members — ops board
DB-backed tasks (the dashboard OpsBoard widget is separate, local-only state); roster the chase cron emails (emails currently blank).

### connected_accounts + connected_account_tokens + account_posts + oauth_states — social graph ×4
Tokens table has RLS on with ZERO policies = service-role only. account_posts unique(account_id, platform_post_id).

### cid_library + cid_performance — hook research
Competitor hooks (scrappy_hook_analysis writes) + prediction-vs-actual.

### profiles + client_users — identity + allowlist
Roles + the invite allowlist (pending/approved/rejected); App.jsx watches client_users realtime to auto-unlock.

### data_deletion_requests — compliance log
Meta/TikTok deletion callbacks with public status codes; service-role only.

## External APIs

### Anthropic API — haiku · sonnet · opus · critical
haiku-4-5 grunt · sonnet-4-6 QC vision/ideation/chat · opus-4-8 performance analysis. muse_write_content still haiku (Fix #2).

### Google Drive + GIS — asset store · critical
Files uploaded from the browser (anyone-with-link); QC fetches bytes back. OAuth client in GCloud project "Vital Lyfe War Room" (458336864067); usevantus.com origin added 7/3 — first working prod upload that night.

### Resend — transactional email
Reports/invoices/notifies/digests from notifications@cloudscenic.com. Domain verified 7/3 (email was dead before).

### Slack webhook — #vantus-test
QC verdicts, agent runs, approval cards, report sends/nags; per-client override supported.

### Stripe — live mode
Hosted invoices, setup-mode Checkout card vaulting, signature-verified webhook.

### Instagram Graph / TikTok API / YouTube Data API
OAuth + post pulls + compliance callbacks (HMAC for Meta/TikTok; Google unsigned).

### Tavily + Apify + Unsplash — research trio
Scrappy research, scrape actors, stock photos.

### n8n cloud — automation webhook
notify.js fan-out target (:369). agent-action.js declares but never calls it (:21, dead constant).
