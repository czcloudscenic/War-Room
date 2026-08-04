// ── Activation model (Phase A, v3 spec §3.A) ─────────────────────────────────
// The dashboard's biggest lie was zeros presented as KPIs. This module computes
// an honest per-client activation checklist from REAL configuration states only
// — no fabricated metrics, ever. When the book is under-configured, the
// Dashboard renders ActivationBoard (which consumes this) instead of KPI tiles.
//
// Pure functions: no I/O, no React. Callers inject the datasets (clients +
// content from App state; connected_accounts / client_users / skill_briefs via
// useActivationData in ActivationBoard.jsx). setupScore() in ClientsRoute now
// delegates here so the Clients grid and the Dashboard can never disagree.

import { factsFilled } from '../ui/settings/FactsAndReports.jsx';

const DONE_STATUSES = ['Posted', 'Scrapped'];

// Check definitions, in display order. Each returns true when the check PASSES.
// `nav` is the activeNav id where the fix lives (there is no router — the
// ActivationBoard "fix" buttons call setActiveNav with this id).
// `critical` checks gate client-facing work; they rank first in next actions.
const CLIENT_CHECKS = [
  {
    key: 'contact',
    label: 'Primary contact email',
    fix: 'Add a primary email in the client editor',
    nav: 'clients',
    critical: true,
    ok: ({ client }) => Boolean(client.primary_email),
  },
  {
    key: 'brand_voice',
    label: 'Brand voice on file',
    fix: 'Paste the brand voice doc in the client editor',
    nav: 'clients',
    critical: false,
    ok: ({ client }) => Boolean(client.brand_voice_md && client.brand_voice_md.trim().length > 20),
  },
  {
    key: 'facts',
    label: 'Facts of Record',
    fix: 'Fill hours / prices / offers in Setup §5 — no facts, QC runs typo-only',
    nav: 'setup',
    critical: true,
    ok: ({ client }) => factsFilled(client),
  },
  {
    key: 'retainer',
    label: 'Retainer set',
    fix: 'Enter the retainer amount in Setup §1',
    nav: 'setup',
    critical: false,
    // Brief/project clients have no retainer by design — the check passes for them.
    ok: ({ client }) => client.lane === 'brief' || Number(client.retainer_amount) > 0,
  },
  {
    key: 'cadence',
    label: 'Posting cadence set',
    fix: 'Set posts/week in Setup — runway math is blind without it',
    nav: 'setup',
    critical: false,
    ok: ({ client }) => Number(client.posts_per_week) > 0 || Boolean(client.cadence),
  },
  {
    key: 'approval_mode',
    label: 'Approval mode confirmed',
    fix: 'Client-mode approvals need an approved portal user (Clients → Team panel)',
    nav: 'clients',
    critical: true,
    // approval_rule defaults to 'internal' in the DB, so "set" is always true;
    // the honest derivable failure is client-mode with nobody able to approve.
    ok: ({ client, clientUsers }) =>
      client.approval_rule !== 'client' ||
      (clientUsers || []).some(u => u.client_id === client.id && u.status === 'approved'),
  },
  {
    key: 'integrations',
    label: 'Social account connected',
    fix: 'Connect + assign an account in Setup §2',
    nav: 'setup',
    critical: false,
    ok: ({ client, accounts }) => (accounts || []).some(a => a.client_id === client.id),
  },
  {
    key: 'report_recipients',
    label: 'Report recipients',
    fix: 'Set who receives monthly reports in Setup §6',
    nav: 'setup',
    critical: false,
    // Only meaningful for recurring clients with reporting turned on.
    ok: ({ client }) =>
      client.lane === 'brief' ||
      !client.report_schedule ||
      (Array.isArray(client.report_recipients) && client.report_recipients.length > 0) ||
      Boolean(client.primary_email),
  },
  {
    key: 'owner',
    label: 'Account owner assigned',
    fix: 'Assign an account owner in Setup §1',
    nav: 'setup',
    critical: true,
    ok: ({ client }) => Boolean(client.owner_team_member_id),
  },
  {
    key: 'content',
    label: 'Content flowing',
    fix: 'Add the first deliverable in Pipeline (or drop a brief in Apps → Brief)',
    nav: 'content',
    critical: false,
    ok: ({ items }) => (items || []).length > 0,
  },
  {
    key: 'hygiene',
    label: 'Owners + due dates on open work',
    fix: 'Bulk-assign owners and due dates in Setup §3',
    nav: 'setup',
    critical: false,
    // Vacuously true with no open items — "content" above covers the empty case.
    ok: ({ items }) => {
      const open = (items || []).filter(x => !DONE_STATUSES.includes(x.status));
      return open.every(x => x.assigned_to && x.due_date);
    },
  },
];

