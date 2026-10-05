// Muestra del flotador (sandbox): grande como en el corte (×3,39) y chico como en la pileta.
import { drawFloat } from './float.js';
export const bg = '#3EC1E3';
export function draw(ctx, t) {
  ctx.save();
  ctx.translate(700, 540);
  ctx.scale(3.387, 3.387);
  drawFloat(ctx, t, { x: 0, y: 0, rot: t * 0.6, bob: 1 }, { raise: (t % 2) > 1 ? 1 : 0 });
  ctx.restore();
  ctx.save();
  ctx.translate(1550, 540);
  drawFloat(ctx, t, { x: 0, y: 0, rot: 0.4, bob: 1 }, { raise: 0 });
  ctx.restore();
}
