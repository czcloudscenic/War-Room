import React, { useEffect, useRef, useState } from "react";
import { data } from "./api.js";

const REASONS = [
  ["existing_client", "Existing client"], ["active_negotiation", "Active negotiation"],
  ["do_not_contact", "Do not contact"], ["duplicate", "Duplicate"],
  ["competitor", "Competitor"], ["needs_approval", "Needs approval"],
];

// Parse a CSV into {company,domain,phone,reason} rows. Tolerant headers.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (l) => { const out = []; let cur = "", q = false; for (const c of l) { if (c === '"') q = !q; else if (c === "," && !q) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out.map((s) => s.trim().replace(/^"|"$/g, "")); };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const idx = (names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const ci = idx(["company", "name", "business", "employer"]);
  const di = idx(["domain", "website", "url", "site"]);
  const pi = idx(["phone", "tel"]);
  const ri = idx(["reason", "type", "status"]);
  const hasHeader = ci >= 0 || di >= 0 || pi >= 0;
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((l) => {
    const c = split(l);
    return {
      company: ci >= 0 ? c[ci] : c[0],
      domain: di >= 0 ? c[di] : "",
      phone: pi >= 0 ? c[pi] : "",
      reason: ri >= 0 ? c[ri] : "",
    };
  }).filter((r) => r.company || r.domain || r.phone);
}

export function SuppressionPage() {
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState([]);
  const [preview, setPreview] = useState(null);
  const [source, setSource] = useState("csv_import");
  const [manual, setManual] = useState({ company: "", domain: "", phone: "", reason: "existing_client" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);

  const load = () => {
    data("suppression_summary").then(setSummary).catch(() => {});
    data("suppression_list").then((d) => setList(d.rows || [])).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const onFile = async (f) => {
    if (!f) return;
    const text = await f.text();
    setPreview(parseCsv(text));
  };
  const doImport = async () => {
    if (!preview?.length) return;
    setBusy("import"); setMsg("");
    try {
      const r = await data("suppression_import", { rows: preview, source });
      setMsg(`Imported ${r.added}, skipped ${r.skipped} already-listed.`);
      setPreview(null); if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) { setMsg(e.message); }
    setBusy("");
  };
  const addManual = async (e) => {
    e.preventDefault();
    if (!manual.company && !manual.domain && !manual.phone) return;
    setBusy("add");
    try { await data("suppression_add", manual); setManual({ company: "", domain: "", phone: "", reason: "existing_client" }); load(); }
    catch (e2) { setMsg(e2.message); }
    setBusy("");
  };
  const remove = async (id) => { await data("suppression_remove", { id }).catch(() => {}); load(); };
  const sweep = async () => {
    if (!confirm("Retroactively archive any leads already in the pool that match the suppression list?")) return;
    setBusy("sweep"); setMsg("");
    try { const r = await data("suppression_sweep"); setMsg(`Swept ${r.swept} matching leads out of the pool.`); load(); }
    catch (e) { setMsg(e.message); }
    setBusy("");
  };

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="h1">Suppression</h1>
          <div className="h1sub">Dynasty's protected companies. Filtered at capture time — they never enter the pool.</div>
        </div>
        <button className="act bad" disabled={busy === "sweep"} onClick={sweep}>{busy === "sweep" ? "Sweeping…" : "Run retroactive sweep"}</button>
      </div>
      {msg && <div className="banner" style={{ marginTop: 14 }}>{msg}</div>}

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><div className="l">Protected companies</div><div className="n accent">{summary?.protected_entries ?? "—"}</div><div className="foot">on the list</div></div>
        <div className="stat"><div className="l">Blocked at capture</div><div className="n">{summary?.blocked_at_capture ?? "—"}</div><div className="foot">never entered</div></div>
        <div className="stat"><div className="l">Removed by sweep</div><div className="n">{summary?.removed_by_sweep ?? "—"}</div><div className="foot">caught later</div></div>
        <div className="stat"><div className="l">Last WurkNow sync</div><div className="n" style={{ fontSize: 15 }}>{summary?.wurknow_last_sync || "never"}</div><div className="foot">CSV import updates this</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", marginTop: 14 }}>
        <div className="card">
          <div className="ct">Import client list (CSV)</div>
          <div className="cs">Columns auto-detected: company / domain / phone / reason. Default reason: existing client.</div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <select className="din" style={{ width: 160 }} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="csv_import">Manual CSV</option>
              <option value="wurknow">WurkNow export (sets sync date)</option>
            </select>
          </div>
          <div className="dropzone" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
            {preview ? `${preview.length} rows ready to import` : "Click to choose a CSV file"}
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => onFile(e.target.files[0])} />
          {preview && (
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <button className="btn" disabled={busy === "import"} onClick={doImport}>{busy === "import" ? "Importing…" : `Import ${preview.length}`}</button>
              <button className="act" onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}>Cancel</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="ct">Add one manually</div>
          <form onSubmit={addManual} className="grid" style={{ marginTop: 12, gap: 8 }}>
            <input className="din" placeholder="Company" value={manual.company} onChange={(e) => setManual({ ...manual, company: e.target.value })} />
            <input className="din" placeholder="Domain (optional)" value={manual.domain} onChange={(e) => setManual({ ...manual, domain: e.target.value })} />
            <input className="din" placeholder="Phone (optional)" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} />
            <select className="din" value={manual.reason} onChange={(e) => setManual({ ...manual, reason: e.target.value })}>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn" type="submit" disabled={busy === "add"}>Add to suppression</button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="ct">Active list · {list.length}</div>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table>
            <thead><tr><th>Company</th><th>Domain</th><th>Phone</th><th>Reason</th><th>Source</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td>{r.company || "—"}</td><td className="sub">{r.domain || "—"}</td><td className="mono">{r.phone || "—"}</td>
                  <td><span className="tag">{(REASONS.find(([v]) => v === r.reason) || [])[1] || r.reason}</span></td>
                  <td className="sub">{r.source}</td>
                  <td><button className="act bad" onClick={() => remove(r.id)}>Remove</button></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="sub" style={{ padding: 24, textAlign: "center" }}>Empty — import a client list to start protecting the pipeline.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
