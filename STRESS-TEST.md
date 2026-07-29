# Feature-pack stress test — team script (2026-07-29)

Everything below is **LIVE on usevantus.com** (commits `46c4d6b`…`260c4b1`, migrations applied 7/29). A disposable client **ZZ Stress Test** is seeded with three items so you can start immediately. Break things on ZZ, not on Dynasty/Parlour/VitalLyfe.

> **Email caveat:** `RESEND_API_KEY` is still empty in prod, so every email (one-click approval links, cap alerts, stuck digests, intake alerts) is a **dry-run log line** in the Netlify function logs instead of a real send. Bells, Slack, tokens, and all state changes work regardless. Paste the real key to test the emails themselves.

---

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

Requires the Resend key. Once pasted:
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

## When you're done

Tell the Vantus agent to clean up: archive/delete **ZZ Stress Test** (cascades its items, comments, tokens, intake rows) and finally archive **QC Test Kitchen** (the 7/3 fixture — its stuck test item is already tripping the bottleneck cron, correctly but noisily).

## Known-not-bugs

- Emails logging `[email dry-run]` — Resend key is empty, expected.
- Notification bell only shows for the currently selected client (it's client-scoped by design).
- Dynasty audit rows from the Software OPS tab show actor "Admin" — known tradeoff, owned by the dynasty-leads repo.
