// Costo por parte de VALOR en t (cada parte sola, 5 repeticiones, mediana).
import { createCanvas } from '@napi-rs/canvas';
import './_boot.mjs';
import { resetLayers } from '../../engine/layer.js';
import { drawTheme, drawShapes } from './bg.js';
import { drawCase, drawCaseHeadline } from './beat-case.js';
import { drawCaseBackdrop, drawCaseRoute } from './backdrop-case.js';
import { drawPass, drawPassHeadline } from './beat-pass.js';
import { drawPro, drawProHeadline } from './beat-pro.js';
const t = Number(process.argv[2] ?? 21.5);
const c = createCanvas(1920, 1080);
const ctx = c.getContext('2d');
const cam = { x: 0, y: 0, z: 1, r: 0 };
const k = t < 22.5 ? 0 : t < 24.375 ? 1 : 2;
const parts = {
  theme: () => drawTheme(ctx, t, k, cam, {}),
  shapesNear: () => drawShapes(ctx, t, k, cam, { near: true }),
  route: () => drawCaseRoute(ctx, t),
  backdrop: () => drawCaseBackdrop(ctx, t),
  caseHead: () => drawCaseHeadline(ctx, t),
  case: () => drawCase(ctx, t),
  pass: () => drawPass(ctx, t),
  passHead: () => drawPassHeadline(ctx, t),
  pro: () => drawPro(ctx, t),
  proHead: () => drawProHeadline(ctx, t),
};
const out = {};
for (const [name, fn] of Object.entries(parts)) {
  const v = [];
  for (let r = 0; r < 5; r++) {
    resetLayers(); ctx.save(); const a = performance.now(); fn(); ctx.getImageData(0, 0, 1, 1); v.push(performance.now() - a); ctx.restore();
  }
  v.sort((a, b) => a - b);
  out[name] = +v[2].toFixed(1);
}
console.log(t, JSON.stringify(out));
