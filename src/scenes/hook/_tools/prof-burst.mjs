// Herramienta de prueba de HOOK: ms del reventón por partes (mínimo de N repeticiones).
import { boot, parseArgs } from '../../../../tools/node-env.mjs';
const f = parseArgs();
await boot();
const P = (p) => import(new URL(p, import.meta.url).href);
const { layer, resetLayers } = await P('../../../engine/layer.js');
const { plane } = await P('../../../engine/camera.js');
const Bu = await P('../burst.js');
const Pa = await P('../papers.js');
const Sc = await P('../screen.js');
const { camAt } = await P('../camera.js');
Bu.initBurst(); Pa.initPapers(); Sc.initScreen();
const n = Number(f.n ?? 4);
for (const t of String(f.t ?? '3.45').split(',').map(Number)) {
  const cam = camAt(t);
  const parts = { burst: (c) => plane(c, cam, 1, (g) => Bu.drawBurst(g, t)), storm: (c) => plane(c, cam, 1, (g) => Pa.drawPaperStorm(g, t)), screen: (c) => plane(c, cam, 1, (g) => Sc.drawScreen(g, t)) };
  const row = { t };
  for (const [name, fn] of Object.entries(parts)) {
    let best = 1e9;
    for (let i = 0; i < n; i++) { resetLayers(); const L = layer(); const c = L.getContext('2d'); const a = performance.now(); fn(c); c.getImageData(0, 0, 1, 1); best = Math.min(best, performance.now() - a); }
    row[name] = +best.toFixed(1);
  }
  console.log(JSON.stringify(row));
}
