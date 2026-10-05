// Hoja de recortes (solo para revisar): node src/scenes/type/_crops.mjs dir x y w h cols [escala]
// toma todos los tNN.NNN.png del directorio y arma crops.jpg con la región pedida.
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const [dir, x, y, w, h, cols, sc = '1'] = process.argv.slice(2);
const fs = readdirSync(dir).filter((f) => /^t\d.*\.png$/.test(f)).sort();
const W = Math.round(Number(w) * Number(sc)), Hh = Math.round(Number(h) * Number(sc)), C = Number(cols), lab = 18;
const comps = [];
for (let i = 0; i < fs.length; i++) {
  const L = (i % C) * W, T = Math.floor(i / C) * (Hh + lab);
  comps.push({ input: await sharp(join(dir, fs[i])).extract({ left: +x, top: +y, width: +w, height: +h }).resize(W, Hh).toBuffer(), left: L, top: T + lab });
  comps.push({ input: Buffer.from(`<svg width="${W}" height="${lab}"><rect width="100%" height="100%" fill="#101418"/><text x="4" y="13" font-family="Consolas" font-size="12" fill="#FFD27A">${fs[i]}</text></svg>`), left: L, top: T });
}
await sharp({ create: { width: C * W, height: Math.ceil(fs.length / C) * (Hh + lab), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(join(dir, 'crops.jpg'));
