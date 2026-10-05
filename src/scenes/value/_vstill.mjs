// Vista previa de MAPA + VALOR (+ CIERRE si compila) con fx y grade del motor, usando el mini compositor
// _boot.mjs (no depende de que compilen las escenas de los demás). Mismas banderas básicas que tools/still.mjs:
//   node src/scenes/value/_vstill.mjs --t=21,22 --sheet --cols=4 --thumb=480 --out=shots/review/value/x
//   node src/scenes/value/_vstill.mjs --from=20.5 --to=20.75 --step=0.0167 --sheet
//   --crop=x,y,w,h  guarda también recortes a tamaño real (crop-t.png)
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseArgs, root } from '../../../tools/node-env.mjs';
import { render, W, H, missing } from './_boot.mjs';

const flags = parseArgs();
if (missing.length) console.error('sin:', missing.join(' | '));
const out = resolve(root, String(flags.out ?? 'shots/review/value/vstill'));
mkdirSync(out, { recursive: true });
let times = flags.t ? String(flags.t).split(',').map(Number) : [];
if (flags.from !== undefined) {
  const a = Number(flags.from), z = Number(flags.to ?? a + 1), st = Number(flags.step ?? 0.2344);
  for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4));
}
const crop = flags.crop ? String(flags.crop).split(',').map(Number) : null;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const res = [];
for (const t of times) {
  const a = performance.now();
  render(ctx, t, { fx: !flags.nofx, grade: !flags.nograde });
  ctx.getImageData(0, 0, 1, 1);
  const ms = performance.now() - a;
  const png = canvas.encodeSync('png');
  const name = `t${t.toFixed(3).padStart(6, '0')}`;
  if (!flags['only-sheet']) await sharp(png).toFile(join(out, `${name}.png`));
  if (crop) await sharp(png).extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] }).toFile(join(out, `crop-${name}.png`));
  res.push({ t, ms: +ms.toFixed(1), png });
}
if (flags.sheet) {
  const cols = Number(flags.cols ?? 6), tw = Number(flags.thumb ?? 320), th = Math.round((tw * H) / W), lab = 20;
  const rows = Math.ceil(res.length / cols);
  const comps = [];
  for (let i = 0; i < res.length; i++) {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + lab);
    comps.push({ input: await sharp(res[i].png).resize(tw, th).toBuffer(), left: x, top: y + lab });
    comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="5" y="15" font-family="Consolas, monospace" font-size="12" fill="#FFD27A">${res[i].t.toFixed(4)}s</text></svg>`), left: x, top: y });
  }
  await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(join(out, 'sheet.jpg'));
}
console.log(JSON.stringify({ out, frames: res.map(({ t, ms }) => ({ t, ms })), msAvg: +(res.reduce((s, r) => s + r.ms, 0) / Math.max(1, res.length)).toFixed(1) }));
