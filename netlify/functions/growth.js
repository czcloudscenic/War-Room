// growth.js — GROWTH destination v1 (v3 spec §3.C.4): scrape -> audit -> brief
// -> convert. Admin-only. Reads happen in the browser under admin RLS; this
// function owns the writes that need fetching, encryption-free secrets, or
// email. Zero-AI paths (scan, template brief) work with no Anthropic credits;
// the AI brief lives in agent-action (growth_brief).
//
// actions: scan {url, name?, city?, industry?}
//          brief_template {lead_id}
//          send_brief {brief_id, to}        needs GROWTH_FROM_EMAIL (cold-outreach sender)
//          convert {lead_id}                lead -> clients row, stage won

const { requireUser, unauthorized, cors: makeCors } = require("./_lib/requireUser");
const { rateLimit, tooManyRequests } = require("./_lib/rateLimit");
const { scanSite, templateBrief } = require("./_lib/siteAudit");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// Cold outreach must NOT ride the transactional root domain (reputation
// separation). Two supported setups:
//   a) the outreach subdomain lives in ANOTHER Resend account (the June
//      go.cloudscenic.com warm-up) -> paste that account's key as
//      GROWTH_RESEND_API_KEY; falls back to the main RESEND_API_KEY otherwise.
//   b) verify a fresh subdomain in THIS account and use the main key.
// GROWTH_FROM_EMAIL e.g. "Christian at Cloud Scenic <christian@go.cloudscenic.com>".
// Unset = copy mode in the UI.
const RESEND_KEY = process.env.GROWTH_RESEND_API_KEY || process.env.RESEND_API_KEY;
// 8/26 decision (Christian): briefs send from the verified root domain, sender
// chosen per send from this allowlist. GROWTH_FROM_EMAIL (optional) adds a
// custom default on top. Reply-to = the chosen sender.
const SENDERS = {
  contact: { from: "Cloud Scenic <contact@cloudscenic.com>", email: "contact@cloudscenic.com" },
  cz:      { from: "Christian at Cloud Scenic <cz@cloudscenic.com>", email: "cz@cloudscenic.com" },
  dv:      { from: "Danny at Cloud Scenic <dv@cloudscenic.com>", email: "dv@cloudscenic.com" },
};
const GROWTH_FROM = process.env.GROWTH_FROM_EMAIL || "";
const REST = `${SUPABASE_URL}/rest/v1`;
const SH = () => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" });

