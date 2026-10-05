// Bocinazo: soplo de vapor del silbato (horn = 0,2) visto en el tiempo, barco mediano.
import { drawSky } from './sky.js';
import { drawOcean } from './ocean.js';
import { drawShip } from './ship.js';
export function draw(ctx, t) {
  drawSky(ctx, t, { preset: 'golden', horizonY: 700, sunX: 1500, sunY: 230 });
  drawOcean(ctx, t, { preset: 'golden', horizonY: 700, sunX: 1500, sunY: 230 });
  drawShip(ctx, t, { x: 1100, y: 760, scale: 1.3, preset: 'golden', horn: 0.2, smoke: 0.35 });
}
