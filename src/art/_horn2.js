// Humo + bocinazo v2 alrededor de reveal.horn (4,69). t < 100 → golden; t ≥ 100 → day (t − 100).
//   node tools/sandbox.mjs --module=src/art/_horn2.js --from=4.6 --to=5.0 --step=0.05 --sheet --cols=3
import { drawSky } from './sky.js';
import { drawOcean } from './ocean.js';
import { drawShip } from './ship.js';
export function draw(ctx, t0) {
  const preset = t0 >= 100 ? 'day' : 'golden';
  const t = t0 >= 100 ? t0 - 100 : t0;
  drawSky(ctx, t, { preset, horizonY: 640, sunX: 1500, sunY: 230 });
  drawOcean(ctx, t, { preset, horizonY: 640, sunX: 1500, sunY: 230 });
  drawShip(ctx, t, { x: 1000, y: 700, scale: 0.8, preset, horn: 4.69, smoke: 0.35, wind: 1.6 });
  ctx.font = '600 30px Outfit'; ctx.fillStyle = 'rgba(4,16,31,0.6)'; ctx.fillRect(20, 20, 330, 44);
  ctx.fillStyle = '#FFE9B8'; ctx.fillText(`${preset} · t ${t.toFixed(2)} · horn 4,69`, 32, 52);
}
