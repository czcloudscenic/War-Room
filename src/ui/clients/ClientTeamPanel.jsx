import React, { useEffect, useState } from 'react';
import { sb } from '../../services/supabaseClient.js';

// ClientTeamPanel — embedded in AddClientModal (edit mode).
// Shows the team for one client: pending invites, approved members, rejected.
// Admin can invite an email, approve/reject pending, or remove an approved member.
//
// Approval flows back to App.jsx PendingApprovalScreen via realtime — invited
// user's screen auto-unlocks the moment we click Approve here.

export default function ClientTeamPanel({ clientId, clientName, currentUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  // Load + subscribe to this client's team
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error: e } = await sb
        .from("client_users")
        .select("id, email, status, invited_at, first_login_at, approved_at, rejected_at")
        .eq("client_id", clientId)
        .order("invited_at", { ascending: false });
      if (cancelled) return;
      if (e) console.warn("[ClientTeamPanel] load error", e);
      setRows(data || []);
      setLoading(false);
    };
    load();

    const channel = sb.channel(`client_team:${clientId}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "client_users", filter: `client_id=eq.${clientId}` },
          () => load())
      .subscribe();
    return () => { cancelled = true; sb.removeChannel(channel); };
  }, [clientId]);

  const invite = async (e) => {
    e?.preventDefault?.();
    setError("");
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Invalid email"); return; }
    setInviting(true);
    try {
      const { error: insErr } = await sb.from("client_users").insert({
        email,
        client_id: clientId,
        status: "pending",
        invited_by: currentUserId || null,
      });
      if (insErr) {
        if (insErr.code === "23505") setError(`${email} is already on the team list for this client.`);
        else setError(insErr.message);
        return;
      }
      setInviteEmail("");
    } finally {
      setInviting(false);
    }
  };

  const setStatus = async (id, status) => {
    const update = { status };
    if (status === "approved") { update.approved_at = new Date().toISOString(); update.approved_by = currentUserId || null; update.rejected_at = null; }
    if (status === "rejected") { update.rejected_at = new Date().toISOString(); update.approved_at = null; }
    if (status === "pending")  { update.approved_at = null; update.rejected_at = null; update.approved_by = null; }
    const { error: e } = await sb.from("client_users").update(update).eq("id", id);
    if (e) setError(e.message);
  };

  const remove = async (id, email) => {
    if (!window.confirm(`Remove ${email} from ${clientName}'s team?`)) return;
    const { error: e } = await sb.from("client_users").delete().eq("id", id);
    if (e) setError(e.message);
  };

  const pending  = rows.filter(r => r.status === "pending");
  const approved = rows.filter(r => r.status === "approved");
  const rejected = rows.filter(r => r.status === "rejected");

  const labelStyle = { fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.45)", display:"block", marginBottom:6 };
  const inputStyle = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"9px 12px", fontSize:16, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif", boxSizing:"border-box" };

  return (
    <div style={{ marginTop:18, paddingTop:18, borderTop:"1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.4)", letterSpacing:3, fontWeight:600, textTransform:"uppercase", marginBottom:4 }}>Team Access</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>People at {clientName} who can log in to their dashboard.</div>
      </div>

      <form onSubmit={invite} style={{ display:"flex", gap:8, marginBottom:14 }}>
        <input
          value={inviteEmail}
          onChange={e => setInviteEmail(e.target.value)}
          placeholder="teammate@example.com"
          style={{ ...inputStyle, flex:1 }}
          type="email"
        />
        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim()}
          style={{ background:"rgba(42,171,255,0.18)", border:"1px solid rgba(42,171,255,0.4)", borderRadius:10, color:"#2AABFF", fontSize:12, fontWeight:600, padding:"0 18px", cursor: inviting?"not-allowed":"pointer", opacity: inviting?0.55:1, fontFamily:"Inter, sans-serif", whiteSpace:"nowrap" }}>
          {inviting ? "Inviting…" : "Invite"}
        </button>
      </form>

      {error && (
        <div style={{ fontSize:11, color:"rgba(255,140,130,0.95)", marginBottom:12, padding:"7px 11px", background:"rgba(255,50,50,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
          {error}
        </div>
      )}

      {loading && <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", padding:"8px 0" }}>Loading team…</div>}

      {!loading && pending.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={labelStyle}>Awaiting Approval ({pending.length})</div>
          {pending.map(r => (
            <TeamRow key={r.id} row={r}
              left={r.first_login_at ? "🟡 Signed in, awaiting approval" : "📨 Invited, not yet signed in"}
              actions={
                <>
                  <ActionBtn color="#30d158" onClick={() => setStatus(r.id, "approved")}>Approve</ActionBtn>
                  <ActionBtn color="#ff453a" onClick={() => setStatus(r.id, "rejected")}>Reject</ActionBtn>
                </>
              }
            />
          ))}
        </div>
      )}

      {!loading && approved.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={labelStyle}>Active Members ({approved.length})</div>
          {approved.map(r => (
            <TeamRow key={r.id} row={r} left="✅ Active"
              actions={<ActionBtn color="#ff453a" subtle onClick={() => remove(r.id, r.email)}>Remove</ActionBtn>}
            />
          ))}
        </div>
      )}

      {!loading && rejected.length > 0 && (
        <details style={{ marginBottom:6 }}>
          <summary style={{ ...labelStyle, cursor:"pointer", marginBottom:0 }}>Rejected ({rejected.length})</summary>
          <div style={{ marginTop:8 }}>
            {rejected.map(r => (
              <TeamRow key={r.id} row={r} left="🚫 Rejected"
                actions={
                  <>
                    <ActionBtn color="#2AABFF" subtle onClick={() => setStatus(r.id, "pending")}>Unreject</ActionBtn>
                    <ActionBtn color="#ff453a" subtle onClick={() => remove(r.id, r.email)}>Remove</ActionBtn>
                  </>
                }
              />
            ))}
          </div>
        </details>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", padding:"8px 0", fontStyle:"italic" }}>
          No team members yet. Invite the first person above.
        </div>
      )}
    </div>
  );
}

function TeamRow({ row, left, actions }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, marginBottom:6 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, color:"#f5f5f7", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.email}</div>
        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{left}</div>
      </div>
      <div style={{ display:"flex", gap:6, flexShrink:0 }}>{actions}</div>
    </div>
  );
}

function ActionBtn({ children, onClick, color, subtle = false }) {
  const bg = subtle ? "transparent" : `${color}1c`;
  const border = `${color}55`;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background:bg, border:`1px solid ${border}`, borderRadius:7, color, fontSize:10, fontWeight:600, padding:"6px 10px", cursor:"pointer", fontFamily:"Inter, sans-serif", whiteSpace:"nowrap" }}>
      {children}
    </button>
  );
}
