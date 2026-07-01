import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

// ── Billing & Invoices ────────────────────────────────────────────────────────
// Manual invoice tracking, built Stripe-ready. Create/send/mark-paid invoices,
// track Outstanding / Paid / Overdue / MRR. The stripe_* columns exist but are
// unused — wiring Stripe later is a flip, not a rebuild.

const ACCENT = "#2AABFF";
const STATUS_COLOR = { paid: "#30d158", sent: "#64d2ff", overdue: "#ff453a", draft: "rgba(255,255,255,0.45)", void: "rgba(255,255,255,0.3)" };

function fmtMoney(n) { return "$" + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function fmtDate(d) { if (!d) return "—"; const t = new Date(d); return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function effectiveStatus(inv) {
  if (inv.status === "sent" && inv.due_date && new Date(inv.due_date).getTime() < Date.now()) return "overdue";
  return inv.status;
}
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const input = { width: "100%", background: "#161314", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };

function StatCard({ value, label, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: "18px 20px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: 9, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function BillingRoute({ isMobile, clients = [] }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ client_id: "", amount: "", due_date: "", description: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => { const { data } = await sb.from("invoices").select("*").order("created_at", { ascending: false }); if (Array.isArray(data)) setInvoices(data); setLoading(false); };
  useEffect(() => { load(); }, []);

  const clientName = (id) => { const c = clients.find(x => x.id === id); return c ? c.name : "—"; };
  const activeMRR = clients.filter(c => c.status === "active").reduce((s, c) => s + (Number(c.retainer_amount) || 0), 0);

  const stats = useMemo(() => {
    let outstanding = 0, overdue = 0, paid30 = 0;
    const now = Date.now();
    for (const inv of invoices) {
      const st = effectiveStatus(inv);
      const amt = Number(inv.amount) || 0;
      if (st === "sent" || st === "overdue") outstanding += amt;
      if (st === "overdue") overdue += amt;
      if (inv.status === "paid" && inv.paid_at && new Date(inv.paid_at).getTime() >= now - 30 * 86400000) paid30 += amt;
    }
    return { outstanding, overdue, paid30 };
  }, [invoices]);

  async function createInvoice(send) {
    if (!form.client_id || !form.amount) { setErr("Client and amount are required."); return; }
    setBusy(true); setErr(null);
    try {
      const year = form.due_date ? new Date(form.due_date).getFullYear() : new Date().getFullYear();
      const number = `INV-${year}-${String(invoices.length + 1).padStart(3, "0")}`;
      const row = {
        number, client_id: form.client_id, amount: Number(form.amount), currency: "usd",
        status: send ? "sent" : "draft",
        due_date: form.due_date || null,
        issued_at: send ? new Date().toISOString().slice(0, 10) : null,
        sent_at: send ? new Date().toISOString() : null,
        line_items: form.description ? [{ description: form.description, qty: 1, amount: Number(form.amount) }] : [],
      };
      const { data, error } = await sb.from("invoices").insert(row).select().single();
      if (error) throw new Error(error.message);
      setInvoices(prev => [data, ...prev]);
      // Invoice email is deferred to the Stripe wiring step (Stripe sends invoice
      // emails natively). For now "send" marks the invoice sent + issued.
      setModal(false); setForm({ client_id: "", amount: "", due_date: "", description: "" });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function setStatus(inv, status) {
    const patch = { status, updated_at: new Date().toISOString() };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    if (status === "sent" && !inv.sent_at) { patch.sent_at = new Date().toISOString(); patch.issued_at = new Date().toISOString().slice(0, 10); }
    setInvoices(prev => prev.map(x => x.id === inv.id ? { ...x, ...patch } : x));
    await sb.from("invoices").update(patch).eq("id", inv.id);
  }

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: isMobile ? 22 : 30, paddingBottom: isMobile ? 18 : 24, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", fontFamily: "'Geist Mono', monospace", marginBottom: 12 }}>Cloud Scenic / Finance</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: "italic", color: "#fff", margin: 0, letterSpacing: -1, lineHeight: 1 }}>Billing &amp; Invoices</h1>
            <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "12px 0 0" }}>Manual tracking · Stripe-ready (wire when you're set up).</p>
          </div>
          <button onClick={() => { setModal(true); setErr(null); }} style={{ height: 38, padding: "0 18px", borderRadius: 10, background: ACCENT, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ New invoice</button>
        </div>
      </div>

      {err && !modal && <div style={{ marginBottom: 14, padding: "9px 13px", borderRadius: 9, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a", fontSize: 12 }}>{err}</div>}

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard value={fmtMoney(stats.outstanding)} label="Outstanding" color="#f5f5f7" />
        <StatCard value={fmtMoney(stats.paid30)} label="Paid (30d)" sub="last 30 days" color="#30d158" />
        <StatCard value={fmtMoney(stats.overdue)} label="Overdue" sub={stats.overdue ? "chase ASAP" : "all current"} color={stats.overdue ? "#ff453a" : "rgba(255,255,255,0.4)"} />
        <StatCard value={fmtMoney(activeMRR)} label="MRR" sub="active retainers" color="#2AABFF" />
      </div>

      <div style={{ ...head, marginBottom: 10 }}>Recent invoices</div>
      <div style={{ background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "28px 18px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loading…</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: "40px 18px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontStyle: "italic", color: "#f5f5f7", marginBottom: 8 }}>No invoices yet.</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)" }}>Create your first invoice to start tracking billing.</div>
          </div>
        ) : invoices.map((inv, i) => {
          const st = effectiveStatus(inv);
          const sc = STATUS_COLOR[st] || STATUS_COLOR.draft;
          return (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < invoices.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "#f5f5f7", fontFamily: "'Geist Mono', monospace" }}>{inv.number || "—"}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName(inv.client_id)}{inv.line_items?.[0]?.description ? ` · ${inv.line_items[0].description}` : ""}</div>
              </div>
              <div style={{ flex: 1, textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#f5f5f7" }}>{fmtMoney(inv.amount)}</div>
              <div style={{ width: 70, textAlign: "right", fontSize: 11, fontFamily: "'Geist Mono', monospace", color: st === "overdue" ? "#ff453a" : "rgba(255,255,255,0.45)" }}>{fmtDate(inv.due_date)}</div>
              <div style={{ width: 78, textAlign: "right" }}>
                <span style={{ fontSize: 8.5, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 700, fontFamily: "'Geist Mono', monospace", color: sc }}>{st}</span>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", width: 150 }}>
                {inv.status === "draft" && <button onClick={() => setStatus(inv, "sent")} style={{ height: 28, padding: "0 11px", borderRadius: 7, background: "rgba(100,210,255,0.14)", border: "1px solid rgba(100,210,255,0.3)", color: "#64d2ff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Send</button>}
                {inv.status !== "paid" && inv.status !== "void" && <button onClick={() => setStatus(inv, "paid")} style={{ height: 28, padding: "0 11px", borderRadius: 7, background: "rgba(48,209,88,0.14)", border: "1px solid rgba(48,209,88,0.3)", color: "#30d158", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Mark paid</button>}
                {inv.status === "paid" && <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'Geist Mono', monospace" }}>paid {fmtDate(inv.paid_at)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", zIndex: 2147483646, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "100%", background: "#13110f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: "24px 26px", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>
            <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, fontStyle: "italic", color: "#f5f5f7", margin: "0 0 18px" }}>New invoice</h2>
            {err && <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a", fontSize: 12 }}>{err}</div>}
            <label style={{ ...head, display: "block", marginBottom: 6 }}>Client</label>
            <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} style={{ ...input, marginBottom: 12 }}>
              <option value="">Select client…</option>
              {clients.filter(c => c.status === "active").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...head, display: "block", marginBottom: 6 }}>Amount ($)</label>
                <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" style={input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ ...head, display: "block", marginBottom: 6 }}>Due date</label>
                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={input} />
              </div>
            </div>
            <label style={{ ...head, display: "block", marginBottom: 6 }}>Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Apr retainer" style={{ ...input, marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(false)} style={{ height: 38, padding: "0 16px", borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12.5 }}>Cancel</button>
              <button disabled={busy} onClick={() => createInvoice(false)} style={{ height: 38, padding: "0 16px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Save draft</button>
              <button disabled={busy} onClick={() => createInvoice(true)} style={{ height: 38, padding: "0 18px", borderRadius: 9, background: ACCENT, border: "none", color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>{busy ? "…" : "Create & send"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
