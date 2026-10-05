// Réplica mínima del compositor sólo con el cierre (para medir sin depender de las demás escenas).
//   node [--expose-gc] src/scenes/close/_pipe.mjs [desde] [hasta] [pasadas]
import { createCanvas, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
globalThis.Path2D = Path2D; globalThis.DOMMatrix ??= DOMMatrix;
const fonts = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of fonts.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const { setEnv } = await import('../../engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h) });
const { resetLayers, layer } = await import('../../engine/layer.js');
const { applyGrade } = await import('../../engine/grade.js');
const { fxAt } = await import('../../engine/fx.js');
const scene = (await import('../close.js')).default;
await scene.init();
const W = 1920, H = 1080;
const out = createCanvas(W, H), octx = out.getContext('2d');
function frame(t) {
  resetLayers();
  const stage = layer(), sc = stage.getContext('2d');
  sc.fillStyle = '#04101F'; sc.fillRect(0, 0, W, H);
  const L = layer(), lc = L.getContext('2d');
  if (!process.env.NODRAW) scene.draw(lc, t);
  const M = layer();
  scene.mask(M.getContext('2d'), t);
  lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'destination-in'; lc.drawImage(M, 0, 0);
  sc.drawImage(L, 0, 0);
  if (!process.env.NOOVER) { sc.save(); scene.over(sc, t); sc.restore(); }
  fxAt(t);
  octx.drawImage(stage, 0, 0);
  if (!process.env.NOGRADE) applyGrade(octx, t);
  return process.env.NOREAD ? octx.getImageData(0, 0, 1, 1).data : octx.getImageData(0, 0, W, H).data;
}
const [a = 27, z = 29, passes = 3, fps = 15] = process.argv.slice(2).map(Number);
for (let pass = 0; pass < passes; pass++) {
  const ms = [];
  for (let t = a; t <= z; t += 1 / fps) {
    const s = performance.now(); frame(+t.toFixed(4)); ms.push(performance.now() - s);
    if (globalThis.gc) globalThis.gc();
  }
  ms.sort((x, y) => x - y);
  console.log(JSON.stringify({ pass, avg: +(ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(1), med: +ms[ms.length >> 1].toFixed(1), max: +ms[ms.length - 1].toFixed(1), rssMB: Math.round(process.memoryUsage().rss / 1e6) }));
}
