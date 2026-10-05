// Banco de pruebas: la pileta sola (draw + mask + over como el compositor), sin las demás escenas.
//   node src/scenes/deck-a/_sbx.mjs --module=src/scenes/deck-a/_pool.js --t=6.2 --out=shots/deck-a/solo
//   POOL_SKIP=over,mask para aislar costos.
import scene from '../pool.js';
import { layer } from '../../engine/layer.js';

const skip = (globalThis.process?.env?.POOL_SKIP ?? '').split(',');
export async function init() { await scene.init(); }
export function draw(ctx, t) {
  const L = layer();
  const lc = L.getContext('2d');
  scene.draw(lc, t);
  if (!skip.includes('mask')) {
    const M = layer();
    scene.mask(M.getContext('2d'), t);
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'destination-in';
    lc.drawImage(M, 0, 0);
  }
  ctx.drawImage(L, 0, 0);
  if (!skip.includes('over')) {
    ctx.save();
    scene.over(ctx, t);
    ctx.restore();
  }
}
