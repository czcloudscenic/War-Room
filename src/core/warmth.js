// ── Warmth score (port of Dynasty shared/warmth.mjs, generalized) ────────────
// One pure function so the UI, the functions, and the tests agree on the number.
// Three gates, all required for WARM:
//   PERSON   a named decision-maker with a direct channel (dial or email)
//   TRIGGER  a dated, linkable signal (careers page / job board), never inferred
//   ENGAGED  a HUMAN opened/clicked/replied (opens <10 min after send = scanner)
// Score 0-100 with reasons a human can read on the row.
//
// scoreWarmth(lead, { events, now, weights }) ->
//   { score, band: 'warm'|'warming'|'cold', reasons, factors, gates, last_engaged_at, last_engagement }
// `events` = lead_events rows ({kind, at, meta}) plus brief timing via meta.sent_at.

export const WARM_MIN = 60;
export const WARMING_MIN = 35;
export const TRIGGER_FRESH_DAYS = 14;
export const TRIGGER_OK_DAYS = 30;
export const HUMAN_MS = 10 * 60e3;

export const DEFAULT_WEIGHTS = {
  dm_full_name: 10, dm_first_only: 4, dm_title: 5, direct_phone: 10, email: 5,     // person (30)
  signal_fresh: 30, signal_ok: 18, signal_old: 10,                                  // trigger (30)
  replied: 30, call_answered: 30, clicked: 20, opened: 12, call_gatekeeper: 8, call_back: 8, call_voicemail: 3, extra_signal: 3, // engaged (30)
  fit_high: 6, reviews_band: 4,                                                     // context (10)
  decay_per_day: 1, decay_grace_days: 21,
};

const DM_TITLE_RE = /\b(owner|president|ceo|coo|cmo|founder|partner|principal|general manager|gm|director|vp|vice president|head of|marketing|operations?|manager)\b/i;
const GATEKEEPER_TITLE_RE = /receptionist|front desk|assistant|coordinator|clerk|intern/i;

const daysSince = (iso, now) => (iso ? (now - new Date(iso).getTime()) / 864e5 : Infinity);
const ago = (iso, now) => { const d = Math.floor(daysSince(iso, now)); return d <= 0 ? 'today' : d === 1 ? '1d ago' : `${d}d ago`; };
const isHuman = (ev) => !ev.meta?.sent_at || (new Date(ev.at).getTime() - new Date(ev.meta.sent_at).getTime()) > HUMAN_MS;

