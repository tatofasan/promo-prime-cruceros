// Lluvia de papelitos (exp.confetti): dos cañones a los costados del escenario disparan hacia arriba y adentro;
// los papelitos frenan con el aire, caen flameando y giran con 3D falso (se aplastan al ponerse de canto y
// muestran el dorso más oscuro). Tres capas de profundidad: detrás de las bailarinas, delante y muy cerca.
import { TAU, clamp } from '../../engine/ease.js';
import { PAL, shade } from '../../engine/color.js';
import { rng } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';

const COLORS = [PAL.gold, PAL.goldLight, PAL.coral, PAL.brandCyan, PAL.aqua300, PAL.gold, PAL.coralLight, PAL.warmWhite];
let parts = [];

export const BURSTS = [[560, 250], [960, 236], [1360, 250]];

export function initConfetti() {
  if (parts.length) return;
  const r = rng(1078);
  for (let i = 0; i < 440; i++) {
    const layer = r() < 0.3 ? 0 : r() < 0.88 ? 1 : 2;
    const q = r();
    const kind = q < 0.46 ? 'burst' : q < 0.76 ? 'side' : 'top';
    let x0, y0, vx, vy, k;
    if (kind === 'burst') {
      // estallido radial desde la parrilla, con sesgo hacia abajo
      const [bx, by] = BURSTS[Math.floor(r() * 3)];
      const a = r() * TAU;
      const sp = 500 + r() * 1500;
      x0 = bx + (r() - 0.5) * 20; y0 = by + (r() - 0.5) * 20;
      vx = Math.cos(a) * sp * 1.25; vy = Math.sin(a) * sp * 0.8 + 260;
      k = 3 + r() * 1.5;
    } else if (kind === 'side') {
      const side = i % 2 ? 1 : -1;
      const a = (0.05 + Math.pow(r(), 0.8) * 0.85) * -side; // hacia arriba y hacia el centro
      const sp = 2600 + r() * 2200;
      x0 = (side < 0 ? 410 : 1510) + (r() - 0.5) * 50; y0 = 800 + (r() - 0.5) * 30;
      vx = Math.sin(a) * sp; vy = -Math.cos(a) * sp;
      k = 3.2 + r() * 1.6;
    } else {
      x0 = 120 + r() * 1680; y0 = -10 - r() * 160;
      vx = (r() - 0.5) * 80; vy = 700 + r() * 600;
      k = 2.4 + r() * 1.2;
    }
    const c = COLORS[Math.floor(r() * COLORS.length)];
    parts.push({
      layer, x0, y0, vx, vy, k,
      vt: 120 + r() * 120,
      fa: 18 + r() * 34, fw: 3 + r() * 4, fp: r() * TAU,
      w: (layer === 2 ? 2.2 : 1.25) * (10 + r() * 9), h: (layer === 2 ? 2.2 : 1.25) * (5 + r() * 6),
      round: r() < 0.18,
      c, cd: shade(c, -0.42), cl: shade(c, 0.3),
      rz0: r() * TAU, rzw: (r() - 0.5) * 9,
      fl0: r() * TAU, flw: 7 + r() * 12,
      delay: kind === 'top' ? r() * 0.08 : r() * 0.04,
      metal: c === PAL.gold || c === PAL.goldLight,
    });
  }
}

/** Dibuja la capa `layer` (0 atrás, 1 medio, 2 cerca) del confeti disparado en t0. */
export function drawConfetti(ctx, t, t0, layer) {
  const T = t - t0;
  if (T < 0) return;
  for (const p of parts) {
    if (p.layer !== layer) continue;
    const dt = T - p.delay;
    if (dt < 0) continue;
    const e = 1 - Math.exp(-p.k * dt);
    const x = p.x0 + (p.vx * e) / p.k + p.fa * Math.sin(p.fw * dt + p.fp) * clamp(dt * 2);
    const y = p.y0 + ((p.vy - p.vt) * e) / p.k + p.vt * dt;
    if (y > 1180 || x < -80 || x > 2000) continue;
    const flip = Math.cos(p.fl0 + p.flw * dt);
    const rz = p.rz0 + p.rzw * dt;
    const face = flip >= 0;
    const lum = Math.abs(flip);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rz);
    ctx.scale(1, Math.max(0.08, lum));
    ctx.fillStyle = face ? (lum > 0.85 ? p.cl : p.c) : p.cd;
    if (p.round) {
      ctx.beginPath(); ctx.arc(0, 0, p.h * 0.75, 0, TAU); ctx.fill();
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
    // destello cuando el papel metálico queda de frente
    if (p.metal && lum > 0.975 && face) sparkle(ctx, x, y, p.w * 0.55, { alpha: 0.8 * (lum - 0.975) / 0.025, color: PAL.goldPale, halo: 0.4 });
  }
}

/** Fogonazo de los cañones en el disparo: anillo de humo dorado que se abre. */
export function drawCannonPop(ctx, t, t0) {
  const dt = t - t0;
  if (dt < 0 || dt > 0.3) return;
  const p = dt / 0.3;
  ctx.save();
  for (const x of [410, 1510]) {
    ctx.beginPath();
    ctx.ellipse(x, 790, 30 + p * 120, 12 + p * 40, 0, 0, TAU);
    ctx.strokeStyle = `rgba(255,233,184,${(0.6 * (1 - p)).toFixed(3)})`;
    ctx.lineWidth = 10 * (1 - p) + 1;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y] of BURSTS) {
    const R = 60 + 160 * p;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(255,248,238,${(0.85 * (1 - p)).toFixed(3)})`);
    g.addColorStop(0.3, `rgba(255,210,122,${(0.45 * (1 - p)).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,107,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
  }
  ctx.restore();
}
