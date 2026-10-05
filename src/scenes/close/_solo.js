// Banco de pruebas del cierre SOLO (sin las demás escenas): para cuando la pieza completa no arranca por un
// módulo de otro equipo a medio editar.  node tools/sandbox.mjs --module=src/scenes/close/_solo.js --t=27
// (si la cresta de ART falla, dibuja el pin sin la cresta y lo avisa en consola)
import scene, { uiCam } from '../close.js';
import { plane } from '../../engine/camera.js';
import { drawPinDrop } from './pin-drop.js';
import { lockupGeo } from './layout.js';
export async function init() { await scene.init(); }
export function draw(ctx, t) {
  ctx.save(); scene.draw(ctx, t); ctx.restore();
  ctx.save();
  try { scene.over(ctx, t); } catch (e) {
    ctx.restore(); ctx.save();
    console.error('[solo] cresta de ART falló en', t, String(e.message).slice(0, 80));
    plane(ctx, uiCam(t), 1, (c) => drawPinDrop(c, t, lockupGeo()));
  }
  ctx.restore();
}
