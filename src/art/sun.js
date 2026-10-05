// Sol cinematográfico: resplandor, corona, rayos finos que giran lento en dos sentidos, disco con núcleo
// blanco y borde cálido, estrellita de difracción y flare anamórfico (estría + fantasmas hacia el centro).
// `flat` lo lleva a un disco liso de color (match cut sol → pin de DECK-B / MAP).
import { W, H } from '../engine/time.js';
import { rad, lin } from '../engine/draw.js';
import { TAU } from '../engine/ease.js';
import { skyOf } from './presets.js';
import { mixHex } from '../engine/color.js';
import { ca } from './util.js';

/**
 * drawSun(ctx, t, x, y, r, { preset, glow, rays, flare, flat, flatColor, horizon, corona, star, ghosts, pulse })
 *  - glow 0..2 (def 1) · rays 0..1.5 (def 1) · flare 0..1.5 (def 0.5) · corona 0..1 (def 1) · star 0..1 (def 1)
 *  - flat 0..1: mezcla a un disco liso de `flatColor` (sin halo ni rayos)
 *  - horizon: y en pantalla; el DISCO se recorta debajo (sol que se hunde). El resplandor sigue.
 *  - pulse 0..1: latido (agranda halo y núcleo; usar beatPulse)
 *  - ghosts: true/false (fantasmas del flare)
 */
export function drawSun(ctx, t, x, y, r, o = {}) {
  const S = skyOf(o.preset ?? 'day').sun;
  const flat = Math.min(1, Math.max(0, o.flat ?? 0));
  const live = 1 - flat;
  const pulse = o.pulse ?? 0;
  const glow = (o.glow ?? 1) * live * (1 + pulse * 0.35);
  const rays = (o.rays ?? 1) * live;
  const flare = (o.flare ?? 0.5) * live;
  const corona = (o.corona ?? 1) * live;
  const R = r * (1 + pulse * 0.06);

  ctx.save();
  // 1) resplandor grande
  if (glow > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    const G = R * 7.5;
    ctx.fillStyle = rad(ctx, x, y, G, [[0, ca(S.glow, 0.6 * glow)], [0.12, ca(S.glow, 0.42 * glow)], [0.35, ca(S.glow, 0.14 * glow)], [0.7, ca(S.glow, 0.04 * glow)], [1, ca(S.glow, 0)]]);
    ctx.fillRect(x - G, y - G, G * 2, G * 2);
  }
  // 2) rayos finos (dos ruedas que giran en sentidos opuestos)
  if (rays > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    wheel(ctx, x, y, R, 20, t * 0.06, R * 5.0, R * 3.0, 0.03, 0.1 * rays, S.ray);
    wheel(ctx, x, y, R, 13, -t * 0.035 + 0.4, R * 4.0, R * 2.3, 0.05, 0.055 * rays, S.ray);
  }
  // 3) corona y anillos de halo
  if (corona > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rad(ctx, x, y, R * 1.9, [[0, ca(S.core, 0.9 * corona)], [0.5, ca(S.edge, 0.5 * corona)], [0.62, ca(S.glow, 0.22 * corona)], [1, ca(S.glow, 0)]]);
    ctx.beginPath(); ctx.arc(x, y, R * 1.9, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ring(ctx, x, y, R * 2.4, R * 0.04, ca(S.edge, 0.05 * corona));
  }
  ctx.restore();

  // 4) disco (recortado al horizonte si se pide)
  ctx.save();
  if (o.horizon !== undefined) {
    ctx.beginPath();
    ctx.rect(x - R * 3, y - R * 3, R * 6, Math.max(0, o.horizon - (y - R * 3)));
    ctx.clip();
  }
  if (live > 0.002) {
    ctx.save();
    ctx.globalAlpha *= live;
    ctx.fillStyle = rad(ctx, x - R * 0.12, y - R * 0.14, 0, x, y, R, [[0, S.core], [0.55, S.core], [0.86, S.disc], [1, mixHex(S.disc, S.edge, 0.55)]]);
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    // filo de luz interior (lado alto) y sombra plana del limbo (lado bajo)
    ctx.clip();
    ctx.fillStyle = lin(ctx, x, y - R, x, y + R, [[0, ca('#ffffff', 0.3)], [0.45, ca('#ffffff', 0)], [0.8, ca(S.edge, 0)], [1, ca(S.edge, 0.22)]]);
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();
    // bloom sobre el borde: el disco «quema» y no queda recortado
    ctx.save();
    ctx.globalAlpha *= live;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rad(ctx, x, y, R * 0.7, x, y, R * 1.35, [[0, ca(S.core, 0.55)], [0.4, ca(S.disc, 0.35)], [1, ca(S.glow, 0)]]);
    ctx.beginPath(); ctx.arc(x, y, R * 1.35, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (flat > 0.002) {
    ctx.globalAlpha *= flat;
    ctx.fillStyle = o.flatColor ?? '#FF6B4A';
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  }
  ctx.restore();

  // 5) estrellita de difracción sobre el núcleo
  const star = (o.star ?? 1) * live;
  if (star > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const L = R * (2.2 + 0.25 * Math.sin(t * 2.1));
    for (let k = 0; k < 4; k++) {
      const a = k * (Math.PI / 4) + 0.18 + t * 0.02;
      const len = k % 2 ? L * 0.6 : L;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = lin(ctx, -len, 0, len, 0, [[0, ca(S.core, 0)], [0.5, ca(S.core, 0.5 * star)], [1, ca(S.core, 0)]]);
      ctx.fillRect(-len, -R * 0.018 - 0.6, len * 2, R * 0.036 + 1.2);
      ctx.restore();
    }
    ctx.restore();
  }

  // 6) flare anamórfico
  if (flare > 0.01) drawFlare(ctx, t, x, y, R, flare, S, o.ghosts !== false);
}

function wheel(ctx, x, y, r, n, rot, long, short, width, alpha, color) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const len = i % 2 ? short : long;
    const w = width * (i % 3 ? 1 : 1.6);
    const al = alpha * (0.6 + 0.4 * Math.sin(i * 2.7 + rot * 9));
    ctx.fillStyle = rad(ctx, x, y, len, [[0, ca(color, al)], [r / len, ca(color, al)], [1, ca(color, 0)]]);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - w) * r * 0.9, y + Math.sin(a - w) * r * 0.9);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a + w) * r * 0.9, y + Math.sin(a + w) * r * 0.9);
    ctx.closePath();
    ctx.fill();
  }
}

