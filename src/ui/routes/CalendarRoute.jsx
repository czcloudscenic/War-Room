import React, { useMemo, useState } from 'react';
import { STATUS_COLOR } from '../../utils/constants.js';

// ── Content Calendar (Phase C §3.C.5, the calendar leg of the content merge) ──
// All clients on one month grid. Items land on their planned publish_date
// (or posted_at once real). Real rows only — an empty day is an empty day.
// Sprout pull for scheduled/posted truth stays a later wiring; this renders
// what Vantus itself knows.

const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarRoute({ clients = [], content = [], isMobile, setActiveNav }) {
  const now = new Date();
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [clientFilter, setClientFilter] = useState("all");
  const activeClients = clients.filter(c => c.status === "active");
  const nameOf = useMemo(() => {
    const m = new Map(clients.map(c => [c.id, c.name]));
    return (id) => m.get(id) || "—";
  }, [clients]);

  // Item → the date it belongs to: posted_at wins (real), else publish_date (plan).
  const byDay = useMemo(() => {
    const map = new Map();
    for (const i of content) {
      if (clientFilter !== "all" && i.client_id !== clientFilter) continue;
      if (i.status === "Scrapped") continue;
      const raw = i.posted_at || i.publish_date;
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d)) continue;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(i);
    }
    return map;
  }, [content, clientFilter]);

  // Build the month grid: leading blanks to Monday-start weeks.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const monthLabel = month.toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayKey = dayKey(now);
  const shift = (n) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const monthCount = useMemo(() => {
    let planned = 0, posted = 0;
    for (const [k, items] of byDay) {
      if (!k.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`)) continue;
      for (const i of items) (i.posted_at ? posted++ : planned++);
    }
    return { planned, posted };
  }, [byDay, month]);

  const navBtn = (label, onClick) => (
    <button onClick={onClick}
      style={{ padding: "7px 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer", background: "none", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 1080 }}>
      <div style={{ ...head, fontSize: 9.5 }}>CLOUD SCENIC / CONTENT CALENDAR</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, margin: "6px 0 4px", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 30, fontWeight: 750, color: "#f5f5f7", margin: 0, fontFamily: "Inter, sans-serif", letterSpacing: -0.5 }}>{monthLabel}</h1>
        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontFamily: "'Geist Mono', monospace", marginBottom: 7 }}>
          {monthCount.posted} posted · {monthCount.planned} planned
        </div>
        <div style={{ flex: 1 }} />
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif" }}>
          <option value="all">All clients</option>
          {activeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {navBtn("←", () => shift(-1))}
        {navBtn("Today", () => setMonth(new Date(now.getFullYear(), now.getMonth(), 1)))}
        {navBtn("→", () => shift(1))}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>
        Solid dot = posted (real). Hollow dot = planned publish date. Click a day's item to work it in the Ledger.
      </div>

      <div style={{ ...card, padding: isMobile ? 8 : 14, overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, minWidth: 700 }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} style={{ ...head, textAlign: "center", padding: "4px 0" }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} style={{ minHeight: 92 }} />;
            const k = dayKey(d);
            const items = byDay.get(k) || [];
            const isToday = k === todayKey;
            return (
              <div key={k} style={{ minHeight: 92, borderRadius: 10, padding: "6px 7px", background: isToday ? "rgba(42,171,255,0.07)" : "#141414", border: `1px solid ${isToday ? "rgba(42,171,255,0.4)" : "rgba(255,255,255,0.06)"}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: isToday ? "#2AABFF" : "rgba(255,255,255,0.4)", fontFamily: "'Geist Mono', monospace", marginBottom: 4 }}>{d.getDate()}</div>
                {items.slice(0, 3).map(item => (
                  <div key={item.id} onClick={() => setActiveNav("ledger")} title={`${item.title} — ${nameOf(item.client_id)} (${item.status})`}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 0", cursor: "pointer" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: item.posted_at ? (STATUS_COLOR[item.status] || "#30d158") : "transparent",
                      border: `1.6px solid ${STATUS_COLOR[item.status] || "rgba(255,255,255,0.5)"}` }} />
                    <span style={{ fontSize: 10.5, color: "#d4d4d8", fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {clientFilter === "all" ? `${nameOf(item.client_id)} · ` : ""}{item.title || "untitled"}
                    </span>
                  </div>
                ))}
                {items.length > 3 && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)", fontFamily: "'Geist Mono', monospace" }}>+{items.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
