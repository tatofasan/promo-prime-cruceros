// Hoja de muestras: cielo + sol + mar en los 5 presets y un push-in. node tools/sandbox.mjs --module=src/art/_sheet-sea.js
import { W, H } from '../engine/time.js';
import { drawSky, skyPoint } from './sky.js';
import { drawSun } from './sun.js';
import { drawOcean } from './ocean.js';
import { camZ } from './util.js';

const CELLS = [
  { preset: 'day', sunX: 1500, sunY: 230, r: 70 },
  { preset: 'golden', sunX: 1450, sunY: 300, r: 80 },
  { preset: 'sunset', sunX: 960, sunY: 560, r: 110 },
  { preset: 'dusk', sunX: 1100, sunY: 640, r: 90 },
  { preset: 'night', sunX: 1400, sunY: 200, r: 50 },
  { preset: 'golden', sunX: 1450, sunY: 300, r: 80, cam: { x: 120, y: 40, z: 1.8, r: 0.01 } },
];

export function scene(ctx, t, c) {
  const cam = c.cam;
  const horizonY = 640;
  drawSky(ctx, t, { preset: c.preset, horizonY, sunX: c.sunX, sunY: c.sunY, cam });
  const [sx, sy] = skyPoint(cam, c.sunX, c.sunY);
  drawSun(ctx, t, sx, sy, c.r * camZ(cam, 0.08), { preset: c.preset, flare: 0.7, horizon: c.preset === 'sunset' || c.preset === 'dusk' ? skyPoint(cam, 0, horizonY)[1] : undefined });
  drawOcean(ctx, t, { preset: c.preset, horizonY, cam, sunX: c.sunX, sunY: c.sunY });
}

export function draw(ctx, t) {
  const s = 1 / 3;
  CELLS.forEach((c, i) => {
    ctx.save();
    ctx.translate((i % 3) * W * s, Math.floor(i / 3) * H * s);
    ctx.scale(s, s);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    scene(ctx, t, c);
    ctx.restore();
  });
}
