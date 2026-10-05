// Prueba: océano + continentes siguiendo la cámara del mapa.
import { initTerrain, drawOcean, drawLand } from './terrain.js';
import { camAt } from './mapcam.js';
export async function init() { initTerrain(); }
export function draw(ctx, t) {
  const cam = camAt(t);
  drawOcean(ctx, cam);
  drawLand(ctx, cam, t);
}
