    function LoginScreen({ onLogin }) {
      const isMobile = useIsMobile();
      const [email, setEmail]       = useState("");
      const [password, setPassword] = useState("");
      const [error, setError]       = useState("");
      const [loading, setLoading]   = useState(false);

      useEffect(() => {
        if (document.getElementById('lg-css')) return;
        const s = document.createElement('style');
        s.id = 'lg-css';
        s.textContent = `
          .lg-box {
            background: rgba(255,255,255,0.04);
            backdrop-filter: blur(52px);
            -webkit-backdrop-filter: blur(52px);
            box-shadow: 4px 4px 28px rgba(0,0,0,0.35),
                        inset 0 1px 1px rgba(255,255,255,0.15);
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
              rgba(255,255,255,0.55) 0%,
              rgba(255,255,255,0.18) 25%,
              transparent 45%,
              transparent 55%,
              rgba(255,255,255,0.18) 75%,
              rgba(255,255,255,0.55) 100%
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
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
            background: rgba(255,255,255,0.11);
            border-bottom-color: rgba(42,171,255,0.7);
          }
          .lg-input::placeholder { color: rgba(255,255,255,0.28); }
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
            background: rgba(42,171,255,0.22);
            backdrop-filter: blur(10px);
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.20), 0 0 24px rgba(42,171,255,0.12);
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
              rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 30%,
              transparent 50%, transparent 70%,
              rgba(255,255,255,0.15) 85%, rgba(255,255,255,0.55) 100%
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
          }
          .lg-btn:hover:not(:disabled) { transform:scale(1.02); background:rgba(42,171,255,0.32); }
          .lg-btn:active:not(:disabled) { transform:scale(0.98); }
          .lg-btn:disabled { opacity:0.45; cursor:not-allowed; }
        `;
        document.head.appendChild(s);
      }, []);

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

          {/* ── FULL SCREEN WATERFALL VIDEO ── */}
          <video
            autoPlay muted loop playsInline
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", zIndex:0 }}
          >
            {/* Free HD waterfall — Pexels (CC0) */}
            <source src="https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_25fps.mp4" type="video/mp4" />
            <source src="https://videos.pexels.com/video-files/1448735/1448735-uhd_2560_1440_24fps.mp4" type="video/mp4" />
          </video>

          {/* Dark overlay — preserves moody feel */}
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.48)", zIndex:1 }} />

          {/* Radial gradient — focuses eye on center */}
          <div style={{ position:"absolute", inset:0, zIndex:2, background:"radial-gradient(ellipse 65% 75% at 50% 50%, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.70) 100%)", pointerEvents:"none" }} />

          {/* ── LIQUID GLASS LOGIN BOX ── */}
          <div className="lg-box" style={{ position:"relative", zIndex:10, width: isMobile ? "calc(100vw - 36px)" : 370, padding: isMobile ? "36px 24px 40px" : "48px 44px" }}>

            <div style={{ marginBottom:32, textAlign:"center" }}>
              <div style={{ width:46, height:46, borderRadius:13, background:"rgba(42,171,255,0.14)", border:"1px solid rgba(42,171,255,0.28)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
                <span style={{ fontSize:18, fontWeight:800, color:"#2AABFF" }}>W</span>
              </div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.38)", letterSpacing:3, textTransform:"uppercase", fontWeight:600, marginBottom:7 }}>Cloud Scenic</div>
              <h1 style={{ fontSize:24, fontWeight:500, color:"#fff", margin:"0 0 5px", letterSpacing:-0.5 }}>Vantus</h1>
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>VitalLyfe Content Operations</p>
            </div>

            <div>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.8, textTransform:"uppercase", color:"rgba(255,255,255,0.40)", display:"block", marginBottom:6 }}>Email</label>
              <input className="lg-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="you@cloudscenic.com" />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.8, textTransform:"uppercase", color:"rgba(255,255,255,0.40)", display:"block", marginBottom:6 }}>Password</label>
              <input className="lg-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••••" />
            </div>

            {error && (
              <div style={{ fontSize:11, color:"rgba(255,110,100,0.95)", marginBottom:14, padding:"9px 13px", background:"rgba(255,50,50,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading} className="lg-btn">
              {loading ? "Signing in…" : "Enter Vantus →"}
            </button>

            <div style={{ marginTop:22, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2s infinite" }} />
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.26)" }}>7 agents · Live operations</span>
            </div>
          </div>

        </div>
      );
    }

