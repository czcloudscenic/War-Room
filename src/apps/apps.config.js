// ── Apps Configuration ──
// Default app definitions. Apps are optional modules that can be toggled on/off.
// Base pages (Dashboard, Agents, Pipelines, etc.) are always visible.

export const DEFAULT_APPS = [
  { id: "artgrid",    label: "ArtGrid Scout",      desc: "AI footage briefs + Artgrid.io search queries",      enabled: true  },
  { id: "sales",      label: "Ad ROI Hub",          desc: "Campaign spend tracking, ROAS, and ROI analysis",    enabled: true  },
  { id: "chat",       label: "Team Broadcast",      desc: "Send briefs and updates to all 8 agents at once",    enabled: true  },
  { id: "references", label: "References",          desc: "Store hooks, captions, CTAs, and brand voice docs",  enabled: true  },
  { id: "skills",     label: "Skills",              desc: "Deploy skill briefs and directives to agents",        enabled: true  },
  { id: "sops",       label: "SOPs",                desc: "7-step content production standard operating procedures", enabled: true },
  { id: "scrappy",    label: "Scraping Ops",        desc: "Live trend scraping from TikTok, IG, Reddit",        enabled: false },
  { id: "analytics",  label: "Analytics",           desc: "Pipeline heatmaps and performance breakdowns",       enabled: false },
  { id: "costs",      label: "Cost Governance",     desc: "API spend tracking and agent budget controls",       enabled: false },
  { id: "automation", label: "Automation Center",   desc: "Scheduled agent workflows and n8n triggers",         enabled: false },
];

export const APPS_STORAGE_KEY = 'vantus_apps';

export const loadApps = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(APPS_STORAGE_KEY));
    if (!saved || !saved.length) return DEFAULT_APPS;
    // Merge saved enabled state with defaults (picks up new fields like section)
    return DEFAULT_APPS.map(def => {
      const s = saved.find(a => a.id === def.id);
      return { ...def, enabled: s ? s.enabled : def.enabled };
    });
  } catch { return DEFAULT_APPS; }
};

export const saveApps = (apps) => {
  localStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
};

export const isAppEnabled = (apps, id) => {
  const app = apps.find(a => a.id === id);
  return !app || app.enabled;
};
