// Herramienta de prueba de HOOK: brillo medio (luma 0–255) por cuadro y el mayor salto relativo entre cuadros.
// Uso: node --import ./src/scenes/hook/_tools/reg.mjs src/scenes/hook/_tools/bright.mjs --from=0 --to=0.5 [--step=0.0167]
import sharp from 'sharp';
import { boot, parseArgs } from '../../../../tools/node-env.mjs';
const f = parseArgs();
const B = await boot();
const from = Number(f.from ?? 0), to = Number(f.to ?? 0.5), step = Number(f.step ?? 1 / 60);
const rows = [];
for (let t = from; t <= to + 1e-9; t += step) {
  const { data } = await sharp(B.png(+t.toFixed(4))).resize(320, 180).greyscale().raw().toBuffer({ resolveWithObject: true });
  let s = 0; for (const v of data) s += v;
  rows.push([+t.toFixed(4), s / data.length]);
}
let worst = 0, at = null, lo = Infinity, hi = -Infinity;
for (let i = 1; i < rows.length; i++) { const d = Math.abs(rows[i][1] - rows[i - 1][1]) / rows[i - 1][1]; if (d > worst) { worst = d; at = rows[i][0]; } }
for (const [, v] of rows) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
console.log(JSON.stringify({ frames: rows.length, maxStepPct: +(worst * 100).toFixed(2), at, rangePct: +((hi - lo) / lo * 100).toFixed(2), mean: rows.map((r) => +r[1].toFixed(1)) }));
