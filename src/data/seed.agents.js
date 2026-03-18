// ── Agent Seed Data ──

export const AGENT_TASKS = {
  Sean: ["Deploying agents on priority tasks...", "Heartbeat check across all nodes", "Orchestrating morning briefing", "Routing new leads to Funnel", "Cross-checking SOP Step 07 compliance", "Spinning up content pipeline", "Monitoring agent uptime — all green"],
  Lacey: ["Building n8n workflow: lead capture", "Updating SOPs — revenue data v2", "Automating onboarding sequence", "Executing client deliverable batch", "Wiring Zapier → Supabase pipeline", "Running QA on automation flows", "Syncing deliverables to Drive"],
  Ali: ["Wiring IG feed integration schema", "Debugging TikTok webhook endpoints", "Optimizing DB queries — 40% faster", "Building auth flow for client portal", "Pushing hotfix to staging", "Code review: Sales Hub integration", "Deploying feed sync to prod"],
  Sam: ["Heartbeat-check — all systems nominal", "Monitoring revenue streams — $0 delta", "Security scan: no anomalies", "Reconciling Finance Q1 projections", "Flagging unusual API spend", "Auditing agent permission levels", "Monthly P&L — compiling report"],
  Artgrid: ["Scouting Art Grid: lifestyle + wellness clips", "Filtering footage for IG Reel #14", "Matching clips to Content Pillar: Inspiration", "Downloading B-roll batch: 8 clips", "Cross-referencing approved tracker Step 03", "Queuing B-roll for post-production", "Reviewing licensing on selected footage"],
  Muse: ["Generating March content ideas — all platforms", "Analyzing trending hooks on TikTok", "Writing 5 hook variations for next Reel", "Mapping ideas to Content Pillars framework", "Building April content calendar", "Writing IG caption batch — 12 posts", "Analyzing competitor hooks — Vital Lyfe niche"],
  Overseer: ["Reviewing Artgrid selections vs SOP Step 03", "Cross-checking Muse output vs Content Pillars", "Verifying tracker approval gate — Step 02", "Routing approved assets to Sprout Social", "Monitoring full SOP compliance — 7 steps", "Coordinating client review via Wipster", "Final sign-off check before go-live"],
  Scrappy: ["Scraping r/wellness: top posts this week", "Pulling HN trending — startup + water tech", "Scanning TikTok audio trends for hooks", "Cross-referencing Muse's last calendar", "Flagging viral angles for hydration niche", "Surfacing competitor content gaps", "Handing off trend brief to Muse "],
};

export const AGENTS_BASE = [
  { id:1, name:"Sean", role:"Commander", type:"Orchestrator", color:"#2AABFF", grad:"linear-gradient(135deg,#1a4028,#0d2018)", taskIdx:0 },
  { id:2, name:"Lacey", role:"Runner", type:"Executor", color:"#ff9f0a", grad:"linear-gradient(135deg,#3d2800,#1e1400)", taskIdx:2 },
  { id:3, name:"Ali", role:"Developer", type:"Builder", color:"#0a84ff", grad:"linear-gradient(135deg,#001a3d,#000d20)", taskIdx:0 },
  { id:4, name:"Sam", role:"Monitor", type:"Security", color:"#ffd60a", grad:"linear-gradient(135deg,#2d2500,#181200)", taskIdx:0 },
  { id:5, name:"Artgrid", role:"Footage Scout", type:"Creative", color:"#2AABFF", grad:"linear-gradient(135deg,#1e0a35,#100520)", taskIdx:0 },
  { id:6, name:"Muse", role:"Content Ideation", type:"Strategy", color:"#ff375f", grad:"linear-gradient(135deg,#3d0010,#200008)", taskIdx:0 },
  { id:7, name:"Overseer", role:"SOP Guardian", type:"Compliance", color:"#64d2ff", grad:"linear-gradient(135deg,#002040,#001020)", taskIdx:0 },
  { id:8, name:"Scrappy", role:"Trend Scout", type:"Research", color:"#5e5ce6", grad:"linear-gradient(135deg,#0f0e35,#080718)", taskIdx:0 },
];

export const ACTION_COLORS = { route:"#2AABFF", complete:"#2AABFF", deploy:"#0a84ff", research:"#2AABFF", execute:"#ff9f0a", alert:"#ff453a", success:"#2AABFF", check:"#64d2ff", optimize:"#0a84ff", schedule:"#ff375f", brief:"#2AABFF", publish:"#2AABFF", secure:"#ffd60a", metric:"#ff9f0a", spawn:"#64d2ff" };

export const ACTIVITY_POOL = [
  { agent:"Scrappy", action:"r/wellness top posts scraped — 12 signals found", type:"research" },
  { agent:"Scrappy", action:"trend brief handed to Muse — 7 angles flagged", type:"brief" },
  { agent:"Scrappy", action:"HN trending: water tech article — high signal", type:"spawn" },
  { agent:"Overseer", action:"SOP Step 03 — Artgrid selections approved", type:"check" },
  { agent:"Artgrid", action:"downloaded 6 clips for Reel #14", type:"complete" },
  { agent:"Muse", action:"generated March content calendar", type:"brief" },
  { agent:"Sean", action:"routed 3 assets to review queue", type:"route" },
  { agent:"Ali", action:"pushed IG feed integration to staging", type:"deploy" },
  { agent:"Lacey", action:"triggered n8n: onboarding sequence", type:"execute" },
  { agent:"Sam", action:"security scan — all clear", type:"secure" },
  { agent:"Overseer", action:"Content Pillars compliance — 100%", type:"check" },
  { agent:"Muse", action:"5 hook variations ready for review", type:"brief" },
  { agent:"Artgrid", action:"B-roll batch queued for post-production", type:"schedule" },
  { agent:"Ali", action:"TikTok webhook — 200 OK", type:"optimize" },
  { agent:"Lacey", action:"Sprout Social schedule — synced", type:"publish" },
  { agent:"Sam", action:"API spend within budget — nominal", type:"metric" },
  { agent:"Overseer", action:"final sign-off cleared — Step 07 done", type:"success" },
  { agent:"Sean", action:"spawned Muse: April ideation sprint", type:"spawn" },
];
