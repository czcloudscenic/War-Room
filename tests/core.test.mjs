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
import { computeBars, computeIncidents, computeMorale, rushState, RUSH_ACTION, ACTION_STATION, RUSH_COOLDOWN_MS } from '../src/core/shipStations.js';
import * as THREE from 'three';
import { createPoseLayers, POSE } from '../src/ship/crewPose.js';

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



/* ── crewPose hips: the pelvis layer (the "walks stupid" bug) ── */
{
  // A minimal Mixamo-named rig: Hips at 0.53 of a 100-unit stature, a spine
  // chain, and two legs. Enough for the pelvis layer to read a stride from.
  const makeRig = () => {
    const bone = (name, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); return b; };
    const root = new THREE.Object3D();
    const hips = bone('Hips', 0, 53, 0);
    const sp = bone('Spine', 0, 8, 0), sp1 = bone('Spine01', 0, 8, 0), sp2 = bone('Spine02', 0, 8, 0);
    const neck = bone('neck', 0, 8, 0), head = bone('Head', 0, 6, 0);
    hips.add(sp); sp.add(sp1); sp1.add(sp2); sp2.add(neck); neck.add(head);
    const leg = (side, sx) => {
      const up = bone(side + 'UpLeg', sx, -4, 0), lo = bone(side + 'Leg', 0, -24, 0), ft = bone(side + 'Foot', 0, -24, 0), toe = bone(side + 'ToeBase', 0, -3, 6);
      up.add(lo); lo.add(ft); ft.add(toe); hips.add(up); return { up, lo, ft };
    };
    const L = leg('Left', 5), R = leg('Right', -5);
    const arm = (side, sx) => { const a = bone(side + 'Arm', sx, 0, 0), f = bone(side + 'ForeArm', 0, -12, 0), h = bone(side + 'Hand', 0, -11, 0); a.add(f); f.add(h); sp2.add(a); return { a, f, h }; };
    arm('Left', 8); arm('Right', -8);
    root.add(hips); root.updateMatrixWorld(true);
    return { root, hips, L, R };
  };
  const ctxFor = (anim, dt) => ({ dt, time: 1, anim, speed: anim === 'walk' ? 46 : 0, group: new THREE.Object3D(), rig: new THREE.Object3D(), scale: 1 });

  // Walking, left foot forward and airborne: the pelvis must lead with the
  // left hip (negative yaw about Y, since +x is the body's left and a positive
  // Y rotation carries +x backward) and drop on that same airborne side.
  const rig = makeRig();
  const pose = createPoseLayers({ figureHeight: 100, seed: 3 });
  pose.bind(rig.root, rig.root);
  rig.L.ft.position.z = 14; rig.L.ft.position.y += 4;   // left foot forward and lifted
  rig.R.ft.position.z = -14;
  rig.root.updateMatrixWorld(true);
  const q0 = rig.hips.quaternion.clone(), p0 = rig.hips.position.clone();
  // The host restores the clip pose before every apply(); without that the
  // layer's deltas compound frame over frame. Mirror the real loop.
  for (let i = 0; i < 40; i++) { pose.restore(); pose.apply(ctxFor('walk', 0.05)); }
  const e = new THREE.Euler().setFromQuaternion(rig.hips.quaternion, 'YZX');
  t('hips: walking pelvis leads with the swinging leg (yaw < 0)', e.y < -0.01);
  t('hips: walking pelvis drops on the airborne side (roll < 0)', e.z < -0.005);
  t('hips: walking pelvis shifts over the planted foot (x < 0)', rig.hips.position.x - p0.x < -0.05);
  t('hips: the layer actually moved the pelvis', !rig.hips.quaternion.equals(q0));

  // Weight 0 must be a true no-op.
  const rig2 = makeRig();
  const pose2 = createPoseLayers({ figureHeight: 100, seed: 3 });
  pose2.bind(rig2.root, rig2.root);
  rig2.L.ft.position.z = 14; rig2.L.ft.position.y += 4; rig2.R.ft.position.z = -14;
  rig2.root.updateMatrixWorld(true);
  const saveW = POSE.hips.weight; POSE.hips.weight = 0;
  const q2 = rig2.hips.quaternion.clone(), x2 = rig2.hips.position.x;
  for (let i = 0; i < 40; i++) { pose2.restore(); pose2.apply(ctxFor('walk', 0.05)); }
  t('hips: weight 0 leaves the pelvis alone', rig2.hips.quaternion.angleTo(q2) < 1e-6 && Math.abs(rig2.hips.position.x - x2) < 1e-6);
  POSE.hips.weight = saveW;

  // Standing: contrapposto appears, and the weighted side swaps over time.
  const rig3 = makeRig();
  const pose3 = createPoseLayers({ figureHeight: 100, seed: 5 });
  pose3.bind(rig3.root, rig3.root);
  rig3.root.updateMatrixWorld(true);
  for (let i = 0; i < 60; i++) { pose3.restore(); pose3.apply(ctxFor('idle', 0.05)); }
  const rollA = new THREE.Euler().setFromQuaternion(rig3.hips.quaternion, 'YZX').z;
  t('hips: standing takes the weight on one leg (hip roll is non-zero)', Math.abs(rollA) > 0.005);
  for (let i = 0; i < 400; i++) { pose3.restore(); pose3.apply(ctxFor('idle', 0.05)); }   // ~20 s: at least one swap
  const rollB = new THREE.Euler().setFromQuaternion(rig3.hips.quaternion, 'YZX').z;
  t('hips: the weighted leg swaps over time', Math.sign(rollB) !== Math.sign(rollA) || Math.abs(rollB - rollA) > 0.01);
}

