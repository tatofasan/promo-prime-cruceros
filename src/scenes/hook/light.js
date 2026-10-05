// Luz de la oficina: el tubo fluorescente frío (que parpadea cuando sube la tensión y se corta con el
// estallido) y la pantalla como única fuente cálida, que derrama color sobre el escritorio y la pared.
import { PAL, rgba } from '../../engine/color.js';
import { rad, lin, fill, rrectPath } from '../../engine/draw.js';
import { W, H } from '../../engine/time.js';
import { clamp, E } from '../../engine/ease.js';
import { hit } from './util.js';
import { LAMP, T, MUG, KEYB, CLOCK } from './layout.js';
import { beachSat, screenBright } from './screen.js';

// tramos de parpadeo [desde, hasta, nivel]. Antes del estallido son SUAVES (≥ 0,86) y el primero llega después
// de 0,5 s: dos golpes fuertes en los primeros cuadros se leían como un error de codificación.
const BLINKS = [
  [0.74, 0.77, 0.9],
  [2.6, 2.63, 0.88], [2.98, 3.01, 0.86],
  [3.05, 3.07, 0.88],
  [3.3, 3.33, 0.5], [3.37, 3.39, 0.62], [3.43, 3.47, 0.45],
];

/** Nivel del tubo fluorescente en t (1 = encendido pleno). */
export function tube(t) {
  let v = 1;
  for (const [a, b, l] of BLINKS) if (t >= a && t < b) v = Math.min(v, l);
  if (t > 3.5) v = Math.min(v, 0.5);
  return v;
}

/** Difusor encendido y su resplandor (plano pared). */
export function drawTube(ctx, t) {
  const k = tube(t);
  const { x0, x1, y } = LAMP;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  fill(ctx, rrectPath(x0 - 60, y - 40, x1 - x0 + 120, 160, 60), rad(ctx, (x0 + x1) / 2, y + 30, (x1 - x0) * 0.6, [[0, rgba(PAL.aqua100, 0.16 * k)], [1, rgba(PAL.aqua100, 0)]]));
  ctx.restore();
  fill(ctx, rrectPath(x0 + 8, y + 20, x1 - x0 - 16, 7, 3), lin(ctx, 0, y + 20, 0, y + 27, [rgba(PAL.white, 0.6 + 0.4 * k), rgba(PAL.aqua100, 0.5 + 0.4 * k)]));
}

/** Oscurece la oficina cuando el tubo baja (se dibuja en coordenadas de pantalla). */
export function drawDim(ctx, t) {
  const a = (1 - tube(t)) * 0.62;
  if (a <= 0.002) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = rgba(PAL.ink, a);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Derrame de luz de la pantalla (x, y en pantalla; s = escala de cámara). */
export function drawSpill(ctx, t, x, y, s = 1) {
  const sat = beachSat(t);
  const b = screenBright(t);
  const leak = t > T.leak ? E.outCubic(clamp((t - T.leak) / 0.15)) : 0;
  const k = 0.08 + 0.1 * sat + b * 0.5 + 0.22 * leak;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  const r = (700 + 300 * leak) * s;
  ctx.fillStyle = rad(ctx, x, y, r, [[0, rgba(PAL.aqua200, k)], [0.35, rgba(PAL.aqua300, k * 0.5)], [1, rgba(PAL.aqua300, 0)]]);
  ctx.fillRect(Math.max(0, x - r), Math.max(0, y - r), Math.min(W, 2 * r), Math.min(H, 2 * r));
  // halo de la pantalla sobre la pared (elíptico, como un rectángulo de luz)
  const build = E.inQuad(clamp((t - T.q[0]) / (T.leak - T.q[0])));
  const kh = 0.1 + 0.08 * sat + b * 0.6 + 0.2 * leak + 0.12 * build;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.62);
  ctx.fillStyle = rad(ctx, 0, 0, 470 * s, [[0, rgba(PAL.aqua100, kh)], [0.55, rgba(PAL.aqua200, kh * 0.45)], [1, rgba(PAL.aqua200, 0)]]);
  ctx.fillRect(-470 * s, -470 * s, 940 * s, 940 * s);
  ctx.restore();
  // calor del sol de la pantalla (sube con la saturación)
  const kw = 0.04 * sat + 0.18 * leak + 0.12 * hit(t, T.leak, 0.2);
  if (kw > 0.003) {
    const rw = r * 0.6, wx = x + 60 * s, wy = y - 40 * s;
    ctx.fillStyle = rad(ctx, wx, wy, rw, [[0, rgba(PAL.goldLight, kw)], [1, rgba(PAL.goldLight, 0)]]);
    ctx.fillRect(wx - rw, wy - rw, 2 * rw, 2 * rw);
  }
  ctx.restore();
}

/** Luz turquesa del estallido inundando la oficina. */
export function drawBurstGlow(ctx, t, x, y, s = 1) {
  if (t < T.surge) return;
  const k = E.outCubic(clamp((t - T.surge) / 0.18));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rad(ctx, x, y, 1400 * s, [[0, rgba(PAL.aqua200, 0.18 * k)], [0.5, rgba(PAL.ocean400, 0.1 * k)], [1, rgba(PAL.ocean400, 0.04 * k)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Viñeta que se cierra sobre el monitor durante el build (visión de túnel); se abre con el estallido. */
export function drawTunnel(ctx, t, x, y, s = 1) {
  let v = 0.22 + 0.06 * E.inOutSine(clamp(t / T.q[0]));
  if (t > T.q[0]) v += 0.3 * E.inQuad(clamp((t - T.q[0]) / (T.surge - T.q[0])));
  if (t > T.surge) v *= 1 - 0.7 * E.outCubic(clamp((t - T.surge) / 0.15));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = rad(ctx, x, y, 1500 * s, [[0.18, rgba(PAL.ink, 0)], [0.55, rgba(PAL.ink, v * 0.5)], [1, rgba(PAL.ink, v)]]);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Intensidad del filo de luz que la pantalla deja en lo que la rodea. */
export function rimK(t) {
  const leak = t > T.leak ? E.outCubic(clamp((t - T.leak) / 0.15)) : 0;
  return clamp(0.3 + 0.5 * beachSat(t) + screenBright(t) + 0.4 * leak, 0, 1.2);
}

/** Filos de luz de la pantalla sobre lo que está en el escritorio (plano escritorio). */
export function drawDeskRims(ctx, t) {
  const k = rimK(t);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  // taza: lado derecho (mira al monitor)
  const mx = MUG.x + MUG.w / 2 - 3;
  ctx.strokeStyle = lin(ctx, 0, MUG.y - MUG.h, 0, MUG.y, [rgba(PAL.aqua100, 0.75 * k), rgba(PAL.aqua200, 0.15 * k)]);
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(mx, MUG.y - MUG.h + 4); ctx.lineTo(mx - 3, MUG.y - 12); ctx.stroke();
  // teclado: borde de atrás
  ctx.strokeStyle = rgba(PAL.aqua100, 0.5 * k);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(KEYB.cx - KEYB.wb / 2 + 6, KEYB.yb + 0.5); ctx.lineTo(KEYB.cx + KEYB.wb / 2 - 6, KEYB.yb + 0.5); ctx.stroke();
  ctx.restore();
}

/** Filos de luz de la pantalla sobre el reloj y el almanaque (plano pared). */
export function drawWallRims(ctx, t) {
  const k = rimK(t);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(PAL.aqua100, 0.4 * k);
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(CLOCK.x, CLOCK.y, CLOCK.r - 1.5, Math.PI * 0.05, Math.PI * 0.42); ctx.stroke();
  ctx.restore();
}
