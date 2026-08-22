# Open Items — Vantus Punch List

> Working doc. Mirrors the **Bugs & Roadmap** tab in `architecture-map.html`.
> Check items off as you fix them. Keep this file current — it's the single source of truth for "what's left."

**Snapshot:** 2026-08-22 (evening) · **Total open:** 7 bugs + 9 fixes

```
🔴 High:   1    │   ✅ Done 8/22:  client workspace SHIPPED (Open-button bug dead) ·
🟡 Med:    3    │      health factors + bottleneck panel · approval-confirmed flag LIVE ·
🟢 Low:    3    │      0 npm vulns (dead pdfjs-dist removed) · test harness (22 checks) ·
                │      TEST-QC item scrapped · mp4 404 probe silenced
```

---

## 🔴 HIGH — fix this week

- [ ] **netlify/functions/agent-action/_shared.js:161 — Anthropic credits at $0, all AI down**
  Every AI action (QC, Muse, Scrappy, Intel, Sentinel, AI Assign, chat) errors with "credit balance is too low" (observed 8/21). Two minutes at console.anthropic.com un-gates the entire agent layer; set auto-reload so it never silently dies again.
  → Touches: Anthropic console only · Fix #1

---

## 🟡 MED — fix when planning next refactor

- [x] ~~Open button routes to dashboard~~ **FIXED 8/22**: ClientWorkspaceRoute shipped (7 tabs, health factors, confirm flag) under Danny's "Make Vantus work" delegation; verified in a real browser on prod. Remaining Phase C scope (content merge calendar, WORK board, Growth v1) tracked under Fix #5.

- [ ] **netlify/functions/billing-stripe.js:22 — Stripe keys set but never validated**
  Flagged malformed 7/12, untested since. First real invoice may error; webhook may reject signatures. One curl + a $1 proof invoice settles it.
  → Touches: Stripe dashboard, Netlify env · Fix #2

- [ ] **netlify/functions/notify.js:304 — email armed, no dry-run net**
  Approval links / reports / digests really deliver now. Before the first client-facing flow fires, sanity-check each client's primary_email and report recipients in Setup.
  → Touches: Setup data entry (no code)

- [ ] **index.html:11 — Drive upload broken in prod (origin_mismatch)**
  Google's OAuth client was never told usevantus.com is allowed. One console field; a few minutes to propagate.
  → Touches: Google Cloud Console · Fix #3

- [ ] **src/App.jsx:129 — 1,622-line monolith, no tests**
  All app state and auth in one file; the boot bug lived here for weeks unseen. Decompose in slices + add boot/approval smoke tests.
  → Touches: `src/App.jsx`, new modules · Fix #8

---

## 🟢 LOW — track, no urgency

- [ ] **netlify/functions/verify-publishes.js:13 — auto-verify inert (no platform_post_id writer)**
  The join is built and queried but nothing stamps the id; only manual markPosted produces receipts. Goes live with Phase C Sprout wiring.
  → Touches: scheduling path · Fix #11

- [ ] **VANTUS_TODO.md:25 — Gemini quota, VL generators dead**
  429s until billing flips in AI Studio. Deferred by Christian 8/21.
  → Touches: Google AI Studio · Fix #4

- [ ] **src/ui/routes/ShipRoute.jsx:120 — 5 parked ship modules + 2 archive folders**
  Deliberate (art-direction pending), but decide-or-delete keeps the map honest.
  → Touches: `src/ui/ship/`, `src/ship/`, archive folders · Fix #10

