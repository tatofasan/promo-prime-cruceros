// Banco de pruebas: tarjeta de embarque con contador y sello sobre coral.
import { PAL } from '../../engine/color.js';
import { initTicket, drawTicket, drawLooseStub } from './ticket.js';
import { initStamp, drawStampImprint } from './stamp.js';
export const bg = PAL.coral;
export async function init() { initTicket(); initStamp(); }
export function draw(ctx, t) {
  ctx.save();
  ctx.translate(960, 600);
  ctx.rotate(-0.05);
  drawTicket(ctx, {
    fields: [1, 1, t],
    odo: t < 2 ? 355 * Math.min(1, t) : null,
    tear: t > 2.5 ? { gone: true } : { a: t > 2 ? 0.05 : 0 },
    stamp: t >= 2 ? (c, x, y) => { c.save(); c.translate(x, y); c.rotate(-0.09); drawStampImprint(c, { k: 0.9 }); c.restore(); } : null,
  });
  if (t > 2.5) drawLooseStub(ctx, { x: 200, y: -200, r: 0.6, s: 1.05, smear: 30 });
  ctx.restore();
}