/* ── shipStations.js: Rush (docs/SHIP-GAME-RULES.md §Rush) ── */
{
  const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();
  t('rush: ready when the station has never run its action', rushState('qc', [], NOW).ready === true);
  t('rush: no prior receipt means no cooldown and no last run',
    rushState('qc', [], NOW).cooldownMsLeft === 0 && rushState('qc', [], NOW).lastRushTs === null);

  const justNow = [{ ts: minsAgo(3), action_key: 'qc_review', result_status: 'success' }];
  const inside = rushState('qc', justNow, NOW);
  t('rush: not ready inside the 10-minute cooldown', inside.ready === false);
  t('rush: cooldown counts down (7 min left after 3)', Math.round(inside.cooldownMsLeft / 60000) === 7);

  t('rush: ready again after the cooldown elapses',
    rushState('qc', [{ ts: minsAgo(11), action_key: 'qc_review', result_status: 'success' }], NOW).ready === true);
  t('rush: a failed run burns the cooldown too',
    rushState('qc', [{ ts: minsAgo(2), action_key: 'qc_review', result_status: 'failed' }], NOW).ready === false);
  t('rush: another station\'s receipts do not hold this one back',
    rushState('qc', [{ ts: minsAgo(1), action_key: 'muse_write_content', result_status: 'success' }], NOW).ready === true);
  t('rush: the newest receipt at the station sets the clock',
    rushState('qc', [{ ts: minsAgo(30), action_key: 'qc_review' }, { ts: minsAgo(1), action_key: 'qc_review' }], NOW).cooldownMsLeft > RUSH_COOLDOWN_MS - 2 * 60000);
  t('rush: every rush action belongs to the station it is offered on',
    Object.entries(RUSH_ACTION).every(([id, cfg]) => ACTION_STATION[cfg.action] === id));
}

