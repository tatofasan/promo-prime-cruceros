// Mide el costo propio de la escena show (con flush) contra un cuadro vacío, intercalados.
import show from '../show.js';
import { resetLayers } from '../../engine/layer.js';
export async function init() { await show.init(); }
export function draw(ctx, t) {
  const ts = [];
  for (let x = 9.375; x < 11.25; x += 0.0667) ts.push(+x.toFixed(4));
  const own = [], base = [];
  for (const tt of ts) {
    resetLayers();
    let a = performance.now();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1920, 1080); ctx.getImageData(0, 0, 1, 1);
    base.push(performance.now() - a);
    resetLayers();
    a = performance.now();
    ctx.save(); show.draw(ctx, tt); ctx.restore(); ctx.getImageData(0, 0, 1, 1);
    own.push([tt, performance.now() - a]);
  }
  const avg = own.reduce((s, x) => s + x[1], 0) / own.length;
  console.error(JSON.stringify({ avgOwn: +avg.toFixed(1), baseClear: +(base.reduce((s, x) => s + x, 0) / base.length).toFixed(1), worst: own.sort((p, q) => q[1] - p[1]).slice(0, 6).map(([a, b]) => [a, +b.toFixed(0)]) }));
}
