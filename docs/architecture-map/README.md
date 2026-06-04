# Vantus Architecture Map

> Regenerated 2026-06-04 via `/architecture-map`. Portable companion to `../../architecture-map.html`.

**Vantus** (repo/internal "warroom") is a content-operations dashboard, mid-pivot into a self-serve social-analytics + AI-ideation product. React 19 + Vite 8 (Node 22) · Supabase · Netlify Functions · Anthropic Claude. Live at **usevantus.com**, auto-deploys on push to `main`.

**Since the last map (2026-06-03):** the whole **Idea Engine** feature shipped, and a two-part **security/OAuth hardening batch** landed — so most of the old bug registry is now fixed.

**View the interactive map:** open `../../architecture-map.html`, or `python3 -m http.server 4747` → `http://localhost:4747/architecture-map.html`.

---

## Notable findings from this map

- **The security batch shipped — the map is much greener.** Fixed: rate limits on all functions, CID write repair + missing migrations, notify HTML-escaping, chat model/max_tokens validation, **OAuth token encryption (AES-256-GCM at rest)**, real deauth/data-deletion with Meta `signed_request` verification + a `data_deletion_requests` audit table, dropped the wide-open `profiles` policy, and CORS now 403s non-allowlisted origins. Remaining items are mostly feature-quality, centered on the new Idea Engine.
- **The Idea Engine is the new hot path — and it leans on Opus 4.8.** `muse_idea_list`, `muse_film_brief`, and `muse_ig_ideas` all call **Opus 4.8**. With `getSyncedDigest` + serial Tavily research stacked on the same request, slow runs risk the **26s Netlify function timeout** — the biggest live risk now (Fix #2).
- **The Idea Engine writes to the DB from the browser.** `IdeaEngineRoute` inserts `content_items` directly via the sb client with a **client-generated `Date.now()` id** and only attaches `client_id` when present — collision/orphan risk. The film-brief call also has **no timeout guard**, so a slow Opus brief hangs the modal (Fixes #3, #4).
- **The headline feature still has its scoping bug.** `scrappy_analyze_performance` ("Why these won") surfaces reasons across multiple posts and ranks by raw views — should target the true top performer(s) with one metric. Operator-flagged (Fix #1).
- **Model split is now 3-tier:** Haiku 4.5 (most handlers) · **Opus 4.8** (the three Muse-creative actions) · Sonnet 4.6 (frontend chat). Three handlers still inline their own Anthropic fetch instead of the shared `ai()`.
- **Multi-tenant reads everything.** `App.jsx` subscribes to ALL `content_items` (filtered only at render) and `getSyncedDigest` reads every row via service role — fine single-tenant, a leak risk once a second client is onboarded (Fixes #6, #9).
- **Dead code still present:** `muse_from_brief` (no caller) + `QuickActionsDashboard` (imported, never rendered) (Fix #7).

---

## Cluster overview

| Cluster | What lives here | Key nodes |
|---|---|---|
| **Client** | React entry + root | `main.jsx`, `App.jsx` |
| **Routes** | Nav-switched screens | Dashboard, Content, Agents, **Analytics**, **Idea Engine (new)**, Settings |
| **UI / Apps** | Components + feature apps | ConnectedAccountsCard, AgentChatPage, CIDPage, … |
| **Core / Services** | Shared client logic | `apiFetch`, `supabaseClient`, `routeTask`, `memory` |
| **Server** | Netlify Functions | **agent-action** (15 actions), chat, notify, oauth-*, sync-*, `_lib` (requireUser, rateLimit, **oauth**, **crypto-new**) |
| **Data** | Supabase tables | clients, profiles, client_users, content_items, agent_events, notifications, connected_accounts, connected_account_tokens (encrypted), account_posts, oauth_states, **data_deletion_requests (new)**, cid_library, cid_performance |
| **External** | Third-party APIs | Anthropic (3-tier), Tavily, Apify, Unsplash, Resend, Slack, n8n, Meta/IG, TikTok, Google/YouTube, Drive |

---

## Navigation
- [critical-path.md](critical-path.md) — the Idea Engine + agent-action spines
- [nodes.md](nodes.md) — every node catalogued
- [known-bugs.md](known-bugs.md) — severity-ranked, file:line cited (0 HIGH / 7 MED / 7 LOW)
- [roadmap.md](roadmap.md) — 11 numbered fixes
- [open-items.md](open-items.md) — the working checkbox punch-list
