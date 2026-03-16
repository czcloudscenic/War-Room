      // ── 3D rotating blue grid world ──────────────────────────────────────
      useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let raf, t = 0;

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener("resize", resize);

        // 3D projection helpers
        const project = (x, y, z, W, H, fov, rotX, rotY) => {
          // Rotate around Y axis
          const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
          const x1 = x * cosY - z * sinY;
          const z1 = x * sinY + z * cosY;
          // Rotate around X axis
          const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
          const y1 = y * cosX - z1 * sinX;
          const z2 = y * sinX + z1 * cosX;
          // Perspective projection
          const d = fov / (fov + z2 + 60);
          return { sx: W/2 + x1 * d, sy: H/2 + y1 * d, d, z: z2 };
        };

        const GRID_SIZE = 24;   // grid lines each side
        const GRID_SPAN = 200;  // world units

        const draw = () => {
          t += 0.004;
          const W = canvas.width, H = canvas.height;

          // Deep space black background
          ctx.fillStyle = "#000508";
          ctx.fillRect(0, 0, W, H);

          // Subtle star field
          ctx.save();
          for (let s = 0; s < 120; s++) {
            const sx = ((Math.sin(s * 127.1) * 0.5 + 0.5) * W);
            const sy = ((Math.sin(s * 311.7) * 0.5 + 0.5) * H);
            const sa = 0.2 + 0.3 * Math.abs(Math.sin(s * 0.8 + t * 0.3));
            ctx.beginPath();
            ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(180, 220, 255, ${sa})`;
            ctx.fill();
          }
          ctx.restore();

          // Slow tilt + continuous rotation
          const rotY = t * 0.18;
          const rotX = 0.52 + Math.sin(t * 0.12) * 0.08;
          const fov = Math.min(W, H) * 0.85;

          // ── FLOOR GRID (XZ plane) ────────────────────────────────────────
          const floorY = 40;
          ctx.save();
          for (let i = -GRID_SIZE; i <= GRID_SIZE; i++) {
            const x = (i / GRID_SIZE) * GRID_SPAN;
            const fade = 1 - Math.abs(i / GRID_SIZE);
            const alpha = 0.12 + 0.18 * fade;

            // Line along Z
            const p1 = project(x, floorY, -GRID_SPAN, W, H, fov, rotX, rotY);
            const p2 = project(x, floorY,  GRID_SPAN, W, H, fov, rotX, rotY);
            if (p1.d > 0 && p2.d > 0) {
              ctx.beginPath();
              ctx.moveTo(p1.sx, p1.sy);
              ctx.lineTo(p2.sx, p2.sy);
              ctx.strokeStyle = `rgba(0, 120, 255, ${alpha})`;
              ctx.lineWidth = i === 0 ? 1.2 : 0.5;
              ctx.stroke();
            }

            // Line along X
            const p3 = project(-GRID_SPAN, floorY, x, W, H, fov, rotX, rotY);
            const p4 = project( GRID_SPAN, floorY, x, W, H, fov, rotX, rotY);
            if (p3.d > 0 && p4.d > 0) {
              ctx.beginPath();
              ctx.moveTo(p3.sx, p3.sy);
              ctx.lineTo(p4.sx, p4.sy);
              ctx.strokeStyle = `rgba(0, 120, 255, ${alpha})`;
              ctx.lineWidth = i === 0 ? 1.2 : 0.5;
              ctx.stroke();
            }
          }
          ctx.restore();

          // ── VERTICAL GRID WALLS ──────────────────────────────────────────
          // Front wall (XY plane at Z = -GRID_SPAN)
          ctx.save();
          for (let i = -GRID_SIZE; i <= GRID_SIZE; i++) {
            const pos = (i / GRID_SIZE) * GRID_SPAN;
            const fade = 1 - Math.abs(i / GRID_SIZE);
            const alpha = 0.08 + 0.10 * fade;

            // Vertical lines
            const p1 = project(pos, -GRID_SPAN, -GRID_SPAN, W, H, fov, rotX, rotY);
            const p2 = project(pos,  GRID_SPAN, -GRID_SPAN, W, H, fov, rotX, rotY);
            if (p1.d > 0 && p2.d > 0) {
              ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy);
              ctx.strokeStyle = `rgba(0, 100, 220, ${alpha})`;
              ctx.lineWidth = 0.4; ctx.stroke();
            }
            // Horizontal lines
            const p3 = project(-GRID_SPAN, pos, -GRID_SPAN, W, H, fov, rotX, rotY);
            const p4 = project( GRID_SPAN, pos, -GRID_SPAN, W, H, fov, rotX, rotY);
            if (p3.d > 0 && p4.d > 0) {
              ctx.beginPath(); ctx.moveTo(p3.sx, p3.sy); ctx.lineTo(p4.sx, p4.sy);
              ctx.strokeStyle = `rgba(0, 100, 220, ${alpha})`;
              ctx.lineWidth = 0.4; ctx.stroke();
            }
          }
          ctx.restore();

          // ── GLOWING GRID INTERSECTIONS ───────────────────────────────────
          ctx.save();
          const step = Math.floor(GRID_SIZE / 6);
          for (let ix = -GRID_SIZE; ix <= GRID_SIZE; ix += step) {
            for (let iz = -GRID_SIZE; iz <= GRID_SIZE; iz += step) {
              const x = (ix / GRID_SIZE) * GRID_SPAN;
              const z = (iz / GRID_SIZE) * GRID_SPAN;
              const p = project(x, floorY, z, W, H, fov, rotX, rotY);
              if (p.d > 0.2) {
                const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + ix * 0.4 + iz * 0.3));
                const a = pulse * 0.6 * p.d;
                ctx.beginPath();
                ctx.arc(p.sx, p.sy, 2 * p.d, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(80, 180, 255, ${a})`;
                ctx.fill();
              }
            }
          }
          ctx.restore();

          // ── HORIZON GLOW ─────────────────────────────────────────────────
          const hGrad = ctx.createLinearGradient(0, H * 0.35, 0, H * 0.65);
          const ha = 0.055 + 0.02 * Math.sin(t * 0.3);
          hGrad.addColorStop(0,   "transparent");
          hGrad.addColorStop(0.5, `rgba(0, 100, 255, ${ha})`);
          hGrad.addColorStop(1,   "transparent");
          ctx.fillStyle = hGrad;
          ctx.fillRect(0, 0, W, H);

          // ── SCAN LINE (moving bright line sweeping the floor) ────────────
          const scanZ = (Math.sin(t * 0.4) * 0.5 + 0.5) * GRID_SPAN * 2 - GRID_SPAN;
          ctx.save();
          for (let x = -GRID_SPAN; x <= GRID_SPAN; x += 8) {
            const p = project(x, floorY, scanZ, W, H, fov, rotX, rotY);
            if (p.d > 0) {
              ctx.beginPath();
              ctx.arc(p.sx, p.sy, 1.5 * p.d, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(100, 200, 255, ${0.5 * p.d})`;
              ctx.fill();
            }
          }
          ctx.restore();

          // ── FLOATING DATA NODES ──────────────────────────────────────────
          ctx.save();
          for (let n = 0; n < 18; n++) {
            const angle = n * (Math.PI * 2 / 18) + t * 0.08;
            const radius = 80 + (n % 3) * 40;
            const nx = Math.cos(angle) * radius;
            const ny = -30 + Math.sin(n * 1.7 + t * 0.2) * 25;
            const nz = Math.sin(angle) * radius;
            const p = project(nx, ny, nz, W, H, fov, rotX, rotY);
            if (p.d > 0.1) {
              const pulse = 0.5 + 0.5 * Math.sin(t * 2 + n * 0.8);
              const a = pulse * 0.7 * Math.min(p.d, 1);
              const r = (3 + (n % 3)) * p.d;
              // Outer glow
              const grd = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4);
              grd.addColorStop(0,   `rgba(0, 180, 255, ${a * 0.4})`);
              grd.addColorStop(1,   "transparent");
              ctx.fillStyle = grd;
              ctx.beginPath();
              ctx.arc(p.sx, p.sy, r * 4, 0, Math.PI * 2);
              ctx.fill();
              // Core dot
              ctx.beginPath();
              ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(120, 220, 255, ${a})`;
              ctx.fill();
            }
          }
          ctx.restore();

          // ── DEEP VIGNETTE ────────────────────────────────────────────────
          const vig = ctx.createRadialGradient(W/2, H/2, W * 0.1, W/2, H/2, W * 0.75);
          vig.addColorStop(0,   "transparent");
          vig.addColorStop(0.5, "rgba(0, 3, 10, 0.15)");
          vig.addColorStop(1,   "rgba(0, 3, 10, 0.82)");
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, W, H);

          raf = requestAnimationFrame(draw);
        };

        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
      }, [isMobile]);
