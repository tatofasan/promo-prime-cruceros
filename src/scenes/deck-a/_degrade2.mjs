// Igual que _degrade pero con renderFrame completo (sin MAP) para ver si el compositor/grade degradan a Skia.
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
const wc = createCanvas(1920, 1080);
const c = wc.getContext('2d');
function witness() {
  c.getImageData(0, 0, 1, 1);
  const a = performance.now();
  for (let i = 0; i < 4; i++) { c.save(); c.translate(960, 540); c.rotate(0.01); c.scale(1.03, 1.03); c.translate(-1040, -580); c.drawImage(big, -340, -770); c.restore(); c.getImageData(0, 0, 1, 1); }
  return ((performance.now() - a) / 4).toFixed(1);
}
const { SCENES } = await imp('src/scenes/index.js');
const i = SCENES.findIndex((s) => s.id === 'map'); SCENES.splice(i, 1);
const comp = await imp('src/engine/compositor.js');
await comp.initScenes();
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
const mode = process.argv[2] ?? 'full';
const out = [`inicio ${witness()}`];
let n = 0;
for (let t = Number(process.argv[3] ?? 5.625); t < Number(process.argv[4] ?? 7.5); t += 1 / 15) {
  const a = performance.now();
  comp.renderFrame(ctx, t, { strict: true, fx: mode !== 'nofx' && mode !== 'onlygrade', grade: mode !== 'nograde' && mode !== 'nofx' });
  ctx.getImageData(0, 0, 1, 1);
  const ms = (performance.now() - a).toFixed(0);
  if (++n % 4 === 0) out.push(`${t.toFixed(2)}:${ms}/${witness()}`);
}
console.log(mode, out.join(' '));
