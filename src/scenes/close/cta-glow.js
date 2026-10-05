// La píldora «enciende» el mar: reflejo verde cortado por las olas debajo del botón (trazos horizontales que
// titilan, como el camino del sol) y un resplandor blando. Después del golpe final, latidos de «ping» suaves.
import { E, clamp, prog, TAU } from '../../engine/ease.js';
import { PAL } from '../../engine/color.js';
import { rad, rrectPath, sparkle } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { beatPulse } from '../../engine/time.js';
import { ca } from '../../art/util.js';
import { ctaBox, ctaOpen, ringRect } from './cta.js';
import { T_CTA, T_FIN, BEAT } from './layout.js';

const PINGS = [T_FIN + BEAT, T_FIN + 2 * BEAT, T_FIN + 3 * BEAT]; // un latido por beat hasta el final

export function drawCtaGlow(ctx, t, G) {
  const on = clamp((t - T_CTA + 0.06) / 0.18);
  if (on <= 0) return;
  const B = ctaBox(G.cta.x, G.cta.y, G.cta.h);
  const w = B.h + (B.w - B.h) * clamp(ctaOpen(t), 0, 1.2);
  const hit = t >= T_FIN ? Math.exp(-(t - T_FIN) * 2.5) : 0;
  const kick = beatPulse(t, { from: T_CTA, every: 1, decay: 0.14 });
  const k = on * (0.75 + 0.25 * Math.sin(t * 2.3) + 0.8 * hit + 0.45 * kick);
  const y0 = B.y + B.h / 2 + 10;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // resplandor sobre el agua
  ctx.save();
  ctx.translate(B.x, y0 + 40);
  ctx.scale(1, 0.22);
  const R = w * 0.62;
  ctx.fillStyle = rad(ctx, 0, 0, R, [[0, ca(PAL.wa, 0.34 * k)], [0.5, ca(PAL.wa, 0.12 * k)], [1, ca(PAL.wa, 0)]]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  // reflejo partido por las olas: trazos que se achican con la distancia al botón
  const rows = 14;
  for (let i = 0; i < rows; i++) {
    const q = i / (rows - 1);
    const y = y0 + 8 + q * q * 170;
    for (let j = 0; j < 3; j++) {
      const s = hash(i, j, 91);
      const len = w * (0.9 - 0.65 * q) * (0.25 + 0.4 * s);
      const cx = B.x + (hash(i, j, 92) - 0.5) * w * (0.9 - 0.5 * q) + Math.sin(t * (1.6 + s) + i * 1.3 + j) * (10 + 20 * q);
      const tw = 0.5 + 0.5 * Math.sin(t * (3 + 3 * hash(i, j, 93)) + i * 2.2 + j * 1.7);
      const a = k * (0.55 - 0.45 * q) * tw;
      if (a < 0.02) continue;
      const th = 2 + 3 * (1 - q);
      ctx.fillStyle = ca(j === 1 ? '#B8FFD2' : PAL.wa, a);
      ctx.fill(rrectPath(cx - len / 2, y - th / 2, len, th, th / 2));
    }
  }
  ctx.restore();
  drawPings(ctx, t, B);
}

// latidos suaves después del golpe final: un anillo fino y un par de chispas
function drawPings(ctx, t, B) {
  PINGS.forEach((t0, n) => {
    const d = t - t0;
    if (d < 0 || d > 0.8) return;
    const p = E.outCubic(clamp(d / 0.7));
    const pad = 6 + 70 * p;
    ctx.save();
    ctx.globalAlpha *= (1 - p) * (n === 1 ? 0.55 : 0.42);
    ctx.strokeStyle = PAL.wa;
    ctx.lineWidth = 6 * (1 - p) + 1;
    ctx.stroke(ringRect(B, pad));
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const a = TAU * hash(i, n, 95);
      const life = 1 - prog(d, 0.1, 0.6);
      const r = (B.w / 2 + 40 + 60 * p) * 0.98;
      sparkle(ctx, B.x + Math.cos(a) * r, B.y + Math.sin(a) * (B.h / 2 + 12 + 22 * p), 10 * life, { alpha: life * 0.8, color: PAL.white, rot: d * 2 });
    }
  });
}
