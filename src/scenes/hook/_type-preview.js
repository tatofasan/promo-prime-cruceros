// Banco de pruebas: la oficina con una pregunta de ejemplo en la zona de TYPE, para revisar la legibilidad.
// (Solo para mirar: el texto real lo hace TYPE en type-hook.js.)
import scene from '../hook-office.js';
import { txt, drawText } from '../../engine/text.js';
import { PAL } from '../../engine/color.js';

export async function init() { await scene.init(); }
export function draw(ctx, t) {
  ctx.save();
  scene.draw(ctx, t);
  ctx.restore();
  const shadow = { color: 'rgba(4,16,31,0.75)', blur: 22, x: 0, y: 8 };
  drawText(ctx, txt('¿Y SI', { size: 150, weight: 900, tracking: -0.02 }), { t: 5, x: 110, y: 300, anim: 'none', fill: PAL.grey200, extrude: { depth: 8, color: PAL.navy800 }, shadow });
  drawText(ctx, txt('TUS PRÓXIMAS', { size: 120, weight: 900, tracking: -0.02 }), { t: 5, x: 110, y: 470, anim: 'none', fill: PAL.white, extrude: { depth: 8, color: PAL.navy800 }, shadow });
  drawText(ctx, txt('VACACIONES…', { size: 130, weight: 900, tracking: -0.02 }), { t: 5, x: 110, y: 620, anim: 'none', fill: PAL.gold, extrude: { depth: 8, color: PAL.navy800 }, shadow });
}
