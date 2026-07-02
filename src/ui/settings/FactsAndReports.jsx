import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

// ── Facts of Record + Monthly Reports (Setup sections 5 & 6) ──────────────────
// Facts of Record: the per-client source of truth the QC agent exact-matches
// against — hours, locations, prices, offers, operational facts. Stale facts are
// worse than no QC, so the editor stamps facts_updated_at on every save and the
// header shows a staleness badge past 30 days. Owner: Sebastian.
//
// Monthly Reports: the semi-auto Sprout flow. Drop the month's PDF here; the
// send-monthly-reports cron emails it to clients.primary_email from the 1st and
// logs the send in client_reports.

const ACCENT = "#2AABFF";
const label = { fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6 };
const input = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };
const smallBtn = (active) => ({ fontSize: 11, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "Inter, sans-serif", background: active ? "rgba(42,171,255,0.15)" : "rgba(255,255,255,0.04)", border: active ? "1px solid rgba(42,171,255,0.4)" : "1px solid rgba(255,255,255,0.12)", color: active ? ACCENT : "rgba(255,255,255,0.55)" });

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const emptyFacts = () => ({ hours: { exceptions: [] }, locations: [], prices: [], offers: [], operational_facts: [] });

function staleDays(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

export function factsFilled(c) {
  const f = c?.client_facts;
  if (!f || typeof f !== "object") return false;
  return Boolean(
    (f.hours && DAYS.some(d => f.hours[d])) ||
    (Array.isArray(f.locations) && f.locations.length) ||
    (Array.isArray(f.prices) && f.prices.length) ||
    (Array.isArray(f.offers) && f.offers.length) ||
    (Array.isArray(f.operational_facts) && f.operational_facts.length)
  );
}

// ── Facts of Record editor ────────────────────────────────────────────────────
export function FactsOfRecord({ clients = [] }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(clients || []).map(c => (
        <ClientFactsCard key={c.id} client={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />
      ))}
      {(clients || []).length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No active clients yet.</div>}
    </div>
  );
}

