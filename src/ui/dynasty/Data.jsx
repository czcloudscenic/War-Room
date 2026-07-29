import React, { useEffect, useState } from "react";
import { data } from "./api.js";

const AUDIT_LABEL = {
  login: "Login", export: "Export", capture: "Market scan", assign: "Assignment",
  stage_change: "Status change", note: "Note", callback: "Callback", next_action: "Next action",
  suppress: "Suppressed", suppression_change: "Suppression change", merge: "Merge",
  duplicate_blocked: "Dupe blocked", archive: "Archive", restore: "Restore",
  team_add: "Member added", team_rotate: "Code rotated", team_deactivate: "Member toggled",
  refill: "Refill", refill_started: "Refill started",
};

export function DataPage() {
  const [c, setC] = useState(null);
  const [clusters, setClusters] = useState(null);
  const [picked, setPicked] = useState({});
  const [audit, setAudit] = useState([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const loadCounters = () => data("counters").then(setC).catch(() => {});
  const loadAudit = (act) => data("audit_list", act ? { act } : {}).then((d) => setAudit(d.rows || [])).catch(() => {});
  useEffect(() => { loadCounters(); loadAudit(); }, []);

  const scan = async () => {
    setBusy("scan"); setMsg("");
    try { const r = await data("dedupe_scan"); setClusters(r.clusters); setPicked(Object.fromEntries(r.clusters.map((_, i) => [i, true]))); setMsg(`Scanned ${r.scanned} leads — ${r.clusters.length} duplicate clusters found.`); }
    catch (e) { setMsg(e.message); }
    setBusy("");
  };
  const apply = async () => {
    const chosen = clusters.filter((_, i) => picked[i]).map((cl) => cl.leads.map((l) => l.id));
    if (!chosen.length) return;
    setBusy("apply");
    try { const r = await data("dedupe_apply", { clusters: chosen }); setMsg(`Merged ${r.merged} duplicate records. History preserved.`); setClusters(null); loadCounters(); }
    catch (e) { setMsg(e.message); }
    setBusy("");
  };

  const COUNTERS = c ? [
    ["Verified hiring signal", `${c.hiring_verified} of ${c.total}`, c.hiring_verified === 0 ? "no verified postings" : "dated + linkable"],
    ["Suppressed", c.suppressed, c.suppressed === 0 ? "awaiting list" : "blocked"],
    ["Last WurkNow sync", c.wurknow_last_sync || "—", c.wurknow_last_sync ? "" : "never"],
    ["Duplicates merged", c.duplicates_merged, "history kept"],
    ["Full contact names", `${c.full_names} of ${c.total}`, "first+last"],
    ["Unconfirmed branch", c.unconfirmed_branch, "awaiting confirmation"],
    ["Reps with a login", c.reps_with_login, c.reps_with_login === 0 ? "roster pending" : ""],
    ["Leads with no owner", c.no_owner, "unassigned"],
  ] : [];

  return (
    <>
      <h1 className="h1">Data &amp; Audit</h1>
      <div className="h1sub">The truth counters, duplicate control, and every human action on the system.</div>
      {msg && <div className="banner" style={{ marginTop: 14 }}>{msg}</div>}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="ct">Truth counters</div>
          <button className="act" onClick={loadCounters}>Refresh</button>
        </div>
        <div className="counters" style={{ marginTop: 12 }}>
          {COUNTERS.map(([l, v, f]) => (
            <div className="counter" key={l}><div className="l">{l}</div><div className="cv mono">{v}</div>{f ? <div className="foot">{f}</div> : null}</div>
          ))}
          {!c && <div className="sub">Loading…</div>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><div className="ct">Duplicate control</div><div className="cs">Merge duplicate companies, preserving all history. Never deletes.</div></div>
          {!clusters ? <button className="btn" disabled={busy === "scan"} onClick={scan}>{busy === "scan" ? "Scanning…" : "Scan for duplicates"}</button>
            : <button className="btn" disabled={busy === "apply"} onClick={apply}>{busy === "apply" ? "Merging…" : `Merge ${Object.values(picked).filter(Boolean).length} selected`}</button>}
        </div>
        {clusters && (
          <div style={{ marginTop: 12 }}>
            {clusters.map((cl, i) => (
              <div key={i} className="row" style={{ alignItems: "flex-start", padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked({ ...picked, [i]: e.target.checked })} style={{ marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  {cl.leads.map((l) => (
                    <div key={l.id} className="sub" style={{ color: l.id === cl.survivor ? "var(--accent-bright)" : undefined }}>
                      {l.id === cl.survivor ? "keep · " : "merge · "}{l.business} <span className="sub">({l.city || "?"}{l.contact ? " · " + l.contact : ""})</span>
                    </div>
                  ))}
                </div>
                {cl.cross_branch && <span className="tag warn">cross-branch</span>}
              </div>
            ))}
            {!clusters.length && <div className="sub" style={{ marginTop: 10 }}>No duplicates found.</div>}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="ct">Audit log</div>
          <select className="din" style={{ width: 190 }} value={filter} onChange={(e) => { setFilter(e.target.value); loadAudit(e.target.value); }}>
            <option value="">All actions</option>
            {Object.entries(AUDIT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>
              {audit.map((r) => (
                <tr key={r.id}>
                  <td className="sub mono">{new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td>{r.actor_name || "—"}</td>
                  <td><span className="tag">{AUDIT_LABEL[r.action] || r.action}</span></td>
                  <td className="sub">{r.business || (r.detail ? JSON.stringify(r.detail).slice(0, 80) : "")}</td>
                </tr>
              ))}
              {!audit.length && <tr><td colSpan={4} className="sub" style={{ padding: 24, textAlign: "center" }}>No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
