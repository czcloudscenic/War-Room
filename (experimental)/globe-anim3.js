
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
