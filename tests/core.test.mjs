// Smoke tests for the pure core modules — no framework, no DB, no browser.
// Run: node tests/core.test.mjs   (exits non-zero on any failure)
// These cover the math that guards the business: health factors, bottlenecks,
// freshness gating, and the command digest tiers.

import { clientHealth, bottlenecks, approvalDelayFactor, paymentFactor, worstLevel, rightsState } from '../src/core/clientHealth.js';
import { freshnessState, factsFreshness, truthGates } from '../src/core/truth.js';
import { commandDigest } from '../src/core/commandDigest.js';
import siteAudit from '../netlify/functions/_lib/siteAudit.js';
import { scoreWarmth, WARM_MIN } from '../src/core/warmth.js';
import leadCapture from '../netlify/functions/_lib/leadCapture.js';
import { computeBars, computeIncidents, computeMorale } from '../src/core/shipStations.js';

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

/* ── siteAudit (Growth) — pure audit + template brief ── */
{
  const { audit, templateBrief, normalizeUrl } = siteAudit;
  const base = { pixels: { meta: true, ga: true }, hasLocalSchema: true, hasViewport: true, ctaLinks: ['/book'], hasTel: true, hasForm: true, socials: { instagram: 'x', facebook: 'y' }, latestCopyright: 2026, builder: 'Webflow', metaDesc: 'desc', h1Count: 1, https: true, wordCount: 400, schemaTypes: ['LocalBusiness'] };
  t('audit: a well-built site has zero gaps', audit(base).length === 0);
  const bad = { ...base, pixels: { meta: false, ga: false }, hasLocalSchema: false, hasViewport: false, ctaLinks: [], hasTel: false, hasForm: false, socials: {}, latestCopyright: 2021, builder: 'Wix', metaDesc: '', h1Count: 0, https: false, wordCount: 40, schemaTypes: [] };
  const f = audit(bad);
  t('audit: a neglected site surfaces every gap', f.length >= 11);
  t('audit: highs sort first', f[0].severity === 'high' && f[f.length - 1].severity === 'low');
  t('audit: every finding has evidence + a pitch', f.every(x => x.key && x.label && x.evidence && x.pitch));
  t('audit: schema present but wrong type still flags', audit({ ...base, hasLocalSchema: false, schemaTypes: ['WebSite'] }).some(x => x.key === 'no_local_schema' && x.evidence.includes('WebSite')));
  t('audit: tel link without booking = weak_cta not no_cta', audit({ ...base, ctaLinks: [] }).some(x => x.key === 'weak_cta') && !audit({ ...base, ctaLinks: [] }).some(x => x.key === 'no_cta'));
  const b = templateBrief({ leadName: 'Joe Plumbing', contactName: 'Joe Smith', findings: f });
  t('brief: subject names the count', /4 things/.test(b.subject));
  t('brief: greets by first name + signs off', b.body_md.startsWith('Hi Joe,') && b.body_md.includes('Cloud Scenic'));
  t('brief: no em-dashes', !/—/.test(b.body_md) && !/—/.test(b.subject));
  t('normalizeUrl: bare host -> https + stripped www', normalizeUrl('www.Example.com/path?x=1').host === 'example.com' && normalizeUrl('example.com').href.startsWith('https://'));
  t('normalizeUrl: garbage -> null', normalizeUrl('not a url') === null || normalizeUrl('') === null);
}

/* ── warmth (Growth port) ── */
{
  const iso = (d) => new Date(NOW - d * 86400000).toISOString();
  const sentAt = iso(2);
  const cold = scoreWarmth({ name: 'X' }, { now: NOW });
  t('warmth: empty lead is cold, 0', cold.band === 'cold' && cold.score === 0);
  const personOnly = scoreWarmth({ contact_name: 'Maria Lopez', contact_title: 'Owner', contact_email: 'm@x.com' }, { now: NOW });
  t('warmth: person alone = warming at most, person gate true', personOnly.gates.person && personOnly.band !== 'warm');
  const full = scoreWarmth(
    { contact_name: 'Maria Lopez', contact_title: 'Owner', contact_email: 'm@x.com', direct_phone: '555', signal_verified_at: iso(3), signal_posted_at: iso(3), signal_url: 'https://x/careers', signal_role: 'Marketing Manager', fit: 'high', review_count: 40, updated_at: iso(1) },
    { now: NOW, events: [{ kind: 'sent', at: sentAt, meta: {} }, { kind: 'opened', at: iso(1), meta: { sent_at: sentAt } }, { kind: 'clicked', at: iso(1), meta: { sent_at: sentAt } }] });
  t('warmth: all three gates = WARM', full.band === 'warm' && full.score >= WARM_MIN && full.gates.person && full.gates.trigger && full.gates.engaged);
  t('warmth: reasons are readable', full.reasons.some(r => /Owner Maria Lopez/.test(r)) && full.reasons.some(r => /Hiring/.test(r)) && full.reasons.some(r => /Clicked/.test(r)));
  const scanner = scoreWarmth(full === null ? {} : { contact_name: 'Maria Lopez', contact_email: 'm@x.com', signal_verified_at: iso(3), signal_url: 'u' },
    { now: NOW, events: [{ kind: 'opened', at: new Date(new Date(sentAt).getTime() + 30e3).toISOString(), meta: { sent_at: sentAt } }] });
  t('warmth: open 30s after send = link scanner, not engaged', scanner.gates.engaged === false);
  const stale = scoreWarmth({ contact_name: 'Maria Lopez', contact_email: 'm@x.com', signal_verified_at: iso(60), signal_url: 'u', updated_at: iso(60) }, { now: NOW });
  t('warmth: 60d-old signal is not a trigger gate + decays', stale.gates.trigger === false && stale.factors.decay < 0);
  const lowfit = scoreWarmth({ contact_name: 'A B', contact_email: 'a@b.c', fit: 'low' }, { now: NOW });
  t('warmth: low fit without signal caps below warming', lowfit.band === 'cold' && lowfit.score < 35);
  t('warmth: optout is a hard zero', scoreWarmth({ contact_name: 'A B', contact_email: 'a@b.c', optout: true }, { now: NOW }).score === 0);
}

