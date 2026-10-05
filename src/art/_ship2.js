// Barco v2 (marca y luz): t 0 golden 550 px · 1 golden 1000 px · 2 sunset 550 px (luces) · 3 day 340 px (lejos).
import { drawSky } from './sky.js';
import { drawOcean } from './ocean.js';
import { drawShip } from './ship.js';
const SHOTS = [
  { preset: 'golden', scale: 0.55, x: 1050 }, { preset: 'golden', scale: 1.0, x: 1150 },
  { preset: 'sunset', scale: 0.55, x: 1050 }, { preset: 'day', scale: 0.34, x: 1100 },
];
export function draw(ctx, t) {
  const S = SHOTS[Math.round(t) % 4];
  drawSky(ctx, 1, { preset: S.preset, horizonY: 640, sunX: 1650, sunY: S.preset === 'sunset' ? 560 : 230 });
  drawOcean(ctx, 1, { preset: S.preset, horizonY: 640, sunX: 1650, sunY: S.preset === 'sunset' ? 560 : 230 });
  drawShip(ctx, 1.3, { x: S.x, y: 668, scale: S.scale, preset: S.preset, smoke: 0.35 });
  ctx.font = '600 28px Outfit'; ctx.fillStyle = 'rgba(4,16,31,0.6)'; ctx.fillRect(20, 20, 420, 42);
  ctx.fillStyle = '#FFE9B8'; ctx.fillText(`${S.preset} · eslora ${Math.round(S.scale * 1000)} px`, 32, 50);
}
