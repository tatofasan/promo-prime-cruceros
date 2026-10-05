// Apila recortes de cuadros (PNG) en una hoja para mirar detalles a tamaño casi completo.
//   node src/scenes/close/_crops.mjs out.jpg x,y,w,h scale file1.png file2.png …
import sharp from 'sharp';
import { basename } from 'node:path';
const [out, box, sc, ...files] = process.argv.slice(2);
const [x, y, w, h] = box.split(',').map(Number);
const s = Number(sc);
const W = Math.round(w * s), H = Math.round(h * s);
const parts = [];
for (const [i, f] of files.entries()) {
  const img = await sharp(f).extract({ left: x, top: y, width: w, height: h }).resize(W, H).toBuffer();
  const lab = Buffer.from(`<svg width="${W}" height="26"><rect width="100%" height="100%" fill="#111"/><text x="6" y="19" font-family="monospace" font-size="18" fill="#ffd27a">${basename(f)}</text></svg>`);
  parts.push({ input: lab, left: 0, top: i * (H + 26) }, { input: img, left: 0, top: i * (H + 26) + 26 });
}
await sharp({ create: { width: W, height: files.length * (H + 26), channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 88 }).toFile(out);
console.log(out);
