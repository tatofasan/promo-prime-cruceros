// Herramienta de prueba de HOOK: ms por escena (mínimo de N repeticiones, para restar el ruido de la máquina).
// Uso: node --import ./src/scenes/hook/_tools/reg.mjs src/scenes/hook/_tools/prof.mjs --t=0.5,3.4 [--n=3]
import { boot, parseArgs } from '../../../../tools/node-env.mjs';
const f = parseArgs();
const B = await boot();
const { SCENES } = await import('../../index.js');
const { layer, resetLayers } = await import('../../../engine/layer.js');
const ts = String(f.t ?? '0.5').split(',').map(Number);
const n = Number(f.n ?? 3);
for (const t of ts) {
  const row = { t };
  for (const s of SCENES) {
    if (!(t >= s.from && t < s.to)) continue;
    let best = 1e9;
    for (let k = 0; k < n; k++) {
      resetLayers();
      const L = layer();
      const c = L.getContext('2d');
      const a = performance.now();
      c.save(); s.draw(c, t); if (s.over) s.over(c, t); c.restore();
      c.getImageData(0, 0, 1, 1);
      best = Math.min(best, performance.now() - a);
    }
    row[s.id] = +best.toFixed(1);
  }
  let best = 1e9;
  for (let k = 0; k < n; k++) { const a = performance.now(); B.touch(t); best = Math.min(best, performance.now() - a); }
  row.frame = +best.toFixed(1);
  console.log(JSON.stringify(row));
}
