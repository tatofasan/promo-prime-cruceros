// Muestra de figuras (sandbox).
import { drawFigure } from './figure.js';
import { SKIN, HAIR } from './pool-pal.js';
import { PAL } from '../../engine/color.js';
export const bg = '#45C3E3';
export function draw(ctx, t) {
  const poses = [
    { kind: 'one', skin: SKIN[0], hair: HAIR[0], hairStyle: 'long' },
    { kind: 'trunks', skin: SKIN[1], hair: HAIR[1], hairStyle: 'short', suit: PAL.coral, pose: { aL: [2.7, 0.2], aR: [2.6, 0.3], lL: [0.04, 0], lR: [0.04, 0] } },
    { kind: 'bikini', skin: SKIN[2], hair: HAIR[3], hairStyle: 'bun', suit: PAL.brandCyan, pose: { aL: [0.9, 1.2], aR: [0.5, 0.4], lL: [0.3, 0.4], lR: [0.05, 0] } },
  ];
  poses.forEach((o, i) => {
    ctx.save();
    ctx.translate(360 + i * 560, 640);
    ctx.scale(3.2, 3.2);
    drawFigure(ctx, { ...o, hairFloat: t * 3 });
    ctx.restore();
  });
}
