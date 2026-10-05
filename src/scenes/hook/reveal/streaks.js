// Estelas de velocidad del disparo al casco: trazos afinados y gotas que salen del punto de fuga hacia los
// bordes, más largos y más brillantes cuanto más rápido viaja la cámara.
import { PAL, rgba } from '../../../engine/color.js';
import { clamp, fract, TAU } from '../../../engine/ease.js';
import { hash } from '../../../engine/noise.js';

const N = 46;

export function drawStreaks(ctx, t, cx, cy, speed) {
  const a = clamp((speed - 0.6) / 2.2);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < N; i++) {
    const ang = hash(i, 91) * TAU;
    // cada trazo nace cerca del centro y vuela hacia afuera (posición = fase que avanza con t)
    const ph = fract(hash(i, 92) + t * (1.6 + hash(i, 93) * 1.4));
    const r0 = 180 + ph * ph * 1500;
    const len = (60 + 340 * hash(i, 94)) * a * (0.4 + ph);
    const w = (1.2 + 3.5 * hash(i, 95)) * (0.5 + ph);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const x0 = cx + ca * r0, y0 = cy + sa * r0, x1 = cx + ca * (r0 + len), y1 = cy + sa * (r0 + len);
    const al = a * (0.25 + 0.5 * hash(i, 96)) * Math.sin(Math.PI * ph);
    const col = hash(i, 97) < 0.5 ? PAL.white : PAL.aqua100;
    ctx.fillStyle = rgba(col, al);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - sa * w, y1 + ca * w);
    ctx.lineTo(x1 + sa * w, y1 - ca * w);
    ctx.closePath();
    ctx.fill();
    if (hash(i, 98) < 0.25) {
      // gota que vuela (punta redonda)
      ctx.beginPath(); ctx.arc(x1, y1, w * 1.6, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
