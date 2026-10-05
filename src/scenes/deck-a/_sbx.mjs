// Banco de pruebas propio de DECK-A: como tools/sandbox.mjs pero sin arrancar las escenas de los demás
// (si otro equipo tiene un archivo a medio editar, igual podemos probar). Mide con rasterizado (getImageData).
//   node src/scenes/deck-a/_sbx.mjs --module=src/scenes/deck-a/_pool.js --t=6.2 --out=shots/deck-a/solo [--sheet --cols=6 --thumb=320]
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas, Path2D, GlobalFonts, DOMMatrix, loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const flags = {};
for (const a of process.argv.slice(2)) { if (a.startsWith('--')) { const [k, ...v] = a.slice(2).split('='); flags[k] = v.length ? v.join('=') : true; } }
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers } = await imp('src/engine/layer.js');
const mod = await import(pathToFileURL(resolve(root, String(flags.module))).href);
if (mod.init) await mod.init();
const out = resolve(root, String(flags.out ?? 'shots/deck-a/sbx'));
mkdirSync(out, { recursive: true });
const cv = createCanvas(1920, 1080);
const ctx = cv.getContext('2d');
let times = flags.t ? String(flags.t).split(',').map(Number) : [];
if (flags.from !== undefined) {
  const a = Number(flags.from), z = Number(flags.to ?? a + 1), st = Number(flags.step ?? 0.1);
  for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4));
}
const bufs = [], ms = [];
for (const t of times) {
  resetLayers();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = mod.bg ?? '#04101F';
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.getImageData(0, 0, 1, 1);
  const a = performance.now();
  mod.draw(ctx, t);
  ctx.getImageData(0, 0, 1, 1);
  ms.push(+(performance.now() - a).toFixed(1));
  if (flags.mem) console.error(t, ms[ms.length - 1], 'MB', (process.memoryUsage().rss / 1e6).toFixed(0));
  if (flags.gc && globalThis.gc) globalThis.gc();
  if (flags.noenc) continue;
  const png = await cv.encode('png');
  if (!flags['only-sheet']) await sharp(png).toFile(join(out, `t${t.toFixed(3).padStart(6, '0')}.png`));
  bufs.push(png);
}
if (flags.sheet) {
  const cols = Number(flags.cols ?? 6), tw = Number(flags.thumb ?? 320), th = Math.round((tw * 1080) / 1920), lab = 18;
  const comps = [];
  for (let i = 0; i < bufs.length; i++) {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
    comps.push({ input: await sharp(bufs[i]).resize(tw, th).toBuffer(), left: x, top: y + lab });
    comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="4" y="13" font-family="Consolas, monospace" font-size="12" fill="#FFD27A">${times[i].toFixed(3)}s</text></svg>`), left: x, top: y });
  }
  const rows = Math.ceil(bufs.length / cols);
  await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#101418' } }).composite(comps).jpeg({ quality: 88 }).toFile(join(out, 'sheet.jpg'));
}
console.log(JSON.stringify({ out, ms, avg: +(ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(1) }));