/* ── leadCapture normalization + suppression (the choke point's pure parts) ── */
{
  const { normPhone, normDomain, normCompany, normCity, suppressionMatch } = leadCapture;
  t('normPhone: +1 and punctuation collapse to last 10', normPhone('+1 (951) 555-0199') === '9515550199' && normPhone('951.555.0199') === '9515550199');
  t('normDomain: strips protocol/www/path', normDomain('https://www.Acme-Roofing.com/about?x=1') === 'acme-roofing.com');
  t('normCompany: legal suffixes + punctuation dropped', normCompany('Acme Roofing, Inc.') === 'acme roofing' && normCompany('ACME ROOFING LLC') === 'acme roofing');
  t('normCity: lowercase words only', normCity('Riverside, CA') === 'riverside ca');
  const maps = { domains: new Map([['parlour.bar', { why: 'existing client', who: 'Parlour Bar' }]]), phones: new Map([['9515550199', { why: 'opted out', who: 'X' }]]), names: new Map([['acme roofing', { why: 'existing client', who: 'Acme' }]]) };
  t('suppression: matches by domain', suppressionMatch(maps, { website: 'https://www.parlour.bar/menu' })?.on === 'domain');
  t('suppression: matches by phone', suppressionMatch(maps, { phone: '(951) 555-0199' })?.on === 'phone');
  t('suppression: matches by normalized name', suppressionMatch(maps, { name: 'ACME Roofing Inc' })?.on === 'name');
  t('suppression: clean row passes', suppressionMatch(maps, { name: 'Sunset Plumbing', website: 'sunsetplumbing.com', phone: '9095550000' }) === null);
}

/* ── shipStations.js game layer (docs/SHIP-GAME-RULES.md) ── */
{
  const hoursAgo = (h) => new Date(NOW - h * 3600000).toISOString();
  const bars = computeBars({ content: [
    { status: 'Approved', updated_at: hoursAgo(2) }, { status: 'Scheduled', updated_at: hoursAgo(40) }, { status: 'Posted', updated_at: hoursAgo(1) },
    { status: 'Need Copy Approval', updated_at: hoursAgo(50) },
  ], health: { linkOk: true, backupOk: true, credits: 12 } }, NOW);
  t('bars: pipeline share counts open items moved in 24h', Math.abs(bars.pipeline.value - 1 / 3) < 1e-9 && bars.pipeline.level === 'green');
  t('bars: approvals counts gate statuses', bars.approvals.value === 1 && bars.approvals.level === 'green');
  t('bars: health nominal when all known good', bars.health.level === 'green' && bars.health.label === 'nominal');
  t('bars: health names the first failure', computeBars({ health: { linkOk: true, backupOk: false } }, NOW).health.label === 'backup stale');
  t('bars: health unknown when nothing is known', computeBars({}, NOW).health.level === 'amber');
  const inc = computeIncidents([
    { status: 'Ready For Content Creation', block_reason: 'missing assets', updated_at: hoursAgo(30) },
    { status: 'Needs Revisions', qc_status: 'blocked', updated_at: hoursAgo(2) },
    { status: 'Posted', block_reason: 'old', updated_at: hoursAgo(90) },
  ], NOW);
  t('incidents: blocked items land in their station', inc.byStation.foundry?.count === 1 && inc.byStation.qc?.count === 2);
  t('incidents: a 30h blocker has spread one hop', inc.byStation.qc?.spread === true);
  t('incidents: done items never count', inc.oldestHours < 31);
  t('incidents: cut intensity from the oldest blocker', Math.abs(inc.cutIntensity - (0.4 + 0.6 * 30 / 72)) < 1e-9);
  t('incidents: none = base cut', computeIncidents([], NOW).cutIntensity === 0.4);
  const morale = computeMorale([
    { agent_name: 'Sean', ts: hoursAgo(1), result_status: 'success' }, { agent_name: 'Sean', ts: hoursAgo(3), result_status: 'failed' },
    { agent_name: 'Sean', ts: hoursAgo(60), result_status: 'failed' }, { agent_name: 'Muse', ts: hoursAgo(5), result_status: 'success' },
  ], NOW);
  t('morale: ratio over 48h only', morale.Sean === 0.5 && morale.Muse === 1);
  t('morale: unknown without receipts', morale.Scrappy === null);
}


console.log(`\n${pass} passed, ${fail} failed`);

process.exit(fail ? 1 : 0);
