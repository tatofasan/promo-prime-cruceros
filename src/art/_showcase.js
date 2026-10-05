// Escenas de muestra armadas SOLO con el kit (cómo se ve todo junto). ART_SC = reveal | sunset | close | dusk
import { prog } from '../engine/ease.js';
import { handheld } from '../engine/camera.js';
import { plane } from '../engine/camera.js';
import { drawSky, skyPoint } from './sky.js';
import { drawSun } from './sun.js';
import { drawClouds } from './clouds.js';
import { drawOcean, seaDepth } from './ocean.js';
import { drawShip } from './ship.js';
import { drawGulls } from './gulls.js';
import { drawIsland } from './tropics.js';
import { mixPreset } from './presets.js';
import { camZ } from './util.js';

const SC = globalThis.process?.env?.ART_SC ?? 'reveal';

export function draw(ctx, t) {
  if (SC === 'reveal') {
    const P = 'golden', hz = 650, sun = [1480, 250];
    const cam = handheld({ x: 0, y: 0, z: 1 + 0.06 * t }, t, { amp: 4 });
    drawSky(ctx, t, { preset: P, horizonY: hz, sunX: sun[0], sunY: sun[1], cam });
    drawClouds(ctx, t, { preset: P, cam, depth: 0.1, seed: 3, y: 600, scale: 0.36, alpha: 0.65, density: 1.1, spread: 40 });
    const [sx, sy] = skyPoint(cam, sun[0], sun[1]);
    drawSun(ctx, t, sx, sy, 72 * camZ(cam, 0.08), { preset: P, flare: 0.7 });
    drawClouds(ctx, t, { preset: P, cam, depth: 0.16, seed: 2, y: 470, scale: 0.62, alpha: 0.92, density: 0.7, spread: 80 });
    drawClouds(ctx, t, { preset: P, cam, depth: 0.24, seed: 1, y: 230, scale: 1.0, density: 0.45, spread: 120, x0: -300, x1: 1300 });
    drawOcean(ctx, t, { preset: P, horizonY: hz, cam, sunX: sun[0], sunY: sun[1] });
    plane(ctx, cam, seaDepth(hz + 26, hz), (c) => drawShip(c, t, { x: 1010, y: hz + 26, scale: 0.44, preset: P, horn: 0.4, smoke: 0.3 }));
    drawGulls(ctx, t, { preset: P, count: 6, area: { x: 0, y: 140, w: 1920, h: 320 }, scale: 0.75, seed: 5 });
  } else if (SC === 'sunset') {
    const P = 'sunset', hz = 640, sun = [1180, 560];
    const cam = { x: 0, y: 0, z: 1 };
    drawSky(ctx, t, { preset: P, horizonY: hz, sunX: sun[0], sunY: sun[1], cam });
    drawClouds(ctx, t, { preset: P, cam, depth: 0.1, seed: 3, y: 560, scale: 0.4, alpha: 0.75, density: 1.1, spread: 40 });
    drawClouds(ctx, t, { preset: P, cam, depth: 0.18, seed: 2, y: 330, scale: 0.8, density: 0.6, spread: 120 });
    const [sx, sy] = skyPoint(cam, sun[0], sun[1]);
    drawSun(ctx, t, sx, sy, 130, { preset: P, flare: 0.9, horizon: hz });
    drawOcean(ctx, t, { preset: P, horizonY: hz, cam, sunX: sun[0], sunY: sun[1] });
    drawIsland(ctx, t, 330, hz + 8, 0.55, { preset: P, palms: 3 });
    drawShip(ctx, t, { x: 1500, y: hz + 14, scale: 0.26, preset: P, dir: -1 });
    drawGulls(ctx, t, { preset: P, count: 5, area: { x: 200, y: 150, w: 1500, h: 300 }, scale: 0.9 });
  } else if (SC === 'close') {
    const P = mixPreset('golden', 'sunset', 0.55), hz = 640, sun = [1350, 470];
    const cam = { x: 0, y: 0, z: 1 };
    drawSky(ctx, t, { preset: P, horizonY: hz, sunX: sun[0], sunY: sun[1], cam });
    drawClouds(ctx, t, { preset: P, cam, depth: 0.12, seed: 3, y: 560, scale: 0.4, alpha: 0.75, density: 1.2, spread: 50 });
    drawClouds(ctx, t, { preset: P, cam, depth: 0.2, seed: 1, y: 250, scale: 0.9, density: 0.5, spread: 100 });
    const [sx, sy] = skyPoint(cam, sun[0], sun[1]);
    drawSun(ctx, t, sx, sy, 95, { preset: P, flare: 1 });
    drawOcean(ctx, t, { preset: P, horizonY: hz, cam, sunX: sun[0], sunY: sun[1] });
    drawShip(ctx, t, { x: 760, y: hz + 40, scale: 0.62, preset: P, smoke: 0.3 });
    drawGulls(ctx, t, { preset: P, count: 4, area: { x: 0, y: 160, w: 1920, h: 260 }, scale: 0.8 });
  } else if (SC === 'dusk') {
    const P = 'dusk', hz = 620, sun = [1500, 650];
    drawSky(ctx, t, { preset: P, horizonY: hz, sunX: sun[0], sunY: sun[1] });
    drawClouds(ctx, t, { preset: P, depth: 0.15, seed: 2, y: 420, scale: 0.7, density: 0.7 });
    drawOcean(ctx, t, { preset: P, horizonY: hz, sunX: sun[0], sunY: sun[1] });
    drawShip(ctx, t, { x: 900, y: hz + 60, scale: 0.9, preset: P, dir: -1 });
  }
}
