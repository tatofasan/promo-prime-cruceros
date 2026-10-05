// Destellos: la estrella del brindis (núcleo, rayos finos, anillo y chispas) y los brillos que titilan sobre
// la comida, el oro y el cristal.
import { TAU, clamp, E } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';
import { warmDisc, put } from './util.js';

/** Estrella de brindis en (x, y). p = tiempo desde el golpe (s). size en px de pantalla. */
export function clinkStar(ctx, x, y, p, size = 120) {
  if (p < 0 || p > 0.9) return;
  const a = Math.exp(-p / 0.16);
  const grow = E.outExpo(clamp(p / 0.1));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // resplandor cálido
  put(ctx, warmDisc(), x, y, { s: (size * 2.2 * (0.7 + grow * 0.5)) / 64, alpha: 0.6 * a });
  ctx.translate(x, y);
  // estría anamórfica horizontal + vertical corta (destello de lente)
  for (const [sx, sy, al] of [[size * 3.2, 2.2, 0.9], [2, size * 1.4, 0.55]]) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(255,250,235,${al * a})`);
    g.addColorStop(0.3, `rgba(255,214,140,${al * 0.45 * a})`);
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.save();
    ctx.scale(sx * (0.5 + grow * 0.5), sy * (0.5 + grow * 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  // rayos finos
  ctx.lineCap = 'round';
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * TAU + 0.31;
    const len = size * (k % 2 ? 0.8 : 1.35) * (0.45 + grow * 0.7);
    const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
    g.addColorStop(0, `rgba(255,248,225,${0.85 * a})`);
    g.addColorStop(1, 'rgba(255,210,122,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = k % 2 ? 1.2 : 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); ctx.stroke();
  }
  // anillo de choque
  const rp = E.outCubic(clamp(p / 0.4));
  ctx.strokeStyle = `rgba(255,233,184,${0.65 * (1 - rp)})`;
  ctx.lineWidth = 2.5 * (1 - rp) + 0.5;
  ctx.beginPath(); ctx.arc(0, 0, size * (0.3 + rp * 1.2), 0, TAU); ctx.stroke();
  // núcleo blanco caliente
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.3);
  core.addColorStop(0, `rgba(255,255,255,${a})`);
  core.addColorStop(0.35, `rgba(255,246,220,${0.7 * a})`);
  core.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = core;
  ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
  // estrella de 4 puntas finas y luminosas + una chica a 45° (decae más rápido que el resplandor)
  const a2 = Math.exp(-p / 0.09);
  spikeStar(ctx, x, y, size * (0.75 + grow * 0.55), a2, 0, size * 0.05);
  spikeStar(ctx, x, y, size * 0.45 * (0.6 + grow * 0.4), a2 * 0.8, Math.PI / 4, size * 0.035);
  // chispas que salen volando
  for (let k = 0; k < 14; k++) {
    const ang = hash(k, 301) * TAU;
    const sp = size * (1.1 + hash(k, 302) * 1.6);
    const d = E.outCubic(clamp(p / 0.6)) * sp;
    const sx = x + Math.cos(ang) * d, sy = y + Math.sin(ang) * d + p * p * 60;
    sparkle(ctx, sx, sy, (5 + hash(k, 303) * 7) * (1 - p * 0.6), { alpha: clamp(1 - p / 0.5), color: k % 3 ? '#FFE9B8' : '#FFFFFF', rot: ang, halo: 0.5 });
  }
}

/** Estrella de 4 puntas finas: cada punta es un huso con degradé blanco → transparente (se suma con 'lighter'). */
export function spikeStar(ctx, x, y, len, alpha, rot = 0, w = 6) {
  if (alpha <= 0.01 || len <= 1) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(0.25, `rgba(255,246,222,${alpha * 0.8})`);
  g.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = g;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.quadraticCurveTo(len * 0.25, -w * 0.4, len, 0);
    ctx.quadraticCurveTo(len * 0.25, w * 0.4, 0, w);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(Math.PI / 2);
  }
  ctx.restore();
}

/** Brillito que titila en (x, y): fase propia por semilla, rápido y corto (como un guiño de luz). */
export function twinkle(ctx, x, y, t, seed, size = 10, rate = 0.8) {
  const T = 1 / rate;
  const ph = hash(seed, 401) * T;
  const u = (((t + ph) % T) + T) % T / T;
  const v = u < 0.22 ? Math.sin((u / 0.22) * Math.PI) : 0;
  if (v <= 0.02) return;
  sparkle(ctx, x, y, size * v, { alpha: v, color: '#FFF8E8', rot: hash(seed, 402) * 0.6, halo: 0.6 });
}
