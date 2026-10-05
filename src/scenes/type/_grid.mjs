// Arma una grilla de cuadros ya renderizados (solo para revisar): node src/scenes/type/_grid.mjs dir cols w f1 f2 ...
import sharp from 'sharp';
import { join } from 'node:path';
const [dir, cols, w, ...fs] = process.argv.slice(2);
const C = Number(cols), Wd = Number(w), Hd = Math.round((Wd * 9) / 16);
const comps = [];
for (let i = 0; i < fs.length; i++) comps.push({ input: await sharp(join(dir, fs[i] + '.png')).resize(Wd, Hd).toBuffer(), left: (i % C) * Wd, top: Math.floor(i / C) * Hd });
await sharp({ create: { width: C * Wd, height: Math.ceil(fs.length / C) * Hd, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 88 }).toFile(join(dir, 'grid.jpg'));
