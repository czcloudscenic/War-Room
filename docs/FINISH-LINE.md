# Vantus Finish Line

**Started:** 2026-09-18. **Goal:** a team member runs a real client through the whole loop (onboard, plan and approve content, track the work, bill, report) with nothing breaking.

**Ship freeze is ON** until every MUST below is checked. No work in `src/ui/ship/`, `src/ship/`, `public/crew/`, `public/props/`, `public/hull/`, `public/sentinel/` or `crewGLB.js` except to stop a crash on a non-ship route. The spec itself puts the ship last (Phase E item 6, "cosmetic layer LAST").

Sources: `VANTUS-V3-BUILD-SPEC.md` (frozen 7/31, in ~/Downloads) and `docs/architecture-map/open-items.md`. Rule used for sorting: if the onboard, approve, work, bill, report loop breaks without it, it is a MUST. Everything else is SHOULD or CUT.

## MUST (in build order)

- [ ] **M1. Full-loop stress pass on prod, in a real browser.** `STRESS-TEST.md` only covers the 7/29 feature pack and still says email is a dry run (it is live now). Extend it to the whole loop (onboard a client, scope, content through both approval gates, portal, intake, deliverables, invoice, monthly report), run it on a disposable client, log every failure, fix each one. Never done before. **8h**
- [ ] **M2. AI layer proven.** Run one `sentinel_classify`, confirm a receipt (the row in `agent_events` that proves an agent did something), then confirm each agent action returns something real. Closes Fix #1 once auto-reload is on. **1h**
- [ ] **M3. Stripe proven end to end.** Function-side key check, webhook registered, $1 proof invoice paid, local row flips to paid. Closes Fix #2. Needs console item 2. **2h**
- [ ] **M4. App.jsx slice C.** Move the trailing route mounts (agents, content, apps, settings) and the realtime and data loaders out of the 1,192-line file, so Phase C screens land on decomposed code. Closes Fix #8. **4h**
- [ ] **M5. Setup dies as a destination.** Its fields fold into the client workspace: retainers and rates, Facts of Record, report recipients, social accounts, intake link, included revisions, primary email. Team roster moves to Agents. Spec C.6 and section 9. **6h**
- [ ] **M6. WORK destination.** Operations becomes Work: the board, tasks, intake, and the Ledger renamed Deliverables as a global filterable view inside it. Ledger dies as a tab. Spec C.7 and section 9. **6h**
- [ ] **M7. Content merge.** Pipeline kanban, runway bars and the calendar become one Content view over the same `content_items` rows. Spec C.5. **5h**
- [ ] **M8. Growth tuning.** The pass promised on 8/24, driven by whatever M1 finds on the Growth screens. **3h**
- [ ] **M9. Drive upload verified on prod.** No code. Needs console item 3, then one real upload. Closes Fix #3. **0.5h**

Total: about 35 hours of build.

## SHOULD (after the MUSTs, before the freeze lifts only if cheap)

- **platform_post_id writer (Fix #11).** Marked SHOULD because there is no Sprout wiring anywhere in the repo. Manual "mark posted" already produces receipts, so the loop does not break. Cheap version later: match synced `account_posts` rows to content items by client, platform and time window, and propose the match for a human to confirm.
- **Reports and Client Analytics merged into the workspace "Analytics and Reports" tab** (spec section 9). Both tabs work today.
- **Sidebar regrouped to the 8 spec destinations.** Falls out of M5 to M7 mostly for free.
- **Backup restore drill** with the last-tested date shown in Admin (spec B.8). Backups run nightly; a restore has never been tested.
- **Agent activity in four lists** (done 48h, working now, queued, blocked) on Command (spec C.3).
- **Archive QC Test Kitchen** fixture client.
- **ai() default model to a cheaper one** if spend runs hot (Fix #9).

## CUT for this block

- Everything ship: Fix #7 crew GLBs, Fix #10 parked ship modules, the bow-legged stance, spec E.6 and section 10. Frozen.
- Spec Phase E items 1, 2, 4, 5 (Performance Interpreter, Facts Steward, rework memory, Generators tab). The spec says only after A through D hold.
- Meeting capture by voice (spec C.7). The draft-only intake form covers intake.
- Sprout API pull (spec C.5). No API access.
- Gemini quota (Fix #4). Deferred by Christian 8/21.
- The spec's own cut list stands: contractor module, capacity simulator, full profitability, asset library agent, permissions matrix, black-box scores, selling Vantus externally.
- Parked, do not start: Blueprint port (repo access blocked), vantus-site.

## Only Christian can do (console clicks, no code)

1. **Anthropic auto-reload.** https://console.anthropic.com/settings/billing → "Auto reload" → on. Unblocks M2 staying true.
2. **Stripe.** Keys: https://dashboard.stripe.com/apikeys (confirm the live secret key starts `sk_live_` and matches Netlify). Webhook: https://dashboard.stripe.com/webhooks → Add endpoint → URL `https://usevantus.com/api/billing/stripe-webhook` → events `invoice.paid`, `invoice.payment_succeeded`, `invoice.voided`, `invoice.marked_uncollectible` → copy the signing secret (`whsec_...`) into Netlify as `STRIPE_WEBHOOK_SECRET`, production context. Unblocks M3.
3. **Google OAuth origin.** https://console.cloud.google.com/apis/credentials → the OAuth 2.0 Client ID Vantus uses → "Authorized JavaScript origins" → add `https://usevantus.com`. Unblocks M9.
4. **Supabase plan.** https://supabase.com/dashboard/project/wjcstqqihtebkpyuacop/settings/billing → Pro removes the auto-pause, which is the one way the whole product goes dark.
5. **Danny recap email (Fix #6).** Send the draft. Ask only for his data entry and the skill-briefs file.
6. **Parlour Bar primary email.** usevantus.com → Clients → Parlour Bar → edit → Primary email.

## Log

- 2026-09-18: list written. Starting M1.
- 2026-09-18: M1 script done (`STRESS-TEST.md` now covers the full loop, email treated as live, pushed). The run itself is BLOCKED on a login: the automation browser has no Vantus session and sign-in is Google only, so Christian signs in once in that browser window. First failure logged (row 1, low).
- 2026-09-18: M4 part 1 done locally (trailing route mounts moved into `ui/AppRoutes.jsx`, App.jsx 1,192 to 1,150 lines, build and 93 tests pass, every prop checked). NOT pushed: it waits for the logged-in route sweep. Part 2 (realtime and data loaders into hooks) also waits for a browser, since realtime cannot be proven by a build.
- 2026-09-18: FREEZE EXCEPTION by Christian's call (/goal: crew must look proper, agents wired to their models). Two ship commits pushed: `b142d98` standing stance (bow-legged bug closed in code, not by re-rigging: foot gap 29-34% of stature to 12%, knee 152 to 164, sideways knee bow to 0, measured live on all four crew) and `b82176a` wiring (AI Assign receipts now move Sean, growth briefs put Scrappy at Intel, Scope Sentinel receipts light Finance Core, guard test reads the real dispatch table). The freeze is back on. Displaced: M4 part 2 and M5.
