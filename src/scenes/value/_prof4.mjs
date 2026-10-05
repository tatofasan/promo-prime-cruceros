// ms de VALOR sola en todo su tramo (cada 1/15 s), dos pasadas; reporta la segunda.
import { createCanvas } from '@napi-rs/canvas';
import { scenes } from './_boot.mjs';
import { resetLayers } from '../../engine/layer.js';
const c = createCanvas(1920, 1080);
const ctx = c.getContext('2d');
const value = scenes.find((s) => s.id === 'value');
let res = [];
for (let pass = 0; pass < 2; pass++) {
  res = [];
  for (let t = 20.5; t < 26.6; t += 1 / 15) {
    const a = performance.now();
    resetLayers(); ctx.save(); value.draw(ctx, t); ctx.restore(); ctx.getImageData(0, 0, 1, 1);
    res.push([+t.toFixed(3), performance.now() - a]);
  }
}
const ms = res.map((r) => r[1]);
console.log('avg', (ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(1), 'max', Math.max(...ms).toFixed(1), 'slow', res.sort((a, b) => b[1] - a[1]).slice(0, 5).map((r) => `${r[0]}:${r[1].toFixed(0)}`).join(' '));
