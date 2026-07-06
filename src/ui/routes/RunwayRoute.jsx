import React, { useMemo, useState } from "react";
import LogShootModal from "../pipeline/LogShootModal.jsx";
import { clientRunway } from "../../utils/runway.mjs";

const PAGE = "#0d0907";
const CARD = "#0f0d0e";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "#2AABFF";
const GREEN = "#30d158";
const AMBER = "#ff9f0a";
const RED = "#ff453a";
const DIM = "rgba(255,255,255,0.28)";

const SEVERITY_RANK = { empty: 0, critical: 1, warning: 2 };

function severityColor(snap) {
  if (!snap.configured) return DIM;
  if (snap.severity === "empty" || snap.severity === "critical") return RED;
  if (snap.severity === "warning") return AMBER;
  return GREEN;
}

function severityLabel(snap) {
  if (!snap.configured) return "set cadence";
  return snap.severity || "green";
}

function severityBg(snap) {
  if (!snap.configured) return "rgba(255,255,255,0.04)";
  if (snap.severity === "empty" || snap.severity === "critical") return "rgba(255,69,58,0.08)";
  if (snap.severity === "warning") return "rgba(255,159,10,0.08)";
  return "rgba(48,209,88,0.08)";
}

function severityBorder(snap) {
  if (!snap.configured) return "rgba(255,255,255,0.09)";
  if (snap.severity === "empty" || snap.severity === "critical") return "rgba(255,69,58,0.24)";
  if (snap.severity === "warning") return "rgba(255,159,10,0.24)";
  return "rgba(48,209,88,0.22)";
}

function rowRank(snap) {
  if (!snap.configured) return 4;
  return snap.severity ? SEVERITY_RANK[snap.severity] : 3;
}

function fmtDays(days) {
  if (days == null) return "—";
  return days < 10 ? days.toFixed(1) : String(Math.round(days));
}

function fmtBurn(burn) {
  if (burn?.perDay == null) return "—";
  return `${burn.perDay.toFixed(1)}/day`;
}

function sourceTag(source) {
  if (!source) return null;
  return source === "posted_at" ? "posted" : source;
}

