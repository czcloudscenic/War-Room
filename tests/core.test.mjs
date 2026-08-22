// Smoke tests for the pure core modules — no framework, no DB, no browser.
// Run: node tests/core.test.mjs   (exits non-zero on any failure)
// These cover the math that guards the business: health factors, bottlenecks,
// freshness gating, and the command digest tiers.

import { clientHealth, bottlenecks, approvalDelayFactor, paymentFactor, worstLevel, rightsState } from '../src/core/clientHealth.js';
import { freshnessState, factsFreshness, truthGates } from '../src/core/truth.js';
import { commandDigest } from '../src/core/commandDigest.js';

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('FAIL:', name); } };
const NOW = new Date('2026-08-22T12:00:00Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

/* ── truth.js ── */
t('freshness: never reviewed = stale', freshnessState({ lastReviewedAt: null }, NOW) === 'stale');
t('freshness: reviewed yesterday = fresh', freshnessState({ lastReviewedAt: daysAgo(1), reviewFrequencyDays: 30 }, NOW) === 'fresh');
t('freshness: past frequency = stale', freshnessState({ lastReviewedAt: daysAgo(45), reviewFrequencyDays: 30 }, NOW) === 'stale');
t('freshness: 25/30 days = due', freshnessState({ lastReviewedAt: daysAgo(25), reviewFrequencyDays: 30 }, NOW) === 'due');
t('factsFreshness reads facts_last_reviewed_at', factsFreshness({ facts_last_reviewed_at: daysAgo(2), facts_review_frequency_days: 30 }, NOW).state === 'fresh');
{
  const gates = truthGates({ status: 'Scheduled', client: { facts_last_reviewed_at: null } }, NOW);
  t('truthGates: stale facts HARD-block scheduling', gates.some(g => g.hard && !g.ok));
  t('truthGates: non-client-facing status has no gates', truthGates({ status: 'Needs Revisions', client: {} }, NOW).length === 0);
  const fresh = truthGates({ status: 'Scheduled', approvalMode: 'internal', approvedVersionId: null, client: { facts_last_reviewed_at: daysAgo(1), facts_review_frequency_days: 30 } }, NOW);
  t('truthGates: missing lineage warns but does not hard-block', fresh.some(g => !g.ok && !g.hard) && !fresh.some(g => g.hard && !g.ok));
}

/* ── clientHealth.js factors ── */
const client = { id: 'c1', status: 'active', retainer_status: 'active', facts_last_reviewed_at: daysAgo(3), facts_review_frequency_days: 30, posts_per_week: 3 };
t('approval delay: empty = ok', approvalDelayFactor([], NOW).level === 'ok');
t('approval delay: 8d at gate = bad', approvalDelayFactor([{ status: 'Need Content Approval', updated_at: daysAgo(8) }], NOW).level === 'bad');
t('approval delay: 4d at gate = warn', approvalDelayFactor([{ status: 'Need Copy Approval', updated_at: daysAgo(4) }], NOW).level === 'warn');
t('payment: overdue 20d = bad', paymentFactor({ id: 'c1' }, [{ client_id: 'c1', status: 'sent', due_date: daysAgo(20) }], NOW).level === 'bad');
t('payment: current = ok', paymentFactor(client, [], NOW).level === 'ok');
t('worstLevel picks bad', worstLevel([{ level: 'ok' }, { level: 'bad' }, { level: 'warn' }]) === 'bad');

const health = clientHealth(client, [
  { client_id: 'c1', status: 'Need Content Approval', updated_at: daysAgo(8) },
  { client_id: 'c1', status: 'Posted', posted_at: daysAgo(1), updated_at: daysAgo(1) },
  { client_id: 'other', status: 'Need Content Approval', updated_at: daysAgo(30) },
], [], NOW);
t('clientHealth filters to the client (2 items, not 3)', health.itemCount === 2);
t('clientHealth: 8d gate item drives level bad', health.level === 'bad');
t('clientHealth: 6 named factors', health.factors.length === 6 && health.factors.every(f => f.key && f.label && f.level && f.detail));

/* ── bottlenecks ── */
const bn = bottlenecks({
  clients: [
    { id: 'a', status: 'active', owner_team_member_id: 'm1', facts_last_reviewed_at: daysAgo(1), facts_review_frequency_days: 30 },
    { id: 'b', status: 'active', owner_team_member_id: 'm1', facts_last_reviewed_at: null },
    { id: 'c', status: 'active', owner_team_member_id: null, facts_last_reviewed_at: daysAgo(2), facts_review_frequency_days: 30 },
  ],
  content: [
    { client_id: 'a', status: 'Need Content Approval', approval_mode: 'internal', updated_at: daysAgo(5) },
    { client_id: 'b', status: 'Need Copy Approval', approval_mode: 'client', updated_at: daysAgo(9) },
  ],
  team: [{ id: 'm1', name: 'Alex' }],
  now: NOW,
});
t('bottlenecks: client-mode items excluded from internal queue', bn.waitingInternal.length === 1 && bn.waitingInternal[0].ageDays === 5);
t('bottlenecks: never-reviewed facts flagged', bn.factsGaps.some(g => g.client.id === 'b'));
t('bottlenecks: unowned client flagged', bn.unowned.length === 1 && bn.unowned[0].id === 'c');
t('bottlenecks: single-owner concentration (2 of 3 = 66%)', bn.concentrated.length === 1 && bn.concentrated[0].count === 2);

/* ── commandDigest smoke ── */
const digest = commandDigest({
  clients: [client],
  content: [{ client_id: 'c1', status: 'Need Content Approval', approval_mode: 'internal', updated_at: daysAgo(2), due_date: daysAgo(0) }],
  tasks: [], invoices: [], pendingUsers: [], now: NOW,
});
t('commandDigest returns tiers object', digest && typeof digest === 'object');

/* ── rights clock (Phase E.3) ── */
{
  const r = (exp, lead) => rightsState({ expires_on: exp, lead_days: lead }, NOW);
  t('rights: expired yesterday', r(daysAgo(1), 30).state === 'expired');
  t('rights: 10d left inside 30d lead = due', r(new Date(NOW + 10 * 86400000).toISOString().slice(0, 10), 30).state === 'due');
  t('rights: 90d left outside lead = ok', r(new Date(NOW + 90 * 86400000).toISOString().slice(0, 10), 30).state === 'ok');
  t('rights: daysLeft math', r(new Date(NOW + 10 * 86400000).toISOString().slice(0, 10), 30).daysLeft <= 10);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
