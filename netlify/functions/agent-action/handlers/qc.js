const { sbGet, sbPatch, aiVision, fetchDriveImage } = require("../_shared");

function runExactFactChecks(facts, textCorpus) {
  const issues = [];
  if (!facts) return issues;
  const text = (textCorpus || "").toLowerCase();
  const now = new Date();

  // Expired / not-yet-valid offers mentioned in the copy → hard blocker.
  for (const offer of (facts.offers || [])) {
    if (!offer?.name) continue;
    if (!text.includes(String(offer.name).toLowerCase())) continue;
    if (offer.valid_to && new Date(offer.valid_to + "T23:59:59") < now) {
      issues.push({ layer: "facts", severity: "blocker", location: "offer",
        description: `Offer "${offer.name}" expired ${offer.valid_to} but is referenced in this deliverable.` });
    } else if (offer.valid_from && new Date(offer.valid_from + "T00:00:00") > now) {
      issues.push({ layer: "facts", severity: "blocker", location: "offer",
        description: `Offer "${offer.name}" isn't live until ${offer.valid_from} but is referenced now.` });
    }
  }

  // Price mismatches: an item of record named near a $ amount that isn't its price.
  for (const p of (facts.prices || [])) {
    if (!p?.item || p.price == null) continue;
    const itemIdx = text.indexOf(String(p.item).toLowerCase());
    if (itemIdx === -1) continue;
    const window = text.slice(Math.max(0, itemIdx - 60), itemIdx + String(p.item).length + 60);
    const amounts = [...window.matchAll(/\$\s?(\d+(?:\.\d{1,2})?)/g)].map(m => Number(m[1]));
    const recorded = Number(String(p.price).replace(/[^0-9.]/g, ""));
    if (amounts.length && Number.isFinite(recorded) && !amounts.some(a => Math.abs(a - recorded) < 0.005)) {
      issues.push({ layer: "facts", severity: "blocker", location: "price",
        description: `"${p.item}" is $${recorded} on record but appears as $${amounts[0]} in the deliverable.` });
    }
  }

  // Phone numbers that don't match any location of record.
  const knownPhones = (facts.locations || []).map(l => String(l?.phone || "").replace(/\D/g, "")).filter(s => s.length >= 10);
  if (knownPhones.length) {
    const found = [...text.matchAll(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g)].map(m => m[0].replace(/\D/g, ""));
    for (const ph of found) {
      if (!knownPhones.some(k => k.endsWith(ph) || ph.endsWith(k))) {
        issues.push({ layer: "facts", severity: "blocker", location: "phone",
          description: `Phone number in deliverable (${ph.replace(/(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}) doesn't match any location of record.` });
      }
    }
  }

  return issues;
}

function summarizeFactsForPrompt(facts) {
  if (!facts || !Object.keys(facts).length) return "";
  const parts = [];
  if (facts.hours && Object.keys(facts.hours).length) {
    const days = ["mon","tue","wed","thu","fri","sat","sun"]
      .filter(d => facts.hours[d]).map(d => `${d}: ${facts.hours[d]}`).join(" · ");
    if (days) parts.push(`HOURS OF RECORD: ${days}`);
    if (Array.isArray(facts.hours.exceptions) && facts.hours.exceptions.length) {
      parts.push(`HOURS EXCEPTIONS: ${facts.hours.exceptions.join("; ")}`);
    }
  }
  if (Array.isArray(facts.locations) && facts.locations.length) {
    parts.push(`LOCATIONS OF RECORD: ${facts.locations.map(l => [l.address, l.phone].filter(Boolean).join(" · ")).join(" | ")}`);
  }
  if (Array.isArray(facts.prices) && facts.prices.length) {
    parts.push(`PRICES OF RECORD: ${facts.prices.map(p => `${p.item} = $${p.price}`).join("; ")}`);
  }
  if (Array.isArray(facts.offers) && facts.offers.length) {
    parts.push(`OFFERS OF RECORD: ${facts.offers.map(o => `${o.name} (valid ${o.valid_from || "?"} to ${o.valid_to || "?"})`).join("; ")}`);
  }
  if (Array.isArray(facts.operational_facts) && facts.operational_facts.length) {
    parts.push(`OPERATIONAL FACTS: ${facts.operational_facts.join("; ")}`);
  }
  return parts.join("\n");
}

