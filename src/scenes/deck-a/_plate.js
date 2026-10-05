// Banco de prueba: mantel + plato a escala 1 y a 2× (para revisar la comida de cerca).
import { buildCloth, CLOTH } from './cloth.js';
import { buildPlate, buildPlateLight, drawPlate } from './plate.js';
import { lightAng } from './util.js';

let cloth, P, PL;
export async function init() {
  cloth = buildCloth();
  const a = lightAng(960, 540);
  P = buildPlate([Math.cos(a), Math.sin(a)]);
  PL = buildPlateLight(a);
}
export function draw(ctx, t) {
  ctx.drawImage(cloth, CLOTH.x0, CLOTH.y0);
  const a = lightAng(960, 540);
  drawPlate(ctx, P, PL, 480, 540, t);
  ctx.save();
  ctx.translate(1420, 540);
  ctx.scale(2.2, 2.2);
  drawPlate(ctx, P, PL, 0, 0, t);
  ctx.restore();
}
