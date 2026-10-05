// Para el director: mide reveal-sea por partes antes y después de iniciar otras cosas. Después de pool.init()
// TODO el dibujo del proceso se vuelve ~3× más lento (las piezas sueltas de su init no lo provocan).
//   node src/scenes/hook/reveal/_pool-slow.mjs
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
const { layer, resetLayers } = await imp('src/engine/layer.js');
const prof = await imp('src/scenes/hook/reveal/_prof.js');
await prof.init();
const run = (label) => { console.log('--', label); for (const t of [4.3, 4.5]) { resetLayers(); prof.draw(layer().getContext('2d'), t); } };
run('solo');
{
  const cv = createCanvas(2400, 1600);
  const c = cv.getContext('2d');
  for (let i = 0; i < 6; i++) { c.save(); c.globalAlpha = 0.3; c.filter = 'blur(8px)'; c.fillStyle = 'rgb(16,44,82)'; c.beginPath(); c.arc(300 + i * 200, 400, 96, 0, Math.PI * 2); c.fill(); c.restore(); }
  c.getImageData(0, 0, 1, 1);
  run('+blur-canvas');
  globalThis.__keep = cv;
}
const pool = (await imp('src/scenes/pool.js')).default;
run('+import pool');
const U = await imp('src/scenes/deck-a/util.js');
const F = await imp('src/scenes/deck-a/float.js');
U.shadowSprite(260, 300, 7, F.floatSilhouette, 'rgb(16,44,82)'); run('+shadowSprite');
const G = await imp('src/engine/grade.js');
G.addGrade(() => null); run('+addGrade');
await pool.init(); run('+pool.init');
