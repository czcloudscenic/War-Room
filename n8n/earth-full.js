      // ── Photorealistic rotating Earth ───────────────────────────────────
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let raf, t = 0;
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        // Real continent outlines — simplified lat/lon polygons (degrees)
        // Each entry: array of [lon, lat] points
        const CONTINENTS = {
          northAmerica: [
            [-168,72],[-140,72],[-125,60],[-123,49],[-117,32],[-110,23],[-84,10],
            [-77,8],[-75,12],[-65,18],[-60,15],[-62,10],[-65,2],[-75,0],[-78,2],
            [-80,8],[-84,10],[-88,16],[-92,20],[-97,26],[-80,40],[-75,45],
            [-70,47],[-55,47],[-60,45],[-65,44],[-70,43],[-75,42],[-80,43],
            [-83,45],[-86,46],[-88,48],[-92,52],[-95,55],[-100,60],[-110,60],
            [-120,60],[-130,55],[-140,60],[-148,60],[-155,58],[-160,60],[-168,72]
          ],
          southAmerica: [
            [-80,10],[-75,12],[-62,10],[-60,6],[-52,4],[-50,0],[-48,-2],[-35,-5],
            [-35,-10],[-38,-15],[-40,-22],[-43,-23],[-45,-28],[-48,-28],[-50,-32],
            [-52,-33],[-58,-38],[-62,-45],[-65,-55],[-68,-55],[-72,-50],[-72,-45],
            [-70,-40],[-70,-35],[-72,-30],[-70,-20],[-75,-10],[-78,-5],[-80,0],
            [-80,10]
          ],
          europe: [
            [-10,36],[0,36],[5,40],[10,44],[15,42],[18,40],[20,38],[28,36],[35,36],
            [28,42],[30,46],[25,48],[22,52],[20,56],[18,60],[15,62],[10,62],[5,58],
            [0,52],[-5,48],[-8,44],[-10,36]
          ],
          africa: [
            [-18,15],[0,15],[10,15],[20,15],[30,12],[42,12],[50,12],[44,10],[42,2],
            [40,-2],[36,-20],[34,-30],[28,-35],[18,-35],[15,-30],[12,-18],[10,-5],
            [8,4],[2,6],[-5,5],[-16,10],[-18,15]
          ],
          asia: [
            [25,70],[60,72],[100,72],[140,72],[170,64],[180,68],[170,60],[165,55],
            [155,52],[145,45],[135,35],[130,32],[122,30],[120,25],[110,20],[105,10],
            [100,2],[100,-5],[105,-8],[110,-8],[115,0],[120,5],[125,10],[130,15],
            [135,20],[140,30],[145,35],[150,42],[155,48],[160,52],[165,60],[170,64],
            [160,70],[140,72],[100,72],[80,72],[60,70],[42,68],[35,60],[28,55],
            [22,58],[20,60],[18,60],[22,62],[28,65],[35,68],[42,70],[50,72],[60,72]
          ],
          australia: [
            [115,-22],[118,-20],[122,-18],[130,-12],[136,-12],[138,-15],[140,-18],
            [142,-22],[148,-22],[152,-25],[154,-28],[152,-32],[150,-36],[148,-38],
            [146,-40],[142,-38],[138,-35],[130,-32],[125,-30],[115,-28],[114,-24],
            [115,-22]
          ],
          greenland: [
            [-55,76],[-30,76],[-20,76],[-18,72],[-22,68],[-30,65],[-42,62],
            [-52,62],[-58,65],[-62,68],[-60,72],[-55,76]
          ],
          antarctica: [
            [0,-70],[60,-68],[120,-68],[180,-70],[240,-68],[300,-70],[360,-70],
            [300,-75],[240,-75],[180,-76],[120,-75],[60,-75],[0,-70]
          ],
        };

        // Stars
        const STARS = Array.from({ length: 250 }, () => ({
          x: Math.random(), y: Math.random(),
          r: Math.random() * 1.1 + 0.2,
          a: Math.random() * 0.55 + 0.08,
          ph: Math.random() * Math.PI * 2,
        }));

        // Project lon/lat (degrees) onto sphere
        const sphereProject = (lonDeg, latDeg, rotY, tiltX, cx, cy, R) => {
          const lon = lonDeg * Math.PI / 180;
          const lat = latDeg * Math.PI / 180;
          const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
          const cosLon = Math.cos(lon + rotY), sinLon = Math.sin(lon + rotY);
          let x = cosLat * sinLon;
          let y = sinLat;
          let z = cosLat * cosLon;
          const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
          const z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
          return { sx: cx + x * R, sy: cy - y2 * R, z: z2, vis: z2 > -0.1 };
        };

        const draw = () => {
          t += 0.0025;
          const W = canvas.width, H = canvas.height;
          const cx = W * 0.5, cy = H * 0.5;
          const R = Math.min(W, H) * (isMobile ? 0.42 : 0.38);
          const rotY = t * 0.10;
          const tiltX = 0.28 + Math.sin(t * 0.06) * 0.03;

          // Deep space
          ctx.fillStyle = '#000308';
          ctx.fillRect(0, 0, W, H);

          // Stars
          STARS.forEach(s => {
            const a = s.a * (0.5 + 0.5 * Math.sin(t * 0.7 + s.ph));
            ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(220,235,255,${a})`; ctx.fill();
          });

          // ── Outer atmosphere haze ─────────────────────────────────────────
          const atmOuter = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.28);
          atmOuter.addColorStop(0,   'rgba(100, 160, 255, 0.18)');
          atmOuter.addColorStop(0.4, 'rgba(60,  120, 220, 0.08)');
          atmOuter.addColorStop(0.8, 'rgba(30,  80,  180, 0.03)');
          atmOuter.addColorStop(1,   'transparent');
          ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, Math.PI*2);
          ctx.fillStyle = atmOuter; ctx.fill();

          // ── Ocean base (sphere fill) ───────────────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          const oceanGrad = ctx.createRadialGradient(cx - R*0.3, cy - R*0.3, 0, cx, cy, R);
          oceanGrad.addColorStop(0,   '#1a5fa0');
          oceanGrad.addColorStop(0.35,'#154d8c');
          oceanGrad.addColorStop(0.65,'#0d3366');
          oceanGrad.addColorStop(0.85,'#082244');
          oceanGrad.addColorStop(1,   '#040e22');
          ctx.fillStyle = oceanGrad;
          ctx.fillRect(cx - R, cy - R, R*2, R*2);
          ctx.restore();

          // ── Ice caps (poles) ───────────────────────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          [80, -75].forEach(latDeg => {
            const isNorth = latDeg > 0;
            const capPts = [];
            for (let lo = 0; lo <= 360; lo += 4) {
              const p = sphereProject(lo, latDeg, rotY, tiltX, cx, cy, R);
              if (p.vis) capPts.push(p);
            }
            if (capPts.length > 2) {
              ctx.beginPath();
              ctx.moveTo(capPts[0].sx, capPts[0].sy);
              capPts.forEach(p => ctx.lineTo(p.sx, p.sy));
              // Fill toward pole
              const pole = sphereProject(0, isNorth ? 90 : -90, rotY, tiltX, cx, cy, R);
              if (pole.vis) ctx.lineTo(pole.sx, pole.sy);
              ctx.closePath();
              ctx.fillStyle = 'rgba(220, 235, 255, 0.82)';
              ctx.fill();
            }
          });
          ctx.restore();

          // ── Continents ────────────────────────────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();

          Object.entries(CONTINENTS).forEach(([name, pts]) => {
            // Check if majority of points are visible
            let vis = 0;
            pts.forEach(([lo, la]) => { if (sphereProject(lo, la, rotY, tiltX, cx, cy, R).vis) vis++; });
            if (vis < 3) return;

            ctx.beginPath();
            let started = false;
            pts.forEach(([lo, la]) => {
              const p = sphereProject(lo, la, rotY, tiltX, cx, cy, R);
              if (!p.vis) { started = false; return; }
              if (!started) { ctx.moveTo(p.sx, p.sy); started = true; }
              else ctx.lineTo(p.sx, p.sy);
            });
            ctx.closePath();

            // Realistic continent colors
            const isIce = name === 'greenland' || name === 'antarctica';
            if (isIce) {
              ctx.fillStyle = 'rgba(215, 230, 255, 0.88)';
            } else {
              // Green-brown land mass
              const cg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
              cg.addColorStop(0,   'rgba(80,  130, 55, 0.92)');
              cg.addColorStop(0.4, 'rgba(100, 140, 60, 0.90)');
              cg.addColorStop(0.7, 'rgba(140, 120, 60, 0.88)');
              cg.addColorStop(1,   'rgba(110, 100, 50, 0.85)');
              ctx.fillStyle = cg;
            }
            ctx.fill();

            // Subtle land border
            ctx.strokeStyle = isIce ? 'rgba(200,220,255,0.3)' : 'rgba(60,90,30,0.4)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          });
          ctx.restore();

          // ── Cloud wisps ───────────────────────────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          const cloudBands = [
            { lat: 55, lonOff: 0.8,  width: 18, alpha: 0.28 },
            { lat: 40, lonOff: 1.6,  width: 22, alpha: 0.22 },
            { lat: 20, lonOff: 3.0,  width: 14, alpha: 0.18 },
            { lat: -5, lonOff: 2.2,  width: 16, alpha: 0.20 },
            { lat:-30, lonOff: 0.4,  width: 20, alpha: 0.24 },
            { lat:-50, lonOff: 1.2,  width: 24, alpha: 0.26 },
          ];
          cloudBands.forEach(cb => {
            const pts = [];
            for (let lo = -180; lo <= 180; lo += 3) {
              const p1 = sphereProject(lo, cb.lat - cb.width/2, rotY + cb.lonOff, tiltX, cx, cy, R * 0.99);
              const p2 = sphereProject(lo, cb.lat + cb.width/2, rotY + cb.lonOff, tiltX, cx, cy, R * 0.99);
              if (p1.vis) pts.push({ top: p1, bot: p2 });
            }
            if (pts.length > 2) {
              ctx.beginPath();
              ctx.moveTo(pts[0].top.sx, pts[0].top.sy);
              pts.forEach(p => ctx.lineTo(p.top.sx, p.top.sy));
              for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].bot.sx, pts[i].bot.sy);
              ctx.closePath();
              ctx.fillStyle = `rgba(255,255,255,${cb.alpha})`;
              ctx.fill();
            }
          });
          ctx.restore();

          // ── Specular highlight (sun glint on ocean) ────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          const spec = ctx.createRadialGradient(cx - R*0.32, cy - R*0.32, 0, cx - R*0.15, cy - R*0.15, R * 0.65);
          spec.addColorStop(0,   'rgba(255,255,255,0.14)');
          spec.addColorStop(0.3, 'rgba(200,220,255,0.07)');
          spec.addColorStop(0.7, 'rgba(150,190,255,0.03)');
          spec.addColorStop(1,   'transparent');
          ctx.fillStyle = spec; ctx.fillRect(cx-R, cy-R, R*2, R*2);
          ctx.restore();

          // ── Night side shadow (terminator) ─────────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          const shadow = ctx.createRadialGradient(cx + R*0.42, cy + R*0.08, 0, cx + R*0.18, cy, R*1.05);
          shadow.addColorStop(0,   'rgba(0,0,0,0.88)');
          shadow.addColorStop(0.4, 'rgba(0,0,0,0.60)');
          shadow.addColorStop(0.7, 'rgba(0,0,0,0.18)');
          shadow.addColorStop(0.9, 'rgba(0,0,0,0.04)');
          shadow.addColorStop(1,   'transparent');
          ctx.fillStyle = shadow; ctx.fillRect(cx-R, cy-R, R*2, R*2);
          ctx.restore();

          // ── Atmosphere inner glow (thin blue ring) ─────────────────────────
          const atmInner = ctx.createRadialGradient(cx, cy, R * 0.88, cx, cy, R * 1.04);
          atmInner.addColorStop(0,    'transparent');
          atmInner.addColorStop(0.65, `rgba(80,160,255,${0.18 + 0.05*Math.sin(t*0.4)})`);
          atmInner.addColorStop(0.88, `rgba(120,190,255,${0.32 + 0.06*Math.sin(t*0.4)})`);
          atmInner.addColorStop(1,    'rgba(80,150,255,0.08)');
          ctx.beginPath(); ctx.arc(cx, cy, R*1.04, 0, Math.PI*2);
          ctx.fillStyle = atmInner; ctx.fill();

          // Hard rim
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(100,170,255,${0.55 + 0.08*Math.sin(t*0.5)})`;
          ctx.lineWidth = 1.0; ctx.stroke();

          // ── Deep vignette ──────────────────────────────────────────────────
          const vig = ctx.createRadialGradient(cx, cy, R*0.5, cx, cy, Math.max(W,H)*0.78);
          vig.addColorStop(0,    'transparent');
          vig.addColorStop(0.55, 'rgba(0,3,10,0.12)');
          vig.addColorStop(1,    'rgba(0,3,10,0.90)');
          ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

          raf = requestAnimationFrame(draw);
        };

        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
      }, [isMobile]);
