# Known Bugs — severity-ranked

> Snapshot 2026-08-21. Every entry cites file:line. Cross-references: [roadmap.md](roadmap.md) fix numbers.

## 🔴 HIGH

### Anthropic credit balance is $0 — every AI feature is down
`netlify/functions/agent-action/_shared.js:161` · Observed 2026-08-21 during Phase D verification: the API returns `400 invalid_request_error: Your credit balance is too low`. What's at risk: QC review, Muse, Scrappy, CID, Content Intel, AI Assign, chat, and the new Scope Sentinel all error the moment anyone uses them. What triggers it: any AI action. This is a prepaid-balance problem on the Anthropic console account, not a code defect — the code path was proven right up to the API. → **Fix #1**.

## 🟡 MED

### Client "Open" button goes to the dashboard, not a client workspace
`src/App.jsx:1501` · `onOpen` switches tenant then `setActiveNav("dashboard")`. Danny-confirmed. What's at risk: the flagship "open a client, see everything" flow doesn't exist; Setup remains a separate cockpit. What fixes it: the Phase C client-workspace shell IS the fix (there is no smaller patch — no workspace route exists anywhere). → **Fix #5** (gated on Danny's veto pass).

### Stripe keys installed but never validated
`netlify/functions/billing-stripe.js:22` · Both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` exist as production secrets, but the 7/12 audit flagged them malformed and nothing since proves otherwise. What's at risk: "Create & send" on Billing may error on first real use; the payment webhook may reject signatures silently. What triggers it: the first real invoice. → **Fix #2**.

### Email is armed with no dry-run net
`netlify/functions/notify.js:304` · Not a defect — a live-wire warning. Since the Resend key went live, approval links, report emails, and digests really deliver to whatever addresses are configured. What's at risk: a half-configured client (wrong `primary_email`, test data) now receives real email. What triggers it: any approval/report event on a client-mode item. Mitigation: treat the first client-facing send as a deliberate moment; check recipients in Setup first.

### Drive upload has never worked in production
`index.html:11` (GIS script) + `VANTUS_TODO.md:23` · `usevantus.com` was never added as an authorized JavaScript origin on Google OAuth client `844741925554-…`; live probes return `origin_mismatch`. What's at risk: any workflow expecting file upload to Drive from the app silently fails in prod (works only in local dev). → **Fix #3**.

### App.jsx is a 1,622-line monolith with no test suite
`src/App.jsx:129` · All app state, auth, realtime, and route mounts in one file; QA is manual. What's at risk: every feature change rides through this file; regressions have no automated net (the 15-40s boot bug lived here for weeks). Structural risk, not a defect. → **Fix #8**.

## 🟢 LOW

### verify-publishes auto-verify is inert — no platform_post_id writer
`netlify/functions/verify-publishes.js:13` · The join from content_items to synced account_posts is built and queried (line 77) but nothing writes `platform_post_id` yet, so auto-verification never fires; only the manual markPosted path produces receipts. Goes live with Phase C Sprout/schedule wiring. → **Fix #11**.

### follow_rate and hook_hold are permanently null
`netlify/functions/agent-action/handlers/intel.js:52` · Instagram's API does not expose per-post follows (null on all 57 posts even with full scopes) and there is no duration source for hook-hold. By design — documented here so nobody "fixes" it.

### Gemini quota exhausted — VL generators dead
`VANTUS_TODO.md:25` · The 7 VitalLyfe generators 429 until billing is flipped in Google AI Studio. Deferred by Christian on 8/21. → **Fix #4**.

### 5 parked ship modules + 2 archive folders inflate the repo's mental map
`src/ui/routes/ShipRoute.jsx:120` · ShipWorld3D + shipModel/environment3d/greebles + shipRenderer/shipRendererArt are unmounted on purpose (art-direction decision pending); `ripped out features/` and `(experimental)/` hold removed code. Deliberate, but a new maintainer will waste time here without this note. → **Fix #10**.
