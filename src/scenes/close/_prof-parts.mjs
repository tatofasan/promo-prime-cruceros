// Perfil por pieza del cierre (dibujo + rasterizado: lee 1 píxel para forzar el flush de Skia).
//   node src/scenes/close/_prof-parts.mjs [desde] [hasta]
import { createCanvas, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
globalThis.Path2D = Path2D; globalThis.DOMMatrix ??= DOMMatrix;
const fonts = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of fonts.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const { setEnv } = await import('../../engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h) });
const { resetLayers } = await import('../../engine/layer.js');
const { applyGrade } = await import('../../engine/grade.js');
const { plane } = await import('../../engine/camera.js');
const A = await import('../../art/index.js');
const { LOOK, HORIZON, SUN, SHIP_AT } = await import('./look.js');
const { drawMotes } = await import('./motes.js');
const { lockupGeo, T_FIN } = await import('./layout.js');
const { drawLockup, initLockup } = await import('./lockup.js');
const { drawCta, drawCtaBurst } = await import('./cta.js');
const { drawCtaGlow } = await import('./cta-glow.js');
const { drawPinDrop } = await import('./pin-drop.js');
await A.initArt({ clouds: ['dusk'] });
const G = lockupGeo();
initLockup(G);
const cam = { x: 0, y: 0, z: 1.02, r: 0 };
const P = LOOK;
const parts = {
  sky: (c, t) => A.drawSky(c, t, { preset: P, horizonY: HORIZON, sunX: SUN.x, sunY: SUN.y, cam }),
  cloudsLow: (c, t) => A.drawClouds(c, t, { preset: 'dusk', cam, depth: 0.2, seed: 2, y: 104, scale: 0.78, alpha: 0.95, density: 0.25, spread: 10, speed: 7, x0: -520, x1: 520 }),
  sun: (c, t) => A.drawSun(c, t, SUN.x, SUN.y, SUN.r, { preset: P, flare: 1, horizon: HORIZON }),
  cloudsHigh: (c, t) => A.drawClouds(c, t, { preset: 'dusk', cam, depth: 0.2, seed: 1, y: 128, scale: 0.62, alpha: 0.9, density: 0.25, spread: 10, speed: 6, x0: 1460, x1: 2480 }),
  ocean: (c, t) => A.drawOcean(c, t, { preset: P, horizonY: HORIZON, cam, sunX: SUN.x, sunY: SUN.y, glitter: 1.2, swell: 0.9 }),
  ship: (c, t) => plane(c, cam, A.seaDepth(SHIP_AT.y, HORIZON), (q) => A.drawShip(q, t, { x: SHIP_AT.x, y: SHIP_AT.y, scale: SHIP_AT.scale, preset: P, smoke: 0.35, horn: T_FIN, wakeLen: 700 })),
  gulls: (c, t) => A.drawGulls(c, t, { preset: P, count: 6, area: { x: 0, y: 96, w: 1920, h: 120 }, scale: 0.62 }),
  motes: (c, t) => drawMotes(c, t),
  lockup: (c, t) => drawLockup(c, t, G, 'navy'),
  ctaGlow: (c, t) => drawCtaGlow(c, t, G),
  cta: (c, t) => { drawCtaBurst(c, t, G); drawCta(c, t, G); },
  pin: (c, t) => drawPinDrop(c, t, G),
  wave: (c, t) => A.drawWaveCrest(c, t, 0.6, { dir: 'ltr', preset: P }),
  grade: (c, t) => applyGrade(c, t),
};
const W = 1920, H = 1080;
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
const [a = 27.5, z = 29.5] = process.argv.slice(2).map(Number);
const acc = {};
let n = 0;
for (let t = a; t <= z + 1e-9; t += 0.2) {
  n++;
  for (const [k, fn] of Object.entries(parts)) {
    resetLayers();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#123'; ctx.fillRect(0, 0, W, H);
    ctx.getImageData(0, 0, 1, 1);
    const s = performance.now();
    ctx.save(); fn(ctx, +t.toFixed(4)); ctx.restore();
    ctx.getImageData(0, 0, 1, 1);
    acc[k] = (acc[k] ?? 0) + performance.now() - s;
  }
}
const res = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +(v / n).toFixed(1)]));
res.TOTAL = +Object.values(res).reduce((s, x) => s + x, 0).toFixed(1);
console.log(JSON.stringify(res, null, 1));
