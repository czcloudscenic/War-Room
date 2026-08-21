import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';

// ── Scope Sentinel (v3 spec §3.D.1) ──────────────────────────────────────────
// Nothing gets absorbed silently: paste any incoming ask, the sentinel drafts a
// classification against the client's real agreement columns, a human confirms.
// Confirmed absorbed_intentionally rows ARE the absorbed-value register; the
// monthly roll-up below is deterministic math, no AI.

const ACCENT = "#2AABFF";
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };
const input = { width: "100%", background: "#141414", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 12px", fontSize: 13.5, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };

const CLASS_META = {
  included:                    { label: "Included",              color: "#30d158" },
  included_with_clarification: { label: "Needs clarification",   color: "#E5E5EA" },
  swap_required:               { label: "Swap required",         color: "#64d2ff" },
  priced_addition:             { label: "Priced addition",       color: "#bf5af2" },
  out_of_scope:                { label: "Out of scope",          color: "#ff375f" },
  decline_recommended:         { label: "Decline recommended",   color: "#ff453a" },
  absorbed_intentionally:      { label: "Absorbed (intentional)",color: "#ffd60a" },
};

const fmtMoney = (n) => n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function ClassChip({ classification }) {
  const m = CLASS_META[classification] || { label: classification || "unclassified", color: "rgba(255,255,255,0.4)" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color: m.color, border: `1px solid ${m.color}44`, background: `${m.color}14`, whiteSpace: "nowrap" }}>
      {m.label.toUpperCase()}
    </span>
  );
}

