# Vantus Handoff Brief

## 2026-07-18 session — env re-audit (keys now EMPTY not malformed), agent-action.js monolith split (Codex, reviewed+merged)

**Nothing pushed, nothing deployed.** `main` is now **18 commits ahead of `origin`** (9 held from 7/9–7/13 + this session's board doc + Codex's 9-commit refactor). All builds clean. Everything ships the moment a one-shot PAT arrives.

**🔑 Live env re-audited today — state CHANGED since 7/12.** Re-checked the linked Netlify env (names + length/prefix only; value reads are classifier-blocked, as intended). The three integrations the 7/12 sprint found *malformed* are now **empty** — someone cleared the bad values but never pasted good ones, so all three are still dead:
- `STRIPE_SECRET_KEY` → **empty** (was bad 20/64-char). Billing "Create & send" still errors.
- `STRIPE_WEBHOOK_SECRET` → **empty**. Paid-sync can't verify signatures.
- `RESEND_API_KEY` → **empty** (was bad 20-char). All email still dead.
- Rogue var **named** `re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH` → **STILL PRESENT** (now empty-valued). Its NAME is a burned Resend key visible in every env listing = compromised. Delete the var + revoke that key in Resend.
- Healthy: `SUPABASE_SERVICE_KEY` is the new `sb_…` format (len 41); Anthropic/Slack/Tavily/Apify/Meta/TikTok/YT/Google keys all present + correctly shaped. Full re-verified checklist is at the top of `VANTUS_TODO.md` (updated 7/18).

**🧱 agent-action.js monolith split — SHIPPED to `main` (local), reviewed byte-for-byte.** The Fix #4 handler-split (speced May, branch never merged) never landed and the file had grown to **1,750 lines**. Briefed Codex (`/tmp/codex-brief-agent-action-split.md`); it ran in its own worktree on `codex/grunt-2026-07-18`, split into a **158-line router** + `agent-action/_shared.js` + six agent modules (`handlers/{qc,muse,scrappy,sean,cid,ops}.js`), 9 incremental commits.
- **Reviewed, not trusted:** line-level multiset diff of the original vs the split = **zero original logic lines lost** (only import/export boilerplate added); all **16 action cases route** with exact original signatures; `node --check` + router load-smoke + `npm run build` all green; scope confined to the 7 new files + CODEX_NOTES.
- **Gotcha worth keeping:** `npm run build` (Vite) only bundles `src/` — it does **NOT** touch `netlify/functions/`, so a green build proves nothing about a function refactor. Verify functions with `node --check` + a `require()` load smoke test instead. The brief carried this; future function-refactor briefs must too.
- Fast-forward merged (preserves the 9 granular commits for bisect); worktree removed.

**Next clean Codex target (not started):** App.jsx → hooks state extraction (1,444 lines, no `src/hooks/` yet). Riskier than the agent-action split — it *can* change behavior — so write a state-cluster map prep first before handing it off.

**Christian's ~15-min console session still clears the whole board** (full checklist in `VANTUS_TODO.md`): paste real Stripe (x2) + Resend keys; delete the rogue Resend var + revoke it; register `https://usevantus.com` as a Google OAuth JS origin; transfer usevantus.com → Cloud Scenic Pro team (unblocks auto-deploy); flip Gemini billing; rotate Supabase passwords; revoke the old exposed PAT; hand over one PAT → push the 18 held commits.

---

## 2026-07-09 session — runway work pushed + shipped, Netlify deploy failure root-caused (wrong team), repo cleanup

**Live state:** the 3 runway/handoff commits (`4e9260e` drought detection + Mon/Fri digests + Slack fix + Danny-on-emails, `ed263c1` Sprout last-post signals, `7787d05` 7/8 handoff) were **pushed to `origin/main` + deployed live** to usevantus.com this session. Runway drought work is now in production.

**🔴 Netlify auto-deploy is BLOCKED — root cause found (not a code bug, not a failed card):**
- A git-triggered deploy (commit `ed9c2f1`) failed with **"Skipped due to account credit usage exceeded."** Netlify skipped the build entirely — never compiled.
- Diagnosed via Netlify API: **usevantus.com lives on the free Personal team `cz-mwalysu`, NOT the Cloud Scenic Pro team.** `payment_failed: None` on both teams. Build minutes barely used (6 of the period) → the tripped cap is **bandwidth/usage**, and the Personal plan has `block_builds_when_usage_exceeded: true`, which hard-blocks git builds.
- **The real fix = transfer the site to the Cloud Scenic Pro team** (`cloudscenic`, billed dv@) — already paid, higher limits, won't hard-block. Netlify → site → Site config → General → Danger zone → **Transfer site**. Upgrading the free team is the fallback.
- **Workaround that WORKS meanwhile:** `netlify deploy --build --prod` — builds locally on the Mac (~6s) and uploads the artifact, bypassing Netlify's build infra entirely. That's how the runway work got live this session. Use it for every deploy until the team transfer is done.

