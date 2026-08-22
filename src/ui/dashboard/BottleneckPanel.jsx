import React, { useMemo } from 'react';
import { bottlenecks } from '../../core/clientHealth.js';

// ── Founder bottleneck panel (Phase C, v3 spec §3.C.2) ───────────────────────
// Three honest lists: internal decisions aging at gates, clients missing the
// strategy layer (facts), and ownership risk. Real rows only — renders nothing
// when there is nothing to show, so it never fabricates urgency.

const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const card = { background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 };

export default function BottleneckPanel({ clients = [], content = [], team = [], setActiveNav }) {
  const b = useMemo(() => bottlenecks({ clients, content, team }), [clients, content, team]);
  const nameOf = useMemo(() => {
    const m = new Map(clients.map(c => [c.id, c.name]));
    return (id) => m.get(id) || "—";
  }, [clients]);

  const empty = !b.waitingInternal.length && !b.factsGaps.length && !b.unowned.length && !b.concentrated.length;
  if (empty) return null;

  const row = (key, text, tone, nav) => (
    <div key={key} onClick={nav ? () => setActiveNav(nav) : undefined}
      style={{ display: "flex", gap: 8, padding: "7px 0", borderTop: "1px solid rgba(255,255,255,0.05)", cursor: nav ? "pointer" : "default", alignItems: "baseline" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone, display: "inline-block", flexShrink: 0, position: "relative", top: -1 }} />
      <span style={{ fontSize: 12, color: "#d4d4d8", fontFamily: "Inter, sans-serif", lineHeight: 1.45 }}>{text}</span>
    </div>
  );

  return (
    <div style={{ ...card, padding: 18, marginTop: 14 }}>
      <div style={{ ...head, marginBottom: 8 }}>BOTTLENECKS — WHAT'S WAITING ON A HUMAN</div>
      {b.waitingInternal.slice(0, 5).map(i =>
        row(`w-${i.id}`, `"${i.title || "untitled"}" (${nameOf(i.client_id)}) has waited ${i.ageDays}d for an internal decision`, i.ageDays >= 7 ? "#ff453a" : "#E5E5EA", "approvals"))}
      {b.factsGaps.slice(0, 4).map(g =>
        row(`f-${g.client.id}`, `${g.client.name}: Facts of Record ${g.facts.level === "bad" ? "stale or missing" : "due for review"} — client-facing work is gated on this`, g.facts.level === "bad" ? "#ff453a" : "#E5E5EA", "settings"))}
      {b.unowned.slice(0, 4).map(c =>
        row(`u-${c.id}`, `${c.name} has no account owner`, "#E5E5EA", "setup"))}
      {b.concentrated.map(x =>
        row(`c-${x.member.id}`, `${x.member.name || "One person"} owns ${x.count} active clients — single-owner risk`, "#E5E5EA", "setup"))}
    </div>
  );
}
