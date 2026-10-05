// Medidor de DECK-A: luma media por cuadro y "energía" (cambio medio entre cuadros, 0–255, a 960×540) por beat.
//   node src/scenes/deck-a/_energy.mjs --t=7.4833,7.5            → luma de cada cuadro y |Δ| entre consecutivos
//   node src/scenes/deck-a/_energy.mjs --from=7.96875 --to=9.375 --fps=30   → energía por beat (como el gráfico del director)
import sharp from 'sharp';
import { boot, parseArgs } from '../../../tools/node-env.mjs';

const f = parseArgs();
const B = await boot();
let times = f.t ? String(f.t).split(',').map(Number) : [];
if (f.from !== undefined) {
  const fps = Number(f.fps ?? 30), a = Number(f.from), z = Number(f.to);
  for (let k = 0; a + k / fps <= z + 1e-6; k++) times.push(+(a + k / fps).toFixed(5));
}
const BEAT = 0.46875;
const rows = [];
let prev = null;
for (const t of times) {
  const { data } = await sharp(B.png(t)).resize(960, 540).raw().toBuffer({ resolveWithObject: true });
  const ch = data.length / (960 * 540);
  let luma = 0, diff = 0, r = 0, b = 0;
  for (let i = 0; i < data.length; i += ch) {
    luma += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    r += data[i]; b += data[i + 2];
    if (prev) diff += (Math.abs(data[i] - prev[i]) + Math.abs(data[i + 1] - prev[i + 1]) + Math.abs(data[i + 2] - prev[i + 2])) / 3;
  }
  const n = 960 * 540;
  rows.push({ t, luma: +(luma / n).toFixed(1), R: +(r / n).toFixed(1), B: +(b / n).toFixed(1), d: prev ? +(diff / n).toFixed(2) : null });
  prev = data;
}
for (const r of rows) console.log(`${r.t.toFixed(4)}  luma ${r.luma}  R ${r.R}  B ${r.B}${r.d != null ? `  Δ ${r.d}` : ''}`);
if (f.from !== undefined) {
  const beats = new Map();
  for (const r of rows) {
    if (r.d == null) continue;
    const k = Math.floor(r.t / BEAT + 1e-6);
    if (!beats.has(k)) beats.set(k, []);
    beats.get(k).push(r.d);
  }
  for (const [k, v] of beats) console.log(`beat ${(k * BEAT).toFixed(3)}–${((k + 1) * BEAT).toFixed(3)}: energía ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2)} (${v.length} cuadros)`);
}
process.exit(0);
