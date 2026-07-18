const { sbGet, ai } = require("../_shared");

async function sean_briefing(brand) {
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

  const systemPrompt = `You are Sean, Commander Agent for ${brand.name} via Cloud Scenic Vantus.
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

// ─── SCRAPPY: TREND SCOUT ─────────────────────────────────────────────────────


module.exports = { sean_briefing };
