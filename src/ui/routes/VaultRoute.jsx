import React, { useCallback, useEffect, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';

// ── Client Vault ──────────────────────────────────────────────────────────────
// Per-client billing profile: legal/contact/address details (manual inputs)
// plus card-on-file. Card numbers are NEVER typed or stored here — "Add card"
// opens Stripe's hosted page (Checkout mode=setup); Stripe vaults the card and
// Vantus keeps only brand / last4 / expiry + the ids needed to charge later.
// Admin-only data (client_vault RLS blocks portal users and anon).

const ACCENT = "#2AABFF";
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const input = { width: "100%", background: "#161314", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };

const EMPTY = {
  legal_name: "", billing_contact: "", billing_email: "", billing_phone: "",
  address_line1: "", address_line2: "", city: "", state: "", zip: "", country: "US",
  tax_id: "", notes: "",
};
const PROFILE_KEYS = Object.keys(EMPTY);

const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover", diners: "Diners", jcb: "JCB", unionpay: "UnionPay" };

function Field({ label, value, onChange, placeholder, type = "text", flex = 1 }) {
  return (
    <label style={{ flex, minWidth: 120, display: "block" }}>
      <div style={{ ...head, marginBottom: 5 }}>{label}</div>
      <input style={input} type={type} value={value || ""} placeholder={placeholder || ""} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function ClientVaultCard({ client, row, onSaved, isMobile }) {
  const [form, setForm] = useState({ ...EMPTY, ...(row || {}) });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(null); // 'save' | 'link' | 'sync'
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);
  const set = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  useEffect(() => { setForm({ ...EMPTY, ...(row || {}) }); setDirty(false); }, [row]);

  const save = async () => {
    setBusy("save"); setMsg(null);
    const patch = {};
    for (const k of PROFILE_KEYS) patch[k] = form[k] === "" ? null : form[k];
    const { error } = await sb.from("client_vault").upsert({ client_id: client.id, ...patch, updated_at: new Date().toISOString() });
    setBusy(null);
    if (error) { setMsg({ bad: true, text: error.message.includes("client_vault") ? "Table missing — run the 20260703_client_vault migration first." : error.message }); return; }
    setDirty(false); setMsg({ text: "Saved" });
    onSaved();
  };

  const stripeAction = async (action) => {
    setBusy(action === "vault_link" ? "link" : "sync"); setMsg(null);
    try {
      const res = await apiFetch("/api/billing/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, client_id: client.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Stripe call failed (${res.status})`);
      if (action === "vault_link") {
        window.open(data.url, "_blank", "noopener");
        setMsg({ text: "Stripe card page opened in a new tab — after saving the card there, come back and hit Sync." });
      } else {
        setMsg({ text: `Card synced: ${BRAND_LABEL[data.card_brand] || data.card_brand} •••• ${data.card_last4}` });
        onSaved();
      }
    } catch (e) {
      setMsg({ bad: true, text: e.message });
    }
    setBusy(null);
  };

  const hasCard = !!row?.card_last4;
  const filled = PROFILE_KEYS.filter(k => (row?.[k] || "").toString().trim() && k !== "country").length;

  return (
    <div style={{ background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontSize: 14.5, fontWeight: 650, color: "#f5f5f7", fontFamily: "Inter, sans-serif", flex: 1 }}>{client.name}</span>
        {hasCard
          ? <span style={{ fontSize: 11, fontWeight: 600, color: "#30d158", fontFamily: "'Geist Mono', monospace" }}>{(BRAND_LABEL[row.card_brand] || row.card_brand || "card").toUpperCase()} •••• {row.card_last4} · {String(row.card_exp_month).padStart(2, "0")}/{String(row.card_exp_year).slice(-2)}</span>
          : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>no card on file</span>}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{filled ? `${filled} fields` : "empty"}</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ padding: "4px 18px 18px" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Field label="Legal / billing name" value={form.legal_name} onChange={set("legal_name")} placeholder={client.name} flex={2} />
            <Field label="Billing contact" value={form.billing_contact} onChange={set("billing_contact")} placeholder="Who signs off" flex={1.4} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Field label="Billing email" value={form.billing_email} onChange={set("billing_email")} type="email" placeholder="billing@client.com" flex={1.6} />
            <Field label="Phone" value={form.billing_phone} onChange={set("billing_phone")} placeholder="(310) 555-0100" />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Field label="Address line 1" value={form.address_line1} onChange={set("address_line1")} placeholder="Street address" flex={2} />
            <Field label="Line 2" value={form.address_line2} onChange={set("address_line2")} placeholder="Suite / unit" />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Field label="City" value={form.city} onChange={set("city")} flex={1.4} />
            <Field label="State" value={form.state} onChange={set("state")} placeholder="CA" flex={0.6} />
            <Field label="ZIP" value={form.zip} onChange={set("zip")} placeholder="90291" flex={0.8} />
            <Field label="Country" value={form.country} onChange={set("country")} flex={0.6} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <Field label="Tax ID / EIN" value={form.tax_id} onChange={set("tax_id")} placeholder="Optional" />
            <Field label="Notes" value={form.notes} onChange={set("notes")} placeholder="Billing quirks, PO requirements…" flex={2.4} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
            <button onClick={save} disabled={!dirty || busy}
              style={{ padding: "9px 18px", borderRadius: 9, border: "none", cursor: dirty ? "pointer" : "default", background: dirty ? ACCENT : "rgba(255,255,255,0.08)", color: dirty ? "#08131c" : "rgba(255,255,255,0.4)", fontWeight: 700, fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
              {busy === "save" ? "Saving…" : "Save details"}
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={() => stripeAction("vault_link")} disabled={busy}
              style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.16)", cursor: "pointer", background: "none", color: "#f5f5f7", fontWeight: 600, fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
              {busy === "link" ? "Opening…" : hasCard ? "Replace card (Stripe)" : "Add card (Stripe)"}
            </button>
            <button onClick={() => stripeAction("vault_sync")} disabled={busy}
              style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.16)", cursor: "pointer", background: "none", color: "#f5f5f7", fontWeight: 600, fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
              {busy === "sync" ? "Syncing…" : "Sync card"}
            </button>
          </div>
          {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.bad ? "#ff453a" : "#30d158" }}>{msg.text}</div>}
          <div style={{ marginTop: 10, fontSize: 10.5, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
            Card numbers are entered on Stripe's secure page and stored in Stripe's vault — Vantus keeps only the brand, last four, and expiry.
          </div>
        </div>
      )}
    </div>
  );
}

export default function VaultRoute({ isMobile, clients = [] }) {
  const [rows, setRows] = useState({});
  const [loadErr, setLoadErr] = useState(null);
  const activeClients = (clients || []).filter(c => c.status === "active");

  const load = useCallback(async () => {
    const { data, error } = await sb.from("client_vault").select("*");
    if (error) { setLoadErr(error.message); return; }
    setLoadErr(null);
    const map = {};
    for (const r of data || []) map[r.client_id] = r;
    setRows(map);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ ...head, fontSize: 9.5 }}>CLOUD SCENIC / CLIENT VAULT</div>
      <h1 style={{ fontSize: 30, fontWeight: 750, color: "#f5f5f7", margin: "6px 0 4px", fontFamily: "Inter, sans-serif", letterSpacing: -0.5 }}>Vault</h1>
      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginBottom: 20, lineHeight: 1.5 }}>
        Billing profiles and card-on-file per client. Cards live in Stripe's vault, never in Vantus.
      </div>
      {loadErr && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.35)", color: "#ff8a80", fontSize: 12.5, marginBottom: 14 }}>
          {loadErr.includes("client_vault") ? "The client_vault table isn't in the database yet — run supabase/migrations/20260703_client_vault.sql in the Supabase SQL editor." : loadErr}
        </div>
      )}
      {activeClients.map(c => (
        <ClientVaultCard key={c.id} client={c} row={rows[c.id]} onSaved={load} isMobile={isMobile} />
      ))}
      {!activeClients.length && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No active clients.</div>}
    </div>
  );
}
