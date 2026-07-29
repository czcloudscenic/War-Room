import React, { useEffect, useState } from "react";
import { data } from "./api.js";

// The Dynasty Ops Manager surface. Generate the live briefing on demand, review
// draft nudges, and tune the (still-off) autonomous settings. Sends nothing.
export function OpsManagerPage() {
  const [brief, setBrief] = useState(null);
  const [cfg, setCfg] = useState({ enabled: false, nudge_mode: "draft", stale_hours: 48, cold_days: 3 });
  const [updated, setUpdated] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const loadLast = () => data("ops_last").then((d) => { setBrief(d.brief); setCfg((c) => ({ ...c, ...d.cfg })); setUpdated(d.updated_at); }).catch(() => {});
  useEffect(() => { loadLast(); }, []);

  const generate = async () => {
    setBusy("gen"); setErr("");
    try { const b = await data("ops_brief"); setBrief(b); setUpdated(new Date().toISOString()); }
    catch (e) { setErr(e.message); }
    setBusy("");
  };
  const saveCfg = async (patch) => {
    const next = { ...cfg, ...patch }; setCfg(next);
    try { await data("ops_config", { config: patch }); } catch (e) { setErr(e.message); }
  };
  const copy = (t) => navigator.clipboard?.writeText(t);

  const h = brief?.health || {};
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="h1">Ops Manager</h1>
          <div className="h1sub">The pipeline's daily read. Who's slipping, what's at risk, what to do. Generates on demand, sends nothing yet.</div>
        </div>
        <button className="btn" disabled={busy === "gen"} onClick={generate}>{busy === "gen" ? "Reading the pipeline…" : "Generate briefing"}</button>
      </div>
      {err && <div className="banner" style={{ marginTop: 14 }}>{err}</div>}

      {/* status banner — autonomy is OFF */}
      <div className="banner warn" style={{ marginTop: 14 }}>
        Autonomous mode is <b>{cfg.enabled ? "ON" : "OFF"}</b> and rep nudges are <b>{cfg.nudge_mode}</b>. Right now this is manual and inspect-only. Nothing is emailed or texted.
      </div>

      {brief ? (
        <>
          <div className="card" style={{ marginTop: 14 }}>
            <div className="sub" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Today · {brief.day || ""}{updated ? ` · updated ${new Date(updated).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" })}` : ""}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{brief.headline}</div>
          </div>

          <div className="stats" style={{ marginTop: 12 }}>
            <div className="stat"><div className="l">Touches today</div><div className="n">{h.touches_today ?? "—"}</div><div className="foot">{h.reps_quiet_today ?? 0} reps quiet</div></div>
            <div className="stat"><div className="l">Hot leads untouched</div><div className="n accent">{h.untouched_hot_total ?? "—"}</div><div className="foot">best leads, not called</div></div>
            <div className="stat"><div className="l">Overdue callbacks</div><div className="n">{h.overdue_callbacks_total ?? "—"}</div><div className="foot">across the team</div></div>
            <div className="stat"><div className="l">Booked / Closed 7d</div><div className="n">{h.booked_7d ?? 0} / {h.closed_7d ?? 0}</div><div className="foot">{h.assigned_open ?? 0} open leads</div></div>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="ct">Do this today</div>
            <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {(brief.top_actions || []).map((a, i) => <li key={i} style={{ marginBottom: 7 }}>{a}</li>)}
              {!(brief.top_actions || []).length && <div className="sub">No actions.</div>}
            </ul>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
            <div className="card">
              <div className="ct">Reps needing a look</div>
              <div style={{ marginTop: 8 }}>
                {(brief.rep_flags || []).map((f, i) => (
                  <div key={i} style={{ padding: "8px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                    <div style={{ fontWeight: 600 }}>{f.rep}</div>
                    <div className="sub">{f.issue}</div>
                    <div style={{ fontSize: 12.5, color: "var(--accent-bright)", marginTop: 2 }}>{f.suggest}</div>
                  </div>
                ))}
                {!(brief.rep_flags || []).length && <div className="sub">Everyone's on track.</div>}
              </div>
            </div>
            <div className="card">
              <div className="ct">Draft nudges</div>
              <div className="cs">Copy and send if you want. Nothing goes out on its own.</div>
              <div style={{ marginTop: 10 }}>
                {(brief.nudge_drafts || []).map((n, i) => (
                  <div key={i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 600 }}>{n.rep}</div>
                      <button className="act" onClick={() => copy(n.message)}>Copy</button>
                    </div>
                    <div className="sub" style={{ marginTop: 3 }}>{n.message}</div>
                  </div>
                ))}
                {!(brief.nudge_drafts || []).length && <div className="sub">No nudges needed.</div>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ marginTop: 14 }}><div className="sub">No briefing yet. Tap "Generate briefing" to read the pipeline.</div></div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="ct">Settings</div>
        <div className="cs">Tune the thresholds. Autonomous sending stays off until you turn it on (and email pause is lifted).</div>
        <div className="row" style={{ marginTop: 12, gap: 16 }}>
          <label className="sub">Stale after (hours) <input className="din" style={{ width: 70, marginLeft: 6 }} type="number" value={cfg.stale_hours} onChange={(e) => saveCfg({ stale_hours: Number(e.target.value) })} /></label>
          <label className="sub">Cold after (days) <input className="din" style={{ width: 70, marginLeft: 6 }} type="number" value={cfg.cold_days} onChange={(e) => saveCfg({ cold_days: Number(e.target.value) })} /></label>
          <label className="sub">Rep nudges
            <select className="din" style={{ width: 130, marginLeft: 6 }} value={cfg.nudge_mode} onChange={(e) => saveCfg({ nudge_mode: e.target.value })}>
              <option value="off">Off</option><option value="draft">Draft only</option><option value="auto">Auto (later)</option>
            </select>
          </label>
        </div>
      </div>
    </>
  );
}
