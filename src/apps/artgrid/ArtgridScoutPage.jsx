import React, { useState } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import Card from '../../ui/shared/Card.jsx';

export default function ArtgridScoutPage({ content }) {
  const isMobile = useIsMobile();
  // SOP Step 03 — scout footage for video formats not yet scheduled or scrapped
  const needsFootage = content.filter(x =>
["Reel", "YouTube", "Short"].includes(x.format) &&
!["Scheduled", "Scrapped"].includes(x.status)
  );
  const [scouts, setScouts] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [scoutingAll, setScoutingAll] = useState(false);
  const [allScoutResult, setAllScoutResult] = useState(null);
  const PILLAR_COLOR = { Education:"#3b82f6", Entertainment:"#10b981", Inspiration:"#8b5cf6", Promotion:"#ff375f", Community:"#f59e0b", Access:"#06b6d4", Abundance:"#8b5cf6", Innovation:"#0a84ff", "Tierra Bomba":"#2AABFF", "Startup Diaries":"#ff9f0a", "Product Launch":"#ff375f", "Meet the Makers":"#64d2ff" };
  const PRIORITY_COLOR = { HIGH:"#ff375f", MED:"#f59e0b", LOW:"rgba(0,0,0,0.3)" };

  //  SCOUT ALL via backend action
  const runScoutAll = async () => {
if (scoutingAll) return;
setScoutingAll(true);
setAllScoutResult(null);
try {
  const res = await fetch("/api/agent-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentName: "Artgrid", action: "artgrid_scout", payload: {} }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error);
  // Merge keyword results into per-item scouts state
  if (d.results && d.results.length > 0) {
    const updates = {};
    d.results.forEach(r => { updates[r.itemId] = { loading: false, keywords: r.keywords, title: r.title }; });
    setScouts(prev => ({ ...prev, ...updates }));
    if (d.results[0]) setActiveId(d.results[0].itemId);
  }
  setAllScoutResult({ ok: true, message: d.message, summary: d.summary });
} catch(e) {
  setAllScoutResult({ ok: false, message: ` Scout failed: ${e.message}` });
}
setScoutingAll(false);
  };

  //  SCOUT SINGLE ITEM via frontend chat proxy
  const runScout = async (item) => {
setScouts(prev => ({ ...prev, [item.id]: { loading:true, brief:null } }));
setActiveId(item.id);
try {
  const systemPrompt = `You are Artgrid — VitalLyfe's AI footage scout for Cloud Scenic's Vantus. Expert at finding cinematic stock footage on Artgrid.io.

VitalLyfe visual identity:
- Brand: wellness/hydration technology. Cinematic, calm, purposeful. NEVER corporate.
- Look: warm neutrals, soft light, water in motion, wide open landscapes, macro nature shots
- Emotion: quiet ambition, calm confidence, real human moments — not perfomative
- AVOID: people pointing at whiteboards, fake stock photo smiles, overly corporate setups, cheesy motion graphics, green screen

Artgrid.io search tip: SHORT queries (2-4 words MAX) return results. Long phrases return nothing.
GOOD: "slow motion water", "sunrise landscape", "woman walking nature", "water droplet macro"
BAD: "slow motion water droplet hitting calm surface at sunrise" — too long, zero results

Return ONLY a JSON object (no markdown, no backticks):
{
  "mood": "2-3 sentence visual direction for the editor",
  "pacing": "Fast cuts (under 2s) | Medium (2-4s) | Slow/cinematic (4s+)",
  "clipTypes": ["hero shot description", "b-roll 1", "b-roll 2", "cutaway", "transition"],
  "searches": [
{ "query": "2-4 word artgrid search term", "use": "specific role in edit timeline", "priority": "HIGH|MED|LOW" }
  ],
  "avoidKeywords": ["search term to avoid"],
  "totalClipsNeeded": 7,
  "notes": "additional editor direction"
}
Include 6-8 search queries. Keep every query under 4 words — short beats specific on Artgrid.`;

  const res = await fetch("/api/chat", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1400,
      system:systemPrompt,
      messages:[{ role:"user", content:`Scout footage for this content piece:\n\nTitle: ${item.title}\nPlatform: ${(item.platforms||[]).join(", ") || item.platform}\nContent Pillar: ${item.pillar}\nFormat: ${item.format}\nCampaign: ${item.campaign}\nDescription: ${item.description}\nScript:\n${item.script || "— No script yet —"}\nDirector Notes: ${item.notes || "—"}` }],
    })
  });
  const data = await res.json();
  const text = data.content?.find(b=>b.type==="text")?.text || "{}";
  // Strip any accidental markdown fencing
  const cleaned = text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
  const brief = JSON.parse(cleaned);
  setScouts(prev => ({ ...prev, [item.id]: { loading:false, brief } }));
} catch(e) {
  setScouts(prev => ({ ...prev, [item.id]: { loading:false, brief:null, error:true } }));
}
  };

  return (
<div style={{ animation:"fadeIn 0.4s ease" }}>
  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
    <div>
      <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1 }}>ArtGrid Scout</h1>
      <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>AI-generated footage briefs. Scout one item or run all at once — get exact Artgrid.io search queries.</p>
    </div>
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <button onClick={runScoutAll} disabled={scoutingAll}
        style={{ background:scoutingAll?"rgba(191,90,242,0.1)":"#2AABFF", border:"none", borderRadius:12, color:scoutingAll?"#2AABFF":"#fff", cursor:scoutingAll?"default":"pointer", padding:"10px 20px", fontSize:13, fontWeight:700, fontFamily:"Inter,sans-serif", opacity:scoutingAll?0.8:1, display:"flex", alignItems:"center", gap:7 }}>
        {scoutingAll ? (
          <><div style={{ width:7, height:7, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 1s infinite" }} /> Scouting All…</>
        ) : " Scout All Items"}
      </button>
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", background:"rgba(191,90,242,0.08)", border:"1px solid rgba(191,90,242,0.2)", borderRadius:12 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2.5s ease-in-out infinite" }} />
        <span style={{ fontSize:11, color:"#2AABFF", fontWeight:600 }}>Artgrid Agent · Ready</span>
      </div>
    </div>
  </div>

  {allScoutResult && (
    <div style={{ padding:"12px 16px", background:allScoutResult.ok?"rgba(191,90,242,0.06)":"rgba(255,69,58,0.06)", border:"1px solid " + (allScoutResult.ok?"rgba(191,90,242,0.2)":"rgba(255,69,58,0.2)"), borderRadius:12, marginBottom:16, animation:"slideIn 0.3s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:allScoutResult.ok?"#2AABFF":"#ff453a", marginBottom:allScoutResult.summary?6:0 }}>{allScoutResult.message}</div>
          {allScoutResult.summary && <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", lineHeight:1.6, whiteSpace:"pre-line" }}>{allScoutResult.summary}</div>}
        </div>
        <button onClick={() => setAllScoutResult(null)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:14, padding:"2px 6px", marginLeft:12, flexShrink:0 }}></button>
      </div>
    </div>
  )}

  {needsFootage.length === 0 && (
    <div style={{ padding:"32px", textAlign:"center", background:"rgba(191,90,242,0.04)", border:"1px solid rgba(191,90,242,0.1)", borderRadius:16, marginBottom:16 }}>
      <div style={{ fontSize:32, marginBottom:12, opacity:0.3 }}></div>
      <div style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,0.5)", marginBottom:6 }}>No video items need footage right now</div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>All Reels, YouTube, and Short format content is either scheduled or scrapped.</div>
    </div>
  )}

  <Card style={{ padding:"18px 22px", marginBottom:28, marginTop:20, background:"rgba(191,90,242,0.04)", border:"1px solid rgba(191,90,242,0.12)" }}>
    <div style={{ display:"flex", gap: isMobile ? 12 : 24, flexWrap: isMobile ? "wrap" : "nowrap" }}>
      {[{ step:"01", label:"Click Scout", desc:"Agent reads your script + director notes" }, { step:"02", label:"Get Brief", desc:"6–8 exact Artgrid search queries" }, { step:"03", label:"Search Artgrid", desc:"Click any query — opens Artgrid.io pre-filled" }, { step:"04", label:"Download", desc:"Select clips. Back to post-production." }].map(s => (
        <div key={s.step} style={{ flex: isMobile ? "1 0 calc(50% - 6px)" : 1 }}>
          <div style={{ fontSize:9, fontWeight:700, color:"rgba(191,90,242,0.6)", letterSpacing:1.5, marginBottom:4 }}>{s.step}</div>
          <div style={{ fontSize:12, fontWeight:600, color:"#f5f5f7", marginBottom:3 }}>{s.label}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", lineHeight:1.5 }}>{s.desc}</div>
        </div>
      ))}
    </div>
  </Card>

  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
    {needsFootage.map(item => {
      const sc = scouts[item.id]; const pc = PILLAR_COLOR[item.pillar]||"#999"; const isActive = activeId===item.id;
      const ptLabel = item.platform==="instagram"?"IG":item.platform==="tiktok"?"TT":"YT";
      return (
        <Card key={item.id} style={{ overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 22px" }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <span style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.05)", padding:"2px 8px", borderRadius:6 }}>{ptLabel}</span>
                <span style={{ fontSize:9, fontWeight:600, color:pc, background:`${pc}12`, padding:"2px 8px", borderRadius:6 }}>{item.pillar}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.05)", padding:"2px 8px", borderRadius:6 }}>{item.stage}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.05)", padding:"2px 8px", borderRadius:6 }}>{item.campaign}</span>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:"#f5f5f7", letterSpacing:-0.2, marginBottom:4 }}>{item.title}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", lineHeight:1.5, maxWidth:520 }}>{item.description}</div>
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              {(sc?.brief || sc?.keywords) && <button onClick={() => setActiveId(isActive?null:item.id)} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, color:"rgba(255,255,255,0.65)", cursor:"pointer", padding:"9px 16px", fontSize:12, fontWeight:500, fontFamily:"Inter, sans-serif" }}>{isActive?"Hide":"View Keywords"}</button>}
              <button onClick={() => runScout(item)} disabled={sc?.loading} style={{ background:sc?.loading?"rgba(191,90,242,0.1)":"#2AABFF", border:"none", borderRadius:10, color:sc?.loading?"#2AABFF":"#fff", cursor:sc?.loading?"default":"pointer", padding:"9px 18px", fontSize:12, fontWeight:600, fontFamily:"Inter, sans-serif", opacity:sc?.loading?0.8:1 }}>
                {sc?.loading?"Scouting...":sc?.brief?"Re-Scout ":"Scout "}
              </button>
            </div>
          </div>

          {sc?.loading && (
            <div style={{ padding:"0 22px 18px" }}>
              <div style={{ height:2, background:"rgba(191,90,242,0.15)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", background:"#2AABFF", borderRadius:2, animation:"progressBar 3s ease-in-out infinite alternate" }} />
              </div>
              <div style={{ fontSize:10, color:"rgba(191,90,242,0.7)", marginTop:6 }}>Artgrid agent reading script + director notes...</div>
            </div>
          )}
          {sc?.error && <div style={{ padding:"0 22px 18px", fontSize:11, color:"#ff453a" }}>Scout failed. Check connection and try again.</div>}

          {sc?.brief && isActive && (
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"20px 22px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
                <div style={{ background:"#0f0d0e", borderRadius:12, padding:"14px 16px", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>Visual Mood</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.7 }}>{sc.brief.mood}</div>
                </div>
                <div style={{ background:"#0f0d0e", borderRadius:12, padding:"14px 16px", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>Pacing · Clip Types</div>
                  <div style={{ fontSize:12, color:"#f5f5f7", fontWeight:600, marginBottom:8 }}>{sc.brief.pacing}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>{(sc.brief.clipTypes||[]).map((ct,i)=><span key={i} style={{ fontSize:9, color:"rgba(255,255,255,0.6)", background:"rgba(255,255,255,0.05)", padding:"3px 8px", borderRadius:6 }}>{ct}</span>)}</div>
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1.5, textTransform:"uppercase" }}>Artgrid Search Queries</div>
                  <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)" }}>Click any to open Artgrid.io ↗</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {(sc.brief.searches||[]).map((s,i) => {
                    const pc2 = PRIORITY_COLOR[s.priority]||"#999";
                    return (
                      <a key={i} href={`https://artgrid.io/search?q=${encodeURIComponent(s.query)}`} target="_blank" rel="noopener noreferrer"
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, textDecoration:"none", transition:"border-color 0.15s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(191,90,242,0.4)"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(0,0,0,0.08)"}>
                        <span style={{ fontSize:9, fontWeight:700, color:pc2, background:`${pc2}15`, padding:"2px 7px", borderRadius:20, whiteSpace:"nowrap" }}>{s.priority}</span>
                        <span style={{ fontSize:12, fontWeight:600, color:"#f5f5f7", flex:1 }}>{s.query}</span>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{s.use}</span>
                        <span style={{ fontSize:11, color:"#2AABFF" }}>↗</span>
                      </a>
                    );
                  })}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {sc.brief.avoidKeywords?.length>0 && (
                  <div style={{ background:"rgba(255,69,58,0.04)", borderRadius:10, padding:"12px 14px", border:"1px solid rgba(255,69,58,0.1)" }}>
                    <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,69,58,0.6)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>Avoid on Artgrid</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>{sc.brief.avoidKeywords.map((k,i)=><span key={i} style={{ fontSize:10, color:"rgba(255,69,58,0.7)", background:"rgba(255,69,58,0.08)", padding:"2px 8px", borderRadius:6 }}> {k}</span>)}</div>
                  </div>
                )}
                <div style={{ background:"rgba(48,209,88,0.04)", borderRadius:10, padding:"12px 14px", border:"1px solid rgba(48,209,88,0.1)" }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"rgba(48,209,88,0.6)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>Summary</div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#2AABFF", marginBottom:4 }}>{sc.brief.totalClipsNeeded} clips needed</div>
                  {sc.brief.notes && <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", lineHeight:1.5 }}>{sc.brief.notes}</div>}
                </div>
              </div>
            </div>
          )}

          {sc?.keywords && !sc?.brief && isActive && (
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"20px 22px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1.5, textTransform:"uppercase" }}>Artgrid Search Keywords</div>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.35)" }}>Click any to open Artgrid.io ↗</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {(sc.keywords||[]).map((kw,i) => (
                  <a key={i} href={`https://artgrid.io/search?q=${encodeURIComponent(kw)}`} target="_blank" rel="noopener noreferrer"
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, textDecoration:"none", transition:"border-color 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(191,90,242,0.4)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(0,0,0,0.08)"}>
                    <span style={{ fontSize:12, fontWeight:600, color:"#f5f5f7", flex:1 }}>{kw}</span>
                    <span style={{ fontSize:11, color:"#2AABFF" }}>↗</span>
                  </a>
                ))}
              </div>
              <div style={{ marginTop:10, fontSize:10, color:"rgba(255,255,255,0.35)" }}>Hit "Scout " on any item for the full AI brief with mood, pacing, and clip types.</div>
            </div>
          )}
        </Card>
      );
    })}
  </div>
</div>
  );
}
