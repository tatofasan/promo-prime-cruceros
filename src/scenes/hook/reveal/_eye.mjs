// Verifica el ojo de buey del match cut: en 5,625 tiene que estar en (960, 540) con vidrio r 300.
import { Path2D, DOMMatrix } from '@napi-rs/canvas';
globalThis.Path2D = Path2D; globalThis.DOMMatrix ??= DOMMatrix;
const { shipPoseAt } = await import('./ship.js');
const { seaCam, pushK } = await import('./cam.js');
const { shipPorthole, SHIP } = await import('../../../art/index.js');
for (const t of [5.5, 5.6, 5.608, 5.625, 5.7, 5.9]) {
  const c0 = seaCam(t);
  const o = shipPoseAt(t, { ...c0, r: 0 });
  const e = shipPorthole(o, SHIP.hero, t);
  console.log(t, 'k', pushK(t).toFixed(4), 'eye', e.x.toFixed(2), e.y.toFixed(2), 'r', e.r.toFixed(2), 'roll', (c0.r * (1 - pushK(t)) ** 2).toFixed(5));
}
