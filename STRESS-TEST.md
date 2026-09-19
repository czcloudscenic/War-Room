# Full-loop stress test (rewritten 2026-09-18, was the 7/29 feature-pack script)

Runs a disposable client through the whole loop on **usevantus.com**: onboard, scope, content and approvals, work, bill, report. This is finish-line item M1 in `docs/FINISH-LINE.md`. Log every failure in the table at the bottom, fix it, re-run that step.

> **EMAIL IS LIVE.** The Resend key is set in production, so every send is real. The disposable client **ZZ Stress Test** must carry only addresses Christian owns (primary email and portal invite). Never point it at a client address. Break things on ZZ, not on Dynasty, Parlour or VitalLyfe.

> The 7/29 ZZ fixture was deleted on 8/21. Step 0 recreates it.

---

## 0 · Onboard (new, never tested end to end)

1. **Clients → Add client** → name `ZZ Stress Test`, primary email = an inbox Christian owns, approval mode = client.
- [ ] The client appears in the grid without a refresh, and **Open** lands on its workspace (7 tabs), not the dashboard.
- [ ] Every workspace tab renders with an honest empty state (no fake zeros, no crash, no console errors).
- [ ] The Dashboard activation checklist now lists ZZ's missing setup (retainer, facts, recipients) as next actions.
2. **Setup → Retainers & scope → ZZ**: set a retainer, included revisions = 2, a weekly cadence, a report recipient.
- [ ] Values persist after reload and show in the workspace Scope tab.
- [ ] The activation score moves.
3. **Scope** page: add one manual scope entry for ZZ (Fix #12 path).
- [ ] It lands in the register with the right classification and shows in the monthly roll-up.
4. Create three content items for ZZ: "ZZ: Copy gate", "ZZ: Content gate", and one titled "internal-only" kept out of client view.
- [ ] They show in Pipeline, Ledger, Calendar (once dated) and Runway as the same rows.

## 1 · Client portal (the big one)

Setup (once, ~2 min, any admin):
1. usevantus.com → **Clients** → open **ZZ Stress Test** → edit → portal access panel → invite a **personal Gmail** (anything not @cloudscenic.com).
2. Approve the invite when it shows as pending.
3. Open an incognito window → usevantus.com → sign in with that Gmail.

Expect:
- [ ] You land in the **client portal**, NOT the admin app (no sidebar, no Dashboard/Billing).
- [ ] You see exactly **2 items** ("ZZ: Copy gate", "ZZ: Content gate"). The item titled "internal-only" must **never** appear — if it does, stop and flag it.
- [ ] **Approve** the copy item → card confirms; in the admin tab it's now "Ready For Content Creation" and the bell rang.
- [ ] **Request changes** on the content item with a note → admin side shows "Needs Revisions", the note is in the item's Client Note, Ledger badge reads **R1/2**.
- [ ] Kick it back once more (move it back to Need Content Approval as admin, client rejects again) → badge hits **R2/2 amber** and a "revision cap reached" bell fires.
- [ ] Two browsers open (admin + client): status changes appear live without refresh.

## 2 · Timestamped video comments

1. As admin: open "ZZ: Content gate" in the pipeline modal → **Review** section → **Upload review cut** (any short web-ready H.264 mp4).
2. Play, pause mid-video, post a comment with **Pin to current time** on.
3. As the portal client: open the same item → play the video, click the timecode chip (player should seek), reply with your own pinned comment.

Expect:
- [ ] Comments appear in BOTH windows live; client comments ring the admin bell + Slack.
- [ ] Admin ✓ (resolve) greys the comment out.
- [ ] A copy-only item (no video) still shows a working plain comment thread.

## 3 · One-click email approvals

The Resend key is live, so these are real emails to ZZ's primary address:
- [ ] Move a ZZ item into an approval gate → client email arrives with **Approve / Request changes** buttons.
- [ ] Clicking a button opens a **confirmation page** — verify nothing changed yet (email scanners prefetch links; GET must be inert).
- [ ] Confirm → decision recorded; the OTHER button's link now says "Already recorded" (single-use, sibling invalidated).
- [ ] Try the same link twice → "Already recorded" both times.

## 4 · Public intake form

1. **Setup → Retainers & scope → ZZ Stress Test → Intake link → Copy link.**
2. Open it logged OUT (or on your phone) → the form greets "New request — ZZ Stress Test".
3. Submit a request → bell + Slack fire.
4. **Operations → Intake** tab → the request is there → **Promote** → it appears in the Ledger as a real item (description carries submitter + links).
- [ ] **Rotate** the token in Setup → the old link must show "link isn't valid".
- [ ] Try `usevantus.com/intake?t=garbage` → invalid-link screen, no submission possible.

## 5 · Revision caps

- [ ] Setup Section 1: each client has an **Included revisions** field (ZZ = 2).
- [ ] Ledger badge colors: grey under cap, **amber at cap, red over**.
- [ ] Portal shows "Round n of 2 included" + a billing note when at/over.

## 6 · Bottleneck detection

The cron runs daily 16:00 UTC. The ZZ items will start tripping it after 3 days at a gate — expect: an **Item stuck** bell, a Slack digest line, and an auto-created **"Unstick: …"** task in Operations that completes itself when the item moves. (Client-mode stuck items also re-send the approval email.) Manual dry-run for the impatient: `/.netlify/functions/check-stuck-items?test=1&key=<CRON_TEST_KEY>`.

## 7 · Margin view

1. **Setup → Team roster**: enter a **$/mo** cost for each member.
2. **Client Analytics**: Margin column populates (green ≥50% / amber ≥20% / red below); footer shows unallocated cost if someone has no delivered items.
3. **Billing**: "Est. net margin" tile = MRR − total team cost.
- [ ] Sanity: margins move when you change a cost or reassign a delivered item.

---

## 8 · Bill (new)

Needs Stripe proven first (finish-line M3). Until then, test the manual path only.
- [ ] **Billing**: ZZ shows with its retainer; MRR and the margin tile include it.
- [ ] Create a $1 invoice for ZZ → it appears in Stripe → pay it → the local row flips to **paid** with no refresh trick.
- [ ] Void a second $1 invoice → the local row flips to void.
- [ ] **Profitability**: ZZ's revenue minus hard costs renders; adding a hard cost moves the number.

## 9 · Report (new)

- [ ] **Reports**: generate ZZ's monthly report; numbers match the Ledger (delivered counts) and nothing is fabricated when data is missing.
- [ ] The monthly send (`send-monthly-reports`) dry-run lists ZZ with the recipient set in step 0 and no one else's address.
- [ ] **Client Analytics**: ZZ row renders with no connected accounts (honest empty state).

## 10 · The other destinations (smoke)

- [ ] **Approvals** inbox shows the ZZ gate items with Approve, Edit, Reject working.
- [ ] **Decision log**: add a decision on ZZ, it shows in decision debt until answered.
- [ ] **Vault**: add a ZZ secret, it is masked by default and the view is audit-logged.
- [ ] **Growth**: scrape, audit, brief, convert on one test prospect; convert creates the client record once, not twice. Note every rough edge here for finish-line M8.
- [ ] **Agents**: with credits loaded, one action per agent returns a real result and writes a receipt (finish-line M2).
- [ ] Every sidebar destination opens with zero console errors on desktop and at phone width.

## When you're done

Tell the Vantus agent to clean up: archive/delete **ZZ Stress Test** (cascades its items, comments, tokens, intake rows) and the Stripe test customer.

## Known-not-bugs

- Notification bell only shows for the currently selected client (it's client-scoped by design).
- Dynasty audit rows from the Software OPS tab show actor "Admin" — known tradeoff, owned by the dynasty-leads repo.
- The ship route is frozen (see `docs/FINISH-LINE.md`); visual issues there are not logged here.

## Failure log

| # | Date | Step | What happened | Fix (commit) | Re-verified |
|---|------|------|---------------|--------------|-------------|
| 1 | 9/18 | login page | Console error: Google's sign-in script is blocked from adding an inline style by our content security policy (the browser rule list of what a page may load). Sign-in button still renders. Low. | open | |
| 2 | 9/18 | 0 Onboard, Open | **Whole app went blank.** A tab opened before a deploy asked for the old `ClientWorkspaceRoute` code file, got a 404, and with no error boundary the app unmounted to a white page. Hits any teammate whose tab spans a deploy. High. | fixed: `lazyRoute` reloads once on a stale code file, `RouteErrorBoundary` keeps the sidebar alive if a page crashes, six missing pages added to the warm list | pending prod check |
| 3 | 9/18 | 0 Onboard, workspace Activity tab | Agent receipts never showed: the query asked `agent_events` for a `created_at` column that does not exist (the column is `ts`), so the database answered 400 and the tab always read "No recorded activity". Med. | fixed in `ClientWorkspaceRoute.jsx` | pending prod check |
