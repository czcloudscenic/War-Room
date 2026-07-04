# Critical Path — the QC gate flow

> The spine of the system since 7/2: **nothing posts with a wrong price or wrong hours.** A deliverable moving to the content-approval gate is automatically fact-checked against the client's Facts of Record — caption AND artwork — and hard-blocked until clean. Verified end to end in production on 2026-07-03.

1. **[UI]** An editor finishes a deliverable and sets its status to **Need Content Approval** in the edit modal — `src/ui/pipeline/EditContentModal.jsx` (status select; SOP checklist at 16-47 already shows the QC gate row).

2. **[DB]** `handleSave` writes the updated row to `content_items` — `src/App.jsx:713-753`. Plain English: the item is saved with its new pipeline position.

3. **[HTTP]** Because the status *transitioned into* Need Content Approval, `handleSave` fire-and-forgets `POST /api/agent-action {action: qc_review}` — `src/App.jsx:743-749`. (Only on the transition — re-saving an item already at the gate does not re-fire.)

4. **[HTTP]** `netlify.toml` routes `/api/agent-action` → `agent-action.js`; `requireUser` + rate limit pass — `netlify/functions/agent-action.js:1654-1657`.

5. **[DB]** The `qc_review` handler loads the content row and the client's `client_facts` + `facts_updated_at` — `agent-action.js:333-344`. Plain English: it pulls the deliverable and the client's book of true facts (prices, hours, phones, offers).

6. **[API]** `fetchDriveImage` downloads up to 3 attached images from Google Drive (`drive.google.com/uc?export=download`, 4.5MB cap, image/* only) — `agent-action.js:235`. Files got there via the modal's upload flow, which sets anyone-with-link sharing (`EditContentModal.jsx:105-109`).

7. **[LLM]** `aiVision` sends image blocks + caption/script/CTA to **claude-sonnet-4-6** with a strict-JSON QC prompt; the model extracts on-asset text and flags issues — `agent-action.js:201` (helper), `:401` (call).

8. **[CODE]** `runExactFactChecks` runs deterministic checks over copy + the model's extracted text: expired/future offers, price-of-record mismatches within a 60-char window of a $ amount, phone numbers matching no location — each a hard BLOCKER. Plain English: code catches the "9AM vs 10AM" class of errors even if the AI missed them.

9. **[DB]** Verdict written: `qc_status` (pass / flagged / blocked), `qc_issues[]`, `qc_ran_at` PATCHed onto the row — `agent-action.js:441`. An `agent_events` row logs the run; Slack gets a 🛡️ card (loud when blocked).

10. **[WS]** Supabase realtime pushes the updated row to every open tab — `src/App.jsx:491-522` — and the Ledger row grows its `QC BLOCKED` / `qc pass` pill.

11. **[UI]** The gates hold: Ledger `doApprove` refuses a blocked item at the content stage (`src/ui/routes/LedgerRoute.jsx:74-78`), `doPosted` refuses too, and the edit modal disables Save into Ready For Schedule/Scheduled (`EditContentModal.jsx:37-44`). The human fixes the caption or artwork, hits **Run QC** (`LedgerRoute.jsx:85-99`), gets a pass.

12. **[HTTP → DB]** Approve now succeeds: `recordApproval` writes the `approvals` audit row, advances the item's status, and calls `/api/notify` — `src/core/approvals.js:28-66`.

13. **[API]** `notify.js` inserts the bell row (deduped on `unique(type, content_item_id)` — first writer wins, duplicates skip all channels), posts the Slack card, emails admins via Resend, and pings n8n — `netlify/functions/notify.js` (dedupe gate added 7/3).

**Timing note:** first QC run of the day can take 10-15s (cold function + vision call); warm runs landed in ~5-20s during the 7/3 test campaign.
