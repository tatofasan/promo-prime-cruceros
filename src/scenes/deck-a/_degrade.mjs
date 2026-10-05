// ¿Qué escena degrada a Skia DURANTE el render? Dibuja N cuadros de una escena y mide un pegado testigo.
//   node src/scenes/deck-a/_degrade.mjs pool 5.625 7.5
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
const big = createCanvas(2108, 2620);
const b = big.getContext('2d');
for (let i = 0; i < 4000; i++) { b.fillStyle = `hsl(${i % 360},50%,50%)`; b.fillRect((i * 97) % 2100, (i * 53) % 2600, 40, 40); }
const cv = createCanvas(1920, 1080);
const c = cv.getContext('2d');
function witness() {
  c.getImageData(0, 0, 1, 1);
  const a = performance.now();
  for (let i = 0; i < 4; i++) {
    c.save(); c.translate(960, 540); c.rotate(0.01); c.scale(1.03, 1.03); c.translate(-1040, -580); c.drawImage(big, -340, -770);
    c.restore(); c.getImageData(0, 0, 1, 1);
  }
  return ((performance.now() - a) / 4).toFixed(1);
}
const [id, t0, t1] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const S = (await imp(`src/scenes/${id}.js`)).default;
await S.init();
const { layer, resetLayers } = await imp('src/engine/layer.js');
const out = [`inicio ${witness()}`];
let n = 0;
for (let t = t0; t < t1; t += 1 / 15) {
  resetLayers();
  const L = layer(); const lc = L.getContext('2d');
  S.draw(lc, t);
  if (S.mask) { const M = layer(); S.mask(M.getContext('2d'), t); lc.drawImage(M, 0, 0); }
  if (S.over) S.over(lc, t);
  lc.getImageData(0, 0, 1, 1);
  if (++n % 5 === 0) out.push(`${t.toFixed(2)}:${witness()}`);
}
console.log(id, out.join(' '));