async function sb(path, init = {}) {
  const res = await fetch(`${REST}/${path}`, { ...init, headers: { ...SH(), ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`supabase ${init.method || "GET"} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
const mdToHtml = (md) => `<div style="font-family:-apple-system,Inter,sans-serif;font-size:14px;line-height:1.6;color:#1d1d1f;white-space:pre-wrap">${String(md).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`;

exports.handler = async (event) => {
  const cors = makeCors(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  const auth = await requireUser(event);
  if (!auth.ok) return unauthorized(auth.reason, event);
  if (auth.user.role !== "admin") return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "admin only" }) };
  const rl = rateLimit(`growth:${auth.user.id}`, 20, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, cors);
  if (!SERVICE_KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };

  const email = auth.user.email || null;
  let body; try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const ok = (payload) => ({ statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, ...payload }) });

  try {
    if (body.action === "scan") {
      const scan = await scanSite(body.url);
      if (!scan.ok) return { statusCode: 422, headers: cors, body: JSON.stringify({ error: scan.error }) };
      const s = scan.signals;
      const name = String(body.name || s.title.split(/[|\-–—:]/)[0] || scan.norm.host).trim().slice(0, 120);
      // upsert by host
      const existing = await sb(`leads?host=eq.${encodeURIComponent(scan.norm.host)}&select=id,stage`);
      const patch = {
        name, website: scan.norm.href, host: scan.norm.host,
        city: body.city || null, industry: body.industry || null,
        phone: s.phones[0] || null, email: s.emails[0] || null,
        socials: s.socials, updated_at: new Date().toISOString(),
      };
      let lead;
      if (existing?.length) {
        const cur = existing[0];
        if (cur.stage === "new") patch.stage = "researched";
        lead = (await sb(`leads?id=eq.${cur.id}`, { method: "PATCH", body: JSON.stringify(patch) }))?.[0];
      } else {
        lead = (await sb("leads", { method: "POST", body: JSON.stringify({ ...patch, source: "scan", stage: "researched", created_by: email }) }))?.[0];
      }
      const research = (await sb("lead_research", {
        method: "POST",
        body: JSON.stringify({ lead_id: lead.id, kind: "site_scan", raw: { ...s, textSample: undefined, pages: scan.pages }, findings: scan.findings, created_by: email }),
      }))?.[0];
      return ok({ lead, research });
    }

    if (body.action === "brief_template") {
      const lead = (await sb(`leads?id=eq.${body.lead_id}&select=*`))?.[0];
      if (!lead) throw new Error("lead not found");
      const research = (await sb(`lead_research?lead_id=eq.${lead.id}&select=findings&order=created_at.desc&limit=1`))?.[0];
      const findings = research?.findings || [];
      const draft = templateBrief({ leadName: lead.name, contactName: lead.contact_name, findings });
      const brief = (await sb("lead_briefs", { method: "POST", body: JSON.stringify({ lead_id: lead.id, ...draft, origin: "template", status: "draft", created_by: email }) }))?.[0];
      if (lead.stage === "researched") await sb(`leads?id=eq.${lead.id}`, { method: "PATCH", body: JSON.stringify({ stage: "briefed", updated_at: new Date().toISOString() }) });
      return ok({ brief });
    }

    if (body.action === "senders") {
      return ok({ senders: Object.entries(SENDERS).map(([id, v]) => ({ id, label: v.from })).concat(GROWTH_FROM ? [{ id: "custom", label: GROWTH_FROM }] : []) });
    }

    if (body.action === "send_brief") {
      if (!RESEND_KEY) throw new Error("RESEND_API_KEY not set");
      const sender = SENDERS[body.sender] || (body.sender === "custom" && GROWTH_FROM ? { from: GROWTH_FROM, email: (GROWTH_FROM.match(/<([^>]+)>/) || [, GROWTH_FROM])[1] } : null);
      if (!sender) throw new Error("pick a sender (contact / cz / dv)");
      const brief = (await sb(`lead_briefs?id=eq.${body.brief_id}&select=*`))?.[0];
      if (!brief) throw new Error("brief not found");
      const to = String(body.to || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("valid recipient email required");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: sender.from, to: [to], reply_to: sender.email, subject: brief.subject, html: mdToHtml(brief.body_md), text: brief.body_md }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Resend ${res.status}: ${data.message || "send failed"}`);
      const updated = (await sb(`lead_briefs?id=eq.${brief.id}`, { method: "PATCH", body: JSON.stringify({ status: "sent", sent_to: to, sent_at: new Date().toISOString(), resend_id: data.id || null, updated_at: new Date().toISOString() }) }))?.[0];
      await sb(`leads?id=eq.${brief.lead_id}`, { method: "PATCH", body: JSON.stringify({ stage: "contacted", updated_at: new Date().toISOString() }) });
      return ok({ brief: updated });
    }

    if (body.action === "convert") {
      const lead = (await sb(`leads?id=eq.${body.lead_id}&select=*`))?.[0];
      if (!lead) throw new Error("lead not found");
      if (lead.converted_client_id) return ok({ client_id: lead.converted_client_id, already: true });
      const slug = lead.host ? lead.host.split(".")[0].replace(/[^a-z0-9]+/g, "-").slice(0, 40) : lead.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const client = (await sb("clients", {
        method: "POST",
        body: JSON.stringify({ name: lead.name, slug: `${slug}-${Date.now().toString(36).slice(-4)}`, status: "active", primary_email: lead.email || null }),
      }))?.[0];
      await sb(`leads?id=eq.${lead.id}`, { method: "PATCH", body: JSON.stringify({ stage: "won", converted_client_id: client.id, updated_at: new Date().toISOString() }) });
      return ok({ client_id: client.id, client });
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `unknown action: ${body.action}` }) };
  } catch (e) {
    const missing = /leads|lead_research|lead_briefs/.test(e.message) && /404|relation|does not exist|PGRST/i.test(e.message);
    return { statusCode: missing ? 424 : 500, headers: cors, body: JSON.stringify({ error: missing ? "growth tables missing — run supabase/migrations/20260823_growth.sql first" : e.message }) };
  }
};
