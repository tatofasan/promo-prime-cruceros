// Banco de pruebas: dibuja un módulo suelto (un componente, una ilustración, una hoja de muestras) sin pasar
// por el registro de escenas. El módulo exporta `draw(ctx, t)` y opcionalmente `async init()`, `W`, `H`, `bg`.
//
//   node tools/sandbox.mjs --module=src/art/_showcase.js --t=0,1,2 --out=shots/art/showcase
//   node tools/sandbox.mjs --module=src/scenes/map/_pins-test.js --from=0 --to=2 --step=0.1 --sheet
//
// Flags: --out · --sheet · --cols · --thumb · --jpeg · --scale
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import { boot, parseArgs, root } from './node-env.mjs';

const flags = parseArgs();
if (!flags.module) { console.error('falta --module=ruta/al/modulo.js'); process.exit(2); }
const out = resolve(root, String(flags.out ?? 'shots/sandbox'));
mkdirSync(out, { recursive: true });
const report = { ok: true, out, frames: [] };
try {
  await boot({ scenes: false });
  const mod = await import(pathToFileURL(resolve(root, String(flags.module))).href + `?v=${Date.now()}`);
  if (mod.init) await mod.init();
  const Wd = mod.W ?? 1920, Hd = mod.H ?? 1080;
  const canvas = createCanvas(Wd, Hd);
  const ctx = canvas.getContext('2d');
  const { resetLayers } = await import(pathToFileURL(join(root, 'src/engine/layer.js')).href);
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
    const ms = performance.now() - a;
    const png = await canvas.encode('png');
    const file = join(out, `t${t.toFixed(3).padStart(6, '0')}.${flags.jpeg ? 'jpg' : 'png'}`);
    let s = sharp(png);
    if (flags.scale) s = s.resize(Math.round(Wd * Number(flags.scale)));
    await (flags.jpeg ? s.jpeg({ quality: 90 }) : s.png()).toFile(file);
    report.frames.push({ t, ms: +ms.toFixed(1), file });
    bufs.push(png);
  }
  if (flags.sheet) {
    const cols = Number(flags.cols ?? 6), tw = Number(flags.thumb ?? 320), th = Math.round((tw * Hd) / Wd), lab = 20;
    const rows = Math.ceil(bufs.length / cols);
    const comps = [];
    for (let i = 0; i < bufs.length; i++) {
      const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
      comps.push({ input: await sharp(bufs[i]).resize(tw, th).toBuffer(), left: x, top: y + lab });
      comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="5" y="15" font-family="Consolas, monospace" font-size="12" fill="#FFD27A">${times[i].toFixed(3)}s</text></svg>`), left: x, top: y });
    }
    report.sheet = join(out, 'sheet.jpg');
    await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(report.sheet);
  }
} catch (e) {
  report.ok = false;
  report.error = String(e?.stack || e);
}
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
