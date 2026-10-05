// Medición del costo PROPIO de las escenas de TYPE (sin las de los demás): dibuja type-hook / type-exp sobre un
// fondo plano y fuerza el rasterizado leyendo un píxel (napi graba comandos y rasteriza al leer).
//   node src/scenes/type/_prof.mjs --from=0 --to=13.1 --step=0.05
import { createCanvas } from '@napi-rs/canvas';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { boot, parseArgs, root } from '../../../tools/node-env.mjs';

const f = parseArgs();
await boot();
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const hook = (await imp('src/scenes/type-hook.js')).default;
const exp = (await imp('src/scenes/type-exp.js')).default;
const { resetLayers } = await imp('src/engine/layer.js');
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
const from = Number(f.from ?? 0), to = Number(f.to ?? 13.1), step = Number(f.step ?? 0.05);
const rows = [];
for (let t = from; t <= to + 1e-9; t += step) {
  resetLayers();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#336699';
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.getImageData(0, 0, 1, 1);
  const a = performance.now();
  for (const s of [hook, exp]) if (t >= s.from && t < s.to) { ctx.save(); s.draw(ctx, t); ctx.restore(); }
  ctx.getImageData(0, 0, 1, 1);
  rows.push([+t.toFixed(3), performance.now() - a]);
}
const v = rows.map((r) => r[1]);
const avg = v.reduce((s, x) => s + x, 0) / v.length;
console.log(JSON.stringify({ frames: v.length, msAvg: +avg.toFixed(2), msMax: +Math.max(...v).toFixed(2),
  slow: rows.sort((a, c) => c[1] - a[1]).slice(0, 8).map(([t, m]) => ({ t, ms: +m.toFixed(1) })) }, null, 1));
