
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
