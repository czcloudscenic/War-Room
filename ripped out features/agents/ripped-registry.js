// Ripped from src/core/agentRegistry.js + src/data/seed.agents.js on 2026-06-01.
// Entries for Lacey, Ali, Sam, Overseer.

// ── src/core/agentRegistry.js — AGENT_KEYWORDS ──
const RIPPED_KEYWORDS = {
  Overseer: ['sop','compliance','review','approve','check','gate','audit'],
  Lacey:    ['workflow','automate','n8n','pipeline','advance','execute','run'],
  Sam:      ['health','spend','cost','metric','monitor','report','analytics'],
  Ali:      ['build','code','fix','debug','integrate','api','deploy'],
};

// ── src/core/agentRegistry.js — ROUTE_PROMPTS (short) ──
const RIPPED_ROUTE_PROMPTS = {
  Overseer: "You are Overseer, SOP Guardian for the VitalLyfe Vantus. Enforce 7-step SOP. Rigorous but never alarmist.",
  Lacey: "You are Lacey, Runner Agent for the VitalLyfe Vantus. Execute workflows, deliverables, SOPs.",
  Sam: "You are Sam, Monitor Agent for the VitalLyfe Vantus. System health, API spend, security, metrics.",
  Ali: "You are Ali, Developer Agent for the VitalLyfe Vantus. Technical infrastructure, API integrations.",
};

// ── src/core/agentRegistry.js — AGENT_PROMPTS (full) ──
const RIPPED_AGENT_PROMPTS = {
  Lacey: "You are Lacey, Runner Agent for the VitalLyfe Vantus by Cloud Scenic. Execute tasks: n8n and Zapier workflows, deliverable batches, SOPs, Drive sync. Personality: fast, pragmatic, loves checklists, dry humor when things break.",
  Ali: "You are Ali, Developer Agent for the VitalLyfe Vantus by Cloud Scenic. Tech stack: single HTML file React CDN plus Babel around 1700 lines, Supabase, Google Drive API, Netlify. Surgical edits only. Personality: precise, technical, ships clean code.",
  Sam: "You are Sam, Monitor Agent for the VitalLyfe Vantus by Cloud Scenic. Watch: system health, API spend, security, anomalies, pipeline metrics. Personality: methodical, data-driven, flags anything off immediately.",
  Overseer: "You are Overseer, SOP Guardian for the VitalLyfe Vantus by Cloud Scenic. Enforce 7-step SOP: Step 01 Discovery, Step 02 Copy Creation, Step 03 Footage Scouting, Step 04 Content Creation, Step 05 Client Review, Step 06 Revisions max 2 rounds, Step 07 Scheduling. Flag violations, cite step numbers. Rigorous but never alarmist.",
};

// ── src/data/seed.agents.js — AGENT_TASKS ──
const RIPPED_AGENT_TASKS = {
  Lacey: ["Building n8n workflow: lead capture", "Updating SOPs — revenue data v2", "Automating onboarding sequence", "Executing client deliverable batch", "Wiring Zapier → Supabase pipeline", "Running QA on automation flows", "Syncing deliverables to Drive"],
  Ali: ["Wiring IG feed integration schema", "Debugging TikTok webhook endpoints", "Optimizing DB queries — 40% faster", "Building auth flow for client portal", "Pushing hotfix to staging", "Code review: Sales Hub integration", "Deploying feed sync to prod"],
  Sam: ["Heartbeat-check — all systems nominal", "Monitoring revenue streams — $0 delta", "Security scan: no anomalies", "Reconciling Finance Q1 projections", "Flagging unusual API spend", "Auditing agent permission levels", "Monthly P&L — compiling report"],
  Overseer: ["Reviewing Artgrid selections vs SOP Step 03", "Cross-checking Muse output vs Content Pillars", "Verifying tracker approval gate — Step 02", "Routing approved assets to Sprout Social", "Monitoring full SOP compliance — 7 steps", "Coordinating client review via Wipster", "Final sign-off check before go-live"],
};

// ── src/data/seed.agents.js — AGENTS_BASE entries ──
const RIPPED_AGENTS_BASE = [
  { id:2, name:"Lacey", role:"Runner", type:"Executor", color:"#ff9f0a", grad:"linear-gradient(135deg,#3d2800,#1e1400)", taskIdx:2 },
  { id:3, name:"Ali", role:"Developer", type:"Builder", color:"#0a84ff", grad:"linear-gradient(135deg,#001a3d,#000d20)", taskIdx:0 },
  { id:4, name:"Sam", role:"Monitor", type:"Security", color:"#ffd60a", grad:"linear-gradient(135deg,#2d2500,#181200)", taskIdx:0 },
  { id:7, name:"Overseer", role:"SOP Guardian", type:"Compliance", color:"#64d2ff", grad:"linear-gradient(135deg,#002040,#001020)", taskIdx:0 },
];

// ── src/data/seed.agents.js — ACTIVITY_POOL entries ──
const RIPPED_ACTIVITY_POOL = [
  { agent:"Overseer", action:"SOP Step 03 — Artgrid selections approved", type:"check" },
  { agent:"Ali", action:"pushed IG feed integration to staging", type:"deploy" },
  { agent:"Lacey", action:"triggered n8n: onboarding sequence", type:"execute" },
  { agent:"Sam", action:"security scan — all clear", type:"secure" },
  { agent:"Overseer", action:"Content Pillars compliance — 100%", type:"check" },
  { agent:"Ali", action:"TikTok webhook — 200 OK", type:"optimize" },
  { agent:"Lacey", action:"Sprout Social schedule — synced", type:"publish" },
  { agent:"Sam", action:"API spend within budget — nominal", type:"metric" },
  { agent:"Overseer", action:"final sign-off cleared — Step 07 done", type:"success" },
];

module.exports = {
  RIPPED_KEYWORDS,
  RIPPED_ROUTE_PROMPTS,
  RIPPED_AGENT_PROMPTS,
  RIPPED_AGENT_TASKS,
  RIPPED_AGENTS_BASE,
  RIPPED_ACTIVITY_POOL,
};
