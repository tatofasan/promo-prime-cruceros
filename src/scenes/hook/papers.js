// Pila de papeles: en c1 caen tandas nuevas desde arriba (estiradas al caer, aplastadas al tocar, la torre
// se bambolea) en cada golpe, cada vez más seguido. En el estallido la pila vuela por el aire.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, fill, rrectPath, polyPath, ellipsePath } from '../../engine/draw.js';
import { E, clamp } from '../../engine/ease.js';
import { BEAT } from '../../engine/time.js';
import { hash } from '../../engine/noise.js';
import { wobble, hit } from './util.js';
import { STACK, T } from './layout.js';

const PAPER = mixHex(PAL.grey200, '#F2F0EA', 0.35);
const EDGE = mixHex(PAL.grey300, PAL.grey400, 0.4);
const WET = mixHex(PAL.ocean500, PAL.grey500, 0.45);
let B = null;

export function initPapers() {
  const lands = [T.q[0], T.q[1], T.q[1] + BEAT / 2, T.q[2], T.leak];
  B = [];
  for (let i = 0; i < 6 + lands.length; i++) {
    B.push({
      h: STACK.bh - 4 + hash(i, 1) * 8,
      w: STACK.w - 8 + hash(i, 2) * 14,
      dx: (hash(i, 3) - 0.5) * 18,
      rot: (hash(i, 4) - 0.5) * 0.05,
      kind: ['paper', 'folder', 'paper', 'clip', 'band'][Math.floor(hash(i, 5) * 5)],
      land: i < 6 ? -1 : lands[i - 6],
    });
  }
  let y = 0;
  for (const b of B) { y += b.h; b.top = y; }
}

function bundle(ctx, b, i) {
  const { w, h } = b;
  // cara frontal con cantos de hojas
  fill(ctx, rrectPath(-w / 2, -h, w, h, 2), PAPER);
  ctx.fillStyle = rgba(EDGE, 0.7);
  for (let y = -h + 3; y < -1; y += 2.6) ctx.fillRect(-w / 2 + 1, y, w - 2, 0.9);
  // tapa de arriba (se ve apenas) y sombra del lado derecho
  fill(ctx, polyPath([[-w / 2, -h], [w / 2, -h], [w / 2 - 4, -h - 5], [-w / 2 - 2, -h - 5]]), mixHex(PAPER, PAL.white, 0.4));
  fill(ctx, rrectPath(w / 2 - 14, -h, 14, h, 0), rgba(PAL.ink, 0.12));
  if (b.kind === 'folder') {
    fill(ctx, rrectPath(-w / 2 - 2, -h, w + 4, 5, 1.5), mixHex(PAL.grey500, PAL.navy600, 0.15));
    fill(ctx, rrectPath(-w / 2 - 2, -5, w + 4, 5, 1.5), mixHex(PAL.grey500, PAL.navy600, 0.15));
    fill(ctx, rrectPath(-22, -h + 7, 44, h - 14, 2), mixHex(PAL.grey300, PAL.grey200, 0.5));
  } else if (b.kind === 'clip') {
    fill(ctx, rrectPath(-w * 0.2, -h - 4, 26, 12, 2), PAL.grey900);
    ctx.strokeStyle = PAL.grey400; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-w * 0.2 + 5, -h - 4); ctx.lineTo(-w * 0.2 + 9, -h - 16); ctx.lineTo(-w * 0.2 + 17, -h - 16); ctx.lineTo(-w * 0.2 + 21, -h - 4); ctx.stroke();
  } else if (b.kind === 'band') {
    fill(ctx, rrectPath(w * 0.18, -h - 1, 7, h + 1, 1), mixHex(PAL.grey600, PAL.grey700, 0.4));
  }
  fill(ctx, rrectPath(-w / 2, -1.5, w, 1.5, 0), rgba(PAL.ink, 0.3));
}

