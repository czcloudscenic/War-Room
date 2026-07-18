const { ai } = require("../_shared");

async function ops_assign(payload) {
  const { taskDump = "", team = [] } = payload;
  if (!taskDump.trim()) return { tasks: [] };
  const roster = team.length
    ? team.map(m => `- ${m.name} (${m.role || "team"}) — skills: ${(Array.isArray(m.skills) ? m.skills : []).join(", ") || "general"} [id:${m.id}]`).join("\n")
    : "(no team members — leave assignee_id null)";
  const today = new Date().toISOString().slice(0, 10);
  const system = `You are the AI Operations Manager for a creative agency. You receive a raw task list (one task per line, natural language) and the team roster with skills. For EACH task, return an object with:
- title: a clean, concise task title
- priority: one of "low" | "medium" | "high" | "urgent"
- score: integer 0-100 (urgency x importance)
- assignee_id: the id of the single best-fit team member by skill match, or null if none fit
- assignee_name: that member's name, or null
- reason: one short line on why this person
- due_hint: an ISO date (YYYY-MM-DD) if the task names timing (today, Monday, EOD, by Friday), else null
Return ONLY a JSON array — no prose, no markdown fences.`;
  const user = `Today is ${today}.\n\nTEAM ROSTER:\n${roster}\n\nTASK LIST:\n${taskDump}`;
  const raw = await ai(system, user, 1800);
  let tasks = [];
  try {
    tasks = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (!Array.isArray(tasks)) tasks = [];
  } catch (e) { console.error("[ops_assign] JSON parse failed:", e.message, "| raw:", (raw || "").slice(0, 500)); tasks = []; }
  return { tasks };
}


module.exports = { ops_assign };
