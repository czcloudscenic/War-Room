import React from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import { sb } from '../../services/supabaseClient.js';

export default function ClientView({ user, content, setContent, onSignOut, isPreview }) {
  const isMobile = useIsMobile();
  const STATUS_ORDER = ["Need Copy Approval","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"];
  const STATUS_COLOR = {
    "Need Copy Approval":"#3b82f6","Need Content Approval":"#ff453a",
    "Needs Revisions":"#f97316","Approved":"#2AABFF",
    "Ready For Schedule":"#8b5cf6","Scheduled":"#64d2ff",
    "Ready For Copy Creation":"#f59e0b","Ready For Content Creation":"#10b981",
  };
  const [reviseNote, setReviseNote] = React.useState({});
  const [reviseOpen, setReviseOpen] = React.useState(null);

  const approve = async (item) => {
    const updated = { ...item, status:"Approved", stage:"Approved", client_note:"" };
    setContent(prev => prev.map(x => x.id===item.id ? updated : x));
    await sb.from("content_items").update(updated).eq("id", item.id);
  };
  const revise = async (item) => {
    const note = reviseNote[item.id] || "";
    const updated = { ...item, status:"Needs Revisions", stage:"Needs Revisions", client_note: note };
    setContent(prev => prev.map(x => x.id===item.id ? updated : x));
    await sb.from("content_items").update(updated).eq("id", item.id);
    setReviseOpen(null);
    setReviseNote(prev => ({ ...prev, [item.id]: "" }));
  };

  const pending = content.filter(x => ["Need Copy Approval","Need Content Approval"].includes(x.status));
  const approved = content.filter(x => x.status==="Approved");
  const scheduled = content.filter(x => x.status==="Scheduled");

  return (
    <div style={{ minHeight:"100vh", background:"#f7f7f5", fontFamily:"Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ height:56, background:"rgba(255,255,255,0.05)", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", padding:"0 24px", gap:14, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src="data:image/png;base64,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" style={{ width:"100%", height:"100%", objectFit:"contain", padding:4 }} />
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#f5f5f7", letterSpacing:-0.3 }}>VitalLyfe</div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>Content Portal</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{isPreview ? "client@vitallyfe.com" : user.email}</span>
          {!isPreview && <button onClick={onSignOut} style={{ fontSize:11, color:"rgba(255,255,255,0.5)", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Sign out</button>}
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px" }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(3,1fr)", gap: isMobile ? 8 : 12, marginBottom:32 }}>
          {[["Needs Review", pending.length, "#ff9f0a"], ["Approved", approved.length, "#2AABFF"], ["Scheduled", scheduled.length, "#64d2ff"]].map(([label,val,color])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius: isMobile ? 10 : 14, padding: isMobile ? "14px 12px" : "20px 22px" }}>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight:700, color, letterSpacing:-1 }}>{val}</div>
              <div style={{ fontSize: isMobile ? 9 : 11, color:"rgba(255,255,255,0.5)", fontWeight:600, marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Needs Review */}
        {pending.length > 0 && (
          <div style={{ marginBottom:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#ff9f0a" }} />
              <h2 style={{ fontSize:15, fontWeight:700, color:"#f5f5f7", margin:0 }}>Needs Your Review</h2>
              <span style={{ fontSize:10, color:"#ff9f0a", background:"rgba(255,159,10,0.1)", padding:"2px 8px", borderRadius:20, fontWeight:700 }}>{pending.length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {pending.map(item => {
                const c = STATUS_COLOR[item.status]||"#999";
                const isRevOpen = reviseOpen === item.id;
                return (
                  <div key={item.id} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${isRevOpen?"rgba(255,69,58,0.25)":"rgba(255,255,255,0.08)"}`, borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"#f5f5f7", marginBottom:4 }}>{item.title}</div>
                        <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginBottom:8 }}>{item.campaign} · {item.format}</div>
                        <span style={{ fontSize:9, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.07)", padding:"3px 8px", borderRadius:20, fontWeight:700, border:"1px solid rgba(255,255,255,0.1)" }}>{item.status}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                        <button onClick={()=>setReviseOpen(isRevOpen?null:item.id)} style={{ fontSize:11, fontWeight:600, color:"#ff453a", background:"rgba(255,69,58,0.08)", border:"1px solid rgba(255,69,58,0.2)", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Request Revisions</button>
                        <button onClick={()=>approve(item)} style={{ fontSize:11, fontWeight:600, color:"#fff", background:"#2AABFF", border:"none", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Approve </button>
                      </div>
                    </div>
                    {isRevOpen && (
                      <div style={{ marginTop:14, borderTop:"1px solid rgba(255,69,58,0.1)", paddingTop:14 }}>
                        <div style={{ fontSize:10, color:"rgba(255,69,58,0.7)", fontWeight:600, marginBottom:8 }}>Leave a note for the team (optional)</div>
                        <textarea value={reviseNote[item.id]||""} onChange={e=>setReviseNote(prev=>({...prev,[item.id]:e.target.value}))}
                          placeholder="e.g. The hook needs to be stronger, change the CTA to…"
                          style={{ width:"100%", background:"rgba(255,69,58,0.03)", border:"1px solid rgba(255,69,58,0.2)", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#f5f5f7", fontFamily:"Inter, sans-serif", minHeight:64, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
                        <button onClick={()=>revise(item)} style={{ marginTop:10, fontSize:12, fontWeight:600, color:"#fff", background:"#ff453a", border:"none", borderRadius:8, padding:"8px 20px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}>Send Revision Request</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Content */}
        <div>
          <h2 style={{ fontSize:15, fontWeight:700, color:"#f5f5f7", margin:"0 0 16px" }}>All Content</h2>
          <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, overflow:"hidden" }}>
            {content.filter(x=>x.status!=="Scrapped").map((item,i) => {
              const c = STATUS_COLOR[item.status]||"#999";
              return (
                <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", alignItems:"center", gap:16, padding:"13px 20px", borderBottom:i<content.length-1?"1px solid #f0f0f0":"none" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#f5f5f7" }}>{item.title}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{item.campaign} · {item.format}</div>
                  </div>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.6)", background:"rgba(255,255,255,0.06)", padding:"3px 8px", borderRadius:20, fontWeight:700, whiteSpace:"nowrap" }}>{item.status}</span>
                  {["Need Copy Approval","Need Content Approval"].includes(item.status) && (
                    <button onClick={()=>approve(item)} style={{ fontSize:10, fontWeight:700, color:"#2AABFF", background:"rgba(48,209,88,0.08)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:7, padding:"5px 10px", cursor:"pointer", fontFamily:"Inter, sans-serif", whiteSpace:"nowrap" }}>Approve</button>
                  )}
                  {!["Need Copy Approval","Need Content Approval"].includes(item.status) && <div style={{width:60}}/>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
