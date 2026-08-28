// growth-events.js — the engagement loop (port of Website Generator track.js +
// Dynasty outreach-track): poll Resend for every sent brief that isn't at a
// terminal event, advance it MONOTONICALLY, write lead_events, recompute
// warmth for touched leads. Inbound-only: reads Resend, sends nothing.
// Scheduled every 30 min; manual runs need ?test=1&key=CRON_TEST_KEY.
// Open/click tracking must be ON for the sending domain in Resend.

const { scoreWarmth } = require("../../src/core/warmth.js");
const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.GROWTH_RESEND_API_KEY || process.env.RESEND_API_KEY || "";
const TEST_KEY = process.env.CRON_TEST_KEY || "";
const REST = `${SUPABASE_URL}/rest/v1`;
const SH = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" });
const RANK = { sent: 0, delivered: 1, opened: 2, clicked: 3, replied: 4, bounced: 4, complained: 4 };
const ACTIVE = ["sent", "delivered", "opened"];

async function sb(path, init = {}) {
  const res = await fetch(`${REST}/${path}`, { ...init, headers: { ...SH(), ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`supabase ${init.method || "GET"} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 160)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function rescore(ids) {
  if (!ids.length) return;
  const list = ids.map(encodeURIComponent).join(",");
  const leads = (await sb(`leads?id=in.(${list})&select=*`)) || [];
  const events = (await sb(`lead_events?lead_id=in.(${list})&select=lead_id,kind,at,meta`)) || [];
  for (const lead of leads) {
    const r = scoreWarmth(lead, { events: events.filter(e => e.lead_id === lead.id) });
    const patch = { warmth_score: r.score, warmth_band: r.band, warmth_reasons: r.reasons, warmth_at: new Date().toISOString(), last_engaged_at: r.last_engaged_at, last_engagement: r.last_engagement };
    if (r.band === "warm" && !lead.warm_since) patch.warm_since = new Date().toISOString();
    await sb(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  }
}

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const scheduled = !!(event.headers && (event.headers["x-netlify-event"] === "schedule" || event.headers["X-Netlify-Event"] === "schedule")) || event.body?.includes?.("next_run");
  if (!scheduled && qs.test !== "1") return { statusCode: 403, body: "scheduled invocations only (use ?test=1&key=...)" };
  if (qs.test === "1" && TEST_KEY && qs.key !== TEST_KEY) return { statusCode: 403, body: "bad test key" };
  if (!SERVICE_KEY) return { statusCode: 500, body: "SUPABASE_SERVICE_KEY not set" };
  if (!RESEND_KEY) return { statusCode: 200, body: JSON.stringify({ ok: false, error: "no Resend key — tracking off" }) };

  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  let briefs;
  try {
    briefs = (await sb(`lead_briefs?status=eq.sent&resend_id=not.is.null&sent_at=gte.${cutoff}&select=id,lead_id,resend_id,sent_at,last_event,delivered_at,opened_at,clicked_at&limit=500`)) || [];
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: /last_event/.test(e.message) ? "run 20260827_growth_sourcing.sql first" : e.message }) };
  }
  const active = briefs.filter(b => ACTIVE.includes(b.last_event || "sent"));
  let updated = 0; const touched = new Set(); const now = new Date().toISOString();
  for (const b of active) {
    let r; try { const res = await fetch(`https://api.resend.com/emails/${b.resend_id}`, { headers: { Authorization: `Bearer ${RESEND_KEY}` } }); if (!res.ok) continue; r = await res.json(); } catch { continue; }
    const last = r?.last_event; const cur = b.last_event || "sent";
    if (!last || (RANK[last] ?? -1) <= (RANK[cur] ?? -1)) continue;
    const patch = { last_event: last };
    if (last === "delivered" && !b.delivered_at) patch.delivered_at = now;
    if (last === "opened" && !b.opened_at) patch.opened_at = now;
    if (last === "clicked") { patch.clicked_at = now; if (!b.opened_at) patch.opened_at = now; }
    await sb(`lead_briefs?id=eq.${b.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    const kinds = last === "clicked" && !b.opened_at ? ["opened", "clicked"] : [last];
    for (const kind of kinds) {
      if (!["delivered", "opened", "clicked", "bounced", "complained"].includes(kind)) continue;
      await sb("lead_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lead_id: b.lead_id, brief_id: b.id, kind, at: now, meta: { sent_at: b.sent_at, resend_id: b.resend_id } }) });
    }
    if (last === "bounced" || last === "complained") await sb(`leads?id=eq.${b.lead_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ optout: last === "complained", updated_at: now }) }).catch(() => {});
    touched.add(b.lead_id); updated++;
  }
  await rescore([...touched]);
  return { statusCode: 200, body: JSON.stringify({ ok: true, polled: active.length, updated, leadsRescored: touched.size }) };
};