export function scoreWarmth(lead, ctx = {}) {
  const W = { ...DEFAULT_WEIGHTS, ...(ctx.weights || {}) };
  const now = ctx.now || Date.now();
  const events = ctx.events || [];
  const reasons = [];
  const factors = {};
  const zero = (why) => ({ score: 0, band: 'cold', reasons: [why], factors, gates: { person: false, trigger: false, engaged: false }, last_engaged_at: null, last_engagement: null });
  if (lead.optout) return zero('Unsubscribed');
  if (lead.stage === 'lost') return zero('Marked not now');

  // PERSON
  const name = String(lead.contact_name || '').trim();
  const title = String(lead.contact_title || '').trim();
  const fullName = name.split(/\s+/).filter(Boolean).length >= 2;
  const dmTitle = !!title && DM_TITLE_RE.test(title) && !GATEKEEPER_TITLE_RE.test(title);
  const email = lead.contact_email || lead.email || null;
  const direct = lead.direct_phone || null;
  let person = 0;
  if (name) person += fullName ? W.dm_full_name : W.dm_first_only;
  if (dmTitle) person += W.dm_title;
  if (direct) person += W.direct_phone;
  if (email) person += W.email;
  factors.person = person;
  const personGate = !!name && (!!direct || !!email);
  if (name) {
    const how = [direct ? 'direct dial' : null, email ? 'email' : null].filter(Boolean).join(' + ');
    reasons.push(how ? `${[title, name].filter(Boolean).join(' ')} · ${how}` : `${name} on file (no direct channel yet)`);
  }

  // TRIGGER — verified signal only
  let trigger = 0, triggerGate = false;
  if (lead.signal_verified_at && lead.signal_url) {
    const age = daysSince(lead.signal_posted_at || lead.signal_verified_at, now);
    if (age <= TRIGGER_FRESH_DAYS) { trigger = W.signal_fresh; triggerGate = true; }
    else if (age <= TRIGGER_OK_DAYS) { trigger = W.signal_ok; triggerGate = true; }
    else trigger = W.signal_old;
    reasons.push(`${lead.signal_kind === 'job_board' ? 'Hiring' : 'Hiring (careers page)'}: ${lead.signal_role ? String(lead.signal_role).slice(0, 40) : 'open role'} · ${ago(lead.signal_posted_at || lead.signal_verified_at, now)}`);
  }
  factors.trigger = trigger;

  // ENGAGED — best signal + 3 per extra distinct kind, capped 30
  const kinds = new Map();
  let lastAt = null, lastWhat = null;
  for (const ev of events) {
    if (!W[ev.kind]) continue;
    if ((ev.kind === 'opened' || ev.kind === 'clicked') && !isHuman(ev)) continue;
    kinds.set(ev.kind, W[ev.kind]);
    if (!lastAt || new Date(ev.at) > new Date(lastAt)) { lastAt = ev.at; lastWhat = ev.kind; }
  }
  const ranked = [...kinds.values()].sort((a, b) => b - a);
  const engaged = Math.min(30, ranked.length ? ranked[0] + W.extra_signal * (ranked.length - 1) : 0);
  factors.engaged = engaged;
  const engagedGate = ['replied', 'clicked', 'opened', 'call_answered', 'call_gatekeeper', 'call_back'].some(k => kinds.has(k));
  if (kinds.has('replied')) reasons.push(`Replied ${ago(events.filter(e => e.kind === 'replied').sort((a, b) => new Date(b.at) - new Date(a.at))[0].at, now)}`);
  else if (kinds.has('clicked')) reasons.push(`Clicked ${ago(lastAt, now)}`);
  else if (kinds.has('opened')) reasons.push(`Opened ${ago(lastAt, now)}`);
  if (kinds.has('call_answered')) reasons.push('Picked up the phone');

  // CONTEXT
  let context = 0;
  if (lead.fit === 'high') { context += W.fit_high; reasons.push('High fit'); }
  const rc = Number(lead.review_count || 0);
  if (rc >= 10 && rc <= 500) context += W.reviews_band;
  factors.context = context;

  // FRESHNESS decay
  const newest = [lastAt, lead.signal_verified_at, lead.signal_posted_at, lead.updated_at, lead.created_at]
    .filter(Boolean).map(x => new Date(x).getTime()).sort((a, b) => b - a)[0] || null;
  let decay = 0;
  if (newest) { const d = (now - newest) / 864e5; if (d > W.decay_grace_days) decay = Math.floor((d - W.decay_grace_days) * W.decay_per_day); }
  factors.decay = -decay;

  let score = Math.max(0, Math.min(100, person + trigger + engaged + context - decay));
  const lowFit = lead.fit === 'low' && !triggerGate; // a verified signal overrides a low-fit guess
  if (lowFit) score = Math.min(score, WARMING_MIN - 1);

  const gates = { person: personGate, trigger: triggerGate, engaged: engagedGate };
  const band = gates.person && gates.trigger && gates.engaged && score >= WARM_MIN ? 'warm'
    : (score >= WARMING_MIN || (gates.person && gates.trigger)) && !lowFit ? 'warming'
    : 'cold';
  return { score, band, reasons, factors, gates, last_engaged_at: lastAt, last_engagement: lastWhat };
}

export const BAND_LABEL = { warm: 'Warm now', warming: 'Warming', cold: 'Cold' };
