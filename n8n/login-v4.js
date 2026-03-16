    function LoginScreen({ onLogin }) {
      const isMobile = useIsMobile();
      const [email, setEmail]       = useState("");
      const [password, setPassword] = useState("");
      const [error, setError]       = useState("");
      const [loading, setLoading]   = useState(false);
      const mountRef = useRef(null);

      // Inject liquid glass CSS
      useEffect(() => {
        if (document.getElementById('lg-css')) return;
        const s = document.createElement('style');
        s.id = 'lg-css';
        s.textContent = `
          .lg-box {
            background: rgba(255,255,255,0.04);
            backdrop-filter: blur(50px);
            -webkit-backdrop-filter: blur(50px);
            box-shadow: 4px 4px 20px rgba(0,0,0,0.25),
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
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.20),
                        0 0 24px rgba(42,171,255,0.12);
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
            -webkit-mask: linear-gradient(#fff 0 0) content-box,
                          linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
          }
          .lg-btn:hover:not(:disabled) { transform:scale(1.02); background:rgba(42,171,255,0.32); }
          .lg-btn:active:not(:disabled) { transform:scale(0.98); }
          .lg-btn:disabled { opacity:0.45; cursor:not-allowed; }
        `;
        document.head.appendChild(s);
      }, []);

      // Three.js hyper-realistic Earth
      useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        // Load Three.js r128 from CDN
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = () => initGlobe();
        document.head.appendChild(script);

        let renderer, scene, camera, earth, clouds, stars, animId;

        function initGlobe() {
          const THREE = window.THREE;
          const W = window.innerWidth, H = window.innerHeight;

          // Renderer
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
          renderer.setSize(W, H);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.1;
          mount.appendChild(renderer.domElement);

          // Scene
          scene = new THREE.Scene();
          scene.background = new THREE.Color(0x000000);

          // Camera
          camera = new THREE.PerspectiveCamera(45, W/H, 0.1, 1000);
          camera.position.z = 2.8;

          // Texture loader
          const loader = new THREE.TextureLoader();
          loader.crossOrigin = 'anonymous';

          // NASA Blue Marble textures (public domain)
          const earthDay   = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg');
          const earthBump  = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg');
          const earthSpec  = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg');
          const earthNight = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png');
          const cloudTex   = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png');

          // Earth sphere
          const earthGeo = new THREE.SphereGeometry(1, 64, 64);
          const earthMat = new THREE.MeshPhongMaterial({
            map:          earthDay,
            bumpMap:      earthBump,
            bumpScale:    0.05,
            specularMap:  earthSpec,
            specular:     new THREE.Color(0x4466aa),
            shininess:    18,
            emissiveMap:  earthNight,
            emissive:     new THREE.Color(0xffeedd),
            emissiveIntensity: 0.6,
          });
          earth = new THREE.Mesh(earthGeo, earthMat);
          earth.rotation.x = 0.28;
          scene.add(earth);

          // Cloud layer
          const cloudGeo = new THREE.SphereGeometry(1.008, 64, 64);
          const cloudMat = new THREE.MeshPhongMaterial({
            map:         cloudTex,
            transparent: true,
            opacity:     0.82,
            depthWrite:  false,
          });
          clouds = new THREE.Mesh(cloudGeo, cloudMat);
          clouds.rotation.x = 0.28;
          scene.add(clouds);

          // Atmosphere glow (additive shell)
          const atmGeo = new THREE.SphereGeometry(1.035, 64, 64);
          const atmMat = new THREE.MeshPhongMaterial({
            color:       new THREE.Color(0x3399ff),
            transparent: true,
            opacity:     0.10,
            side:        THREE.BackSide,
            depthWrite:  false,
          });
          scene.add(new THREE.Mesh(atmGeo, atmMat));

          // Outer atmosphere rim
          const rimGeo = new THREE.SphereGeometry(1.06, 64, 64);
          const rimMat = new THREE.MeshPhongMaterial({
            color:       new THREE.Color(0x1166cc),
            transparent: true,
            opacity:     0.055,
            side:        THREE.BackSide,
            depthWrite:  false,
          });
          scene.add(new THREE.Mesh(rimGeo, rimMat));

          // Stars
          const starVerts = [];
          for (let i = 0; i < 8000; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            const r     = 80 + Math.random() * 120;
            starVerts.push(
              r * Math.sin(phi) * Math.cos(theta),
              r * Math.sin(phi) * Math.sin(theta),
              r * Math.cos(phi)
            );
          }
          const starGeo = new THREE.BufferGeometry();
          starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
          const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true });
          stars = new THREE.Points(starGeo, starMat);
          scene.add(stars);

          // Lighting
          // Sun light (directional — left-top)
          const sunLight = new THREE.DirectionalLight(0xfff5e8, 2.2);
          sunLight.position.set(-3, 1.5, 2);
          scene.add(sunLight);

          // Soft fill (right, dim)
          const fillLight = new THREE.DirectionalLight(0x6699bb, 0.18);
          fillLight.position.set(4, -1, -2);
          scene.add(fillLight);

          // Ambient (night side)
          scene.add(new THREE.AmbientLight(0x111122, 0.8));

          // Resize handler
          const onResize = () => {
            const w = window.innerWidth, h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
          };
          window.addEventListener('resize', onResize);

          // Animate
          const animate = () => {
            animId = requestAnimationFrame(animate);
            earth.rotation.y  += 0.0008;
            clouds.rotation.y += 0.0011;
            renderer.render(scene, camera);
          };
          animate();

          // Store cleanup ref
          mount._cleanup = () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
          };
        }

        return () => {
          document.head.removeChild(script);
          if (mount._cleanup) mount._cleanup();
        };
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

          {/* Three.js WebGL mount */}
          <div ref={mountRef} style={{ position:"absolute", inset:0, zIndex:0 }} />

          {/* Subtle center vignette so card reads */}
          <div style={{ position:"absolute", inset:0, zIndex:1, background:"radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.55) 100%)", pointerEvents:"none" }} />

          {/* Login box */}
          <div className="lg-box" style={{ position:"relative", zIndex:10, width: isMobile ? "calc(100vw - 36px)" : 370, padding: isMobile ? "36px 24px 40px" : "48px 44px" }}>

            <div style={{ marginBottom:32, textAlign:"center" }}>
              <div style={{ width:46, height:46, borderRadius:13, background:"rgba(42,171,255,0.14)", border:"1px solid rgba(42,171,255,0.28)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
                <span style={{ fontSize:18, fontWeight:800, color:"#2AABFF" }}>W</span>
              </div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.38)", letterSpacing:3, textTransform:"uppercase", fontWeight:600, marginBottom:7 }}>Cloud Scenic</div>
              <h1 style={{ fontSize:24, fontWeight:500, color:"#fff", margin:"0 0 5px", letterSpacing:-0.5 }}>War Room</h1>
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>VitalLyfe Content Operations</p>
            </div>

            <div>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.8, textTransform:"uppercase", color:"rgba(255,255,255,0.40)", display:"block", marginBottom:6 }}>Email</label>
              <input className="lg-input" type="email" value={email}
                onChange={e=>setEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="you@cloudscenic.com" />
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:9, fontWeight:700, letterSpacing:1.8, textTransform:"uppercase", color:"rgba(255,255,255,0.40)", display:"block", marginBottom:6 }}>Password</label>
              <input className="lg-input" type="password" value={password}
                onChange={e=>setPassword(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="••••••••" />
            </div>

            {error && (
              <div style={{ fontSize:11, color:"rgba(255,110,100,0.95)", marginBottom:14, padding:"9px 13px", background:"rgba(255,50,50,0.08)", borderRadius:8, border:"1px solid rgba(255,60,60,0.15)" }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading} className="lg-btn">
              {loading ? "Signing in…" : "Enter War Room →"}
            </button>

            <div style={{ marginTop:22, display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:"#2AABFF", animation:"livePulse 2s infinite" }} />
              <span style={{ fontSize:10, color:"rgba(255,255,255,0.26)" }}>7 agents · Live operations</span>
            </div>
          </div>

        </div>
      );
    }

