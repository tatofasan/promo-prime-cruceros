// Prueba de humo del punto de entrada del kit (index.js + initArt).
import * as ART from './index.js';
export async function init() { await ART.initArt({ clouds: ['golden'] }); }
export function draw(ctx, t) {
  ART.drawSky(ctx, t, { preset: 'golden', sunX: 1400, sunY: 260 });
  ART.drawClouds(ctx, t, { preset: 'golden' });
  ART.drawOcean(ctx, t, { preset: 'golden', sunX: 1400, sunY: 260 });
  ART.drawShip(ctx, t, ART.shipZoom({ x: 1000, y: 650, scale: 0.4, preset: 'golden' }, 0.2));
  ART.drawGulls(ctx, t, {});
  ART.drawPalm(ctx, t, 200, 1080, 500, {});
  ART.drawSplash(ctx, t, 900, 900, 0.3, {});
  ART.drawConfetti(ctx, t, { x: 0, y: 0, w: 1920, h: 500 }, 0.5, {});
  ART.drawGlitter(ctx, t, { x: 0, y: 700, w: 1920, h: 300 }, {});
  ART.drawWaveCrest(ctx, t, 0.5, { dir: 'ltr', preset: 'sunset' });
  ART.drawPorthole(ctx, t, 1600, 300, 120, { preset: 'night', lit: 1 });
}
