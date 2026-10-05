// Costo por escena en el pipeline completo SIN el init de MAP: node src/scenes/deck-a/_prof4.mjs 6.2 7.0
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
const i = SCENES.findIndex((s) => s.id === 'map'); SCENES.splice(i, 1);
const comp = await imp('src/engine/compositor.js');
await comp.initScenes();
const { layer, resetLayers } = await imp('src/engine/layer.js');
const { applyGrade } = await imp('src/engine/grade.js');
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
for (const t of process.argv.slice(2).map(Number)) {
  const row = [];
  for (const s of comp.activeScenes(t)) {
    let tot = 0;
    for (let k = 0; k < 3; k++) {
      resetLayers();
      const L = layer(); const c = L.getContext('2d'); c.getImageData(0, 0, 1, 1);
      const a = performance.now();
      s.draw(c, t);
      if (s.mask) { const M = layer(); s.mask(M.getContext('2d'), t); c.drawImage(M, 0, 0); }
      if (s.over) s.over(c, t);
      c.getImageData(0, 0, 1, 1);
      tot += performance.now() - a;
    }
    row.push(`${s.id} ${(tot / 3).toFixed(0)}`);
  }
  let a = performance.now(); applyGrade(ctx, t); ctx.getImageData(0, 0, 1, 1); const g = performance.now() - a;
  a = performance.now(); comp.renderFrame(ctx, t, { strict: true }); ctx.getImageData(0, 0, 1, 1); const full = performance.now() - a;
  a = performance.now(); ctx.getImageData(0, 0, 1920, 1080); const gid = performance.now() - a;
  console.log(t, '|', row.join(' | '), '| grade', g.toFixed(0), '| cuadro', full.toFixed(0), '| getImageData', gid.toFixed(0));
}
