import sharp from 'sharp';
import { boot } from '../../../tools/node-env.mjs';
const B = await boot();
for (const t of [8.5]) {
  const { data, info } = await sharp(B.png(t)).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  for (const R of [300, 500]) {
    let r = 0, b = 0, n = 0;
    for (let y = 540 - R; y < 540 + R; y += 2) for (let x = 960 - R; x < 960 + R; x += 2) {
      if ((x - 960) ** 2 + (y - 540) ** 2 > R * R) continue;
      const i = (y * 1920 + x) * ch; r += data[i]; b += data[i + 2]; n++;
    }
    // anillo del mantel (sin el plato)
    let r2 = 0, b2 = 0, n2 = 0;
    for (let y = 0; y < 1080; y += 2) for (let x = 0; x < 1920; x += 2) {
      const d = Math.hypot(x - 960, y - 540); if (d < 260 || d > R) continue;
      const i = (y * 1920 + x) * ch; r2 += data[i]; b2 += data[i + 2]; n2++;
    }
    console.log(t, 'r<' + R, 'R', (r / n).toFixed(1), 'B', (b / n).toFixed(1), '| sin plato R', (r2 / n2).toFixed(1), 'B', (b2 / n2).toFixed(1));
  }
}
process.exit(0);
