import React from 'react';

export default function CIDPage() {
  const [platform, setPlatform] = React.useState("all");
  const [selected, setSelected] = React.useState(null);
  const [cidView, setCidView] = React.useState("feed");
  const [hookLabData, setHookLabData] = React.useState({ hooks:[], bodies:[], ctas:[] });
  const [hookLabLoading, setHookLabLoading] = React.useState(false);
  const [cidSearch, setCidSearch] = React.useState("");
  const [cidSearchActive, setCidSearchActive] = React.useState(false);
  const [variationView, setVariationView] = React.useState(null); // holds the selected post when variation is open
  const [videoFullscreen, setVideoFullscreen] = React.useState(false);
  const [briefData, setBriefData] = React.useState(null);
  const [briefLoading, setBriefLoading] = React.useState(false);
  const [abData, setAbData] = React.useState(null);
  const [abLoading, setAbLoading] = React.useState(false);
  const [perfLog, setPerfLog] = React.useState({ views:"", engagement:"", saves:"", notes:"" });
  const [perfSaved, setPerfSaved] = React.useState(false);

  React.useEffect(() => {
setBriefData(null);
setAbData(null);
setPerfLog({ views:"", engagement:"", saves:"", notes:"" });
setPerfSaved(false);
  }, [variationView]);

  const MOCK_POSTS = [
{ id:1, platform:"instagram", creator:"@drinklmnt", title:"Why I stopped drinking plain water", thumbnail:"https://picsum.photos/seed/lmnt1/400/600", views:"2.4M", engagement:"8.2%", hook:"Stop drinking plain water (here's why)", voiceHook:"\"Stop drinking plain water. Here's why this changes everything.\"", textHook:"STOP DRINKING PLAIN WATER", voiceBody:"\"Most water strips out the minerals your body actually needs. I switched to mineral-enhanced water and the difference in my energy was immediate.\"", textBody:"YOUR BODY NEEDS MORE THAN H2O", voiceCta:"\"Link in bio to try what I drink every morning.\"", textCta:"LINK IN BIO ", trigger:"Fear / Pattern interrupt", format:"Reel", url:"https://www.instagram.com", analysis:"Hook creates instant curiosity gap. 'Stop doing X' format works because it challenges default behavior. First 2 seconds show the product without saying it's an ad.", variation:"\"Stop drinking just water\" → VitalLyfe angle: 'You're hydrating wrong — here's what your water is missing'" },
{ id:2, platform:"tiktok", creator:"@hydrationcoach", title:"Hydrogen water changed my sleep", thumbnail:"https://picsum.photos/seed/hydro1/400/600", views:"4.1M", engagement:"11.4%", hook:"I tried hydrogen water for 30 days", voiceHook:"\"I tried hydrogen water every single day for 30 days. Here's what happened to my sleep.\"", textHook:"30 DAYS OF HYDROGEN WATER ", voiceBody:"\"By day 7 my sleep score went up 12 points. By day 30 I was averaging 85 on Oura. The hydrogen reduces oxidative stress while you sleep.\"", textBody:"DAY 7: +12 SLEEP SCORE ", voiceCta:"\"Follow for my full 30-day breakdown dropping this week.\"", textCta:"FOLLOW FOR THE FULL RESULTS →", trigger:"Transformation / Curiosity", format:"Talking head + B-roll", url:"https://www.tiktok.com", analysis:"30-day challenge format = high completion rate. Personal transformation story builds trust. Simple before/after structure with sleep metrics makes it verifiable.", variation:"'I drank VitalLyfe water for 30 days — here's what my sleep tracker showed'" },
{ id:3, platform:"youtube", creator:"@WellnessTech", title:"Smart water bottles are getting insane", thumbnail:"https://picsum.photos/seed/smart1/400/600", views:"890K", engagement:"5.7%", hook:"Water bottles now have AI?", voiceHook:"\"Wait — water bottles now have AI built in? Let me show you what's happening.\"", textHook:"AI WATER BOTTLES ARE HERE ", voiceBody:"\"This one tracks your hydration in real time, syncs with your Apple Watch, and tells you what minerals you're missing. It's wild.\"", textBody:"REAL-TIME HYDRATION TRACKING", voiceCta:"\"I'll link everything I tested in the description below.\"", textCta:"ALL LINKS IN DESCRIPTION ", trigger:"Novelty / Tech excitement", format:"Review + Demo", url:"https://www.youtube.com", analysis:"Tech curiosity angle is huge in wellness right now. Product demo in real environments builds credibility. 'Getting insane' language signals the space is evolving fast.", variation:"'VitalLyfe's water tech just changed everything — here's how it works'" },
{ id:4, platform:"instagram", creator:"@functionalwellness", title:"The water hack no one talks about", thumbnail:"https://picsum.photos/seed/well1/400/600", views:"1.8M", engagement:"9.1%", hook:"The water hack no one talks about", voiceHook:"\"There's a water hack that literally no one talks about and it's been hiding in plain sight.\"", textHook:"THE WATER HACK NO ONE TELLS YOU ", voiceBody:"\"Adding a pinch of sea salt and a squeeze of lemon to your morning water activates the electrolyte pathway before caffeine hits. Your cortisol response is completely different.\"", textBody:"SEA SALT + LEMON = ELECTROLYTE RESET", voiceCta:"\"Save this — you'll want it tomorrow morning.\"", textCta:"SAVE THIS POST ", trigger:"Secret / Insider knowledge", format:"Reel + Text overlay", url:"https://www.instagram.com", analysis:"'No one talks about' creates exclusivity. Simple text overlay keeps production cost low but engagement high. Health hack format drives saves.", variation:"'The hydration secret VitalLyfe built their whole product around'" },
{ id:5, platform:"tiktok", creator:"@startupfounder_", title:"Building a water company from scratch", thumbnail:"https://picsum.photos/seed/startup1/400/600", views:"3.2M", engagement:"13.2%", hook:"We almost shut down 3 times", voiceHook:"\"We almost shut this company down. Three times. Here's the honest truth.\"", textHook:"WE ALMOST QUIT 3 TIMES", voiceBody:"\"First time: we ran out of money in month 4. Second time: our manufacturer ghosted us. Third time: I didn't believe in myself. Here's what changed.\"", textBody:"3 TIMES WE ALMOST QUIT", voiceCta:"\"Follow us — we're documenting the whole journey raw and unfiltered.\"", textCta:"FOLLOW THE JOURNEY ", trigger:"Vulnerability / Authenticity", format:"Founder story / Talking head", url:"https://www.tiktok.com", analysis:"Founder vulnerability content outperforms polished ads 3:1 on TikTok. Authentic struggle narrative builds parasocial connection. 'Almost failed' arc creates emotional investment.", variation:"'The real story behind building VitalLyfe — we almost quit'" },
{ id:6, platform:"youtube", creator:"@drinkbetter", title:"We tested 12 smart water bottles", thumbnail:"https://picsum.photos/seed/test1/400/600", views:"1.2M", engagement:"6.3%", hook:"I wasted $800 so you don't have to", voiceHook:"\"I spent $800 testing every smart water bottle on the market so you don't have to make the same mistake.\"", textHook:"$800 WASTED SO YOU DON'T HAVE TO ", voiceBody:"\"11 of them were gimmicks. One actually worked — and it's not the most expensive one. I'll show you exactly what to look for and what to avoid.\"", textBody:"11 GIMMICKS. 1 WINNER.", voiceCta:"\"Subscribe — I'm testing hydrogen water systems next month.\"", textCta:"SUBSCRIBE FOR PART 2 ", trigger:"Value / Saves money", format:"Comparison review", url:"https://www.youtube.com", analysis:"'I wasted X so you don't have to' is one of the highest CTR hooks on YouTube. Comparison format drives search intent traffic. Position as trusted advisor, not promoter.", variation:"'We compared every hydrogen water system — here's why VitalLyfe won'" },
  ];

  const filtered = platform === "all" ? MOCK_POSTS : MOCK_POSTS.filter(p => p.platform === platform);
  const platformIcon = { instagram:"", tiktok:"", youtube:"" };
  const platformColor = { instagram:"#e1306c", tiktok:"#010101", youtube:"#ff0000" };

  return (
<>
{variationView && (
  <div style={{ position:"fixed", inset:0, background:"rgba(255,255,255,0.05)", zIndex:10000, overflowY:"auto", display:"flex", flexDirection:"column" }}>
    {/* Header bar */}
    <div style={{ padding:"16px 32px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:16, background:"rgba(255,255,255,0.05)", position:"sticky", top:0, zIndex:1 }}>
      <button onClick={() => setVariationView(null)}
        style={{ background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif", color:"rgba(255,255,255,0.6)", display:"flex", alignItems:"center", gap:6 }}>
        ← Back
      </button>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:2, textTransform:"uppercase" }}>Variation Breakdown</div>
        <div style={{ fontSize:14, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif" }}>{variationView.title}</div>
      </div>
      <div style={{ fontSize:10, background:"rgba(48,209,88,0.1)", color:"#2AABFF", borderRadius:20, padding:"5px 14px", fontWeight:700, fontFamily:"Inter, sans-serif" }}>
         VitalLyfe Ready
      </div>
    </div>

    {/* Body */}
    <div style={{ maxWidth:800, margin:"0 auto", padding:"40px 32px", width:"100%" }}>

      {/* Original vs Variation */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:32 }}>
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>Original</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif", lineHeight:1.5, fontStyle:"italic" }}>"{variationView.hook}"</div>
          <div style={{ marginTop:8, fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:"Inter, sans-serif" }}>{variationView.creator} · {variationView.views} views</div>
        </div>
        <div style={{ background:"rgba(48,209,88,0.05)", border:"2px solid rgba(48,209,88,0.25)", borderRadius:14, padding:"20px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#2AABFF", letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>VitalLyfe Version</div>
          <div style={{ fontSize:13, color:"#f5f5f7", fontFamily:"Inter, sans-serif", lineHeight:1.5, fontWeight:600 }}>"{variationView.variation}"</div>
          <div style={{ marginTop:8, fontSize:11, color:"#2AABFF", fontFamily:"Inter, sans-serif", fontWeight:600 }}>← Use this</div>
        </div>
      </div>

      {/* Full content breakdown */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:16, fontFamily:"Inter, sans-serif" }}>Full Content Breakdown</div>

        {/* Hook */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:18 }}></span>
            <div style={{ fontSize:12, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif", textTransform:"uppercase", letterSpacing:0.5 }}>Hook</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontFamily:"Inter, sans-serif" }}> Voice</div>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:600, color:"#f5f5f7", fontFamily:"Inter, sans-serif", lineHeight:1.5, fontStyle:"italic" }}>"{variationView.voiceHook || variationView.variation}"</div>
            </div>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontFamily:"Inter, sans-serif" }}> Text on Screen</div>
              <div style={{ background:"#1d1d1f", borderRadius:8, padding:"10px 14px", fontSize:14, fontWeight:700, color:"#fff", fontFamily:"'Courier New', monospace", letterSpacing:0.5 }}>{variationView.textHook || variationView.hook?.toUpperCase()}</div>
            </div>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif", lineHeight:1.6 }}>
            Pattern: <strong style={{color:"#f5f5f7"}}>{variationView.trigger}</strong> — opens with an immediate pattern interrupt that stops the scroll and creates a curiosity gap specific to VitalLyfe's audience.
          </div>
        </div>

        {/* Body */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:18 }}></span>
            <div style={{ fontSize:12, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif", textTransform:"uppercase", letterSpacing:0.5 }}>Body Copy</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontFamily:"Inter, sans-serif" }}> Voice</div>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#f5f5f7", fontFamily:"Inter, sans-serif", lineHeight:1.7, fontStyle:"italic" }}>{variationView.voiceBody || "Build on the hook by showing — not telling. Use authentic footage or founder moments. Keep it under 30 seconds."}</div>
            </div>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontFamily:"Inter, sans-serif" }}> Text on Screen</div>
              <div style={{ background:"#1d1d1f", borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:700, color:"#fff", fontFamily:"'Courier New', monospace", letterSpacing:0.5 }}>{variationView.textBody || "KEY STAT OR VISUAL CUE"}</div>
            </div>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif", lineHeight:1.6 }}>
            Format: <strong style={{color:"#f5f5f7"}}>{variationView.format}</strong> — this structure drove {variationView.engagement} engagement on the original. Replicate the pacing.
          </div>
        </div>

        {/* CTA */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <span style={{ fontSize:18 }}></span>
            <div style={{ fontSize:12, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif", textTransform:"uppercase", letterSpacing:0.5 }}>Call to Action</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontFamily:"Inter, sans-serif" }}> Voice</div>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#f5f5f7", fontFamily:"Inter, sans-serif", lineHeight:1.5, fontStyle:"italic" }}>{variationView.voiceCta || "\"Follow for more on how VitalLyfe is redefining what water can do. Link in bio.\""}</div>
            </div>
            <div>
              <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.35)", letterSpacing:1, textTransform:"uppercase", marginBottom:4, fontFamily:"Inter, sans-serif" }}> Text on Screen</div>
              <div style={{ background:"#1d1d1f", borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:700, color:"#fff", fontFamily:"'Courier New', monospace", letterSpacing:0.5 }}>{variationView.textCta || "LINK IN BIO "}</div>
            </div>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif", lineHeight:1.6 }}>
            Soft CTA works best here — matches the authentic tone of the content. Drives follows over clicks.
          </div>
        </div>
      </div>

      {/* Why it worked bullets */}
      <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"20px", marginBottom:28 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:14, fontFamily:"Inter, sans-serif" }}> Why The Original Worked</div>
        {variationView.analysis.split('. ').filter(s => s.trim()).map((point, i) => (
          <div key={i} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
            <span style={{ fontSize:11, color:"#2AABFF", fontWeight:700, marginTop:2, flexShrink:0 }}>→</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:1.6, fontFamily:"Inter, sans-serif" }}>{point.trim()}{point.trim().endsWith('.')?'':'.'}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={async () => {
          setBriefLoading(true);
          try {
            const r = await fetch("/api/agent-action", {
              method: "POST",
              headers: {"Content-Type":"application/json"},
              body: JSON.stringify({ action: "cid_build_brief", payload: variationView })
            });
            const d = await r.json();
            if (d.brief) setBriefData(d.brief);
          } catch(e) { console.error(e); }
          setBriefLoading(false);
        }} style={{ flex:1, padding:"14px", background:"#1d1d1f", color:"#fff", border:"none", borderRadius:14, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif", opacity: briefLoading ? 0.6 : 1 }}>
          {briefLoading ? "Building..." : " Build Brief"}
        </button>
        <button onClick={async () => {
          setAbLoading(true);
          try {
            const r = await fetch("/api/agent-action", {
              method: "POST",
              headers: {"Content-Type":"application/json"},
              body: JSON.stringify({ action: "cid_ab_variations", payload: variationView })
            });
            const d = await r.json();
            if (d.variations) setAbData(d.variations);
          } catch(e) { console.error(e); }
          setAbLoading(false);
        }} style={{ flex:1, padding:"14px", background:"rgba(255,255,255,0.05)", color:"#f5f5f7", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif", opacity: abLoading ? 0.6 : 1 }}>
          {abLoading ? "Generating..." : " A/B Variations"}
        </button>
      </div>

      {briefData && (
        <div style={{ marginTop:24, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", background:"#1d1d1f", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>Production Brief</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#fff", fontFamily:"Inter, sans-serif" }}>{briefData.title}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>Predicted Score</div>
              <div style={{ fontSize:24, fontWeight:700, color:"#2AABFF" }}>{briefData.predicted_score}<span style={{fontSize:12}}>/100</span></div>
            </div>
          </div>
          <div style={{ padding:"20px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
              {[["Format", briefData.format], ["Platform", briefData.platform], ["Duration", briefData.duration], ["Vibe", briefData.vibe]].map(([label, val]) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:1, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:"#f5f5f7" }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.2, textTransform:"uppercase", marginBottom:6 }}> Concept</div>
              <div style={{ fontSize:13, color:"#f5f5f7", lineHeight:1.6 }}>{briefData.concept}</div>
            </div>
            {[[" Hook", briefData.hook], [" Body", briefData.body], [" CTA", briefData.cta]].map(([label, section]) => section && (
              <div key={label} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.2, textTransform:"uppercase", marginBottom:10 }}>{label} <span style={{color:"rgba(255,255,255,0.35)", fontWeight:400}}>· {section.timing}</span></div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#f5f5f7", fontStyle:"italic" }}> "{section.voice}"</div>
                  <div style={{ background:"#1d1d1f", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#fff", fontFamily:"'Courier New', monospace", fontWeight:700 }}> {section.screen_text}</div>
                  {section.broll && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:4 }}>
                      {section.broll.map((shot, i) => (
                        <span key={i} style={{ fontSize:10, background:"rgba(255,255,255,0.05)", borderRadius:20, padding:"3px 10px", color:"rgba(255,255,255,0.6)" }}> {shot}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {briefData.shot_list && (
              <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.2, textTransform:"uppercase", marginBottom:10 }}> Shot List</div>
                {briefData.shot_list.map((shot, i) => (
                  <div key={i} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
                    <span style={{ fontSize:9, color:"#fff", background:"#1d1d1f", borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, flexShrink:0 }}>{i+1}</span>
                    <span style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.5 }}>{shot}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.2, textTransform:"uppercase", marginBottom:6 }}> Music</div>
                <div style={{ fontSize:12, color:"#f5f5f7", lineHeight:1.5 }}>{briefData.music}</div>
              </div>
              <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.2, textTransform:"uppercase", marginBottom:6 }}> Editing</div>
                <div style={{ fontSize:12, color:"#f5f5f7", lineHeight:1.5 }}>{briefData.editing_notes}</div>
              </div>
            </div>
            <div style={{ background:"rgba(48,209,88,0.06)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#2AABFF", letterSpacing:1.2, textTransform:"uppercase", marginBottom:6 }}> Why This Should Perform</div>
              <div style={{ fontSize:12, color:"#f5f5f7", lineHeight:1.6 }}>{briefData.predicted_rationale}</div>
            </div>
            <button onClick={async () => {
              if (!briefData) return;
              try {
                const item = {
                  id: Date.now(),
                  title: briefData.title,
                  format: briefData.format,
                  platform: briefData.platform?.toLowerCase() || "instagram",
                  status: "Draft",
                  stage: "Ready For Content Creation",
                  pillar: "Innovation",
                  campaign: "CID — Competitor Intel",
                  description: briefData.concept,
                  caption: briefData.hook?.voice || "",
                  script: [briefData.hook?.voice, briefData.body?.voice, briefData.cta?.voice].filter(Boolean).join("\n\n"),
                  notes: `Shot list: ${(briefData.shot_list||[]).join(' | ')} | Music: ${briefData.music} | Editing: ${briefData.editing_notes}`,
                };
                await fetch(SUPABASE_URL + "/rest/v1/content_items", {
                  method: "POST",
                  headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": "Bearer " + SUPABASE_KEY,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                  },
                  body: JSON.stringify(item)
                });
                alert(" Added to Content Tracker!");
              } catch(e) { alert("Error: " + e.message); }
            }} style={{ width:"100%", padding:"14px", background:"rgba(48,209,88,0.1)", color:"#2AABFF", border:"2px solid rgba(48,209,88,0.3)", borderRadius:14, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
               Send to Content Tracker
            </button>
          </div>
        </div>
      )}

      {abData && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:14, fontFamily:"Inter, sans-serif" }}> A/B Variation Pack</div>
          {abData.map((v, i) => (
            <div key={i} style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${i===0?"rgba(48,209,88,0.3)":"rgba(0,0,0,0.07)"}`, borderRadius:14, padding:"16px 18px", marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background: i===0?"#2AABFF":i===1?"#ff9f0a":"#636366", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {v.rank}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:0.5 }}>{v.angle}</div>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color: i===0?"#2AABFF":i===1?"#ff9f0a":"#636366" }}>{v.predicted_score}/100</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#f5f5f7", fontStyle:"italic" }}> "{v.voice_hook}"</div>
                <div style={{ background:"#1d1d1f", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#fff", fontFamily:"'Courier New', monospace", fontWeight:700 }}> {v.text_hook}</div>
              </div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", lineHeight:1.5 }}>{v.why}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:24, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:12, fontFamily:"Inter, sans-serif" }}> Log Performance</div>
        <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)", margin:"0 0 12px", fontFamily:"Inter, sans-serif" }}>After posting, log actual results to improve future predictions.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
          {[["Views", "views", "e.g. 42K"], ["Engagement", "engagement", "e.g. 8.4%"], ["Saves", "saves", "e.g. 1.2K"]].map(([label, key, ph]) => (
            <div key={key}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginBottom:4, fontFamily:"Inter, sans-serif" }}>{label}</div>
              <input value={perfLog[key]} onChange={e => setPerfLog(p=>({...p,[key]:e.target.value}))}
                placeholder={ph}
                style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", fontSize:12, fontFamily:"Inter, sans-serif", boxSizing:"border-box", outline:"none" }} />
            </div>
          ))}
        </div>
        <input value={perfLog.notes} onChange={e => setPerfLog(p=>({...p,notes:e.target.value}))}
          placeholder="Notes — what worked, what didn't..."
          style={{ width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.08)", fontSize:12, fontFamily:"Inter, sans-serif", boxSizing:"border-box", outline:"none", marginBottom:10 }} />
        <button onClick={async () => {
          try {
            await fetch(SUPABASE_URL + "/rest/v1/cid_performance", {
              method: "POST",
              headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": "Bearer " + SUPABASE_KEY,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
              },
              body: JSON.stringify({
                content_title: variationView?.title,
                variation: variationView?.variation,
                predicted_score: briefData?.predicted_score || null,
                actual_views: perfLog.views,
                actual_engagement: perfLog.engagement,
                actual_saves: perfLog.saves,
                notes: perfLog.notes,
              })
            });
            setPerfSaved(true);
          } catch(e) { console.error(e); }
        }} style={{ padding:"10px 20px", background:"#1d1d1f", color:"#fff", border:"none", borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
          {perfSaved ? " Logged!" : "Log Results"}
        </button>
      </div>

    </div>
  </div>
)}

{videoFullscreen && selected && ReactDOM.createPortal(
  <div style={{ position:"fixed", inset:0, background:"rgba(255,255,255,0.05)", zIndex:99999, display:"flex", flexDirection:"column" }}>
    {/* Header */}
    <div style={{ padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:16, background:"#0f0d0e", flexShrink:0 }}>
      <button onClick={() => { setVideoFullscreen(false); setSelected(null); }}
        style={{ background:"none", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"6px 16px", fontSize:12, fontWeight:600, cursor:"pointer", color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif" }}>
        ← Back to CID
      </button>
      <div style={{ flex:1, fontSize:13, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif" }}>{selected.creator} — {selected.title}</div>
      <div style={{ display:"flex", gap:16 }}>
        <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif" }}> {selected.views}</span>
        <span style={{ fontSize:12, color:"#2AABFF", fontWeight:700, fontFamily:"Inter, sans-serif" }}>↑ {selected.engagement}</span>
      </div>
    </div>
    {/* Body */}
    <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
      {/* LEFT — video flush to edge, no padding, no dead space */}
      <div style={{ flexShrink:0, background:"#000", overflow:"hidden", display:"flex", alignItems:"stretch" }}
           ref={el => { if(el) { const h = el.parentElement?.offsetHeight || window.innerHeight - 53; el.style.width = Math.round(h * 9/16) + 'px'; } }}>
        <div style={{ position:"relative", width:"100%", height:"100%" }}>
          <img src={selected.thumbnail} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.75 }} />
          <a href={selected.url} target="_blank" rel="noreferrer"
            style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
            <div style={{ background:"#1a1818", border:"3px solid rgba(255,255,255,0.5)", borderRadius:"50%", width:72, height:72, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}>
              <span style={{ fontSize:28, marginLeft:6, color:"#fff" }}></span>
            </div>
          </a>
          <div style={{ position:"absolute", top:12, left:12, background:"rgba(0,0,0,0.6)", borderRadius:20, padding:"4px 10px", fontSize:10, fontWeight:700, color:"#fff", textTransform:"uppercase", letterSpacing:0.5 }}>{selected.platform}</div>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"40px 16px 16px", background:"linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginBottom:3, fontFamily:"Inter, sans-serif" }}>{selected.creator}</div>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff", fontFamily:"Inter, sans-serif", lineHeight:1.3 }}>{selected.title}</div>
          </div>
        </div>
      </div>
      {/* RIGHT — analysis */}
      <div style={{ flex:1, overflowY:"auto", padding:"24px 32px", background:"rgba(255,255,255,0.05)" }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:20 }}>
          {[[" Views", selected.views], [" Engagement", selected.engagement], [" Format", selected.format]].map(([label, val]) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.07)", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"Inter, sans-serif", marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:12, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif" }}>{val}</div>
            </div>
          ))}
        </div>
        {/* Hook Detection */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.1, textTransform:"uppercase", marginBottom:10, fontFamily:"Inter, sans-serif" }}> Hook Detection</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontFamily:"Inter, sans-serif" }}> Voice Hook</div>
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#f5f5f7", fontStyle:"italic" }}>{selected.voiceHook || `"${selected.hook}"`}</div>
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontFamily:"Inter, sans-serif" }}> Text on Video</div>
            <div style={{ background:"#1d1d1f", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#fff", fontFamily:"'Courier New', monospace", fontWeight:700 }}>{selected.textHook || selected.hook.toUpperCase()}</div>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontFamily:"Inter, sans-serif" }}> Trigger: <strong style={{color:"#f5f5f7"}}>{selected.trigger}</strong></div>
        </div>
        {/* Why It Worked */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.1, textTransform:"uppercase", marginBottom:10, fontFamily:"Inter, sans-serif" }}> Why It Worked</div>
          {selected.analysis.split('. ').filter(s => s.trim()).map((point, i) => (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
              <span style={{ fontSize:10, color:"#2AABFF", fontWeight:700, marginTop:2, flexShrink:0 }}>→</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.5, fontFamily:"Inter, sans-serif" }}>{point.trim()}{point.trim().endsWith('.')?'':'.'}</span>
            </div>
          ))}
        </div>
        {/* Score bars */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.1, textTransform:"uppercase", marginBottom:10, fontFamily:"Inter, sans-serif" }}> Engagement Score</div>
          {[
            { label:"Hook Strength", score: parseInt(selected.engagement) > 10 ? 95 : parseInt(selected.engagement) > 7 ? 80 : 65 },
            { label:"Shareability", score: parseInt(selected.engagement) > 10 ? 90 : parseInt(selected.engagement) > 7 ? 75 : 60 },
            { label:"Save Rate Est.", score: parseInt(selected.engagement) > 10 ? 85 : parseInt(selected.engagement) > 7 ? 70 : 55 },
          ].map(({ label, score }) => (
            <div key={label} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif" }}>{label}</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif" }}>{score}/100</span>
              </div>
              <div style={{ height:4, background:"#161414", borderRadius:4, overflow:"hidden" }}>
                <div style={{ width:`${score}%`, height:"100%", background: score > 80 ? "#2AABFF" : score > 65 ? "#F17130" : "#ff453a", borderRadius:4 }} />
              </div>
            </div>
          ))}
        </div>
        {/* VitalLyfe Adaptation */}
        <div style={{ background:"rgba(48,209,88,0.06)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:12, padding:"14px 16px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#2AABFF", letterSpacing:1.1, textTransform:"uppercase", marginBottom:8, fontFamily:"Inter, sans-serif" }}> VitalLyfe Adaptation</div>
          <div style={{ fontSize:12, color:"#f5f5f7", lineHeight:1.6, fontStyle:"italic", fontFamily:"Inter, sans-serif" }}>"{selected.variation}"</div>
          <div style={{ marginTop:10, display:"flex", gap:6, justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:6 }}>
              <span style={{ fontSize:10, background:"rgba(48,209,88,0.15)", color:"#2AABFF", borderRadius:20, padding:"3px 10px", fontWeight:600, fontFamily:"Inter, sans-serif" }}>Ready to use</span>
              <span style={{ fontSize:10, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)", borderRadius:20, padding:"3px 10px", fontWeight:600, fontFamily:"Inter, sans-serif" }}>{selected.format}</span>
            </div>
            <button onClick={() => { setVariationView(selected); setVideoFullscreen(false); }}
              style={{ fontSize:11, fontWeight:700, color:"#2AABFF", background:"none", border:"none", cursor:"pointer", fontFamily:"Inter, sans-serif", textDecoration:"underline", padding:0 }}>
              View Full Breakdown →
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>,
  document.body
)}

<div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
  {/* Main panel */}
  <div style={{ flex:1, overflowY:"auto", padding:"32px 32px 32px", minWidth:0 }}>
    {/* Header */}
    <div style={{ marginBottom:28 }}>
      <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}> Intelligence</div>
      <h1 style={{ fontFamily:"'Instrument Serif', Georgia, serif", fontSize:32, fontWeight:700, color:"#f5f5f7", margin:0, letterSpacing:-1 }}>Competitor Intel Dashboard</h1>
      <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", margin:"8px 0 0", fontFamily:"Inter, sans-serif" }}>What's working in your space — and why. Click any post to see the breakdown.</p>
    </div>

    {/* View switcher */}
    <div style={{ display:"flex", gap:8, marginBottom:24 }}>
      {[["feed"," Intel Feed"],["hooklab"," Hook Lab"]].map(([v,label]) => (
        <button key={v} onClick={() => setCidView(v)}
          style={{ padding:"7px 18px", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", background: cidView===v ? "#1d1d1f" : "#fff", color: cidView===v ? "#fff" : "rgba(0,0,0,0.6)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
          {label}
        </button>
      ))}
    </div>

    {cidView === "feed" && <>
      {/* Search bar */}
      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <input
          value={cidSearch}
          onChange={e => setCidSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && cidSearch.trim() && setCidSearchActive(true)}
          placeholder='Search & scrape content... e.g. "hydrogen water TikTok" or "founder story wellness"'
          style={{ flex:1, padding:"10px 16px", borderRadius:24, border:"1px solid rgba(255,255,255,0.12)", fontSize:12, fontFamily:"Inter, sans-serif", outline:"none", background:"rgba(255,255,255,0.05)", color:"#f5f5f7" }}
        />
        <button onClick={() => { if(cidSearch.trim()) setCidSearchActive(true); }}
          style={{ padding:"10px 20px", borderRadius:24, background:"#1d1d1f", color:"#fff", border:"none", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif", whiteSpace:"nowrap" }}>
           Scrape
        </button>
      </div>
      {cidSearchActive && (
        <div style={{ background:"rgba(255,159,10,0.08)", border:"1px solid rgba(255,159,10,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:14 }}></span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif" }}>Searching for: <strong style={{color:"#f5f5f7"}}>"{cidSearch}"</strong> — connect Apify to pull live results</span>
          <button onClick={() => { setCidSearchActive(false); setCidSearch(""); }} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", fontSize:14, color:"rgba(255,255,255,0.4)" }}></button>
        </div>
      )}
      {/* Platform filter */}
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        {["all","instagram","tiktok","youtube"].map(p => (
          <button key={p} onClick={() => setPlatform(p)}
            style={{ padding:"7px 16px", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", background: platform===p ? "#1d1d1f" : "#fff", color: platform===p ? "#fff" : "rgba(0,0,0,0.6)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif", textTransform:"capitalize", letterSpacing:0.3 }}>
            {p === "all" ? "All Platforms" : `${platformIcon[p]} ${p.charAt(0).toUpperCase()+p.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Mock data notice */}
      <div style={{ background:"rgba(255,159,10,0.08)", border:"1px solid rgba(255,159,10,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:24, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14 }}></span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif" }}>Demo mode — connect Apify API key to pull live competitor data</span>
      </div>

      {/* Content grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:16 }}>
        {filtered.map(post => (
          <div key={post.id} onClick={() => { setSelected(post); setVideoFullscreen(true); }}
            style={{ borderRadius:16, overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)", cursor:"pointer", background:"rgba(255,255,255,0.05)", boxShadow: selected?.id===post.id ? "0 0 0 2px #1d1d1f" : "0 2px 8px rgba(0,0,0,0.06)", transition:"all 0.15s" }}>
            <div style={{ position:"relative", paddingBottom:"125%", background:"rgba(255,255,255,0.05)" }}>
              <img src={post.thumbnail} alt={post.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
              <div style={{ position:"absolute", top:8, left:8, background: platformColor[post.platform], color:"#fff", fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:20, textTransform:"uppercase", letterSpacing:0.5 }}>
                {post.platform}
              </div>
              <div style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:10, fontWeight:600, padding:"3px 8px", borderRadius:20 }}>
                 {post.views}
              </div>
            </div>
            <div style={{ padding:"12px 14px" }}>
              <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.5)", marginBottom:4, fontFamily:"Inter, sans-serif" }}>{post.creator}</div>
              <div style={{ fontSize:12, fontWeight:600, color:"#f5f5f7", lineHeight:1.4, fontFamily:"Inter, sans-serif", marginBottom:8 }}>{post.title}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:10, color:"#2AABFF", fontWeight:700 }}>↑ {post.engagement}</span>
                <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"Inter, sans-serif" }}>{post.format}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>}

    {cidView === "hooklab" && <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0, fontFamily:"Inter, sans-serif" }}>Top-performing hooks, body copy, and CTAs — analyzed and ranked by Scrappy.</p>
        <button onClick={async () => {
          setHookLabLoading(true);
          try {
            const r = await fetch("/api/agent-action", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({action:"scrappy_hook_analysis"}) });
            const d = await r.json();
            if (d.hooks) setHookLabData(d);
          } catch(e) { console.error(e); }
          setHookLabLoading(false);
        }} style={{ background:"#1d1d1f", color:"#fff", border:"none", borderRadius:20, padding:"8px 18px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"Inter, sans-serif", opacity: hookLabLoading ? 0.6 : 1 }}>
          {hookLabLoading ? "Analyzing..." : " Run Analysis"}
        </button>
      </div>

      {hookLabData.hooks.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 20px", color:"rgba(255,255,255,0.4)", fontFamily:"Inter, sans-serif" }}>
          <div style={{ fontSize:32, marginBottom:12 }}></div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Hook Lab is empty</div>
          <div style={{ fontSize:12 }}>Hit "Run Analysis" to scrape top 20 hooks and surface the best 3 for each category.</div>
        </div>
      )}

      {["hooks","bodies","ctas"].map(type => hookLabData[type]?.length > 0 && (
        <div key={type} style={{ marginBottom:32 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:14, fontFamily:"Inter, sans-serif" }}>
            {type === "hooks" ? " Top Hooks" : type === "bodies" ? " Top Body Copy" : " Top CTAs"}
          </div>
          {hookLabData[type].slice(0,3).map((item, i) => (
            <div key={i} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 18px", marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,0.3)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:10 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background: i===0 ? "#FFD700" : i===1 ? "#C0C0C0" : "#CD7F32", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {i+1}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#f5f5f7", lineHeight:1.4, fontFamily:"Inter, sans-serif", marginBottom:8 }}>"{item.text}"</div>
                  {(() => {
                    const voiceField = item.voice_hook || item.voice_body || item.voice_cta;
                    const textField = item.text_hook || item.text_body || item.text_cta;
                    return (voiceField || textField) ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:4 }}>
                        {voiceField && <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:6, padding:"6px 10px", fontSize:11, color:"rgba(255,255,255,0.7)", fontFamily:"Inter, sans-serif", fontStyle:"italic" }}> {voiceField}</div>}
                        {textField && <div style={{ background:"#1d1d1f", borderRadius:6, padding:"6px 10px", fontSize:11, color:"#fff", fontFamily:"'Courier New', monospace", fontWeight:700 }}> {textField}</div>}
                      </div>
                    ) : null;
                  })()}
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"Inter, sans-serif" }}>{item.platform} · {item.views} views · {item.engagement} eng.</div>
                </div>
              </div>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
                {item.why.split('. ').filter(s=>s.trim()).map((pt,j) => (
                  <div key={j} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"flex-start" }}>
                    <span style={{ color:"#2AABFF", fontSize:10, fontWeight:700, marginTop:2, flexShrink:0 }}>→</span>
                    <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", lineHeight:1.5, fontFamily:"Inter, sans-serif" }}>{pt.trim()}{pt.trim().endsWith('.')?'':'.'}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:"rgba(48,209,88,0.06)", border:"1px solid rgba(48,209,88,0.15)", borderRadius:8, padding:"8px 12px" }}>
                <span style={{ fontSize:10, fontWeight:700, color:"#2AABFF", fontFamily:"Inter, sans-serif", textTransform:"uppercase", letterSpacing:1 }}> VitalLyfe Version: </span>
                <span style={{ fontSize:11, color:"#f5f5f7", fontFamily:"Inter, sans-serif", fontStyle:"italic" }}>{item.adaptation}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>}
  </div>

  {/* Side panel */}
  {selected && (
    <div style={{ width:420, borderLeft:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.05)", overflowY:"auto", flexShrink:0, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.2, textTransform:"uppercase" }}>Intel View</div>
        <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"rgba(255,255,255,0.4)", lineHeight:1 }}></button>
      </div>
      <div style={{ padding:"16px 20px" }}>
        <div onClick={() => setVideoFullscreen(true)}
          style={{ borderRadius:12, overflow:"hidden", background:"#1d1d1f", aspectRatio:"9/16", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16, position:"relative", cursor:"pointer" }}>
          <img src={selected.thumbnail} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.4, transition:"opacity 0.2s" }} />
          <div style={{ position:"relative", zIndex:1, background:"#1a1818", border:"2px solid rgba(255,255,255,0.4)", borderRadius:"50%", width:56, height:56, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
            <span style={{ fontSize:20, marginLeft:4, color:"#fff" }}></span>
          </div>

          <div style={{ position:"absolute", bottom:12, left:12, right:12, zIndex:1 }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif", marginBottom:4 }}>{selected.creator}</div>
            <div style={{ fontSize:12, fontWeight:600, color:"#fff", fontFamily:"Inter, sans-serif", lineHeight:1.3 }}>{selected.title}</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
          {[[" Views", selected.views], [" Engagement", selected.engagement], [" Format", selected.format]].map(([label, val]) => (
            <div key={label} style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"10px 12px", border:"1px solid rgba(255,255,255,0.07)", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"Inter, sans-serif", marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:12, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Hook */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.1, textTransform:"uppercase", marginBottom:10, fontFamily:"Inter, sans-serif" }}> Hook Detection</div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontFamily:"Inter, sans-serif", display:"flex", alignItems:"center", gap:4 }}> Voice Hook</div>
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#f5f5f7", fontFamily:"Inter, sans-serif", lineHeight:1.5, fontStyle:"italic" }}>{selected.voiceHook || `"${selected.hook}"`}</div>
          </div>
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:5, fontFamily:"Inter, sans-serif", display:"flex", alignItems:"center", gap:4 }}> Text on Video</div>
            <div style={{ background:"#1d1d1f", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#fff", fontFamily:"'Courier New', monospace", fontWeight:700, letterSpacing:0.5 }}>{selected.textHook || selected.hook.toUpperCase()}</div>
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontFamily:"Inter, sans-serif" }}> Trigger: <strong style={{color:"#f5f5f7"}}>{selected.trigger}</strong></div>
        </div>

        {/* Why it worked — detailed bullets */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.1, textTransform:"uppercase", marginBottom:10, fontFamily:"Inter, sans-serif" }}> Why It Worked</div>
          {selected.analysis.split('. ').filter(s => s.trim()).map((point, i) => (
            <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
              <span style={{ fontSize:10, color:"#2AABFF", fontWeight:700, marginTop:2, flexShrink:0 }}>→</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.85)", lineHeight:1.5, fontFamily:"Inter, sans-serif" }}>{point.trim()}{point.trim().endsWith('.')?'':'.'}</span>
            </div>
          ))}
        </div>

        {/* Engagement score bar */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", letterSpacing:1.1, textTransform:"uppercase", marginBottom:10, fontFamily:"Inter, sans-serif" }}> Engagement Score</div>
          {[
            { label:"Hook Strength", score: parseInt(selected.engagement) > 10 ? 95 : parseInt(selected.engagement) > 7 ? 80 : 65 },
            { label:"Shareability", score: parseInt(selected.engagement) > 10 ? 90 : parseInt(selected.engagement) > 7 ? 75 : 60 },
            { label:"Save Rate Est.", score: parseInt(selected.engagement) > 10 ? 85 : parseInt(selected.engagement) > 7 ? 70 : 55 },
          ].map(({ label, score }) => (
            <div key={label} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.6)", fontFamily:"Inter, sans-serif" }}>{label}</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#f5f5f7", fontFamily:"Inter, sans-serif" }}>{score}/100</span>
              </div>
              <div style={{ height:4, background:"#161414", borderRadius:4, overflow:"hidden" }}>
                <div style={{ width:`${score}%`, height:"100%", background: score > 80 ? "#2AABFF" : score > 65 ? "#F17130" : "#ff453a", borderRadius:4, transition:"width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>

        {/* VitalLyfe Variation */}
        <div style={{ background:"rgba(48,209,88,0.06)", border:"1px solid rgba(48,209,88,0.2)", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#2AABFF", letterSpacing:1.1, textTransform:"uppercase", marginBottom:8, fontFamily:"Inter, sans-serif" }}> VitalLyfe Adaptation</div>
          <div style={{ fontSize:12, color:"#f5f5f7", lineHeight:1.6, fontFamily:"Inter, sans-serif", fontStyle:"italic" }}>"{selected.variation}"</div>
          <div style={{ marginTop:10, display:"flex", gap:6, alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", gap:6 }}>
              <span style={{ fontSize:10, background:"rgba(48,209,88,0.15)", color:"#2AABFF", borderRadius:20, padding:"3px 10px", fontWeight:600, fontFamily:"Inter, sans-serif" }}>Ready to use</span>
              <span style={{ fontSize:10, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)", borderRadius:20, padding:"3px 10px", fontWeight:600, fontFamily:"Inter, sans-serif" }}>{selected.format}</span>
            </div>
            <button onClick={() => setVariationView(selected)}
              style={{ fontSize:11, fontWeight:700, color:"#2AABFF", background:"none", border:"none", cursor:"pointer", fontFamily:"Inter, sans-serif", textDecoration:"underline", padding:0 }}>
              View Full Breakdown →
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
</div>
</>
  );
}
