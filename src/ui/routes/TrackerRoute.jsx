import React from 'react';
import { PILLARS_LIST, STATUSES, STATUS_COLOR } from '../../utils/constants.js';
import Card from '../shared/Card.jsx';
import MetricCard from '../shared/MetricCard.jsx';

export default function TrackerRoute({
  clientContent,
  filterStatus,
  filterPillar,
  filterPlatform,
  trackerSearch,
  setTrackerSearch,
  setFilterStatus,
  setFilterPillar,
  setFilterPlatform,
  isMobile,
  handleAddNew,
  setEditingItem,
  handleMuseWrite,
}) {
  const filtered = clientContent.filter(item => {
    if (filterStatus && item.status !== filterStatus) return false;
    if (filterPillar && item.pillar !== filterPillar) return false;
    if (filterPlatform && item.platform !== filterPlatform) return false;
    if (trackerSearch && !item.title.toLowerCase().includes(trackerSearch.toLowerCase())) return false;
    return true;
  });
  const selStyle = { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"8px 12px", fontSize:12, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif", cursor:"pointer", appearance:"none" };
  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, gap:12, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1 }}>Production</h1>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>{filtered.length} of {clientContent.length} pieces · Tap any row to edit</p>
        </div>
        <button onClick={handleAddNew} style={{ background:"#0f0f1a", border:"none", borderRadius:12, color:"#fff", fontSize:13, fontWeight:600, padding:"10px 20px", cursor:"pointer", fontFamily:"Inter, sans-serif", whiteSpace:"nowrap" }}>+ Add Content</button>
      </div>
      {/* Search + Filter Bar */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <input value={trackerSearch} onChange={e=>setTrackerSearch(e.target.value)} placeholder="Search by title…"
          style={{ flex:1, minWidth: isMobile ? "100%" : 180, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"8px 14px", fontSize:isMobile ? 16 : 12, color:"#f5f5f7", outline:"none", fontFamily:"Inter, sans-serif" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", width: isMobile ? "100%" : "auto" }}>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...selStyle, flex: isMobile ? 1 : "none", fontSize: isMobile ? 14 : 12 }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPillar} onChange={e=>setFilterPillar(e.target.value)} style={{ ...selStyle, flex: isMobile ? 1 : "none", fontSize: isMobile ? 14 : 12 }}>
            <option value="">All Pillars</option>
            {PILLARS_LIST.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)} style={{ ...selStyle, flex: isMobile ? 1 : "none", fontSize: isMobile ? 14 : 12 }}>
            <option value="">All Platforms</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </select>
          {(trackerSearch||filterStatus||filterPillar||filterPlatform) && (
            <button onClick={()=>{setTrackerSearch("");setFilterStatus("");setFilterPillar("");setFilterPlatform("");}} style={{ fontSize:11, color:"rgba(255,255,255,0.5)", background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"8px 12px", cursor:"pointer", fontFamily:"Inter, sans-serif" }}> Clear</button>
          )}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: isMobile ? 10 : 14, marginBottom:24 }}>
        <MetricCard label="Total Pieces" value={clientContent.length} delta={0} color="#2AABFF" />
        <MetricCard label="Approved" value={clientContent.filter(x=>x.status==="Approved").length} delta={0} color="#2AABFF" />
        {!isMobile && <MetricCard label="Scheduled" value={clientContent.filter(x=>x.status==="Scheduled").length} delta={0} color="#0a84ff" />}
      </div>
      {/* Table — horizontal scroll on mobile */}
      <Card style={{ padding:"0", overflow:"hidden" }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <div style={{ minWidth: isMobile ? 640 : "auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 0.7fr 1fr 1fr 1.3fr 0.8fr 0.7fr auto", gap:0, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
            {["Title","Platform","Campaign","Pillar","Status","Format","Date","Write"].map(h => (
              <div key={h} style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", padding:"12px 14px" }}>{h}</div>
            ))}
          </div>
        {filtered.length === 0 && (
          <div style={{ padding:"32px", textAlign:"center", color:"rgba(255,255,255,0.4)", fontSize:12 }}>No items match your filters.</div>
        )}
        {filtered.map((item, i) => {
          const sc = STATUS_COLOR[item.status] || "#999";
          const ptLabel = item.platform === "instagram" ? "IG" : item.platform === "tiktok" ? "TT" : "YT";
          const ptColor = item.platform === "instagram" ? "#e1306c" : item.platform === "tiktok" ? "#ff0050" : "#ff0000";
          const needsCaption = !item.caption || item.caption.length < 10;
          const needsScript = item.format === "Reel" && (!item.script || item.script.length < 10);
          return (
            <div key={item.id}
              style={{ display:"grid", gridTemplateColumns:"2fr 0.7fr 1fr 1fr 1.3fr 0.8fr 0.7fr auto", borderBottom:`1px solid rgba(255,255,255,0.05)`, transition:"background 0.15s", background:"rgba(255,255,255,0.05)" }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(42,171,255,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background="#111010"}>
              <div onClick={() => setEditingItem(item)} style={{ fontSize:12, color:"#f5f5f7", fontWeight:500, padding:"11px 14px", lineHeight:1.3, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                {item.client_note && <span title={item.client_note} style={{ fontSize:8, color:"#ff453a", background:"rgba(255,69,58,0.1)", padding:"1px 5px", borderRadius:4, fontWeight:700, whiteSpace:"nowrap" }}>CLIENT NOTE</span>}
                {item.title}
              </div>
              <div style={{ padding:"11px 14px", display:"flex", alignItems:"center" }}>
                <span style={{ fontSize:10, fontWeight:700, color:ptColor, background:`${ptColor}15`, padding:"2px 7px", borderRadius:6 }}>{ptLabel}</span>
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", padding:"11px 14px", display:"flex", alignItems:"center" }}>{item.campaign}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", padding:"11px 14px", display:"flex", alignItems:"center" }}>{item.pillar}</div>
              <div style={{ padding:"11px 14px", display:"flex", alignItems:"center" }}>
                <span style={{ fontSize:9, fontWeight:600, color:sc, background:`${sc}15`, padding:"3px 8px", borderRadius:20, whiteSpace:"nowrap" }}>{item.status}</span>
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", padding:"11px 14px", display:"flex", alignItems:"center" }}>{item.format}</div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", padding:"11px 10px", display:"flex", alignItems:"center" }}>{item.publish_date || "—"}</div>
              <div style={{ padding:"8px 12px", display:"flex", alignItems:"center", gap:5 }}>
                {needsCaption && <button onClick={() => handleMuseWrite(item, "caption")} style={{ fontSize:9, fontWeight:700, color:"#ff375f", background:"rgba(255,55,95,0.08)", border:"1px solid rgba(255,55,95,0.2)", borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"Inter,sans-serif", whiteSpace:"nowrap" }}> Cap</button>}
                {needsScript && <button onClick={() => handleMuseWrite(item, "script")} style={{ fontSize:9, fontWeight:700, color:"#2AABFF", background:"rgba(191,90,242,0.08)", border:"1px solid rgba(191,90,242,0.2)", borderRadius:6, padding:"3px 8px", cursor:"pointer", fontFamily:"Inter,sans-serif", whiteSpace:"nowrap" }}> Script</button>}
                {!needsCaption && !needsScript && <span style={{ fontSize:9, color:"#2AABFF", fontWeight:600 }}></span>}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      </Card>
    </div>
  );
}
