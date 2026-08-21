// ── Constants ──

// Grouped nav (8/20): top-level groups collapse/expand in the sidebar.
// Clicking a group reveals its pages; the group holding the active page auto-opens.
export const NAV = [
  { id:"g-command", label:"Command", items:[
    { id:"dashboard", label:"Dashboard" },
    { id:"approvals", label:"Approvals" },
    { id:"decisions", label:"Decisions" },
  ]},
  { id:"g-clients", label:"Clients", items:[
    { id:"clients", label:"Clients" },
    { id:"setup", label:"Setup" },
  ]},
  { id:"g-work", label:"Work", items:[
    { id:"operations", label:"Operations" },
    { id:"ledger", label:"Ledger" },
    { id:"reports", label:"Reports" },
  ]},
  { id:"g-content", label:"Content", items:[
    { id:"ideas", label:"Idea Engine" },
    { id:"content", label:"Pipeline" },
    { id:"runway", label:"Content Runway" },
  ]},
  { id:"g-growth", label:"Growth", items:[
    { id:"clientanalytics", label:"Client Analytics" },
  ]},
  { id:"g-intel", label:"Intelligence", items:[
    { id:"contentintel", label:"Content Intel" },
  ]},
  { id:"g-workforce", label:"Workforce", items:[
    { id:"agents", label:"Agents" },
    { id:"ship", label:"Agent Ship" },
    { id:"dynasty", label:"Software OPS", adminOnly:true },
  ]},
  { id:"g-admin", label:"Admin", items:[
    { id:"billing", label:"Billing" },
    { id:"vault", label:"Vault" },
    { id:"apps", label:"Apps" },
    { id:"settings", label:"Settings" },
  ]},
];
// Group containing a page id (apps' dynamic sub-pages resolve to g-admin).
export const navGroupOf = (pageId) =>
  (NAV.find(g => g.items.some(i => i.id === pageId)) || { id: "g-admin" }).id;

// Bell + digest rendering per notification type. Anything not listed falls back
// to a neutral label. `role` buckets the type for the per-role digest filter
// (Phase A): founder = client relationship moments, ops = pipeline mechanics,
// finance = money. One map, two renderings (bell panel + NotificationDigest).
export const NOTIF_META = {
  approved:             { label: "Approved",            color: "#2AABFF", role: "founder" },
  revision_requested:   { label: "Revisions requested", color: "#ff453a", role: "founder" },
  approval_requested:   { label: "Sent for approval",   color: "#bf5af2", role: "ops" },
  revision_cap_reached: { label: "Revision cap reached", color: "#E5E5EA", role: "founder" },
  item_stuck:           { label: "Item stuck",          color: "#E5E5EA", role: "ops" },
  task_overdue:         { label: "Task overdue",        color: "#E5E5EA", role: "ops" },
  intake_received:      { label: "New intake request",  color: "#30d158", role: "ops" },
  client_comment:       { label: "Client comment",      color: "#64d2ff", role: "founder" },
  invoice_sent:         { label: "Invoice sent",        color: "#30d158", role: "finance" },
  client_invite_first_login: { label: "Client signed in", color: "#bf5af2", role: "founder" },
  publish_unverified:   { label: "Publish unverified",  color: "#ff453a", role: "ops" },
  // send-monthly-reports has emitted these since 7/2; they previously rendered
  // via the fallback — now first-class.
  report_sent:          { label: "Report sent",         color: "#30d158", role: "founder" },
  report_missing:       { label: "Report missing",      color: "#E5E5EA", role: "ops" },
};
export const notifMeta = (type) => NOTIF_META[type] || { label: String(type || "Update").replace(/_/g, " "), color: "rgba(255,255,255,0.5)", role: "ops" };

export const STATUS_COLOR = {
  "Ready For Copy Creation":    "#E5E5EA",
  "Need Copy Approval":         "#3b82f6",
  "Ready For Content Creation": "#10b981",
  "Need Content Approval":      "#ff453a",
  "Needs Revisions":            "#ff375f",
  "Approved":                   "#2AABFF",
  "Ready For Schedule":         "#8b5cf6",
  "Scheduled":                  "#64d2ff",
  "Posted":                     "#30d158",
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
  "Posted":                     "Posted",
};

// "Posted" is a terminal runtime status set by markPosted (core/approvals.js);
// listing it here makes it selectable in the edit modal and keeps status filters honest.
export const STATUSES = ["Ready For Copy Creation", "Need Copy Approval", "Ready For Content Creation", "Need Content Approval", "Needs Revisions", "Approved", "Ready For Schedule", "Scheduled", "Posted", "Scrapped"];
export const FORMATS = ["Reel", "Graphics (IMG)", "Carousel", "Thread", "Story", "YouTube", "Short"];

// Pillars + campaigns are per-client. These are placeholder defaults shown only when
// no client is selected or the client hasn't configured their own. Per-client values
// come from clients.brand_voice_md (parsed) and clients.campaigns (future column).
export const PILLARS_LIST = ["Pillar 1", "Pillar 2", "Pillar 3", "Pillar 4", "Pillar 5"];
export const PLATFORMS_LIST = ["IG", "TT", "X", "TH", "LI", "YT", "RD", "EM"];
export const CAMPAIGNS = [];
