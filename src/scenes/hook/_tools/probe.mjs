// Herramienta de prueba de HOOK: pose del barco, chimenea, silbato y pin en pantalla a distintos t.
import { boot } from '../../../../tools/node-env.mjs';
await boot({ scenes: false });
const { SHIP, shipPoint } = await import('../../../art/index.js');
const { seaCam } = await import('../reveal/cam.js');
const { shipPoseAt } = await import('../reveal/ship.js');
console.log('funnel', SHIP.funnel, 'horn', SHIP.horn, 'hero', SHIP.portholes[SHIP.hero]);
for (const t of [3.75, 4.0, 4.22, 4.45, 4.5, 4.69, 4.92, 5.15]) {
  const c0 = seaCam(t);
  const o = shipPoseAt(t, { ...c0, r: 0 });
  const f = shipPoint(o, SHIP.funnel.x, SHIP.funnel.top, t), h = shipPoint(o, SHIP.horn.x, SHIP.horn.y, t), b = shipPoint(o, SHIP.funnel.x, SHIP.funnel.base, t);
  console.log(t, 'ship', o.x.toFixed(0), o.y.toFixed(0), o.scale.toFixed(3), 'funnelTop', f.map((v) => v.toFixed(0)), 'base', b.map((v) => v.toFixed(0)), 'horn', h.map((v) => v.toFixed(0)));
}