/* ── crewPose joint limits: "they're still not one solid figure" ──
   The skin weights are clean (measured off all four crew GLBs); what tore the
   mesh at a joint was our own IK driving the elbow dead straight and hinging it
   whichever way the target implied. These run the same synthetic Mixamo rig as
   the hips block, with the small rest bends a real rig has: the knee already
   points forward, the elbow already points back. Those rest offsets are where
   the solver derives the hinge direction, once, at bind. Host loop is
   restore() then apply() — apply alone compounds deltas. */
{
  const makeRig = () => {
    const bone = (name, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); return b; };
    const root = new THREE.Object3D();
    const hips = bone('Hips', 0, 53, 0);
    const sp = bone('Spine', 0, 8, 0), sp1 = bone('Spine01', 0, 8, 0), sp2 = bone('Spine02', 0, 8, 0);
    const neck = bone('neck', 0, 8, 0), head = bone('Head', 0, 6, 0);
    hips.add(sp); sp.add(sp1); sp1.add(sp2); sp2.add(neck); neck.add(head);
    const leg = (side, sx) => {
      // knee carried 2 units FORWARD of the hip-ankle line: a real rest bend
      const up = bone(side + 'UpLeg', sx, -4, 0), lo = bone(side + 'Leg', 0, -24, 2), ft = bone(side + 'Foot', 0, -24, -2);
      up.add(lo); lo.add(ft); hips.add(up); return { up, lo, ft };
    };
    const L = leg('Left', 5), R = leg('Right', -5);
    const arm = (side, sx) => {
      // elbow carried 1.5 units BACK of the shoulder-wrist line
      const a = bone(side + 'Arm', sx, 0, 0), f = bone(side + 'ForeArm', 0, -12, -1.5), h = bone(side + 'Hand', 0, -11, 1.5);
      a.add(f); f.add(h); sp2.add(a); return { a, f, h };
    };
    const LA = arm('Left', 8), RA = arm('Right', -8);
    root.add(hips); root.updateMatrixWorld(true);
    return { root, hips, L, R, LA, RA };
  };
  const ctxFor = (anim, dt) => ({ dt, time: 1, anim, speed: 0, phase: 0, group: new THREE.Object3D(), rig: new THREE.Object3D(), scale: 1 });
  const run = (pose, anim, n) => { for (let i = 0; i < n; i++) { pose.restore(); pose.apply(ctxFor(anim, 0.05)); } };
  const wp = (o) => o.getWorldPosition(new THREE.Vector3());
  // Which side of the root->end line the middle joint sits on (unit vector).
  const bendSide = (a, b, c) => {
    const pa = wp(a), pb = wp(b), pc = wp(c);
    const ac = pc.clone().sub(pa).normalize();
    const ab = pb.clone().sub(pa);
    return ab.addScaledVector(ac, -ab.dot(ac)).normalize();
  };
  // Interior angle at the middle joint, degrees. 180 = dead straight = the pose
  // that shears a sleeve off a forearm.
  const jointDeg = (a, b, c) => { const pb = wp(b); return wp(a).sub(pb).angleTo(wp(c).sub(pb)) * 180 / Math.PI; };
  const chainLen = (l) => l.f.position.length() + l.h.position.length();

  const savedW = POSE.reach.weight, savedAhead = POSE.reach.ahead, savedDrop = POSE.reach.drop, savedFeetW = POSE.feet.weight;
  POSE.reach.weight = 1;   // measure the limits themselves, not the blend

  // 1. A target the arm cannot possibly reach must NOT lock the elbow out.
  {
    const rig = makeRig();
    const pose = createPoseLayers({ figureHeight: 100, seed: 7 });
    pose.bind(rig.root, rig.root);
    POSE.reach.ahead = 5; POSE.reach.drop = 2;   // 5.4 arm-lengths away
    run(pose, 'work', 60);
    rig.root.updateMatrixWorld(true);
    const len = chainLen(rig.LA);
    t('reach: an unreachable target never pulls the arm past maxExtend',
      wp(rig.LA.a).distanceTo(wp(rig.LA.h)) <= POSE.reach.maxExtend * len + 1e-6);
    t('reach: an unreachable target never straightens the elbow to the limit',
      jointDeg(rig.LA.a, rig.LA.f, rig.LA.h) < 180 - POSE.limits.elbowMinDeg);
    POSE.reach.ahead = savedAhead; POSE.reach.drop = savedDrop;
  }

  // 2. A clip that throws the elbow up and forward (the "broken arm" look) is
  //    folded back onto the hinge side the rest pose declared.
  {
    const rig = makeRig();
    const pose = createPoseLayers({ figureHeight: 100, seed: 8 });
    pose.bind(rig.root, rig.root);          // hinge derived from the clean rest pose
    rig.RA.f.position.set(0, -2, 12);       // ...then the clip inverts the elbow
    rig.root.updateMatrixWorld(true);
    run(pose, 'work', 60);
    rig.root.updateMatrixWorld(true);
    const side = bendSide(rig.RA.a, rig.RA.f, rig.RA.h);
    t('reach: an inverted elbow is pushed back behind the arm line', side.z < 0);
    t('reach: an inverted elbow ends below the arm line, not above it', side.y < 0);
    t('reach: the recovered elbow still respects the bend limit',
      jointDeg(rig.RA.a, rig.RA.f, rig.RA.h) < 180 - POSE.limits.elbowMinDeg);
  }

  // 3. A knee bends backwards only: the knee joint itself may never travel
  //    behind the hip-ankle line, however the clip or the ground asks.
  {
    const rig = makeRig();
    const pose = createPoseLayers({ figureHeight: 100, seed: 9 });
    pose.bind(rig.root, rig.root);
    // a clip that folds the knee the wrong way: the joint travels BEHIND the
    // hip-ankle line, which is a leg bending forwards at the knee
    rig.L.lo.position.set(0.8, -24, -2.5); rig.L.ft.position.set(0, -24, 2.5);
    rig.root.updateMatrixWorld(true);
    pose.setGroundFn((x) => (x > 0 ? 6 : 0));   // step up under the left foot only
    run(pose, 'idle', 60);
    rig.root.updateMatrixWorld(true);
    t('feet: a knee folded forwards is pushed back to bending backwards',
      bendSide(rig.L.up, rig.L.lo, rig.L.ft).z > 0.2);
    t('feet: the knee never straightens past the limit',
      jointDeg(rig.L.up, rig.L.lo, rig.L.ft) < 180 - POSE.limits.kneeMinDeg);
  }

  // 4. Weight 0 on either limb layer is a true no-op.
  {
    const rig = makeRig();
    const pose = createPoseLayers({ figureHeight: 100, seed: 10 });
    pose.bind(rig.root, rig.root);
    pose.setGroundFn((x) => (x > 0 ? 6 : 0));
    // The pelvis layer owns a thigh counter-rotation of its own now, so it is
    // silenced too: this block is about the LIMB layers being true no-ops.
    const savedHipsW = POSE.hips.weight;
    POSE.reach.weight = 0; POSE.feet.weight = 0; POSE.hips.weight = 0; POSE.stance.weight = 0;
    const watched = [rig.LA.a, rig.LA.f, rig.RA.a, rig.L.up, rig.L.lo, rig.R.up];
    const before = watched.map((b) => b.quaternion.clone());
    run(pose, 'work', 40);
    t('joint limits: weight 0 leaves every arm and leg bone untouched',
      watched.every((b, i) => b.quaternion.angleTo(before[i]) < 1e-9));
    POSE.reach.weight = 1; POSE.feet.weight = savedFeetW; POSE.hips.weight = savedHipsW; POSE.stance.weight = 1;
  }

  // 4b. The pelvis tilts and turns UNDER the legs. Hips is the root bone, so a
  //     bare pelvis roll would carry both thighs with it and the feet layer
  //     would then wrench them back: that was the twist at the hip. The layer
  //     hands each thigh the inverse delta, so a thigh's WORLD direction must
  //     be identical whether the pelvis moved or not.
  {
    const thighDir = (rig) => {
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      rig.L.up.getWorldPosition(a); rig.L.lo.getWorldPosition(b);
      return b.sub(a).normalize();
    };
    const savedFeet = POSE.feet.weight, savedReach = POSE.reach.weight;
    POSE.feet.weight = 0; POSE.reach.weight = 0; POSE.stance.weight = 0;   // isolate the pelvis (the stance layer re-plants the feet on purpose)
    const rigOn = makeRig();
    const poseOn = createPoseLayers({ figureHeight: 100, seed: 12 });
    poseOn.bind(rigOn.root, rigOn.root);
    POSE.hips.weight = 1;
    run(poseOn, 'idle', 120);                           // long enough for contrapposto to settle
    const dirOn = thighDir(rigOn);
    const pelvisMoved = rigOn.hips.quaternion.angleTo(new THREE.Quaternion());
    const rigOff = makeRig();
    const poseOff = createPoseLayers({ figureHeight: 100, seed: 12 });
    poseOff.bind(rigOff.root, rigOff.root);
    POSE.hips.weight = 0;
    run(poseOff, 'idle', 120);
    const dirOff = thighDir(rigOff);
    POSE.hips.weight = 1; POSE.feet.weight = savedFeet; POSE.reach.weight = savedReach; POSE.stance.weight = 1;
    t('hips: standing contrapposto actually moves the pelvis', pelvisMoved > 1e-3);
    t('hips: the thigh keeps its world direction while the pelvis rolls under it',
      dirOn.angleTo(dirOff) < 1e-6);
  }

  // 5. The shoulder is a cone about its rest direction: no frame may swing the
  //    arm behind the torso, and the elbow must not straighten out to make up
  //    the distance the cone just refused.
  {
    const rig = makeRig();
    const pose = createPoseLayers({ figureHeight: 100, seed: 11 });
    pose.bind(rig.root, rig.root);
    POSE.reach.ahead = -1.5; POSE.reach.drop = -1.2;   // up and behind the shoulder
    run(pose, 'work', 60);
    rig.root.updateMatrixWorld(true);
    const restDir = new THREE.Vector3(0, -12, -1.5).normalize();
    const armDir = wp(rig.LA.f).sub(wp(rig.LA.a)).normalize();
    t('reach: the shoulder never swings the arm outside its cone',
      armDir.angleTo(restDir) <= (POSE.limits.shoulderConeDeg + 0.5) * Math.PI / 180);
    t('reach: a cone-clamped shoulder does not straighten the elbow instead',
      jointDeg(rig.LA.a, rig.LA.f, rig.LA.h) < 180 - POSE.limits.elbowMinDeg);
    POSE.reach.ahead = savedAhead; POSE.reach.drop = savedDrop;
  }

  POSE.reach.weight = savedW; POSE.reach.ahead = savedAhead; POSE.reach.drop = savedDrop; POSE.feet.weight = savedFeetW;
}

