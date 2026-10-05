// Demo del push-in de HOOK al ojo de buey: barco en el horizonte → ojo de buey (960, 540) r = 300.
// t = progreso 0..1 (con easing expo). Muestra que SHIP/shipZoom alcanzan para encuadrar exacto.
import { E } from '../engine/ease.js';
import { drawSky, skyPoint } from './sky.js';
import { drawSun } from './sun.js';
import { drawOcean } from './ocean.js';
import { drawShip, shipZoom } from './ship.js';
import { drawPorthole } from './porthole.js';

const START = { x: 1150, y: 662, scale: 0.34, preset: 'golden' };
export function draw(ctx, t) {
  const k = E.inOutCubic(Math.min(1, Math.max(0, t)));
  const cam = { x: 0, y: 0, z: 1 + 0.6 * k };
  drawSky(ctx, t, { preset: 'golden', horizonY: 640, sunX: 1500, sunY: 230, cam });
  const [sx, sy] = skyPoint(cam, 1500, 230);
  drawSun(ctx, t, sx, sy, 70, { preset: 'golden', flare: 0.6 });
  drawOcean(ctx, t, { preset: 'golden', horizonY: 640, sunX: 1500, sunY: 230, cam });
  const o = shipZoom(START, k);
  drawShip(ctx, t * 2, o);
  if (t >= 1) {
    ctx.strokeStyle = 'rgba(255,0,80,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(960, 540, 300, 0, Math.PI * 2); ctx.stroke();
  }
}
