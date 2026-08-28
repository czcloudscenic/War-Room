// leadCapture.js — THE capture choke point (port of dynasty-leads
// workers/lib/supabase.mjs upsertLeadsReturning + shared/normalize.mjs).
// Every sourcing path (Places sweep, signal scan, manual scan, imports) flows
// through captureLeads(). Order is law:
//   1. SUPPRESSION — never prospect an existing client (their domain, phone,
//      normalized name) or an opted-out lead. A suppression-lookup FAILURE
//      ABORTS the batch: unscreened rows never land.
//   2. DEDUP — host, then place_id, then normalized name+city against LIVE
//      leads. Merge into the survivor (fill empty fields), never drop data.
//   3. UPSERT — inserts the truly new rows.
// Normalization mirrors Dynasty's norm_* contract so a future SQL twin matches.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const REST = `${SUPABASE_URL}/rest/v1`;
const SH = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" });

async function sb(path, init = {}) {
  const res = await fetch(`${REST}/${path}`, { ...init, headers: { ...SH(), ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`supabase ${init.method || "GET"} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

// ── normalization (behavior-identical contract to Dynasty shared/normalize.mjs) ──
function normPhone(t) { const d = String(t || "").replace(/\D/g, "").slice(-10); return d || null; }
function normDomain(t) {
  const d = String(t || "").replace(/^\s*https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "").toLowerCase();
  return d || null;
}
const LEGAL = /\b(incorporated|corporation|company|inc|llc|llp|ltd|corp|co|lp)\b/g;
function normCompany(t) {
  const n = String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(LEGAL, " ").replace(/\s+/g, " ").trim();
  return n || null;
}
const normCity = (t) => String(t || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim() || null;

// ── suppression: existing clients + opted-out leads. THROWS on lookup failure. ──
async function suppressionMaps() {
  const clients = await sb("clients?select=id,name,website,primary_email,phone&status=neq.archived");
  const optouts = await sb("leads?optout=eq.true&select=host,phone,name");
  const m = { domains: new Map(), phones: new Map(), names: new Map() };
  for (const c of clients || []) {
    const d = normDomain(c.website) || (c.primary_email ? String(c.primary_email).split("@")[1]?.toLowerCase() : null);
    if (d && !/gmail|yahoo|hotmail|outlook|icloud/.test(d)) m.domains.set(d, { why: "existing client", who: c.name });
    const p = normPhone(c.phone); if (p) m.phones.set(p, { why: "existing client", who: c.name });
    const n = normCompany(c.name); if (n) m.names.set(n, { why: "existing client", who: c.name });
  }
  for (const l of optouts || []) {
    if (l.host) m.domains.set(l.host, { why: "opted out", who: l.name });
    const p = normPhone(l.phone); if (p) m.phones.set(p, { why: "opted out", who: l.name });
    const n = normCompany(l.name); if (n) m.names.set(n, { why: "opted out", who: l.name });
  }
  return m;
}
function suppressionMatch(m, row) {
  const d = normDomain(row.website); if (d && m.domains.has(d)) return { on: "domain", ...m.domains.get(d) };
  const p = normPhone(row.phone); if (p && m.phones.has(p)) return { on: "phone", ...m.phones.get(p) };
  const n = normCompany(row.name); if (n && m.names.has(n)) return { on: "name", ...m.names.get(n) };
  return null;
}

// rows: [{ name, website, phone, city, place_id, rating, review_count, client_id, icp_id, source, ... }]
// returns { inserted: [...], merged: [...], suppressed: [...], aborted: false }
async function captureLeads(rows, { actor = null } = {}) {
  let maps;
  try { maps = await suppressionMaps(); }
  catch (e) { return { inserted: [], merged: [], suppressed: [], aborted: true, error: `suppression lookup failed: ${e.message}` }; }

  const clean = [], suppressed = [];
  for (const row of rows) {
    const hit = suppressionMatch(maps, row);
    if (hit) suppressed.push({ name: row.name, ...hit }); else clean.push(row);
  }
  if (!clean.length) return { inserted: [], merged: [], suppressed, aborted: false };

  // dedup against live leads: host, place_id, name+city
  const hosts = [...new Set(clean.map(r => normDomain(r.website)).filter(Boolean))];
  const places = [...new Set(clean.map(r => r.place_id).filter(Boolean))];
  const names = [...new Set(clean.map(r => normCompany(r.name)).filter(Boolean))];
  const ors = [];
  if (hosts.length) ors.push(`host.in.(${hosts.map(encodeURIComponent).join(",")})`);
  if (places.length) ors.push(`place_id.in.(${places.map(encodeURIComponent).join(",")})`);
  let existing = [];
  if (ors.length) existing = (await sb(`leads?or=(${ors.join(",")})&select=id,host,place_id,name,city,phone,email,website,contact_name,contact_email,direct_phone&limit=2000`)) || [];
  // name+city needs a client-side pass (PostgREST has no normalized column here)
  if (names.length) {
    const byName = (await sb(`leads?select=id,host,place_id,name,city,phone,email,website,contact_name,contact_email,direct_phone&limit=5000`)) || [];
    const wanted = new Set(clean.map(r => `${normCompany(r.name)}|${normCity(r.city)}`));
    for (const l of byName) if (wanted.has(`${normCompany(l.name)}|${normCity(l.city)}`) && !existing.some(e => e.id === l.id)) existing.push(l);
  }
  const byHost = new Map(existing.filter(e => e.host).map(e => [e.host, e]));
  const byPlace = new Map(existing.filter(e => e.place_id).map(e => [e.place_id, e]));
  const byNameCity = new Map(existing.map(e => [`${normCompany(e.name)}|${normCity(e.city)}`, e]));

  const fresh = [], merged = [];
  for (const row of clean) {
    const d = normDomain(row.website);
    const surv = (d && byHost.get(d)) || (row.place_id && byPlace.get(row.place_id)) || byNameCity.get(`${normCompany(row.name)}|${normCity(row.city)}`);
    if (!surv) { fresh.push(row); continue; }
    // MERGE, never drop: fill the survivor's empty fields from the candidate
    const patch = {};
    for (const k of ["website", "phone", "email", "city", "place_id", "rating", "review_count", "industry", "icp_id", "client_id"]) {
      if ((surv[k] == null || surv[k] === "") && row[k] != null && row[k] !== "") patch[k] = row[k];
    }
    if (row.website && !surv.host) patch.host = d;
    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      await sb(`leads?id=eq.${surv.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    }
    merged.push({ id: surv.id, name: surv.name, filled: Object.keys(patch) });
  }

  const inserted = [];
  for (let i = 0; i < fresh.length; i += 25) {
    const chunk = fresh.slice(i, i + 25).map(r => ({
      name: String(r.name || "").slice(0, 160), website: r.website || null, host: normDomain(r.website), phone: r.phone || null,
      email: r.email || null, city: r.city || null, industry: r.industry || null, place_id: r.place_id || null,
      rating: r.rating ?? null, review_count: r.review_count ?? null, client_id: r.client_id || null, icp_id: r.icp_id || null,
      source: r.source || "scan", stage: "new", socials: r.socials || {}, created_by: actor,
    }));
    const back = await sb("leads", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(chunk) });
    inserted.push(...(back || []));
  }
  return { inserted, merged, suppressed, aborted: false };
}

module.exports = { captureLeads, normPhone, normDomain, normCompany, normCity, suppressionMatch };
