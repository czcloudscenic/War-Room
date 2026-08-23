// handlers/growth.js — Growth brief writer (v3 spec §3.C.4 + Outreach DNA).
// Reads the DETERMINISTIC audit findings (siteAudit) and narrates them into a
// short outreach brief. It never invents gaps — every pain point it names must
// trace to a finding key. Draft-first: lands as a lead_briefs row, a human
// sends. No credits = this action errors; the template brief covers the gap.

const { REST, SB_HEADERS, sbGet, ai } = require("../_shared");

async function sbWrite(path, { method = "POST", body, headers = {} } = {}) {
  const res = await fetch(`${REST}/${path}`, { method, headers: { ...SB_HEADERS(), ...headers }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`supabase ${method} ${path.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
function parseJSON(raw) {
  const cleaned = String(raw).replace(/```json|```/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

async function growth_brief(payload) {
  const { lead_id, actor_email = null, from_name = "Christian", tone = "" } = payload;
  if (!lead_id) throw new Error("lead_id required");
  const lead = (await sbGet("leads", `?id=eq.${lead_id}&select=*`))?.[0];
  if (!lead) throw new Error("lead not found");
  const research = (await sbGet("lead_research", `?lead_id=eq.${lead_id}&select=findings,raw&order=created_at.desc&limit=1`))?.[0];
  const findings = research?.findings || [];
  if (!findings.length) throw new Error("no audit findings yet — run a scan first");
  const sig = research?.raw || {};

  const system = `You write short, plain-English outreach briefs for Cloud Scenic, a marketing agency (performance ads, content, video). Rules: no hype, no jargon, no em-dashes (use commas or periods), no fake flattery, never quote prices, never invent facts. Every pain point you mention MUST come from the FINDINGS list given; cite the evidence in plain words. Sound like a sharp operator who looked at their business for ten minutes and wants to help. Under 180 words in the body. Output JSON only: {"subject":"...","body_md":"...","summary":"one internal sentence on the biggest gap"}`;

  const user = `BUSINESS: ${lead.name}${lead.city ? ` (${lead.city})` : ""}${lead.industry ? ` — ${lead.industry}` : ""}
WEBSITE: ${lead.website || "n/a"}  BUILDER: ${sig.builder || "unknown"}  SOCIALS LINKED: ${Object.keys(sig.socials || {}).join(", ") || "none"}
CONTACT: ${lead.contact_name || "unknown"}${lead.contact_title ? `, ${lead.contact_title}` : ""}
SIGN AS: ${from_name}, Cloud Scenic
${tone ? `TONE NOTE: ${tone}\n` : ""}
FINDINGS (ranked; use the top 3-4 only):
${findings.map(f => `- [${f.severity}] ${f.label} — evidence: ${f.evidence} — why it matters: ${f.pitch}`).join("\n")}

Write the brief. Open with one observation specific to THEM, list the gaps as numbered lines, close with a low-pressure 15-minute offer.`;

  const raw = await ai(system, user, 1200);
  const out = parseJSON(raw);
  if (!out?.subject || !out?.body_md) throw new Error(`brief writer returned unusable output: ${String(raw).slice(0, 160)}`);
  const body_md = String(out.body_md).replace(/—|–/g, ",");
  const brief = (await sbWrite("lead_briefs", { body: { lead_id, subject: String(out.subject).replace(/—|–/g, "-").slice(0, 180), body_md, origin: "ai", status: "draft", created_by: actor_email }, headers: { Prefer: "return=representation" } }))?.[0];
  if (out.summary && research) {
    await sbWrite(`lead_research?lead_id=eq.${lead_id}&kind=eq.site_scan`, { method: "PATCH", body: { summary: String(out.summary).slice(0, 500) }, headers: { Prefer: "return=minimal" } }).catch(() => {});
  }
  if (lead.stage === "researched") await sbWrite(`leads?id=eq.${lead_id}`, { method: "PATCH", body: { stage: "briefed", updated_at: new Date().toISOString() }, headers: { Prefer: "return=minimal" } });
  return { ok: true, brief, message: `Brief drafted for ${lead.name}: ${out.subject}` };
}

module.exports = { growth_brief };
