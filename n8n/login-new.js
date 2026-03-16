    function LoginScreen({ onLogin }) {
      const isMobile = useIsMobile();
      const [email, setEmail]       = useState("");
      const [password, setPassword] = useState("");
      const [error, setError]       = useState("");
      const [loading, setLoading]   = useState(false);

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

      // ── Liquid glass CSS injected once ──────────────────────────────────
      useEffect(() => {
        if (document.getElementById('liquid-glass-css')) return;
        const style = document.createElement('style');
        style.id = 'liquid-glass-css';
        style.textContent = `
          .lg {
            background: rgba(255,255,255,0.01);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.10);
            position: relative;
            overflow: hidden;
          }
          .lg::before {
            content: '';
            position: absolute;
            inset: 0;
            padding: 1.4px;
            border-radius: inherit;
            background: linear-gradient(180deg,
              rgba(255,255,255,0.45) 0%,
              rgba(255,255,255,0.15) 20%,
              transparent 40%,
              transparent 60%,
              rgba(255,255,255,0.15) 80%,
              rgba(255,255,255,0.45) 100%
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
          }
          .lg-strong {
            background: rgba(255,255,255,0.04);
            backdrop-filter: blur(50px);
            -webkit-backdrop-filter: blur(50px);
            box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15);
            position: relative;
            overflow: hidden;
          }
          .lg-strong::before {
            content: '';
            position: absolute;
            inset: 0;
            padding: 0.5px;
            border-radius: inherit;
            background: linear-gradient(180deg,
              rgba(255,255,255,0.50) 0%,
              rgba(255,255,255,0.20) 20%,
              transparent 40%,
              transparent 60%,
              rgba(255,255,255,0.20) 80%,
              rgba(255,255,255,0.50) 100%
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
          }
          .lg-pill { border-radius: 9999px; }
          .lg-card { border-radius: 1.5rem; }
          .lg-btn {
            transition: transform 0.2s ease;
            cursor: pointer;
            border: none;
            outline: none;
            font-family: Inter, sans-serif;
            color: rgba(255,255,255,0.9);
            background: transparent;
          }
          .lg-btn:hover { transform: scale(1.05); }
          .lg-btn:active { transform: scale(0.95); }
          .login-input {
            width: 100%;
            background: rgba(255,255,255,0.06);
            border: none;
            border-bottom: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 12px 14px;
            font-size: 14px;
            color: #fff;
            outline: none;
            font-family: Inter, sans-serif;
            margin-bottom: 12px;
            box-sizing: border-box;
            backdrop-filter: blur(4px);
            transition: border-color 0.2s;
          }
          .login-input:focus { border-bottom-color: rgba(255,255,255,0.4); }
          .login-input::placeholder { color: rgba(255,255,255,0.35); }
        `;
        document.head.appendChild(style);
      }, []);

      return (
        <div style={{ minHeight:"100vh", minHeight:"100dvh", position:"relative", overflow:"hidden", fontFamily:"Inter, sans-serif", display:"flex" }}>

          {/* ── VIDEO BACKGROUND ── */}
          <video
            autoPlay muted loop playsInline
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", zIndex:0 }}
          >
            <source src="https://cdn.pixabay.com/video/2020/07/31/46105-449089479_large.mp4" type="video/mp4" />
            <source src="https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4" type="video/mp4" />
          </video>

          {/* Overlay to darken video */}
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1 }} />

          {/* ── CONTENT (above video) ── */}
          <div style={{ position:"relative", zIndex:10, display:"flex", width:"100%", minHeight:"100vh" }}>

            {/* ── LEFT PANEL ── */}
            <div style={{ width: isMobile ? "100%" : "52%", display:"flex", flexDirection:"column", padding: isMobile ? "24px" : "28px", position:"relative" }}>

              {/* Inner liquid glass panel */}
              <div className="lg-strong lg-card" style={{ flex:1, display:"flex", flexDirection:"column", padding: isMobile ? "24px" : "32px" }}>

                {/* Nav */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: isMobile ? 40 : 0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ color:"#fff", fontSize:13, fontWeight:800, letterSpacing:-0.5 }}>VL</span>
                    </div>
                    <span style={{ color:"#fff", fontSize:18, fontWeight:600, letterSpacing:-0.5 }}>War Room</span>
                  </div>
                  <button className="lg lg-pill lg-btn" style={{ padding:"6px 16px", fontSize:12, color:"rgba(255,255,255,0.8)" }}>
                    Menu ≡
                  </button>
                </div>

                {/* Hero center */}
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"20px 0" }}>
                  {/* Logo orb */}
                  <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.05))", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:24, boxShadow:"0 0 40px rgba(42,171,255,0.3)" }}>
                    <span style={{ fontSize:28, fontWeight:800, color:"#fff", letterSpacing:-1 }}>W</span>
                  </div>

                  <h1 style={{ fontSize: isMobile ? 36 : 52, fontWeight:500, color:"#fff", margin:"0 0 8px", letterSpacing:-1.5, lineHeight:1.1 }}>
                    Operate the<br/>
                    <em style={{ fontStyle:"italic", color:"rgba(255,255,255,0.75)", fontWeight:400 }}>future of content</em>
                  </h1>
                  <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", margin:"12px 0 32px", maxWidth:320, lineHeight:1.6 }}>
                    Cloud Scenic × VitalLyfe — AI-powered content operations
                  </p>

                  {/* Pills */}
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:32 }}>
                    {["Content Pipeline","AI Agents","Live Analytics"].map(t => (
                      <span key={t} className="lg lg-pill" style={{ padding:"6px 16px", fontSize:11, color:"rgba(255,255,255,0.75)", cursor:"default" }}>{t}</span>
                    ))}
                  </div>

                  {/* Quote */}
                  {!isMobile && (
                    <div style={{ marginTop:"auto", paddingTop:24, borderTop:"1px solid rgba(255,255,255,0.08)", width:"100%", maxWidth:340 }}>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Built by Cloud Scenic</div>
                      <p style={{ fontSize:13, color:"rgba(255,255,255,0.5)", fontStyle:"italic", margin:0 }}>
                        "Content operations, elevated."
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT PANEL — Login ── */}
            <div style={{ width: isMobile ? "100%" : "48%", display: isMobile ? "none" : "flex", flexDirection:"column", padding:"28px 28px 28px 0" }}>
              <div className="lg-strong lg-card" style={{ flex:1, display:"flex", flexDirection:"column", padding:"32px" }}>

                {/* Top bar */}
                <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:32, gap:8 }}>
                  <div className="lg lg-pill" style={{ padding:"6px 14px", fontSize:11, color:"rgba(255,255,255,0.6)" }}>
                    ✦ Secure Access
                  </div>
                </div>

                {/* Login form */}
                <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", maxWidth:340, margin:"0 auto", width:"100%" }}>
                  <div style={{ marginBottom:32 }}>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:2, textTransform:"uppercase", fontWeight:600, marginBottom:8 }}>Cloud Scenic</div>
                    <h2 style={{ fontSize:32, fontWeight:500, color:"#fff", margin:"0 0 6px", letterSpacing:-0.8 }}>Sign in</h2>
                    <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", margin:0 }}>VitalLyfe War Room</p>
                  </div>

                  <label style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.4)", display:"block", marginBottom:6 }}>Email</label>
                  <input className="login-input" type="email" value={email}
                    onChange={e=>setEmail(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                    placeholder="you@cloudscenic.com" />

                  <label style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.4)", display:"block", marginBottom:6 }}>Password</label>
                  <input className="login-input" type="password" value={password}
                    onChange={e=>setPassword(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                    placeholder="••••••••" />

                  {error && (
                    <div style={{ fontSize:11, color:"rgba(255,100,100,0.9)", marginBottom:12, padding:"8px 12px", background:"rgba(255,60,60,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
                      {error}
                    </div>
                  )}

                  <button onClick={handleLogin} disabled={loading} className="lg-strong lg-btn lg-pill"
                    style={{ width:"100%", padding:"14px", fontSize:13, fontWeight:600, color:loading?"rgba(255,255,255,0.4)":"#fff", letterSpacing:0.3, marginTop:8 }}>
                    {loading ? "Signing in…" : "Enter War Room →"}
                  </button>
                </div>

                {/* Status bar */}
                <div style={{ marginTop:32, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2s infinite" }} />
                  <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>7 agents active · Live operations</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── MOBILE LOGIN OVERLAY ── */}
          {isMobile && (
            <div style={{ position:"absolute", inset:0, zIndex:20, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div className="lg-strong lg-card" style={{ width:"100%", maxWidth:360, padding:"36px 28px" }}>
                <div style={{ textAlign:"center", marginBottom:28 }}>
                  <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                    <span style={{ fontSize:22, fontWeight:800, color:"#fff" }}>W</span>
                  </div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Cloud Scenic</div>
                  <h2 style={{ fontSize:24, fontWeight:500, color:"#fff", margin:"0 0 4px", letterSpacing:-0.5 }}>War Room</h2>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>VitalLyfe Content Operations</p>
                </div>
                <label style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.4)", display:"block", marginBottom:6 }}>Email</label>
                <input className="login-input" type="email" value={email}
                  onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                  placeholder="you@cloudscenic.com" />
                <label style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"rgba(255,255,255,0.4)", display:"block", marginBottom:6 }}>Password</label>
                <input className="login-input" type="password" value={password}
                  onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                  placeholder="••••••••" />
                {error && <div style={{ fontSize:11, color:"rgba(255,100,100,0.9)", marginBottom:12, padding:"8px 12px", background:"rgba(255,60,60,0.08)", borderRadius:8 }}>{error}</div>}
                <button onClick={handleLogin} disabled={loading} className="lg-strong lg-btn lg-pill"
                  style={{ width:"100%", padding:"14px", fontSize:13, fontWeight:600, color:loading?"rgba(255,255,255,0.4)":"#fff", marginTop:8 }}>
                  {loading ? "Signing in…" : "Enter War Room →"}
                </button>
              </div>
            </div>
          )}

        </div>
      );
    }

