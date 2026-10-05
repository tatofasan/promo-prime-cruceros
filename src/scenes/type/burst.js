// Estallidos de golpe alrededor de un titular (acción secundaria): rayitas de impacto, destellos, anillos,
// puntos y polvito en la base. Puro de t: cada partícula sale de hash(seed, i).
import { E, clamp, TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';
import { rgba } from '../../engine/color.js';

/**
 * Estallido radial desde el borde de una elipse (cx, cy, rx, ry) que arranca en t0.
 * o = { n, seed, dur, reach (px que viajan), colors [], kinds ['streak','spark','dot','ring'], size, alpha }
 */
export function drawBurst(c, t, t0, cx, cy, rx, ry, o = {}) {
  const q = t - t0;
  const dur = o.dur ?? 0.5;
  if (q < 0 || q > dur) return;
  const n = o.n ?? 14, seed = o.seed ?? 1, reach = o.reach ?? 160, size = o.size ?? 1;
  const kinds = o.kinds ?? ['streak', 'spark', 'dot', 'ring'];
  const cols = o.colors ?? ['#FFFFFF'];
  c.save();
  for (let i = 0; i < n; i++) {
    const h1 = hash(i, seed), h2 = hash(i, seed + 7), h3 = hash(i, seed + 13), h4 = hash(i, seed + 21);
    const a = (i / n) * TAU + (h1 - 0.5) * 0.5;
    const life = dur * (0.55 + 0.45 * h2);
    const p = q / life;
    if (p >= 1) continue;
    const e = E.outExpo(clamp(p * 1.15));
    const ca = Math.cos(a), sa = Math.sin(a);
    const x0 = cx + ca * rx, y0 = cy + sa * ry;
    const d = reach * (0.45 + 0.75 * h3) * e;
    const x = x0 + ca * d, y = y0 + sa * d + 30 * p * p * (o.gravity ?? 0);
    const kind = kinds[Math.floor(h4 * kinds.length) % kinds.length];
    const col = cols[i % cols.length];
    const al = (o.alpha ?? 1) * (1 - E.inQuad(p));
    if (kind === 'streak') {
      const len = (26 + 34 * h2) * size * (1 - p) + 4;
      c.strokeStyle = rgba(col, al);
      c.lineCap = 'round';
      c.lineWidth = (3.2 - 1.6 * p) * size;
      c.beginPath();
      c.moveTo(x - ca * len, y - sa * len);
      c.lineTo(x, y);
      c.stroke();
    } else if (kind === 'spark') {
      sparkle(c, x, y, (16 + 14 * h3) * size * Math.sin(Math.PI * clamp(p * 1.4)), { alpha: al, color: col, rot: p * 1.5 + h1 });
    } else if (kind === 'dot') {
      c.fillStyle = rgba(col, al);
      c.beginPath();
      c.arc(x, y, (3 + 4 * h3) * size * (1 - 0.6 * p), 0, TAU);
      c.fill();
    } else {
      c.strokeStyle = rgba(col, al * 0.9);
      c.lineWidth = 2.2 * size * (1 - p) + 0.6;
      c.beginPath();
      c.arc(x, y, (5 + 9 * h2) * size * (0.4 + p), 0, TAU);
      c.stroke();
    }
  }
  c.restore();
}

/** Polvito que se abre a los costados desde la base (aterrizajes). */
export function drawDust(c, t, t0, x0, x1, y, { n = 10, seed = 3, color = '#FFFFFF', alpha = 0.5, dur = 0.55, size = 1 } = {}) {
  const q = t - t0;
  if (q < 0 || q > dur) return;
  const p = q / dur;
  c.save();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const h = hash(i, seed), h2 = hash(i, seed + 5);
    const bx = side > 0 ? x1 - 20 * h : x0 + 20 * h;
    const bx2 = x0 + (x1 - x0) * h2; // también debajo de las letras
    const sx = i < n / 2 ? bx : bx2;
    const e = E.outCubic(p);
    const x = sx + side * (40 + 90 * h) * e;
    const yy = y - (10 + 34 * h2) * e;
    const r = (8 + 14 * h) * size * (0.5 + 0.8 * e);
    c.fillStyle = rgba(color, alpha * (1 - p) * (0.5 + 0.5 * h2));
    c.beginPath();
    c.arc(x, yy, r, 0, TAU);
    c.fill();
  }
  c.restore();
}
