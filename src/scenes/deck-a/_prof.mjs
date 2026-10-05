// Perfil de la pileta por partes (fuerza el rasterizado con getImageData para medir de verdad).
//   node src/scenes/deck-a/_prof.mjs 6.2
import { createCanvas, Path2D, DOMMatrix } from '@napi-rs/canvas';
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const { setEnv } = await import('../../engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h) });
const { resetLayers } = await import('../../engine/layer.js');
const P = await import('./_pool-parts.js');
await P.init();
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
const ts = process.argv.slice(2).map(Number);
const acc = {};
for (const t of ts.length ? ts : [6.2]) {
  for (const [name, fn] of P.parts(t)) {
    resetLayers();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.getImageData(0, 0, 1, 1);
    const a = performance.now();
    for (let k = 0; k < 3; k++) { fn(ctx); ctx.getImageData(0, 0, 1, 1); }
    acc[name] = (acc[name] ?? 0) + (performance.now() - a) / 3;
  }
}
for (const k in acc) console.log(k.padEnd(14), (acc[k] / (ts.length || 1)).toFixed(1), 'ms');
