# Roadmap — numbered fixes

> Snapshot 2026-08-21. Numbers match the green badges in `architecture-map.html` and the punch-list in [open-items.md](open-items.md).

### #1 — Top up Anthropic API credits (un-gates ALL AI)
Touches: console.anthropic.com only (no code).
- Plans & Billing → add ~$25 credits, enable auto-reload with a monthly cap
- Re-verify: run one `sentinel_classify` from the Scope Sentinel page (the only unchecked Phase D box)
- Unblocks: QC, Muse, Scrappy, CID, Intel, AI Assign, chat, Sentinel — everything under `agent-action.js`

### #2 — Prove Stripe end to end
Touches: Stripe dashboard, `netlify/functions/billing-stripe.js`, Netlify env.
- Validate the key: `curl https://api.stripe.com/v1/account -u "$KEY:"` (command already staged with Christian)
- If invalid: paste fresh `sk_live_…` + register the webhook endpoint `https://usevantus.com/api/billing/stripe-webhook` with the 4 invoice events → paste `whsec_…`
- Run the controlled $1 proof invoice (old Fix #5 from the 7/18 board)
- Unblocks: real billing, the Stripe half of Phase D economics, truth_registry's "Stripe=payments" claim

### #3 — Register usevantus.com as a Google OAuth origin
Touches: Google Cloud Console → Credentials → client `844741925554-…`.
- Add `https://usevantus.com` and `https://majestic-cassata-aa16e9.netlify.app` to Authorized JavaScript origins
- Wait a few minutes for propagation, then test a Drive upload in prod
- Unblocks: Drive-backed deliverable uploads (QC pulls Drive bytes today, but uploads from the app have never worked)

### #4 — Flip Gemini billing (VL generators)
Touches: Google AI Studio billing. Deferred by Christian 8/21 — do whenever.
- Attach billing to the project owning the existing key; 429s clear immediately

### #5 — Phase C: client workspace shell (fixes the Open button)
Touches: `src/App.jsx:1501`, new workspace route, Setup field redistribution. **GATED on Danny's veto pass** (5 items in the recap email).
- Build the per-client workspace: Overview · Scope & Rates · Deliverables · Facts · Analytics & Reports · Decisions · Documents · Portal & Access · Activity · Software (Dynasty)
- Point `onOpen` at it; retire Setup as a tab (fields fold into owned widgets)
- Unblocks: Danny's views, the consolidation map (spec §9), Ledger→Deliverables rename

### #6 — Send the Danny recap email + his data entry
Touches: nothing in-repo (draft at the session scratchpad, v2 in TextEdit).
- His hour of data entry (17 skill briefs, facts, retainers, cadence, owners, recipients, approval modes) turns the activation board green
- His 3 decisions + 5 vetoes un-gate #5

### #7 — Finish the GLB crew (Muse, Scrappy, Slate)
Touches: `public/crew/`, `src/ship/crewGLB.js` CREW_GLB map. **Gated on Higgsfield billing** (grace-period throttle).
- Muse: mesh from the 4 staged crops → 2 rigging passes (walk id 30 / idle id 0, height 1.8)
- Scrappy + Slate: 1 A-pose turnaround each (reuse Sean's prompt), then the same chain
- After all four: consider draco/meshopt compression (8×9MB GLBs)

### #8 — Decompose App.jsx + add a test suite
Touches: `src/App.jsx` (1,622 lines), new context/store modules.
- Extract auth/session into a module; extract route-mount table; extract realtime listeners
- Add smoke tests for the boot path and the approval loop (the two places regressions have actually happened)
- No behavior change — structure only; do it in small reviewed slices

### #9 — Optional cost lever: ai() default opus-5 → sonnet
Touches: `netlify/functions/agent-action/_shared.js:161` (one line).
- Only if AI spend runs hot after #1; ~40% cheaper, modest quality trade

### #10 — Retire or revive the parked code
Touches: `src/ui/ship/ShipWorld3D.jsx` + 5 modules, `ripped out features/`, `(experimental)/`.
- Decide the ShipWorld3D art pass (one session) or delete the stack; delete `analytics-page/` once its port target is decided
- Pure hygiene — zero user-facing change

### #11 — Wire a platform_post_id writer
Touches: scheduling path (Phase C Sprout wiring), `netlify/functions/verify-publishes.js:77`.
- When the Sprout schedule integration lands, stamp `platform_post_id` on scheduled items
- verify-publishes' auto-verify join then goes live with zero further code
