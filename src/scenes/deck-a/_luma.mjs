import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
let prev = null;
for (const f of readdirSync(dir).filter((f) => /^t.*\.png$/.test(f)).sort()) {
  const { data } = await sharp(join(dir, f)).resize(192, 108, { kernel: 'cubic' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let s = 0; const n = data.length / 3; const g = new Float32Array(n);
  for (let i = 0; i < n; i++) { const y = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2]; g[i] = 16 + y * 219 / 255; s += g[i]; }
  let m = 0; if (prev) { for (let i = 0; i < n; i++) m += Math.abs(g[i] - prev[i]); m /= n; }
  console.log(f, (s / n).toFixed(1), prev ? (0.8 * m).toFixed(2) : '');
  prev = g;
}
