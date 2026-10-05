// Grano dentro de una forma, barato: el mismo azulejo de grano del motor (grainCanvasFor) pegado con drawImage
// sobre la caja de la forma y recortado a ella. En Node, un relleno con createPattern + overlay cuesta ~10× más.
import { grainCanvasFor } from '../../engine/draw.js';

/** box = { x, y, w, h } (caja de la forma) · o = { alpha, blend, ox, oy } */
export function grainIn(ctx, path, box, { alpha = 0.07, blend = 'overlay', ox = 0, oy = 0 } = {}) {
  const g = grainCanvasFor();
  const S = g.width;
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha;
  const x0 = box.x - (((box.x - ox) % S) + S) % S, y0 = box.y - (((box.y - oy) % S) + S) % S;
  for (let y = y0; y < box.y + box.h; y += S) for (let x = x0; x < box.x + box.w; x += S) ctx.drawImage(g, x, y);
  ctx.restore();
}
