// Desglose de costo por pieza de TYPE (solo para medir): node src/scenes/type/_parts.mjs
import { createCanvas } from '@napi-rs/canvas';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { boot, root } from '../../../tools/node-env.mjs';
await boot();
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const G = await imp('src/scenes/type/hook-grey.js');
const S = await imp('src/scenes/type/hook-sea.js');
const X = await imp('src/scenes/type/exp-title.js');
const K = await imp('src/scenes/type/chips.js');
const { resetLayers } = await imp('src/engine/layer.js');
(await imp('src/scenes/type-hook.js')).default.init();
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
const parts = { grey: G.drawHookGrey, sea: S.drawHookSea, title: (c, t) => X.drawExpTitle(c, t, { scene: t < 5.625 ? 'hook' : 'exp' }), chips: K.drawChips };
for (const t of (process.argv[2] ? process.argv[2].split(",").map(Number) : [2.5, 3.2, 3.7, 4.4, 5.3, 5.8, 6.4, 7.0, 8.2, 9.5, 11.4])) {
  const row = { t };
  for (const [k, fn] of Object.entries(parts)) {
    let best = 1e9;
    for (let r = 0; r < 9; r++) {
      resetLayers();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#336699'; ctx.fillRect(0, 0, 1920, 1080); ctx.getImageData(0, 0, 1, 1);
      const a = performance.now(); ctx.save(); fn(ctx, t); ctx.restore(); ctx.getImageData(0, 0, 1, 1);
      best = Math.min(best, performance.now() - a);
    }
    row[k] = +best.toFixed(1);
  }
  console.log(JSON.stringify(row));
}
