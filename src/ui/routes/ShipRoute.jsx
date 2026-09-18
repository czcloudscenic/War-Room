import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { positionCrew, stationActivity, stationById, ROSTER, computeBars, computeIncidents, computeMorale, rushState, RUSH_ACTION, stationForItem, isBlocked } from '../../core/shipStations.js';
import { apiFetch } from '../../services/apiFetch.js';
import ShipGame from '../ship/ShipGame.jsx';
import ShipScene3D from '../ship/ShipScene3D.jsx';
import ShipWorld3D from '../ship/ShipWorld3D.jsx';
import ShipPainted3D from '../ship/ShipPainted3D.jsx';
import ShipMap from '../ship/ShipMap.jsx';

// WebGL gate: the 3D scene needs it; the 2D canvas ship is the fallback skin.
const HAS_WEBGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
})();
import AgentRail from '../dashboard/AgentRail.jsx';

// ── The Agent Ship (spec §10 — Danny's end-state visual, built out) ──────────
// Three renderings of one spine: 3D View (hull cross-section) / Map View (2D
// station diagram) / List View (the Founder Rail). Crew positions obey the
// movement rule: driven by agent_events receipts only — if the ship says an
// agent is working, clicking the station shows the receipt that proves it.
// Original crew, our ship; future agents render ghosted in Quarters until
// they're actually commissioned.

const mono = { fontFamily: "'Geist Mono', monospace" };
const card = { background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };
const DAY_MS = 86400000;

