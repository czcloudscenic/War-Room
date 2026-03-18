    function LoginScreen({ onLogin }) {
      const isMobile = useIsMobile();
      const [email, setEmail]       = useState("");
      const [password, setPassword] = useState("");
      const [error, setError]       = useState("");
      const [loading, setLoading]   = useState(false);
      const canvasRef = useRef(null);

      // Inject liquid glass CSS once
      useEffect(() => {
        if (document.getElementById('lg-css')) return;
        const s = document.createElement('style');
        s.id = 'lg-css';
        s.textContent = `
          .lg-box {
            background: rgba(255,255,255,0.04);
            backdrop-filter: blur(50px);
            -webkit-backdrop-filter: blur(50px);
            box-shadow: 4px 4px 20px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.15);
            position: relative;
            overflow: hidden;
            border-radius: 24px;
          }
          .lg-box::before {
            content: '';
            position: absolute;
            inset: 0;
            padding: 0.8px;
            border-radius: 24px;
            background: linear-gradient(160deg,
              rgba(255,255,255,0.50) 0%,
              rgba(255,255,255,0.18) 25%,
              transparent 45%,
              transparent 55%,
              rgba(255,255,255,0.18) 75%,
              rgba(255,255,255,0.50) 100%
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box,
                          linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
          }
          .lg-input {
            width: 100%;
            background: rgba(255,255,255,0.07);
            border: none;
            border-bottom: 1px solid rgba(255,255,255,0.18);
            border-radius: 10px 10px 0 0;
            padding: 13px 16px;
            font-size: 14px;
            color: #fff;
            outline: none;
            font-family: Inter, sans-serif;
            margin-bottom: 14px;
            box-sizing: border-box;
            transition: background 0.2s, border-color 0.2s;
          }
          .lg-input:focus {
            background: rgba(255,255,255,0.10);
            border-bottom-color: rgba(42,171,255,0.6);
          }
          .lg-input::placeholder { color: rgba(255,255,255,0.30); }
          .lg-btn {
            width: 100%;
            padding: 14px;
            font-size: 13px;
            font-weight: 600;
            color: #fff;
            letter-spacing: 0.4px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-family: Inter, sans-serif;
            background: rgba(42,171,255,0.25);
            backdrop-filter: blur(10px);
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.2), 0 0 20px rgba(42,171,255,0.15);
            position: relative;
            overflow: hidden;
            transition: transform 0.15s, background 0.2s;
          }
          .lg-btn::before {
            content: '';
            position: absolute;
            inset: 0;
            padding: 0.8px;
            border-radius: 12px;
            background: linear-gradient(160deg,
              rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.15) 30%,
              transparent 50%, transparent 70%,
              rgba(255,255,255,0.15) 85%, rgba(255,255,255,0.50) 100%
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
          }
          .lg-btn:hover:not(:disabled) { transform: scale(1.02); background: rgba(42,171,255,0.35); }
          .lg-btn:active:not(:disabled) { transform: scale(0.98); }
          .lg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        `;
        document.head.appendChild(s);
      }, []);

      // Rotating planet on canvas
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let raf, t = 0;
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        const STARS = Array.from({ length: 220 }, () => ({
          x: Math.random(), y: Math.random(),
          r: Math.random() * 1.0 + 0.2,
          a: Math.random() * 0.55 + 0.08,
          ph: Math.random() * Math.PI * 2,
        }));

        // Continent outlines (lon, lat degrees)
        const LANDS = {
          northAmerica: [[-168,72],[-140,72],[-125,60],[-123,49],[-117,32],[-105,20],[-84,10],[-77,8],[-65,18],[-60,15],[-75,0],[-80,8],[-88,16],[-97,26],[-80,40],[-70,47],[-55,47],[-65,44],[-75,42],[-83,45],[-92,52],[-110,60],[-130,55],[-148,60],[-168,72]],
          southAmerica: [[-80,10],[-62,10],[-52,4],[-48,-2],[-35,-5],[-38,-15],[-43,-23],[-50,-32],[-58,-38],[-65,-55],[-72,-50],[-70,-35],[-75,-10],[-80,0],[-80,10]],
          europe: [[-10,36],[5,40],[15,42],[28,36],[30,46],[20,56],[10,62],[0,52],[-10,36]],
          africa: [[-18,15],[10,15],[20,15],[42,12],[44,10],[42,2],[36,-20],[28,-35],[15,-30],[10,-5],[2,6],[-16,10],[-18,15]],
          asia: [[25,70],[80,72],[140,72],[170,64],[165,55],[145,45],[122,30],[105,10],[100,-5],[115,0],[130,15],[145,35],[155,48],[140,72]],
          australia: [[115,-22],[130,-12],[140,-18],[152,-25],[154,-28],[150,-36],[138,-35],[115,-28],[114,-24],[115,-22]],
          greenland: [[-55,76],[-20,76],[-18,72],[-30,65],[-52,62],[-60,72],[-55,76]],
        };

        const proj = (lonDeg, latDeg, rotY, tilt, cx, cy, R) => {
          const lon = lonDeg * Math.PI/180, lat = latDeg * Math.PI/180;
          const cl = Math.cos(lat), sl = Math.sin(lat);
          const x = cl * Math.sin(lon + rotY);
          const y = sl;
          const z = cl * Math.cos(lon + rotY);
          const y2 = y*Math.cos(tilt) - z*Math.sin(tilt);
          const z2 = y*Math.sin(tilt) + z*Math.cos(tilt);
          return { sx: cx + x*R, sy: cy - y2*R, z: z2, vis: z2 > -0.08 };
        };

        const draw = () => {
          t += 0.003;
          const W = canvas.width, H = canvas.height;
          const cx = W/2, cy = H/2;
          const R = Math.min(W,H) * (isMobile ? 0.40 : 0.37);
          const rotY = t * 0.09;
          const tilt = 0.30 + Math.sin(t*0.07) * 0.025;

          // Pure black bg
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, W, H);

          // Stars
          STARS.forEach(s => {
            ctx.beginPath();
            ctx.arc(s.x*W, s.y*H, s.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(220,235,255,${s.a*(0.5+0.5*Math.sin(t*0.8+s.ph))})`;
            ctx.fill();
          });

          // Outer atmosphere
          const atm = ctx.createRadialGradient(cx,cy,R*0.96,cx,cy,R*1.25);
          atm.addColorStop(0,   'rgba(80,150,255,0.16)');
          atm.addColorStop(0.5, 'rgba(50,120,220,0.06)');
          atm.addColorStop(1,   'transparent');
          ctx.beginPath(); ctx.arc(cx, cy, R*1.25, 0, Math.PI*2);
          ctx.fillStyle = atm; ctx.fill();

          // Ocean base
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          const ocean = ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,0,cx,cy,R);
          ocean.addColorStop(0,   '#1a5fa0');
          ocean.addColorStop(0.4, '#134d8a');
          ocean.addColorStop(0.75,'#0a2f5c');
          ocean.addColorStop(1,   '#050e22');
          ctx.fillStyle = ocean; ctx.fillRect(cx-R,cy-R,R*2,R*2);
          ctx.restore();

          // Continents
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          Object.values(LANDS).forEach(pts => {
            let vis = 0;
            pts.forEach(([lo,la]) => { if (proj(lo,la,rotY,tilt,cx,cy,R).vis) vis++; });
            if (vis < 3) return;
            ctx.beginPath();
            let started = false;
            pts.forEach(([lo,la]) => {
              const p = proj(lo,la,rotY,tilt,cx,cy,R);
              if (!p.vis) { started = false; return; }
              if (!started) { ctx.moveTo(p.sx,p.sy); started=true; }
              else ctx.lineTo(p.sx,p.sy);
            });
            ctx.closePath();
            const g = ctx.createLinearGradient(cx-R,cy-R,cx+R,cy+R);
            g.addColorStop(0,'rgba(85,135,55,0.92)');
            g.addColorStop(0.5,'rgba(105,145,60,0.90)');
            g.addColorStop(1,'rgba(120,110,50,0.88)');
            ctx.fillStyle = g; ctx.fill();
          });
          ctx.restore();

          // Ice caps
          ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
          [82,-76].forEach(latDeg => {
            const pts=[];
            for(let lo=0;lo<=360;lo+=5){ const p=proj(lo,latDeg,rotY,tilt,cx,cy,R); if(p.vis)pts.push(p); }
            if(pts.length<2) return;
            const pole = proj(0,latDeg>0?90:-90,rotY,tilt,cx,cy,R);
            ctx.beginPath(); ctx.moveTo(pts[0].sx,pts[0].sy);
            pts.forEach(p=>ctx.lineTo(p.sx,p.sy));
            if(pole.vis) ctx.lineTo(pole.sx,pole.sy);
            ctx.closePath();
            ctx.fillStyle='rgba(220,232,255,0.88)'; ctx.fill();
          });
          ctx.restore();

          // Cloud bands
          ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
          [{la:50,off:0.9,w:16,a:0.22},{la:25,off:1.8,w:12,a:0.16},{la:-8,off:2.5,w:14,a:0.18},{la:-35,off:0.5,w:18,a:0.20}].forEach(cb=>{
            const top=[],bot=[];
            for(let lo=-180;lo<=180;lo+=4){
              const p1=proj(lo,cb.la-cb.w/2,rotY+cb.off,tilt,cx,cy,R*0.993);
              const p2=proj(lo,cb.la+cb.w/2,rotY+cb.off,tilt,cx,cy,R*0.993);
              if(p1.vis){top.push(p1);bot.push(p2);}
            }
            if(top.length<3)return;
            ctx.beginPath(); ctx.moveTo(top[0].sx,top[0].sy);
            top.forEach(p=>ctx.lineTo(p.sx,p.sy));
            for(let i=bot.length-1;i>=0;i--)ctx.lineTo(bot[i].sx,bot[i].sy);
            ctx.closePath();
            ctx.fillStyle=`rgba(255,255,255,${cb.a})`; ctx.fill();
          });
          ctx.restore();

          // Specular
          ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
          const sp=ctx.createRadialGradient(cx-R*0.35,cy-R*0.35,0,cx-R*0.15,cy-R*0.15,R*0.6);
          sp.addColorStop(0,'rgba(255,255,255,0.13)'); sp.addColorStop(0.4,'rgba(200,220,255,0.06)'); sp.addColorStop(1,'transparent');
          ctx.fillStyle=sp; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

          // Night shadow
          ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
          const sh=ctx.createRadialGradient(cx+R*0.44,cy+R*0.06,0,cx+R*0.18,cy,R*1.05);
          sh.addColorStop(0,'rgba(0,0,0,0.90)'); sh.addColorStop(0.38,'rgba(0,0,0,0.62)');
          sh.addColorStop(0.68,'rgba(0,0,0,0.18)'); sh.addColorStop(1,'transparent');
          ctx.fillStyle=sh; ctx.fillRect(cx-R,cy-R,R*2,R*2); ctx.restore();

          // Atmosphere rim
          const rim=ctx.createRadialGradient(cx,cy,R*0.90,cx,cy,R*1.04);
          rim.addColorStop(0,'transparent');
          rim.addColorStop(0.7,`rgba(80,160,255,${0.20+0.04*Math.sin(t*0.4)})`);
          rim.addColorStop(0.92,`rgba(110,185,255,${0.38+0.06*Math.sin(t*0.4)})`);
          rim.addColorStop(1,'rgba(70,140,255,0.08)');
          ctx.beginPath(); ctx.arc(cx,cy,R*1.04,0,Math.PI*2); ctx.fillStyle=rim; ctx.fill();
          ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
          ctx.strokeStyle=`rgba(100,170,255,${0.55+0.07*Math.sin(t*0.5)})`;
          ctx.lineWidth=1.2; ctx.stroke();

          // Vignette
          const vig=ctx.createRadialGradient(cx,cy,R*0.45,cx,cy,Math.max(W,H)*0.82);
          vig.addColorStop(0,'transparent'); vig.addColorStop(0.5,'rgba(0,0,0,0.10)'); vig.addColorStop(1,'rgba(0,0,0,0.88)');
          ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

          raf = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
      }, [isMobile]);

      const handleLogin = async () => {
        if (!email || !password) { setError("Email and password required."); return; }
        setLoading(true); setError("");
        const { data, error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) { setError(err.message); setLoading(false); return; }
        const ADMIN_EMAILS = ["cz@cloudscenic.com","dv@cloudscenic.com","ss@cloudscenic.com"];
        const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).single();
        const role = profile?.role || (ADMIN_EMAILS.includes(data.user.email) ? "admin" : "client");
        onLogin(data.user, role);
        setLoading(false);
      };

      return (
        <div style={{ minHeight:"100vh", minHeight:"100dvh", background:"#000", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter, sans-serif" }}>

          {/* Canvas planet */}
          <canvas ref={canvasRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:0 }} />

          {/* Subtle dark center gradient so card reads against planet */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 70% 80% at 50% 50%, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.08) 40%, transparent 70%)", zIndex:1, pointerEvents:"none" }} />

          {/* Login box — liquid glass */}
          <div className="lg-box" style={{ position:"relative", zIndex:10, width: isMobile ? "calc(100vw - 40px)" : 380, padding: isMobile ? "36px 28px 40px" : "48px 44px" }}>

            {/* Header */}
            <div style={{ marginBottom:36, textAlign:"center" }}>
              <div style={{ width:48, height:48, borderRadius:14, background:"rgba(42,171,255,0.15)", border:"1px solid rgba(42,171,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
                <span style={{ fontSize:20, fontWeight:800, color:"#2AABFF", letterSpacing:-0.5 }}>W</span>
              </div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.40)", letterSpacing:3, textTransform:"uppercase", fontWeight:600, marginBottom:8 }}>Cloud Scenic</div>
              <h1 style={{ fontSize:26, fontWeight:500, color:"#fff", margin:"0 0 6px", letterSpacing:-0.6 }}>Vantus</h1>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.38)", margin:0 }}>VitalLyfe Content Operations</p>
            </div>

            {/* Fields */}
            <div style={{ marginBottom:6 }}>
              <label style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.42)", display:"block", marginBottom:6 }}>Email</label>
              <input className="lg-input" type="email" value={email}
                onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="you@cloudscenic.com" />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.42)", display:"block", marginBottom:6 }}>Password</label>
              <input className="lg-input" type="password" value={password}
                onChange={e=>setPassword(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="••••••••" />
            </div>

            {error && (
              <div style={{ fontSize:11, color:"rgba(255,110,110,0.95)", marginBottom:14, padding:"9px 13px", background:"rgba(255,60,60,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading} className="lg-btn">
              {loading ? "Signing in…" : "Enter Vantus →"}
            </button>

            {/* Footer status */}
            <div style={{ marginTop:24, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2s infinite" }} />
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.28)" }}>7 agents · Live operations</span>
            </div>

          </div>
        </div>
      );
    }

