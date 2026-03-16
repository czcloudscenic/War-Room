
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
