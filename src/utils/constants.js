// ── Constants ──

export const NAV = [
  { section:"COMMAND", items:[{ id:"dashboard", label:"Dashboard" }, { id:"agents", label:"Agents" }]},
  { section:"CONTENT", items:[{ id:"instagram", label:"Instagram" }, { id:"tiktok", label:"TikTok" }, { id:"youtube", label:"YouTube" }, { id:"tracker", label:"Content Tracker" }, { id:"taskboard", label:"Task Board" }]},
  { section:"BUSINESS", items:[{ id:"sales", label:"Ad ROI Hub" }, { id:"chat", label:"Team Broadcast" }]},
  { section:"OPERATIONS", items:[{ id:"references", label:"References" }, { id:"skills", label:"Skills" }, { id:"sops", label:"SOPs" }, { id:"apps", label:"Apps" }]},
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
export const PILLARS_LIST = ["Abundance", "Access", "Innovation", "Tierra Bomba", "Startup Diaries", "Product Launch", "Meet the Makers"];
export const PLATFORMS_LIST = ["IG", "TT", "X", "TH", "LI", "YT", "RD", "EM"];
export const CAMPAIGNS = ["Drip Campaign", "Meet the Makers", "Product Launch"];
