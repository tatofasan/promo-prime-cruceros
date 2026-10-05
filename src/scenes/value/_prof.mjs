// Perfil de VALOR: costo de dibujar la escena (forzando el raster con getImageData de 1 px).
import { createCanvas, Path2D, GlobalFonts, DOMMatrix, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from '../../../tools/node-env.mjs';
globalThis.Path2D = Path2D; globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers } = await imp('src/engine/layer.js');
const { applyGrade } = await imp('src/engine/grade.js');
const scene = (await imp('src/scenes/value.js')).default;
await scene.init();
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
const ts = process.argv.slice(2).map(Number);
const run = (fn) => { let best = 1e9; for (let k = 0; k < 4; k++) { resetLayers(); ctx.setTransform(1, 0, 0, 1, 0, 0); const a = performance.now(); fn(); ctx.getImageData(0, 0, 1, 1); best = Math.min(best, performance.now() - a); } return best.toFixed(1); };
console.log('grade only', run(() => applyGrade(ctx, 21)), 'getImageData full', run(() => ctx.getImageData(0, 0, 1920, 1080)));
for (const t of ts) console.log(t, 'scene', run(() => scene.draw(ctx, t)));
// partes sueltas
const bg = await imp('src/scenes/value/bg.js');
const cs = await imp('src/scenes/value/beat-case.js');
const ps = await imp('src/scenes/value/beat-pass.js');
const pr = await imp('src/scenes/value/beat-pro.js');
const cam = { x: 0, y: 0, z: 1, r: 0 };
for (const [name, t, fn] of [
  ['theme0', 21.6, () => bg.drawTheme(ctx, 21.6, 0, cam)],
  ['theme1', 23.5, () => bg.drawTheme(ctx, 23.5, 1, cam)],
  ['theme2', 25.0, () => bg.drawTheme(ctx, 25.0, 2, cam)],
  ['caseHead', 21.6, () => cs.drawCaseHeadline(ctx, 21.6)],
  ['case', 21.6, () => cs.drawCase(ctx, 21.6)],
  ['pass 23.2', 23.2, () => ps.drawPass(ctx, 23.2)],
  ['pass 23.5', 23.5, () => ps.drawPass(ctx, 23.5)],
  ['passHead', 23.5, () => ps.drawPassHeadline(ctx, 23.5)],
  ['pro', 25.0, () => pr.drawPro(ctx, 25.0)],
  ['proHead', 25.0, () => pr.drawProHeadline(ctx, 25.0)],
]) console.log(name, run(fn));
