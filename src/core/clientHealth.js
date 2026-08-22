// ── Client health factors (Phase C, v3 spec §3.C.1) ──────────────────────────
// EXPLAINABLE FACTORS ONLY — the spec bans black-box scores. Each factor is a
// named, citable observation computed from real rows: approval delay, publish
// failures, runway, stale facts, payment status, relationship inactivity.
// A client's "health" is the worst factor level plus the full factor list —
// never a single opaque number.
//
// Pure module: takes data in, returns judgments out. No fetching, no state.

import { clientRunway, CRITICAL_DAYS } from '../utils/runway.mjs';
import { factsFreshness } from './truth.js';

export const GATE_STATUSES = ['Need Copy Approval', 'Need Content Approval'];

const DAY = 86400000;
const days = (from, now) => Math.floor((now - new Date(from).getTime()) / DAY);

// Factor levels: 'ok' | 'warn' | 'bad'. worst() picks the client's headline.
const LEVEL_RANK = { ok: 0, warn: 1, bad: 2 };
export const worstLevel = (factors) =>
  factors.reduce((w, f) => (LEVEL_RANK[f.level] > LEVEL_RANK[w] ? f.level : w), 'ok');

// ── The six factors ──────────────────────────────────────────────────────────

export function approvalDelayFactor(items, now = Date.now()) {
  const waiting = items.filter(i => GATE_STATUSES.includes(i.status));
  if (!waiting.length) return { key: 'approval_delay', label: 'Approvals', level: 'ok', detail: 'nothing waiting at a gate' };
  const ages = waiting.map(i => days(i.updated_at || i.created_at || new Date(now).toISOString(), now));
  const worst = Math.max(...ages, 0);
  const level = worst >= 7 ? 'bad' : worst >= 3 ? 'warn' : 'ok';
  return { key: 'approval_delay', label: 'Approvals', level, detail: `${waiting.length} at a gate, oldest ${worst}d` };
}

export function publishFailureFactor(items) {
  // "publish failure" = the verify-publishes cron flagged it: past publish
  // date, no receipt (verification_status 'awaiting').
  const flagged = items.filter(i => i.verification_status === 'awaiting');
  if (!flagged.length) return { key: 'publish_failures', label: 'Publishing', level: 'ok', detail: 'no unverified publishes' };
  return { key: 'publish_failures', label: 'Publishing', level: flagged.length > 1 ? 'bad' : 'warn', detail: `${flagged.length} past-due with no receipt` };
}

export function runwayFactor(client, items, now = Date.now()) {
  // runway.mjs already grades severity — reuse its judgment, don't re-derive.
  const r = clientRunway(client, items, { now });
  if (!r?.configured) return { key: 'runway', label: 'Runway', level: 'ok', detail: 'no burn measured yet' };
  const level = r.severity === 'empty' || r.severity === 'critical' ? 'bad' : r.severity === 'warning' ? 'warn' : 'ok';
  const detail = r.mode === 'drought'
    ? `posting stalled ${r.drought?.daysSincePost ?? '?'}d`
    : `${r.runwayDays != null ? Math.floor(r.runwayDays) : '?'}d of runway (${r.mode})`;
  return { key: 'runway', label: 'Runway', level, detail };
}

export function staleFactsFactor(client, now = Date.now()) {
  const f = factsFreshness(client, now);
  if (f.state === 'stale') return { key: 'stale_facts', label: 'Facts', level: 'bad', detail: f.days != null ? `stale — last reviewed ${f.days}d ago` : 'never reviewed' };
  if (f.state === 'due') return { key: 'stale_facts', label: 'Facts', level: 'warn', detail: 'review due' };
  return { key: 'stale_facts', label: 'Facts', level: 'ok', detail: f.days != null ? `reviewed ${f.days}d ago` : 'fresh' };
}

