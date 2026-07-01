// ── Constants ──

export const NAV = [
  { section:"COMMAND", items:[{ id:"dashboard", label:"Dashboard" }, { id:"clients", label:"Clients" }, { id:"ledger", label:"Ledger" }, { id:"reports", label:"Reports" }, { id:"operations", label:"Operations" }, { id:"agents", label:"Agents" }, { id:"cid", label:"Competitor Intel" }, { id:"icp", label:"Ideal Customer" }]},
  { section:"CONTENT", items:[{ id:"analytics", label:"Analytics" }, { id:"ideas", label:"Idea Engine" }, { id:"adroihub", label:"Ad ROI Hub" }, { id:"content", label:"Pipeline" }]},
  { section:"APPS", items:[{ id:"apps", label:"Apps" }, { id:"settings", label:"Settings" }]},
];

export const STATUS_COLOR = {
  "Ready For Copy Creation":    "#f59e0b",
  "Need Copy Approval":         "#3b82f6",
  "Ready For Content Creation": "#10b981",
  "Need Content Approval":      "#ff453a",
  "Needs Revisions":            "#f97316",
  "Approved":                   "#2AABFF",
  "Ready For Schedule":         "#8b5cf6",
  "Scheduled":                  "#64d2ff",
  "Scrapped":                   "#ff453a",
};

export const STAGE_SHORT = {
  "Ready For Copy Creation":    "Copy Creation",
  "Need Copy Approval":         "Copy Approval",
  "Ready For Content Creation": "Content Creation",
  "Need Content Approval":      "Content Approval",
  "Needs Revisions":            "Needs Revisions",
  "Approved":                   "Approved",
  "Ready For Schedule":         "Ready to Schedule",
  "Scheduled":                  "Scheduled",
};

export const STATUSES = ["Ready For Copy Creation", "Need Copy Approval", "Ready For Content Creation", "Need Content Approval", "Needs Revisions", "Approved", "Ready For Schedule", "Scheduled", "Scrapped"];
export const FORMATS = ["Reel", "Graphics (IMG)", "Carousel", "Thread", "Story", "YouTube", "Short"];

// Pillars + campaigns are per-client. These are placeholder defaults shown only when
// no client is selected or the client hasn't configured their own. Per-client values
// come from clients.brand_voice_md (parsed) and clients.campaigns (future column).
export const PILLARS_LIST = ["Pillar 1", "Pillar 2", "Pillar 3", "Pillar 4", "Pillar 5"];
export const PLATFORMS_LIST = ["IG", "TT", "X", "TH", "LI", "YT", "RD", "EM"];
export const CAMPAIGNS = [];
