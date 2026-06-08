# Vantus — Build List

> Christian's running list. Updated 2026-06-04.
> Status key: ✅ done & deployed · ◐ partial · ☐ not started · ⮕ redirected/superseded

---

## ✅ Done

- **#4 — Generation speed: 28–30s → 10–15s.**
  Shipped & live 2026-06-04 (commit `70dcd29`). The worst offenders — `muse_ig_ideas` and `scrappy_muse_collab` (both 22–30s) — now ~10–15s via parallelized fetches, Tavily basic, Opus→Sonnet on ig_ideas, single-pass collab, and trimmed token caps. Also added real `[agent-action] …completed in {ms}ms` logging. Spot-check Idea Engine quality pending.

- **#1 — Refresh shouldn't sign you out / lose your page.**
  `activeNav` persisted to localStorage (refresh holds the page you're on), auth made non-destructive (refreshSession before sign-out, stuckGuard no longer wipes tokens, no login-page flash). Deployed.

- **#7 — Move Analytics + Ad ROI Hub under "Content" nav.**
  Nav reorg: Command (Dashboard · Agents · Competitor Intel · Ideal Customer) / Content (Analytics · Idea Engine · Ad ROI Hub · Pipeline). Deployed.

- **#8 — Kill the Team Broadcast page, keep the "broadcast to all agents" button.**
  Page removed from nav/apps; Chat/Broadcast toggle moved under Scrappy inside the Agents page. Deployed.

- **#6 (part) — Remove the login water video.**
  Done — login is now the aggressive orange-haze gradient, no video. (Multi-tenant data isolation half of #6 still open below.)

---

## 🗓️ Queued for Codex (next burst ~8:21am)

- **#9 — Admin page.** Was ~80% done before a burst-cancel (`admin-stats.js` + `netlify.toml` redirect on a throwaway branch, nothing merged). Re-hand the #9 chunk on a fresh burst. Brief in `/tmp/codex_brief_speed_admin.md`.

---

## ☐ Open

- **#2 — Per-client OAuth connections (IG / TikTok / YouTube).**
  Right now Cloud Scenic's own connected accounts are shared across every client page. Each client needs to connect their *own* accounts. Tied to the multi-tenant foundation (#6/#9).

- **#5 — Ad ROI Hub: connect Meta + static-ad generator.**
  Wire Meta (run/read campaigns) + a static-ad generator linked to Higgsfield. No Meta connection yet. Bigger epic.

- **#6 — User accounts with isolated data.**
  Agency seats + self-serve, both layered. Each user's data walled off. Needs the multi-tenant architecture designed before building. (Login water-video half already done above.)

- **#9 — Admin page.**
  See user count + collect/read feedback.

- **#10 — Virality Checker (the pre-publish gate).** ⭐ NEW
  A new page. You run a piece of content through it *before* it posts — the model actually watches the whole video (because you hold the file at that moment, so no link/scraper wall) and gives you a verdict: the final gate before anything goes out.
  - **Routing:** Gemini → YouTube / long-form (watches the body, explains weak spots in plain language). Higgsfield `virality_predictor` → IG/TikTok / short-form (hook · retention · attention scoring). Already have Higgsfield wired + 601 credits.
  - **The loop:** the gate *is* the DNA harvester — every check is a real, legit, fully-analyzed piece of your content. Store that DNA → feed the **Idea Engine** so it finally generates ideas grounded in what your content actually *is* (visual style, hooks, pacing), not just what your captions say.
  - **Revives "why it won":** pair each gate analysis with the metrics that roll in days later → genuine content-grounded performance insight ("won because of the pacing in the body — proof in the retention"), which the old Analytics page physically couldn't do.
  - **Supersedes #3:** the win/lose "why it worked" gets **ripped out of the Analytics page** and reborn here, correctly.

---

## ⮕ Redirected

- **#3 — Analytics "why content worked" (Opus 4.8).** ✅ committed & live (`6cb248b`, 2026-06-04) — reunited with #4 after the push briefly reverted it. Win/lose now in history. Still slated to *migrate* into #10's gate later (where the model can actually see the content), but it's safe and shipped for now.
