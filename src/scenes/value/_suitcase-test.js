// Banco de pruebas: valija con calcos sobre cian.
import { PAL } from '../../engine/color.js';
import { initSuitcase, drawSuitcase } from './suitcase.js';
import { initStickers, drawSticker, drawSlapLines } from './stickers.js';
export const bg = PAL.brandCyan;
export async function init() { initSuitcase(); initStickers(); }
export function draw(ctx, t) {
  ctx.save();
  ctx.translate(960, 900);
  drawSuitcase(ctx, {
    tagAng: Math.sin(t * 4) * 0.3,
    front: (c) => { for (let i = 0; i < 3; i++) { drawSticker(c, t, i); drawSlapLines(c, t, i); } },
  });
  ctx.restore();
}
