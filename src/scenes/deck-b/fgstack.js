// Pila de fichas en primer plano, fuera de foco (profundidad de campo horneada en init): da el plano más
// cercano del casino y se mueve más rápido que la mesa.
import { makeCanvas } from '../../engine/env.js';
import { tableCam } from './persp.js';
import { drawChip, CHIP } from './chips.js';
import { contactShadow } from './solid.js';

const SW = 640, SH = 720;
let img = null;
const REF = { s: 0 };

export function initFgStack() {
  if (img) return;
  // vista de referencia con la misma inclinación que el encuadre final del casino
  const cam = tableCam({ D: 1000, pitch: 1.24, yaw: -0.46, tx: 0, ty: 0, F: 1600, sx: SW / 2, sy: SH * 0.7 });
  REF.s = cam.p(0, 0, 0).s;
  const sharp = makeCanvas(SW, SH);
  const g = sharp.getContext('2d');
  contactShadow(g, cam, 0, 0, CHIP.r * 1.4, { alpha: 0.55, dx: 14, dy: -12, soft: 1.5 });
  const styles = ['navy', 'navy', 'gold', 'navy', 'coral', 'navy', 'gold', 'navy', 'white'];
  styles.forEach((st, i) => drawChip(g, cam, (i % 3 - 1) * 1.6, ((i * 7) % 3 - 1) * 1.6, i * CHIP.h, st, i * 0.7, 1));
  drawChip(g, cam, 52, -30, 0, 'coral', 0.4, 1);
  drawChip(g, cam, 54, -32, CHIP.h, 'coral', 1.1, 1);
  img = makeCanvas(SW, SH);
  const b = img.getContext('2d');
  b.filter = 'blur(7px)';
  b.drawImage(sharp, 0, 0);
  b.filter = 'none';
}

/** Dibuja la pila desenfocada con su base en el punto (x, y) de la mesa, con la escala de la cámara. */
export function drawFgStack(ctx, cam, x, y, alpha = 1) {
  if (alpha <= 0.01) return;
  const p = cam.p(x, y, 0);
  const k = p.s / REF.s;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(img, p.x - (SW / 2) * k, p.y - SH * 0.7 * k, SW * k, SH * k);
  ctx.restore();
}
