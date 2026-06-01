// ── Agent Seed Data ──

export const AGENT_TASKS = {
  Sean: ["Deploying agents on priority tasks...", "Heartbeat check across all nodes", "Orchestrating morning briefing", "Routing new leads to Funnel", "Spinning up content pipeline", "Monitoring agent uptime — all green"],
  Artgrid: ["Scouting Art Grid: lifestyle + wellness clips", "Filtering footage for IG Reel #14", "Matching clips to Content Pillar: Inspiration", "Downloading B-roll batch: 8 clips", "Queuing B-roll for post-production", "Reviewing licensing on selected footage"],
  Muse: ["Generating content ideas — all platforms", "Analyzing trending hooks on TikTok", "Writing 5 hook variations for next Reel", "Mapping ideas to Content Pillars framework", "Building content calendar", "Writing IG caption batch — 12 posts", "Analyzing competitor hooks"],
  Scrappy: ["Scraping r/wellness: top posts this week", "Pulling HN trending — startup + water tech", "Scanning TikTok audio trends for hooks", "Cross-referencing Muse's last calendar", "Flagging viral angles for hydration niche", "Surfacing competitor content gaps", "Handing off trend brief to Muse "],
};

export const AGENTS_BASE = [
  { id:1, name:"Sean", role:"Commander", type:"Orchestrator", color:"#2AABFF", grad:"linear-gradient(135deg,#1a4028,#0d2018)", taskIdx:0 },
  { id:5, name:"Artgrid", role:"Footage Scout", type:"Creative", color:"#2AABFF", grad:"linear-gradient(135deg,#1e0a35,#100520)", taskIdx:0 },
  { id:6, name:"Muse", role:"Content Ideation", type:"Strategy", color:"#ff375f", grad:"linear-gradient(135deg,#3d0010,#200008)", taskIdx:0 },
  { id:8, name:"Scrappy", role:"Trend Scout", type:"Research", color:"#5e5ce6", grad:"linear-gradient(135deg,#0f0e35,#080718)", taskIdx:0 },
];

export const ACTION_COLORS = { route:"#2AABFF", complete:"#2AABFF", deploy:"#0a84ff", research:"#2AABFF", execute:"#ff9f0a", alert:"#ff453a", success:"#2AABFF", check:"#64d2ff", optimize:"#0a84ff", schedule:"#ff375f", brief:"#2AABFF", publish:"#2AABFF", secure:"#ffd60a", metric:"#ff9f0a", spawn:"#64d2ff" };

export const ACTIVITY_POOL = [
  { agent:"Scrappy", action:"r/wellness top posts scraped — 12 signals found", type:"research" },
  { agent:"Scrappy", action:"trend brief handed to Muse — 7 angles flagged", type:"brief" },
  { agent:"Scrappy", action:"HN trending: water tech article — high signal", type:"spawn" },
  { agent:"Artgrid", action:"downloaded 6 clips for Reel #14", type:"complete" },
  { agent:"Muse", action:"generated content calendar", type:"brief" },
  { agent:"Sean", action:"routed 3 assets to review queue", type:"route" },
  { agent:"Muse", action:"5 hook variations ready for review", type:"brief" },
  { agent:"Artgrid", action:"B-roll batch queued for post-production", type:"schedule" },
  { agent:"Sean", action:"spawned Muse: content ideation sprint", type:"spawn" },
];