export function paymentFactor(client, invoices, now = Date.now()) {
  const mine = invoices.filter(v => v.client_id === client.id);
  const overdue = mine.filter(v => v.status === 'sent' && v.due_date && new Date(v.due_date).getTime() < now);
  if (overdue.length) {
    const worst = Math.max(...overdue.map(v => days(v.due_date, now)));
    return { key: 'payment', label: 'Payment', level: worst >= 14 ? 'bad' : 'warn', detail: `${overdue.length} overdue, oldest ${worst}d` };
  }
  if (client.retainer_status && client.retainer_status !== 'active') {
    return { key: 'payment', label: 'Payment', level: 'warn', detail: `retainer ${client.retainer_status}` };
  }
  return { key: 'payment', label: 'Payment', level: 'ok', detail: 'current' };
}

export function inactivityFactor(items, now = Date.now()) {
  // Relationship pulse: days since ANY content movement for this client.
  const stamps = items.map(i => i.updated_at || i.posted_at || i.created_at).filter(Boolean);
  if (!stamps.length) return { key: 'inactivity', label: 'Activity', level: 'warn', detail: 'no content on record' };
  const last = Math.max(...stamps.map(s => new Date(s).getTime()));
  const idle = Math.floor((now - last) / DAY);
  const level = idle >= 21 ? 'bad' : idle >= 10 ? 'warn' : 'ok';
  return { key: 'inactivity', label: 'Activity', level, detail: idle === 0 ? 'moved today' : `last movement ${idle}d ago` };
}

// ── Composition ──────────────────────────────────────────────────────────────

// clientHealth(client, allContent, invoices) -> { level, factors[] }
// allContent may be the whole book; it filters by client_id itself.
export function clientHealth(client, allContent = [], invoices = [], now = Date.now()) {
  const items = allContent.filter(i => i.client_id === client.id);
  const factors = [
    approvalDelayFactor(items, now),
    publishFailureFactor(items),
    runwayFactor(client, items, now),
    staleFactsFactor(client, now),
    paymentFactor(client, invoices, now),
    inactivityFactor(items, now),
  ];
  return { level: worstLevel(factors), factors, itemCount: items.length };
}

// ── Founder bottleneck panel (Phase C, v3 spec §3.C.2) ───────────────────────
// Three honest lists: internal decisions aging at gates, clients with missing
// or stale facts, and single-owner concentration risk. Real rows only.

export function bottlenecks({ clients = [], content = [], team = [], now = Date.now() } = {}) {
  const active = clients.filter(c => c.status === 'active');

  // 1. Internal decisions waiting (gate items NOT waiting on the client)
  const waitingInternal = content
    .filter(i => GATE_STATUSES.includes(i.status) && i.approval_mode !== 'client')
    .map(i => ({ ...i, ageDays: days(i.updated_at || i.created_at || new Date(now).toISOString(), now) }))
    .sort((a, b) => b.ageDays - a.ageDays);

  // 2. Clients missing the strategy layer: facts never filled or stale
  const factsGaps = active
    .map(c => ({ client: c, facts: staleFactsFactor(c, now) }))
    .filter(x => x.facts.level !== 'ok');

  // 3. Single-owner risk: one team member owns every active client they touch
  const ownerCount = new Map();
  for (const c of active) {
    if (!c.owner_team_member_id) continue;
    ownerCount.set(c.owner_team_member_id, (ownerCount.get(c.owner_team_member_id) || 0) + 1);
  }
  const unowned = active.filter(c => !c.owner_team_member_id);
  const concentrated = [...ownerCount.entries()]
    .filter(([, n]) => active.length > 1 && n >= Math.max(2, Math.ceil(active.length * 0.6)))
    .map(([id, n]) => ({ member: team.find(t => t.id === id) || { id }, count: n }));

  return { waitingInternal, factsGaps, unowned, concentrated };
}

// ── Rights clock (Phase E.3) ─────────────────────────────────────────────────
// Pure judgment for one asset right: expired / due (inside its lead window) /
// ok. lead_days is per-right because a model release renews differently than
// a music license.
export function rightsState(right, now = Date.now()) {
  const exp = new Date(right.expires_on).getTime();
  if (Number.isNaN(exp)) return { state: 'ok', daysLeft: null };
  const daysLeft = Math.ceil((exp - now) / DAY);
  const lead = Number(right.lead_days) >= 0 ? Number(right.lead_days) : 30;
  if (daysLeft < 0) return { state: 'expired', daysLeft };
  if (daysLeft <= lead) return { state: 'due', daysLeft };
  return { state: 'ok', daysLeft };
}
