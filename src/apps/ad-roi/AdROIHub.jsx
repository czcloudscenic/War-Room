import React, { useState } from 'react';
import { useIsMobile } from '../../utils/hooks.js';
import Card from '../../ui/shared/Card.jsx';

export default function AdROIHub() {
  const isMobile = useIsMobile();
  const [campaigns, setCampaigns] = useState([
{ id:"c1", name:"Drip Campaign — IG Reels", platform:"Instagram", spend:320, leads:18, conversions:4, revenue:1200, status:"Active" },
{ id:"c2", name:"Access is Freedom — TikTok", platform:"TikTok", spend:150, leads:34, conversions:7, revenue:2100, status:"Active" },
{ id:"c3", name:"Product Launch — Multi-Platform", platform:"Meta/TikTok", spend:800, leads:62, conversions:11, revenue:4400, status:"Active" },
{ id:"c4", name:"Meet the Makers — IG Stories", platform:"Instagram", spend:90, leads:9, conversions:1, revenue:350, status:"Paused" },
  ]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name:"", platform:"Instagram", spend:"", leads:"", conversions:"", revenue:"", status:"Active" });
  const [aiInsight, setAiInsight] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const setF = (k,v) => setForm(f=>({...f,[k]:v}));

  const PLATFORMS = ["Instagram","TikTok","Meta/TikTok","YouTube","LinkedIn","X","Reddit"];
  const STATUSES = ["Active","Paused","Ended"];

  const roi = (c) => c.spend > 0 ? (((c.revenue - c.spend) / c.spend) * 100).toFixed(0) : 0;
  const roas = (c) => c.spend > 0 ? (c.revenue / c.spend).toFixed(2) : 0;
  const cpl = (c) => c.leads > 0 ? (c.spend / c.leads).toFixed(2) : 0;
  const cvr = (c) => c.leads > 0 ? ((c.conversions / c.leads) * 100).toFixed(1) : 0;
  const roiColor = (r) => r >= 100 ? "#2AABFF" : r >= 0 ? "#ff9f0a" : "#ff453a";

  const totalSpend = campaigns.reduce((s,c)=>s+c.spend,0);
  const totalRevenue = campaigns.reduce((s,c)=>s+c.revenue,0);
  const totalLeads = campaigns.reduce((s,c)=>s+c.leads,0);
  const totalConversions = campaigns.reduce((s,c)=>s+c.conversions,0);
  const overallROAS = totalSpend > 0 ? (totalRevenue/totalSpend).toFixed(2) : 0;

  const runAIAnalysis = async () => {
setAnalyzing(true); setAiInsight(null);
try {
  const summary = campaigns.map(c=>`${c.name} (${c.platform}): Spend $${c.spend}, Leads ${c.leads}, Conversions ${c.conversions}, Revenue $${c.revenue}, ROI ${roi(c)}%, ROAS ${roas(c)}x, CPL $${cpl(c)}, CVR ${cvr(c)}%`).join("\n");
  const res = await fetch("/api/chat", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:800,
      system:"You are Sam, Ad Performance Analyst for VitalLyfe's Vantus. Analyze ad campaign data and give sharp, actionable ROI insights. Brand: wellness/hydration tech. Be specific, data-driven, direct. Max 200 words. Lead with what needs to change NOW.",
      messages:[{role:"user",content:`Analyze these ad campaigns:\n${summary}\n\nTotal: Spend $${totalSpend}, Revenue $${totalRevenue}, ROAS ${overallROAS}x, ${totalLeads} leads, ${totalConversions} conversions\n\nGive: (1) What's performing, (2) What's bleeding money, (3) 3 specific optimizations to run this week.`}]
    })
  });
  const d = await res.json(); const blk = d.content?.find(x=>x.type==="text");
  setAiInsight(blk?.text || "Analysis unavailable.");
} catch(e) { setAiInsight(" Analysis failed: " + e.message); }
setAnalyzing(false);
  };

  const saveCampaign = () => {
if (!form.name.trim()) return;
setCampaigns(prev=>[...prev,{...form,id:"c"+Date.now(),spend:Number(form.spend)||0,leads:Number(form.leads)||0,conversions:Number(form.conversions)||0,revenue:Number(form.revenue)||0}]);
setForm({name:"",platform:"Instagram",spend:"",leads:"",conversions:"",revenue:"",status:"Active"});
setAdding(false);
  };

  const inp = {width:"100%",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"#f5f5f7",outline:"none",fontFamily:"Inter,sans-serif",background:"rgba(255,255,255,0.05)",boxSizing:"border-box"};
  const labelStyle = {fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"rgba(255,255,255,0.5)",marginBottom:5,display:"block"};

  return (
<div style={{animation:"fadeIn 0.4s ease"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom: isMobile ? 16 : 28, flexWrap:"wrap", gap:12}}>
    <div>
      <h1 style={{fontFamily:"'Instrument Serif', Georgia, serif", fontSize: isMobile ? 24 : 32, fontWeight:700, color:"#f5f5f7", marginBottom:4, letterSpacing:-1}}>Ad ROI Hub</h1>
      <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",margin:0}}>Track spend vs return · AI-powered optimization</p>
    </div>
    <div style={{display:"flex",gap:10, flexWrap:"wrap"}}>
      <button onClick={runAIAnalysis} disabled={analyzing} style={{background:analyzing?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,color:"rgba(255,255,255,0.85)",cursor:analyzing?"default":"pointer",padding:"10px 20px",fontSize:13,fontWeight:600,fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:7}}>
        {analyzing?<><div style={{width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,0.08)",animation:"livePulse 1s infinite"}}/>Analyzing…</>:" AI Analysis"}
      </button>
      <button onClick={()=>setAdding(true)} style={{background:"#0f0f1a",border:"none",borderRadius:12,color:"#fff",fontSize:13,fontWeight:600,padding:"10px 20px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ Add Campaign</button>
    </div>
  </div>

  {/*  TOTALS  */}
  <div style={{display:"grid",gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(5,1fr)",gap:12,marginBottom:28}}>
    {[["Total Spend","$"+totalSpend.toLocaleString(),"#ff453a"],["Total Revenue","$"+totalRevenue.toLocaleString(),"#2AABFF"],["Overall ROAS",overallROAS+"x",overallROAS>=2?"#2AABFF":overallROAS>=1?"#ff9f0a":"#ff453a"],["Total Leads",totalLeads,"#0a84ff"],["Total Conversions",totalConversions,"#2AABFF"]].map(([label,val,color])=>(
      <Card key={label} style={{padding:"18px 20px"}}>
        <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.35)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>{label}</div>
        <div style={{fontSize:26,fontWeight:700,color,letterSpacing:-1}}>{val}</div>
      </Card>
    ))}
  </div>

  {/*  AI INSIGHT  */}
  {aiInsight && (
    <Card style={{padding:"20px 24px",marginBottom:24,borderLeft:"3px solid #ffd60a",background:"rgba(255,214,10,0.04)",animation:"slideIn 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
          <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:0.8}}>SAM · AD ANALYSIS</span>
        </div>
        <button onClick={()=>setAiInsight(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:14}}></button>
      </div>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiInsight}</div>
    </Card>
  )}

  {/*  ADD CAMPAIGN  */}
  {adding && (
    <Card style={{padding:"24px",marginBottom:24,border:"1px solid rgba(255,255,255,0.12)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <h3 style={{fontSize:14,fontWeight:600,color:"#f5f5f7",margin:0}}>New Campaign</h3>
        <button onClick={()=>setAdding(false)} style={{background:"none",border:"none",fontSize:18,color:"rgba(255,255,255,0.35)",cursor:"pointer"}}></button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:12}}>
        <div><label style={labelStyle}>Campaign Name</label><input style={inp} value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="Drip Campaign — IG Reels"/></div>
        <div><label style={labelStyle}>Platform</label><select style={{...inp,appearance:"none",cursor:"pointer"}} value={form.platform} onChange={e=>setF("platform",e.target.value)}>{PLATFORMS.map(p=><option key={p}>{p}</option>)}</select></div>
        <div><label style={labelStyle}>Status</label><select style={{...inp,appearance:"none",cursor:"pointer"}} value={form.status} onChange={e=>setF("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
        <div><label style={labelStyle}>Ad Spend ($)</label><input style={inp} type="number" value={form.spend} onChange={e=>setF("spend",e.target.value)} placeholder="500"/></div>
        <div><label style={labelStyle}>Leads</label><input style={inp} type="number" value={form.leads} onChange={e=>setF("leads",e.target.value)} placeholder="24"/></div>
        <div><label style={labelStyle}>Conversions</label><input style={inp} type="number" value={form.conversions} onChange={e=>setF("conversions",e.target.value)} placeholder="6"/></div>
        <div><label style={labelStyle}>Revenue ($)</label><input style={inp} type="number" value={form.revenue} onChange={e=>setF("revenue",e.target.value)} placeholder="2400"/></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={saveCampaign} style={{background:"#0f0f1a",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:600,padding:"11px 24px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Save Campaign</button>
        <button onClick={()=>setAdding(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Cancel</button>
      </div>
    </Card>
  )}

  {/*  CAMPAIGNS TABLE  */}
  <Card style={{padding:"0",overflow:"hidden"}}>
    <div style={{overflowX:"auto", WebkitOverflowScrolling:"touch"}}>
    <div style={{minWidth:640}}>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
      {["Campaign","Platform","Spend","Revenue","ROAS","ROI","CPL","CVR"].map(h=>(
        <div key={h} style={{fontSize:9,color:"rgba(255,255,255,0.35)",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px"}}>{h}</div>
      ))}
    </div>
    {campaigns.map((c,i)=>{
      const r=Number(roi(c)); const roas_=roas(c); const rc=roiColor(r);
      const statusColor = c.status==="Active"?"#2AABFF":c.status==="Paused"?"#ff9f0a":"rgba(0,0,0,0.3)";
      return (
        <div key={c.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr",borderBottom:`1px solid rgba(255,255,255,0.05)`,background:"rgba(255,255,255,0.05)",transition:"background 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(42,171,255,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="#111010"}>
          <div style={{padding:"13px 14px"}}>
            <div style={{fontSize:12,fontWeight:600,color:"#f5f5f7",marginBottom:3}}>{c.name}</div>
            <span style={{fontSize:9,fontWeight:600,color:statusColor,background:`${statusColor}15`,padding:"1px 7px",borderRadius:20}}>{c.status}</span>
          </div>
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",fontSize:11,color:"rgba(255,255,255,0.65)"}}>{c.platform}</div>
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.75)"}}>${c.spend}</div>
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",fontSize:12,fontWeight:600,color:"#2AABFF"}}>${c.revenue}</div>
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.75)"}}>{roas_}x</div>
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center"}}><span style={{fontSize:11,fontWeight:700,color:rc,background:`${rc}12`,padding:"2px 8px",borderRadius:20}}>{r>=0?"+":""}{r}%</span></div>
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",fontSize:11,color:"rgba(255,255,255,0.65)"}}>${cpl(c)}</div>
          <div style={{padding:"13px 14px",display:"flex",alignItems:"center",fontSize:11,color:"rgba(255,255,255,0.65)"}}>{cvr(c)}%</div>
        </div>
      );
    })}
    </div>
    </div>
  </Card>

  <div style={{marginTop:16,padding:"12px 16px",background:"rgba(255,255,255,0.05)",borderRadius:10,display:"flex",gap:20,flexWrap:"wrap"}}>
    <span style={{fontSize:10,color:"rgba(255,255,255,0.5)",fontWeight:600}}>ROAS &gt; 2x =  Healthy · ROAS 1–2x =  Break-even · ROAS &lt; 1x =  Losing money</span>
    <span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>CPL = Cost Per Lead · CVR = Lead → Conversion Rate</span>
  </div>
</div>
  );
}
