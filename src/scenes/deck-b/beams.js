// Haces de luz volumétricos (reflectores): sprite de cono suave precalculado, dibujado con 'lighter'.
// El cono es angosto arriba (la lente) y se abre hacia abajo; el borde es difuso y el centro más denso.
import { makeCanvas } from '../../engine/env.js';
import { rgba } from '../../engine/color.js';
import { hash } from '../../engine/noise.js';

const SW = 256, SH = 640;
const sprites = new Map();

function build(color) {
  const cv = makeCanvas(SW, SH);
  const g = cv.getContext('2d');
  for (let y = 0; y < SH; y += 2) {
    const q = y / SH;
    const half = (0.06 + 0.44 * q) * SW;
    // denso cerca de la lente, se apaga hacia el piso
    const a = (0.95 * Math.pow(1 - q, 0.9) + 0.12) * (q < 0.04 ? q / 0.04 : 1);
    const gr = g.createLinearGradient(SW / 2 - half, 0, SW / 2 + half, 0);
    gr.addColorStop(0, rgba(color, 0));
    gr.addColorStop(0.3, rgba(color, a * 0.35));
    gr.addColorStop(0.5, rgba(color, a));
    gr.addColorStop(0.7, rgba(color, a * 0.35));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(SW / 2 - half, y, half * 2, 2);
  }
  // motas de polvo suspendidas dentro del cono
  for (let i = 0; i < 90; i++) {
    const q = hash(i, 3);
    const y = q * SH;
    const half = (0.06 + 0.44 * q) * SW;
    const x = SW / 2 + (hash(i, 5) - 0.5) * half * 1.4;
    g.fillStyle = rgba('#ffffff', 0.25 + hash(i, 9) * 0.35);
    g.fillRect(x, y, 1.6, 1.6);
  }
  return cv;
}

export function initBeams(colors) {
  for (const c of colors) if (!sprites.has(c)) sprites.set(c, build(c));
}

/**
 * Haz desde (x, y) hacia el ángulo `ang` (0 = hacia abajo, + = hacia la derecha), largo `len`,
 * ancho en la base `wide` (px). Pintar con globalCompositeOperation = 'lighter'.
 */
export function beam(ctx, x, y, ang, len, wide, color, alpha = 1) {
  if (alpha <= 0.003) return;
  const img = sprites.get(color);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);
  ctx.globalAlpha *= Math.min(1, alpha);
  ctx.drawImage(img, -wide / 2, -len * 0.02, wide, len);
  ctx.restore();
}
