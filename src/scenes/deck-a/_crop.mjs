// Recortes a tamaño real de cuadros completos: node src/scenes/deck-a/_crop.mjs --t=6.6,6.65 --box=x,y,w,h --out=dir [--cols=3]
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { boot, parseArgs, root } from '../../../tools/node-env.mjs';
const f = parseArgs();
const B = await boot();
const [x, y, w, h] = String(f.box ?? '0,0,1920,1080').split(',').map(Number);
const out = resolve(root, String(f.out ?? 'shots/deck-a/crop'));
mkdirSync(out, { recursive: true });
let times = f.t ? String(f.t).split(',').map(Number) : [];
if (f.from !== undefined) { const a = +f.from, z = +f.to, st = +(f.step ?? 0.0166667); for (let k = 0; a + k * st <= z + 1e-6; k++) times.push(+(a + k * st).toFixed(4)); }
const cols = Number(f.cols ?? Math.min(4, times.length));
const sc = Number(f.scale ?? 1);
const tw = Math.round(w * sc), th = Math.round(h * sc), lab = 20;
const comps = [];
for (let i = 0; i < times.length; i++) {
  const t = times[i];
  let img = sharp(B.png(t));
  if (f.zone) {
    const [zx0, zy0, zx1, zy1] = String(f.zone).split(',').map(Number);
    img = sharp(await img.composite([{ input: Buffer.from(`<svg width="1920" height="1080"><rect x="${zx0}" y="${zy0}" width="${zx1 - zx0}" height="${zy1 - zy0}" fill="none" stroke="#ff00aa" stroke-width="2"/></svg>`) }]).png().toBuffer());
  }
  const buf = await img.extract({ left: x, top: y, width: w, height: h }).resize(tw, th).png().toBuffer();
  const cx = (i % cols) * tw, cy = Math.floor(i / cols) * (th + lab);
  comps.push({ input: buf, left: cx, top: cy + lab });
  comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="4" y="15" font-family="Consolas" font-size="13" fill="#FFD27A">${t.toFixed(4)}</text></svg>`), left: cx, top: cy });
}
const rows = Math.ceil(times.length / cols);
const file = join(out, String(f.name ?? 'crop.jpg'));
await sharp({ create: { width: cols * tw, height: rows * (th + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 90 }).toFile(file);
console.log(file);
process.exit(0);
