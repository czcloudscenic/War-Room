import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { positionCrew, stationActivity, stationById, ROSTER } from '../../core/shipStations.js';
import ShipGame from '../ship/ShipGame.jsx';
import ShipWorld3D from '../ship/ShipWorld3D.jsx';
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
const card = { background: '#0f0d0e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 };
const DAY_MS = 86400000;

const fmtT = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ShipRoute({ isMobile, clients = [], content = [], setActiveNav }) {
  const [view, setView] = useState('3d'); // '3d' | 'map' | 'list'
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [backupOk, setBackupOk] = useState(null); // null = unknown
  const [selectedStation, setSelectedStation] = useState(null);
  const [tick, setTick] = useState(0); // re-applies the movement rule as receipts age
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
  const workingNow = commissioned.filter(c => c.state === 'working').length;

  const selStation = selectedStation ? stationById(selectedStation) : null;
  const selReceipts = selectedStation ? (activity[selectedStation] || []).slice(0, 12) : [];
  const selCrew = selectedStation ? crew.filter(c => c.station === selectedStation) : [];

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
            {toggle('3d', '3D View')}
            {toggle('map', 'Map View')}
            {toggle('list', 'List View')}
          </div>
        </div>
      </div>

      {/* System strip — Danny's top bar, real signals only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, ...mono, color: 'rgba(255,255,255,0.6)' }}>AGENT SHIP <span style={{ color: '#30d158' }}>// ONLINE</span></span>
        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 2, ...mono, color: 'rgba(255,255,255,0.45)' }}>
          SYSTEM STATUS <span style={{ color: backupOk === false ? '#ff453a' : backupOk ? '#30d158' : 'rgba(255,255,255,0.4)' }}>● {backupOk === false ? 'BACKUP FAILED' : backupOk ? 'NOMINAL' : '—'}</span>
        </span>
      </div>

      {view === 'list' ? (
        <AgentRail isMobile={isMobile} clients={clients} content={content} tasks={tasks} setActiveNav={setActiveNav} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 330px', gap: 14, alignItems: 'start' }}>
          <div>
            {view === '3d' && (HAS_WEBGL
              ? <ShipWorld3D crew={crew} activity={activity} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />
              : <ShipGame crew={crew} activity={activity} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />)}
            {view === 'map' && <ShipMap crew={crew} activity={activity} onStation={(id) => setSelectedStation(id === selectedStation ? null : id)} selectedStation={selectedStation} />}

            {/* Mission bar — real numbers only */}
            <div style={{ display: 'flex', marginTop: 14, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: '#0f0d0e' }}>
              {[
                ['Active agents', `${commissioned.filter(c => c.receipts48h > 0).length}/${commissioned.length}`, '#2AABFF'],
                ['Working now', String(workingNow), workingNow ? '#30d158' : 'rgba(255,255,255,0.5)'],
                ['Done 48h', String(events.length), '#30d158'],
                ['Blocked', String((content || []).filter(x => (x.block_reason || x.qc_status === 'blocked') && !['Posted', 'Scrapped'].includes(x.status)).length), '#f97316'],
                ['Approvals', String((content || []).filter(x => ['Need Copy Approval', 'Need Content Approval'].includes(x.status)).length), '#bf5af2'],
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
