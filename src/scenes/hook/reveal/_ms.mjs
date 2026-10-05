// ms por cuadro del tramo de HOOK (oficina + mar + ola, armado como el compositor) SIN las escenas de los demás
// equipos iniciadas. Uso: node src/scenes/hook/reveal/_ms.mjs --from=3.5 --to=5.9 --step=0.0667
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { root, parseArgs } from '../../../../tools/node-env.mjs';

const flags = parseArgs();
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers } = await imp('src/engine/layer.js');
const solo = await imp('src/scenes/hook/reveal/_solo.js');
await solo.init();
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
const v = [];
const list = flags.t ? String(flags.t).split(',').map(Number) : [];
if (!list.length) for (let t = Number(flags.from ?? 3.5); t <= Number(flags.to ?? 5.9) + 1e-9; t += Number(flags.step ?? 1 / 15)) list.push(t);
for (const t of list) {
  if (flags.gc && globalThis.gc) globalThis.gc();
  resetLayers();
  ctx.getImageData(0, 0, 1, 1);
  const a = performance.now();
  solo.draw(ctx, t);
  ctx.getImageData(0, 0, 1, 1);
  v.push([+t.toFixed(3), performance.now() - a]);
  if (flags.mem) console.log(t.toFixed(3), 'rss', (process.memoryUsage().rss / 1e6).toFixed(0), 'ext', (process.memoryUsage().external / 1e6).toFixed(0));
}
const ms = v.map((x) => x[1]);
console.log(v.map(([t, m]) => `${t}:${m.toFixed(0)}`).join(' '));
console.log(`prom ${(ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(1)} ms · máx ${Math.max(...ms).toFixed(0)} · n ${ms.length}`);
