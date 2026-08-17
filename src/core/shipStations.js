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
  { name: 'Route',   role: 'Traffic Controller', eventName: null,      color: '#ff9f0a', future: true },
  { name: 'Tally',   role: 'Data Analyst',       eventName: null,      color: '#30d158', future: true },
  { name: 'Frame',   role: 'Asset Librarian',    eventName: null,      color: '#bf5af2', future: true },
  { name: 'Echo',    role: 'Comms Agent',        eventName: null,      color: '#ffd60a', future: true },
  { name: 'Quill',   role: 'Copywriter',         eventName: null,      color: '#f97316', future: true },
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
