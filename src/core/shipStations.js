// ── Agent Ship: stations, roster, and the movement rule (spec §10) ───────────
// Pure module: no I/O, no React. The 3D view, the Map view, and any future
// rendering all read THIS file — one spine, three renderings.
//
// THE MOVEMENT RULE (Danny's law): an agent stands at a station only when a
// receipt (agent_events row) proves it. Recency decides state:
//   working  — receipt landed < 2 minutes ago (pulse)
//   active   — receipt < 30 minutes ago (lit, at last station)
//   idle     — anything older → the agent sits in Agent Quarters
// Future crew (named in the spec, not yet built) render ghosted in Quarters,
// clearly labeled — never as live workers. No film characters or likenesses:
// original crew, our ship.

// px/py: percentage anchor of each station's room in the bundled artwork
// (public/ship-interior.jpg — original generation, Danny's mood, no likenesses).
// Staggered like Danny's mockup — alternating card heights per deck so
// neighbors never collide at laptop widths.
export const STATIONS = [
  { id: 'cockpit',    n: '01', label: 'Cockpit',         sub: 'command & orchestration', px: 13, py: 26 },
  { id: 'intel',      n: '02', label: 'Intel Core',      sub: 'research / trends',        px: 29, py: 13 },
  { id: 'foundry',    n: '03', label: 'Content Foundry', sub: 'ideation / creation',      px: 45, py: 27 },
  { id: 'qc',         n: '05', label: 'QC Lab',          sub: 'creative + factual QC',    px: 60, py: 12 },
  { id: 'pipeline',   n: '04', label: 'Pipeline Grid',   sub: '8-stage oversight',        px: 74, py: 27 },
  { id: 'gateway',    n: '12', label: 'System Gateway',  sub: 'security · access · logs', px: 89, py: 13 },
  { id: 'quarters',   n: '11', label: 'Agent Quarters',  sub: 'idle / rest',              px: 19, py: 61 },
  { id: 'vault',      n: '06', label: 'Asset Vault',     sub: 'assets / rights',          px: 37, py: 76 },
  { id: 'analytics',  n: '08', label: 'Analytics Node',  sub: 'metrics / reporting',      px: 51, py: 56 },
  { id: 'comm',       n: '07', label: 'Comm Relay',      sub: 'client comms / approvals', px: 65, py: 73 },
  { id: 'automation', n: '09', label: 'Automation Bay',  sub: 'integrations / n8n',       px: 78, py: 55 },
  { id: 'finance',    n: '10', label: 'Finance Core',    sub: 'billing / revenue',        px: 90, py: 72 },
];
export const stationById = (id) => STATIONS.find(s => s.id === id) || STATIONS[STATIONS.length - 1];

// Which station a receipt proves work happened at.
export const ACTION_STATION = {
  sean_briefing: 'cockpit', ops_assign: 'cockpit',
  scrappy_research: 'intel', scrappy_hook_analysis: 'intel', scrappy_muse_collab: 'intel', cid_build_brief: 'intel',
  muse_write_content: 'foundry', muse_from_brief: 'foundry', muse_ig_ideas: 'foundry', muse_idea_list: 'foundry',
  muse_film_brief: 'foundry', cid_ab_variations: 'foundry', intel_generate_ideas: 'foundry', intel_set_idea_status: 'foundry',
  muse_generate_calendar: 'pipeline', muse_save_calendar: 'pipeline',
  qc_review: 'qc',
  scrappy_analyze_performance: 'analytics', intel_score_content: 'analytics',
};

// Canonical roster (spec §10 — names are canon). eventName ties a crew member
// to their agent_events rows; future crew have none yet.
export const ROSTER = [
  { name: 'Sean',    role: 'Commander',          eventName: 'Sean',    color: '#2AABFF', future: false, home: 'cockpit' },
  { name: 'Muse',    role: 'Content Ideation',   eventName: 'Muse',    color: '#ff375f', future: false, home: 'foundry' },
  { name: 'Scrappy', role: 'Trend Scout',        eventName: 'Scrappy', color: '#5e5ce6', future: false, home: 'intel' },
  { name: 'Slate',   role: 'QC Guardian',        eventName: 'QC',      color: '#64d2ff', future: false, home: 'qc' },
  { name: 'Route',   role: 'Traffic Controller', eventName: null,      color: '#66d4cf', future: true },
  { name: 'Tally',   role: 'Data Analyst',       eventName: null,      color: '#30d158', future: true },
  { name: 'Frame',   role: 'Asset Librarian',    eventName: null,      color: '#bf5af2', future: true },
  { name: 'Echo',    role: 'Comms Agent',        eventName: null,      color: '#5ac8fa', future: true },
  { name: 'Quill',   role: 'Copywriter',         eventName: null,      color: '#98989d', future: true },
  { name: 'Vault',   role: 'Security Agent',     eventName: null,      color: '#8e8e93', future: true },
];

