// Herramienta de prueba de HOOK (no es del motor): energía de movimiento por beat.
// Diferencia absoluta media de luma (0–255) entre cuadros consecutivos a 30 fps, en miniatura 320×180,
// promediada en cada beat [b, b + BEAT). Uso: node src/scenes/hook/_energy.mjs --from=0 --to=5.6
import sharp from 'sharp';
import { boot, parseArgs } from '../../../tools/node-env.mjs';
const f = parseArgs();
const B = await boot();
const from = Number(f.from ?? 0), to = Number(f.to ?? 5.625), fps = Number(f.fps ?? 30);
const BEAT = 0.46875;
const lum = async (t) => {
  const { data } = await sharp(B.png(t)).resize(320, 180).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
};
let prev = null;
const diffs = [];
for (let t = from; t <= to + 1e-9; t += 1 / fps) {
  const L = await lum(+t.toFixed(4));
  if (prev) { let s = 0; for (let i = 0; i < L.length; i++) s += Math.abs(L[i] - prev[i]); diffs.push([t, s / L.length]); }
  prev = L;
}
const out = [];
for (let b = Math.floor(from / BEAT) * BEAT; b < to; b += BEAT) {
  const v = diffs.filter(([t]) => t >= b - 1e-6 && t < b + BEAT - 1e-6).map((d) => d[1]);
  if (v.length) out.push({ beat: +b.toFixed(3), e: +(v.reduce((a, c) => a + c, 0) / v.length).toFixed(2), max: +Math.max(...v).toFixed(1) });
}
console.log(JSON.stringify(out));
if (f.frames) console.log(JSON.stringify(diffs.map(([t, d]) => [+t.toFixed(3), +d.toFixed(1)])));
