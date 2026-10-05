// Mide una parte sola (o varias) de la pileta: node src/scenes/deck-a/_prof2.mjs 6.2 deck,sea
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
const t = Number(process.argv[2] ?? 6.2);
const only = (process.argv[3] ?? '').split(',').filter(Boolean);
for (const [name, fn] of P.parts(t)) {
  if (only.length && !only.includes(name)) continue;
  resetLayers();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.getImageData(0, 0, 1, 1);
  const a = performance.now();
  for (let k = 0; k < 5; k++) { ctx.save(); fn(ctx); ctx.restore(); ctx.getImageData(0, 0, 1, 1); }
  console.log(name.padEnd(12), ((performance.now() - a) / 5).toFixed(1));
}