**Repo cleanup (2 commits sitting LOCAL, NOT pushed — deliberately held):**
- `a9e273e` — **untracked `.netlify/functions/manifest.json`** (`git rm --cached`). It was committed before the `.gitignore:8 .netlify/` rule, so it showed dirty every session from a regenerated build timestamp. Now silenced.
- `9a8727c` — **`VANTUS_TODO.md` 7/9 three-lane action queue** (Claude Code / Codex / Christian) + the Netlify diagnosis, at the top of the file.
- **Holding the push on purpose:** these are pure housekeeping (zero runtime impact — the live site already has everything). Pushing now would just trigger another failed Netlify build + need a fresh PAT. Push them with the next real deploy AFTER the team transfer, so they build clean. (Local `origin/main` tracking ref reads "ahead 5" because the earlier push went to an explicit PAT URL, which doesn't update the ref — true state is 4 on remote, 2 pending.)

**🔒 Rogue Resend secret — now fully identified (still Christian's to rotate):** the rogue env var's **NAME is literally a live Resend key** — `re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH` — pasted into the name field instead of the value. Env var names aren't masked, so the key is **exposed in plaintext = compromised.** Delete that var in Netlify **and rotate the key in Resend** (revoke `re_jEHHfr94…` at resend.com/api-keys, generate new, set as the *value* of `RESEND_API_KEY`), then redeploy. The correct `RESEND_API_KEY` var also exists — leave it, just update its value.

**Open items — the honest triage (everything real is Christian's, ~20–35 min solo):**
1. **Transfer usevantus.com → Cloud Scenic Pro team** (unblocks auto-deploy). 3–5 min.
2. **Delete rogue var + rotate Resend key** (security). 5–8 min.
3. **Flip Gemini billing** in AI Studio → revives all 7 VL generators (429 quota). 5–15 min.
4. **Revoke the GitHub PAT** exposed in this session's chat. 1 min.
5. Connect per-client social OAuth (@DynastyStaffing / @Parlor.Bar / @Vital.Lyfe) — gated on client logins, not on Christian's time.
6. Enter real retainer numbers (replace Dynasty $20k / Parlour $2k / VitalLyfe $8k placeholders).
7. Data check: any "no client email" warning → set that client's `primary_email` (code is correct; it's a data gap — Parlour Bar is the known one).
- **Codex has nothing real here.** The only candidate (email-warning hardening) is unnecessary — code already reads `primary_email` correctly and the mailer already falls back to owner + Slack notice.

---

## 2026-07-08 session — Creative OS handoff processed: email "bug" root-caused (non-bug), rogue secret found

**No code changes. NOT pushed: `4e9260e` + `ed263c1` (runway drought detection + Sprout last-post signals) still await Christian's push.**

**Context:** the Creative OS agent's 7/7 live cleanup (3 ghost clients archived → 5 active book, placeholder retainers Dynasty $20k / Parlour $2k / VitalLyfe $8k, 3/3 team roster, Facts of Record 4/5, Dynasty report recipient saved) handed over 3 items. Full handoff kit filed at `~/Desktop/Software builds/CS_CreativeOS_ChrisKit_v1/` (read its `CHRIS_HANDOFF.md`).

**Item 2 CLOSED — "Setup shows no-client-email for Dynasty" is a NON-BUG, do not "fix" it:**
- Verified end-to-end: warning (`FactsAndReports.jsx:246`), data source (`App.jsx` `select("*")` — confirmed present in the LIVE bundle downloaded from usevantus.com), and mailer (`send-monthly-reports.js:136` → `c.primary_email || OWNER_EMAIL`) all read the same correct column `clients.primary_email`.
- DB queried via service key: dynasty row HAS `hello@dynastystaffusa.com`. The warning the auditor saw belongs to **Parlour Bar** (`primary_email` NULL, recurring lane) — the row below Dynasty. It's truthful. **Open data gap: Parlour Bar needs a real primary_email from Christian** (don't scrape a generic info@).
- Auto-send confirmed double-gated: every client's `report_schedule` is NULL (cron skips) AND per 7/3 the Resend-domain + placeholder-retainer blockers stand. Keep off until retainers are real.

**SECURITY — rogue secret in Netlify env:** a variable whose NAME is a raw Resend API key (`re_jEHHfr94_...`) exists alongside the real `RESEND_API_KEY`. No repo references. Deletion was permission-blocked twice in this harness; **Christian: run `npx netlify env:unset "re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH"` and rotate that key in Resend.**

**Still on Christian (from the handoff):** (1) Gemini billing toggle in AI Studio — VL portal's `gemini-proxy` returns 429, blocks all 7 generators; account action, Danny's card. (2) Social OAuth connects in Setup for @DynastyStaffing / @Parlor.Bar / @Vital.Lyfe; the 3 cloud.scenic agency accounts stay Unassigned on purpose. Chrome extension wasn't connected this session, so neither guided browser task ran.

**Schema note worth keeping:** two Supabase projects by design — `wjcstqqihtebkpyuacop` = Vantus (app), `wbryunphevoixgjalcvx` = VitalLyfe generator context (`brand-context.js`). Don't cross-wire.

---

## 2026-07-03 session — full test campaign (27/31), config fixes, data wipe, Client Vault

**All pushed + deployed; migration `20260703_client_vault.sql` applied by Christian.** Latest on `main`: `8e5c002` + this handoff commit.

**Test campaign (results annotated in `TESTING-2026-07-02.md`):** 27/31 pass. The whole QC section is green INCLUDING A9 vision — a flyer with a wrong on-asset price ($8.99 vs $13.99 of record, caption clean) came back blocked citing on-asset. Demo-ready for Danny. Remaining: C4 (cron send fires 13:00 UTC 7/4 — dummy June report queued for "QC Test Kitchen", goes to cz@), C5 covered by design, D5 mobile pass deferred (`/mobile-audit`).

**Two prod configs were silently broken and got fixed by Christian mid-session:**
- Google OAuth `origin_mismatch` — usevantus.com wasn't an Authorized JS Origin for the Drive client (lives in GCloud project "Vital Lyfe War Room", number 458336864067). **Drive upload had NEVER worked in prod** (zero items ever had files). Fixed → upload + QC vision proven.
- Resend domain — cloudscenic.com wasn't verified, so ALL email (reports/invoices/notifies/chase) was still dead despite the 7/2 API-key fix. Verified → C3 + D3 (invoice email) pass. `CRON_TEST_KEY` now set + enforced (keyless ?test=1 refuses).

**Bugs found by testing, fixed + deployed:** (1) manual "+ Add" item creation NEVER persisted — modal sent camelCase `seoKeywords`/`startWeek`, PostgREST rejected the whole insert (PGRST204); (2) realtime INSERT echo doubled client/item cards vs optimistic appends; (3) approval Slack notifications double-fired (recordApproval + the per-tab realtime detector) — notify.js now honors the (type,content_item_id) dedupe before Slack/email/n8n.

**Data wipe (Christian-approved):** 13 seed content items + 5 placeholder team members deleted from prod; dashboard OpsBoard demo tasks emptied and its fake task-motion timers + the agent-count jitter removed (the board was pure theater — not DB-backed).

**NEW: Client Vault** (FINANCE → Vault, `src/ui/routes/VaultRoute.jsx`): per-client billing profile (legal name, contact, email, phone, address/ZIP, tax id, notes) → `client_vault` table, admin-only RLS (portal + anon read zero). Card-on-file via Stripe Checkout **setup mode** (`vault_link`/`vault_sync` actions in `billing-stripe.js`): card is typed on Stripe's hosted page, Stripe vaults it, Vantus stores only brand/last4/expiry + ids and sets the customer default PM. **Never store raw card numbers — this design is deliberate (PCI).** Smoke-tested live: save works, checkout.stripe.com session returns.

**Cleanup owed (next session):** after the 7/4 cron send lands, archive "QC Test Kitchen" (id `4bf5e953…`), delete its test item `qc-test-kitchen-a1-price`, its client_vault row, the dummy `client_reports` row/PDF, and the test flyer in Drive. Note: a live-mode Stripe customer was created for the test client (harmless, no charges).

---

## 2026-07-02 session — QC Agent + Facts of Record + monthly report auto-email (Danny's spec)

**Built from Danny's spec package (`vantus-spec-for-chris.zip`, Counsel has it at scratchpad + the 4-item build order). All four items committed locally on `main` — NOT pushed yet.** Commits: `e59dea2` (schema), `e35a933` (QC agent), `cb90bc4` (Setup sections), `4864c8f` (report cron).

**Before this deploys, two manual steps (in order):**
1. **Apply `supabase/migrations/20260702_qc_facts_reports.sql` in the Supabase SQL editor** (adds qc_* to content_items, client_facts/report_schedule to clients, client_reports table + private `client-reports` bucket, and seeds Dynasty/Parlour/Vital Lyfe config per the spec). App code tolerates the columns missing, but QC runs will fail until applied.
2. Push `main` (founder PAT) → Netlify auto-deploys the new/changed functions.

**What shipped:**
- **QC Agent (spec priority 1):** `qc_review` action in `agent-action.js`. Hybrid gate: Claude sonnet **vision** (new `aiVision` helper) reviews facts/copy/brand + extracts on-asset text from the Google Drive assets; deterministic code exact-matches prices, phone numbers, and offer validity windows (expired offer = auto-blocker). Auto-runs when an item enters "Need Content Approval" (hook in `App.jsx handleSave`); manual "Run QC" button in the Ledger row panel. `qc_status` is a **parallel field** (not a new pipeline status): blocked items can't be Approved at the content gate, can't move to Ready For Schedule/Scheduled (hard SOP gate in EditContentModal), can't be Marked Posted. Videos are NOT frame-checked in v1 (no ffmpeg in functions) — caption+facts checked, warning emitted; fast-follow.
- **Facts of Record (priority 2):** Setup section 5 — per-client hours/locations/prices/offers/operational-facts editor → `clients.client_facts` JSONB, stamps `facts_updated_at`, amber staleness badge >30d, and QC injects a stale-facts warning into every result. No facts on file → QC runs typo/brand only + says so. Owner: Sebastian (data entry pending him).
- **Monthly report auto-email (priority 3):** semi-auto Sprout path (Christian's call — no Sprout API). Setup section 6: drop the month's PDF per client → private `client-reports` bucket + `client_reports` row; `send-monthly-reports` cron (daily 13:00 UTC) emails any unsent completed-month report to `clients.primary_email` with PDF attached, stamps sent_at, Slack+bell, and **nags from the 28th** if the PDF is missing. Test path: `?test=1&key=<CRON_TEST_KEY>` sends to OPS_OWNER without marking. Optional env: `CRON_TEST_KEY`.
- **Per-client config (priority 4):** seeded in the migration (Dynasty 2/day Mon-Fri + monthly_1st report; Parlour 2 videos + 2 flyers/wk pre-approved; Vital Lyfe brief-lane full approval). Rest is Setup-UI data entry.
- Side fix: clients query in App.jsx widened to `select *` — Setup previously read retainer/scope blanks on first load because the narrow column list omitted them.

**Verify after deploy:** create a test item with a Drive image + a wrong price vs facts → move to Need Content Approval → expect qc blocked + the issue naming the price; fix → Run QC → pass. Then `send-monthly-reports?test=1` with a dummy PDF uploaded.

---

## 2026-07-01 session — fulfillment OS complete, Stripe wired, big cleanup

**Current board lives in `VANTUS_TODO.md` (rewritten this session, read it first).** Everything below is pushed and live; last commit on `main` is `0a01e23`.

**What Vantus is now:** the agency fulfillment + billing OS (multi-tenant client book), not a single-client dashboard. The generator side is pre-production (Idea Engine, agents, Pipeline); the fulfillment side is delivery, approvals, and billing. Live nav: Dashboard, Clients, Setup, Ledger, Reports, Client Analytics, Operations, Agents, Idea Engine, Pipeline, Billing. Agent team is Sean / Muse / Scrappy.

**Shipped + pushed this session:**
- P1: overdue-task chase cron (`chase-overdue-tasks`), MRR trend chart, invoice-sent email.
- **Setup** data-entry page (retainers/scope, connected-account to client mapping, bulk owner + due-date, team roster edit).
- Owner-assign: migration `20260701_assigned_to_team_members.sql` (assigned_to FK repointed to team_members), applied by Christian.
- **Stripe wiring** (`billing-stripe.js`): create hosted invoice on send + webhook paid-sync. Secrets `STRIPE_SECRET_KEY` (live restricted key `rk_live_`) + `STRIPE_WEBHOOK_SECRET` set in Netlify, live webhook endpoint created (invoice.paid/voided/marked_uncollectible). Verified wired (webhook returns sig-fail not 501). Create-path NOT yet proven with a real invoice (test skipped). Each client needs `primary_email`.
- Codex perf merge: code-split + null-guard sweep + route-chunk prefetch (bundle 744KB to ~531KB, nav stays instant).
- Cleanup: removed 6 pages (Ad ROI Hub, References, ArtGrid, Cost Governance, Ideal Customer, Competitor Intel) + Analytics (extracted to `ripped out features/analytics-page/`). Removed the Artgrid agent everywhere. Deleted `tools/`. Deleted the parked ripped-out code (agents/apps/client-view/routes + working-ripped-out), keeping only analytics-page. Docs refreshed. `npm audit` clean.

**Open / parked (revisit later):**
- P0 data entry on the Setup page (retainers, account-to-client mappings, owners + due dates, real team roster). Pages read light until entered.
- **Danny update email** drafted (framing: generator = pre-production, fulfillment = delivery/billing, no more Monday.com; no em-dashes per Christian). Not sent.
- **Analytics live-data** (weekend job): plan at `ripped out features/analytics-page/LIVE-DATA-PLAN.md`. Key: the SMM-agent "reuse its IG pull" shortcut is a dead end (backbone only). Real reuse = Vantus's own `sync-instagram.js` + `oauth-instagram-*` + Meta app. Two routes (share Vantus Supabase, or port to a Supabase Edge Function). Seed a test row first.
- Other parked builds: ClientView self-approval portal (old code was deleted but recoverable from git), Unified Inbox, Template Engine, auto-posting, in-page customization design.

**Guardrails unchanged:** founder pushes `main` (one-shot PAT; shell can't reach keychain); migrations via Supabase SQL editor; `git fetch` before commit (shared repo); Codex runs in its OWN worktree (a shared-dir collision happened this session, never let it check out the live folder).

---

# Vantus Handoff Brief — 2026-06-04 (9-item package: speed shipped, #3 reunited, #10 planned)

## 2026-06-04 session — the "9-item package" push

**Canonical list lives in `VANTUS_TODO.md`** (repo root) — that's the running board, status-keyed. This handoff is the narrative; the TODO is the source of truth. Read it first on pickup.

### 📋 9-item package status (6 shipped, 4 left)
| # | Item | Status |
|---|------|--------|
| 1 | Refresh holds your page, doesn't sign you out | ✅ live |
| 7 | Analytics + Ad ROI Hub moved under "Content" nav | ✅ live |
| 8 | Team Broadcast page killed; button moved under Scrappy in Agents | ✅ live |
| 6 (part) | Login water-video removed | ✅ live |
| 4 | Generation speed 28–30s → 10–15s | ✅ **shipped this session** (`70dcd29`) |
| 3 | Analytics "why it won/lost" (Opus) | ✅ **committed & live this session** (`6cb248b`) |
| 9 | Admin page (user count + feedback) | 🗓️ queued for Codex next burst |
| 10 | Virality Checker (pre-publish gate) | 🟢 **ours, started — planning** |
| 6 | Multi-tenant data isolation (agency seats + self-serve) | 🟡 blocked — needs design pass |
| 2 | Per-client OAuth | 🟡 blocked behind #6 |
| 5 | Ad ROI Hub (Meta + static-ad gen) | 🟡 blocked — no Meta connection exists |

### 🚀 #4 — Generation speed (SHIPPED, live)
- Built by Codex on its worktree, reviewed by me line-by-line, pushed to `main` (`52bdea3..70dcd29`).
- Worst offenders fixed: `muse_ig_ideas` and `scrappy_muse_collab` (both 22–30s) → ~10–15s. Method: parallelized fetches (`Promise.all`), Tavily `advanced`→`basic`, `muse_ig_ideas` Opus→**Sonnet**, single-pass collab (raw Tavily data → ideas, *better* grounding), trimmed token caps. Shared `scrappySearchContext` + `_researchDigest` dedup.
- Bonus Codex added: real timing logs — `[agent-action] {action} completed in {ms}ms` in Netlify function logs (so "estimated" numbers become measurable).
- ⚠️ **Spot-check still owed:** the `muse_ig_ideas` Opus→Sonnet quality on a real Idea Engine run. Founder said they'd eyeball it.

### 🔧 #3 — "why it won/lost" (REUNITED + live) — the gotcha to remember
- The #3 work (Opus winner/loser contrast + `lossReasons` "why it lost" in `scrappy_analyze_performance` + `AnalyticsRoute.jsx` Bottom Performers section) had been **deployed-from-local-tree but never committed.**
- Pushing Codex's #4 branch (built off the older commit) auto-deployed and **briefly reverted #3 on prod.** Caught it, committed #3 (`fce3c0f`), **rebased it onto #4** (`6cb248b`) — clean, non-overlapping (#4 never touched `scrappy_analyze_performance`), built green, pushed. #3 now reunited with #4 and in history.
- **Lesson:** the Desktop repo and Codex's `/private/tmp/vantus-grunt-2026-06-04` are **linked git worktrees sharing one object store** — Codex commits are reachable from Desktop by SHA without a fetch. Don't push a branch that's behind local uncommitted work without reconciling first.
- 🔜 #3's win/lose is still slated to eventually **migrate into #10's gate** (where the model can actually see the content). It's safe and shipped for now.

### 🗓️ #9 — Admin page (queued for Codex)
- Was ~80% done before a burst-cancel (`admin-stats.js` + `netlify.toml` redirect written on the throwaway branch, **nothing merged**, that branch had its feedback migration reverted out so #4's net diff stayed clean).
- Re-hand on a **fresh burst** — brief at `/tmp/codex_brief_speed_admin.md` (the #9 half). Standalone #4 brief also saved at `/tmp/codex_brief_4_speed.md` (already shipped, keep for reference).
- Codex burst was nearly spent (`<20%` of 5h, resets ~08:21). Hand it ONE finite task per burst; don't let the speed-audit type work finish on the downgraded mini model.

### 🧭 #10 — Virality Checker (STARTED — planning, this is the next build)
**Concept:** a pre-publish gate — run content through it *before* posting; the model actually watches the whole video (you hold the file at that moment, so no gated-link/scraper wall). It's the final gate before content goes out.
**Architecture decision made:** build the brain on **Gemini alone, all platforms** — YouTube by URL (native), IG/TikTok by file-upload at the gate (Gemini Files API). Gemini gives the **semantic "why"** ("body sags at 0:15, hook works because of the close-up") which is what the founder wants. **Dropped Higgsfield as a dependency** (its MCP is session-only, not usable by the deployed app, and dev-API availability is uncertain) — keep Higgsfield's virality *score* as an optional later layer only.
**The loop (why it matters):** the gate IS the DNA harvester — every check is a real, legit, fully-analyzed piece of the user's content. Store that DNA → feed the **Idea Engine** so it generates grounded ideas. Pair each gate analysis with the metrics that roll in later → revives a *real* "why it won."
**Build slices:**
1. Scaffold (no key) — Virality Checker page + nav item + route, DNA-store table/migration, analysis-function skeleton.
2. Wire Gemini — URL for YouTube, upload for IG/TikTok → verdict. **Needs `GEMINI_API_KEY`.**
3. DNA harvest → Idea Engine feed.
4. Pair gate analysis + later metrics → real "why it won."
**⛔ UNBLOCK NEEDED:** founder grabs a free Gemini key at https://aistudio.google.com/apikey → set as `GEMINI_API_KEY` in Netlify. Slice 1 (scaffold) can start without it.

### 🚢 Git / deploy state
- `main` is at **`6cb248b`** (= #4 speed + #3 reunited), live on prod via auto-deploy.
- Pushes this session via one-shot GitHub PATs (shell can't reach keychain — [[project_vantus_push_auth]]). **Both tokens should be revoked** (reminded founder). Always `git fetch` + verify fast-forward before pushing — Counsel tab may push to `main` too ([[project_vantus_counsel_workflow]]).
- `VANTUS_TODO.md` is **untracked** (not committed) — it's the working list; commit it if you want it versioned.

### 📌 Pickup queue (in order)
1. **Spot-check Idea Engine** quality (`muse_ig_ideas`, Opus→Sonnet) on a live run.
2. **#10 slice 1** — scaffold the Virality Checker (page + nav + route + DNA-store migration + function skeleton). No key needed.
3. **Grab the Gemini key** → #10 slice 2 (wire the real gate).
4. **Re-hand #9** to Codex on a fresh burst (`/tmp/codex_brief_speed_admin.md`).
5. When ready for the next epic: **#6 multi-tenant design session** (unblocks #2).

---

# Vantus Handoff Brief — 2026-06-02 (YouTube OAuth live + Scrappy performance analysis)

## 2026-06-02 session — YouTube connected, analytics cards restyled, "why it won" analysis

**Why:** First real step of the self-serve analyzer pivot — get a second platform (YouTube) syncing real account data, then start turning that synced data into insight. Connected **Cloud Scenic's own YouTube channel** as the working test account.

### 🎥 YouTube OAuth — shipped & live
- Created a Google Cloud OAuth client (Web app) **separate from Supabase's Google sign-in client** so the consent screen is YouTube-access, not login. Enabled **YouTube Data API v3** + **YouTube Analytics API**; scopes `youtube.readonly` + `yt-analytics.readonly`; redirect `https://usevantus.com/api/oauth/youtube/callback`.
- Set the three Netlify env vars via CLI: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YT_REDIRECT_URI`. (`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` already present.)
- Confirmed `20260601_connected_accounts.sql` was **already applied to prod** (a "policy already exists" error on re-run proved the tables/RLS exist).
- **Connected Cloud Scenic's channel + synced** — videos flowing into `account_posts`.
- ⚠️ OAuth consent screen is in **Testing** mode: only test-user accounts can connect, and refresh tokens expire after 7 days. Publish (and likely Google verification for the readonly scopes) before opening it to other users.
- To connect a brand/business YouTube: sign in as the Google account that **manages** the channel, then pick it in the brand picker — `channels?mine=true` resolves to whatever the authorizing account selects.

### 🎨 Analytics card display — restyled
- Top Performer thumbnails now use **per-platform aspect ratios**: YouTube `16:9`, TikTok `9:16`, Instagram/other `1:1` (`AnalyticsRoute.jsx`, was hardcoded `1:1`).
- Enlarged cards: grid min-width 180px → **280px** + scaled-up card text/metrics.
- Generic connect-toast handler in `ConnectedAccountsCard.jsx` — `youtube_connected` / `tiktok_connected` (+ `*_oauth_error`) params now surface a toast and clean the URL, not just Instagram's.

### 📊 Scrappy performance analysis — built (NEEDS TUNING)
- New agent action **`scrappy_analyze_performance`** (`agent-action.js`): reads synced `account_posts`, groups by platform, computes each platform's **median engagement** as baseline, takes top 6, asks Claude (Haiku) for **per-post "why it won" reasons + 3–5 aggregate patterns**. Per-platform because drivers differ. Returns `{ insights, reasons }`.
- `AnalyticsRoute.jsx`: **"✨ Why these won"** button, **Performance Insights** panel (patterns per platform), and a **"Why it won"** line on each Top Performer card (keyed by `reasons[post.id]`).
- 🐛 **KNOWN BUG (tomorrow's first fix):** the analysis surfaces reasons across multiple posts and leans on raw view-count; it should be scoped to the true **top performer(s)** and rank by the right metric. Founder flagged it; output otherwise works.

### 🚢 Deploy / git state
- Founder authorized overriding the "agent never pushes" rule for this session. Deploys done via `netlify deploy --build --prod` (direct, not git-triggered). Pushes via one-shot GitHub PAT (this shell can't reach the keychain — see [[project_vantus_push_auth]]).
- Pushed to `main`: `33516c4` (aspect ratios + toasts), `62afc21` (bigger cards).
- ⚠️ **`44b55a5` (Scrappy analysis) is committed locally + live on prod, but NOT pushed to `main`.** Push it first thing tomorrow (fresh PAT) before any Counsel/Codex push rebuilds prod from git and drops it.

### 📌 Tomorrow's queue
1. **Push `44b55a5`** to sync git ← do before anything else
2. **Fix "Why these won" scoping** (top performer(s) only; correct ranking metric)
3. **Wire Muse to synced content** — `muse_ig_ideas` reads `account_posts` top performers + caption themes, generates grounded ideas + fills the `script` field (Instagram-first, on-demand button, daily n8n cron later). Deferred today.
4. **Performance pages** — recommendations layer built on top of the Scrappy analysis.

---

# Vantus Handoff Brief — 2026-06-01 (post-rip pass + IG-analyzer pivot prep)

## 2026-06-01 session — Major rip + de-hardcoding pass

**Why:** The original Vantus premise was "log in to your IG/TT/YT/LinkedIn accounts, have AI analyze your analytics and generate better content ideas." The actual built app drifted into a VitalLyfe-specific content-ops dashboard. This session ripped the agency-shaped weight and de-VitalLyfe'd everything so the codebase is ready for the self-serve IG OAuth pivot.

### Ripped (preserved under `ripped out features/`)
- **Apps:** Brief → Content (brief-gen), Shot Reference, Hero Generator
- **Agents:** Lacey (Runner), Ali (Developer), Sam (Monitor), Overseer (SOP Guardian) — kept Sean, Muse, Scrappy, Artgrid
- **Routes:** TrackerRoute (redundant), TaskboardRoute (empty ops theater), SopsRoute (VitalLyfe 7-step SOP)
- **External-client portal:** `ClientView.jsx` (1,298 lines) + preview-mode overlay + 2 "Client View" trigger buttons + `seed.content.js` (VITAL_LYFE_SOP). Approved external clients now route to the main app — RLS already scopes them per `client_id`.

Backups: `ripped out features/{apps,agents,routes,client-view}/` + `working ripped out features/` (full pre-rip production build snapshot for fallback).

### De-hardcoded
Anything VitalLyfe-specific now flows through `clients.brand_voice_md` at request time, parsed into a `brand.pillars` array via new `parsePillars()` helper in `agent-action.js`:
- `muse_ig_ideas` + `muse_generate_calendar` + `scrappy_research` — pillars/voice come from client context, not hardcoded
- `notify.js` email + Slack branding — pulls `clients.name` per call ("Cloud Scenic × {client}" / "{client} Vantus"), falls back to "Vantus"
- `ContentRoute` IG/TT/YT subtitles — pull `currentClient.ig_handle / slug / name`
- `LoginScreen` tagline — "VitalLyfe Content Operations" → "Content Operations Dashboard"
- `CIDPage` AI prompt + ~10 UI labels — "VitalLyfe Adaptation/Version/Ready" → "Brand Adaptation/Version/Ready"
- `ArtgridScout` AI prompt — brand-agnostic, takes voice from context
- `AdROIHub` AI persona — generic Ad Analyst (was "Sam"). Seed campaigns + placeholder also generic.
- `constants.js` — `PILLARS_LIST` is generic placeholders, `CAMPAIGNS = []`
- `App.jsx` — Muse memory seed neutered, new-item template uses client slug
- `ICPPage` — `DEFAULT_CLIENTS = []` (was hardcoded VitalLyfe profile)
- `ReferencesPage` — `INITIAL_REFS = []` (was 4 Drip Campaign seeds)
- `seed.ops.js` — dead-agent task entries (Lacey/Ali/Overseer) stripped
- Various placeholders (`teammate@example.com`, `e.g. your brand name`, generic campaign examples)

Only residue: a single historical comment in `src/core/memory.js` about the long-removed `seedMuseMemory()`. Not live.

### Auth-lock fix (stuckGuard tightening)
**Bug:** Opening Vantus in a second tab kicked the user out of both. Cause: `stuckGuard` setTimeout in `App.jsx` fired unconditionally at 4s — even if `getSession()` resolved at 3.9s, the guard still wiped tokens and reloaded.
**Fix:** Cancel the guard the moment auth resolves (both `getSession().then()` and `onAuthStateChange`). Bumped timeout 4s → 8s for slow networks. Recovery still runs if auth genuinely hangs.

### Build delta
- Modules: 103 → 93
- JS bundle: 798KB → 628KB (~21% lighter)
- pdf-worker chunk (1.2MB): GONE (was used by ripped brief-gen)

### What still uses VitalLyfe as data (not behavior)
- The `clients` row for VitalLyfe in Supabase — still has `brand_voice_md` seeded from migration `20260526_seed_vitallyfe_brand_voice.sql`. Useful as the working test client.
- HANDOFF.md (this doc) still references it as the historical client.

### What the new "user" model looks like (next sprint)
Replace agency-style `clients` rows + invite allowlist with:
- IG/TT/YT/LinkedIn OAuth-per-user
- New `ig_accounts` (and sibling `tt_accounts`, etc.) tables: `user_id`, `account_id`, `access_token`, `handle`, `meta`
- Worker that pulls recent posts + insights (top performers, engagement, hashtags, themes)
- Retarget `muse_ig_ideas` to read user's top posts + caption themes, generate 5 ideas grounded in their actual account
- Add Higgsfield account linking (already stashed)
- Self-serve sign-up — kill the "pending approval" gate

---

# Vantus Handoff Brief — 2026-05-26 PM (evening — post 3-agent collab session)

## Project
Cloud Scenic × VitalLyfe "Vantus" — content operations dashboard.
**Live:** https://usevantus.com (Let's Encrypt SSL, Cloudflare-registered, Netlify-hosted)
**Fallback URL:** https://majestic-cassata-aa16e9.netlify.app (kept active)
**GitHub:** https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to `main`)
**Internal name:** "warroom" (per `package.json` — kept for repo + Netlify subdomain consistency)

## Stack
- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` and `netlify.toml`). `src/App.jsx` now 1,342 lines (was 1,676 — Codex split out 6 route components into `src/ui/routes/` as Fix #2).
- **Backend:** Supabase (`wjcstqqihtebkpyuacop`) — tables: `content_items` (versioned), `profiles`, `cid_library` + `cid_performance` (real CID tables), `agent_events`, `notifications`, `clients`, `client_users`. (`cid_posts` was a phantom — never existed; migration + caller deleted 2026-05-26 PM.)
- **Netlify Functions:** `/api/chat`, `/api/agent-action`, `/api/notify`, `/api/apify-scrape`, `/api/unsplash` — plus shared helpers `_lib/requireUser.js` (auth + cors) and `_lib/rateLimit.js` (in-memory sliding window). (`/api/cid-scrape` removed 2026-05-26 PM — zero callers + queried phantom table. Higgsfield function is stashed.)
- **Anthropic models:** `claude-haiku-4-5-20251001` (server-side functions) + `claude-sonnet-4-6` (frontend /api/chat callers — bumped from retired `claude-sonnet-4-20250514` on 2026-05-26)
- **Workflows:** n8n cloud at `https://cloudscenic.app.n8n.cloud`, workflow "VitalLyfe Vantus — Content Sync" (ID `3WXHHEiMz9rMnBEn`) — published + live. Per-client routing via `clients.n8n_webhook_url` (Fix #7).

## Env Vars (Netlify, all set)
`ANTHROPIC_API_KEY` · `SUPABASE_SERVICE_KEY` · `SUPABASE_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `TAVILY_API_KEY` · `N8N_WEBHOOK_URL` · `SLACK_WEBHOOK_URL` (global fallback) · `SLACK_BOT_TOKEN` · `RESEND_API_KEY`

(`CID_BEARER_TOKEN` deleted 2026-05-26 PM — orphaned after cid-scrape removal.)

## Current Nav (UI sidebar)
- **COMMAND:** Dashboard, Task Board, Agents, Competitor Intel, Ideal Customer
- **CONTENT:** Pipeline (unified Instagram/TikTok/YouTube with platform tabs), Production (was Content Tracker)
- **CREATIVE:** Higgsfield Studio *(nav only; component still untracked — see Dirty WIP)*
- **APPS:** Apps, Settings
  - Apps page lists toggleable modules: Brief → Content, ArtGrid Scout, Shot Reference, Hero Generator, Ad ROI Hub, Team Broadcast, References, Skills, SOPs, plus dormant ones

## Agent Actions (`netlify/functions/agent-action.js`)
muse_write_content · muse_from_brief · muse_generate_calendar · muse_save_calendar · muse_ig_ideas · overseer_scan · sean_briefing · lacey_advance · lacey_trigger_n8n · sam_health · artgrid_scout · scrappy_research · scrappy_muse_collab · scrappy_hook_analysis · cid_build_brief · cid_ab_variations

Every invocation writes one row to `agent_events` via SERVICE_KEY (success/error/skipped). **All calls now require an authenticated session** (via `requireUser`).

## Brain Trilogy Status
| Move | What | Status |
| --- | --- | --- |
| **1** — Cortex wiring | Per-client agent brand voice from `clients.brand_voice_md` | ✅ **Live 2026-05-26** (commit `767cb93`). `agent-action.js:94 getBrandContext(client_id)` reads `clients.brand_voice_md` per request; 12 prompt sites interpolate `${brand.name}` + `${brand.voice}`; dynamic `#${brand.name}` hashtags; dead `seedMuseMemory` removed. VitalLyfe seeded via `20260526_seed_vitallyfe_brand_voice.sql`. **Per-request voice override** also wired in `agent-action.js` (payload.voiceOverride replaces brand.voice for that call) + `AgentChatPage.jsx` exposes a textarea — useful for "try a punchier tone" runs. |
| **2** — `agent_events` | Real history of agent invocations | ✅ Live |
| **3** — Notifications persistence | Durable, deduped, realtime | ✅ Live |

**Brain trilogy complete.** Forward layer: Cortex wiki entries (`wiki/clients/<slug>/brand-voice.md`) push into `clients.brand_voice_md` via `scripts/sync-cortex.mjs` (stub exists, schema not finalized — don't create the directory until founder signs off on the convention).

## ✅ Security Posture (REWRITTEN 2026-05-26 PM — hardening sweep complete)

**Auth: live.** Four-way branch in `App.jsx setupSession()` (L72) — admin / approved external client / pending invite (realtime unlock) / unknown blocked.

**Function-level auth: live.** All 5 protected functions reject anon callers via `_lib/requireUser.js`. (cid-scrape.js was deleted 2026-05-26 PM in the closed-by-removal cleanup — was the only function on the legacy bearer-token pattern.)

**Email/password auth: DISABLED 2026-05-26 PM.** Supabase Auth → Providers → Email toggle flipped off. The admin password leaked in git history (pre-`9fb1e10` setup.js — literal redacted from docs 2026-07-12) is now genuinely inert — only Google OAuth remains for cz/dv/ss admin sign-in. Magic-link fallback also disabled (acceptable since Google is the intended path). Remaining: rotate the cz/dv/ss account passwords in the Supabase dashboard to fully retire the value.

**Client-side auth injection: live.** `src/services/apiFetch.js` attaches the access token on every protected call (26 sites). `AgentChatPage` now also passes `currentClient.id` as `client_id` so the backend resolves brand voice correctly (fixed 2026-05-26 — Move 1 was silently using fallback before this prop wiring).

**RLS posture:**
- Temp anon policies fully cleared. Admin policies (@cloudscenic.com email check) on every table.
- `client_users` — admins full r/w; approved clients read their own row(s); realtime enabled.
- `content_items` — admins full r/w; approved clients scoped SELECT+UPDATE to their `client_id` (via `EXISTS` subquery against `client_users`); INSERT/DELETE admin-only; legacy "Allow all for now" anon policy DROPPED (Fix #10.1, `20260526_content_items_client_rls.sql`). Anon REST probe with anon key now returns 0 rows.

**Security hardening sweep (Fix-batch shipped 2026-05-26 PM, commit `8e59968`):**
- **CORS** locked from `*` to allowlist regex via `_lib/requireUser.js cors(event)` — matches `usevantus.com` + `(deploy-preview-*--)?majestic-cassata-aa16e9.netlify.app`. All 6 functions rewritten. `Vary: Origin`.
- **Rate limits** via new `_lib/rateLimit.js` — in-memory sliding window keyed on `user.id:endpoint`. `/api/chat` 30/min, `/api/agent-action` 60/min. Cold starts reset (acceptable since auth+RLS are primary defense).
- **Headers** in `netlify.toml`: HSTS preload (1y, includeSubDomains, preload), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), tight CSP whitelisting only Anthropic + Supabase REST+WSS + Resend + Slack hooks + n8n cloud + Tavily + Apify + Unsplash images. `style-src 'unsafe-inline'` retained for inline-style React patterns (tighten when factored out — separate task).
- **Auth-lock contention** auto-recovers now (Fix #15). On stuckGuard fire: clears `sb-*-auth-token` localStorage keys, sets one-shot `sessionStorage` flag to prevent reload loops, then `location.reload()`. Manual `localStorage.clear() + reload` workaround retired.

**Remaining open security debt (low urgency):**
- `style-src 'unsafe-inline'` in CSP — required by current inline-style patterns. Tighten when inline styles get factored out.

(Password rotation debt closed 2026-05-26 PM — better fix than rotation: email/password auth provider disabled entirely. Password leak in git history is now inert.)

## Per-client Routing (all live as of 2026-05-26)
- **Slack:** `clients.slack_webhook_url` column. `notify.js` prefers it; falls back to global `SLACK_WEBHOOK_URL`. (Fix #6, commit `702f867`)
- **n8n:** `clients.n8n_webhook_url` column. `notify.js` reads it in the same Supabase fetch as Slack (one roundtrip pulls both); falls back to global env. (Fix #7, commit `2bb8958`)
- **Brand voice:** `clients.brand_voice_md` column. `agent-action.js getBrandContext(client_id)` reads it per request, passes to every handler. Per-request override via `payload.voiceOverride`. (Move 1 / Fix #3, commit `767cb93`)

## Dirty / Stashed WIP — CORRECTED 2026-07-12 (stash cleared)

**The stash is gone; this section previously misdescribed it.** `stash@{0}` ("pre-codex-fix2 wip") was inspected on 2026-07-12: it contained ONLY tracked changes — `public/portal.html` (1,920-line WIP diff), one-line edits to `src/apps/apps.config.js` + `src/utils/constants.js`, and `.netlify/` build noise. The untracked files earlier versions of this section listed (`HiggsfieldStudio.jsx`, `higgsfield.js`, `scripts/sync-cortex.mjs`, `.claude/` config) were **never in the stash** — plain `git stash` doesn't capture untracked files — and they no longer exist on disk or in any commit. That WIP is lost; treat any future Higgsfield Studio or sync-cortex work as a fresh build.

What survived is archived on branch **`archive/portal-html-wip-2026-05-26`** (the stash commit, unpopped). The stash itself was dropped. Re-evaluate portal.html from that branch only if the old client-portal page is ever wanted; it predates the React-side hardening.

`src/ui/layout/PasswordGate.jsx` from earlier HANDOFFs was never created (no git history, not in stash). Drop the mention if it comes up again.

## Session log

### 2026-05-26 PM — Move 1 sprint (9 fixes shipped + security sweep + Codex App.jsx split)

Massive session. Closed half the open punch-list in one afternoon.

| Commit | What |
| --- | --- |
| `767cb93` | `feat(brand)`: per-client brand voice from clients.brand_voice_md (Move 1 / Fix #3). New `getBrandContext` helper + 12 prompt sites refactored + dynamic hashtags + `seedMuseMemory` removed + VitalLyfe SQL seed |
| `22cc58f` | `feat(brand)`: per-request voice override + bump 9 deprecated frontend models (`claude-sonnet-4-20250514` → `claude-sonnet-4-6`; `claude-3-haiku-20240307` → `claude-haiku-4-5-20251001`) |
| `0c163dd` | `fix(brand)`: pass currentClient into AgentChatPage (post-Move-1 regression — `client_id: null` was reaching backend) |
| `2b43364` | `fix(auth)`: auto-recover from supabase-js auth-lock deadlock (Fix #15). stuckGuard clears `sb-*-auth-token` keys + reloads; one-shot sessionStorage flag prevents reload loops |
| `ed46c31` | `chore(schema)`: content_items baseline migration (Fix #10) — 25 cols + FK + indexes + RLS captured in `20260526_content_items_baseline.sql`. Surfaced wide-open "Allow all for now" policy as security debt |
| `5a51b00` | `fix(rls)`: scoped client policies on content_items + drop wide-open anon (Fix #10.1) — `20260526_content_items_client_rls.sql`. Anon REST returns 0 rows now |
| `2bb8958` | `feat(notify)`: per-client n8n routing + consolidated slack+n8n into one Supabase fetch (Fix #7) |
| `4b54630` | `chore(cleanup)`: delete dead `src/agents/` folder (Fix #8) — 8 files, 96 lines |
| `183d53f` | `chore(cleanup)`: cid_library column rename `vitallyfe_adaptation` → `client_adaptation` (Fix #3.1) + close Fix #11 (pdfjs already dynamic) + arch map sync |
| Codex on `codex/grunt-2026-05-26` | `refactor(App)`: extract 6 route components to `src/ui/routes/` (Fix #2). App.jsx 1,676 → 1,342 lines. 7 commits (`4ee755b` Dashboard, `6589b78` Agents, `bee8946` Content, `f2d384c` Tracker, `94eae54` Taskboard, `c4f2cc5` Sops, `e57e951` notes) |
| `8e59968` | `security`: CORS allowlist + per-user rate limits + CSP/HSTS/Permissions/Referrer (security hardening sweep) |
| `90beaa6` | `chore(cleanup)`: drop unused INITIAL_CONTENT seed array (Fix #14 partial) + drop matching App.jsx import + regenerate arch map docs |

**What unlocked:** brain trilogy complete. Multi-tenancy is real end-to-end — adding a new client via AddClient modal + filling `brand_voice_md` gets them their own agent voice automatically. Security posture moved from "auth gate only" to "auth + RLS + CORS + rate limits + CSP". App.jsx finally splittable. Three migrations applied to live Supabase by founder (brand voice seed, content_items baseline, content_items client_rls, cid_library rename) — all verified before code push.

**Codex workflow established:** I work main, Codex grinds on `codex/grunt-<date>` feature branches. Brief Codex with exact line numbers + dirty-WIP out-of-scope list + CODEX_NOTES.md as the report. Use `git push origin HEAD:main` to dodge stale local main refs.

### 2026-05-26 PM (evening) — 3 closed-by-removal cleanups + Codex Fix #4 grind + 3-agent collab pattern proven

| Commit | What |
| --- | --- |
| `a22df04` | `chore(cleanup)`: close cid_posts dead chain + document email/password auth disable. Live SQL probe confirmed `cid_posts` table never existed; `cid-scrape.js` + `003_cid_posts.sql` deleted; arch map + 5 markdown bundle files synced; +88/-171 lines |
| (out-of-band) | **Supabase Auth → Providers → Email** toggle flipped off in dashboard. Leaked admin password (literal redacted 2026-07-12) in git history now inert. Only Google OAuth path remains. |
| (out-of-band) | **Netlify env var `CID_BEARER_TOKEN`** deleted — orphaned after cid-scrape removal. |
| Codex on `codex/grunt-2026-05-27` | `refactor(agent-action)`: Fix #4 — split 1,317-line monolith into 16 handler files under `netlify/functions/agent-action/handlers/`. agent-action.js now 309-line router. 19 commits, build green after each. CODEX_NOTES.md has full report. **Awaiting founder review + merge.** |

**3-agent collab pattern proven at scale:** Main Claude (this tab) drove diagnostics + briefs + arch-map updates. Counsel Claude (parallel tab) shipped `90beaa6` (INITIAL_CONTENT cleanup, caught dead import before I did) + `9955cd3` (HANDOFF rewrite to fix stale "Dirty WIP" claim). Codex GPT-5.5 ground through Fix #4 on its own branch. Zero conflicts across all three. See [[project_vantus_counsel_workflow]] for the workflow notes.

**Codex burst budget behavior:** 5h burst limit (gpt-5.5 quality) caps Codex on big refactors. When exhausted, auto-downgrades to gpt-5.4-mini. Weekly limit is separate (much more generous). Resets are timed per-window (today's was 01:51). Plan big Codex jobs around burst windows.

**Codex standing contract:** "use `codex/grunt-YYYY-MM-DD` today's date, NEVER push to remote, founder reviews + merges manually." My initial Fix #4 brief overrode both (asked for a specific branch name + push) — Codex correctly refused both via CODEX_NOTES.md and asked for confirmation. Briefs should respect the contract; only override when explicitly needed.

**Next session queue (briefs already drafted at `/tmp/`):**
- `/tmp/codex-brief-deadcode.md` — dead code sweep across `src/`. Ready to fire when Codex burst returns.
- `/tmp/codex-brief-app-state.md` — App.jsx state extraction into custom hooks (skeleton; needs parallel Claude tab to produce state map at `/tmp/app-state-map.md` first, paste into brief).
- `/tmp/other-claude-prompt.md` — prompt for a parallel Claude tab to do the state mapping prep.

### 2026-05-25 — Auth restore + invite flow + per-client Slack
Eight commits, four high-severity bugs closed, full external-client invite flow shipped.

| Commit | What |
| --- | --- |
| `307b64f` | `fix(auth)`: dedupe setupSession + render UI immediately on session resolve |
| `8e5095e` | `feat(auth)`: re-enable auth gate + add admin RLS policies (Fix #1) |
| `852d915` | `chore(rls)`: drop temp anon policies now OAuth is live (Fix #1 tail) |
| `2a9c9c1` | `feat(auth)`: caller auth on 5 functions + client_users invite/allowlist flow (Fix #2) |
| `d0acec3` | `fix(auth)`: flip checking=false in onAuthStateChange + 4s stuckGuard (hotfix) |
| `19b6235` | `feat(invite)`: admin team panel inside Edit Client modal (Fix #2.5) |
| `702f867` | `feat(slack)`: per-client webhook routing in notify.js (Fix #4) |
| `d7f0b27` | `docs(map)`: regenerate architecture map after fixes |

**What unlocked:** real multi-tenancy. We can now invite external client teammates (e.g. Natalia at VitalLyfe) via the UI; they get a "pending" screen until we approve in the team panel; on approval their dashboard unlocks via realtime. Per-client Slack routing means future clients won't pollute #vitallyfe-war-room.

### 2026-05-22 → 2026-05-23 (preserved for context)
Repo tidy, component extraction, security audit, Move 2 + Move 3 deployed, custom domain set up, Anthropic model upgrade, mobile nav fixes, multi-tenant `clients` table seeded with VitalLyfe.

## What's NOT Built / Open Items

**Sprint-scale:**
- **Fix #4** — ✅ **DONE on `codex/grunt-2026-05-27`, awaiting founder merge.** 1,317-line agent-action.js → 309-line router + 16 handler files under `netlify/functions/agent-action/handlers/`. 19 commits, build green after each. Reviewed safe by main Claude. Merge with `git checkout main && git merge codex/grunt-2026-05-27 && git push origin main`.
- **App.jsx state extraction** — next big Codex job (~12 hooks under `src/hooks/`). Brief skeleton drafted at `/tmp/codex-brief-app-state.md`; needs the state-cluster mapping section filled in by a parallel Claude tab first (prompt at `/tmp/other-claude-prompt.md`).
- **Fix #12** — Back OpsBoard with a DB-backed `tasks` table (new migration + UI rewrite). ~1 hr. Not Codex-shaped (needs UI browser testing).
- **Fix #13** — Per-user client assignments. Counsel + main both flagged as ambiguous: could mean access (already done via `client_users.status='approved'`), role-per-client (add `assignment_role` column), or primary-contact-per-client (different concept). **Defer until the actual pain forces the question** — small team + one flagship client doesn't surface this yet.

**Decision-bound:**
- **Fix #9 — RESOLVED 2026-07-12 (moot).** The Higgsfield WIP never existed in the stash: `HiggsfieldStudio.jsx` / `higgsfield.js` / `sync-cortex.mjs` were **untracked**, and the plain `git stash` (no `-u`) only captured tracked changes. The untracked files are gone from disk and were never committed anywhere — the WIP is lost. What the stash actually held (a 1,920-line `public/portal.html` rewrite + 2 one-line nav registrations + `.netlify/` build noise) is archived on branch `archive/portal-html-wip-2026-05-26`; stash dropped. `main` has zero Higgsfield references, so nothing dangles. If Higgsfield Studio is ever wanted, it's a fresh build, not a resume.

**Polish:**
- **Vantus-bot Slack app** for agent-attributed messages (currently posts as signed-in user via MCP).
- **Fix #14** — INITIAL_CONTENT seed array removed 2026-05-26 (commit `90beaa6`). `seed.content.js` now only exports `VITAL_LYFE_SOP`, still rendered by `SopsRoute` + `ClientView`. Per-client SOP schema decision is the remaining work before this constant can move into the DB.
- **Dead code sweep across `src/`** — brief drafted at `/tmp/codex-brief-deadcode.md`. Fire when Codex burst returns.
- **External tracker → n8n trigger** (SharePoint/Airtable side).
- Tighten `style-src 'unsafe-inline'` in CSP when inline-style React patterns get factored out.

**Cortex bridge (forward design — not built):**
- `wiki/clients/<slug>/brand-voice.md` → `clients.brand_voice_md` push pipeline via `scripts/sync-cortex.mjs` (stub lives in `stash@{0}`, not in working tree). DO NOT create `wiki/clients/` until founder signs off on the schema. See `~/.claude/projects/-Users-chrisz/memory/project_cortex_vantus_bridge.md`.

## Strategic Context
- **Client:** VitalLyfe (Natalia = approver, Jon = JC, Danny = Cloud Scenic ops)
- **Active campaigns:** Tierra Bomba at $100/day, influencer seeding ~27–30 confirmed
- **External tracker:** influencer list in SharePoint, NOT in Vantus
- **Slack:** posts go to `#vitallyfe-war-room` as "VitalLyfe War Room" bot via `SLACK_WEBHOOK_URL`

## Sister Project
Cloud Scenic OS lives at `~/Desktop/Software builds/Cloud Scenic OS/` — separate codebase, Portal Build Companion agent owns it. Don't mix the two.

## Key Files (Vantus)
- `src/App.jsx` — root component (1,342 lines, post Codex Fix #2 split). Owns all state; routes are dumb presentation.
- `src/ui/routes/` — 6 extracted route components (DashboardRoute · AgentsRoute · ContentRoute · TrackerRoute · TaskboardRoute · SopsRoute). Codex 2026-05-26 Fix #2.
- `src/services/apiFetch.js` — auth-aware fetch wrapper. Attaches `Bearer <access_token>` to every protected call.
- `src/services/supabaseClient.js` — Supabase singleton.
- `src/ui/clients/AddClientModal.jsx` — client CRUD + team management. Embeds ClientTeamPanel.
- `src/ui/clients/ClientTeamPanel.jsx` — invite/approve/reject UI.
- `src/ui/layout/LoginScreen.jsx` — Google OAuth button.
- `src/ui/agents/AgentChatPage.jsx` — chat panel. Passes `currentClient.id` as `client_id` for brand voice resolution. Voice-override textarea above quick actions.
- `netlify/functions/_lib/requireUser.js` — shared auth gate + per-request `cors(event)` (allowlist regex).
- `netlify/functions/_lib/rateLimit.js` — NEW 2026-05-26. In-memory sliding-window per-user rate limit.
- `netlify/functions/agent-action.js` — **On `main`:** 1,317-line monolith. **On `codex/grunt-2026-05-27` (awaiting merge):** 309-line router that imports 16 handlers from `netlify/functions/agent-action/handlers/`. Once merged, this becomes the post-Fix #4 shape.
- `netlify/functions/agent-action/handlers/` — **Codex branch only, awaiting merge.** 16 per-handler files (one per agent action). See CODEX_NOTES.md on the branch for the full list + extraction commits.
- `netlify/functions/chat.js` — Anthropic proxy. Rate-limit 30/min/user.
- `netlify/functions/notify.js` — client notifications + per-client Slack + per-client n8n (single consolidated Supabase fetch).
- `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql` — VitalLyfe brand voice seed (Move 1).
- `supabase/migrations/20260526_content_items_baseline.sql` — full content_items DDL (Fix #10).
- `supabase/migrations/20260526_content_items_client_rls.sql` — scoped client RLS + drop anon policy (Fix #10.1).
- `supabase/migrations/20260526_cid_library_rename_adaptation.sql` — column rename (Fix #3.1, idempotent DO block).
- `supabase/migrations/20260525_*.sql` — auth restore batch (client_users, slack_webhook, admin RLS, drop temp anon).
- `netlify.toml` — security headers (HSTS, CSP, Referrer-Policy, Permissions-Policy) added 2026-05-26.
- `architecture-map.html` — interactive system map (regenerated 2026-05-26 with all today's changes).
- `docs/architecture-map/` — portable markdown export (README · critical-path · nodes · known-bugs · roadmap · open-items).
- `docs/architecture-map/open-items.md` — checkbox punch-list. Current open count: 3 MED bugs + 2 LOW track-only + 4 numbered fixes. (#4 closed on codex branch awaiting merge; cid_posts LOW closed-by-removal; rotate-passwords closed-by-auth-disable.)
- `sprint-recap.html` — **NEW 2026-05-26 PM evening (untracked).** Single-page animated dashboard summarizing the day's work — 4 ticker counters, before/after agent-action.js shrinking bar, 3-agent collab cards, commit timeline, live ticker. Built as a video prop; keep or delete. Open at `http://localhost:4747/sprint-recap.html` if `python3 -m http.server 4747` is running from repo root.
- `docs/REFACTOR_PLAN.md` — pre-existing refactor roadmap.
- `START HERE.md` — quick-orient nav for cold opens.
- `CODEX_NOTES.md` — Codex's report from the Fix #2 split run (2026-05-26).

---
## 2026-07-04 — harness restart snapshot (recorded by Counsel)
> The Nerve Center multiplexer was shut down and came back **blank** on 2026-07-04; the live agent sessions in its tabs were lost (in-flight, uncommitted-to-chat context is gone — only on-disk state survives). This block records the exact repo state at restart so a cold-started agent can resume without stepping on uncommitted work. **Run `git status` yourself before acting — treat the list below as a starting point, not gospel.**
- Branch `main` · HEAD `a8ff98b` (2026-07-04, "docs(map): update punch-list — 10 map bugs fixed in the 2026-07-04 sweep").
- The narrative above (dated 2026-07-03) predates that 07-04 map-bug commit — treat this repo as **one commit ahead of the prose**.
- Untracked at restart (NOT committed): `COUNSEL_HANDOFF_2026-07-01.md`, `ripped out features/`.
- No tracked-file modifications pending. Owned by the Vantus terminal — Counsel only recorded state, did not edit the narrative.

---
## 2026-07-06 — post-crash recovery + map sync (Vantus terminal, closing)
Cold-started after a terminal crash. On-disk state was intact; no work lost. Verified the build (`npm run build` clean, 98 modules), then closed out the loose threads from the 2026-07-04 sweep:

**Shipped to prod (usevantus.com, HTTP 200):**
- Pushed the 5 sweep commits that were sitting local-only → HEAD `a8ff98b` deployed on Netlify.
- Ran migration `20260704_notify_dedupe_and_cleanup.sql` against prod (via Supabase SQL editor): `notifications.dedupe_key` cycle-aware index is live (re-approvals notify again), deprecated `clients.slack_channel_id` column dropped.
- Confirmed `TOKEN_ENC_KEY` already exists in Netlify — the crypto hard-fail change (encrypt() throws when key unset) is a no-op in prod; existing OAuth tokens were already encrypted with it. **Do NOT rotate that key** or already-stored tokens become undecryptable.

**Architecture map refreshed** → committed + pushed as `dc55cbf` (docs-only):
- HTML `FIXES`/`KNOWN_BUGS` badges were pre-sweep (showed all 10 fixed bugs as open) — rewritten to show only genuinely-open work. Removed the `dead-ui` node (its 3 components were deleted in the sweep). Findings panel + `slack_channel_id` note updated.
- `known-bugs.md`: 10 fixed bugs moved to a "Fixed in the 7/4 sweep" section. `open-items.md`: marked DEPLOYED, migration marked run. `roadmap.md`: added a shipped/partial/open status table.

**Still open (nothing blocking — tracked partials):**
- **#5 Stripe** — the one real unproven thing: `billing-stripe.js:64` live invoice create-path has never run against a real invoice. Send one small controlled invoice to validate webhook paid-sync before billing a client through it. (Email-overlap half already fixed.)
- **#7 admin scoping** — client boundary is doubly-safe now (RLS + client-half scope); give Ledger/Reports/Client-Analytics their own scoped fetches before the next heavy client.
- **#8 security** — crypto done; still open: rotate the Supabase admin password out of git history once fully off password login, tighten CSP style-src.
- **Spot-check owed:** the two 7/3 config outages (Google OAuth Drive origin, Resend domain) were reportedly fixed in-console — verify they held; neither surfaces an error where a human looks.

**Repo state at close:** `main` == `origin/main` (level, `dc55cbf`). Uncommitted/untracked and deliberately left: `HANDOFF.md` (this note + Counsel's restart note), `COUNSEL_HANDOFF_2026-07-01.md`, `ripped out features/`. Both push PATs used this session were one-shot — revoke at https://github.com/settings/tokens if not already done.

---
## 2026-07-12 — Hardening sprint (Fix #7 admin half + CSP + stash truth + integration probes)

**Shipped (4 local commits on `main`, awaiting founder push+deploy — repo is now 7 ahead of origin incl. the 3 held 7/9 commits):**
- `4fe5c97` **Fix #7 (admin half) DONE.** `useSupabaseRows` hook in `src/utils/hooks.js`; ReportsRoute + ClientAnalyticsRoute fetch their own slim windowed rows (90d; approvals limit 20 w/ `content_items(title)` embed; `account_posts` projected via `metrics->>` — jsonb blob no longer ships); global content blob bounded to `posted_at.is.null OR >= 90d` (`ACTIVE_CONTENT_DAYS`, App.jsx). Ledger deliberately keeps riding the bounded blob (realtime + optimistic-overrides interplay). Realtime channel unchanged — patch-only handlers self-maintain the bound. Query syntax validated against live PostgREST (anon 200s). Remaining client half: portal-user `client_id=eq.` re-subscribe.
- `3758a98` **CSP: `'unsafe-inline'` dropped from style-src (Fix #8).** The old "styled-jsx" comment was wrong — no styled-jsx exists, and React `style={{}}` goes through CSSOM (not governed by style-src). Real consumers: LoginScreen's runtime `<style>` injection (moved into `globals.css`) and the GIS button stylesheet (sha256-allowlisted; unused by our UI anyway). Verified on a draft deploy: login pixel-identical, console zero violations.
- `d8f7b0c` **Stash truth + credential redaction.** `stash@{0}` was never the Higgsfield WIP — those files were untracked and plain `git stash` skipped them; they're gone (Fix #9 = moot, fresh build if ever wanted). Actual stash contents (portal.html rewrite + 2 nav one-liners) archived on `archive/portal-html-wip-2026-05-26`, stash dropped. Leaked password literal redacted from all current-tree docs.

**Integration probes — all three "reportedly fixed" integrations are BROKEN in prod (see VANTUS_TODO 🚨 block for fixes):**
1. **Stripe:** `STRIPE_SECRET_KEY` is not a Stripe-shaped value in ANY Netlify context (prod 20 chars, dev 64) — Stripe returns 401. The known-bugs "key is live" claim was wrong. Fix #5 proof invoice is blocked until the real key is set.
2. **Resend:** `RESEND_API_KEY` equally invalid (not `re_`-shaped, API rejects) → all outbound email dead. The rogue env var NAMED `re_jEHHfr94_…` still exists — treat that value as burned, rotate in Resend, set the new key, delete the rogue var.
3. **Google OAuth:** live probe of the GIS popup URL → Google still serves `origin_mismatch` for `https://usevantus.com` (client `844741925554-i2j0…`). The 7/3 console fix never took. Drive upload has never worked in prod.

**Deploy note:** these 4 commits are safe to deploy independently of the key fixes (nothing depends on Stripe/Resend/OAuth). `netlify deploy --build --prod` after founder review; git auto-deploy still credit-blocked.

---
## 2026-07-13 — status ping (no Vantus code work)

Session pivoted to a Danny catch-up email (Dynasty demo, lives at `/tmp/danny-dynasty-demo-email.txt`, owned by the Dynasty session — not Vantus work). Framing correction from Christian for whoever revises it: Dynasty is **already sold**; the email is a catch-up for Danny, not a pitch. He rates the current draft "some good, some eh" — revision pending in the owning session.

**Vantus state unchanged since the 7/12 block above:**
- `main` ahead 7 of origin (3 held 7/9 commits + 4 hardening commits). Push still gated on a one-shot PAT from Christian; deploy via `netlify deploy --build --prod` (git auto-deploy still credit-blocked).
- The three broken integrations (Stripe key invalid, Resend key invalid + rogue `re_…`-named env var, Google OAuth origin unregistered) are still awaiting Christian's ~10-min console session — see the 🚨 block in VANTUS_TODO.md.
- Incidental: `.netlify/netlify.toml` shows modified (regenerated by the 7/12 CLI draft deploys, same class of noise as the untracked manifest — harmless, don't commit it).
