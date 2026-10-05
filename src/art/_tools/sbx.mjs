// Banco de pruebas de ART que NO arranca las escenas de los demás equipos (así un archivo roto ajeno no
// frena las muestras del kit). Misma interfaz que tools/sandbox.mjs:
//   node src/art/_tools/sbx.mjs --module=src/art/_ship.js --t=1 --out=shots/art/x [--from --to --step --sheet --cols --thumb]
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage, Path2D, GlobalFonts, DOMMatrix } from '@napi-rs/canvas';
import sharp from 'sharp';
import { parseArgs, root } from '../../../tools/node-env.mjs';

const flags = parseArgs();
globalThis.Path2D = Path2D;
globalThis.DOMMatrix ??= DOMMatrix;
const manifest = JSON.parse(readFileSync(join(root, 'public/fonts/fonts.json'), 'utf8'));
for (const f of manifest.fonts) GlobalFonts.registerFromPath(join(root, 'public/fonts', f.file), f.family);
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { setEnv } = await imp('src/engine/env.js');
setEnv({ platform: 'node', createCanvas: (w, h) => createCanvas(w, h), loadImage: (p) => loadImage(readFileSync(p)), assetUrl: (p) => join(root, 'public', p) });
const { resetLayers } = await imp('src/engine/layer.js');

const out = resolve(root, String(flags.out ?? 'shots/art/sbx'));
mkdirSync(out, { recursive: true });
const report = { ok: true, out, frames: [] };
try {
  const mod = await import(pathToFileURL(resolve(root, String(flags.module))).href);
  if (mod.init) await mod.init();
  const Wd = mod.W ?? 1920, Hd = mod.H ?? 1080;
  const canvas = createCanvas(Wd, Hd);
  const ctx = canvas.getContext('2d');
  let times = flags.t ? String(flags.t).split(',').map(Number) : [];
  if (flags.from !== undefined) {
    const a = Number(flags.from), z = Number(flags.to ?? a + 1), st = Number(flags.step ?? 0.25);
    for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4));
  }
  if (!times.length) times = [0];
  const bufs = [];
  for (const t of times) {
    resetLayers();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = mod.bg ?? '#04101F';
    ctx.fillRect(0, 0, Wd, Hd);
    const a = performance.now();
    mod.draw(ctx, t);
    ctx.getImageData(0, 0, 1, 1); // fuerza el rasterizado (Skia graba y rasteriza al leer)
    const ms = performance.now() - a;
    const png = await canvas.encode('png');
    if (!flags['only-sheet']) {
      const file = join(out, `t${t.toFixed(3).padStart(6, '0')}.png`);
      await sharp(png).toFile(file);
      report.frames.push({ t, ms: +ms.toFixed(1), file });
    } else report.frames.push({ t, ms: +ms.toFixed(1) });
    bufs.push(png);
  }
  const v = report.frames.map((f) => f.ms);
  report.msAvg = +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1);
  report.msMax = Math.max(...v);
  if (flags.sheet) {
    const cols = Number(flags.cols ?? 6), tw = Number(flags.thumb ?? 320), th = Math.round((tw * Hd) / Wd), lab = 20;
    const rows = Math.ceil(bufs.length / cols);
    const comps = [];
    for (let i = 0; i < bufs.length; i++) {
      const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
      comps.push({ input: await sharp(bufs[i]).resize(tw, th).toBuffer(), left: x, top: y + lab });
      comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="5" y="15" font-family="Consolas, monospace" font-size="12" fill="#FFD27A">${String(flags.label ?? '')}${times[i].toFixed(3)}</text></svg>`), left: x, top: y });
    }
    report.sheet = join(out, String(flags.name ?? 'sheet') + '.jpg');
    await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(report.sheet);
  }
} catch (e) {
  report.ok = false;
  report.error = String(e?.stack || e);
}
if (flags.quiet) console.log(JSON.stringify({ ok: report.ok, msAvg: report.msAvg, msMax: report.msMax, sheet: report.sheet, error: report.error }));
else console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
