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
