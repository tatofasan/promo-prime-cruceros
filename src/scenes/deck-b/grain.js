// Grano dentro de una forma, barato: un lienzo de grano de pantalla completa precalculado y pegado de una vez
// (un patrón repetido o el texture() del motor cuestan ~30 ms por llamada en Skia de CPU).
import { makeCanvas } from '../../engine/env.js';
import { rng } from '../../engine/noise.js';
import { W, H } from '../../engine/time.js';

let full = null;
function build() {
  const S = 256;
  const tile = makeCanvas(S, S);
  const c = tile.getContext('2d');
  const img = c.createImageData(S, S);
  const r = rng(7311);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() + r() + r() - 1.5) * 120;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  full = makeCanvas(W + S, H + S);
  const f = full.getContext('2d');
  for (let y = 0; y < H + S; y += S) for (let x = 0; x < W + S; x += S) f.drawImage(tile, x, y);
}
export function initGrain() { if (!full) build(); }

/** Grano con alfa y mezcla, recortado a `path` (coordenadas actuales). ox/oy desplazan el grano (en px). */
export function grain(ctx, path, { alpha = 0.08, blend = 'overlay', ox = 0, oy = 0 } = {}) {
  if (alpha <= 0.002) return;
  if (!full) build();
  ctx.save();
  if (path) ctx.clip(path);
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(full, -(((ox % 256) + 256) % 256), -(((oy % 256) + 256) % 256));
  ctx.restore();
}