const fmtT = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ShipRoute({ isMobile, clients = [], content = [], setActiveNav }) {
  const [view, setView] = useState('model'); // 'model' (the 3D ship, default) | '3d' (painted, in motion) | 'art' (still plate) | 'map' | 'list'
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [backupOk, setBackupOk] = useState(null); // null = unknown
  const [selectedStation, setSelectedStation] = useState(null);
  const [tick, setTick] = useState(0); // re-applies the movement rule as receipts age
  // Rush (rules doc §Rush). rushLog holds the runs THIS session so a FAILED run
  // still burns the 10-minute cooldown — the events feed only carries successes.
  const [rushLog, setRushLog] = useState([]);
  const [rushBusy, setRushBusy] = useState(false);
  const [rushResult, setRushResult] = useState(null); // { stationId, ok, text }
  // Anthropic credits: Vantus stores no balance, so this starts UNKNOWN and the
  // gate stays open. It flips only when the API itself says the balance is out.
  const [creditsOut, setCreditsOut] = useState(false);
  const nameOf = (id) => (clients.find(c => c.id === id)?.name) || null;

  useEffect(() => {
    if (!sb) return;
    let cancelled = false;
    const since = new Date(Date.now() - 2 * DAY_MS).toISOString();
    (async () => {
      await sb.auth.getSession();
      const [{ data: ev }, { data: t }, { data: bk }] = await Promise.all([
        sb.from('agent_events').select('id, ts, agent_name, action_key, result_status, result_summary, client_id, content_item_id').gte('ts', since).eq('result_status', 'success').order('ts', { ascending: false }).limit(200),
        sb.from('tasks').select('id, title, status, priority, client_id, due_date, source, reason').neq('status', 'done'),
        sb.from('backup_runs').select('status').eq('kind', 'export').order('started_at', { ascending: false }).limit(1),
      ]);
      if (cancelled) return;
      setEvents(ev || []);
      setTasks(t || []);
      setBackupOk(bk?.[0] ? bk[0].status === 'ok' : null);
    })();

    const ch = sb.channel('ship_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_events' }, (payload) => {
        if (payload.new?.result_status === 'success') setEvents(prev => [payload.new, ...prev].slice(0, 200));
      })
      .subscribe();
    // Re-evaluate working/active/idle states once a minute so agents walk back
    // to Quarters when their receipts age out — time moves, positions follow.
    const interval = setInterval(() => setTick(n => n + 1), 60_000);
    return () => { cancelled = true; sb.removeChannel(ch); clearInterval(interval); };
  }, []);

  const crew = useMemo(() => positionCrew(events, Date.now()), [events, tick]);
  const activity = useMemo(() => stationActivity(events), [events]);
  const commissioned = crew.filter(c => !c.future);
  const blockedCount = (content || []).filter(x => (x.block_reason || x.qc_status === 'blocked') && !['Posted', 'Scrapped'].includes(x.status)).length;
  const approvalsCount = (content || []).filter(x => ['Need Copy Approval', 'Need Content Approval'].includes(x.status)).length;
  const shipAlerts = { approvals: approvalsCount, blocked: blockedCount };
  // The game layer (docs/SHIP-GAME-RULES.md): three bars, incidents, morale, all from rows.
  const bars = useMemo(() => computeBars({ content, health: { linkOk: sb ? (events.length || tasks.length ? true : null) : false, backupOk, credits: creditsOut ? 0 : null } }, Date.now()), [content, events.length, tasks.length, backupOk, creditsOut, tick]);
  const incidents = useMemo(() => computeIncidents(content, Date.now()), [content, tick]);
  const morale = useMemo(() => computeMorale(events, Date.now()), [events, tick]);
  const BAR_COLOR = { green: '#30d158', amber: '#E5E5EA', red: '#ff453a' };
  const Bar = ({ name, bar, fill }) => (
    <div title={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, ...mono, color: 'rgba(255,255,255,0.55)' }}>{name}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(Math.max(0.04, Math.min(1, fill)) * 100)}%`, height: '100%', background: BAR_COLOR[bar.level], transition: 'width 600ms ease' }} />
      </div>
      <span style={{ fontSize: 9, ...mono, color: BAR_COLOR[bar.level], whiteSpace: 'nowrap' }}>{bar.label}</span>
    </div>
  );
  const workingNow = commissioned.filter(c => c.state === 'working').length;

  const selStation = selectedStation ? stationById(selectedStation) : null;
  const selReceipts = selectedStation ? (activity[selectedStation] || []).slice(0, 12) : [];
  const selCrew = selectedStation ? crew.filter(c => c.station === selectedStation) : [];
  // ── Fly-in facts: output, blockers, morale, and the Rush gate ──────────────
  // Every number below is counted off rows already loaded; nothing is invented.
  const selOut24 = selectedStation
    ? (activity[selectedStation] || []).filter(e => e.ts && Date.now() - new Date(e.ts).getTime() < DAY_MS).length
    : 0;
  const selIncident = selectedStation ? incidents.byStation[selectedStation] : null;
  const selBlockers = selectedStation
    ? (content || []).filter(i => isBlocked(i) && stationForItem(i) === selectedStation)
    : [];
  const rushCfg = selectedStation ? RUSH_ACTION[selectedStation] : null;
  const rush = selectedStation ? rushState(selectedStation, [...rushLog, ...events], Date.now()) : null;
  // The newest open item this station's action would work on.
  const rushItem = selectedStation
    ? (content || [])
        .filter(i => !['Posted', 'Scrapped'].includes(i.status) && stationForItem(i) === selectedStation)
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0] || null
    : null;
  const rushWhyNot = !selectedStation ? 'no station selected'
    : !rushCfg ? 'no agent action at this station'
    : !selCrew.some(c => !c.future) ? 'no agent assigned to this station'
    : creditsOut ? 'no Anthropic credits'
    : rush && !rush.ready ? `cooling down — ${Math.ceil(rush.cooldownMsLeft / 60000)} min left`
    : (rushCfg.needsItem && !rushItem) ? 'no item waiting at this station'
    : rushBusy ? 'running' : null;

  // Rush: a human presses it, it runs the station's REAL action on the newest
  // relevant item, once per 10 minutes. No retry, nothing sent to a client.
  const runRush = async () => {
    if (!selectedStation || !rushCfg || rushWhyNot) return;
    const stationId = selectedStation, action = rushCfg.action, item = rushItem;
    const payload = action === 'qc_review' ? { itemId: item.id }
      : action === 'muse_write_content' ? { itemId: item.id, itemTitle: item.title, pillar: item.pillar, format: item.format, description: item.description, fieldToUpdate: 'caption' }
      : {};
    setRushBusy(true); setRushResult(null);
    const started = new Date().toISOString();
    try {
      const res = await apiFetch('/api/agent-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, client_id: item?.client_id || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error || d.success === false) throw new Error(d.error || d.message || `Rush failed (${res.status})`);
      const summary = d.message || d.summary || d.briefing || d.report || d.content || `${action} completed`;
      setRushLog(prev => [{ ts: started, action_key: action, result_status: 'success' }, ...prev]);
      setRushResult({ stationId, ok: true, text: String(summary).slice(0, 400) });
    } catch (e) {
      // The function logs the failed receipt itself; the cooldown burns either way.
      setRushLog(prev => [{ ts: started, action_key: action, result_status: 'failed' }, ...prev]);
      setRushResult({ stationId, ok: false, text: e.message });
      if (/credit balance|out of credits|insufficient credit/i.test(e.message || '')) setCreditsOut(true);
    } finally { setRushBusy(false); }
  };

  const toggle = (key, label) => (
    <button key={key} onClick={() => setView(key)} style={{
      padding: '7px 16px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
      background: view === key ? 'rgba(42,171,255,0.15)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${view === key ? 'rgba(42,171,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
      color: view === key ? '#2AABFF' : 'rgba(255,255,255,0.55)',
    }}>{label}</button>
  );

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ marginBottom: isMobile ? 22 : 32, paddingBottom: isMobile ? 18 : 26, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', ...mono, marginBottom: 12 }}>Cloud Scenic / Agent Ship</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: 'italic', color: '#fff', margin: 0, letterSpacing: -1, lineHeight: 1 }}>The Ship</h1>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', margin: '12px 0 0', maxWidth: 620 }}>
              Every position is proven by a receipt — {commissioned.length} commissioned, {ROSTER.length - commissioned.length} future crew ghosted in Quarters, {workingNow} working this minute. Click a station for its receipts.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {toggle('model', '3D View')}
            {toggle('3d', 'Painted')}
            {toggle('art', 'Art View')}
            {toggle('map', 'Map View')}
            {toggle('list', 'List View')}
          </div>
        </div>
      </div>

      {/* System strip — Danny's top bar, real signals only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, ...mono, color: 'rgba(255,255,255,0.6)' }}>AGENT SHIP <span style={{ color: '#30d158' }}>// ONLINE</span></span>
        <Bar name="PIPELINE" bar={bars.pipeline} fill={bars.pipeline.value} />
        <Bar name="APPROVALS" bar={bars.approvals} fill={bars.approvals.value ? Math.min(1, bars.approvals.value / 8) : 0} />
        <Bar name="HEALTH" bar={bars.health} fill={bars.health.value == null ? 0.5 : bars.health.value} />
        {incidents.oldestHours > 0 && <span style={{ fontSize: 9, ...mono, color: '#ff453a' }}>INCIDENTS {Object.values(incidents.byStation).reduce((a, s) => a + s.count, 0)} · oldest {Math.round(incidents.oldestHours)}h</span>}
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 2, ...mono, color: 'rgba(255,255,255,0.45)' }}>
          SYSTEM STATUS <span style={{ color: backupOk === false ? '#ff453a' : backupOk ? '#30d158' : 'rgba(255,255,255,0.4)' }}>● {backupOk === false ? 'BACKUP FAILED' : backupOk ? 'NOMINAL' : '—'}</span>
        </span>
      </div>

      {view === 'list' ? (
        <AgentRail isMobile={isMobile} clients={clients} content={content} tasks={tasks} setActiveNav={setActiveNav} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 330px', gap: 14, alignItems: 'start' }}>
          <div>
            {/* The cinematic ship: the reference-matched artwork IS the world,
                with the live 3D crew inside it. The fully modeled variant
                (ShipWorld3D) stays in-repo pending its art-direction pass. */}
            {/* Attention beacons run off the same two numbers the mission bar
                shows, so the world can never claim something the bar denies. */}
            {/* 3D View (9/11): the modeled hull in a streaming undercity, the
                ship in flight. Art View keeps the painted plate. */}
            {view === '3d' && (HAS_WEBGL
              ? <ShipPainted3D crew={crew} activity={activity} alerts={shipAlerts} signals={{ backupOk, linkOk: sb ? (events.length || tasks.length ? true : null) : false, lastReceiptTs: events[0]?.ts || null }} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />
              : <ShipGame crew={crew} activity={activity} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />)}
            {view === 'model' && (HAS_WEBGL
              ? <ShipWorld3D crew={crew} activity={activity} incidents={incidents} morale={morale} signals={{ backupOk, linkOk: sb ? (events.length || tasks.length ? true : null) : false, lastReceiptTs: events[0]?.ts || null }} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />
              : <ShipGame crew={crew} activity={activity} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />)}
            {view === 'art' && (HAS_WEBGL
              ? <ShipScene3D crew={crew} activity={activity} alerts={shipAlerts} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />
              : <ShipGame crew={crew} activity={activity} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />)}
            {view === 'map' && <ShipMap crew={crew} activity={activity} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />}

            {/* Mission bar — real numbers only */}
            <div style={{ display: 'flex', marginTop: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: '#0e0e0e' }}>
              {[
                ['Active agents', `${commissioned.filter(c => c.receipts48h > 0).length}/${commissioned.length}`, '#2AABFF'],
                ['Working now', String(workingNow), workingNow ? '#30d158' : 'rgba(255,255,255,0.5)'],
                ['Done 48h', String(events.length), '#30d158'],
                ['Blocked', String(blockedCount), '#E5E5EA'],
                ['Approvals', String(approvalsCount), '#bf5af2'],
                ['Backup', backupOk === false ? 'FAIL' : backupOk ? 'OK' : '—', backupOk === false ? '#ff453a' : '#30d158'],
              ].map(([label, value, color]) => (
                <div key={label} style={{ flex: 1, textAlign: 'center', padding: '11px 6px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, ...mono, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 5, fontWeight: 700 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right rail — Danny's AGENT ACTIVITY feed, live */}
          {!isMobile && <AgentRail isMobile={isMobile} clients={clients} content={content} tasks={tasks} setActiveNav={setActiveNav} />}
        </div>
      )}

      {/* Station detail — the receipts that prove the lights (3D + Map views) */}
      {view !== 'list' && selStation && (
        <div style={{ ...card, marginTop: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, ...mono, color: 'rgba(255,255,255,0.35)' }}>{selStation.n}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f7', fontFamily: 'Inter, sans-serif' }}>{selStation.label}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{selStation.sub}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, ...mono, color: 'rgba(255,255,255,0.45)' }}>
              {selCrew.length ? selCrew.map(c => `${c.name} (${c.state})`).join(' · ') : 'unmanned'}
            </span>
            <button onClick={() => setSelectedStation(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 15, cursor: 'pointer', padding: 2 }}>×</button>
          </div>
          {/* Fly-in facts (rules doc): who is here and their morale, what this
              station made in 24 h, what is blocking it, and Rush. Morale is the
              48 h success ratio — 'unknown' when no receipts, never a default. */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '9px 11px', marginBottom: 10, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 8.5, letterSpacing: 1.4, ...mono, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Crew</span>
              {selCrew.filter(c => !c.future).length === 0
                ? <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>nobody here</span>
                : selCrew.filter(c => !c.future).map(c => (
                    <span key={c.name} style={{ fontSize: 11, ...mono, color: c.color }}>
                      {c.name}
                      <span style={{ color: morale[c.name] == null ? 'rgba(255,255,255,0.4)' : morale[c.name] < 0.4 ? '#ff453a' : morale[c.name] > 0.8 ? '#30d158' : '#E5E5EA', marginLeft: 6 }}>
                        {morale[c.name] == null ? 'morale unknown' : `${Math.round(morale[c.name] * 100)}% morale`}
                      </span>
                    </span>
                  ))}
            </div>
            <span style={{ fontSize: 10, ...mono, color: 'rgba(255,255,255,0.5)' }}>
              OUTPUT <span style={{ color: selOut24 ? '#30d158' : 'rgba(255,255,255,0.4)' }}>{selOut24} receipts / 24h</span>
            </span>
            <span style={{ fontSize: 10, ...mono, color: 'rgba(255,255,255,0.5)' }}>
              BLOCKERS <span style={{ color: selBlockers.length || selIncident ? '#ff453a' : 'rgba(255,255,255,0.4)' }}>
                {selBlockers.length ? `${selBlockers.length} open` : selIncident ? `${selIncident.count} spread in` : 'none'}
              </span>
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
              {rushWhyNot && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{rushWhyNot}</span>}
              <button
                onClick={runRush}
                disabled={!!rushWhyNot}
                title={rushWhyNot || `Runs ${rushCfg?.action} now — a real agent action, once every 10 minutes`}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, ...mono, letterSpacing: 1,
                  cursor: rushWhyNot ? 'not-allowed' : 'pointer',
                  background: rushWhyNot ? 'rgba(255,255,255,0.04)' : 'rgba(255,69,58,0.15)',
                  border: `1px solid ${rushWhyNot ? 'rgba(255,255,255,0.12)' : 'rgba(255,69,58,0.45)'}`,
                  color: rushWhyNot ? 'rgba(255,255,255,0.3)' : '#ff453a',
                }}>{rushBusy ? 'RUSHING…' : 'RUSH'}</button>
            </div>
          </div>
          {rushResult && rushResult.stationId === selectedStation && (
            <div style={{ fontSize: 11, marginBottom: 10, padding: '8px 10px', borderRadius: 8, whiteSpace: 'pre-wrap',
              background: rushResult.ok ? 'rgba(48,209,88,0.08)' : 'rgba(255,69,58,0.08)',
              border: `1px solid ${rushResult.ok ? 'rgba(48,209,88,0.3)' : 'rgba(255,69,58,0.3)'}`,
              color: rushResult.ok ? '#30d158' : '#ff453a' }}>
              <span style={{ ...mono, fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.8 }}>{rushResult.ok ? 'Receipt' : 'Failed'} · </span>
              {rushResult.text}
            </div>
          )}
          {selReceipts.length === 0 ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>No receipts at this station in the last 48h — its lights stay off until real work lands here.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {selReceipts.map(e => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11 }}>
                  <span style={{ fontSize: 8.5, ...mono, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{fmtT(e.ts)}</span>
                  <span style={{ fontWeight: 700, color: '#2AABFF', whiteSpace: 'nowrap' }}>{e.agent_name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {(e.result_summary || e.action_key || '').slice(0, 110)}
                  </span>
                  {nameOf(e.client_id) && <span style={{ fontSize: 8.5, ...mono, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{nameOf(e.client_id)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
