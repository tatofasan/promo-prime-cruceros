// Energía de movimiento de un video (QA del cierre): diferencia media absoluta entre cuadros consecutivos
// (por beat) y entre cuadros separados un beat. Lee el mp4 con ffmpeg a 960×540 rgb24.
//   node src/scenes/close/_energy-mp4.mjs out/draft-v1.mp4 26.72 30
import { spawnSync } from 'node:child_process';
const [file, a, b] = process.argv.slice(2);
const A = Number(a), Bt = Number(b), W = Number(process.argv[5] ?? 960), H = Math.round(W * 9 / 16), FPS = 30, BEAT = 0.46875;
const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(A), '-t', String(Bt - A), '-i', file, '-vf', `fps=${FPS},scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
const buf = r.stdout, fs = W * H * 3, n = Math.floor(buf.length / fs);
const diff = (i, j) => { let s = 0; const o1 = i * fs, o2 = j * fs; for (let k = 0; k < fs; k++) s += Math.abs(buf[o1 + k] - buf[o2 + k]); return s / fs; };
const cons = []; for (let i = 1; i < n; i++) cons.push(diff(i - 1, i));
const per = Math.round(BEAT * FPS);
const beats = [];
for (let k = 0; k * per < cons.length; k++) {
  const seg = cons.slice(k * per, (k + 1) * per);
  const bd = (k + 1) * per < n ? diff(k * per, (k + 1) * per) : null;
  beats.push({ t: +(A + k * BEAT).toFixed(2), consAvg: +(seg.reduce((s, x) => s + x, 0) / seg.length).toFixed(2), beatApart: bd && +bd.toFixed(2) });
}
console.log(JSON.stringify({ frames: n, beats }, null, 1));
