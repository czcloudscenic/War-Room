// Login-free route sweep (dev only): mounts every AppRoutes destination with
// empty data and reports any render crash. Catches what a build cannot: an
// identifier that moved files and is undefined at render time.
//   npm run dev  →  http://localhost:5173/tests/routes-sweep.html
// Result lands in window.__sweep and on the page. Empty data means the routes
// show their empty states; it proves mounting, not behaviour.
import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRoutes from '../src/ui/AppRoutes.jsx';
import { AGENTS_BASE } from '../src/data/seed.agents.js';

// Every nav id AppRoutes mounts, except 'ship' (frozen, has its own harness),
// 'clientworkspace' (needs a client row) and 'dynasty' (admin gated + live API).
const NAVS = ['dashboard', 'approvals', 'decisions', 'contentintel', 'clients', 'setup', 'ledger', 'reports', 'leads', 'calendar', 'runway', 'operations', 'clientanalytics', 'scope', 'profitability', 'billing', 'vault',
  'agents', 'content', 'ideas', 'broadcast', 'skills', 'apps', 'settings', 'scrappy', 'automation'];
const noop = () => {};
const base = { agents: AGENTS_BASE,   // the app always passes the built-in roster, never an empty list
  aiEnabled: false, clientContent: [], clients: [], content: [], currentClient: null, isMobile: false, isOpsAdmin: false, liveCount: 0, role: 'admin', selectedAgent: null, switchClient: noop, teamMembers: [], userEmail: 'sweep@cloudscenic.com', userId: 'sweep', workspaceClientId: null,
  setActiveNav: noop, setAddClientOpen: noop, setEditingClient: noop, setEditingItem: noop, setIsNewItem: noop, setSelectedAgent: noop, setWorkspaceClientId: noop,
  activePlatform: 'instagram', apps: [], handleAddNew: noop, handleIgIdeas: noop, handleMuseWrite: noop, igIdeasLoading: false, igItems: [], setActivePlatform: noop, toggleApp: noop, ttItems: [], ytItems: [] };

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { e: null }; }
  static getDerivedStateFromError(e) { return { e }; }
  componentDidCatch(e) { this.props.onErr(e); }
  render() { return this.state.e ? null : this.props.children; }
}

const results = {};
const host = document.getElementById('host');
for (const nav of NAVS) {
  const el = document.createElement('div'); host.appendChild(el);
  let err = null;
  const root = createRoot(el);
  root.render(<Boundary onErr={(e) => { err = e; }}><React.Suspense fallback="loading"><AppRoutes {...base} activeNav={nav} /></React.Suspense></Boundary>);
  await new Promise(r => setTimeout(r, 1500));
  const text = el.innerText.replace(/\s+/g, ' ').trim();
  results[nav] = err ? `ERROR: ${String(err.message || err).slice(0, 200)}` : text === 'loading' ? 'STILL LOADING' : text ? `ok (${text.slice(0, 50)})` : 'EMPTY (no mount for this nav id)';
  root.unmount(); el.remove();
}
window.__sweep = results;
document.getElementById('out').textContent = Object.entries(results).map(([k, v]) => `${k.padEnd(14)} ${v}`).join('\n');
