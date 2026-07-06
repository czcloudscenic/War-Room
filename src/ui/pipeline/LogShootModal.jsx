import React, { useEffect, useMemo, useState } from "react";
import { sb } from "../../services/supabaseClient.js";

function todayDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export default function LogShootModal({ clients = [], defaultClientId, onClose }) {
  const [clientId, setClientId] = useState(defaultClientId || clients[0]?.id || "");
  const [dateStr, setDateStr] = useState(todayDate);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) || null,
    [clients, clientId],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const n = Number(count);
    if (!selectedClient) {
      setError("Choose a client.");
      return;
    }
    if (!selectedClient.slug) {
      setError("Selected client is missing a slug.");
      return;
    }
    if (!dateStr) {
      setError("Choose a shoot date.");
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      setError("Piece count must be between 1 and 100.");
      return;
    }

    setSaving(true);
    try {
      const stamp = Date.now();
      const rows = Array.from({ length: n }, (_, i) => ({
        id: `${selectedClient.slug}-shoot-${stamp}-${i + 1}`,
        title: `Shoot ${dateStr} — piece ${i + 1}/${n}`,
        status: "Ready For Copy Creation",
        campaign: `Shoot ${dateStr}`,
        client_id: selectedClient.id,
        notes: note.trim() || null,
      }));

      const { error: insertError } = await sb.from("content_items").insert(rows);
      if (insertError) {
        setError(insertError.message || "Shoot log failed.");
        return;
      }

      setSuccess(`Logged ${n} ${n === 1 ? "piece" : "pieces"}.`);
      window.setTimeout(() => onClose?.(), 450);
    } catch (err) {
      setError(err?.message || "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = {
    display: "block",
    marginBottom: 6,
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 12px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    outline: "none",
    background: "rgba(255,255,255,0.05)",
    color: "#f5f5f7",
    fontFamily: "Inter, sans-serif",
    fontSize: 16,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px 26px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 18,
          background: "#13110f",
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 6, color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase" }}>
            Content Runway
          </div>
          <h2 style={{ margin: 0, color: "#f5f5f7", fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, fontStyle: "italic", fontWeight: 500, letterSpacing: -0.5 }}>
            Log Shoot
          </h2>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Client</label>
          <select value={clientId} onChange={(event) => setClientId(event.target.value)} style={inputStyle}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Shoot Date</label>
            <input type="date" value={dateStr} onChange={(event) => setDateStr(event.target.value)} style={inputStyle} />
          </div>
          <div style={{ width: 118 }}>
            <label style={labelStyle}>Pieces</label>
            <input
              type="number"
              min="1"
              max="100"
              value={count}
              onChange={(event) => setCount(event.target.value)}
              style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Note</label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional context for this batch"
            rows={3}
            style={{ ...inputStyle, minHeight: 74, resize: "vertical", fontSize: 16 }}
          />
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: "9px 13px", border: "1px solid rgba(255,60,60,0.15)", borderRadius: 8, background: "rgba(255,50,50,0.08)", color: "rgba(255,140,130,0.95)", fontSize: 11 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginBottom: 14, padding: "9px 13px", border: "1px solid rgba(48,209,88,0.2)", borderRadius: 8, background: "rgba(48,209,88,0.08)", color: "#30d158", fontSize: 11 }}>
            {success}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: "9px 16px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, background: "transparent", color: "rgba(255,255,255,0.65)", cursor: saving ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !clients.length}
            style={{ padding: "9px 18px", border: "1px solid rgba(42,171,255,0.4)", borderRadius: 10, background: "rgba(42,171,255,0.18)", color: "#2AABFF", cursor: saving || !clients.length ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, opacity: saving || !clients.length ? 0.55 : 1 }}
          >
            {saving ? "Logging..." : "Log shoot"}
          </button>
        </div>
      </form>
    </div>
  );
}
