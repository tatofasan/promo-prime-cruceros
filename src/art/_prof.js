// Tiempos por componente: ART_PROF=sky|sun|clouds3|ocean|shipFar|shipMid|shipClose|shipMacro|gulls6|island|porthole|wave
import { drawSky } from './sky.js';
import { drawSun } from './sun.js';
import { drawClouds } from './clouds.js';
import { drawOcean } from './ocean.js';
import { drawShip, shipPoseFor, SHIP } from './ship.js';
import { drawGulls } from './gulls.js';
import { drawIsland } from './tropics.js';
import { drawPorthole } from './porthole.js';
import { HOOK_WAVE } from '../scenes/waves.js';
import { drawWaveMask, drawWaveCrest } from './wave.js';
const K = globalThis.process?.env?.ART_PROF ?? 'sky';
const P = 'golden';
const F = {
  sky: (c, t) => drawSky(c, t, { preset: P, horizonY: 640, sunX: 1450, sunY: 260 }),
  sun: (c, t) => drawSun(c, t, 1450, 260, 80, { preset: P, flare: 0.7 }),
  clouds3: (c, t) => { drawClouds(c, t, { preset: P, depth: 0.1, seed: 3, y: 560, scale: 0.4 }); drawClouds(c, t, { preset: P, depth: 0.16, seed: 2, y: 420, scale: 0.7 }); drawClouds(c, t, { preset: P, depth: 0.24, seed: 1, y: 230, scale: 1.1 }); },
  ocean: (c, t) => drawOcean(c, t, { preset: P, horizonY: 640, sunX: 1450, sunY: 260 }),
  shipFar: (c, t) => drawShip(c, t, { x: 1000, y: 666, scale: 0.34, preset: P }),
  shipMid: (c, t) => drawShip(c, t, { x: 900, y: 760, scale: 1.0, preset: P, horn: t - 0.3 }),
  shipClose: (c, t) => drawShip(c, t, { x: 200, y: 1250, scale: 6.5, preset: P }),
  shipMacro: (c, t) => drawShip(c, t, { ...shipPoseFor(SHIP.hero, 960, 540, 300), preset: P, bob: 0 }),
  gulls6: (c, t) => drawGulls(c, t, { preset: P, count: 6 }),
  island: (c, t) => drawIsland(c, t, 600, 700, 1, { preset: P, palms: 3 }),
  porthole: (c, t) => drawPorthole(c, t, 960, 540, 300, { preset: P }),
  wave: (c, t) => { const p = HOOK_WAVE.p(t); drawWaveMask(c, p, { dir: 'rtl' }); drawWaveCrest(c, t, p, { dir: 'rtl', preset: P }); },
};
export function draw(ctx, t) { F[K](ctx, t); }