/* ── crewPose stance: the bow-legged idle (2026-09-18) ── */
{
  const bone = (name, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); return b; };
  const makeRig = (splay) => {
    const root = new THREE.Object3D();
    const hips = bone('Hips', 0, 50, 0);
    const sp = bone('Spine', 0, 8, 0), sp1 = bone('Spine01', 0, 8, 0), sp2 = bone('Spine02', 0, 8, 0);
    const neck = bone('neck', 0, 8, 0), head = bone('Head', 0, 6, 0);
    hips.add(sp); sp.add(sp1); sp1.add(sp2); sp2.add(neck); neck.add(head);
    const leg = (side, sx) => {
      const up = bone(side + 'UpLeg', sx, -4, 0), lo = bone(side + 'Leg', 0, -24, 0.4), ft = bone(side + 'Foot', 0, -24, -0.4);
      up.add(lo); lo.add(ft); hips.add(up); return { up, lo, ft };
    };
    const L = leg('Left', 5), R = leg('Right', -5);
    root.add(hips); root.updateMatrixWorld(true);
    const pose = createPoseLayers({ figureHeight: 100, seed: 21 });
    pose.bind(root, root);                       // bind on the straight rest pose
    // The library idle: thighs thrown out, knees bent back in, soles flat.
    L.up.rotation.z = splay; L.lo.rotation.z = -splay * 0.8; L.ft.rotation.z = -splay * 0.2;
    R.up.rotation.z = -splay; R.lo.rotation.z = splay * 0.8; R.ft.rotation.z = splay * 0.2;
    root.updateMatrixWorld(true);
    return { root, hips, L, R, pose };
  };
  const ctxFor = (anim) => ({ dt: 0.05, time: 1, anim, speed: anim === 'walk' ? 46 : 0, group: new THREE.Object3D(), rig: new THREE.Object3D(), scale: 1 });
  const wp = (b) => new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
  const knee = (leg) => { const a = wp(leg.up), k = wp(leg.lo), f = wp(leg.ft); return a.sub(k).angleTo(f.sub(k)) * 180 / Math.PI; };
  const measure = (rig) => {
    rig.root.updateMatrixWorld(true);
    const fl = wp(rig.L.ft), fr = wp(rig.R.ft);
    const sole = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.L.ft.getWorldQuaternion(new THREE.Quaternion()));
    return { gap: Math.abs(fl.x - fr.x), kneeL: knee(rig.L), footY: fl.y, footYR: fr.y, soleUp: sole.y, kneeFwd: wp(rig.L.lo).z };
  };

  const rig = makeRig(0.6);
  const before = measure(rig);
  for (let i = 0; i < 80; i++) { rig.pose.restore(); rig.pose.apply(ctxFor('idle')); }
  const after = measure(rig);
  if (process.env.STANCE_DEBUG) console.log(before, after);
  t('stance: the fixture really is bow-legged (gap > 25% of stature)', before.gap > 25);
  t('stance: standing feet come in to a natural gap (<= 12.5% of stature)', after.gap <= 12.5 && after.gap > 8);
  t('stance: the legs straighten instead of squatting (knee > 160 deg)', after.kneeL > 160 && after.kneeL > before.kneeL);
  t('stance: the feet stay on the deck (within 1% of stature)', Math.abs(after.footY - before.footY) < 1 && Math.abs(after.footYR - before.footY) < 1);
  t('stance: the sole stays flat (clip orientation kept)', Math.abs(after.soleUp - before.soleUp) < 1e-3);
  t('stance: the knee hinges forward, not sideways', after.kneeFwd > 0.2);

  // A clip that already stands naturally is left alone.
  const ok = makeRig(0.004);
  const okBefore = measure(ok);
  for (let i = 0; i < 80; i++) { ok.pose.restore(); ok.pose.apply(ctxFor('idle')); }
  t('stance: a natural stance keeps its own gap', Math.abs(measure(ok).gap - okBefore.gap) < 0.6);

  // Walking owns its own legs: the stance layer must stay out.
  const wk = makeRig(0.6);
  const sw = POSE.hips.weight; POSE.hips.weight = 0;
  const wkBefore = measure(wk);
  for (let i = 0; i < 80; i++) { wk.pose.restore(); wk.pose.apply(ctxFor('walk')); }
  t('stance: walking legs are untouched', Math.abs(measure(wk).gap - wkBefore.gap) < 1e-3);
  POSE.hips.weight = sw;
}

console.log(`\n${pass} passed, ${fail} failed`);

process.exit(fail ? 1 : 0);
