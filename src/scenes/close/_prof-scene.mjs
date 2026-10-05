// Perfil del cierre por bloque, recorriendo a 60 cuadros/s (como el render): fondo (con su caché), lockup, CTA,
// over (ola + pin) y la composición con máscara. Lee 1 píxel tras cada bloque para forzar el rasterizado.
//   node src/scenes/close/_prof-scene.mjs [desde] [hasta] [fps]
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
const { plane, handheld } = await import('../../engine/camera.js');
const { E, prog } = await import('../../engine/ease.js');
const scene = (await import('../close.js')).default;
await scene.init();
const { drawBackdrop } = await import('./backdrop.js');
const { lockupGeo } = await import('./layout.js');
const { drawLockup } = await import('./lockup.js');
const { drawCta, drawCtaBurst } = await import('./cta.js');
const { drawCtaGlow } = await import('./cta-glow.js');
const G = lockupGeo();
const W = 1920, H = 1080;
const bgCam = (t) => handheld({ x: 0, y: 0, z: 1 + 0.035 * E.inOutSine(prog(t, 26.6, 30)) }, t, { amp: 5, hz: 0.32, rollAmp: 0.0016, seed: 41 });
const [a = 27, z = 29.9, fps = 60] = process.argv.slice(2).map(Number);
const acc = {}, n0 = {};
const series = [];
let frameMs = 0;
const add = (k, v) => { acc[k] = (acc[k] ?? 0) + v; n0[k] = (n0[k] ?? 0) + 1; frameMs += v; };
const SKIP = (process.env.SKIP ?? '').split(',');
const out = createCanvas(W, H), o = out.getContext('2d');
for (let t = a; t <= z + 1e-9; t += 1 / fps) {
  if (globalThis.gc) globalThis.gc();
  const tt = +t.toFixed(4);
  resetLayers();
  const L = layer(), c = L.getContext('2d');
  let s = performance.now();
  if (!SKIP.includes('backdrop')) drawBackdrop(c, tt, bgCam, { flare: 0.8, sunPulse: 0.2, horn: 28, glint: 0.3 });
  c.getImageData(0, 0, 1, 1); add('backdrop', performance.now() - s);
  s = performance.now();
  if (!SKIP.includes('lockup')) { c.save(); drawLockup(c, tt, G, 'navy'); c.restore(); }
  c.getImageData(0, 0, 1, 1); add('lockup', performance.now() - s);
  s = performance.now();
  if (!SKIP.includes('cta')) { c.save(); drawCtaGlow(c, tt, G); drawCtaBurst(c, tt, G); drawCta(c, tt, G); c.restore(); }
  c.getImageData(0, 0, 1, 1); add('cta', performance.now() - s);
  s = performance.now();
  const M = layer();
  scene.mask(M.getContext('2d'), tt);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in'; c.drawImage(M, 0, 0); c.globalCompositeOperation = 'source-over';
  o.drawImage(L, 0, 0);
  o.getImageData(0, 0, 1, 1); add('maskComp', performance.now() - s);
  s = performance.now();
  o.save(); scene.over(o, tt); o.restore();
  o.getImageData(0, 0, 1, 1); add('over', performance.now() - s);
  s = performance.now();
  if (!process.env.NOGRADE) applyGrade(o, tt);
  o.getImageData(0, 0, 1, 1); add('grade', performance.now() - s);
  series.push(frameMs); frameMs = 0;
}
const buckets = [];
for (let i = 0; i < series.length; i += 12) buckets.push(+(series.slice(i, i + 12).reduce((q, x) => q + x, 0) / Math.min(12, series.length - i)).toFixed(0));
console.log('serie', buckets.join(' '), 'rss', Math.round(process.memoryUsage().rss / 1e6));
const res = Object.fromEntries(Object.keys(acc).map((k) => [k, +(acc[k] / n0[k]).toFixed(1)]));
res.TOTAL = +Object.values(res).reduce((q, x) => q + x, 0).toFixed(1);
console.log(JSON.stringify(res));
