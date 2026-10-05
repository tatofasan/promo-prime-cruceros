// Efectos genéricos: destellos que titilan (agua, vidrio, metal) y papelitos con giro 3D falso. El AGUA
// (splash, encaje, gotas, spray) está en water.js y se re-exporta acá. Todo función pura de t / p.
import { TAU, clamp, E } from '../engine/ease.js';
import { hash } from '../engine/noise.js';
import { PAL, mixHex } from '../engine/color.js';
import { sparkle, rad } from '../engine/draw.js';
import { ca } from './util.js';

/**
 * drawGlitter(ctx, t, area, { density, seed, color, size, rate, alpha })
 *  area = { x, y, w, h } · density 1 ≈ un destello cada 9000 px² · size = radio del destello grande (px)
 */
export function drawGlitter(ctx, t, area, o = {}) {
  const n = Math.round(((area.w * area.h) / 9000) * (o.density ?? 1));
  const seed = o.seed ?? 5, size = o.size ?? 12, rate = o.rate ?? 1;
  const color = o.color ?? '#ffffff';
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  for (let i = 0; i < n; i++) {
    const x = area.x + hash(i, seed, 1) * area.w, y = area.y + hash(i, seed, 2) * area.h;
    const ph = hash(i, seed, 3) * TAU, hz = (0.6 + hash(i, seed, 4) * 1.8) * rate;
    const s = Math.sin(t * hz * TAU + ph);
    const k = Math.pow(Math.max(0, s), 6);
    if (k < 0.02) {
      // punto chiquito siempre presente (titila suave)
      const a = 0.25 + 0.25 * s;
      if (a > 0.05) { ctx.fillStyle = ca(color, a * 0.6); ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
      continue;
    }
    sparkle(ctx, x, y, size * (0.4 + 0.6 * hash(i, seed, 5)) * k, { color, alpha: k, rot: hash(i, seed, 6) * 0.6 });
  }
  ctx.restore();
}

// drawSplash vive ahora en water.js (vocabulario de agua compartido con la ola): se re-exporta acá para no
// romper imports viejos. También drawFoamLace, drawDroplets, drawSpray, drawDrop y waveColors.
export { drawSplash, drawFoamLace, drawDroplets, drawSpray, drawDrop, waveColors } from './water.js';

/**
 * drawConfetti(ctx, t, area, p, { count, colors, seed, gravity, size, spin })
 *  area = { x, y, w, h }: los papelitos nacen arriba del área y caen a través de ella mientras p va 0 → 1.
 */
export function drawConfetti(ctx, t, area, p, o = {}) {
  if (p <= 0) return;
  const n = o.count ?? 90;
  const seed = o.seed ?? 4;
  const cols = o.colors ?? [PAL.gold, PAL.coral, PAL.brandCyan, PAL.goldLight, PAL.sunsetPink, '#ffffff'];
  const size = o.size ?? 16;
  const g = o.gravity ?? 1;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const delay = hash(i, seed, 1) * 0.35;
    const q = (p - delay) / (1 - delay);
    if (q <= 0 || q >= 1) continue;
    const x0 = area.x + hash(i, seed, 2) * area.w;
    const fall = (0.65 + 0.7 * hash(i, seed, 3)) * g;
    const y = area.y - 60 + (area.h + 120) * q * fall;
    if (y > area.y + area.h + 40) continue;
    const sway = Math.sin(t * (2 + hash(i, seed, 4) * 3) + i) * size * 1.6;
    const x = x0 + sway;
    const rot = t * (2 + hash(i, seed, 5) * 5) * (hash(i, seed, 6) < 0.5 ? -1 : 1) * (o.spin ?? 1) + i;
    const flip = Math.cos(t * (5 + hash(i, seed, 7) * 7) + i * 1.3); // giro 3D falso
    const c = cols[i % cols.length];
    const w = size * (0.5 + 0.5 * hash(i, seed, 8)), h = size * (0.9 + 0.6 * hash(i, seed, 9));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1, Math.max(0.08, Math.abs(flip)));
    ctx.globalAlpha *= clamp((1 - q) * 6);
    // cara clara / cara oscura según de qué lado se ve
    ctx.fillStyle = flip > 0 ? c : mixHex(c, PAL.navy800, 0.3);
    if (i % 5 === 0) { ctx.beginPath(); ctx.arc(0, 0, w * 0.55, 0, TAU); ctx.fill(); } else ctx.fillRect(-w / 2, -h / 2, w, h);
    if (flip > 0.6) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.22); }
    ctx.restore();
  }
  ctx.restore();
}

/** Halo suave (reflectores, velas, luces de guirnalda). */
export function drawHalo(ctx, x, y, r, color = PAL.goldLight, a = 0.6) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, x, y, r, [[0, ca(color, a)], [0.4, ca(color, a * 0.35)], [1, ca(color, 0)]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
