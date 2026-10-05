// Mide cuánto tarda cada escena activa dentro del entorno real (todas las escenas iniciadas), con rasterizado
// forzado, y promedia el costo de las de HOOK. Uso: node src/scenes/hook/reveal/_comp.mjs --from=3.5 --to=5.9 --step=0.1
import { boot, parseArgs } from '../../../../tools/node-env.mjs';

const flags = parseArgs();
const B = await boot();
const { layer, resetLayers } = await import('../../../engine/layer.js');
const ts = [];
if (flags.t) ts.push(...String(flags.t).split(',').map(Number));
else for (let t = Number(flags.from ?? 3.5); t <= Number(flags.to ?? 5.9) + 1e-9; t += Number(flags.step ?? 0.1)) ts.push(+t.toFixed(4));
const sum = {};
for (const t of ts) {
  if (flags.gc && globalThis.gc) globalThis.gc();
  resetLayers();
  const row = [];
  for (const s of B.activeScenes(t)) {
    const L = layer();
    const c = L.getContext('2d');
    c.getImageData(0, 0, 1, 1);
    const a = performance.now();
    s.draw(c, t);
    if (s.mask) s.mask(layer().getContext('2d'), t);
    if (s.over) s.over(c, t);
    c.getImageData(0, 0, 1, 1);
    const ms = performance.now() - a;
    (sum[s.id] ??= []).push(ms);
    row.push(`${s.id} ${ms.toFixed(0)}`);
  }
  console.log(`t=${t.toFixed(3)} ` + row.join(' · '));
}
for (const [id, v] of Object.entries(sum)) console.log(`${id}: n ${v.length} · prom ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)} ms · máx ${Math.max(...v).toFixed(0)}`);
