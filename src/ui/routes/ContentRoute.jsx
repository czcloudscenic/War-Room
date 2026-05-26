import React from 'react';
import ContentPipelineBoard from '../pipeline/ContentPipelineBoard.jsx';

export default function ContentRoute({
  igItems,
  ttItems,
  ytItems,
  activePlatform,
  setActivePlatform,
  isMobile,
  handleIgIdeas,
  igIdeasLoading,
  handleAddNew,
  setEditingItem,
  handleMuseWrite,
}) {
  const STAGES = ["Ready For Copy Creation","Need Copy Approval","Ready For Content Creation","Need Content Approval","Needs Revisions","Approved","Ready For Schedule","Scheduled"];
  const STAGE_COLORS = ["#f59e0b","#3b82f6","#10b981","#ff453a","#f97316","#2AABFF","#8b5cf6","#64d2ff"];
  const platforms = [
    { id:"instagram", label:"Instagram", dot:"#dc2743", items: igItems, subtitle:`@vitallyfe · ${igItems.length} pieces in pipeline` },
    { id:"tiktok",    label:"TikTok",    dot:"#ff0050", items: ttItems, subtitle:`@vitallyfe · ${ttItems.length} pieces in pipeline` },
    { id:"youtube",   label:"YouTube",   dot:"#ff0000", items: ytItems, subtitle:`VitalLyfe · ${ytItems.length} pieces · Long-form & Shorts` },
  ];
  const active = platforms.find(p => p.id === activePlatform) || platforms[0];
  return (
    <div style={{ animation:"fadeIn 0.4s ease" }}>
      {/* Platform tab switcher */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {platforms.map(p => {
          const isActive = p.id === activePlatform;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlatform(p.id)}
              style={{
                display:"flex", alignItems:"center", gap:10,
                background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                border: "1px solid " + (isActive ? "rgba(255,255,255,0.18)" : "transparent"),
                borderRadius: 14,
                padding: "10px 18px",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              <span style={{ width:8, height:8, borderRadius:"50%", background:p.dot, flexShrink:0 }} />
              <span style={{ fontSize:14, fontWeight: isActive ? 600 : 400, color: isActive ? "#f5f5f7" : "rgba(255,255,255,0.55)" }}>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active platform header */}
      <div style={{ display:"flex", alignItems: isMobile ? "flex-start" : "center", gap:14, marginBottom: isMobile ? 16 : 28, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 22 : 30, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-1 }}>{active.label}</h1>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{active.subtitle}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", width: isMobile ? "100%" : "auto" }}>
          {!isMobile && STAGES.map(s => {
            const n = active.items.filter(x => x.stage === s).length;
            if (!n) return null;
            return <span key={s} style={{ fontSize:9, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.07)", padding:"3px 8px", borderRadius:20, fontWeight:600 }}>{s} · {n}</span>;
          })}
          {active.id === "instagram" && (
            <button onClick={handleIgIdeas} disabled={igIdeasLoading} style={{ background: igIdeasLoading ? "rgba(255,55,95,0.15)" : "rgba(255,55,95,0.12)", border:"1px solid rgba(255,55,95,0.3)", borderRadius:10, color:"#ff375f", fontSize:12, fontWeight:600, padding:"7px 14px", cursor: igIdeasLoading ? "not-allowed" : "pointer", fontFamily:"Inter, sans-serif", flexShrink:0, display:"flex", alignItems:"center", gap:6 }}>
              {igIdeasLoading ? <><span style={{ width:8, height:8, borderRadius:"50%", background:"#ff375f", display:"inline-block", animation:"livePulse 1s infinite" }} /> Generating…</> : "✍️ 5 IG Ideas"}
            </button>
          )}
          <button onClick={handleAddNew} style={{ background:"#0f0f1a", border:"none", borderRadius:10, color:"#fff", fontSize:12, fontWeight:600, padding:"7px 14px", cursor:"pointer", fontFamily:"Inter, sans-serif", flexShrink:0 }}>+ Add</button>
        </div>
      </div>

      {/* Pipeline boards per platform */}
      {active.id === "instagram" && (
        <>
          <ContentPipelineBoard title="Reels & Graphics Pipeline" icon=""
            stages={STAGES} stageColors={STAGE_COLORS}
            items={active.items.filter(x => x.type==="reel" || x.type==="graphic")}
            onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
          />
          <ContentPipelineBoard title="Carousels & Threads" icon=""
            stages={STAGES} stageColors={STAGE_COLORS}
            items={active.items.filter(x => x.type==="carousel" || x.type==="thread")}
            onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
          />
        </>
      )}
      {active.id === "tiktok" && (
        <ContentPipelineBoard title="TikTok Pipeline" icon=""
          stages={STAGES} stageColors={STAGE_COLORS}
          items={active.items}
          onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
        />
      )}
      {active.id === "youtube" && (
        <ContentPipelineBoard title="Production Pipeline" icon=""
          stages={STAGES} stageColors={STAGE_COLORS}
          items={active.items}
          onCardClick={setEditingItem} onMuseWrite={handleMuseWrite}
        />
      )}
    </div>
  );
}
