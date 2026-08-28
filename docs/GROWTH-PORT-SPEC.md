# Growth Port Spec — lead sourcing, enrichment, warmth (2026-08-27)

Port of the two proven lead machines into Vantus's Growth destination, requested by
Christian via Counsel. Extends GROWTH v1 (scan → audit → brief → convert, live 8/23).
Read in place: `Client Agents/Dynasty/dynasty-leads/` (warmth, hiring signals, Apollo
reveals, 3-touch engine, Warm now) and `Agents/Website Generator Agent/` (Places scrape
per ICP+city, harvest/track loop, find-the-leak audit).

## What Vantus gets

| Mechanic | Source | Vantus shape |
|---|---|---|
| **ICP per client** | WG niche×city | `client_icps` — a client (or the agency itself) owns ICPs: niche phrase, cities, fit rules. Every lead carries `client_id` + `icp_id`. |
| **Signal-based sourcing** | Dynasty hiring.mjs + jobs.mjs | **Signal source is config per ICP** (`client_icps.signal_sources` jsonb): `careers_page` (wired now — deterministic page evidence, ATS hosts count), `job_board` (Apify Indeed per city, needs APIFY + Places name-match), `ad_library` (Meta Ad Library: is the business already buying ads), `community_launch` (Skool/Whop launches). Each stamps `signal_kind/role/url/posted_at/verified_at`. Fresh ≤14d, ok ≤30d. **Never inferred** — no URL + verified_at, no badge. |
| **Directory sourcing** | WG places.js | `growth-source` fn: Places API (New) searchText per ICP+city, lean field mask, **daily cap in `sourcing_runs`** (DB, survives serverless), chain-name drop list. Key: `GOOGLE_PLACES_API_KEY` — absent = dormant. |
| **Enrichment cascade** | Dynasty enrich.mjs | site scan (free, already in siteAudit) → Apify contact actor (`APIFY_API_TOKEN`, exists) → Apollo people match (`APOLLO_API_KEY`, absent = skip) → named DM + direct channel into `contact_name/contact_title/contact_email/direct_phone`. Reveals are credit-capped per month in `growth_budget`. |
| **Warm score** | Dynasty shared/warmth.mjs | `src/core/warmth.js` — same three gates (PERSON · TRIGGER · ENGAGED), 0-100 with readable reasons, decay after 21d, floor-role/low-fit rule generalized to `fit`. Tested. |
| **Behavior promotion** | WG track.js + Dynasty outreach_emails | `lead_events` (sent/delivered/opened/clicked/replied/bounced) written by `growth-events` (Resend poll, monotonic). Human-open rule: <10 min after send = scanner. Events recompute warmth. |
| **Warm Now view** | Dynasty Outreach.jsx | Growth → Leads gets **Warm now / Warming / Cold** bands with reasons on the row; sort by score. |
| **Digest** | Dynasty digest | Reuses Vantus's existing notify/Slack: weekly "N warm now" line in the founder digest (Phase 2). |

## The capture choke point (ported from `workers/lib/supabase.mjs upsertLeadsReturning`)
Every sourcing path — Places sweep, signal scan, manual scan, future imports — flows through ONE function
(`netlify/functions/_lib/leadCapture.js`): **suppression** (client's own domain → phone → normalized name;
a suppression-lookup failure ABORTS the batch, never lets rows through) → **dedup** (host, then place_id,
then normalized name+city; merge fields into the survivor, never drop) → upsert. Normalization mirrors
`shared/normalize.mjs` (lowercase, strip Inc/LLC/Corp + punctuation, collapse spaces).

## Enrichment realism (the hard truth from Dynasty: contact data is the bottleneck, not scoring)
Dynasty's numbers: 17 direct dials in 2,338 leads; 0 closes from the scraped pool, all 8 closes rep-sourced.
So the port carries the **Apollo budget model** (`growth_budget`: email_cap 100 / phone_cap 20 per month,
editable) and the UI states plainly how many leads have a reachable human. A scraper without an
enrichment budget produces rows, not leads.

## What stays out (deliberately)
- SQLite scraper store — Supabase is the only store here.
- Passcode gate / per-rep dashboards — Vantus has real auth + team_members.
- Auto-send of any kind. Sourcing runs are created **paused**; briefs send only on a human click (existing Leads Send). Sequences (3-touch) are Phase 2, and stay draft-first.
- Apify CSLB/BuildZoom owner research agents — manual/AI, not ported.
- AI hiring verification (Dynasty uses Haiku on careers pages) — furloughed on credits; v1 signal is deterministic page evidence only.

## Multi-tenant rules
- `client_id` on every row (ICP owner). Agency-level ICPs use the CloudScenic client.
- All keys env-driven, feature-detected: no key → that step is dormant and says so in the UI.
- Nothing outbound automatically. Ever.

## Phasing
1. **This drop:** migration, `core/warmth.js` + tests, `growth-source` (Places, paused runs), `growth-enrich` (cascade, Apollo gated), `growth-events` (Resend tracking → warmth), Warm Now + ICP panel in Leads.
2. Next: 3-touch sequence (draft-first), founder digest line, Slack pings on human opens.

## What Christian pastes (one 10-minute pass; everything wakes up as each lands)
Netlify → app.netlify.com/projects/majestic-cassata-aa16e9/configuration/env → **production** context:

| # | Env var | Wakes up | Where it comes from |
|---|---|---|---|
| 1 | `GOOGLE_PLACES_API_KEY` | ICP sweeps ("Run sweep" on the Leads page) | Google Cloud → Places API (New) restricted key. A working one exists in the Website Generator Agent's own env (`PLACES_API_KEY`) — reuse is your call. |
| 2 | `APOLLO_API_KEY` | Named decision-maker + email ("Find contact") — the real bottleneck per Dynasty's numbers | apollo.io → Settings → API. Dynasty Lead Finder's env has a working one. |
| 3 | `APIFY_API_TOKEN` | already set in Vantus — deep contact crawl in "Find contact" works today | (nothing to do) |
| 4 | `GROWTH_RESEND_API_KEY` | already set — brief sends + open/click tracking | (nothing to do) |
| 5 | `CRON_TEST_KEY` | manual runs of growth-events (`?test=1&key=`) | already set for the other crons |
| 6 | Anthropic credits (not an env var) | "Scrappy writes it" briefs + any future AI enrichment | console.anthropic.com → Plans & Billing |
| 7 | 3 GoDaddy DNS records for `go.cloudscenic.com` | sending briefs from the cold-outreach subdomain | staged in `/tmp/go-cloudscenic-dns-records.txt` (TextEdit); Resend domain already added |

Plus the migration paste: `supabase/migrations/20260827_growth_sourcing.sql` in the Supabase SQL editor (idempotent). Optional caps live in `growth_budget` (`places.daily_cap` 300, `apollo.email_cap` 100 / `phone_cap` 20 per month) — edit in the table, no deploy needed.
