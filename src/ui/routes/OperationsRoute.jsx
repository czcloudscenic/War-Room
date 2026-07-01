import React, { useCallback, useEffect, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';
import { apiFetch } from '../../services/apiFetch.js';

// ── Operations ────────────────────────────────────────────────────────────────
// The automation engine. Three tabs:
//   AI Assign — dump a raw task list → the ops agent scores priority + assigns each
//               to the best-fit team member by skill → review → commit to the board.
//   Tasks     — Kanban (Backlog / In Progress / Review / Done).
//   Team      — the roster + skills (the capability matrix the AI routes against).

const ACCENT = "#2AABFF";
const COLS = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];
const PRIORITY_COLOR = { urgent: "#ff453a", high: "#f97316", medium: "#64d2ff", low: "rgba(255,255,255,0.45)" };
const STATUS_DOT = { online: "#30d158", busy: "#ff9f0a", away: "#ffd60a", offline: "rgba(255,255,255,0.3)" };

function fmtDate(d) { if (!d) return null; const t = new Date(d); return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
const head = { fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.38)", fontWeight: 700, fontFamily: "'Geist Mono', monospace" };
const input = { width: "100%", background: "#161314", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, color: "#f5f5f7", outline: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box" };

export default function OperationsRoute({ isMobile, clients = [] }) {
  const [tab, setTab] = useState("assign");
  const [team, setTeam] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskDump, setTaskDump] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [adding, setAdding] = useState(false);
  const [nm, setNm] = useState({ name: "", role: "", skills: "" });
  const safeClients = clients || [];
  const safeTeam = team || [];
  const safeTasks = tasks || [];
  const safeAssignments = assignments || [];

  const loadTeam = useCallback(async () => { const { data } = await sb.from("team_members").select("*").eq("active", true).order("name"); if (Array.isArray(data)) setTeam(data); }, []);
  const loadTasks = useCallback(async () => { const { data } = await sb.from("tasks").select("*").order("score", { ascending: false }); if (Array.isArray(data)) setTasks(data); }, []);
  useEffect(() => { loadTeam(); loadTasks(); }, [loadTeam, loadTasks]);

  const memberById = (id) => safeTeam.find(m => m?.id === id);
  const clientName = (id) => { const c = safeClients.find(x => x?.id === id); return c ? c.name : null; };

  async function runAssign() {
    if (!taskDump.trim()) return;
    setBusy(true); setErr(null); setAssignments([]);
    try {
      const res = await apiFetch("/api/agent-action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ops_assign", payload: { taskDump, team: safeTeam } }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Assign failed");
      const out = Array.isArray(json?.result?.tasks) ? json.result.tasks : (Array.isArray(json?.tasks) ? json.tasks : []);
      if (!out.length) throw new Error("The agent returned no assignments — try rephrasing the list.");
      setAssignments(out);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function commitAssignments() {
    if (!safeAssignments.length) return;
    setBusy(true); setErr(null);
    try {
      const rows = safeAssignments.map(a => ({
        title: a?.title || "Untitled task",
        status: "backlog",
        priority: ["low", "medium", "high", "urgent"].includes(a?.priority) ? a.priority : "medium",
        score: Number(a?.score) || 0,
        assignee_id: a?.assignee_id || null,
        due_date: a?.due_hint || null,
        source: "ai_ops",
        reason: a?.reason || null,
      }));
      const { error } = await sb.from("tasks").insert(rows);
      if (error) throw new Error(error.message);
      setAssignments([]); setTaskDump("");
      await loadTasks(); setTab("tasks");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  async function advanceTask(t) {
    const order = ["backlog", "in_progress", "review", "done"];
    const next = order[Math.min(order.indexOf(t?.status) + 1, 3)];
    setTasks(prev => (prev || []).map(x => x?.id === t?.id ? { ...x, status: next } : x));
    await sb.from("tasks").update({ status: next, updated_at: new Date().toISOString() }).eq("id", t?.id);
  }

  async function addMember() {
    if (!nm.name.trim()) return;
    const skills = nm.skills.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await sb.from("team_members").insert({ name: nm.name.trim(), role: nm.role.trim() || null, skills, status: "online" });
    if (!error) { setNm({ name: "", role: "", skills: "" }); setAdding(false); loadTeam(); }
    else setErr(error.message);
  }

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "Inter, sans-serif", background: tab === id ? ACCENT : "rgba(255,255,255,0.05)", color: tab === id ? "#fff" : "rgba(255,255,255,0.6)" }}>{label}</button>
  );

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: 22, paddingBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", fontFamily: "'Geist Mono', monospace", marginBottom: 12 }}>Cloud Scenic / Operations</div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: isMobile ? 34 : 46, fontWeight: 400, fontStyle: "italic", color: "#fff", margin: 0, letterSpacing: -1, lineHeight: 1 }}>Operations</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <TabBtn id="assign" label="AI Assign" />
            <TabBtn id="tasks" label={`Tasks${safeTasks.length ? ` · ${safeTasks.filter(t => t?.status !== "done").length}` : ""}`} />
            <TabBtn id="team" label={`Team · ${safeTeam.length}`} />
          </div>
        </div>
      </div>

      {err && <div style={{ marginBottom: 14, padding: "9px 13px", borderRadius: 9, background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", color: "#ff453a", fontSize: 12 }}>{err}</div>}

      {/* ── AI ASSIGN ── */}
      {tab === "assign" && (
        <div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "0 0 14px" }}>Dump a task list — one per line, natural language. The agent scores priority and assigns each to the best-fit person by skill.</p>
          <textarea value={taskDump} onChange={e => setTaskDump(e.target.value)} rows={7}
            placeholder={"Edit the Vital Lyfe launch reel by Monday — needs Maya's eye\nPull Q1 ad spend numbers for Danny — high priority, today\nSchedule discovery call with Atlas Health\nWrite 3 cold email variants for the aerospace vertical"}
            style={{ ...input, resize: "vertical", minHeight: 120, fontFamily: "'Geist Mono', Inter, monospace", fontSize: 13, lineHeight: 1.6 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button disabled={busy || !taskDump.trim()} onClick={runAssign} style={{ height: 40, padding: "0 22px", borderRadius: 10, background: ACCENT, border: "none", color: "#fff", cursor: busy ? "default" : "pointer", fontSize: 13.5, fontWeight: 600, opacity: busy || !taskDump.trim() ? 0.5 : 1 }}>{busy ? "Assigning…" : "Auto-assign"}</button>
            {taskDump && <button onClick={() => { setTaskDump(""); setAssignments([]); }} style={{ height: 40, padding: "0 16px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>Clear</button>}
          </div>

          {safeAssignments.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={head}>{safeAssignments.length} assignment{safeAssignments.length === 1 ? "" : "s"} proposed</div>
                <button disabled={busy} onClick={commitAssignments} style={{ height: 34, padding: "0 16px", borderRadius: 9, background: "rgba(48,209,88,0.15)", border: "1px solid rgba(48,209,88,0.35)", color: "#30d158", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>Create {safeAssignments.length} task{safeAssignments.length === 1 ? "" : "s"} →</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {safeAssignments.map((raw, i) => {
                  const a = {
                    title: raw?.title || "Untitled task",
                    priority: ["low", "medium", "high", "urgent"].includes(raw?.priority) ? raw.priority : "medium",
                    score: Number(raw?.score) || 0,
                    reason: raw?.reason || "",
                    due_hint: raw?.due_hint || null,
                    assignee_id: raw?.assignee_id || null,
                    assignee_name: raw?.assignee_name || null,
                  };
                  const m = memberById(a.assignee_id);
                  const pc = PRIORITY_COLOR[a.priority] || PRIORITY_COLOR.medium;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                      <div style={{ width: 34, textAlign: "center", fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 700, color: pc }}>{a.score}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: "#f5f5f7", fontWeight: 500 }}>{a.title}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{a.reason}</div>
                      </div>
                      {a.due_hint && <div style={{ fontSize: 11, fontFamily: "'Geist Mono', monospace", color: "rgba(255,255,255,0.5)" }}>{fmtDate(a.due_hint)}</div>}
                      <div style={{ fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700, fontFamily: "'Geist Mono', monospace", color: pc, background: `${pc}14`, border: `1px solid ${pc}30`, borderRadius: 5, padding: "3px 8px" }}>{a.priority}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 110, justifyContent: "flex-end" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: m?.color || "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0d0907" }}>{(a.assignee_name || "?").slice(0, 2).toUpperCase()}</div>
                        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>{a.assignee_name || "Unassigned"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TASKS KANBAN ── */}
      {tab === "tasks" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {COLS.map(col => {
            const items = safeTasks.filter(t => t?.status === col.key);
            return (
              <div key={col.key} style={{ flex: 1, minWidth: 240 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 10px" }}>
                  <span style={head}>{col.label}</span>
                  <span style={{ ...head, color: "rgba(255,255,255,0.3)" }}>{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 60 }}>
                  {items.map(t => {
                    const m = memberById(t?.assignee_id);
                    const pc = PRIORITY_COLOR[t?.priority] || PRIORITY_COLOR.medium;
                    const cn = clientName(t?.client_id);
                    return (
                      <div key={t?.id} onClick={() => col.key !== "done" && advanceTask(t)} title={col.key !== "done" ? "Click to advance" : ""} style={{ padding: "12px 14px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, cursor: col.key !== "done" ? "pointer" : "default" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
                          <div style={{ fontSize: 12.5, color: "#f5f5f7", lineHeight: 1.35 }}>{t?.title}</div>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: pc, marginTop: 5, flexShrink: 0 }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
                          {m && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 16, height: 16, borderRadius: "50%", background: m?.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7.5, fontWeight: 700, color: "#0d0907" }}>{(m?.name || "?").slice(0, 2).toUpperCase()}</div><span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)" }}>{(m?.name || "Team").split(" ")[0]}</span></div>}
                          {t?.due_date && <span style={{ fontSize: 10, fontFamily: "'Geist Mono', monospace", color: "rgba(255,255,255,0.4)" }}>· {fmtDate(t.due_date)}</span>}
                          {cn && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{cn}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <div style={{ padding: "16px 8px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TEAM ── */}
      {tab === "team" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={() => setAdding(a => !a)} style={{ height: 34, padding: "0 15px", borderRadius: 9, background: adding ? "rgba(255,255,255,0.05)" : ACCENT, border: adding ? "1px solid rgba(255,255,255,0.12)" : "none", color: adding ? "rgba(255,255,255,0.6)" : "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>{adding ? "Cancel" : "+ Add member"}</button>
          </div>
          {adding && (
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", padding: 14, background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
              <input placeholder="Name" value={nm.name} onChange={e => setNm({ ...nm, name: e.target.value })} style={{ ...input, flex: 1, minWidth: 140 }} />
              <input placeholder="Role" value={nm.role} onChange={e => setNm({ ...nm, role: e.target.value })} style={{ ...input, flex: 1, minWidth: 120 }} />
              <input placeholder="Skills (comma-sep)" value={nm.skills} onChange={e => setNm({ ...nm, skills: e.target.value })} style={{ ...input, flex: 2, minWidth: 180 }} />
              <button onClick={addMember} style={{ height: 44, padding: "0 20px", borderRadius: 10, background: ACCENT, border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Add</button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {safeTeam.map(m => {
              const load = safeTasks.filter(t => t?.assignee_id === m?.id && t?.status !== "done").length;
              return (
                <div key={m?.id} style={{ padding: "16px 18px", background: "#0f0d0e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: m?.color || ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#0d0907", flexShrink: 0 }}>{(m?.name || "?").slice(0, 2).toUpperCase()}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, color: "#f5f5f7", fontWeight: 600 }}>{m?.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: STATUS_DOT[m?.status] || STATUS_DOT.offline }} />
                        <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)" }}>{m?.role || "team"}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Geist Mono', monospace", color: load ? ACCENT : "rgba(255,255,255,0.3)" }}>{load}</div>
                      <div style={{ fontSize: 8, letterSpacing: 0.4, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>active</div>
                    </div>
                  </div>
                  {Array.isArray(m?.skills) && m.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
                      {m.skills.map(s => <span key={s} style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, padding: "3px 7px", fontFamily: "'Geist Mono', monospace" }}>{s}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