*(Not a checkbox: `intel.js:52` follow_rate/hook_hold are null BY DESIGN — IG doesn't expose them. Documented so nobody "fixes" it.)*

---

## 📋 Numbered Roadmap Fixes

Cross-references map node badges + the items above.

- [ ] **#1** — Top up Anthropic credits + auto-reload → console only; re-verify sentinel_classify after
- [ ] **#2** — Prove Stripe (key curl → webhook registration → $1 invoice) → `billing-stripe.js`, Stripe dashboard
- [ ] **#3** — Add usevantus.com to Google OAuth JS origins → Google console
- [ ] **#4** — Flip Gemini billing → AI Studio (deferred)
- [x] **#5a** — Client workspace shell SHIPPED 8/22 (Open-button fix verified live). Remaining #5b: content merge calendar, WORK board intake, Growth v1 (v1 needs site-Supabase creds)
- [ ] **#6** — Send Danny recap email; his data entry greens the activation board → draft ready
- [ ] **#7** — Finish Muse/Scrappy/Slate GLBs → `public/crew/`, `crewGLB.js` (GATED: Higgsfield billing)
- [ ] **#8** — Decompose App.jsx + smoke tests → `src/App.jsx`
- [ ] **#9** — Optional: ai() default opus-5 → sonnet if spend runs hot → `_shared.js:161`
- [ ] **#10** — Retire or revive parked ship stack + archive folders → `src/ui/ship/`, `src/ship/`
- [ ] **#11** — platform_post_id writer (with Sprout wiring) → scheduling path, `verify-publishes.js:77`

---

## Cross-cutting work

### When #2 lands → register the webhook + verify the flip
```
Stripe → Developers → Webhooks → Add endpoint
  URL: https://usevantus.com/api/billing/stripe-webhook
  Events: invoice.paid · invoice.payment_succeeded · invoice.voided · invoice.marked_uncollectible
Then: send the $1 proof invoice, pay it, watch the local row flip to paid.
```

### When #5 (Phase C) starts → the consolidation map applies
Setup and Ledger die as destinations (fields fold into workspace widgets; Ledger renames to Deliverables inside Work). Don't build new features onto Setup in the meantime.

### Standing console items (no code, human-only)
- dv/ss: run the Supabase "Forgot password" check (cz is GitHub-OAuth-linked — nothing to rotate)
- Higgsfield billing (grace-period throttle) — gates Fix #7
- Keep TOKEN_ENC_KEY + BACKUP_ENC_KEY exactly as-is; rotating either orphans encrypted rows

### Env-var audit gotcha (burned three audits — don't repeat)
`netlify env:list`/`env:get` read the DEV context by default and return secret values MASKED (20 asterisks). Always pass `--context production`, and only trust a function-side proof for validity.

---

## Suggested attack order

1. **#1** (2 min, console) — un-gates the entire AI layer AND the last Phase D verification. Nothing else on this list restores more capability per minute.
2. **#6** (send the email) — Danny answered "Make Vantus work" 8/22 (delegation); the email's remaining value is his DATA ENTRY list + the skill-briefs file only he has.
3. **#2 + #3** (one console sitting, ~15 min) — proves Stripe and fixes Drive; after #2, run the $1 invoice while you're in there.
4. **#8** (next code session) — structural debt; do it BEFORE #5 so the workspace shell lands on a decomposed App.jsx, not on the monolith.
5. **#5b** (rest of Phase C: content merge calendar, WORK board, Growth v1) — workspace shell already shipped 8/22; Growth v1 additionally needs the site-Supabase creds.
6. **#7** (when Higgsfield billing is fixed) — one mechanical session, recipe proven.
7. **#4, #9, #10** — opportunistic; none block anything.

---

## How to keep this current

When you fix an item:
1. Add `~~strikethrough~~` to the bullet OR check the box `[x]`
2. Move the badge count at the top
3. If the fix touched multiple items, mark each
4. Commit alongside the code fix so the punch-list reflects reality

If the architecture changes meaningfully (new tables, new functions, big refactor):
- Regenerate `architecture-map.html` via the `/architecture-map` skill (or `/health`)
- The HTML's Bugs & Roadmap tab regenerates from the source data
- Update this file by hand to match the new state, OR re-run the skill to overwrite this file too