const WORKING_MS = 2 * 60 * 1000;
const ACTIVE_MS = 30 * 60 * 1000;

/**
 * Apply the movement rule.
 *   events : agent_events rows (newest first) — success receipts
 *   now    : ms timestamp (injected so views/tests agree)
 * Returns [{ ...rosterMember, station, state, lastTs, lastAction, receipts48h }]
 *   state: 'working' | 'active' | 'idle' | 'future'
 */
export function positionCrew(events = [], now = Date.now()) {
  return ROSTER.map(member => {
    if (member.future) {
      return { ...member, station: 'quarters', state: 'future', lastTs: null, lastAction: null, receipts48h: 0 };
    }
    const mine = events.filter(e => e.agent_name === member.eventName);
    const latest = mine[0] || null;
    if (!latest) {
      return { ...member, station: member.home || 'quarters', state: 'idle', lastTs: null, lastAction: null, receipts48h: 0 };
    }
    const age = now - new Date(latest.ts).getTime();
    const state = age < WORKING_MS ? 'working' : age < ACTIVE_MS ? 'active' : 'idle';
    // Idle crew hold their HOME POST (bridge crew belongs on the bridge), not
    // the barracks — receipts still drive working state and station moves.
    const station = state === 'idle' ? (member.home || 'quarters') : (ACTION_STATION[latest.action_key] || 'automation');
    return { ...member, station, state, lastTs: latest.ts, lastAction: latest.action_key, receipts48h: mine.length };
  });
}

/** Receipts grouped per station (for glow intensity + the station detail panel). */
export function stationActivity(events = []) {
  const by = {};
  for (const s of STATIONS) by[s.id] = [];
  for (const e of events) {
    const id = ACTION_STATION[e.action_key] || 'automation';
    by[id].push(e);
  }
  return by;
}

// ── The game layer (docs/SHIP-GAME-RULES.md) ─────────────────────────────────
// Pure functions. Every number here comes from real rows; nothing is timed.

const H = 3600 * 1000;
export const GATE_STATUSES = ['Need Copy Approval', 'Need Content Approval'];
const DONE_STATUSES = ['Posted', 'Scrapped'];
// Pipeline order an incident spreads along (rules doc §Incidents).
export const SPREAD_ORDER = ['foundry', 'qc', 'pipeline', 'comm'];
// Which station a blocked item lives in, from its status.
const STATUS_STATION = {
  'Ready For Copy Creation': 'foundry', 'Need Copy Approval': 'comm', 'Ready For Content Creation': 'foundry',
  'Need Content Approval': 'comm', 'Needs Revisions': 'qc', 'Approved': 'pipeline', 'Ready For Schedule': 'pipeline', 'Scheduled': 'pipeline',
};
export const stationForItem = (item) => STATUS_STATION[item?.status] || 'pipeline';
export const isBlocked = (item) => !!(item && (item.block_reason || item.qc_status === 'blocked') && !DONE_STATUSES.includes(item.status));

/**
 * The three top bars. Each: { value, level: 'green'|'amber'|'red', label }.
 *   pipeline  share of open items that moved stage in the last 24 h (updated_at)
 *   approvals count waiting at a human gate
 *   health    link + backup (< 26 h) + credits, red names the first failure
 */
export function computeBars({ content = [], health = {} } = {}, now = Date.now()) {
  const open = content.filter(i => !DONE_STATUSES.includes(i.status));
  const moved = open.filter(i => i.updated_at && now - new Date(i.updated_at).getTime() < 24 * H).length;
  const share = open.length ? moved / open.length : 0;
  const pipeline = { value: share, level: share >= 0.3 ? 'green' : share >= 0.1 ? 'amber' : 'red', label: open.length ? `${Math.round(share * 100)}% moved 24h` : 'no open items' };
  const waiting = content.filter(i => GATE_STATUSES.includes(i.status)).length;
  const approvals = { value: waiting, level: waiting <= 2 ? 'green' : waiting <= 6 ? 'amber' : 'red', label: `${waiting} waiting` };
  const backupFresh = health.backupAt ? now - new Date(health.backupAt).getTime() < 26 * H : !!health.backupOk;
  const fails = [];
  if (health.linkOk === false) fails.push('link down');
  if (health.backupOk === false || (health.backupAt && !backupFresh)) fails.push('backup stale');
  if (health.credits != null && health.credits <= 0) fails.push('no credits');
  const known = health.linkOk != null || health.backupOk != null || health.backupAt != null || health.credits != null;
  const healthBar = { value: fails.length ? 0 : known ? 1 : null, level: fails.length ? 'red' : known ? 'green' : 'amber', label: fails.length ? fails[0] : known ? 'nominal' : 'unknown' };
  return { pipeline, approvals, health: healthBar };
}

