import React, { useMemo, useState } from 'react';
import { recordApproval, setLedgerFields, markPosted } from '../../core/approvals.js';

// ── Deliverables Ledger ───────────────────────────────────────────────────────
// The system-of-record + the approval surface. Every deliverable as one row: who
// owns it, for which client, what state, when it's due, when it posts, scope/billing
// flags, and proof it went live. Click a row to act on it — assign a due date,
// Approve, Request Revisions (writes the approvals audit trail + notifies), or
// Mark Posted (the Friday "did it post?" stamp).
//
// Reads the ledger columns defensively, so it works pre- and post-migration.

const ACCENT = "#2AABFF";

const NEED_ATTENTION = ["Need Copy Approval", "Need Content Approval", "Needs Revisions"];
const IN_PRODUCTION  = ["Ready For Copy Creation", "Ready For Content Creation", "Ready For Schedule"];

function statusColor(status) {
  if (NEED_ATTENTION.includes(status)) return "#f97316";
  if (IN_PRODUCTION.includes(status))  return "#ff375f";
  if (status === "Approved")  return "#2AABFF";
  if (status === "Scheduled") return "#64d2ff";
  if (status === "Posted")    return "#30d158";
  return "rgba(255,255,255,0.4)";
}
function fmtDate(d) {
  if (!d) return null;
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return String(d);
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function isThisWeek(d) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return !Number.isNaN(t) && t >= Date.now() && t <= Date.now() + 7 * 86400000;
}
function isOverdue(item) {
  const t = item?.due_date ? new Date(item.due_date).getTime() : NaN;
  if (Number.isNaN(t)) return false;
  return t < Date.now() && !["Approved", "Scheduled", "Posted"].includes(item?.status) && !item?.posted_at;
}
function clientName(clients, id) { const c = (clients || []).find(x => x?.id === id); return c ? (c.name || "—") : "—"; }
function clientColor(clients, id) { const c = (clients || []).find(x => x?.id === id); return c?.brand_color || ACCENT; }

