// ── Ship scene harness: mounts the REAL ShipScene3D, no login, fake receipts ──
// Why this exists: tests/ship-visual.html builds its own scene, so it could not
// catch the 9/10 ReferenceError that blacked out the Ship route. This page
// renders the production component with stand-in agent_events rows.
//
//   npm run dev  →  http://localhost:5173/tests/ship-scene.html?scenario=mixed&view=scene|world
//
// scenarios: mixed (default: Sean+Muse working, Scrappy active, Slate idle)
//            empty (no receipts: the honest idle deck production shows today)
//            all   (every commissioned crew member working)
import React from 'react';
import { createRoot } from 'react-dom/client';
import ShipScene3D from '../src/ui/ship/ShipScene3D.jsx';
import ShipWorld3D from '../src/ui/ship/ShipWorld3D.jsx';
import ShipPainted3D from '../src/ui/ship/ShipPainted3D.jsx';
import { positionCrew, stationActivity, computeIncidents } from '../src/core/shipStations.js';

const now = Date.now();
const ev = (agent, key, agoMs) => ({ id: `${agent}-${agoMs}`, ts: new Date(now - agoMs).toISOString(), agent_name: agent, action_key: key, result_status: 'success', result_summary: key });
const SCENARIOS = {
  mixed: [ev('Sean', 'sean_briefing', 30_000), ev('Muse', 'muse_write_content', 60_000), ev('Scrappy', 'scrappy_research', 10 * 60_000), ev('QC', 'qc_review', 3 * 3600_000)],
  empty: [],
  all: [ev('Sean', 'sean_briefing', 20_000), ev('Muse', 'muse_write_content', 20_000), ev('Scrappy', 'scrappy_research', 20_000), ev('QC', 'qc_review', 20_000)],
};
const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') || 'mixed';
const view = params.get('view') || 'scene'; // scene = painted plate (ShipScene3D) | world = modeled hull (ShipWorld3D)
const View = view === 'world' ? ShipWorld3D : view === 'painted' ? ShipPainted3D : ShipScene3D;
const events = SCENARIOS[scenario] || SCENARIOS.mixed;
const crew = positionCrew(events, now);
// Incidents for the harness: a 30 h blocker in the foundry (spreads to QC) and a fresh one in QC.
const INCIDENT_CONTENT = scenario === 'empty' ? [] : [
  { status: 'Ready For Content Creation', block_reason: 'missing assets', updated_at: new Date(now - 30 * 3600e3).toISOString() },
  { status: 'Needs Revisions', qc_status: 'blocked', updated_at: new Date(now - 2 * 3600e3).toISOString() },
];
const incidents = computeIncidents(INCIDENT_CONTENT, now);
const activity = stationActivity(events);
window.__ship = { scenario, crew, activity, incidents };
document.getElementById('bar').textContent = `view=${view} · scenario=${scenario} · ` + crew.filter(c => !c.future).map(c => `${c.name}:${c.state}@${c.station}`).join(' · ');

// Stateful host so station selection (fly-to) can be exercised in the harness.
function Host() {
  const [selected, setSelected] = React.useState(null);
  window.__selectStation = (id) => setSelected(s => (s === id ? null : id));
  return <View crew={crew} activity={activity} incidents={incidents} alerts={{ approvals: 2, blocked: 1 }} onStation={(id) => setSelected(s => (s === id ? null : id))} selectedStation={selected} />;
}
createRoot(document.getElementById('root')).render(<Host />);