function parseQcJson(raw) {
  let s = String(raw || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("QC agent returned no JSON object");
  return JSON.parse(s.slice(start, end + 1));
}

async function qc_review(payload, brand) {
  const { itemId } = payload;
  if (!itemId) throw new Error("qc_review: itemId required");

  const items = await sbGet("content_items", `?id=eq.${encodeURIComponent(itemId)}&select=*`);
  const item = items?.[0];
  if (!item) throw new Error(`qc_review: item ${itemId} not found`);

  // Facts of Record + staleness (stale facts are worse than no QC — surface it).
  let facts = null, factsStaleDays = null;
  if (item.client_id) {
    const rows = await sbGet("clients", `?id=eq.${item.client_id}&select=client_facts,facts_updated_at`);
    const c = rows?.[0];
    if (c?.client_facts && Object.keys(c.client_facts).length) {
      facts = c.client_facts;
      if (c.facts_updated_at) {
        factsStaleDays = Math.floor((Date.now() - new Date(c.facts_updated_at).getTime()) / 86400000);
      }
    }
  }

  // Pull the actual assets (images only in v1 — see video note below).
  const files = Array.isArray(item.files) ? item.files : [];
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f?.name || "")).slice(0, 3);
  const hasVideo = files.some(f => /\.(mp4|mov|avi|webm)$/i.test(f?.name || ""));
  const images = (await Promise.all(imageFiles.map(fetchDriveImage))).filter(Boolean);

  const factsBlock = summarizeFactsForPrompt(facts);
  const system = `You are the Vantus QC Agent for ${brand.name} (Cloud Scenic). You review a deliverable BEFORE it can be approved or scheduled. The one unforgivable failure: content posting with a wrong price, wrong hours, or an expired offer.

Check three layers:
1. FACTS (severity "blocker" on any mismatch): compare every price, time, date, address, phone, offer, and operational claim in the caption AND visible in the attached image(s) against the FACTS OF RECORD below. Exact comparison — "9AM" vs "10AM" is a blocker. If no facts of record are provided, do NOT invent facts and do NOT block on facts.
2. COPY (severity "warning"): spelling, grammar, typos in the caption and in text visible on the asset; legibility of on-asset text (too small, poor contrast, cut off); claims the brand can't support.
3. BRAND (severity "warning"): tone, look, and content vs the brand guidelines. AI judgment, surfaced for a human — never block on taste.

Also extract ALL text you can read on the attached image(s).

Return ONLY a JSON object, no prose, exactly this shape:
{
  "status": "pass" | "flagged" | "blocked",
  "extracted_text": "all on-asset text you could read, or empty string",
  "issues": [
    { "layer": "facts" | "copy" | "brand",
      "severity": "blocker" | "warning",
      "description": "specific, one sentence",
      "location": "caption" | "on-asset" | "script" | "cta" }
  ]
}
Rules: "blocked" only if at least one facts blocker exists. "pass" means zero issues. Otherwise "flagged".`;

  const userText = `DELIVERABLE
Title: ${item.title || "Untitled"}
Format: ${item.format || item.type || "?"} · Platform(s): ${(item.platforms || []).join(", ") || item.platform || "?"}
Caption: """${item.caption || "(none)"}"""
CTA: """${item.cta || "(none)"}"""
${item.script ? `Script: """${item.script}"""` : ""}

${factsBlock ? `FACTS OF RECORD (source of truth — exact-match against these):\n${factsBlock}` : "FACTS OF RECORD: none on file for this client."}

${brand.voice ? `BRAND GUIDELINES:\n${brand.voice.slice(0, 2400)}` : ""}

${images.length ? `${images.length} asset image(s) attached above.` : "No image assets could be loaded — review the text layers only."}`;

  const contentBlocks = [
    ...images.map(im => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
    { type: "text", text: userText },
  ];

  const raw = await aiVision(system, contentBlocks, 1600, "claude-sonnet-4-6");
  let parsed;
  try {
    parsed = parseQcJson(raw);
  } catch (e) {
    throw new Error(`QC output parse failed: ${e.message} — raw: ${String(raw).slice(0, 200)}`);
  }

  const aiIssues = Array.isArray(parsed.issues) ? parsed.issues
    .filter(i => i && i.description)
    .map(i => ({
      layer: ["facts", "copy", "brand"].includes(i.layer) ? i.layer : "copy",
      severity: i.severity === "blocker" ? "blocker" : "warning",
      description: String(i.description).slice(0, 400),
      location: String(i.location || "caption").slice(0, 40),
    })) : [];

  // Hybrid gate: deterministic checks over caption + CTA + script + extracted on-asset text.
  const corpus = [item.caption, item.cta, item.script, parsed.extracted_text].filter(Boolean).join("\n");
  const codeIssues = runExactFactChecks(facts, corpus);

  const issues = [...codeIssues, ...aiIssues];

  // Guardrail notes (warnings, never blockers):
  if (!facts) {
    issues.push({ layer: "facts", severity: "warning", location: "facts-of-record",
      description: "No Facts of Record on file for this client — factual QC was skipped. Add them in Setup." });
  } else if (factsStaleDays != null && factsStaleDays > 30) {
    issues.push({ layer: "facts", severity: "warning", location: "facts-of-record",
      description: `Facts of Record last updated ${factsStaleDays} days ago — verify before trusting this pass.` });
  }
  if (hasVideo && !images.length) {
    issues.push({ layer: "copy", severity: "warning", location: "on-asset",
      description: "Video asset not frame-checked (v1 limit) — caption and facts reviewed; eyeball on-video text manually." });
  }

  const status = issues.some(i => i.severity === "blocker") ? "blocked"
    : issues.length ? "flagged" : "pass";

  const qc_ran_at = new Date().toISOString();
  await sbPatch("content_items", `id=eq.${encodeURIComponent(itemId)}`, {
    qc_status: status, qc_issues: issues, qc_ran_at,
  });

  const blockers = issues.filter(i => i.severity === "blocker");
  const emoji = status === "pass" ? "✅" : status === "flagged" ? "⚠️" : "⛔";
  const message = status === "blocked"
    ? `⛔ QC BLOCKED "${item.title}" — ${blockers.map(b => b.description).join(" · ").slice(0, 400)}`
    : `${emoji} QC ${status} on "${item.title}"${issues.length ? ` — ${issues.length} issue${issues.length === 1 ? "" : "s"} noted` : " — clean"}`;

  return {
    success: true,
    agent: "QC",
    action: "qc_review",
    itemId,
    id: itemId,
    status,
    issues,
    qc_ran_at,
    imagesChecked: images.length,
    message,
  };
}

// ─── ACTION HANDLERS ──────────────────────────────────────────────────────────


module.exports = { qc_review };
