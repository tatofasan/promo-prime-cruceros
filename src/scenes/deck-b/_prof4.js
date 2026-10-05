// Perfil por sección del escenario (con flush).
import { initGrain } from './grain.js';
import { initStage, drawStage } from './stage.js';
import { resetLayers } from '../../engine/layer.js';
export async function init() { initGrain(); initStage(); }
export function draw(ctx, t) {
  const tot = {};
  for (let k = 0; k < 3; k++) {
    resetLayers();
    let a = performance.now();
    const lap = (n) => { ctx.getImageData(0, 0, 1, 1); const b = performance.now(); tot[n] = (tot[n] || 0) + (b - a) / 3; a = b; };
    drawStage(ctx, t, lap);
  }
  console.error(t, JSON.stringify(Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, +v.toFixed(1)]))));
}