function Flag({ label, color }) {
  return <span style={{ fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700, fontFamily: "'Geist Mono', monospace", color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 4, padding: "2px 6px" }}>{label}</span>;
}
function SummaryStat({ value, label, color }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color: value ? color : "rgba(255,255,255,0.3)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginTop: 7, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function LedgerRoute({ isMobile, clients = [], content = [], team = [], currentUser }) {
  const [expandedId, setExpandedId] = useState(null);
  const [overrides, setOverrides] = useState({});   // id → patched fields (optimistic UI)
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const safeClients = clients || [];
  const safeContent = content || [];
  const safeTeam = team || [];

  const patch = (id, fields) => setOverrides(o => ({ ...(o || {}), [id]: { ...((o || {})[id] || {}), ...fields } }));
  const view = (item) => ({ ...(item || {}), ...(overrides[item?.id] || {}) });
  const stageOf = (item) => ((item?.status || "").includes("Copy") ? "copy" : "content");

  async function doApprove(item) {
    setBusy(item.id); setErr(null);
    try { const { status } = await recordApproval({ item, decision: "approved", stage: stageOf(item), approver: currentUser }); patch(item.id, { status }); setExpandedId(null); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  }
  async function doRevision(item) {
    if (!feedback.trim()) { setErr("Add feedback for the revision."); return; }
    setBusy(item.id); setErr(null);
    try { const r = await recordApproval({ item, decision: "revision_requested", stage: stageOf(item), feedback, approver: currentUser }); patch(item.id, { status: "Needs Revisions", revision_count: r.revision_count }); setFeedback(""); setExpandedId(null); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  }
  async function doPosted(item) {
    setBusy(item.id); setErr(null);
    try { await markPosted(item.id); patch(item.id, { status: "Posted", posted_at: new Date().toISOString() }); setExpandedId(null); }
    catch (e) { setErr(e.message); } finally { setBusy(null); }
  }
  async function doDue(item, due) {
    setErr(null);
    try { await setLedgerFields(item.id, { due_date: due || null }); patch(item.id, { due_date: due || null }); }
    catch (e) { setErr(e.message); }
  }

  const ownerOf = (item) => { if (!item?.assigned_to) return null; const t = safeTeam.find(m => m?.id === item.assigned_to); return t ? (t.name || t.email || "Assigned") : "Assigned"; };

  const rows = useMemo(() => {
    const merged = safeContent.map(view);
    const rank = (x) => (isOverdue(x) ? 0 : NEED_ATTENTION.includes(x?.status) ? 1 : IN_PRODUCTION.includes(x?.status) ? 2 : x?.status === "Approved" ? 3 : x?.status === "Scheduled" ? 4 : 5);
    return merged.sort((a, b) => { const r = rank(a) - rank(b); if (r) return r; const da = a?.due_date ? new Date(a.due_date).getTime() : Infinity; const db = b?.due_date ? new Date(b.due_date).getTime() : Infinity; return da - db; });
  }, [safeContent, overrides]);

  const dueThisWeek    = rows.filter(x => isThisWeek(x?.due_date)).length;
  const awaitingReview = rows.filter(x => NEED_ATTENTION.includes(x?.status)).length;
  const scheduled      = rows.filter(x => x?.status === "Scheduled").length;
  const awaitingPost   = rows.filter(x => !x?.posted_at && x?.publish_date && new Date(x.publish_date).getTime() <= Date.now() && (x?.status === "Scheduled" || x?.status === "Approved")).length;

  const col = (w, extra = {}) => ({ flex: w, minWidth: 0, ...extra });
  const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
  const btn = (bg, color = "#fff") => ({ height: 30, padding: "0 13px", borderRadius: 8, background: bg, border: "none", color, cursor: "pointer", fontSize: 11.5, fontWeight: 600 });

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: isMobile ? 22 : 32, paddingBottom: isMobile ? 18 : 26, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", fontFamily: "'Geist Mono', monospace", marginBottom: 12 }}>Cloud Scenic / Deliverables Ledger</div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: "italic", color: "#fff", margin: 0, letterSpacing: -1, lineHeight: 1 }}>Ledger</h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "12px 0 0" }}>{safeContent.length} deliverable{safeContent.length === 1 ? "" : "s"} across {safeClients.length} client{safeClients.length === 1 ? "" : "s"} — click a row to assign, approve, or mark posted.</p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <SummaryStat value={dueThisWeek} label="Due this week" color="#f59e0b" />
        <SummaryStat value={awaitingReview} label="Awaiting review" color="#f97316" />
        <SummaryStat value={scheduled} label="Scheduled" color="#64d2ff" />
        <SummaryStat value={awaitingPost} label="Awaiting post" color="#ff375f" />
      </div>

      {err && <div style={{ marginBottom: 14, padding: "9px 13px", borderRadius: 9, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a", fontSize: 12 }}>{err}</div>}

      {safeContent.length === 0 ? (
        <div style={{ padding: "60px 30px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 16 }}>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, fontStyle: "italic", color: "#f5f5f7", marginBottom: 8 }}>Nothing in the ledger yet.</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Deliverables land here as the team and agents create content.</div>
        </div>
      ) : (
        <div style={{ background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ ...head, ...col(2.4) }}>Deliverable</div>
              <div style={{ ...head, ...col(1.2) }}>Client</div>
              <div style={{ ...head, ...col(1) }}>Owner</div>
              <div style={{ ...head, ...col(1.1) }}>Status</div>
              <div style={{ ...head, ...col(0.7) }}>Due</div>
              <div style={{ ...head, ...col(0.7) }}>Post</div>
              <div style={{ ...head, ...col(1.2), textAlign: "right" }}>Flags</div>
            </div>
          )}

          {rows.map((item, i) => {
            const sc = statusColor(item.status);
            const overdue = isOverdue(item);
            const owner = ownerOf(item);
            const open = expandedId === item.id;
            const working = busy === item.id;
            return (
              <React.Fragment key={item.id || i}>
                <div onClick={() => { setExpandedId(open ? null : item.id); setErr(null); }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderBottom: (i < rows.length - 1 || open) ? "1px solid rgba(255,255,255,0.05)" : "none", flexWrap: isMobile ? "wrap" : "nowrap", cursor: "pointer", background: open ? "rgba(255,255,255,0.02)" : "transparent" }}>
                  <div style={col(2.4)}>
                    <div style={{ fontSize: 13, color: "#f5f5f7", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "Untitled"}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Geist Mono', monospace", marginTop: 2 }}>{[item.type, item.platform].filter(Boolean).join(" · ") || "—"}{item.revision_count ? ` · rev ${item.revision_count}` : ""}</div>
                  </div>
                  <div style={{ ...col(1.2), display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: clientColor(safeClients, item.client_id), flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName(safeClients, item.client_id)}</span>
                  </div>
                  <div style={{ ...col(1), fontSize: 12, color: owner ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)" }}>{owner || "—"}</div>
                  <div style={col(1.1)}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: sc, fontWeight: 600 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: sc }} />{item.status || "—"}</span></div>
                  <div style={{ ...col(0.7), fontSize: 11.5, fontFamily: "'Geist Mono', monospace", color: overdue ? "#ff453a" : "rgba(255,255,255,0.6)" }}>{fmtDate(item.due_date) || "—"}</div>
                  <div style={{ ...col(0.7), fontSize: 11.5, fontFamily: "'Geist Mono', monospace", color: item.posted_at ? "#30d158" : "rgba(255,255,255,0.6)" }}>{item.posted_at ? "✓ live" : (fmtDate(item.publish_date) || "—")}</div>
                  <div style={{ ...col(1.2), display: "flex", gap: 6, justifyContent: isMobile ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
                    {item.in_scope === false && <Flag label="out of scope" color="#ff9f0a" />}
                    {item.billable === false && <Flag label="non-billable" color="rgba(255,255,255,0.45)" />}
                    {item.approval_mode === "client" && <Flag label="client approval" color="#64d2ff" />}
                    {overdue && <Flag label="overdue" color="#ff453a" />}
                  </div>
                </div>

                {open && (
                  <div onClick={(e) => e.stopPropagation()} style={{ padding: "16px 18px", background: "#0b090a", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ ...head, marginBottom: 6 }}>Due date</div>
                      <input type="date" value={item.due_date ? String(item.due_date).slice(0, 10) : ""} onChange={(e) => doDue(item, e.target.value)} style={{ height: 32, padding: "0 10px", borderRadius: 8, background: "#161314", border: "1px solid rgba(255,255,255,0.12)", color: "#f5f5f7", fontSize: 12, fontFamily: "'Geist Mono', monospace" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ ...head, marginBottom: 6 }}>Revision feedback</div>
                      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What needs to change? (required to request revisions)" rows={2} style={{ width: "100%", padding: "8px 11px", borderRadius: 8, background: "#161314", border: "1px solid rgba(255,255,255,0.12)", color: "#f5f5f7", fontSize: 12.5, fontFamily: "Inter, sans-serif", resize: "vertical", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignSelf: "flex-end" }}>
                      <button disabled={working} onClick={() => doRevision(item)} style={btn("rgba(249,115,22,0.15)", "#f97316")}>Request revisions</button>
                      <button disabled={working} onClick={() => doApprove(item)} style={btn(ACCENT)}>{working ? "…" : "Approve"}</button>
                      {(item.status === "Scheduled" || item.status === "Approved") && <button disabled={working} onClick={() => doPosted(item)} style={btn("rgba(48,209,88,0.15)", "#30d158")}>Mark posted</button>}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