function ClientFactsCard({ client, open, onToggle }) {
  const [facts, setFacts] = useState(() => ({ ...emptyFacts(), ...(client.client_facts || {}) }));
  const [savedAt, setSavedAt] = useState(client.facts_updated_at || null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Re-sync if the client row updates from elsewhere (realtime) and we're clean.
  useEffect(() => {
    if (!dirty) {
      setFacts({ ...emptyFacts(), ...(client.client_facts || {}) });
      setSavedAt(client.facts_updated_at || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.client_facts, client.facts_updated_at]);

  const upd = (fn) => { setFacts(f => { const n = structuredClone(f); fn(n); return n; }); setDirty(true); };
  const stale = staleDays(savedAt);
  const filled = factsFilled({ client_facts: facts });

  async function save() {
    setSaving(true); setErr(null);
    const facts_updated_at = new Date().toISOString();
    const { error } = await sb.from("clients").update({ client_facts: facts, facts_updated_at }).eq("id", client.id);
    if (error) setErr(error.message);
    else { setSavedAt(facts_updated_at); setDirty(false); }
    setSaving(false);
  }

  const rowStyle = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: client.brand_color || ACCENT, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f7", flex: 1 }}>{client.name}</span>
        {filled && stale != null && stale > 30 && <span style={{ fontSize: 9.5, fontWeight: 700, color: "#ff9f0a", background: "rgba(255,159,10,0.1)", border: "1px solid rgba(255,159,10,0.3)", borderRadius: 4, padding: "2px 7px", textTransform: "uppercase", letterSpacing: 0.5 }}>stale · {stale}d</span>}
        {filled
          ? <span style={{ fontSize: 10.5, fontFamily: "'Geist Mono', monospace", color: "#30d158" }}>{savedAt ? `updated ${new Date(savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "on file"}</span>
          : <span style={{ fontSize: 10.5, fontFamily: "'Geist Mono', monospace", color: "rgba(255,159,10,0.8)" }}>no facts — QC runs typo/brand only</span>}
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && (
        <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Hours */}
          <div>
            <label style={label}>Hours (as they should appear — e.g. "10am–12am", "closed")</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {DAYS.map(d => (
                <div key={d}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", fontFamily: "'Geist Mono', monospace", marginBottom: 3 }}>{d}</div>
                  <input style={input} value={facts.hours?.[d] || ""} onChange={e => upd(f => { f.hours = f.hours || {}; f.hours[d] = e.target.value; })} placeholder="—" />
                </div>
              ))}
            </div>
            <input style={{ ...input, marginTop: 8 }} value={(facts.hours?.exceptions || []).join("; ")}
              onChange={e => upd(f => { f.hours = f.hours || {}; f.hours.exceptions = e.target.value.split(";").map(s => s.trim()).filter(Boolean); })}
              placeholder="Exceptions, semicolon-separated — e.g. Jul 4: 10am–5pm; Closed Thanksgiving" />
          </div>

          {/* Locations */}
          <ListEditor
            title="Locations" rows={facts.locations || []}
            cols={[{ key: "address", ph: "Address", flex: 2 }, { key: "phone", ph: "Phone", flex: 1 }]}
            onChange={rows => upd(f => { f.locations = rows; })}
            addLabel="+ Add location" rowStyle={rowStyle}
          />

          {/* Prices */}
          <ListEditor
            title="Prices of record" rows={facts.prices || []}
            cols={[{ key: "item", ph: "Item (e.g. Chicken Gyro)", flex: 2 }, { key: "price", ph: "Price (e.g. 13.99)", flex: 1 }]}
            onChange={rows => upd(f => { f.prices = rows.map(r => ({ ...r, updated: r.updated || new Date().toISOString().slice(0, 10) })); })}
            addLabel="+ Add price" rowStyle={rowStyle}
          />

          {/* Offers */}
          <ListEditor
            title="Active offers (QC hard-blocks anything referencing an expired one)" rows={facts.offers || []}
            cols={[{ key: "name", ph: "Offer name", flex: 2 }, { key: "valid_from", ph: "", flex: 1, type: "date" }, { key: "valid_to", ph: "", flex: 1, type: "date" }]}
            onChange={rows => upd(f => { f.offers = rows; })}
            addLabel="+ Add offer" rowStyle={rowStyle}
          />

          {/* Operational facts */}
          <div>
            <label style={label}>Operational facts (one per line — parking, delivery radius, staffing claims…)</label>
            <textarea style={{ ...input, minHeight: 64, resize: "vertical" }} value={(facts.operational_facts || []).join("\n")}
              onChange={e => upd(f => { f.operational_facts = e.target.value.split("\n").map(s => s.trim()).filter(Boolean); })} />
          </div>

          {err && <div style={{ fontSize: 11.5, color: "#ff453a" }}>{err}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" disabled={!dirty || saving} onClick={save}
              style={{ fontSize: 12, fontWeight: 600, padding: "9px 18px", borderRadius: 8, border: "none", cursor: (!dirty || saving) ? "default" : "pointer", background: (!dirty || saving) ? "rgba(255,255,255,0.08)" : ACCENT, color: (!dirty || saving) ? "rgba(255,255,255,0.4)" : "#fff" }}>
              {saving ? "Saving…" : dirty ? "Save facts" : "Saved ✓"}
            </button>
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>Owner: {client.facts_owner || "Sebastian"} · when facts change in the real world, this record changes first.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ListEditor({ title, rows = [], cols, onChange, addLabel, rowStyle }) {
  const set = (i, key, val) => { const n = rows.map((r, j) => j === i ? { ...r, [key]: val } : r); onChange(n); };
  const del = (i) => onChange(rows.filter((_, j) => j !== i));
  const add = () => onChange([...rows, Object.fromEntries(cols.map(c => [c.key, ""]))]);
  return (
    <div>
      <label style={label}>{title}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={rowStyle}>
            {cols.map(c => (
              <input key={c.key} type={c.type || "text"} style={{ ...input, flex: c.flex, minWidth: 110 }} value={r[c.key] || ""} placeholder={c.ph} onChange={e => set(i, c.key, e.target.value)} />
            ))}
            <button type="button" onClick={() => del(i)} style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={add} style={{ alignSelf: "flex-start", fontSize: 11, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>{addLabel}</button>
      </div>
    </div>
  );
}

// ── Monthly reports ───────────────────────────────────────────────────────────
export function MonthlyReports({ clients = [] }) {
  const [reports, setReports] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const prevMonth = useMemo(() => {
    const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  }, []);
  const [month, setMonth] = useState(prevMonth);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await sb.from("client_reports").select("*").order("month", { ascending: false });
      if (!cancelled && Array.isArray(data)) setReports(data);
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggleSchedule(c) {
    const next = c.report_schedule === "monthly_1st" ? null : "monthly_1st";
    await sb.from("clients").update({ report_schedule: next }).eq("id", c.id);
  }

  async function upload(c, file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { setMsg({ id: c.id, ok: false, text: "PDF only — export it from Sprout first." }); return; }
    setBusy(c.id); setMsg(null);
    try {
      const path = `${c.id}/${month}.pdf`;
      const { error: upErr } = await sb.storage.from("client-reports").upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw new Error(upErr.message);
      const { data: row, error: rowErr } = await sb.from("client_reports")
        .upsert({ client_id: c.id, month, pdf_path: path, sent_at: null, send_error: null }, { onConflict: "client_id,month" })
        .select().single();
      if (rowErr) throw new Error(rowErr.message);
      setReports(prev => [row, ...prev.filter(r => !(r.client_id === c.id && r.month === month))]);
      setMsg({ id: c.id, ok: true, text: `${month} report loaded — sends automatically on the 1st (or tonight if the 1st already passed).` });
    } catch (e) {
      setMsg({ id: c.id, ok: false, text: "Upload failed: " + e.message });
    } finally { setBusy(null); }
  }

  const recurring = (clients || []).filter(c => c.lane !== "brief");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ ...label, marginBottom: 0 }}>Report month</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...input, width: 160 }} />
      </div>
      {recurring.map(c => {
        const rows = reports.filter(r => r.client_id === c.id).slice(0, 4);
        const auto = c.report_schedule === "monthly_1st";
        return (
          <div key={c.id} style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.brand_color || ACCENT, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f5f7", flex: 1, minWidth: 120 }}>{c.name}</span>
              <button type="button" onClick={() => toggleSchedule(c)} style={smallBtn(auto)}>{auto ? "Auto-send: on (1st)" : "Auto-send: off"}</button>
              <label style={{ ...smallBtn(false), cursor: busy === c.id ? "wait" : "pointer" }}>
                {busy === c.id ? "Uploading…" : `Upload ${month} PDF`}
                <input type="file" accept="application/pdf,.pdf" style={{ display: "none" }} disabled={busy === c.id}
                  onChange={e => { upload(c, e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {!c.primary_email && <span style={{ fontSize: 10, color: "#ff9f0a" }}>no client email on file — set primary_email or it mails the team</span>}
            </div>
            {msg && msg.id === c.id && <div style={{ fontSize: 11.5, marginTop: 8, color: msg.ok ? "#30d158" : "#ff453a" }}>{msg.text}</div>}
            {rows.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                {rows.map(r => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, fontFamily: "'Geist Mono', monospace" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)", width: 64 }}>{r.month}</span>
                    {r.sent_at
                      ? <span style={{ color: "#30d158" }}>✓ sent {new Date(r.sent_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} → {r.sent_to || "client"}</span>
                      : r.send_error
                        ? <span style={{ color: "#ff453a" }}>send failed: {r.send_error}</span>
                        : <span style={{ color: "#ff9f0a" }}>queued — sends on the 1st</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {recurring.length === 0 && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No recurring clients.</div>}
    </div>
  );
}
