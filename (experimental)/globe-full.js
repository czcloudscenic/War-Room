      // ── Cinematic rotating globe ─────────────────────────────────────────
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let raf, t = 0;
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener("resize", resize);

        // Globe geometry — lat/lon grid points
        const VERTS = [];
        const LAT_SEGS = 28, LON_SEGS = 52;
        for (let la = 0; la <= LAT_SEGS; la++) {
          for (let lo = 0; lo <= LON_SEGS; lo++) {
            const lat = (la / LAT_SEGS) * Math.PI - Math.PI/2;
            const lon = (lo / LON_SEGS) * Math.PI * 2;
            VERTS.push({ lat, lon, lo, la });
          }
        }

        // Continent mask — simplified continent dots using lat/lon
        const inContinent = (lat, lon) => {
          const la = lat * 180/Math.PI, lo = ((lon * 180/Math.PI) + 360) % 360;
          // North America
          if (la > 10 && la < 72 && lo > 230 && lo < 300) return true;
          // South America
          if (la > -55 && la < 12 && lo > 285 && lo < 320) return true;
          // Europe
          if (la > 35 && la < 70 && lo > 345 || (la > 35 && la < 70 && lo < 40)) return true;
          // Africa
          if (la > -35 && la < 37 && lo > 340 || (la > -35 && la < 37 && lo < 52)) return true;
          // Asia
          if (la > 5 && la < 75 && lo > 40 && lo < 145) return true;
          // Australia
          if (la > -40 && la < -10 && lo > 115 && lo < 155) return true;
          return false;
        };

        // Stars
        const STARS = Array.from({ length: 200 }, () => ({
          x: Math.random(), y: Math.random(),
          r: Math.random() * 1.2 + 0.2,
          a: Math.random() * 0.6 + 0.1,
          ph: Math.random() * Math.PI * 2,
        }));

        const draw = () => {
          t += 0.003;
          const W = canvas.width, H = canvas.height;
          const cx = W * 0.5, cy = H * 0.5;
          const R = Math.min(W, H) * (isMobile ? 0.42 : 0.38);

          // Deep space background
          const bg = ctx.createRadialGradient(cx, cy*0.9, 0, cx, cy, Math.max(W,H)*0.85);
          bg.addColorStop(0,   "#040d0f");
          bg.addColorStop(0.4, "#020a0c");
          bg.addColorStop(1,   "#010507");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, W, H);

          // Stars
          STARS.forEach(s => {
            const twinkle = s.a * (0.5 + 0.5 * Math.sin(t * 1.2 + s.ph));
            ctx.beginPath();
            ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(200,230,255,${twinkle})`;
            ctx.fill();
          });

          // Globe rotation
          const rotY = t * 0.12;
          const tiltX = 0.22;

          // Project 3D sphere point to 2D
          const project3D = (lat, lon) => {
            const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
            const cosLon = Math.cos(lon + rotY), sinLon = Math.sin(lon + rotY);
            // Sphere coords
            let x = cosLat * sinLon;
            let y = sinLat;
            let z = cosLat * cosLon;
            // Tilt around X
            const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
            const z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
            return { sx: cx + x * R, sy: cy - y2 * R, z: z2, vis: z2 > -0.15 };
          };

          // ── ATMOSPHERE GLOW (outer rim) ──────────────────────────────────
          // Deep outer glow
          const atmO = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.32);
          atmO.addColorStop(0,   "rgba(30, 160, 120, 0.22)");
          atmO.addColorStop(0.4, "rgba(20, 120, 90,  0.10)");
          atmO.addColorStop(0.8, "rgba(10, 80,  60,  0.04)");
          atmO.addColorStop(1,   "transparent");
          ctx.fillStyle = atmO;
          ctx.beginPath();
          ctx.arc(cx, cy, R * 1.32, 0, Math.PI*2);
          ctx.fill();

          // Inner bright rim
          const atmI = ctx.createRadialGradient(cx - R*0.1, cy - R*0.1, R * 0.7, cx, cy, R * 1.08);
          atmI.addColorStop(0,   "transparent");
          atmI.addColorStop(0.8, "rgba(40, 200, 150, 0.08)");
          atmI.addColorStop(0.95,"rgba(60, 220, 170, 0.25)");
          atmI.addColorStop(1,   "rgba(80, 240, 190, 0.08)");
          ctx.fillStyle = atmI;
          ctx.beginPath();
          ctx.arc(cx, cy, R * 1.08, 0, Math.PI*2);
          ctx.fill();

          // ── GLOBE BASE (ocean) ────────────────────────────────────────────
          const oceanGrad = ctx.createRadialGradient(cx - R*0.25, cy - R*0.25, 0, cx, cy, R);
          oceanGrad.addColorStop(0,   "#1a6b55");
          oceanGrad.addColorStop(0.4, "#0e4a3a");
          oceanGrad.addColorStop(0.8, "#082e24");
          oceanGrad.addColorStop(1,   "#041a14");
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.clip();
          ctx.fillStyle = oceanGrad;
          ctx.fillRect(cx - R, cy - R, R*2, R*2);
          ctx.restore();

          // ── CONTINENT DOTS ────────────────────────────────────────────────
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.clip();
          const step = 3.2;
          for (let la = -90; la <= 90; la += step) {
            for (let lo = 0; lo < 360; lo += step / Math.max(0.2, Math.cos(la * Math.PI/180))) {
              const lat = la * Math.PI/180;
              const lon = lo * Math.PI/180;
              if (!inContinent(lat, lon)) continue;
              const p = project3D(lat, lon);
              if (!p.vis) continue;
              const depth = (p.z + 1) / 2;
              const bright = 0.3 + depth * 0.5;
              const pulse = 0.85 + 0.15 * Math.sin(t * 0.8 + la * 0.1 + lo * 0.05);
              const sz = 1.2 + depth * 0.8;
              ctx.beginPath();
              ctx.arc(p.sx, p.sy, sz * pulse, 0, Math.PI*2);
              // Teal-green continent color matching reference
              ctx.fillStyle = `rgba(${Math.floor(40 + depth*80)}, ${Math.floor(160 + depth*60)}, ${Math.floor(100 + depth*40)}, ${bright * 0.85})`;
              ctx.fill();
            }
          }
          ctx.restore();

          // ── LAT/LON GRID LINES ────────────────────────────────────────────
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.clip();
          // Latitude circles
          for (let la = -75; la <= 75; la += 15) {
            const lat = la * Math.PI/180;
            ctx.beginPath();
            let first = true;
            for (let lo = 0; lo <= 360; lo += 3) {
              const p = project3D(lat, lo * Math.PI/180);
              if (!p.vis) { first = true; continue; }
              if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
              else ctx.lineTo(p.sx, p.sy);
            }
            ctx.strokeStyle = "rgba(60,200,140,0.06)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          // Longitude lines
          for (let lo = 0; lo < 360; lo += 15) {
            const lon = lo * Math.PI/180;
            ctx.beginPath();
            let first = true;
            for (let la = -90; la <= 90; la += 3) {
              const p = project3D(la * Math.PI/180, lon);
              if (!p.vis) { first = true; continue; }
              if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
              else ctx.lineTo(p.sx, p.sy);
            }
            ctx.strokeStyle = "rgba(60,200,140,0.06)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
          ctx.restore();

          // ── SPECULAR HIGHLIGHT (sun reflection) ───────────────────────────
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.clip();
          const spec = ctx.createRadialGradient(cx - R*0.35, cy - R*0.35, 0, cx - R*0.2, cy - R*0.2, R * 0.7);
          spec.addColorStop(0,   "rgba(200,255,230,0.12)");
          spec.addColorStop(0.4, "rgba(120,220,180,0.06)");
          spec.addColorStop(1,   "transparent");
          ctx.fillStyle = spec;
          ctx.fillRect(cx-R, cy-R, R*2, R*2);
          ctx.restore();

          // ── TERMINATOR SHADOW (night side) ────────────────────────────────
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.clip();
          const shadow = ctx.createRadialGradient(cx + R*0.4, cy + R*0.1, 0, cx + R*0.2, cy, R*1.1);
          shadow.addColorStop(0,   "rgba(0,0,0,0.75)");
          shadow.addColorStop(0.5, "rgba(0,0,0,0.45)");
          shadow.addColorStop(0.8, "rgba(0,0,0,0.1)");
          shadow.addColorStop(1,   "transparent");
          ctx.fillStyle = shadow;
          ctx.fillRect(cx-R, cy-R, R*2, R*2);
          ctx.restore();

          // ── ATMOSPHERE EDGE HIGHLIGHT ─────────────────────────────────────
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(60, 200, 150, ${0.35 + 0.08 * Math.sin(t * 0.5)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Second softer glow ring
          ctx.beginPath();
          ctx.arc(cx, cy, R * 1.012, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(40, 170, 130, ${0.15 + 0.05 * Math.sin(t * 0.4)})`;
          ctx.lineWidth = 3;
          ctx.stroke();

          // ── DEEP VIGNETTE ──────────────────────────────────────────────────
          const vig = ctx.createRadialGradient(cx, cy, R*0.5, cx, cy, Math.max(W,H)*0.75);
          vig.addColorStop(0,   "transparent");
          vig.addColorStop(0.6, "rgba(1,5,4,0.15)");
          vig.addColorStop(1,   "rgba(1,5,4,0.90)");
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, W, H);

          raf = requestAnimationFrame(draw);
        };

        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
      }, [isMobile]);
