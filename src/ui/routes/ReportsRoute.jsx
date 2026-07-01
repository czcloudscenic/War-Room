import React, { useEffect, useMemo, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

// ── Fulfillment Reports ───────────────────────────────────────────────────────
// The accountability scoreboard over the ledger. Answers "are we delivering well?"
// — first-pass approval rate, on-time delivery, revision load, posting rate, output
// volume — overall and per client. Computed from content_items (ledger) + the
// approvals audit trail. This is the "why it won / where we're slipping" layer.

const ACCENT = "#2AABFF";
const NEED_ATTENTION = ["Need Copy Approval", "Need Content Approval", "Needs Revisions"];
const SHIPPED = ["Approved", "Scheduled", "Posted"];

function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function clientName(clients, id) { const c = (clients || []).find(x => x?.id === id); return c ? (c.name || "—") : "Unassigned"; }
function fmtDate(d) { if (!d) return "—"; const t = new Date(d); return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

function KpiCard({ value, suffix, label, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: "18px 20px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 30, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color, lineHeight: 1 }}>{value}</span>
        {suffix && <span style={{ fontSize: 14, fontWeight: 600, color, fontFamily: "'Geist Mono', monospace" }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginTop: 10, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function ReportsRoute({ isMobile, clients = [], content = [] }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const safeClients = clients || [];
  const safeContent = content || [];
  const safeApprovals = approvals || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await sb.from("approvals").select("id,content_item_id,client_id,approver_email,decision,stage,feedback,created_at").order("created_at", { ascending: false });
      if (!cancelled) { if (!error && Array.isArray(data)) setApprovals(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const k = useMemo(() => {
    const items = content || [];
    const shipped = items.filter(x => SHIPPED.includes(x?.status));
    const posted = items.filter(x => x?.posted_at);
    // On-time: posted on or before its scheduled publish_date
    const onTime = posted.filter(x => x?.publish_date && new Date(x.posted_at) <= new Date(new Date(x.publish_date).getTime() + 86400000));
    // First-pass: shipped with zero revisions
    const firstPass = shipped.filter(x => !x?.revision_count);
    // Revision load
    const revs = items.reduce((s, x) => s + (Number(x?.revision_count) || 0), 0);
    const revised = items.filter(x => Number(x?.revision_count) > 0).length;
    return {
      total: items.length,
      shipped: shipped.length,
      posted: posted.length,
      inFlight: items.filter(x => !SHIPPED.includes(x?.status) && x?.status !== "Scrapped").length,
      awaiting: items.filter(x => NEED_ATTENTION.includes(x?.status)).length,
      onTimeRate: pct(onTime.length, posted.length),
      firstPassRate: pct(firstPass.length, shipped.length),
      postingRate: pct(posted.length, shipped.length),
      avgRevisions: items.length ? (revs / items.length).toFixed(1) : "0",
      revised,
    };
  }, [content]);

  const perClient = useMemo(() => {
    const allClients = clients || [];
    const allContent = content || [];
    return allClients.map(c => {
      const items = allContent.filter(x => x?.client_id === c?.id);
      const shipped = items.filter(x => SHIPPED.includes(x?.status));
      const posted = items.filter(x => x?.posted_at);
      const firstPass = shipped.filter(x => !x?.revision_count);
      return {
        id: c?.id, name: c?.name, color: c?.brand_color || ACCENT,
        total: items.length,
        awaiting: items.filter(x => NEED_ATTENTION.includes(x?.status)).length,
        firstPass: pct(firstPass.length, shipped.length),
        posted: posted.length,
        cadence: c?.cadence || null,
      };
    }).filter(r => (r?.total || 0) > 0).sort((a, b) => (b?.total || 0) - (a?.total || 0));
  }, [clients, content]);

  const decisions = safeApprovals.slice(0, 12);
  const itemTitle = (id) => { const it = safeContent.find(x => x?.id === id); return it ? (it.title || "Untitled") : id; };
  const decColor = (d) => d === "approved" ? "#30d158" : d === "revision_requested" ? "#f97316" : "#ff453a";
  const decLabel = (d) => d === "approved" ? "Approved" : d === "revision_requested" ? "Revisions" : "Rejected";

  const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
  const col = (w, extra = {}) => ({ flex: w, minWidth: 0, ...extra });

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: isMobile ? 22 : 32, paddingBottom: isMobile ? 18 : 26, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", fontFamily: "'Geist Mono', monospace", marginBottom: 12 }}>Cloud Scenic / Fulfillment Reports</div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: "italic", color: "#fff", margin: 0, letterSpacing: -1, lineHeight: 1 }}>Reports</h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "12px 0 0" }}>How well the team is delivering — quality, reliability, and throughput across every client.</p>
      </div>

      {/* headline KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <KpiCard value={k.firstPassRate} suffix="%" label="First-pass approval" sub={`${k.shipped} shipped, ${k.revised} needed revisions`} color={k.firstPassRate >= 70 ? "#30d158" : "#f59e0b"} />
        <KpiCard value={k.onTimeRate} suffix="%" label="On-time delivery" sub={`${k.posted} posted`} color={k.onTimeRate >= 80 ? "#30d158" : "#f59e0b"} />
        <KpiCard value={k.postingRate} suffix="%" label="Posting rate" sub="approved → actually live" color={k.postingRate >= 80 ? "#30d158" : "#ff375f"} />
        <KpiCard value={k.avgRevisions} label="Avg revisions / item" sub={`${k.awaiting} awaiting review now`} color="#64d2ff" />
      </div>

      {/* throughput strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <KpiCard value={k.total} label="Total deliverables" color="#fff" />
        <KpiCard value={k.inFlight} label="In production" color="#ff375f" />
        <KpiCard value={k.shipped} label="Shipped" color="#2AABFF" />
        <KpiCard value={k.posted} label="Posted (proof)" color="#30d158" />
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        {/* per-client */}
        <div style={{ flex: 1.4, minWidth: 280 }}>
          <div style={{ ...head, marginBottom: 10 }}>By client</div>
          <div style={{ background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ ...head, ...col(2) }}>Client</div>
              <div style={{ ...head, ...col(1), textAlign: "right" }}>Items</div>
              <div style={{ ...head, ...col(1), textAlign: "right" }}>Review</div>
              <div style={{ ...head, ...col(1.2), textAlign: "right" }}>1st-pass</div>
              <div style={{ ...head, ...col(1), textAlign: "right" }}>Posted</div>
            </div>
            {perClient.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>No deliverables yet.</div>
            ) : perClient.map((r, i) => (
              <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", borderBottom: i < perClient.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ ...col(2), display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "#f5f5f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    {r.cadence && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.cadence}</div>}
                  </div>
                </div>
                <div style={{ ...col(1), textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>{r.total}</div>
                <div style={{ ...col(1), textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: r.awaiting ? "#f97316" : "rgba(255,255,255,0.3)" }}>{r.awaiting || "—"}</div>
                <div style={{ ...col(1.2), textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: r.firstPass >= 70 ? "#30d158" : "rgba(255,255,255,0.6)" }}>{r.firstPass}%</div>
                <div style={{ ...col(1), textAlign: "right", fontFamily: "'Geist Mono', monospace", fontSize: 12.5, color: "#30d158" }}>{r.posted}</div>
              </div>
            ))}
          </div>
        </div>

        {/* recent decisions */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ ...head, marginBottom: 10 }}>Recent decisions</div>
          <div style={{ background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loading…</div>
            ) : decisions.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.4)" }}>No approvals recorded yet. They'll appear as the team works the Ledger.</div>
            ) : decisions.map((a, i) => (
              <div key={a?.id} style={{ padding: "11px 16px", borderBottom: i < decisions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#f5f5f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemTitle(a?.content_item_id)}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: decColor(a?.decision), flexShrink: 0 }}>{decLabel(a?.decision)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName(safeClients, a?.client_id)}{a?.approver_email ? ` · ${a.approver_email.split("@")[0]}` : ""}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>{fmtDate(a?.created_at)}</span>
                </div>
                {a?.feedback && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 4, fontStyle: "italic" }}>“{a.feedback}”</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
