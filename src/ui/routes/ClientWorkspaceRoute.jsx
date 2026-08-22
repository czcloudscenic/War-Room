import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { clientHealth, rightsState } from '../../core/clientHealth.js';
import { factsFreshness } from '../../core/truth.js';
import { STATUS_COLOR } from '../../utils/constants.js';
import ClientTeamPanel from '../clients/ClientTeamPanel.jsx';
import DecisionLogRoute from '../truth/DecisionLogRoute.jsx';

// ── Client Workspace (Phase C, v3 spec §3.C.6) ───────────────────────────────
// THE fix for the Danny-confirmed Open-button bug: opening a client now lands
// HERE — one populated workspace with widget tabs — instead of the dashboard.
// Built under the 8/22 "Make Vantus work" delegation. Setup keeps working in
// parallel for now; its fields fold in here over time (spec §9 consolidation).

const ACCENT = "#2AABFF";
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };
const input = { background: "#141414", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };

const LEVEL_COLOR = { ok: "#30d158", warn: "#E5E5EA", bad: "#ff453a" };
const fmtMoney = (n) => n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "deliverables", label: "Deliverables" },
  { id: "scope", label: "Scope & Rates" },
  { id: "facts", label: "Facts" },
  { id: "rights", label: "Rights" },
  { id: "decisions", label: "Decisions" },
  { id: "portal", label: "Portal & Access" },
  { id: "activity", label: "Activity" },
];

function HealthStrip({ health }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {health.factors.map(f => (
        <div key={f.key} title={f.detail}
          style={{ padding: "8px 12px", borderRadius: 10, background: "#141414", border: `1px solid ${LEVEL_COLOR[f.level]}44`, minWidth: 118 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: LEVEL_COLOR[f.level], display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", fontFamily: "'Geist Mono', monospace" }}>{f.label}</span>
          </div>
          <div style={{ fontSize: 11, color: "#c9c9ce", marginTop: 3 }}>{f.detail}</div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ ...head }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 750, color: tone || "#f5f5f7", fontFamily: "Inter, sans-serif", marginTop: 2 }}>{value}</div>
    </div>
  );
}

// Scope & Rates — the first Setup fields folded into the workspace (spec §9).
function ScopeTab({ c, patch, saving }) {
  const [flagSupported, setFlagSupported] = useState(null); // null=probing
  useEffect(() => {
    let dead = false;
    sb.from("clients").select("approval_mode_confirmed").eq("id", c.id).maybeSingle()
      .then(({ error }) => { if (!dead) setFlagSupported(!error); });
    return () => { dead = true; };
  }, [c.id]);

  const row = (label, node) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ ...head, width: 170, flexShrink: 0 }}>{label}</div>
      {node}
    </div>
  );
  const num = (field, placeholder) => (
    <input type="number" min="0" defaultValue={c[field] ?? ""} placeholder={placeholder} style={{ ...input, width: 140 }}
      onBlur={e => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== (c[field] ?? null)) patch({ [field]: v }); }} />
  );

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ ...head, marginBottom: 4 }}>SCOPE & RATES{saving ? " · saving…" : ""}</div>
      {row("Retainer / month", num("retainer_amount", "$"))}
      {row("Retainer status", (
        <select defaultValue={c.retainer_status || ""} style={{ ...input, width: 160 }}
          onChange={e => patch({ retainer_status: e.target.value || null })}>
          <option value="">not set</option>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="project">project-based</option>
        </select>
      ))}
      {row("Posts per week", num("posts_per_week", "e.g. 3"))}
      {row("Cadence note", (
        <input defaultValue={c.cadence || ""} placeholder="e.g. 5/day M-F" style={{ ...input, flex: 1, maxWidth: 320 }}
          onBlur={e => { if (e.target.value !== (c.cadence || "")) patch({ cadence: e.target.value || null }); }} />
      ))}
      {row("Included revision rounds", num("included_revisions", "e.g. 2"))}
      {row("Approval mode", (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select defaultValue={c.approval_rule || "internal"} style={{ ...input, width: 150 }}
            onChange={e => patch({ approval_rule: e.target.value })}>
            <option value="internal">internal</option>
            <option value="client">client approves</option>
            <option value="auto">auto</option>
          </select>
          {flagSupported === true && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: c.approval_mode_confirmed ? "#30d158" : "rgba(255,255,255,0.6)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!c.approval_mode_confirmed}
                onChange={e => patch({ approval_mode_confirmed: e.target.checked })} />
              mode confirmed (a human chose this on purpose)
            </label>
          )}
          {flagSupported === false && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>confirm-flag column pending — run 20260822_phase_c.sql</span>
          )}
        </div>
      ))}
    </div>
  );
}

