      // ── TRON Legacy sphere — Vantus blue ──────────────────────────────
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let raf, t = 0;
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener("resize", resize);

        // Star field
        const STARS = Array.from({ length: 180 }, () => ({
          x: Math.random(), y: Math.random(),
          r: Math.random() * 1.0 + 0.2,
          a: Math.random() * 0.5 + 0.1,
          ph: Math.random() * Math.PI * 2,
        }));

        // Sphere geometry — lat/lon grid
        const LAT_LINES = 14, LON_LINES = 24;

        // Project 3D point on unit sphere to screen
        const project = (lat, lon, rotY, tiltX, cx, cy, R) => {
          const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
          const cosLon = Math.cos(lon + rotY), sinLon = Math.sin(lon + rotY);
          let x = cosLat * sinLon;
          let y = sinLat;
          let z = cosLat * cosLon;
          // Tilt
          const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
          const z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
          return { sx: cx + x * R, sy: cy - y2 * R, z: z2, vis: z2 > -0.08 };
        };

        // Flowing data particles on sphere surface
        const PARTICLES = Array.from({ length: isMobile ? 60 : 120 }, () => ({
          lat: (Math.random() - 0.5) * Math.PI,
          lon: Math.random() * Math.PI * 2,
          vLon: (Math.random() * 0.004 + 0.001) * (Math.random() > 0.5 ? 1 : -1),
          vLat: (Math.random() * 0.002 - 0.001),
          size: Math.random() * 1.8 + 0.5,
          ph: Math.random() * Math.PI * 2,
          trail: [],
        }));

        const draw = () => {
          t += 0.004;
          const W = canvas.width, H = canvas.height;
          const cx = W * 0.5, cy = H * 0.5;
          const R = Math.min(W, H) * (isMobile ? 0.40 : 0.36);
          const rotY = t * 0.14;
          const tiltX = 0.30 + Math.sin(t * 0.08) * 0.04;

          // ── Pure black background ──────────────────────────────────────────
          ctx.fillStyle = "#000408";
          ctx.fillRect(0, 0, W, H);

          // ── Stars ──────────────────────────────────────────────────────────
          STARS.forEach(s => {
            const a = s.a * (0.5 + 0.5 * Math.sin(t * 0.8 + s.ph));
            ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(160,210,255,${a})`; ctx.fill();
          });

          // ── Outer glow rings (TRON energy rings) ──────────────────────────
          for (let ring = 0; ring < 3; ring++) {
            const rr = R * (1.04 + ring * 0.035);
            const alpha = (0.18 - ring * 0.055) * (0.7 + 0.3 * Math.sin(t * 0.4 + ring));
            ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(42,171,255,${alpha})`;
            ctx.lineWidth = ring === 0 ? 1.5 : 0.6;
            ctx.stroke();
          }

          // ── Solid sphere base (very dark, just enough to read against) ────
          const sphereGrad = ctx.createRadialGradient(cx - R*0.3, cy - R*0.3, 0, cx, cy, R);
          sphereGrad.addColorStop(0,   "rgba(5, 20, 40, 0.85)");
          sphereGrad.addColorStop(0.6, "rgba(2, 10, 22, 0.90)");
          sphereGrad.addColorStop(1,   "rgba(0, 4, 12, 0.95)");
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          ctx.fillStyle = sphereGrad; ctx.fillRect(cx-R, cy-R, R*2, R*2);
          ctx.restore();

          // ── LAT/LON GRID — TRON wireframe ─────────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();

          // Latitude lines
          for (let li = 1; li < LAT_LINES; li++) {
            const lat = (li / LAT_LINES) * Math.PI - Math.PI/2;
            const isEquator = li === Math.floor(LAT_LINES/2);
            const isTropic  = li === Math.floor(LAT_LINES/4) || li === Math.floor(LAT_LINES*3/4);
            const baseAlpha = isEquator ? 0.55 : isTropic ? 0.30 : 0.12;
            const lw        = isEquator ? 1.2 : isTropic ? 0.8 : 0.4;

            ctx.beginPath();
            let first = true, penDown = false;
            for (let lo = 0; lo <= 360; lo += 2) {
              const p = project(lat, lo * Math.PI/180, rotY, tiltX, cx, cy, R);
              if (!p.vis) { first = true; penDown = false; continue; }
              if (first) { ctx.moveTo(p.sx, p.sy); first = false; penDown = true; }
              else ctx.lineTo(p.sx, p.sy);
            }
            if (penDown) {
              ctx.strokeStyle = `rgba(42,171,255,${baseAlpha})`;
              ctx.lineWidth = lw; ctx.stroke();
            }
          }

          // Longitude lines
          for (let li = 0; li < LON_LINES; li++) {
            const lon = (li / LON_LINES) * Math.PI * 2;
            const isPrime = li === 0 || li === LON_LINES/2;
            const baseAlpha = isPrime ? 0.50 : 0.12;
            const lw        = isPrime ? 1.1 : 0.4;

            ctx.beginPath();
            let first = true;
            for (let la = -90; la <= 90; la += 2) {
              const p = project(la * Math.PI/180, lon, rotY, tiltX, cx, cy, R);
              if (!p.vis) { first = true; continue; }
              if (first) { ctx.moveTo(p.sx, p.sy); first = false; }
              else ctx.lineTo(p.sx, p.sy);
            }
            ctx.strokeStyle = `rgba(42,171,255,${baseAlpha})`;
            ctx.lineWidth = lw; ctx.stroke();
          }
          ctx.restore();

          // ── INTERSECTION DOTS (grid nodes glow) ───────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          for (let li = 1; li < LAT_LINES; li++) {
            for (let lo = 0; lo < LON_LINES; lo++) {
              const lat = (li / LAT_LINES) * Math.PI - Math.PI/2;
              const lon = (lo / LON_LINES) * Math.PI * 2;
              const p = project(lat, lon, rotY, tiltX, cx, cy, R);
              if (!p.vis) continue;
              const depth = (p.z + 1) / 2;
              const pulse = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.2 + li * 0.5 + lo * 0.3));
              const a = depth * pulse * 0.65;
              const r = (0.8 + depth * 1.0) * pulse;
              ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI*2);
              ctx.fillStyle = `rgba(42,171,255,${a})`; ctx.fill();
            }
          }
          ctx.restore();

          // ── DATA STREAM PARTICLES flowing on surface ──────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          PARTICLES.forEach(pt => {
            pt.lon += pt.vLon;
            pt.lat += pt.vLat;
            if (pt.lat >  Math.PI/2 - 0.1) pt.vLat *= -1;
            if (pt.lat < -Math.PI/2 + 0.1) pt.vLat *= -1;

            const p = project(pt.lat, pt.lon, rotY, tiltX, cx, cy, R * 0.995);
            if (!p.vis) return;

            const depth = (p.z + 1) / 2;
            const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + pt.ph);
            const a = depth * pulse * 0.9;

            // Bright core dot
            ctx.beginPath(); ctx.arc(p.sx, p.sy, pt.size * depth, 0, Math.PI*2);
            ctx.fillStyle = `rgba(42,171,255,${a})`; ctx.fill();

            // Tiny glow halo
            const grd = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, pt.size * depth * 4);
            grd.addColorStop(0, `rgba(42,171,255,${a * 0.4})`);
            grd.addColorStop(1, "transparent");
            ctx.beginPath(); ctx.arc(p.sx, p.sy, pt.size * depth * 4, 0, Math.PI*2);
            ctx.fillStyle = grd; ctx.fill();
          });
          ctx.restore();

          // ── SPECULAR — light glint top-left ───────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          const spec = ctx.createRadialGradient(cx - R*0.38, cy - R*0.38, 0, cx - R*0.2, cy - R*0.2, R * 0.6);
          spec.addColorStop(0,   "rgba(180, 230, 255, 0.07)");
          spec.addColorStop(0.5, "rgba(80, 160, 255, 0.03)");
          spec.addColorStop(1,   "transparent");
          ctx.fillStyle = spec; ctx.fillRect(cx-R, cy-R, R*2, R*2);
          ctx.restore();

          // ── TRON RIM LIGHT — sharp glowing edge ────────────────────────────
          const rimPulse = 0.7 + 0.3 * Math.sin(t * 0.5);
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(42,171,255,${0.75 * rimPulse})`;
          ctx.lineWidth = 2.0; ctx.stroke();

          // Soft outer bloom
          ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(42,171,255,${0.20 * rimPulse})`;
          ctx.lineWidth = 6; ctx.stroke();

          ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(42,171,255,${0.06 * rimPulse})`;
          ctx.lineWidth = 12; ctx.stroke();

          // ── NIGHT SIDE SHADOW (terminator) ────────────────────────────────
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.clip();
          const shadow = ctx.createRadialGradient(cx + R*0.45, cy + R*0.05, 0, cx + R*0.2, cy, R*1.1);
          shadow.addColorStop(0,   "rgba(0,0,0,0.80)");
          shadow.addColorStop(0.45,"rgba(0,0,0,0.50)");
          shadow.addColorStop(0.75,"rgba(0,0,0,0.15)");
          shadow.addColorStop(1,   "transparent");
          ctx.fillStyle = shadow; ctx.fillRect(cx-R, cy-R, R*2, R*2);
          ctx.restore();

          // ── DEEP VIGNETTE ─────────────────────────────────────────────────
          const vig = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, Math.max(W,H) * 0.8);
          vig.addColorStop(0,    "transparent");
          vig.addColorStop(0.55, "rgba(0,4,12,0.12)");
          vig.addColorStop(1,    "rgba(0,4,12,0.88)");
          ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

          raf = requestAnimationFrame(draw);
        };

        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
      }, [isMobile]);
