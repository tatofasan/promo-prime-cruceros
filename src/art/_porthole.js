// Muestras del ojo de buey: grande (como en el corte de 5,625), en tres presets, solo aro y chiquitos.
import { PAL } from '../engine/color.js';
import { drawPorthole } from './porthole.js';

export const bg = PAL.navy700;
export function draw(ctx, t) {
  ctx.fillStyle = PAL.navy700;
  ctx.fillRect(0, 0, 1920, 1080);
  drawPorthole(ctx, t, 640, 540, 300, { preset: 'golden' });
  drawPorthole(ctx, t, 1260, 260, 110, { preset: 'day' });
  drawPorthole(ctx, t, 1600, 260, 110, { preset: 'sunset' });
  drawPorthole(ctx, t, 1260, 620, 110, { preset: 'night', lit: 0.8 });
  drawPorthole(ctx, t, 1600, 620, 110, { preset: 'golden', rimOnly: true, spin: t });
  for (let k = 0; k < 8; k++) drawPorthole(ctx, t, 1180 + k * 70, 900, 4 + k * 3.5, { preset: 'golden' });
}
