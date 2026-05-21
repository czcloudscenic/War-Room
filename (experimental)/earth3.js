
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
