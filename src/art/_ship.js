// Muestras del crucero: mediano en escena, chico en el horizonte, de cerca ×6 y macro de un ojo de buey.
// ART_SHOT = mid | far | close | macro | dusk | left
import { W, H } from '../engine/time.js';
import { drawSky, skyPoint } from './sky.js';
import { drawSun } from './sun.js';
import { drawOcean } from './ocean.js';
import { drawShip, SHIP, shipPoseFor } from './ship.js';

const SHOT = globalThis.process?.env?.ART_SHOT ?? 'mid';

function bgScene(ctx, t, preset, horizonY, sun) {
  drawSky(ctx, t, { preset, horizonY, sunX: sun[0], sunY: sun[1] });
  const [sx, sy] = skyPoint(null, sun[0], sun[1]);
  drawSun(ctx, t, sx, sy, sun[2], { preset, flare: 0.5 });
  drawOcean(ctx, t, { preset, horizonY, sunX: sun[0], sunY: sun[1] });
}

export function draw(ctx, t) {
  if (SHOT === 'mid') {
    bgScene(ctx, t, 'golden', 560, [1500, 220, 70]);
    drawShip(ctx, t, { x: 900, y: 720, scale: 1.05, preset: 'golden', smoke: 0.4, horn: 0.6 });
  } else if (SHOT === 'far') {
    bgScene(ctx, t, 'golden', 640, [1500, 260, 70]);
    drawShip(ctx, t, { x: 1100, y: 662, scale: 0.3, preset: 'golden' });
    drawShip(ctx, t, { x: 500, y: 650, scale: 0.12, preset: 'golden', dir: -1 });
  } else if (SHOT === 'dusk') {
    bgScene(ctx, t, 'dusk', 600, [1300, 590, 80]);
    drawShip(ctx, t, { x: 900, y: 740, scale: 1.0, preset: 'dusk', dir: -1 });
  } else if (SHOT === 'sunset') {
    bgScene(ctx, t, 'sunset', 600, [1250, 520, 100]);
    drawShip(ctx, t, { x: 820, y: 700, scale: 0.75, preset: 'sunset' });
  } else if (SHOT === 'close') {
    bgScene(ctx, t, 'golden', 300, [1500, 120, 70]);
    drawShip(ctx, t, { x: 200, y: 1250, scale: 6.5, preset: 'golden' });
  } else if (SHOT === 'macro') {
    bgScene(ctx, t, 'golden', 300, [1500, 120, 70]);
    const pose = shipPoseFor(SHIP.hero, 960, 540, 300);
    drawShip(ctx, t, { ...pose, preset: 'golden', bob: 0 });
  } else if (SHOT === 'macro2') {
    bgScene(ctx, t, 'golden', 300, [1500, 120, 70]);
    const pose = shipPoseFor(SHIP.hero, 960, 540, 60);
    drawShip(ctx, t, { ...pose, preset: 'golden', bob: 0 });
  }
}
