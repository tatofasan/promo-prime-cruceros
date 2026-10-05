// Mide el tramo de la pileta con el pipeline completo, con y sin el init de MAP (que deja lento a Skia).
//   node src/scenes/deck-a/_nomap.mjs [sin|con]
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { SCENES } = await imp('src/scenes/index.js');
if ((process.argv[2] ?? 'sin') === 'sin') { const i = SCENES.findIndex((s) => s.id === 'map'); SCENES.splice(i, 1); }
const comp = await imp('src/engine/compositor.js');
await comp.initScenes();
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
const ms = [];
for (let t = 5.625; t < 7.5; t += 1 / 15) {
  const a = performance.now();
  comp.renderFrame(ctx, t, { strict: true });
  ctx.getImageData(0, 0, 1920, 1080);
  ms.push(performance.now() - a);
}
console.log(process.argv[2] ?? 'sin', 'avg', (ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(1), 'max', Math.max(...ms).toFixed(1));
