// Métricas de VALOR (mapa + valor + cierre, con el mini compositor _boot.mjs):
//   node src/scenes/value/_metrics.mjs --luma --from=20.5 --to=20.75 --step=0.016667
//      → luma media por cuadro y |Δ luma| con el anterior (192×108, gris)
//   node src/scenes/value/_metrics.mjs --energy --from=21.09375 --to=22.5
//      → energía por beat (MAD × 0,8 a 30 fps, 192×108), como tools/energy.mjs
import { createCanvas } from '@napi-rs/canvas';
import { parseArgs } from '../../../tools/node-env.mjs';
import { render, W, H, BEAT, missing } from './_boot.mjs';

const flags = parseArgs();
if (missing.length) console.error('sin:', missing.join(' | '));
const SW = 192, SH = 108, N = SW * SH;
const big = createCanvas(W, H);
const bctx = big.getContext('2d');
// reducción por mitades (aproxima el filtro de área de ffmpeg)
const steps = [[960, 540], [480, 270], [240, 135], [SW, SH]].map(([w, h]) => {
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  return { c, x, w, h };
});
function gray(t) {
  render(bctx, t, { grade: false });
  let src = big;
  for (const st of steps) { st.x.drawImage(src, 0, 0, st.w, st.h); src = st.c; }
  const d = steps[3].x.getImageData(0, 0, SW, SH).data;
  const out = new Float32Array(N);
  for (let k = 0; k < N; k++) out[k] = 0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2];
  return out;
}
const lum = (f) => { let s = 0; for (let k = 0; k < N; k++) s += f[k]; return s / N; };
const mad = (a, b) => { let s = 0; for (let k = 0; k < N; k++) s += Math.abs(a[k] - b[k]); return s / N; };

const from = Number(flags.from), to = Number(flags.to);
if (flags.luma) {
  const st = Number(flags.step ?? 1 / 60);
  let prev = null, prevL = 0, worst = 0;
  const rows = [];
  for (let k = 0; from + k * st <= to + 1e-6; k++) {
    const t = +(from + k * st).toFixed(4);
    const f = gray(t);
    const L = lum(f);
    const d = prev ? Math.abs(L - prevL) : 0;
    worst = Math.max(worst, d);
    rows.push(`${t.toFixed(4)}  luma ${L.toFixed(1).padStart(6)}  dLuma ${d.toFixed(1).padStart(5)}  mad ${(prev ? mad(prev, f) : 0).toFixed(1).padStart(5)}`);
    prev = f; prevL = L;
  }
  console.log(rows.join('\n') + `\nworst dLuma ${worst.toFixed(1)}`);
}
if (flags.energy) {
  const i0 = Math.floor(from * 30) - 1, i1 = Math.ceil(to * 30);
  let prev = null;
  const diffs = [];
  for (let i = i0; i <= i1; i++) {
    const t = i / 30;
    const f = gray(t);
    if (prev) diffs.push({ t, e: 0.8 * mad(prev, f) });
    prev = f;
  }
  const beats = [];
  for (let b = Math.floor(from / BEAT + 1e-6); b * BEAT < to - 1e-6; b++) {
    const t0 = b * BEAT, t1 = t0 + BEAT;
    const v = diffs.filter((d) => d.t >= t0 && d.t < t1).map((d) => d.e);
    if (!v.length) continue;
    beats.push(`${t0.toFixed(3)}  energy ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2)}  max ${Math.max(...v).toFixed(2)}`);
  }
  console.log(beats.join('\n'));
}
