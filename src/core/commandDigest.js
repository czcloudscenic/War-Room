// ── Founder daily command digest (Phase A, v3 spec §3.A) ─────────────────────
// Tiers everything that needs attention across the book into the founder's
// priority order: critical / requires-founder / due today / blocked / at risk.
// (Routine = the cross-client agent feed, rendered separately by AllActivityFeed
// from agent_events — receipts, not summaries.)
//
// Pure function: caller injects every dataset + `now` so the cron, the UI, and
// tests would all agree. Every entry carries a nav id (there is no router) so
// CommandView can deep-link the fix.

import { clientRunway } from '../utils/runway.mjs';

const DAY_MS = 86400000;
const GATE_STATUSES = ['Need Copy Approval', 'Need Content Approval'];
const STUCK_AFTER_DAYS = 3;

const isToday = (dateStr, now) => {
  if (!dateStr) return false;
  return dateStr === new Date(now).toISOString().slice(0, 10);
};

/**
 * Build the tiered digest.
 *   clients, content : App state (content is the bounded cross-client blob)
 *   tasks            : open tasks rows (status != done)
 *   invoices         : invoices rows
 *   pendingUsers     : client_users rows with status='pending'
 *   now              : ms timestamp
 * Returns { critical, founder, dueToday, blocked, atRisk } — arrays of
 * { label, detail, nav, clientName }.
 */
export function commandDigest({ clients = [], content = [], tasks = [], invoices = [], pendingUsers = [], now = Date.now() } = {}) {
  const critical = [], founder = [], dueToday = [], blocked = [], atRisk = [];
  const nameOf = (id) => (clients.find(c => c.id === id)?.name) || '—';

  // Per-client signals
  for (const c of clients) {
    if (c.status !== 'active') continue;
    const items = content.filter(x => x.client_id === c.id);

    // Runway (only when tracking is on — no fabricated signals)
    if (c.content_tracking_enabled) {
      const snap = clientRunway(c, items, { now });
      if (snap.severity === 'critical' || snap.severity === 'empty') {
        critical.push({
          label: `${c.name}: content runway ${snap.severity}`,
          detail: snap.runwayDays != null ? `${Math.max(0, Math.round(snap.runwayDays))} days of content left — book a shoot or approve ready work` : 'posting has stalled — no inventory signal',
          nav: 'runway', clientName: c.name,
        });
      } else if (snap.severity === 'warning') {
        atRisk.push({
          label: `${c.name}: runway inside shoot lead time`,
          detail: `~${Math.round(snap.runwayDays)}d left, book by ${snap.bookBy}`,
          nav: 'runway', clientName: c.name,
        });
      }
    }

    if (c.health && c.health !== 'green') {
      atRisk.push({
        label: `${c.name}: health marked ${c.health}`,
        detail: 'Set on the client record — check the relationship, not just the pipeline',
        nav: 'clients', clientName: c.name,
      });
    }
  }

  // Per-item signals
  for (const item of content) {
    const clientName = nameOf(item.client_id);
    const client = clients.find(c => c.id === item.client_id);

    if (item.qc_status === 'blocked' && !['Posted', 'Scrapped'].includes(item.status)) {
      critical.push({
        label: `${clientName}: "${item.title || 'Untitled'}" QC-blocked`,
        detail: 'Factual issue — fix the deliverable or the Facts of Record, never approve over it',
        nav: 'approvals', clientName,
      });
    }

    const cap = client?.included_revisions != null ? Number(client.included_revisions) : null;
    if (cap != null && Number(item.revision_count) >= cap && !['Posted', 'Scrapped', 'Approved'].includes(item.status)) {
      critical.push({
        label: `${clientName}: "${item.title || 'Untitled'}" at revision cap (${item.revision_count}/${cap})`,
        detail: 'Next kickback is out-of-scope work — decide: absorb knowingly or price it',
        nav: 'approvals', clientName,
      });
    }

    if (GATE_STATUSES.includes(item.status) && item.approval_mode !== 'client') {
      founder.push({
        label: `${clientName}: "${item.title || 'Untitled'}" awaits internal approval`,
        detail: 'Sitting at a gate only the team can clear',
        nav: 'approvals', clientName,
      });
    }

    if (isToday(item.due_date, now) && !['Posted', 'Scrapped'].includes(item.status)) {
      dueToday.push({
        label: `${clientName}: "${item.title || 'Untitled'}" due today`,
        detail: item.status,
        nav: 'ledger', clientName,
      });
    }

    const age = item.updated_at ? (now - Date.parse(item.updated_at)) / DAY_MS : 0;
    if ((item.status === 'Needs Revisions' || GATE_STATUSES.includes(item.status)) && age >= STUCK_AFTER_DAYS) {
      blocked.push({
        label: `${clientName}: "${item.title || 'Untitled'}" stuck ${Math.floor(age)}d in ${item.status}`,
        detail: item.approval_mode === 'client' && GATE_STATUSES.includes(item.status) ? 'In the client\'s court — chase it' : 'Internal — unstick it',
        nav: GATE_STATUSES.includes(item.status) ? 'approvals' : 'content', clientName,
      });
    }

    if (!isToday(item.due_date, now) && item.due_date && !['Posted', 'Scrapped'].includes(item.status)) {
      const days = (Date.parse(item.due_date) - now) / DAY_MS;
      if (days > 0 && days < 2 && !item.assigned_to) {
        atRisk.push({
          label: `${clientName}: "${item.title || 'Untitled'}" due in <48h with no owner`,
          detail: 'Assign it in Setup §3 before it slips',
          nav: 'setup', clientName,
        });
      }
    }
  }

  // Tasks
  for (const t of tasks) {
    if (t.status === 'done') continue;
    const clientName = t.client_id ? nameOf(t.client_id) : 'Internal';
    if (isToday(t.due_date, now)) {
      dueToday.push({ label: `${clientName}: task "${t.title}" due today`, detail: t.priority || 'medium', nav: 'operations', clientName });
    } else if (t.due_date && Date.parse(t.due_date) < now) {
      blocked.push({ label: `${clientName}: task "${t.title}" overdue`, detail: `was due ${t.due_date}`, nav: 'operations', clientName });
    }
    if (t.status === 'review') {
      founder.push({ label: `${clientName}: task "${t.title}" waiting in review`, detail: 'Needs a decision to move', nav: 'operations', clientName });
    }
  }

  // Invoices
  for (const inv of invoices) {
    const overdue = inv.status === 'overdue' || (inv.status === 'sent' && inv.due_date && Date.parse(inv.due_date) < now);
    if (overdue) {
      critical.push({
        label: `${nameOf(inv.client_id)}: invoice ${inv.number || inv.id.slice(0, 8)} overdue`,
        detail: `$${Number(inv.amount).toLocaleString()} — chase payment`,
        nav: 'billing', clientName: nameOf(inv.client_id),
      });
    }
  }

  // Pending portal users → founder decision
  for (const u of pendingUsers) {
    founder.push({
      label: `${nameOf(u.client_id)}: ${u.email} awaits portal approval`,
      detail: 'Approve or reject in Clients → Team panel',
      nav: 'clients', clientName: nameOf(u.client_id),
    });
  }

  return { critical, founder, dueToday, blocked, atRisk };
}
