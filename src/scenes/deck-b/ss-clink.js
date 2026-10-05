// Destello del brindis (exp.cheers): golpe de luz en el punto de contacto, estrella de 4 puntas que gira,
// chispas que salen disparadas y frenan, aro que se expande y gotitas de trago en parábola. Plano de la pareja.
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, TAU } from '../../engine/ease.js';
import { rad, sparkle } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { T_CHEERS } from './ss-time.js';

export function drawClink(ctx, t, x, y) {
  const dt = t - T_CHEERS;
  if (dt < -0.02 || dt > 0.7) return;
  // pre-brillo: dos cuadros antes del contacto ya se carga la luz
  const pre = dt < 0 ? 1 + dt / 0.02 : 1;
  const u = Math.max(0, dt);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // núcleo de luz
  // (contenido: las copas y su squash se tienen que leer a través del golpe)
  const core = pre * Math.exp(-u / 0.07);
  const R = 46 + 110 * E.outCubic(clamp(u / 0.2));
  ctx.fillStyle = rad(ctx, x, y, R, [[0, rgba(PAL.white, 0.5 * core)], [0.2, rgba(PAL.goldPale, 0.26 * core)], [1, rgba(PAL.gold, 0)]]);
  ctx.fillRect(x - R, y - R, R * 2, R * 2);
  // aro que se expande
  const ring = clamp(u / 0.42);
  if (dt >= 0 && ring < 1) {
    ctx.strokeStyle = rgba(PAL.goldPale, 0.75 * (1 - ring));
    ctx.lineWidth = 3.5 * (1 - ring) + 0.6;
    ctx.beginPath(); ctx.arc(x, y, 14 + 120 * E.outCubic(ring), 0, TAU); ctx.stroke();
  }
  ctx.restore();
  // estrella grande que gira y se apaga
  const sk = pre * Math.exp(-u / 0.2);
  sparkle(ctx, x, y - 10, 66 * sk * (dt < 0 ? 0.4 : 1), { color: PAL.white, alpha: Math.min(1, sk * 1.2), rot: 0.2 + u * 2.2, halo: 0.18 });
  sparkle(ctx, x, y - 10, 32 * sk, { color: PAL.goldPale, alpha: sk, rot: 0.98 + u * 2.2, halo: 0.15 });
  if (dt < 0) return;
  // chispas que salen disparadas y frenan
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + hash(i, 31) * 0.5;
    const d = (60 + 70 * hash(i, 32)) * E.outCubic(clamp(u / 0.45));
    const life = 1 - clamp(u / (0.35 + 0.25 * hash(i, 33)));
    if (life <= 0) continue;
    sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, (6 + 8 * hash(i, 34)) * life, { color: i % 3 ? PAL.goldPale : PAL.white, alpha: life, rot: u * 4, halo: 0.5 });
  }
  // gotitas de trago en parábola (brillan a contraluz)
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const vx = (hash(i, 41) - 0.5) * 260, vy = -120 - hash(i, 42) * 140;
    const px = x + vx * u, py = y + vy * u + 0.5 * 900 * u * u;
    const life = 1 - clamp(u / 0.55);
    if (life <= 0) continue;
    const r = 2 + 2.2 * hash(i, 43);
    ctx.fillStyle = rgba(i % 2 ? PAL.coralLight : PAL.gold, 0.9 * life);
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(PAL.white, 0.8 * life);
    ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
