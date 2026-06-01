// Ripped from netlify/functions/agent-action.js on 2026-06-01.
// These 4 backend handlers belonged to Lacey, Sam, Overseer (Ali had no backend handler).
//
// Dependencies (must exist in agent-action.js if reviving):
//   - sbGet(table, params)
//   - sbPatch(table, match, body)
//   - ai(system, user, maxTokens)
//   - N8N_WEBHOOK_URL env var
//
// Slack labels (re-add to SLACK_AGENT_LABELS):
//   lacey_advance:     "⚡ *Lacey* — Pipeline Update",
//   lacey_trigger_n8n: "⚡ *Lacey* — n8n Trigger",
//   sam_health:        "💊 *Sam* — Health Check",
//   overseer_scan:     "🔍 *Overseer* — SOP Scan",
//
// Router cases (re-add to the switch around line ~1244):
//   case "overseer_scan":     result = await overseer_scan(brand); break;
//   case "lacey_advance":     result = await lacey_advance(); break;
//   case "sam_health":        result = await sam_health(brand); break;
//   case "lacey_trigger_n8n": result = await lacey_trigger_n8n(payload); break;

// ─── OVERSEER: SOP COMPLIANCE SCAN ───────────────────────────────────────────

async function overseer_scan(brand) {
  const items = await sbGet("content_items", "?order=id");

  const SOP_STEPS = [
    "Step 01 — Discovery: Ideation & Concept Alignment",
    "Step 02 — Planning: Content Tracker Build & Approval",
    "Step 03 — Pre-Production: Footage Scouting via Art Grid",
    "Step 04 — Production: Content Development & Post-Production",
    "Step 05 — Review: Content Review & Client Approval",
    "Step 06 — Distribution: Content Scheduling Across All Platforms",
    "Step 07 — Final Sign-Off: Scheduler Review & Final Confirmation",
  ];

  const summary = items.map(i => `ID:${i.id} | "${i.title}" | Status:${i.status} | Pillar:${i.pillar} | Format:${i.format} | Caption:${i.caption ? "YES" : "NO"} | Script:${i.script ? "YES" : "NO"}`).join("\n");

  const systemPrompt = `You are Overseer, SOP Guardian for ${brand.name} via Cloud Scenic Vantus.
Enforce this 7-step SOP:
${SOP_STEPS.join("\n")}

Review the content pipeline and identify items that may be violating or skipping SOP steps.
Flag items that: are stuck in wrong stages, missing copy when needed, not following proper approval flow.
Be precise, cite step numbers, be rigorous but not alarmist. Return JSON array.`;

  const userPrompt = `Review this content pipeline (${items.length} items) and return a JSON array of flagged items:
${summary}

Return JSON array like: [{"itemId":"vl-X","title":"...","violation":"Step 02 — missing caption before copy approval","severity":"high|medium|low"}]
Return empty array [] if everything looks compliant. Only return the JSON array, nothing else.`;

  const rawResult = await ai(systemPrompt, userPrompt, 1000);

  let flagged = [];
  try {
    const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
    flagged = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) {
    flagged = [];
  }

  return {
    success: true,
    agent: "Overseer",
    action: "overseer_scan",
    totalItems: items.length,
    flaggedCount: flagged.length,
    flagged,
    message: flagged.length === 0
      ? `✅ SOP compliance check complete — all ${items.length} items in order`
      : `🔍 SOP scan complete — ${flagged.length} item(s) flagged across ${items.length} total`,
  };
}

// ─── LACEY: ADVANCE PIPELINE ─────────────────────────────────────────────────

async function lacey_advance() {
  const readyItems = await sbGet("content_items", "?status=eq.Ready For Schedule");

  if (readyItems.length === 0) {
    return {
      success: true,
      agent: "Lacey",
      action: "lacey_advance",
      advancedCount: 0,
      items: [],
      message: "⚡ No items ready to advance — pipeline is clean",
    };
  }

  const advanced = [];
  for (const item of readyItems) {
    await sbPatch("content_items", `id=eq.${item.id}`, {
      status: "Scheduled",
      stage: "Scheduled",
    });
    advanced.push({ id: item.id, title: item.title });
  }

  return {
    success: true,
    agent: "Lacey",
    action: "lacey_advance",
    advancedCount: advanced.length,
    items: advanced,
    message: `⚡ Advanced ${advanced.length} item(s) from "Ready For Schedule" → "Scheduled": ${advanced.map(i => i.title).join(", ")}`,
  };
}

// ─── SAM: HEALTH CHECK ───────────────────────────────────────────────────────

async function sam_health(brand) {
  const items = await sbGet("content_items", "?order=id");

  const statusCounts = {};
  for (const item of items) {
    const s = item.status || "Unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  const missingCopy = items.filter(i =>
    ["Ready For Content Creation", "Need Content Approval", "Approved", "Ready For Schedule", "Scheduled"].includes(i.status)
    && !i.caption && i.format !== "Reel"
  );

  const missingScript = items.filter(i =>
    ["Ready For Content Creation", "Need Content Approval", "Approved", "Ready For Schedule", "Scheduled"].includes(i.status)
    && !i.script && i.format === "Reel"
  );

  const systemPrompt = `You are Sam, Monitor Agent for ${brand.name} via Cloud Scenic Vantus. You watch system health, pipeline metrics, and flag anomalies. Methodical, data-driven, brief.`;

  const userPrompt = `Generate a pipeline health report:

Total items: ${items.length}
Status breakdown: ${Object.entries(statusCounts).map(([s,n]) => `${s}: ${n}`).join(" | ")}
Items missing captions (past copy stage): ${missingCopy.length}
Reels missing scripts (past copy stage): ${missingScript.length}

Give a concise health report with: overall score (0-100), key risks, recommended actions. Under 150 words.`;

  const report = await ai(systemPrompt, userPrompt, 300);

  return {
    success: true,
    agent: "Sam",
    action: "sam_health",
    metrics: {
      total: items.length,
      byStatus: statusCounts,
      missingCopy: missingCopy.length,
      missingScript: missingScript.length,
    },
    report,
    message: `💊 Health check complete — ${items.length} items analyzed`,
  };
}

// ─── LACEY: TRIGGER N8N WORKFLOW ─────────────────────────────────────────────

async function lacey_trigger_n8n(payload) {
  const {
    workflow = "general",
    data = {},
    message = "",
    triggeredBy = "Vantus",
  } = payload;

  if (!N8N_WEBHOOK_URL) throw new Error("N8N_WEBHOOK_URL not configured");

  const body = {
    workflow,
    triggeredBy,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  const res = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  let responseData = {};
  try { responseData = JSON.parse(responseText); } catch {}

  if (!res.ok) throw new Error(`n8n webhook failed: ${res.status} ${responseText}`);

  return {
    success: true,
    agent: "Lacey",
    workflow,
    message: `✅ Triggered n8n workflow "${workflow}" successfully`,
    n8nResponse: responseData,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { overseer_scan, lacey_advance, sam_health, lacey_trigger_n8n };
