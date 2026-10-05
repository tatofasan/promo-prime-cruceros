// Terminaciones de superficie: tile de grano (lo usan los sprites de letras), barrido de luz y vidrio esmerilado
// (desenfoca lo que ya está pintado detrás de una placa o un chip).
import { makeCanvas } from '../../engine/env.js';
import { rng } from '../../engine/noise.js';
import { W, H } from '../../engine/time.js';

let speck = null;
/** Tile de motas claras y oscuras con alfa bajo (se pinta source-atop: solo cae sobre las letras). */
export function speckTile() {
  if (speck) return speck;
  const S = 192;
  speck = makeCanvas(S, S);
  const c = speck.getContext('2d');
  const img = c.createImageData(S, S);
  const r = rng(5150);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() + r() - 1; // triangular −1..1
    const on = v > 0 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = on;
    img.data[i + 3] = Math.min(255, Math.abs(v) * Math.abs(v) * 120);
  }
  c.putImageData(img, 0, 0);
  return speck;
}
export const initSurface = () => speckTile();

/**
 * Barrido de luz pegado a lo ya pintado en `c` (source-atop). rect en pantalla; p 0 → 1 cruza de izq. a der.
 * o = { angle, width (fracción de rect.w), color, alpha }
 */
export function sweepAtop(c, rect, p, { angle = -0.42, width = 0.2, color = '255,255,255', alpha = 0.85, blend = 'source-atop' } = {}) {
  if (p <= 0 || p >= 1) return;
  const bw = Math.max(40, rect.w * width);
  const cx = rect.x - bw + (rect.w + bw * 2) * p;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = blend;
  c.translate(cx, rect.y + rect.h / 2);
  c.rotate(angle);
  const g = c.createLinearGradient(-bw / 2, 0, bw / 2, 0);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.42, `rgba(${color},${alpha * 0.55})`);
  g.addColorStop(0.5, `rgba(${color},${alpha})`);
  g.addColorStop(0.58, `rgba(${color},${alpha * 0.55})`);
  g.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = g;
  c.fillRect(-bw / 2, -rect.h * 2, bw, rect.h * 4);
  c.restore();
}

let frostBuf = null;
/**
 * Vidrio esmerilado: copia lo que YA está pintado en ctx debajo de `path` (pantalla) y lo vuelve a pintar
 * desenfocado y recortado a la forma. rect = caja de la forma en pantalla. Barato: solo procesa esa caja.
 */
export function frost(ctx, path, rect, { blur = 14, alpha = 1 } = {}) {
  const src = ctx.canvas;
  if (!src || alpha <= 0.01) return;
  const m = Math.ceil(blur * 2.5);
  const x = Math.max(0, Math.floor(rect.x - m)), y = Math.max(0, Math.floor(rect.y - m));
  const x1 = Math.min(W, Math.ceil(rect.x + rect.w + m)), y1 = Math.min(H, Math.ceil(rect.y + rect.h + m));
  const w = x1 - x, h = y1 - y;
  if (w < 2 || h < 2) return;
  if (!frostBuf || frostBuf.width < w || frostBuf.height < h) frostBuf = makeCanvas(Math.max(w, 640), Math.max(h, 400));
  const b = frostBuf.getContext('2d');
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'copy';
  b.drawImage(src, x, y, w, h, 0, 0, w, h);
  b.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clip(path);
  ctx.globalAlpha *= alpha;
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(frostBuf, 0, 0, w, h, x, y, w, h);
  ctx.filter = 'none';
  ctx.restore();
}
