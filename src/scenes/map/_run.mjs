// Corredor propio del equipo MAP (solo pruebas): como tools/sandbox.mjs pero SIN arrancar las demás escenas,
// para poder iterar aunque otra escena esté rota. Aplica fx y grade del motor para ver el cuadro final.
//   node src/scenes/map/_run.mjs --t=13.2,14 --out=shots/map/x [--sheet --cols=6 --thumb=320] [--from --to --step]
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
globalThis.Path2D = Path2D; globalThis.DOMMatrix ??= DOMMatrix;
const man = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of man.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers, layer } = await imp('src/engine/layer.js');
const { fxAt } = await imp('src/engine/fx.js');
const { applyGrade } = await imp('src/engine/grade.js');
const mod = await imp(String(flags.module ?? 'src/scenes/map.js'));
const scene = mod.default ?? mod;
if (scene.init) await scene.init();
const out = resolve(root, String(flags.out ?? 'shots/map/run'));
mkdirSync(out, { recursive: true });
let times = flags.t ? String(flags.t).split(',').map(Number) : [];
if (flags.from !== undefined) { const a = +flags.from, z = +(flags.to ?? a + 1), st = +(flags.step ?? 0.1172); for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4)); }
const W = 1920, H = 1080;
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
const bufs = [], ms = [];
for (const t of times) {
  resetLayers();
  const stage = layer(); const sc = stage.getContext('2d');
  sc.fillStyle = '#04101F'; sc.fillRect(0, 0, W, H);
  const a = performance.now();
  sc.save(); scene.draw(sc, t); sc.restore();
  if (flags.split) { sc.getImageData(0, 0, 1, 1); console.error('draw', t, (performance.now() - a).toFixed(1)); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#04101F'; ctx.fillRect(0, 0, W, H);
  const f = flags.nofx ? { flash: 0, punch: 0, sx: 0, sy: 0, sr: 0 } : fxAt(t);
  ctx.save(); const z = 1 + f.punch; ctx.translate(W / 2 + f.sx, H / 2 + f.sy); ctx.rotate(f.sr || 0); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); ctx.drawImage(stage, 0, 0); ctx.restore();
  if (!flags.nograde) applyGrade(ctx, t);
  ctx.getImageData(0, 0, 1, 1);
  ms.push(performance.now() - a);
  const png = await canvas.encode('png');
  if (!flags['only-sheet']) await sharp(png).toFile(join(out, `t${t.toFixed(3).padStart(6, '0')}.png`));
  bufs.push(png);
}
if (flags.sheet) {
  const cols = +(flags.cols ?? 6), tw = +(flags.thumb ?? 320), th = Math.round((tw * H) / W), lab = 20, rows = Math.ceil(bufs.length / cols);
  const comps = [];
  for (let i = 0; i < bufs.length; i++) {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
    comps.push({ input: await sharp(bufs[i]).resize(tw, th).toBuffer(), left: x, top: y + lab });
    comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="5" y="15" font-family="Consolas, monospace" font-size="12" fill="#FFD27A">${times[i].toFixed(3)}s</text></svg>`), left: x, top: y });
  }
  await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(join(out, 'sheet.jpg'));
}
const avg = ms.reduce((s, x) => s + x, 0) / ms.length;
console.log(JSON.stringify({ out, n: times.length, msAvg: +avg.toFixed(1), msMax: +Math.max(...ms).toFixed(1), slow: times.map((t, i) => [t, +ms[i].toFixed(0)]).sort((a, b) => b[1] - a[1]).slice(0, 5) }));