/**
 * Incidents: one per blocked item, in its station; after 24 h unhandled it
 * also burns in the next station of SPREAD_ORDER (and so on, one hop per 24 h).
 * Returns { byStation: { [id]: { count, oldestHours, spread } }, oldestHours, cutIntensity }.
 * cutIntensity = 0.4 + 0.6 * clamp(oldestHours / 72) (the sentinel's cut).
 */
export function computeIncidents(content = [], now = Date.now()) {
  const byStation = {};
  let oldestHours = 0;
  const bump = (id, hours, spread) => {
    const s = byStation[id] || (byStation[id] = { count: 0, oldestHours: 0, spread: false });
    s.count += 1; s.oldestHours = Math.max(s.oldestHours, hours); if (spread) s.spread = true;
  };
  for (const item of content) {
    if (!isBlocked(item)) continue;
    const since = item.blocked_at || item.updated_at;
    const hours = since ? Math.max(0, (now - new Date(since).getTime()) / H) : 0;
    oldestHours = Math.max(oldestHours, hours);
    const home = stationForItem(item);
    bump(home, hours, false);
    const hops = Math.floor(hours / 24);
    let idx = SPREAD_ORDER.indexOf(home);
    for (let k = 0; k < hops && idx >= 0 && idx + 1 < SPREAD_ORDER.length; k++) { idx += 1; bump(SPREAD_ORDER[idx], hours - 24 * (k + 1), true); }
  }
  const cutIntensity = 0.4 + 0.6 * Math.min(1, oldestHours / 72);
  return { byStation, oldestHours, cutIntensity };
}

/**
 * Morale per agent: successes / (successes + failures) over 48 h of receipts.
 * Unknown (null) when there are no receipts, never a default number.
 */
export function computeMorale(events = [], now = Date.now()) {
  const out = {};
  for (const m of ROSTER) {
    if (!m.eventName) continue;
    const mine = events.filter(e => e.agent_name === m.eventName && e.ts && now - new Date(e.ts).getTime() < 48 * H);
    const ok = mine.filter(e => e.result_status === 'success').length;
    const bad = mine.filter(e => e.result_status && e.result_status !== 'success').length;
    out[m.name] = ok + bad ? ok / (ok + bad) : null;
  }
  return out;
}

// ── Rush (docs/SHIP-GAME-RULES.md §Rush) ─────────────────────────────────────
// A human presses Rush; it runs that station's real agent action NOW. Never
// automatic. Success pays a receipt, failure logs a failed one and starts an
// incident there — both come back from the agent-action function, neither is
// invented here. One station can be rushed once per 10 minutes, and the clock
// is read off the receipts themselves: the newest receipt whose action belongs
// to that station IS its last run as far as the ship is concerned.
export const RUSH_COOLDOWN_MS = 10 * 60 * 1000;

// The one action Rush runs per station. Every key is already in ACTION_STATION
// and maps back to its own station (asserted in tests). A station missing here
// has no agent action and cannot be rushed — the button says so.
// needsItem: the handler refuses to run without a content item to work on.
export const RUSH_ACTION = {
  cockpit:   { action: 'sean_briefing',               needsItem: false },
  intel:     { action: 'scrappy_hook_analysis',       needsItem: false },
  foundry:   { action: 'muse_write_content',          needsItem: true  },
  qc:        { action: 'qc_review',                   needsItem: true  },
  pipeline:  { action: 'muse_generate_calendar',      needsItem: false },
  analytics: { action: 'scrappy_analyze_performance', needsItem: false },
};

/** ACTION_STATION inverted: the action keys whose receipts prove work here. */
export const actionsForStation = (stationId) => Object.keys(ACTION_STATION).filter(k => ACTION_STATION[k] === stationId);

/**
 * Can this station be rushed right now?
 *   stationId : STATIONS id
 *   events    : agent_events rows (any order; success or failed both count —
 *               a failed rush still burns the cooldown)
 *   now       : ms timestamp (injected so views and tests agree)
 * Returns { ready, cooldownMsLeft, lastRushTs } — lastRushTs in ms, null when
 * this station has never run its action.
 */
export function rushState(stationId, events = [], now = Date.now()) {
  let lastRushTs = null;
  for (const e of events) {
    if (!e || !e.ts || ACTION_STATION[e.action_key] !== stationId) continue;
    const ts = new Date(e.ts).getTime();
    if (!Number.isFinite(ts)) continue;
    if (lastRushTs == null || ts > lastRushTs) lastRushTs = ts;
  }
  if (lastRushTs == null) return { ready: true, cooldownMsLeft: 0, lastRushTs: null };
  const cooldownMsLeft = Math.max(0, RUSH_COOLDOWN_MS - (now - lastRushTs));
  return { ready: cooldownMsLeft === 0, cooldownMsLeft, lastRushTs };
}