/**
 * Per-client checklist.
 *   client      : clients row
 *   items       : this client's content_items
 *   accounts    : connected_accounts rows (all clients — filtered per check)
 *   clientUsers : client_users rows (all clients)
 * Returns { checks: [{key,label,fix,nav,critical,ok}], done, total, score }.
 */
export function clientActivation(client, items, { accounts, clientUsers } = {}) {
  const ctx = { client, items, accounts, clientUsers };
  const checks = CLIENT_CHECKS.map(c => ({
    key: c.key, label: c.label, fix: c.fix, nav: c.nav, critical: c.critical,
    ok: !!c.ok(ctx),
  }));
  const done = checks.filter(c => c.ok).length;
  return {
    checks,
    done,
    total: checks.length,
    score: Math.round((done / checks.length) * 100),
  };
}

/**
 * Workspace setup % for the Clients grid — the one implementation.
 * Honors a manually-set clients.onboarding_progress override, else derives from
 * the real checklist. (Replaces the old ad-hoc weights in ClientsRoute.)
 */
export function setupScore(client, items, deps = {}) {
  if (typeof client.onboarding_progress === 'number') {
    return Math.max(0, Math.min(100, Math.round(client.onboarding_progress)));
  }
  return clientActivation(client, items, deps).score;
}

/**
 * Book-level activation.
 *   clients : active clients
 *   content : ALL content_items (bounded blob from App state)
 *   deps    : { accounts, clientUsers, skillBriefs, agentNames }
 * Returns:
 *   score       : 0–100 across the whole book (client checks + agent briefs)
 *   perClient   : [{ client, activation }] sorted least-activated first
 *   agentsMissingBriefs : agent names with zero skill_briefs rows
 *   activated   : no critical check failing anywhere AND score >= 80
 *   nextActions : top 5 [{ label, detail, nav, critical }]
 */
export function bookActivation(clients, content, deps = {}) {
  const { accounts, clientUsers, skillBriefs, agentNames } = deps;
  const active = (clients || []).filter(c => c.status === 'active');

  const perClient = active.map(client => {
    const items = (content || []).filter(x => x.client_id === client.id);
    return { client, activation: clientActivation(client, items, { accounts, clientUsers }) };
  }).sort((a, b) => a.activation.score - b.activation.score);

  // Agent check: every roster agent should have at least one skill brief.
  // A brief deployed to 'All Agents' covers the whole roster.
  const briefedAgents = new Set((skillBriefs || []).map(b => b.agent_name));
  const agentsMissingBriefs = briefedAgents.has('All Agents')
    ? []
    : (agentNames || []).filter(n => !briefedAgents.has(n));

  const clientChecksTotal = perClient.reduce((s, p) => s + p.activation.total, 0);
  const clientChecksDone = perClient.reduce((s, p) => s + p.activation.done, 0);
  const agentTotal = (agentNames || []).length;
  const agentDone = agentTotal - agentsMissingBriefs.length;
  const total = clientChecksTotal + agentTotal;
  const done = clientChecksDone + agentDone;
  const score = total > 0 ? Math.round((done / total) * 100) : 0;

  const criticalOpen = perClient.some(p => p.activation.checks.some(c => c.critical && !c.ok));

  // Next actions: every unmet check across the book, critical first, then by
  // how far behind the client is; agents-without-briefs slots in after criticals.
  const actions = [];
  for (const { client, activation } of perClient) {
    for (const check of activation.checks) {
      if (check.ok) continue;
      actions.push({
        label: `${client.name}: ${check.label}`,
        detail: check.fix,
        nav: check.nav,
        critical: check.critical,
        _score: activation.score,
      });
    }
  }
  if (agentsMissingBriefs.length > 0) {
    actions.push({
      label: `Deploy skill briefs: ${agentsMissingBriefs.join(', ')}`,
      detail: 'Add each agent\'s brief in Apps → Skills so assignments route on real capability',
      nav: 'skills',
      critical: true,
      _score: 0,
    });
  }
  actions.sort((a, b) => (b.critical - a.critical) || (a._score - b._score));

  return {
    score,
    perClient,
    agentsMissingBriefs,
    activated: !criticalOpen && score >= 80,
    nextActions: actions.slice(0, 5).map(({ _score, ...a }) => a),
    openActionCount: actions.length,
  };
}