/** Pila en el escritorio (antes del estallido) y tandas que caen. */
export function drawStack(ctx, t) {
  if (!B) return;
  // bamboleo de la torre: cada golpe la sacude y arriba se mueve más
  let sway = 0;
  for (const b of B) if (b.land > 0) sway += 0.9 * wobble(t, b.land, { freq: 2.8, decay: 4.2 });
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    const fly = t - (T.surge + 0.012 * (B.length - 1 - i));
    if (fly > 0) continue;
    let y = STACK.y - (b.top - b.h);
    let sx = 1, sy = 1, a = 1;
    if (b.land > 0) {
      const dt = b.land - t;
      if (dt > 0.32) continue;
      if (dt > 0) {
        // cae con estiramiento
        y -= 1700 * dt + 1400 * dt * dt;
        sy = 1.16; sx = 0.92;
        a = clamp((0.32 - dt) / 0.05);
      } else {
        // aplastamiento al tocar y resorte
        const s = 0.24 * hit(t, b.land, 0.05) + 0.1 * wobble(t, b.land, { freq: 7, decay: 12 });
        sy = 1 - s; sx = 1 + s * 0.55;
      }
    }
    const lean = (b.top / 260) * sway * 14;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(STACK.x + b.dx + lean, y);
    ctx.rotate(b.rot + sway * 0.012 * (b.top / 200));
    ctx.scale(sx, sy);
    bundle(ctx, b, i);
    ctx.restore();
  }
}

/** Tandas y hojas sueltas volando con el estallido (por delante de todo el escritorio). */
export function drawPaperStorm(ctx, t) {
  if (!B || t < T.surge) return;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    const u = t - (T.surge + 0.012 * (B.length - 1 - i));
    if (u <= 0 || u > 1.2) continue;
    const h1 = hash(i, 11), h2 = hash(i, 12);
    const left = h1 < 0.3;
    const vx = left ? -500 - 500 * h2 : 300 + 700 * h2;
    const vy = -700 - 700 * hash(i, 13);
    const x = STACK.x + b.dx + vx * u;
    const y = STACK.y - b.top + b.h + vy * u + 1300 * u * u;
    const spin = (left ? -1 : 1) * (5 + 6 * h2) * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.rot + spin);
    const sc = 1 + 1.2 * u;
    ctx.scale(sc, sc * Math.cos(u * (9 + h1 * 6)));
    // se abre en hojas: la tanda se separa en tres
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate((k - 1) * 30 * E.outCubic(clamp(u / 0.3)), (k - 1) * -14 * u * 10);
      ctx.rotate((k - 1) * 0.4 * u * 3);
      fill(ctx, rrectPath(-b.w / 2 + 6, -48 + 8, b.w, 96, 3), rgba(PAL.ink, 0.14));
      fill(ctx, rrectPath(-b.w / 2, -48, b.w, 96, 3), lin(ctx, -b.w / 2, -48, b.w / 2, 48, [mixHex(PAPER, PAL.white, 0.3), PAPER, EDGE]));
      ctx.fillStyle = rgba(PAL.grey500, 0.45);
      for (let r = 0; r < 6; r++) ctx.fillRect(-b.w / 2 + 14, -34 + r * 12, b.w * (0.5 + hash(i, k, r) * 0.35), 2.2);
      // mojada: mancha translúcida que se agranda (el papel se oscurece y transparenta) con borde de agua
      const wet = clamp((u - 0.04 - 0.05 * k) / 0.25);
      if (wet > 0) {
        const wx = (hash(i, k, 31) - 0.5) * b.w * 0.5, wy = (hash(i, k, 32) - 0.5) * 50, wr = (22 + 30 * hash(i, k, 33)) * (0.4 + 0.6 * wet);
        fill(ctx, ellipsePath(wx, wy, wr * 1.3, wr, hash(i, k, 34)), rgba(WET, 0.34));
        ctx.strokeStyle = rgba(WET, 0.45); ctx.lineWidth = 2;
        ctx.stroke(ellipsePath(wx, wy, wr * 1.3, wr, hash(i, k, 34)));
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
