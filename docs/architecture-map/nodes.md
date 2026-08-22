# Node Catalog

> One entry per map node, grouped by cluster. ★ = on the critical path.
> Contents: [Client shell](#client-shell) · [Routes](#routes-ui) · [Core logic](#core-logic) · [Serverless](#serverless-netlify) · [Data](#data-supabase) · [External APIs](#external-apis)

## Client shell

### index.html — entry + CSP
`index.html:11` · Vite entry document: fonts (preconnected), the Google Identity script, root div. The hardened CSP lives in `netlify.toml:249` — no inline scripts allowed (an inline `onload=` handler will silently die).
*Plain English: the first file the browser loads; it pulls in fonts, Google sign-in, and the app.*

### App.jsx — boot · auth · session ★
`src/App.jsx:129` · The 1,622-line app shell: boot spinner, `setupSession` (health check raced at 3s since the 8/21 fix for the 15-40s spinner; stuckGuard at `App.jsx:316`), role detection (`profiles.role` can DOWNGRADE an admin email to "agency" — never simplify), realtime listeners, all route mounts. Content fetch no longer blocks first paint.
*Plain English: signs you in, verifies the login still works, decides staff-vs-client, shows the right page.*

### constants.js — 8-group NAV
`src/utils/constants.js:5` · The Danny-confirmed nav: Command / Clients / Work / Content / Growth / Intelligence / Workforce / Admin. 8/21 added `scope` (Work) and `profitability` (Growth). Also NOTIF_META — the one map the bell and digest both render from.

### supabaseClient + apiFetch — session plumbing
`src/services/apiFetch.js` · The browser Supabase client (RLS enforced per session) and the fetch wrapper that attaches the session bearer token to every `/api/*` call.

### ClientPortal.jsx — external client view
`src/ui/client/ClientPortal.jsx` · Approved `client_users` land here instead of the admin shell: just their approval queue. A realtime listener flips pending invites live when an admin approves.

## Routes (UI)

### DashboardRoute — activation + command
`src/ui/dashboard/ActivationBoard.jsx` · Shows red until the founder's data entry lands — that is the checklist working. ActivationBoard (11 real-column checks) + CommandView tiers (critical / requires-you / due today / blocked) + NotificationDigest.

### ApprovalsRoute — internal inbox
`src/ui/routes/ApprovalsRoute.jsx` · Cross-client gate-status queue with deterministic risk text (AI-written rationale is a pending Danny decision, +2-3 days). Client-mode items render read-only — chase, don't override.

### Pipeline + EditContentModal ★
`src/ui/pipeline/EditContentModal.jsx` · The kanban board and the modal where creative edits mint immutable versions and `truthGates()` hard-blocks stale-facts scheduling. Blocked section carries reason/owner/external/escalation (SLA pause).

### LedgerRoute + TruthDrawer ★
`src/ui/routes/LedgerRoute.jsx` · Deliverables board. markPosted REQUIRES a live URL. TruthDrawer shows the full paper trail per item.

### ScopeRoute — Scope Sentinel UI (NEW 8/21)
`src/ui/routes/ScopeRoute.jsx` · Paste an ask → draft classification → human confirm/dismiss/override. Absorbed-value monthly roll-up (confirmed + absorbed_intentionally rows, plain math, no AI).

### ProfitabilityRoute — Profitability Lite (NEW 8/21)
`src/ui/routes/ProfitabilityRoute.jsx` · Per client per month: retainer + invoices PAID that month − hard costs. Labor allocation deliberately excluded (spec cut list). The older Client Analytics margin view keeps its allocation lens — different tool.

### VaultRoute + VaultSecretsSection
`src/ui/vault/VaultSecretsSection.jsx` · Billing profiles + Stripe card-on-file (Checkout mode=setup; Vantus keeps brand/last4 only) + the NEW credentials section: masked dots, audited reveal/copy, 30s auto-remask.

### BillingRoute — invoices
`src/ui/routes/BillingRoute.jsx` · Invoice list/create; "Create & send" produces a Stripe hosted invoice. Create-path never proven with a real invoice.

### ClientsRoute + SetupRoute — CRM + data entry
`src/App.jsx:1501` · Client grid + the Setup cockpit. The Open button routes to the dashboard instead of a client workspace — the Danny-confirmed Phase C bug; the fix IS the workspace shell build.

### ContentIntelRoute — IG performance intel
`src/ui/routes/ContentIntelRoute.jsx` · Rates vs benchmarks ("bars to beat"), Run analysis / Generate ideas, idea Approve/Kill taste loop, promote-to-pipeline.

### ShipRoute — agent ship
`src/ui/routes/ShipRoute.jsx:120` · 3D/Map/List views of the receipts spine. ShipScene3D live (painted art + rigged GLB crew — Sean done); ShipGame is the no-WebGL fallback (lines 122-123); ShipMap is the 2D diagram.

### Reports · ClientAnalytics · Runway — analytics group
`src/ui/routes/ClientAnalyticsRoute.jsx:84` · Delivery KPIs, MRR/margin (labor-allocation lens over `team_members.monthly_cost`), content runway. Each route fetches its own slim 90-day window (Fix #7 era discipline).

### Operations · SoftwareOps — tasks + Dynasty
`src/ui/routes/SoftwareOpsRoute.jsx` · Task board with AI Assign + the admin-only Dynasty control surface via `/api/dynasty`. Gate = `isOpsAdmin` (role admin OR ADMIN_EMAILS) — do NOT simplify to `role==="admin"`.

### Settings · Apps/Skills — config surfaces
`src/ui/settings/FactsAndReports.jsx` · Facts of Record editor with per-client review cycles (editing counts as reviewing), TruthRegistryCard, BackupsCard, and the DB-backed skill-brief deploy page.

### IdeaEngineRoute — concepts lane
`src/ui/routes/IdeaEngineRoute.jsx` · Idea generation feeding the pipeline (muse_* actions).

### PARKED: ShipWorld3D stack
`src/ui/ship/ShipWorld3D.jsx` · The fully-modeled 3D world (+ `src/ship/shipModel.js`, `environment3d.js`, `greebles.js`) and the 2D skins (`shipRenderer.js`, `shipRendererArt.js`) — in-repo, unmounted, waiting on an art-direction pass (`ShipRoute.jsx:120` comment). Also parked: `ripped out features/`, `(experimental)/`.

## Core logic

### approvals.js — recordApproval ★
`src/core/approvals.js` · Browser-side approval writer. MIRRORED with `approval-decision.js` executeDecision — change together. Reject requires feedback; revision_count is bumped by a DB trigger, not here.

### versions.js — immutable versions ★
`src/core/versions.js` · Mints `content_versions` on creative edits; approvals capture `approved_version_id`; TruthDrawer shows "edited since approval" drift. Legacy items without lineage: warn-only, deliberate.

### truth.js — truthGates()
`src/core/truth.js` · Stale client facts HARD-BLOCK scheduling and client-facing statuses. Per-client review frequency set in Settings.

### audit.js — audit writer
`src/core/audit.js` · Best-effort `audit_log` writer — never blocks the change. Vault entries log field names only, never values.

### activation.js + commandDigest.js — honest math
`src/core/activation.js` · The 11 per-client checks (real columns only) behind the red dashboard + the founder-tier digest. ClientsRoute setup % delegates here — one source of truth.

### shipEngine + crewGLB + world — ship simulation
`src/ship/crewGLB.js` · Receipt-driven crew sim (pathfinding, walk/work/idle/sleep) + `createCrewFigure()` GLB loader with procedural fallback. CREW_GLB map: uncomment a line per finished character. GLB-embedded textures load via `blob:` URLs — `blob:` must stay in connect-src.

## Serverless (Netlify)

### agent-action.js — dispatcher ★
`netlify/functions/agent-action.js:84` · The one door for 20+ agent actions: requireUser, rate limit, brand context (`getBrandContext`), the switch, and one `agent_events` receipt per call. `intel_*` and `sentinel_*` blocks are admin-only (403 otherwise) because their writes ride the service key.

### qc · muse · scrappy · cid · sean · ops — creative handlers
`netlify/functions/agent-action/handlers/qc.js` · QC = deterministic fact checks + `aiVision` (sonnet-4-6) judgment on the actual Drive asset; blocker issues stop scheduling. Muse writes, Scrappy researches (Tavily), CID builds briefs, ops runs AI Assign. All `ai()` calls default to `claude-opus-5` since 8/21.

### sentinel.js — Scope Sentinel (NEW 8/21)
`netlify/functions/agent-action/handlers/sentinel.js:104` · `sentinel_classify` (7-class draft judged against real agreement columns + confirmed precedent; unclear NEVER defaults to included) + `sentinel_decide` (human confirm/dismiss/override). Verification currently blocked at the Anthropic credit wall.

### intel.js — content intel
`netlify/functions/agent-action/handlers/intel.js:52` · Deterministic rate math into `content_analysis` + AI winners/losers + idea generation with the taste loop. `follow_rate` and `hook_hold` are null by design (IG API gaps).

### notify.js — fan-out ★
`netlify/functions/notify.js:304` · Approval/revision/comment events → Resend email + Slack + notifications row. Cycle-aware dedupe. Revision-cap alerts email ADMIN_EMAILS only (lines 14-18). EMAIL IS LIVE.

### approval-decision.js — one-click approvals ★
`netlify/functions/approval-decision.js` · GET = scanner-safe confirm page; POST = execute (single-use token, siblings invalidated) or portal-session mode. All writes via SERVICE_KEY. Twin of recordApproval.

### billing-stripe.js — Stripe bridge
`netlify/functions/billing-stripe.js:22` · Create-path (hosted invoices, vault card links) + webhook path (signature-verified; handles invoice.paid / payment_succeeded / voided / uncollectible at lines 220-225).

### vault-secrets.js — credentials API (NEW 8/21)
`netlify/functions/vault-secrets.js` · Admin-only list/save/reveal/remove. AES-256-GCM via `_lib/crypto` (TOKEN_ENC_KEY). List never returns secret material; every reveal writes an audit row. Verified live 8/21.

### chat.js — in-app chat
`netlify/functions/chat.js:16` · Authenticated Anthropic proxy; model allowlist (default sonnet-4-6, haiku selectable); 30 req/min per user.

### dynasty.js — Dynasty proxy
`netlify/functions/dynasty.js` · Admin + rate-limited + action-allowlisted tunnel to dynasty-lead-finder (x-passcode from env). Dynasty-side audit shows actor "Admin" — known tradeoff.

### oauth-* + sync-* — social plumbing (16 functions)
`netlify/functions/sync-instagram.js` · IG/TikTok/YouTube OAuth (tokens encrypted at rest) + nightly metric sync into `account_posts`. Degrade-retry: one unsupported metric no longer loses all insights. Reels watch time stored raw ms.

### cron fleet — 7 scheduled functions
`netlify/functions/check-stuck-items.js:25` · check-stuck-items 16:00 UTC (SLA pause honors external waits) · verify-publishes 16:30 · backup-export 11:00 (8/8 green runs verified 8/21) · intel-refresh 15:30 · chase-overdue-tasks · send-monthly-reports (semi-auto Sprout-PDF flow, by choice) · content-runway-check. Manual runs need `?test=1&key=CRON_TEST_KEY`.

### _lib: requireUser · crypto · rateLimit — shared guards
`netlify/functions/_lib/requireUser.js:109` · Admin = any @cloudscenic.com email; externals via approved `client_users`. Crypto: AES-256-GCM `v1:iv:tag:ct`, refuses plaintext storage if the key is missing. In-memory rate limiter.

## Data (Supabase)

### content_items + versions + approvals — the pipeline spine ★
`supabase/migrations/20260813_truth.sql:13` · content_items (text ids) · content_versions (UPDATE-blocking trigger = immutable) · approvals (insert trigger bumps revision_count) · approval_tokens (RLS zero policies = service-key only) · content_comments (realtime).

### clients + client_users + team — the book
`supabase/migrations/20260805_activation.sql` · clients (retainers, cadence, facts, brand voice, report_recipients, owner) · client_users allowlist · profiles (role override) · team_members (monthly_cost) · client_vault (billing profile, card brand/last4 only).

### decisions + audit_log + registry + backups — Phase B truth layer
`supabase/migrations/20260813_truth.sql:134` · decisions · audit_log (append-only: no update/delete policies) · truth_registry (Sprout=schedule, Stripe=payments, Vantus=approvals) · backup_runs + the encrypted `backups` storage bucket.

### account_posts + content_analysis — performance data
`supabase/migrations/20260813_content_analysis.sql` · connected_accounts (encrypted tokens) · account_posts (bigserial; NO client_id column — joins via connected_accounts) · content_analysis (BIGINT FK — the guide's uuid assumption was wrong and fixed) · content_ideas · content_benchmarks.

### scope_requests + client_costs + vault_secrets — Phase D tables (NEW 8/21)
`supabase/migrations/20260821_phase_d.sql` · scope_requests (7-class check constraint; confirmed absorbed rows ARE the absorbed-value register) · client_costs (hard costs) · vault_secrets (RLS on, zero policies — browser physically blocked) · invoices.

### tasks + notifications + agent_events — operations data
`supabase/migrations/20260729_stuck_alert_state.sql` · tasks · notifications (unique dedupe_key) · agent_events (the single receipts spine — ship, rails, and feeds all render it) · skill_briefs · intake_requests · stuck_alert_state.

## External APIs

### Anthropic API ★
`netlify/functions/agent-action/_shared.js:161` · All agent intelligence. `ai()` defaults `claude-opus-5`; QC vision on sonnet-4-6. **CREDIT BALANCE $0 (8/21)** — everything AI errors until top-up. Opus-5 compat shipped 8/21: parse the first TEXT block (thinking leads content[]), max_tokens floored at 4096.

### Resend — email delivery
`netlify/functions/notify.js:304` · From notifications@cloudscenic.com (domain verified). LIVE, proven 8/21. Key is production-context + secret-typed — the CLI shows masks, which fooled three audits. Cold outreach stays on its own subdomain.

### Stripe — payments
`netlify/functions/billing-stripe.js:22` · System of record for money. Keys set but unproven. Card data never touches Vantus. Webhook endpoint: `usevantus.com/api/billing/stripe-webhook`.

### Slack webhook — team pings
`netlify/functions/agent-action/_shared.js:8` · Global + per-client (clients.slack_webhook_url) pings. Healthy the whole time.

### Google (GIS + Drive + Gemini)
`index.html:11` · Sign-in works. Drive upload broken in prod (origin never registered). Gemini 429s until billing flips (`VANTUS_TODO.md:25`).

### IG / TikTok / YouTube APIs
`netlify/functions/sync-instagram.js` · Read-only performance pulls; Vantus never auto-posts.

### dynasty-lead-finder — external service
`netlify/functions/dynasty.js` · The Dynasty client's lead pipeline, operated through the guarded proxy.

### n8n · Tavily · Apify · Unsplash — support APIs
`netlify/functions/agent-action/_shared.js:5` · Automation webhooks, research, scraping, stock images. All keys present per the 7/18 audit.
