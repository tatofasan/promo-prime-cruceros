// Perfil por piezas de la ola (ART): node src/art/_tools/wprof.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { root } from '../../../tools/node-env.mjs';

globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers } = await imp('src/engine/layer.js');
const W = await imp('src/art/wave.js');
const canvas = createCanvas(1920, 1080);
const ctx = canvas.getContext('2d');
const run = (label, fn, n = 12) => {
  const ts = [];
  for (let i = 0; i < n; i++) {
    resetLayers();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#334'; ctx.fillRect(0, 0, 1920, 1080);
    const a = performance.now();
    fn(3.6 + i * 0.02, 0.3 + i * 0.03);
    ctx.getImageData(0, 0, 1, 1);
    ts.push(performance.now() - a);
  }
  ts.sort((x, y) => x - y);
  console.log(label.padEnd(16), 'med', ts[n >> 1].toFixed(1), 'max', ts[n - 1].toFixed(1));
};
run('mask', (t, p) => W.drawWaveMask(ctx, p, { dir: 'rtl' }));
run('crest', (t, p) => W.drawWaveCrest(ctx, t, p, { dir: 'rtl', preset: 'golden', spray: 1.35, foam: 1.2 }));
run('crest foam0', (t, p) => W.drawWaveCrest(ctx, t, p, { dir: 'rtl', preset: 'golden', spray: 1.35, foam: 0 }));
run('crest spray0', (t, p) => W.drawWaveCrest(ctx, t, p, { dir: 'rtl', preset: 'golden', spray: 0, foam: 1.2 }));
run('crest both0', (t, p) => W.drawWaveCrest(ctx, t, p, { dir: 'rtl', preset: 'golden', spray: 0, foam: 0, shadow: 0 }));
