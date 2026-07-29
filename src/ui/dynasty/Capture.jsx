import React, { useEffect, useState } from "react";
import { api, data } from "./api.js";
import { BRANCHES } from "./branches.js";

export const VLABEL = {
  warehouse: "Warehouse", distribution: "Distribution", threepl: "3PL / Logistics",
  coldstorage: "Cold Storage", manufacturing: "Manufacturing",
  food_processing: "Food Processing", packaging: "Packaging / Co-Pack",
};

// Lead Capture — the market-scan engine. This is the machinery Dynasty never
// sees. Runs a scan by branch/vertical, then enriches in the background.
export function Capture() {
  const [vertical, setVertical] = useState("warehouse");
  const [branch, setBranch] = useState("commerce");
  const [target, setTarget] = useState(250);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [budget, setBudget] = useState(null);

  const loadBudget = () => data("places_budget").then(setBudget).catch(() => {});
  useEffect(() => { loadBudget(); }, []);

  const runScan = async () => {
    setBusy("scan"); setMsg("");
    try {
      const r = await api("/api/scrape", { vertical, branch }).then((x) => x.json());
      setMsg(`Market scan — ${VLABEL[vertical]} across ${BRANCHES.find((b) => b.key === branch)?.label}: ${r.total} found, ${r.inserted} new. Enriching…`);
      loadBudget();
      backgroundEnrich();
    } catch (e) { setMsg(`Scan failed: ${e.message}`); }
    setBusy("");
  };

  async function backgroundEnrich() {
    setBusy("enrich");
    try {
      for (let i = 0; i < 8; i++) {
        const r = await api("/api/enrich", { limit: 10 }).then((x) => x.json()).catch(() => null);
        if (!r || r.remaining === 0 || r.processed === 0) break;
      }
      api("/api/enrich-deep", { limit: 20 }).catch(() => {});
      setMsg("Contacts enriched. Deep contact pass running in the background.");
    } catch { /* best-effort */ }
    setBusy("");
  }

  const refill = async () => {
    setBusy("refill"); setMsg("");
    try {
      await data("refill_now", { target: Number(target) || 250 });
      setMsg(`Pipeline refill started (target ${target}). New leads land + auto-assign over the next ~10 minutes.`);
      setTimeout(loadBudget, 30000);
    } catch (e) { setMsg(`Refill failed: ${e.message}`); }
    setBusy("");
  };

  const pct = budget ? Math.round((budget.used / budget.cap) * 100) : 0;
  return (
    <>
      <h1 className="h1">Lead Capture</h1>
      <div className="h1sub">The market-scan engine. Cloud Scenic only — Dynasty never sees this surface.</div>
      {msg && <div className="banner" style={{ marginTop: 14 }}>{msg}</div>}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <div className="card">
          <div className="ct">Run a market scan</div>
          <div className="cs">One vertical across a branch's whole city belt.</div>
          <div className="grid" style={{ marginTop: 14, gap: 10 }}>
            <select className="din" value={vertical} onChange={(e) => setVertical(e.target.value)}>
              {Object.entries(VLABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="din" value={branch} onChange={(e) => setBranch(e.target.value)}>
              {BRANCHES.map((b) => <option key={b.key} value={b.key}>{b.label}, {b.state}</option>)}
            </select>
            <button className="btn" disabled={busy === "scan"} onClick={runScan}>{busy === "scan" ? "Scanning…" : "Run Market Scan"}</button>
          </div>
        </div>

        <div className="card">
          <div className="ct">Pipeline refill</div>
          <div className="cs">Scan all branches to a target, enrich, auto-assign to active reps.</div>
          <div className="grid" style={{ marginTop: 14, gap: 10 }}>
            <input className="din" type="number" min="10" max="500" value={target} onChange={(e) => setTarget(e.target.value)} />
            <button className="btn" disabled={busy === "refill"} onClick={refill}>{busy === "refill" ? "Starting…" : "Run Pipeline Refill"}</button>
            <button className="act" onClick={() => api("/api/enrich-deep", { limit: 40 }).then(() => setMsg("Deep contact pass kicked.")).catch((e) => setMsg(e.message))}>Deep contact pass</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, maxWidth: 460 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="ct">Places API budget (today)</div>
          <button className="act" onClick={loadBudget}>Refresh</button>
        </div>
        {budget ? (
          <>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 10, fontSize: 13 }}>
              <span className="sub">{budget.used} used</span><span className="sub mono">{budget.remaining} of {budget.cap} left</span>
            </div>
            <div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${pct}%` }} /></div>
          </>
        ) : <div className="sub" style={{ marginTop: 10 }}>Loading…</div>}
      </div>
    </>
  );
}