function DeliverablesTab({ items, onOpenLedger }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const shown = items
    .filter(i => statusFilter === "all" || i.status === statusFilter)
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  const statuses = [...new Set(items.map(i => i.status))];
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ ...head, flex: 1 }}>DELIVERABLES — {items.length}</div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...input, width: "auto", padding: "6px 10px", fontSize: 11.5 }}>
          <option value="all">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={onOpenLedger}
          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer", background: "none", color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
          Open in Ledger →
        </button>
      </div>
      {shown.map(i => (
        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 13, color: "#f5f5f7", fontFamily: "Inter, sans-serif", flex: 1, minWidth: 160 }}>{i.title || "(untitled)"}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color: STATUS_COLOR[i.status] || "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>{(i.status || "").toUpperCase()}</span>
          {i.due_date && <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'Geist Mono', monospace" }}>due {fmtDate(i.due_date)}</span>}
          {i.verification_status === "verified" && <span style={{ fontSize: 10, color: "#30d158" }}>✓ live</span>}
          {i.verification_status === "awaiting" && <span style={{ fontSize: 10, color: "#ff453a" }}>no receipt</span>}
        </div>
      ))}
      {!shown.length && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>Nothing here yet.</div>}
    </div>
  );
}

function FactsTab({ c, onOpenSettings }) {
  const fresh = factsFreshness(c);
  const facts = c.client_facts && typeof c.client_facts === "object" ? c.client_facts : {};
  const entries = Object.entries(facts).filter(([, v]) => v != null && String(v).trim() !== "");
  const tone = fresh.state === "stale" ? "#ff453a" : fresh.state === "due" ? "#E5E5EA" : "#30d158";
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ ...head, flex: 1 }}>FACTS OF RECORD</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: tone, fontFamily: "'Geist Mono', monospace" }}>
          {fresh.state.toUpperCase()}{fresh.days != null ? ` · reviewed ${fresh.days}d ago` : " · never reviewed"}
        </span>
        <button onClick={onOpenSettings}
          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer", background: "none", color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
          Review in Settings →
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginBottom: 12, lineHeight: 1.5 }}>
        Stale facts hard-block scheduling for this client — that is the freshness gate working. Editing facts counts as reviewing them.
      </div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ ...head, width: 160, flexShrink: 0, paddingTop: 2 }}>{k.replace(/_/g, " ")}</div>
          <div style={{ fontSize: 12.5, color: "#e0e0e4", fontFamily: "Inter, sans-serif", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{String(v)}</div>
        </div>
      ))}
      {!entries.length && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>No facts recorded — fill them in Settings before client-facing work ships.</div>}
    </div>
  );
}


