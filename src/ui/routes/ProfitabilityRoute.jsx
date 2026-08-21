import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { useSupabaseRows } from '../../utils/hooks.js';

// ── Profitability Lite (v3 spec §3.D.4) ──────────────────────────────────────
// Retainer + invoiced project revenue MINUS hard costs (contractor, shoot,
// software) per client, by month. Labor allocation stays deferred per the cut
// list — fake precision is worse than no number. Every number here traces to a
// real row: clients.retainer_amount, invoices, client_costs.

const ACCENT = "#2AABFF";
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };
const input = { background: "#141414", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };

const CATEGORIES = ["contractor", "shoot", "software", "other"];
const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export default function ProfitabilityRoute({ isMobile, clients = [] }) {
  const activeClients = (clients || []).filter(c => c.status === "active");
  const now = new Date();
  const [month, setMonth] = useState(monthKey(now));
  const [costs, setCosts] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ client_id: "", label: "", category: "other", amount: "", incurred_on: now.toISOString().slice(0, 10) });

  const { rows: invoices } = useSupabaseRows(
    () => sb.from("invoices").select("client_id, amount, status, paid_at, created_at"),
    []
  );

  const loadCosts = useCallback(async () => {
    const { data, error } = await sb.from("client_costs").select("*").order("incurred_on", { ascending: false }).limit(500);
    if (error) {
      setErr(error.message.includes("client_costs")
        ? "The client_costs table isn't in the database yet — run supabase/migrations/20260821_phase_d.sql in the Supabase SQL editor."
        : error.message);
      return;
    }
    setErr(null);
    setCosts(data || []);
  }, []);
  useEffect(() => { loadCosts(); }, [loadCosts]);

  // Month options: current + previous 11.
  const monthOptions = useMemo(() => {
    const out = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ key: monthKey(d), label: d.toLocaleString("en-US", { month: "long", year: "numeric" }) });
    }
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-client math for the selected month. Honest sources, stated on-screen:
  // revenue = retainer (if active) + invoices PAID that month; costs = client_costs rows incurred that month.
  const table = useMemo(() => {
    const inMonth = (raw) => raw && monthKey(new Date(raw)) === month;
    const paidByClient = {};
    for (const inv of (invoices || [])) {
      if (inv?.status !== "paid" || !inMonth(inv.paid_at)) continue;
      paidByClient[inv.client_id] = (paidByClient[inv.client_id] || 0) + (Number(inv.amount) || 0);
    }
    const costByClient = {};
    for (const c of costs) {
      if (!inMonth(c.incurred_on)) continue;
      costByClient[c.client_id] = (costByClient[c.client_id] || 0) + (Number(c.amount) || 0);
    }
    const isCurrentOrPast = month <= monthKey(now);
    return activeClients.map(c => {
      const retainer = (c.retainer_status === "active" && isCurrentOrPast) ? (Number(c.retainer_amount) || 0) : 0;
      const projects = paidByClient[c.id] || 0;
      const hard = costByClient[c.id] || 0;
      const margin = retainer + projects - hard;
      return { id: c.id, name: c.name, retainer, projects, hard, margin };
    }).sort((a, b) => b.margin - a.margin);
  }, [activeClients, invoices, costs, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => table.reduce((t, r) => ({
    retainer: t.retainer + r.retainer, projects: t.projects + r.projects,
    hard: t.hard + r.hard, margin: t.margin + r.margin,
  }), { retainer: 0, projects: 0, hard: 0, margin: 0 }), [table]);

  const monthCosts = costs.filter(c => monthKey(new Date(c.incurred_on)) === month);

  const addCost = async (e) => {
    e.preventDefault();
    if (!form.client_id || !form.label.trim() || !Number(form.amount)) return;
    setBusy(true); setErr(null);
    const { error } = await sb.from("client_costs").insert({
      client_id: form.client_id, label: form.label.trim(), category: form.category,
      amount: Number(form.amount), incurred_on: form.incurred_on,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setForm(f => ({ ...f, label: "", amount: "" }));
    loadCosts();
  };

  const removeCost = async (id) => {
    const { error } = await sb.from("client_costs").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    loadCosts();
  };

  const th = { textAlign: "right", padding: "8px 10px", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
  const td = { textAlign: "right", padding: "9px 10px", fontSize: 13, color: "#f5f5f7", fontFamily: "'Geist Mono', monospace" };

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ ...head, fontSize: 9.5 }}>CLOUD SCENIC / ECONOMICS</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, margin: "6px 0 4px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 750, color: "#f5f5f7", margin: 0, fontFamily: "Inter, sans-serif", letterSpacing: -0.5, flex: 1 }}>Profitability</h1>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...input, width: "auto" }}>
          {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginBottom: 20, lineHeight: 1.5 }}>
        Retainer + project invoices paid in the month, minus hard costs. No labor estimates — that precision would be fake.
      </div>

      {err && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12.5, marginBottom: 14 }}>{err}</div>}

      {/* Per-client table */}
      <div style={{ ...card, padding: "6px 8px", marginBottom: 18, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Client</th>
              <th style={th}>Retainer</th>
              <th style={th}>Projects paid</th>
              <th style={th}>Hard costs</th>
              <th style={th}>Margin</th>
            </tr>
          </thead>
          <tbody>
            {table.map(r => (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ ...td, textAlign: "left", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>{r.name}</td>
                <td style={td}>{fmt(r.retainer)}</td>
                <td style={td}>{fmt(r.projects)}</td>
                <td style={{ ...td, color: r.hard ? "#ff9fb0" : td.color }}>{r.hard ? `-${fmt(r.hard)}` : "—"}</td>
                <td style={{ ...td, fontWeight: 700, color: r.margin >= 0 ? "#30d158" : "#ff453a" }}>{fmt(r.margin)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.14)" }}>
              <td style={{ ...td, textAlign: "left", fontFamily: "Inter, sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Total</td>
              <td style={td}>{fmt(totals.retainer)}</td>
              <td style={td}>{fmt(totals.projects)}</td>
              <td style={td}>{totals.hard ? `-${fmt(totals.hard)}` : "—"}</td>
              <td style={{ ...td, fontWeight: 750, color: totals.margin >= 0 ? "#30d158" : "#ff453a" }}>{fmt(totals.margin)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Hard-cost entry */}
      <div style={{ ...card, padding: 18 }}>
        <div style={{ ...head, marginBottom: 10 }}>HARD COSTS — {month}</div>
        <form onSubmit={addCost} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={{ ...input, flex: isMobile ? "1 1 100%" : "0 0 180px" }}>
            <option value="">Client…</option>
            {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="What was it (shooter day rate, editor, license…)" style={{ ...input, flex: "1 1 200px" }} />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...input, flex: "0 0 130px" }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min="0" step="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="$" style={{ ...input, flex: "0 0 100px" }} />
          <input type="date" value={form.incurred_on} onChange={e => setForm(f => ({ ...f, incurred_on: e.target.value }))} style={{ ...input, flex: "0 0 150px" }} />
          <button type="submit" disabled={busy || !form.client_id || !form.label.trim() || !Number(form.amount)}
            style={{ padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer", background: ACCENT, color: "#08131c", fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
            {busy ? "Adding…" : "Add cost"}
          </button>
        </form>
        {monthCosts.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 12.5, color: "#f5f5f7", fontFamily: "Inter, sans-serif", flex: 1 }}>
              {c.label}
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 8, fontSize: 11 }}>
                {(activeClients.find(x => x.id === c.client_id) || {}).name || "—"} · {c.category} · {c.incurred_on}
              </span>
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#ff9fb0", fontFamily: "'Geist Mono', monospace" }}>-{fmt(c.amount)}</span>
            <button onClick={() => removeCost(c.id)} title="Delete"
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>×</button>
          </div>
        ))}
        {!monthCosts.length && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>No hard costs recorded for this month.</div>}
      </div>
    </div>
  );
}
