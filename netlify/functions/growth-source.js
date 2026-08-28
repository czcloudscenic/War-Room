// growth-source.js — sourcing + enrichment + signal + warmth for Growth (port of
// Dynasty Lead Finder / Website Generator mechanics; spec: docs/GROWTH-PORT-SPEC.md).
// Admin-only. EVERYTHING is feature-detected: a missing key makes that step
// report "not configured" and do nothing. Nothing here sends anything.
//
// actions:
//   status                       -> which capabilities are configured
//   run_sweep {icp_id, city}     -> Places text search (GOOGLE_PLACES_API_KEY) through the
//                                   capture choke point; daily cap from growth_budget
//   signal_scan {lead_id}        -> per-ICP signal_sources dispatch; careers_page wired
//   enrich {lead_id}             -> site contacts -> Apify (APIFY_API_TOKEN) -> Apollo (APOLLO_API_KEY, budgeted)
//   rescore {lead_id?}           -> recompute warmth (one lead or all live leads)

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");
const { captureLeads, normDomain } = require("./_lib/leadCapture");
const { scoreWarmth } = require("../../src/core/warmth.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const APOLLO_KEY = process.env.APOLLO_API_KEY || "";
const APIFY_TOKEN = process.env.APIFY_API_TOKEN || "";
const APIFY_CONTACT_ACTOR = process.env.APIFY_CONTACT_ACTOR || "vdrmota~contact-info-scraper";
const REST = `${SUPABASE_URL}/rest/v1`;
const SH = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" });
const UA = "Mozilla/5.0 (compatible; VantusGrowth/1.0)";

async function sb(path, init = {}) {
  const res = await fetch(`${REST}/${path}`, { ...init, headers: { ...SH(), ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`supabase ${init.method || "GET"} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
const nowIso = () => new Date().toISOString();

// Names that are never prospects (national chains / lead-gen fronts) — extend per ICP via exclude_names.
const CHAIN_RE = /\b(amazon|walmart|target|costco|home depot|lowe'?s|starbucks|mcdonald|subway|chipotle|cvs|walgreens|kroger|safeway|7-eleven|shell|chevron|marriott|hilton|hyatt|holiday inn|best western|angi|homeadvisor|thumbtack|yelp|networx)\b/i;

// ── warmth: compute + persist for a set of lead ids ──
async function rescoreLeads(ids) {
  if (!ids.length) return 0;
  const list = ids.map(encodeURIComponent).join(",");
  const leads = (await sb(`leads?id=in.(${list})&select=*`)) || [];
  const events = (await sb(`lead_events?lead_id=in.(${list})&select=lead_id,kind,at,meta`)) || [];
  let n = 0;
  for (const lead of leads) {
    const r = scoreWarmth(lead, { events: events.filter(e => e.lead_id === lead.id) });
    const patch = { warmth_score: r.score, warmth_band: r.band, warmth_reasons: r.reasons, warmth_at: nowIso(), last_engaged_at: r.last_engaged_at, last_engagement: r.last_engagement };
    if (r.band === "warm" && !lead.warm_since) patch.warm_since = nowIso();
    if (r.band !== "warm" && lead.warm_since) patch.warm_since = null;
    await sb(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    n++;
  }
  return n;
}

// ── Places sweep (Website Generator places.js pattern: lean field mask, hard daily cap in DB) ──
async function placesSearch(query, pageToken) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": PLACES_KEY, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,nextPageToken" },
    body: JSON.stringify({ textQuery: query, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Places ${res.status}: ${d.error?.message || "search failed"}`);
  return d;
}
async function runSweep({ icp_id, city, pages = 2, actor }) {
  const icp = (await sb(`client_icps?id=eq.${icp_id}&select=*`))?.[0];
  if (!icp) throw new Error("ICP not found");
  const run = (await sb("sourcing_runs", { method: "POST", body: JSON.stringify({ client_id: icp.client_id, icp_id, city, status: "running", started_at: nowIso(), created_by: actor }) }))?.[0];
  try {
    // daily cap: requests spent today across all runs vs growth_budget.places.daily_cap
    const cap = Number(((await sb("growth_budget?key=eq.places&select=value"))?.[0]?.value?.daily_cap) ?? 300);
    const today = new Date().toISOString().slice(0, 10);
    const spent = ((await sb(`sourcing_runs?created_at=gte.${today}T00:00:00Z&select=requests`)) || []).reduce((s, r) => s + (r.requests || 0), 0);
    if (spent >= cap) throw new Error(`daily Places cap reached (${spent}/${cap}) — raise growth_budget.places.daily_cap or wait for tomorrow`);
    const excl = new RegExp([...(icp.exclude_names || [])].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "$^", "i");
    const minReviews = Number(icp.fit_rules?.min_reviews || 0);
    let token = null, requests = 0, found = 0; const rows = [];
    for (let p = 0; p < pages; p++) {
      if (spent + requests >= cap) break;
      const d = await placesSearch(`${icp.niche} in ${city}`, token); requests++;
      for (const pl of d.places || []) {
        found++;
        const name = pl.displayName?.text || "";
        if (!name || CHAIN_RE.test(name) || excl.test(name)) continue;
        if (icp.fit_rules?.require_website && !pl.websiteUri) continue;
        if (minReviews && (pl.userRatingCount || 0) < minReviews) continue;
        rows.push({ name, website: pl.websiteUri || null, phone: pl.nationalPhoneNumber || null, city, place_id: pl.id, rating: pl.rating ?? null, review_count: pl.userRatingCount ?? null, industry: icp.niche, client_id: icp.client_id, icp_id: icp.id, source: "scan" });
      }
      token = d.nextPageToken; if (!token) break;
    }
    const cap2 = await captureLeads(rows, { actor });
    if (cap2.aborted) throw new Error(cap2.error);
    await sb(`sourcing_runs?id=eq.${run.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "done", requests, found, inserted: cap2.inserted.length, finished_at: nowIso() }) });
    await rescoreLeads(cap2.inserted.map(l => l.id));
    return { run_id: run.id, requests, found, inserted: cap2.inserted.length, merged: cap2.merged.length, suppressed: cap2.suppressed.length, suppressedWho: cap2.suppressed.slice(0, 5) };
  } catch (e) {
    await sb(`sourcing_runs?id=eq.${run.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", error: e.message, finished_at: nowIso() }) }).catch(() => {});
    throw e;
  }
}

// ── signal scan: careers_page (deterministic, never inferred) ──
const CAREER_HREF = /career|careers|jobs|job-openings|openings|join|hiring|employment|apply|work-with|now-hiring/i;
const CAREER_PATHS = ["/careers", "/jobs", "/employment", "/join-our-team", "/apply"];
const ATS_HOST = /indeed\.com|ziprecruiter\.com|workable\.com|breezy\.hr|bamboohr\.com|greenhouse\.io|lever\.co|jazzhr\.com|applicantpro\.com|paylocity\.com|recruitee\.com|jobvite\.com|linkedin\.com\/jobs/i;
const OPENING_RE = /(now hiring|we're hiring|we are hiring|open positions?|current openings?|job openings?|apply (now|today)|join our team)/i;
const ROLE_RE = /(?:hiring|position|role|opening)s?\s*[:\-–]?\s*([A-Z][A-Za-z\/&\s]{3,40}?)(?=[\.\n<]|\s{2,})/;
async function fetchHtml(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
  try { const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: ctl.signal }); if (!r.ok) return null; const ct = r.headers.get("content-type") || ""; if (!/html|plain/.test(ct)) return null; return { url: r.url, html: (await r.text()).slice(0, 400000) }; }
  catch { return null; } finally { clearTimeout(t); }
}
const toText = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
async function careersSignal(website) {
  const base = (website.startsWith("http") ? website : `https://${website}`).replace(/\/+$/, "");
  const home = await fetchHtml(base);
  const cands = [];
  if (home) {
    for (const m of home.html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,100}?)<\/a>/gi)) {
      try { const abs = new URL(m[1], home.url).href; const txt = m[2].replace(/<[^>]+>/g, " ").trim(); if (CAREER_HREF.test(abs) || CAREER_HREF.test(txt)) cands.push(abs); } catch {}
    }
  }
  for (const p of CAREER_PATHS) cands.push(base + p);
  const seen = new Set();
  for (const url of cands) {
    if (seen.has(url) || seen.size >= 5) continue; seen.add(url);
    if (ATS_HOST.test(url)) return { verified: true, url, kind: "job_board", role: null, evidence: "links to a live applicant-tracking/job board page" };
    const page = await fetchHtml(url); if (!page) continue;
    const text = toText(page.html);
    if (OPENING_RE.test(text)) {
      const role = (text.match(ROLE_RE) || [])[1]?.trim() || null;
      return { verified: true, url: page.url, kind: "careers_page", role, evidence: (text.match(OPENING_RE) || [])[0] };
    }
  }
  return { verified: false };
}
async function signalScan({ lead_id }) {
  const lead = (await sb(`leads?id=eq.${lead_id}&select=id,website,icp_id`))?.[0];
  if (!lead) throw new Error("lead not found");
  const icp = lead.icp_id ? (await sb(`client_icps?id=eq.${lead.icp_id}&select=signal_sources`))?.[0] : null;
  const sources = icp?.signal_sources?.length ? icp.signal_sources : [{ kind: "careers_page" }];
  const notWired = sources.filter(s => s.kind !== "careers_page").map(s => s.kind);
  if (!lead.website) return { verified: false, reason: "no website", notWired };
  if (!sources.some(s => s.kind === "careers_page")) return { verified: false, reason: "no wired signal source for this ICP", notWired };
  const sig = await careersSignal(lead.website);
  const patch = sig.verified
    ? { signal_kind: sig.kind, signal_role: sig.role, signal_url: sig.url, signal_verified_at: nowIso(), signal_posted_at: null }
    : { signal_kind: null, signal_role: null, signal_url: null, signal_verified_at: null, signal_posted_at: null }; // gone = badge dies
  patch.updated_at = nowIso();
  await sb(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  await rescoreLeads([lead.id]);
  return { ...sig, notWired };
}

// ── enrichment cascade: site contacts (free) -> Apify (token) -> Apollo (key + budget) ──
async function apifyContacts(website) {
  if (!APIFY_TOKEN) return { skipped: "APIFY_API_TOKEN not set" };
  const run = await fetch(`https://api.apify.com/v2/acts/${APIFY_CONTACT_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=60&memory=512`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startUrls: [{ url: website }], maxRequestsPerStartUrl: 5 }),
  });
  if (!run.ok) return { skipped: `Apify ${run.status}` };
  const items = await run.json().catch(() => []);
  const emails = [...new Set(items.flatMap(i => i.emails || []))].filter(e => !/noreply|no-reply|sentry|wixpress/i.test(e));
  const phones = [...new Set(items.flatMap(i => i.phones || []))];
  const linkedins = [...new Set(items.flatMap(i => i.linkedIns || []))];
  return { emails: emails.slice(0, 3), phones: phones.slice(0, 2), linkedins: linkedins.slice(0, 2) };
}
async function apolloMatch(lead) {
  if (!APOLLO_KEY) return { skipped: "APOLLO_API_KEY not set" };
  const budget = ((await sb("growth_budget?key=eq.apollo&select=value"))?.[0]?.value) || {};
  const month = new Date().toISOString().slice(0, 7);
  const used = budget.month === month ? (budget.email_used || 0) : 0;
  const cap = Number(budget.email_cap ?? 100);
  if (used >= cap) return { skipped: `Apollo monthly email-credit cap reached (${used}/${cap})` };
  const res = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": APOLLO_KEY },
    body: JSON.stringify({ organization_name: lead.name, domain: lead.host || undefined, reveal_personal_emails: false, reveal_phone_number: false }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return { skipped: `Apollo ${res.status}: ${d.error || d.message || "match failed"}` };
  await sb("growth_budget?key=eq.apollo", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ value: { ...budget, month, email_used: used + 1, email_cap: cap }, updated_at: nowIso() }) }).catch(() => {});
  const p = d.person; if (!p) return { skipped: "no match" };
  return { name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null, title: p.title || null, email: p.email || null, linkedin: p.linkedin_url || null, apollo_id: p.id || null };
}
async function enrich({ lead_id, actor }) {
  const lead = (await sb(`leads?id=eq.${lead_id}&select=*`))?.[0];
  if (!lead) throw new Error("lead not found");
  const steps = [];
  const patch = {};
  // 1. what the latest site scan already found (free)
  const research = (await sb(`lead_research?lead_id=eq.${lead.id}&kind=eq.site_scan&select=raw&order=created_at.desc&limit=1`))?.[0];
  const raw = research?.raw || {};
  if (!lead.email && raw.emails?.[0]) patch.email = raw.emails[0];
  if (!lead.phone && raw.phones?.[0]) patch.phone = raw.phones[0];
  steps.push({ step: "site scan", result: raw.emails?.length ? `${raw.emails.length} email(s)` : "no contacts on site" });
  // 2. Apify deep crawl
  if (lead.website && !(patch.email || lead.email)) {
    const a = await apifyContacts(lead.website);
    if (a.skipped) steps.push({ step: "Apify", result: a.skipped });
    else { if (a.emails?.[0]) patch.email = a.emails[0]; if (!lead.phone && a.phones?.[0]) patch.phone = a.phones[0]; steps.push({ step: "Apify", result: `${a.emails?.length || 0} email(s), ${a.phones?.length || 0} phone(s)` }); }
  }
  // 3. Apollo named decision-maker (the bottleneck everywhere — budgeted)
  if (!lead.contact_name) {
    const ap = await apolloMatch({ ...lead, host: lead.host || normDomain(lead.website) });
    if (ap.skipped) steps.push({ step: "Apollo", result: ap.skipped });
    else { patch.contact_name = ap.name; patch.contact_title = ap.title; if (ap.email) patch.contact_email = ap.email; if (ap.apollo_id) patch.apollo_id = ap.apollo_id; steps.push({ step: "Apollo", result: ap.name ? `${ap.name}${ap.title ? ", " + ap.title : ""}${ap.email ? " + email" : ""}` : "no person" }); }
  } else steps.push({ step: "Apollo", result: "contact already named" });
  if (Object.keys(patch).length) {
    patch.updated_at = nowIso();
    await sb(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  }
  await rescoreLeads([lead.id]);
  return { steps, patched: Object.keys(patch) };
}

exports.handler = async (event) => {
  const cors = makeCors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);
  if (auth.user.role !== "admin") return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "admin only" }) };
  const rl = rateLimit(`growth-source:${auth.user.id}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);
  if (!SERVICE_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };
  let body; try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const actor = auth.user.email || null;
  const ok = (p) => ({ statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, ...p }) });
  try {
    if (body.action === "status") return ok({
      places: !!PLACES_KEY, apollo: !!APOLLO_KEY, apify: !!APIFY_TOKEN, anthropic: !!process.env.ANTHROPIC_API_KEY,
      tracking: !!(process.env.GROWTH_RESEND_API_KEY || process.env.RESEND_API_KEY),
      hints: { places: "GOOGLE_PLACES_API_KEY", apollo: "APOLLO_API_KEY", apify: "APIFY_API_TOKEN" },
    });
    if (body.action === "run_sweep") {
      if (!PLACES_KEY) return { statusCode: 424, headers: cors, body: JSON.stringify({ error: "Places not configured — set GOOGLE_PLACES_API_KEY in Netlify env (production)" }) };
      if (!body.icp_id || !body.city) throw new Error("icp_id and city required");
      return ok(await runSweep({ icp_id: body.icp_id, city: String(body.city).slice(0, 80), pages: Math.min(3, Number(body.pages) || 2), actor }));
    }
    if (body.action === "signal_scan") return ok(await signalScan({ lead_id: body.lead_id }));
    if (body.action === "enrich") return ok(await enrich({ lead_id: body.lead_id, actor }));
    if (body.action === "rescore") {
      const ids = body.lead_id ? [body.lead_id] : ((await sb("leads?stage=not.in.(won,lost)&select=id&limit=2000")) || []).map(l => l.id);
      return ok({ rescored: await rescoreLeads(ids) });
    }
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `unknown action: ${body.action}` }) };
  } catch (e) {
    const missing = /client_icps|sourcing_runs|lead_events|growth_budget|warmth_band/.test(e.message) && /404|400|PGRST|does not exist/i.test(e.message);
    return { statusCode: missing ? 424 : 500, headers: cors, body: JSON.stringify({ error: missing ? "sourcing tables missing — run supabase/migrations/20260827_growth_sourcing.sql first" : e.message }) };
  }
};
