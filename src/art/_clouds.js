// Muestras de nubes en 3 capas y 5 presets.
import { W, H } from '../engine/time.js';
import { drawSky, skyPoint } from './sky.js';
import { drawSun } from './sun.js';
import { drawOcean } from './ocean.js';
import { drawClouds } from './clouds.js';

const CELLS = [
  { preset: 'day', sun: [1500, 230, 70] },
  { preset: 'golden', sun: [1450, 300, 80] },
  { preset: 'sunset', sun: [960, 560, 110] },
  { preset: 'dusk', sun: [1100, 640, 90] },
  { preset: 'night', sun: [1400, 200, 50] },
  { preset: 'golden', sun: [1450, 300, 80], cam: { x: 80, y: 30, z: 1.5 } },
];
export function cell(ctx, t, c) {
  const hz = 640, cam = c.cam;
  drawSky(ctx, t, { preset: c.preset, horizonY: hz, sunX: c.sun[0], sunY: c.sun[1], cam });
  const [sx, sy] = skyPoint(cam, c.sun[0], c.sun[1]);
  drawClouds(ctx, t, { preset: c.preset, cam, depth: 0.1, seed: 3, y: 560, scale: 0.4, alpha: 0.7, density: 1.2, spread: 50 });
  drawSun(ctx, t, sx, sy, c.sun[2], { preset: c.preset, flare: 0.5 });
  drawClouds(ctx, t, { preset: c.preset, cam, depth: 0.16, seed: 2, y: 420, scale: 0.7, alpha: 0.92, density: 0.8, spread: 90 });
  drawClouds(ctx, t, { preset: c.preset, cam, depth: 0.24, seed: 1, y: 230, scale: 1.1, density: 0.5, spread: 140 });
  drawOcean(ctx, t, { preset: c.preset, horizonY: hz, cam, sunX: c.sun[0], sunY: c.sun[1] });
}
export function draw(ctx, t) {
  const one = globalThis.process?.env?.ART_CELL;
  if (one !== undefined) { cell(ctx, t, CELLS[Number(one)]); return; }
  const s = 1 / 3;
  CELLS.forEach((c, i) => {
    ctx.save();
    ctx.translate((i % 3) * W * s, Math.floor(i / 3) * H * s);
    ctx.scale(s, s);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    cell(ctx, t, c);
    ctx.restore();
  });
}