function SummaryStat({ value, label, color }) {
  const quiet = !value;
  return (
    <div
      style={{
        minWidth: 0,
        padding: "14px 16px",
        border: `1px solid ${quiet ? "rgba(255,255,255,0.06)" : color + "30"}`,
        borderRadius: 8,
        background: quiet ? "rgba(255,255,255,0.02)" : `${color}10`,
      }}
    >
      <div style={{ color: quiet ? "rgba(255,255,255,0.35)" : color, fontFamily: "'Geist Mono', monospace", fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.42)", fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function ClientName({ client, snap }) {
  return (
    <div style={{ display: "flex", alignItems: "center", minWidth: 0, gap: 9 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: client.brand_color || ACCENT, flexShrink: 0 }} />
      <span style={{ overflow: "hidden", color: "#f5f5f7", fontSize: 13, fontWeight: 650, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {client.name}
      </span>
      <span title={severityLabel(snap)} style={{ width: 6, height: 6, borderRadius: "50%", background: severityColor(snap), flexShrink: 0 }} />
      {!snap.configured && (
        <span style={{ color: DIM, fontSize: 9, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", whiteSpace: "nowrap" }}>
          set cadence
        </span>
      )}
    </div>
  );
}

function BurnCell({ burn }) {
  const tag = sourceTag(burn?.source);
  return (
    <span style={{ fontFamily: "'Geist Mono', monospace" }}>
      {fmtBurn(burn)}
      {tag && (
        <span style={{ marginLeft: 7, color: "rgba(255,255,255,0.32)", fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {tag}
        </span>
      )}
    </span>
  );
}

function RunwayTable({ rows }) {
  const cell = {
    padding: "13px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.78)",
    fontSize: 12.5,
    verticalAlign: "middle",
  };
  const head = {
    ...cell,
    color: "rgba(255,255,255,0.34)",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
  const monoRight = { ...cell, fontFamily: "'Geist Mono', monospace", textAlign: "right" };
  const monoLeft = { ...cell, fontFamily: "'Geist Mono', monospace" };

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, background: CARD, overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: "left" }}>Client</th>
            <th style={{ ...head, textAlign: "right" }}>Pieces ready</th>
            <th style={{ ...head, textAlign: "right" }}>In production</th>
            <th style={{ ...head, textAlign: "right" }}>Burn</th>
            <th style={{ ...head, textAlign: "right" }}>Runway days</th>
            <th style={{ ...head, textAlign: "left" }}>Book by</th>
            <th style={{ ...head, textAlign: "left" }}>Last shoot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ client, snap }) => {
            const urgent = snap.severity === "critical" || snap.severity === "empty";
            return (
              <tr key={client.id} style={{ background: urgent ? "rgba(255,69,58,0.06)" : "transparent" }}>
                <td style={{ ...cell, minWidth: 210 }}>
                  <ClientName client={client} snap={snap} />
                </td>
                <td style={monoRight}>{snap.inventory.ready}</td>
                <td style={monoRight}>{snap.inventory.production}</td>
                <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                  <BurnCell burn={snap.burn} />
                </td>
                <td style={{ ...monoRight, color: severityColor(snap), fontWeight: 800 }}>{fmtDays(snap.runwayDays)}</td>
                <td style={monoLeft}>{snap.configured ? snap.bookBy || "—" : "—"}</td>
                <td style={monoLeft}>{snap.lastShoot || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatLine({ label, children, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 4, color: "rgba(255,255,255,0.34)", fontSize: 8.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: color || "rgba(255,255,255,0.82)", fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 700, minHeight: 17 }}>
        {children}
      </div>
    </div>
  );
}

function RunwayCard({ client, snap }) {
  const urgent = snap.severity === "critical" || snap.severity === "empty";
  return (
    <div
      style={{
        padding: 16,
        border: `1px solid ${urgent ? "rgba(255,69,58,0.22)" : BORDER}`,
        borderRadius: 8,
        background: urgent ? "rgba(255,69,58,0.06)" : CARD,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 15 }}>
        <ClientName client={client} snap={snap} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 9px", border: `1px solid ${severityBorder(snap)}`, borderRadius: 999, background: severityBg(snap), color: severityColor(snap), fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: severityColor(snap) }} />
          {severityLabel(snap)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <StatLine label="Pieces ready">{snap.inventory.ready}</StatLine>
        <StatLine label="In production">{snap.inventory.production}</StatLine>
        <StatLine label="Burn">
          <BurnCell burn={snap.burn} />
        </StatLine>
        <StatLine label="Runway days" color={severityColor(snap)}>{fmtDays(snap.runwayDays)}</StatLine>
        <StatLine label="Book by">{snap.configured ? snap.bookBy || "—" : "—"}</StatLine>
        <StatLine label="Last shoot">{snap.lastShoot || "—"}</StatLine>
      </div>
    </div>
  );
}

export default function RunwayRoute({ clients = [], content = [], isMobile }) {
  const [logOpen, setLogOpen] = useState(false);

  const rows = useMemo(() => {
    const now = Date.now();
    return clients
      .filter((client) => client.content_tracking_enabled)
      .map((client) => {
        const itemsForClient = content.filter((item) => item.client_id === client.id);
        return { client, snap: clientRunway(client, itemsForClient, { now }) };
      })
      .sort((a, b) => (
        rowRank(a.snap) - rowRank(b.snap)
        || (a.snap.runwayDays ?? Number.POSITIVE_INFINITY) - (b.snap.runwayDays ?? Number.POSITIVE_INFINITY)
        || (a.client.name || "").localeCompare(b.client.name || "")
      ));
  }, [clients, content]);

  const summary = useMemo(() => ({
    tracked: rows.length,
    warning: rows.filter(({ snap }) => snap.severity === "warning").length,
    criticalEmpty: rows.filter(({ snap }) => snap.severity === "critical" || snap.severity === "empty").length,
  }), [rows]);

  return (
    <div style={{ minHeight: "100%", padding: isMobile ? "18px 14px 28px" : "28px 34px 40px", background: PAGE, color: "#f5f5f7", fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ marginBottom: 5, color: "rgba(255,255,255,0.5)", fontFamily: "'Geist Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2.7, textTransform: "uppercase" }}>
            Cloud Scenic / Content Ops
          </div>
          <h1 style={{ margin: 0, color: "#fff", fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontStyle: "italic", fontWeight: 400, letterSpacing: 0, lineHeight: 1 }}>
            Content Runway
          </h1>
          <p style={{ maxWidth: 640, margin: "10px 0 0", color: "rgba(255,255,255,0.48)", fontSize: 12.5, lineHeight: 1.55 }}>
            Days of usable content left per tracked client.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setLogOpen(true)}
          disabled={!rows.length}
          style={{
            height: 38,
            padding: "0 16px",
            border: "none",
            borderRadius: 8,
            background: ACCENT,
            color: "#fff",
            cursor: rows.length ? "pointer" : "not-allowed",
            fontSize: 12.5,
            fontWeight: 700,
            opacity: rows.length ? 1 : 0.5,
            whiteSpace: "nowrap",
          }}
        >
          Log shoot
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 18 }}>
        <SummaryStat value={summary.tracked} label="Tracked" color={ACCENT} />
        <SummaryStat value={summary.warning} label="Warning" color={AMBER} />
        <SummaryStat value={summary.criticalEmpty} label="Critical + Empty" color={RED} />
      </div>

      {!rows.length ? (
        <div style={{ padding: "54px 28px", border: `1px dashed ${BORDER}`, borderRadius: 8, background: CARD, color: "rgba(255,255,255,0.42)", fontSize: 13, textAlign: "center" }}>
          No tracked clients yet. Enable content tracking in a client editor to see runway here.
        </div>
      ) : isMobile ? (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map(({ client, snap }) => (
            <RunwayCard key={client.id} client={client} snap={snap} />
          ))}
        </div>
      ) : (
        <RunwayTable rows={rows} />
      )}

      {logOpen && (
        <LogShootModal
          clients={rows.map(({ client }) => client)}
          defaultClientId={rows[0]?.client.id}
          onClose={() => setLogOpen(false)}
        />
      )}
    </div>
  );
}
