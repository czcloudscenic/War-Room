// Content Runway — per-client inventory vs burn, worst-first.
// PLACEHOLDER shipped by Counsel so the route is live + buildable; the full
// version (SummaryStat tiles, LogShootModal, mobile cards) lands from the
// codex/grunt-2026-07-06 branch per CODEX_TASK.md and replaces this file.
// All math from the shared module — never compute runway locally.
import React from "react";
import { clientRunway } from "../../utils/runway.mjs";

const SEV_RANK = { empty: 0, critical: 1, warning: 2 };
const sevColor = (snap) =>
  !snap.configured ? "rgba(255,255,255,0.25)"
  : snap.severity === "empty" || snap.severity === "critical" ? "#ff453a"
  : snap.severity === "warning" ? "#ff9f0a"
  : "#30d158";
const fmtDays = (d) => d == null ? "—" : d < 10 ? `${Math.round(d * 10) / 10}d` : `${Math.round(d)}d`;

export default function RunwayRoute({ clients, content, isMobile }) {
  const now = Date.now();
  const rows = (clients || [])
    .filter((c) => c.content_tracking_enabled)
    .map((c) => ({
      client: c,
      snap: clientRunway(c, (content || []).filter((i) => i.client_id === c.id), { now }),
    }))
    .sort((a, b) => {
      const ra = a.snap.severity ? SEV_RANK[a.snap.severity] : a.snap.configured ? 3 : 4;
      const rb = b.snap.severity ? SEV_RANK[b.snap.severity] : b.snap.configured ? 3 : 4;
      return ra - rb || (a.snap.runwayDays ?? 1e9) - (b.snap.runwayDays ?? 1e9);
    });

  const cell = { padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "rgba(255,255,255,0.85)" };
  const head = { ...cell, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "rgba(255,255,255,0.35)", fontWeight: 600 };
  const mono = { fontFamily: "'Geist Mono', monospace" };

  return (
    <div style={{ padding: isMobile ? "18px 14px" : "28px 34px" }}>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: 30, color: "#fff", marginBottom: 4 }}>
        Content Runway
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 22 }}>
        Days of content left per client. Alerts fire in #content when a shoot needs booking.
      </div>

      {!rows.length && (
        <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 13, background: "#0f0d0e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
          No tracked clients yet — enable content tracking on a client to see runway here.
        </div>
      )}

      {!!rows.length && (
        <div style={{ background: "#0f0d0e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: "left" }}>Client</th>
                <th style={{ ...head, textAlign: "right" }}>Ready</th>
                <th style={{ ...head, textAlign: "right" }}>In prod</th>
                <th style={{ ...head, textAlign: "right" }}>Burn</th>
                <th style={{ ...head, textAlign: "right" }}>Runway</th>
                <th style={{ ...head, textAlign: "left" }}>Book by</th>
                <th style={{ ...head, textAlign: "left" }}>Last shoot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, snap }) => (
                <tr key={client.id} style={snap.severity === "critical" || snap.severity === "empty" ? { background: "rgba(255,69,58,0.06)" } : undefined}>
                  <td style={{ ...cell, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: sevColor(snap), marginRight: 9 }} />
                    {client.name}
                    {!snap.configured && <span style={{ marginLeft: 8, fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 }}>set cadence</span>}
                  </td>
                  <td style={{ ...cell, ...mono, textAlign: "right" }}>{snap.inventory.ready}</td>
                  <td style={{ ...cell, ...mono, textAlign: "right" }}>{snap.inventory.production}</td>
                  <td style={{ ...cell, ...mono, textAlign: "right" }}>
                    {snap.burn.perDay != null ? `${Math.round(snap.burn.perDay * 10) / 10}/d` : "—"}
                    {snap.burn.source && <span style={{ marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{snap.burn.source === "posted_at" ? "measured" : snap.burn.source}</span>}
                  </td>
                  <td style={{ ...cell, ...mono, textAlign: "right", fontWeight: 700, color: sevColor(snap) }}>{fmtDays(snap.runwayDays)}</td>
                  <td style={{ ...cell, ...mono }}>{snap.severity ? (snap.bookBy || "NOW") : "—"}</td>
                  <td style={{ ...cell, ...mono }}>{snap.lastShoot || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
