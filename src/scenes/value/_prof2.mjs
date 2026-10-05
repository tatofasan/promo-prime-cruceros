// Perfil rápido de VALOR sola y del cuadro (mapa + valor) en ms, forzando la rasterización.
//   node src/scenes/value/_prof2.mjs 20.55 21.95 24.6
import { createCanvas } from '@napi-rs/canvas';
import { render, scenes } from './_boot.mjs';
import { resetLayers } from '../../engine/layer.js';

const ts = process.argv.slice(2).map(Number);
const c = createCanvas(1920, 1080);
const ctx = c.getContext('2d');
const value = scenes.find((s) => s.id === 'value');
const map = scenes.find((s) => s.id === 'map');
for (const t of ts) {
  for (let rep = 0; rep < 2; rep++) {
    let a = performance.now();
    resetLayers(); ctx.save(); value.draw(ctx, t); ctx.restore(); ctx.getImageData(0, 0, 1, 1);
    const v = performance.now() - a;
    a = performance.now();
    if (map && t < map.to) { resetLayers(); ctx.save(); map.draw(ctx, t); ctx.restore(); ctx.getImageData(0, 0, 1, 1); }
    const m = performance.now() - a;
    a = performance.now();
    render(ctx, t); ctx.getImageData(0, 0, 1, 1);
    const f = performance.now() - a;
    if (rep) console.log(t, 'value', v.toFixed(0), 'map', m.toFixed(0), 'frame', f.toFixed(0));
  }
}
