// Para el director: repite UNA pieza del dibujo muchas veces y muestra si el proceso se va poniendo lento.
//   node src/scenes/hook/reveal/_leak.mjs sky|ocean|ship|clouds|sun|swell|scene [cuadros]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { root } from '../../../../tools/node-env.mjs';

globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers } = await imp('src/engine/layer.js');
const art = await imp('src/art/index.js');
const sea = (await imp('src/scenes/reveal-sea.js')).default;
await sea.init();
const { seaCam } = await imp('src/scenes/hook/reveal/cam.js');
const { shipPoseAt } = await imp('src/scenes/hook/reveal/ship.js');
const { drawSwell } = await imp('src/scenes/hook/reveal/swell.js');
const { HZ, SUN } = await imp('src/scenes/hook/reveal/time.js');
const what = process.argv[2] ?? 'scene', N = Number(process.argv[3] ?? 60);
const C = createCanvas(1920, 1080);
const c = C.getContext('2d');
for (let f = 0; f < N; f++) {
  const t = 4.0 + (f % 17) * 0.0667;
  const cam = { ...seaCam(t), r: 0 };
  resetLayers();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, 1920, 1080);
  const a = performance.now();
  if (what === 'sky') art.drawSky(c, t, { preset: 'golden', horizonY: HZ, sunX: SUN.x, sunY: SUN.y, cam });
  else if (what === 'ocean') art.drawOcean(c, t, { preset: 'golden', horizonY: HZ, cam, sunX: SUN.x, sunY: SUN.y });
  else if (what === 'ship') art.drawShip(c, t, shipPoseAt(t, cam));
  else if (what === 'clouds') art.drawClouds(c, t, { preset: 'golden', cam, depth: 0.16, seed: 2, y: 480, scale: 0.6 });
  else if (what === 'sun') art.drawSun(c, t, 1600, 200, 70, { preset: 'golden', flare: 0.7 });
  else if (what === 'swell') drawSwell(c, t, cam);
  else sea.draw(c, t);
  c.getImageData(0, 0, 1, 1);
  if (f % 10 === 0 || f === N - 1) console.log(what, f, (performance.now() - a).toFixed(1), 'rss', (process.memoryUsage().rss / 1e6).toFixed(0));
}
