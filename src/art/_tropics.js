// Muestras: isla con palmeras (día y atardecer), palmera grande, salpicadura cuadro a cuadro, papelitos, destellos.
import { W, H } from '../engine/time.js';
import { PAL } from '../engine/color.js';
import { drawSky } from './sky.js';
import { drawOcean } from './ocean.js';
import { drawIsland, drawPalm } from './tropics.js';
import { drawSplash, drawConfetti, drawGlitter } from './fxkit.js';

export function draw(ctx, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 960, 540); ctx.clip();
  ctx.scale(0.5, 0.5);
  drawSky(ctx, t, { preset: 'day', horizonY: 700, sunX: 1500, sunY: 200 });
  drawOcean(ctx, t, { preset: 'day', horizonY: 700, sunX: 1500, sunY: 200 });
  drawIsland(ctx, t, 900, 760, 1.6, { preset: 'day', palms: 3, hut: true });
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(960, 0, 960, 540); ctx.clip();
  ctx.translate(960, 0); ctx.scale(0.5, 0.5);
  drawSky(ctx, t, { preset: 'sunset', horizonY: 700, sunX: 960, sunY: 600 });
  drawOcean(ctx, t, { preset: 'sunset', horizonY: 700, sunX: 960, sunY: 600 });
  drawIsland(ctx, t, 1100, 740, 1.2, { preset: 'sunset', palms: 4 });
  drawPalm(ctx, t, 200, 1180, 900, { preset: 'sunset', lean: 0.55, silhouette: true });
  ctx.restore();
  // abajo: palmera grande + salpicadura (fases) + papelitos + destellos
  ctx.fillStyle = PAL.ocean500; ctx.fillRect(0, 540, W, 540);
  drawPalm(ctx, t, 230, 1080, 480, { preset: 'golden', lean: 0.4 });
  for (let k = 0; k < 6; k++) drawSplash(ctx, t, 560 + k * 170, 900, 0.06 + k * 0.15, { size: 60, seed: 3 });
  drawConfetti(ctx, t, { x: 560, y: 560, w: 1300, h: 240 }, 0.5, { count: 70 });
  drawGlitter(ctx, t, { x: 560, y: 960, w: 1300, h: 110 }, { density: 2 });
}
