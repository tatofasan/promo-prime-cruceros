// Bisección por escena: qué init deja lento a Skia en el proceso (medido con el mismo pegado de 2108×2620).
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const { setEnv } = await import(pathToFileURL(join(root, 'src/engine/env.js')).href);
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const big = createCanvas(2108, 2620);
const b = big.getContext('2d');
for (let i = 0; i < 4000; i++) { b.fillStyle = `hsl(${i % 360},50%,50%)`; b.fillRect((i * 97) % 2100, (i * 53) % 2600, 40, 40); }
const cv = createCanvas(1920, 1080);
const c = cv.getContext('2d');
function time(name) {
  c.getImageData(0, 0, 1, 1);
  const a = performance.now();
  for (let i = 0; i < 6; i++) {
    c.save(); c.translate(960, 540); c.rotate(0.01); c.scale(1.03, 1.03); c.translate(-1040, -580); c.drawImage(big, -340, -770);
    c.restore(); c.getImageData(0, 0, 1, 1);
  }
  console.log(name.padEnd(14), ((performance.now() - a) / 6).toFixed(2), 'MB', (process.memoryUsage().rss / 1e6).toFixed(0));
}
time('inicio');
const { SCENES } = await import(pathToFileURL(join(root, 'src/scenes/index.js')).href);
time('import');
for (const s of SCENES) { if (s.id === process.argv[2]) continue; if (s.init) await s.init(); time(s.id); }