function ring(ctx, x, y, rr, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.8, w);
  ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
}

/** Flare anamórfico suelto (también lo usan el barrido del bocinazo o el golpe final). */
export function drawFlare(ctx, t, x, y, r, k, S, ghosts = true) {
  if (typeof S === 'string' || S === undefined) S = skyOf(S ?? 'day').sun;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= Math.min(1, k);
  // estría principal (cálida) y estría larga azulada (lente anamórfica)
  streak(ctx, x, y, W * 0.55 * Math.min(1.4, 0.6 + k * 0.5), Math.max(2, r * 0.07), S.flare, 0.75);
  streak(ctx, x, y, W * 0.95, Math.max(1.2, r * 0.03), '#8FD8FF', 0.55);
  streak(ctx, x, y, r * 3.2, Math.max(3, r * 0.16), '#ffffff', 0.5);
  if (ghosts) {
    const cx = W / 2, cy = H / 2;
    const G = [
      [0.32, 0.22, 'disc', '#ffffff', 0.10],
      [0.58, 0.55, 'ring', S.ghost, 0.16],
      [0.82, 0.16, 'disc', S.flare, 0.16],
      [1.12, 0.9, 'hex', S.ghost, 0.035],
      [1.38, 0.3, 'disc', '#C9F2FF', 0.12],
      [1.62, 1.35, 'ring', S.flare, 0.08],
      [1.9, 0.45, 'hex', '#ffffff', 0.04],
    ];
    for (const [f, sz, kind, col, a] of G) {
      const gx = x + (cx - x) * f, gy = y + (cy - y) * f;
      const gr = Math.max(4, r * sz);
      if (kind === 'disc') {
        ctx.fillStyle = rad(ctx, gx, gy, gr, [[0, ca(col, a)], [0.65, ca(col, a * 0.7)], [1, ca(col, 0)]]);
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU); ctx.fill();
      } else if (kind === 'ring') {
        ctx.fillStyle = rad(ctx, gx, gy, gr, [[0, ca(col, 0)], [0.78, ca(col, a * 0.15)], [0.9, ca(col, a)], [1, ca(col, 0)]]);
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = rad(ctx, gx, gy, gr, [[0, ca(col, a * 0.4)], [0.85, ca(col, a)], [1, ca(col, a * 0.6)]]);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = i * (TAU / 6) + 0.26;
          const px = gx + Math.cos(ang) * gr, py = gy + Math.sin(ang) * gr;
          if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function streak(ctx, x, y, len, th, color, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, th / len);
  ctx.fillStyle = rad(ctx, 0, 0, len, [[0, ca('#ffffff', a)], [0.08, ca(color, a * 0.8)], [0.4, ca(color, a * 0.22)], [1, ca(color, 0)]]);
  ctx.fillRect(-len, -len, len * 2, len * 2);
  ctx.restore();
}
