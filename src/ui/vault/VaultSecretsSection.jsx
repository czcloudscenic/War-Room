import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiFetch.js';

// ── Vault credentials (v3 spec §3.D.3 hardening) ─────────────────────────────
// Keys/logins per client (or agency-level). The browser NEVER reads the
// vault_secrets table — RLS has zero policies; everything goes through
// /api/vault-secrets. Values are AES-256-GCM encrypted at rest, masked by
// default here, and every reveal writes a view-audit row with who and when.

const ACCENT = "#2AABFF";
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };
const input = { background: "#141414", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };

async function call(action, payload = {}) {
  const res = await apiFetch("/api/vault-secrets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${action} failed (${res.status})`);
  return data;
}

function SecretRow({ row, clientsById, onChanged, setErr }) {
  const [revealed, setRevealed] = useState(null); // decrypted value while shown
  const [busy, setBusy] = useState(null);

  const reveal = async () => {
    setBusy("reveal"); setErr(null);
    try {
      const { value } = await call("reveal", { id: row.id });
      setRevealed(value);
      setTimeout(() => setRevealed(null), 30_000); // auto-remask after 30s
    } catch (e) { setErr(e.message); }
    setBusy(null);
  };

  const copy = async () => {
    setBusy("copy"); setErr(null);
    try {
      const { value } = await call("reveal", { id: row.id }); // copy is a reveal — audited the same
      await navigator.clipboard.writeText(value);
    } catch (e) { setErr(e.message); }
    setBusy(null);
  };

  const remove = async () => {
    if (!window.confirm(`Delete the stored secret "${row.label}"? This can't be undone.`)) return;
    setBusy("remove"); setErr(null);
    try { await call("remove", { id: row.id }); onChanged(); }
    catch (e) { setErr(e.message); }
    setBusy(null);
  };

  const smallBtn = (label, onClick, key) => (
    <button onClick={onClick} disabled={!!busy}
      style={{ padding: "5px 11px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer", background: "none", color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
      {busy === key ? "…" : label}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: "#f5f5f7", fontFamily: "Inter, sans-serif" }}>
          {row.label}
          <span style={{ marginLeft: 8, fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'Geist Mono', monospace" }}>
            {row.client_id ? (clientsById[row.client_id] || "client") : "AGENCY"}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontFamily: "'Geist Mono', monospace", marginTop: 2, wordBreak: "break-all" }}>
          {row.username ? `${row.username} · ` : ""}
          {revealed != null
            ? <span style={{ color: "#E5E5EA" }}>{revealed}</span>
            : "••••••••••••"}
        </div>
        {row.notes && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{row.notes}</div>}
      </div>
      {revealed == null ? smallBtn("Reveal", reveal, "reveal") : smallBtn("Hide", () => setRevealed(null), "hide")}
      {smallBtn("Copy", copy, "copy")}
      {smallBtn("Delete", remove, "remove")}
    </div>
  );
}

export default function VaultSecretsSection({ clients = [], isMobile }) {
  const [rows, setRows] = useState(null); // null = loading
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ client_id: "", label: "", username: "", secret: "", notes: "" });
  const activeClients = (clients || []).filter(c => c.status === "active");
  const clientsById = Object.fromEntries((clients || []).map(c => [c.id, c.name]));

  const load = useCallback(async () => {
    try {
      const { secrets } = await call("list");
      setRows(secrets); setErr(null);
    } catch (e) {
      setRows([]);
      setErr(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.secret) return;
    setBusy(true); setErr(null);
    try {
      await call("save", {
        client_id: form.client_id || null,
        label: form.label.trim(),
        username: form.username.trim() || null,
        secret: form.secret,
        notes: form.notes.trim() || null,
      });
      setForm({ client_id: "", label: "", username: "", secret: "", notes: "" });
      setAdding(false);
      load();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  return (
    <div style={{ ...card, padding: 18, marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ ...head, fontSize: 9.5, flex: 1 }}>CREDENTIALS — ENCRYPTED AT REST</div>
        <button onClick={() => setAdding(a => !a)}
          style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: adding ? "rgba(255,255,255,0.08)" : ACCENT, color: adding ? "rgba(255,255,255,0.6)" : "#08131c", fontWeight: 700, fontSize: 11.5, fontFamily: "Inter, sans-serif" }}>
          {adding ? "Cancel" : "+ Add secret"}
        </button>
      </div>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 10 }}>
        Logins, API keys, and access credentials. Values are encrypted in the database, masked here by default, and every reveal or copy is logged with who and when.
      </div>

      {err && <div style={{ padding: "10px 14px", borderRadius: 9, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12, marginBottom: 10 }}>{err}</div>}

      {adding && (
        <form onSubmit={save} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
          <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={{ ...input, flex: isMobile ? "1 1 100%" : "0 0 160px" }}>
            <option value="">Agency-level</option>
            {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Label (e.g. IG login, Meta API key)" style={{ ...input, flex: "1 1 180px" }} />
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Username / account (optional)" style={{ ...input, flex: "1 1 160px" }} />
          <input type="password" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="Secret value" autoComplete="new-password" style={{ ...input, flex: "1 1 180px" }} />
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" style={{ ...input, flex: "1 1 100%" }} />
          <button type="submit" disabled={busy || !form.label.trim() || !form.secret}
            style={{ padding: "9px 16px", borderRadius: 9, border: "none", cursor: "pointer", background: ACCENT, color: "#08131c", fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
            {busy ? "Encrypting…" : "Save encrypted"}
          </button>
        </form>
      )}

      {rows == null && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>Loading…</div>}
      {rows != null && !rows.length && !err && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12.5 }}>Nothing stored yet.</div>}
      {(rows || []).map(r => (
        <SecretRow key={r.id} row={r} clientsById={clientsById} onChanged={load} setErr={setErr} />
      ))}
    </div>
  );
}