export default function ScopeRoute({ isMobile, clients = [] }) {
  const activeClients = (clients || []).filter(c => c.status === "active");
  const [clientId, setClientId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null); // 'classify' | request id being decided
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all"); // all | draft | absorbed

  const load = useCallback(async () => {
    const { data, error } = await sb.from("scope_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) {
      setErr(error.message.includes("scope_requests")
        ? "The scope_requests table isn't in the database yet — run supabase/migrations/20260821_phase_d.sql in the Supabase SQL editor."
        : error.message);
      return;
    }
    setErr(null);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const clientName = useMemo(() => {
    const m = new Map((clients || []).map(c => [c.id, c.name]));
    return (id) => m.get(id) || "—";
  }, [clients]);

  const classify = async () => {
    if (!clientId || !text.trim()) return;
    setBusy("classify"); setErr(null);
    try {
      const res = await apiFetch("/api/agent-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sentinel_classify", client_id: clientId, payload: { client_id: clientId, request_text: text.trim() } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `classify failed (${res.status})`);
      setText("");
      await load();
    } catch (e) { setErr(e.message); }
    setBusy(null);
  };

  const decide = async (row, decision, overrideClass = null) => {
    setBusy(row.id); setErr(null);
    try {
      const res = await apiFetch("/api/agent-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sentinel_decide", client_id: row.client_id, payload: { id: row.id, decision, classification: overrideClass } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `decide failed (${res.status})`);
      await load();
    } catch (e) { setErr(e.message); }
    setBusy(null);
  };

  // Absorbed-value register roll-up: confirmed + absorbed_intentionally, by month.
  const absorbedByMonth = useMemo(() => {
    const months = new Map();
    for (const r of rows) {
      if (r.status !== "confirmed" || r.classification !== "absorbed_intentionally") continue;
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = months.get(key) || { key, count: 0, value: 0 };
      cur.count += 1;
      cur.value += Number(r.est_value) || 0;
      months.set(key, cur);
    }
    return [...months.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 6);
  }, [rows]);

  const visible = rows.filter(r =>
    filter === "all" ? true :
    filter === "draft" ? r.status === "draft" :
    r.classification === "absorbed_intentionally" && r.status === "confirmed"
  );

  const filterBtn = (id, label) => (
    <button key={id} onClick={() => setFilter(id)}
      style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", background: filter === id ? "rgba(42,171,255,0.16)" : "none", color: filter === id ? ACCENT : "rgba(255,255,255,0.6)", fontSize: 11.5, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ ...head, fontSize: 9.5 }}>CLOUD SCENIC / SCOPE CONTROL</div>
      <h1 style={{ fontSize: 30, fontWeight: 750, color: "#f5f5f7", margin: "6px 0 4px", fontFamily: "Inter, sans-serif", letterSpacing: -0.5 }}>Scope Sentinel</h1>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginBottom: 20, lineHeight: 1.5 }}>
        Every new ask gets classified against the agreement before anyone works on it. The sentinel drafts, you decide. Nothing is absorbed silently.
      </div>

      {err && <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12.5, marginBottom: 14 }}>{err}</div>}

      {/* Intake */}
      <div style={{ ...card, padding: 18, marginBottom: 18 }}>
        <div style={{ ...head, marginBottom: 8 }}>NEW REQUEST</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...input, width: isMobile ? "100%" : 260 }}>
            <option value="">Select client…</option>
            {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder={'Paste the ask exactly as it came in. "Can you also cut a vertical version for TikTok?" · "We need a one-pager for the trade show next week" · "Small tweak: reshoot the intro"'}
          style={{ ...input, resize: "vertical", lineHeight: 1.5, marginBottom: 12 }} />
        <button onClick={classify} disabled={!clientId || !text.trim() || busy === "classify"}
          style={{ padding: "9px 18px", borderRadius: 9, border: "none", cursor: clientId && text.trim() ? "pointer" : "default", background: clientId && text.trim() ? ACCENT : "rgba(255,255,255,0.08)", color: clientId && text.trim() ? "#08131c" : "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
          {busy === "classify" ? "Classifying…" : "Classify"}
        </button>
      </div>

      {/* Absorbed-value register roll-up */}
      {absorbedByMonth.length > 0 && (
        <div style={{ ...card, padding: 18, marginBottom: 18 }}>
          <div style={{ ...head, marginBottom: 10 }}>ABSORBED-VALUE REGISTER — MONTHLY ROLL-UP</div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {absorbedByMonth.map(m => (
              <div key={m.key}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "'Geist Mono', monospace" }}>{m.key}</div>
                <div style={{ fontSize: 20, fontWeight: 750, color: "#ffd60a", fontFamily: "Inter, sans-serif" }}>{fmtMoney(m.value)}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)" }}>{m.count} item{m.count === 1 ? "" : "s"} absorbed</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {filterBtn("all", "All")}
        {filterBtn("draft", "Awaiting decision")}
        {filterBtn("absorbed", "Absorbed register")}
      </div>

      {visible.map(r => (
        <div key={r.id} style={{ ...card, padding: 16, marginBottom: 10, opacity: r.status === "dismissed" ? 0.55 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <ClassChip classification={r.classification} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif" }}>{clientName(r.client_id)}</span>
            {r.est_value != null && <span style={{ fontSize: 12, fontWeight: 700, color: "#f5f5f7", fontFamily: "'Geist Mono', monospace" }}>{fmtMoney(r.est_value)}</span>}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontFamily: "'Geist Mono', monospace" }}>
              {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {r.status !== "draft" && ` · ${r.status}${r.decided_by ? ` by ${String(r.decided_by).split("@")[0]}` : ""}`}
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: "#f5f5f7", fontFamily: "Inter, sans-serif", lineHeight: 1.5, marginBottom: r.rationale ? 8 : 0 }}>{r.request_text}</div>
          {r.rationale && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, marginBottom: r.clarification ? 6 : 0 }}>{r.rationale}</div>}
          {r.clarification && (
            <div style={{ fontSize: 12, color: "#E5E5EA", lineHeight: 1.5, padding: "8px 12px", background: "rgba(229,229,234,0.06)", borderRadius: 8, marginTop: 4 }}>
              Ask first: {r.clarification}
            </div>
          )}
          {r.status === "draft" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => decide(r, "confirmed")} disabled={busy === r.id}
                style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(48,209,88,0.16)", color: "#30d158", fontWeight: 700, fontSize: 11.5, fontFamily: "Inter, sans-serif" }}>
                {busy === r.id ? "…" : "Confirm"}
              </button>
              <button onClick={() => decide(r, "dismissed")} disabled={busy === r.id}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer", background: "none", color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: 11.5, fontFamily: "Inter, sans-serif" }}>
                Dismiss
              </button>
              <select defaultValue="" disabled={busy === r.id}
                onChange={e => { if (e.target.value) decide(r, "confirmed", e.target.value); }}
                style={{ ...input, width: "auto", padding: "7px 10px", fontSize: 11.5 }}>
                <option value="">Confirm as…</option>
                {Object.entries(CLASS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
      {!visible.length && !err && (
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "24px 0" }}>
          {filter === "absorbed" ? "Nothing absorbed yet — that's the goal." : "No scope requests yet. Paste the next client ask above."}
        </div>
      )}
    </div>
  );
}
