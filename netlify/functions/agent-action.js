// agent-action.js — VitalLyfe War Room Agent Action Engine
// Handles autonomous agent actions: read/write Supabase, AI generation

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wjcstqqihtebkpyuacop.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SB_HEADERS = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

const REST = `${SUPABASE_URL}/rest/v1`;

async function sbGet(table, params = "") {
  const res = await fetch(`${REST}/${table}${params}`, { headers: SB_HEADERS() });
  if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(table, match, body) {
  const res = await fetch(`${REST}/${table}?${match}`, {
    method: "PATCH",
    headers: SB_HEADERS(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ai(system, user, maxTokens = 1200) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`Anthropic: ${d.error?.message || res.status}`);
  return d.content?.[0]?.text || "";
}

// ─── ACTION HANDLERS ──────────────────────────────────────────────────────────

async function muse_write_content(payload) {
  const { itemId, itemTitle, pillar, format, description, fieldToUpdate = "caption" } = payload;

  const systemPrompt = `You are Muse, Content Ideation Agent for the VitalLyfe War Room by Cloud Scenic. 
Write ${fieldToUpdate === "script" ? "video scripts" : "captions"} for the VitalLyfe brand.
Brand voice: cinematic, calm, purposeful. Key phrases: abundance, access, built for beyond.
AVOID: revolutionary, game-changing, exclamation points.
Caption structure: poetic statement then blank line then expand metaphor then blank line then bridge to brand then blank line then soft CTA like "Join us (Link in bio)".
For scripts: Opening Scene, Middle, Closing Frame format.
Write real copy, not descriptions.`;

  const userPrompt = `Write a ${fieldToUpdate} for this content piece:
Title: "${itemTitle}"
Content Pillar: ${pillar}
Format: ${format}
Description: ${description}

Write only the ${fieldToUpdate} content, nothing else.`;

  const copy = await ai(systemPrompt, userPrompt, 600);

  // Save to Supabase
  await sbPatch("content_items", `id=eq.${itemId}`, { [fieldToUpdate]: copy });

  return {
    success: true,
    agent: "Muse",
    action: "muse_write_content",
    itemId,
    itemTitle,
    fieldUpdated: fieldToUpdate,
    content: copy,
    message: `✍️ ${fieldToUpdate === "script" ? "Script" : "Caption"} generated and saved to "${itemTitle}"`,
  };
}

async function overseer_scan() {
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

  const systemPrompt = `You are Overseer, SOP Guardian for the VitalLyfe War Room. 
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

async function sean_briefing() {
  const items = await sbGet("content_items", "?order=id");

  const byStatus = {};
  for (const item of items) {
    const s = item.status || "Unknown";
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push(item.title);
  }

  const blocked = items.filter(i => ["Needs Revisions", "Need Copy Approval", "Need Content Approval"].includes(i.status));
  const readyToSchedule = items.filter(i => i.status === "Ready For Schedule");
  const scheduled = items.filter(i => i.status === "Scheduled");
  const inCreation = items.filter(i => ["Ready For Copy Creation", "Ready For Content Creation"].includes(i.status));

  const systemPrompt = `You are Sean, Commander Agent for the VitalLyfe War Room by Cloud Scenic. 
You orchestrate all 7 agents and own the content pipeline. 
Personality: decisive, calm, short punchy sentences. Military precision. Lead with what matters most.`;

  const userPrompt = `Generate a morning briefing for the team. Here's the pipeline status:

Total items: ${items.length}
Ready For Schedule: ${readyToSchedule.length} items — ${readyToSchedule.map(i => i.title).join(", ") || "none"}
Blocked/Needs Attention: ${blocked.length} items — ${blocked.map(i => `"${i.title}" (${i.status})`).join(", ") || "none"}
In Creation: ${inCreation.length} items — ${inCreation.map(i => i.title).join(", ") || "none"}
Scheduled: ${scheduled.length} items going out

By status: ${Object.entries(byStatus).map(([s,t]) => `${s}: ${t.length}`).join(" | ")}

Write a tight morning briefing: priorities, what's blocked, what needs immediate action. Under 200 words. Lead with the most urgent item.`;

  const briefing = await ai(systemPrompt, userPrompt, 400);

  return {
    success: true,
    agent: "Sean",
    action: "sean_briefing",
    stats: {
      total: items.length,
      readyToSchedule: readyToSchedule.length,
      blocked: blocked.length,
      inCreation: inCreation.length,
      scheduled: scheduled.length,
    },
    briefing,
    message: `📋 Morning briefing ready — ${items.length} items in pipeline`,
  };
}

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

async function sam_health() {
  const items = await sbGet("content_items", "?order=id");

  const statusCounts = {};
  for (const item of items) {
    const s = item.status || "Unknown";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // Items that might be "stuck" (no caption and past copy creation stage)
  const missingCopy = items.filter(i =>
    ["Ready For Content Creation", "Need Content Approval", "Approved", "Ready For Schedule", "Scheduled"].includes(i.status)
    && !i.caption && i.format !== "Reel"
  );

  const missingScript = items.filter(i =>
    ["Ready For Content Creation", "Need Content Approval", "Approved", "Ready For Schedule", "Scheduled"].includes(i.status)
    && !i.script && i.format === "Reel"
  );

  const systemPrompt = `You are Sam, Monitor Agent for the VitalLyfe War Room. You watch system health, pipeline metrics, and flag anomalies. Methodical, data-driven, brief.`;

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

async function muse_generate_calendar() {
  const items = await sbGet("content_items", "?order=id&limit=10");
  const pillars = ["Abundance", "Access", "Innovation", "Tierra Bomba", "Startup Diaries", "Product Launch", "Meet the Makers"];
  const existing = items.map(i => i.title).join(", ");

  const systemPrompt = `You are Muse, Content Ideation Agent for VitalLyfe War Room by Cloud Scenic.
Generate content calendar ideas. Brand voice: cinematic, calm, purposeful.
Content pillars: ${pillars.join(", ")}.
Platforms: Instagram (Reels, Graphics, Carousels), TikTok (Reels), YouTube (Shorts, Long-form), X/Threads.
AVOID: revolutionary, game-changing, exclamation points, generic corporate content.`;

  const userPrompt = `Generate a 4-week content calendar for VitalLyfe.
Existing content (don't repeat): ${existing}

For each week, suggest 3-4 content pieces. Format as:
WEEK 1
- [Format] [Platform] "[Title" | Pillar: X | Hook: brief hook idea
...

Cover all content pillars. Mix formats. Make titles cinematic and on-brand. 4 weeks total.`;

  const calendar = await ai(systemPrompt, userPrompt, 1200);

  return {
    success: true,
    agent: "Muse",
    action: "muse_generate_calendar",
    calendar,
    message: `✍️ 4-week content calendar generated (${pillars.length} pillars covered)`,
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }
  if (!SERVICE_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "SUPABASE_SERVICE_KEY not set" }) };
  }
  if (!ANTHROPIC_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }) };
  }

  try {
    const { action, payload = {} } = JSON.parse(event.body || "{}");

    let result;
    switch (action) {
      case "muse_write_content":     result = await muse_write_content(payload); break;
      case "overseer_scan":          result = await overseer_scan(); break;
      case "sean_briefing":          result = await sean_briefing(); break;
      case "lacey_advance":          result = await lacey_advance(); break;
      case "sam_health":             result = await sam_health(); break;
      case "muse_generate_calendar": result = await muse_generate_calendar(); break;
      default:
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: `Unknown action: ${action}` }),
        };
    }

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("agent-action error:", err);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