// Rights clock (Phase E.3): expiry dates on licenses/releases/offers with
// per-right lead windows. Usage terms become renewal invoices. Table is
// feature-detected — pre-migration the tab explains what to run.
function RightsTab({ clientId, isMobile }) {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({ label: "", kind: "license", expires_on: "", lead_days: 30, notes: "" });

  const load = useCallback(async () => {
    const { data, error } = await sb.from("asset_rights").select("*").eq("client_id", clientId).order("expires_on");
    if (error) { setMissing(/asset_rights/.test(error.message)); setRows([]); if (!/asset_rights/.test(error.message)) setErr(error.message); return; }
    setMissing(false); setErr(null); setRows(data || []);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.expires_on) return;
    setBusy(true); setErr(null);
    const { error } = await sb.from("asset_rights").insert({
      client_id: clientId, label: form.label.trim(), kind: form.kind,
      expires_on: form.expires_on, lead_days: Number(form.lead_days) || 30,
      notes: form.notes.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setForm(f => ({ ...f, label: "", expires_on: "", notes: "" }));
    load();
  };
  const remove = async (id) => {
    const { error } = await sb.from("asset_rights").delete().eq("id", id);
    if (error) { setErr(error.message); return; }
    load();
  };

  const STATE_META = {
    expired: { label: "EXPIRED", color: "#ff453a" },
    due:     { label: "RENEW SOON", color: "#E5E5EA" },
    ok:      { label: "OK", color: "#30d158" },
  };

  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ ...head, marginBottom: 6 }}>RIGHTS CLOCK — LICENSES, RELEASES, OFFERS</div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 12 }}>
        Every usage right with an expiry date and a lead window. Renewals are invoices waiting to happen — nothing here should ever expire silently.
      </div>
      {missing && <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(229,229,234,0.06)", border: "1px solid rgba(229,229,234,0.25)", color: "#E5E5EA", fontSize: 12, marginBottom: 10 }}>The asset_rights table isn't in the database yet — run supabase/migrations/20260822_rights_clock.sql in the Supabase SQL editor.</div>}
      {err && <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12, marginBottom: 10 }}>{err}</div>}

      {!missing && (
        <form onSubmit={add} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="What's covered (music license, model release…)" style={{ ...input, flex: "1 1 220px" }} />
          <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} style={{ ...input, flex: "0 0 110px" }}>
            {["license", "release", "offer", "other"].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <input type="date" value={form.expires_on} onChange={e => setForm(f => ({ ...f, expires_on: e.target.value }))} style={{ ...input, flex: "0 0 150px" }} />
          <input type="number" min="0" value={form.lead_days} onChange={e => setForm(f => ({ ...f, lead_days: e.target.value }))} title="Warn this many days before expiry" style={{ ...input, flex: "0 0 80px" }} />
          <button type="submit" disabled={busy || !form.label.trim() || !form.expires_on}
            style={{ padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer", background: ACCENT, color: "#08131c", fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
            {busy ? "Adding…" : "Add right"}
          </button>
        </form>
      )}

      {rows == null && !missing && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>Loading…</div>}
      {(rows || []).map(r => {
        const st = rightsState(r);
        const m = STATE_META[st.state];
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color: m.color, border: `1px solid ${m.color}44`, background: `${m.color}14`, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{m.label}</span>
            <span style={{ fontSize: 13, color: "#f5f5f7", fontFamily: "Inter, sans-serif", flex: 1, minWidth: 160 }}>
              {r.label}
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 8, fontSize: 11 }}>{r.kind}</span>
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Geist Mono', monospace" }}>
              {st.state === "expired" ? `expired ${Math.abs(st.daysLeft)}d ago` : `${st.daysLeft}d left`} · {r.expires_on}
            </span>
            <button onClick={() => remove(r.id)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 14 }}>×</button>
          </div>
        );
      })}
      {rows != null && !rows.length && !missing && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>No rights tracked yet.</div>}
    </div>
  );
}

function ActivityTab({ clientId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      const [ev, au] = await Promise.all([
        sb.from("agent_events").select("id, agent_name, action_key, result_status, result_summary, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
        sb.from("audit_log").select("id, entity_type, field, actor_email, actor_kind, reason, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
      ]);
      if (dead) return;
      const merged = [
        ...(ev.data || []).map(r => ({ kind: "agent", ts: r.created_at, who: r.agent_name, what: r.result_summary || r.action_key, status: r.result_status })),
        ...(au.data || []).map(r => ({ kind: "audit", ts: r.created_at, who: r.actor_email || r.actor_kind, what: r.reason || `${r.entity_type}${r.field ? `.${r.field}` : ""} changed` })),
      ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 40);
      setRows(merged);
    })();
    return () => { dead = true; };
  }, [clientId]);
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ ...head, marginBottom: 10 }}>ACTIVITY — AGENT RECEIPTS + AUDIT TRAIL</div>
      {rows == null && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>Loading…</div>}
      {rows != null && !rows.length && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>No recorded activity for this client yet.</div>}
      {(rows || []).map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)", alignItems: "baseline" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Geist Mono', monospace", width: 74, flexShrink: 0 }}>{fmtDate(r.ts)}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: r.kind === "agent" ? "#64d2ff" : "rgba(255,255,255,0.55)", fontFamily: "'Geist Mono', monospace", width: 120, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.who || "—"}</span>
          <span style={{ fontSize: 12, color: "#d4d4d8", fontFamily: "Inter, sans-serif", lineHeight: 1.45 }}>{r.what}</span>
        </div>
      ))}
    </div>
  );
}

