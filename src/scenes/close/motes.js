// Motas de luz en primer plano (plano 1,35): bruma salada que agarra el sol. Dos familias:
//  - chispitas nítidas (núcleo + halo) que suben despacio con el viento y titilan; más vivas cerca del sol
//  - pocos discos de bokeh grandes, muy tenues y con el borde apenas más claro (fuera de foco, delante de todo)
import { W, H } from '../../engine/time.js';
import { PAL } from '../../engine/color.js';
import { rad } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { TAU } from '../../engine/ease.js';
import { ca } from '../../art/util.js';
import { SUN } from './look.js';

const SPECKS = 54;
const BOKEH = 8;

function drift(i, seed, t, vx, vy, pad) {
  const sw = W + pad * 2, sh = H + pad * 2;
  const x = ((hash(i, seed) * sw + vx * t) % sw + sw) % sw - pad;
  const y = ((hash(i, seed + 1) * sh + vy * t) % sh + sh) % sh - pad;
  return [x, y];
}

export function drawMotes(ctx, t, kick = 0) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < SPECKS; i++) {
    const near = hash(i, 311);
    let [x, y] = drift(i, 312, t, 20 + 40 * near, -(14 + 34 * near), 40);
    x += Math.sin(t * (0.6 + hash(i, 314)) + i * 2.1) * 10;
    const dSun = Math.hypot(x - SUN.x, y - SUN.y) / 1300;
    const tw = Math.max(0, Math.sin(t * (1.1 + 2.4 * hash(i, 315)) + i * 4.7));
    const a = Math.min(1, (0.35 + 0.5 * near) * tw * Math.max(0.15, 1 - dSun) * (1 + 0.9 * kick));
    if (a < 0.03) continue;
    const r = 1.2 + 2.6 * near;
    const col = hash(i, 316) < 0.75 ? PAL.goldPale : PAL.peach;
    ctx.fillStyle = rad(ctx, x, y, r * 4, [[0, ca('#ffffff', a)], [0.22, ca(col, a * 0.8)], [0.5, ca(col, a * 0.18)], [1, ca(col, 0)]]);
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  }
  for (let i = 0; i < BOKEH; i++) {
    let [x, y] = drift(i, 321, t, 30, -16, 120);
    const r = 34 + 40 * hash(i, 323);
    const dSun = Math.hypot(x - SUN.x, y - SUN.y) / 1500;
    const a = (0.045 + 0.04 * hash(i, 324)) * Math.max(0.2, 1 - dSun) * (0.7 + 0.3 * Math.sin(t * 0.9 + i));
    ctx.fillStyle = rad(ctx, x, y, r, [[0, ca(PAL.goldPale, a * 0.7)], [0.82, ca(PAL.goldPale, a)], [0.93, ca(PAL.goldLight, a * 1.6)], [1, ca(PAL.goldLight, 0)]]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
