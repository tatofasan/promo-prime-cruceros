// Perfil del encaje (ART): node src/art/_tools/lprof.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage, Path2D, DOMMatrix } from '@napi-rs/canvas';
import { root } from '../../../tools/node-env.mjs';
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const Wt = await imp('src/art/water.js');
const canvas = createCanvas(1920, 1080);
const ctx = canvas.getContext('2d');
const line = []; for (let i = 0; i <= 10; i++) line.push([300 + i * 70, 600 + Math.sin(i) * 30]);
const run = (label, o, n = 15) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#345'; ctx.fillRect(0, 0, 1920, 1080);
    const a = performance.now();
    Wt.drawFoamLace(ctx, 1 + i * 0.03, line, o);
    ctx.getImageData(0, 0, 1, 1);
    ts.push(performance.now() - a);
  }
  ts.sort((x, y) => x - y);
  console.log(label.padEnd(20), 'med', ts[n >> 1].toFixed(2));
};
run('w40', { width: 40 });
run('w40 hc', { width: 40, holeColor: '#88ccee' });
run('w130 g0.6', { width: 130, grain: 0.6 });
run('w130 g0.6 hc', { width: 130, grain: 0.6, holeColor: '#88ccee' });
run('w130 g1', { width: 130 });
run('w130 g0.6 sh0', { width: 130, grain: 0.6, shadow: 0 });
// prueba: costo de rasterizar contornos bezier de 9 puntos vs elipses
{
  const P9 = new Path2D(), PE = new Path2D(), P7 = new Path2D();
  for (let i = 0; i < 120; i++) {
    const x = 300 + (i % 40) * 18, y = 500 + Math.floor(i / 40) * 30, r = 14;
    Wt.blobInto(P9, x, y, r, i, 0);
    PE.moveTo(x + r, y); PE.ellipse(x, y, r, r * 0.8, 0.3, 0, Math.PI * 2);
    PE.moveTo(x + 5 + r * 0.6, y + 3); PE.ellipse(x + 5, y + 3, r * 0.6, r * 0.5, -0.4, 0, Math.PI * 2);
  }
  for (const [lab, P] of [['bez9 x120', P9], ['ellipse2 x120', PE]]) {
    const ts = [];
    for (let k = 0; k < 15; k++) {
      ctx.fillStyle = '#345'; ctx.fillRect(0, 0, 1920, 1080);
      const a = performance.now();
      ctx.fillStyle = '#fff'; ctx.fill(P); ctx.fill(P); ctx.fill(P);
      ctx.getImageData(0, 0, 1, 1);
      ts.push(performance.now() - a);
    }
    ts.sort((x, y) => x - y);
    console.log(lab.padEnd(20), 'med 3 fills', ts[7].toFixed(2));
  }
  const ts = [];
  for (let k = 0; k < 15; k++) {
    const a = performance.now();
    const Q = new Path2D();
    for (let i = 0; i < 120; i++) Wt.blobInto(Q, 300 + i * 5, 500, 14, i, k * 0.1);
    ts.push(performance.now() - a);
  }
  ts.sort((x, y) => x - y);
  console.log('build bez9 x120'.padEnd(20), 'med', ts[7].toFixed(2));
}