export default function ClientWorkspaceRoute({ client, content = [], isMobile, userId, onBack, setActiveNav }) {
  const [c, setC] = useState(client);
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [invoices, setInvoices] = useState([]);
  useEffect(() => { setC(client); setTab("overview"); }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let dead = false;
    sb.from("invoices").select("id, client_id, amount, status, due_date, paid_at").eq("client_id", client.id)
      .then(({ data }) => { if (!dead && Array.isArray(data)) setInvoices(data); });
    return () => { dead = true; };
  }, [client.id]);

  const items = useMemo(() => content.filter(i => i.client_id === c.id), [content, c.id]);
  const health = useMemo(() => clientHealth(c, content, invoices), [c, content, invoices]);

  const patch = useCallback(async (fields) => {
    setSaving(true); setErr(null);
    const { error } = await sb.from("clients").update(fields).eq("id", c.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setC(prev => ({ ...prev, ...fields }));
  }, [c.id]);

  const openCount = items.filter(i => !["Posted", "Scrapped"].includes(i.status)).length;
  const unpaid = invoices.filter(v => v.status === "sent").reduce((s, v) => s + (Number(v.amount) || 0), 0);

  return (
    <div style={{ maxWidth: 1040 }}>
      <button onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter, sans-serif", padding: 0, marginBottom: 8 }}>
        ← All clients
      </button>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: 30, fontWeight: 750, color: "#f5f5f7", margin: 0, fontFamily: "Inter, sans-serif", letterSpacing: -0.5 }}>{c.name}</h1>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: LEVEL_COLOR[health.level], display: "inline-block", marginBottom: 8 }} title={`health: ${health.level}`} />
        <div style={{ flex: 1 }} />
        <Stat label="Retainer" value={fmtMoney(c.retainer_amount)} />
        <Stat label="Open items" value={openCount} />
        <Stat label="Unpaid" value={fmtMoney(unpaid)} tone={unpaid ? "#E5E5EA" : undefined} />
      </div>

      {err && <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12, marginBottom: 10 }}>{err}</div>}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0 16px" }}>
        {TABS.map(t2 => (
          <button key={t2.id} onClick={() => setTab(t2.id)}
            style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", background: tab === t2.id ? "rgba(42,171,255,0.16)" : "none", color: tab === t2.id ? ACCENT : "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
            {t2.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div style={{ ...card, padding: 18, marginBottom: 14 }}>
            <div style={{ ...head, marginBottom: 10 }}>HEALTH — EXPLAINABLE FACTORS, NO BLACK BOX</div>
            <HealthStrip health={health} />
          </div>
          <DeliverablesTab items={items.filter(i => !["Posted", "Scrapped"].includes(i.status)).slice(0, 8)} onOpenLedger={() => setActiveNav("ledger")} />
        </>
      )}
      {tab === "deliverables" && <DeliverablesTab items={items} onOpenLedger={() => setActiveNav("ledger")} />}
      {tab === "scope" && <ScopeTab c={c} patch={patch} saving={saving} />}
      {tab === "facts" && <FactsTab c={c} onOpenSettings={() => setActiveNav("settings")} />}
      {tab === "rights" && <RightsTab clientId={c.id} isMobile={isMobile} />}
      {tab === "decisions" && <DecisionLogRoute clients={[c]} activeClientId={c.id} />}
      {tab === "portal" && (
        <div style={{ ...card, padding: 18 }}>
          <ClientTeamPanel clientId={c.id} clientName={c.name} currentUserId={userId} />
        </div>
      )}
      {tab === "activity" && <ActivityTab clientId={c.id} />}
    </div>
  );
}
