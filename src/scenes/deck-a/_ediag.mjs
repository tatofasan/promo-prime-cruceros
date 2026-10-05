// diagnóstico: Δ por cuadro (mismo cálculo que tools/energy.mjs) para ver dónde está la energía
import { spawnSync } from 'node:child_process';
const [video, off] = [process.argv[2], Number(process.argv[3])];
const SW = 192, SH = 108, N = SW * SH;
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `fps=30,scale=${SW}:${SH}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
const b = r.stdout, nF = Math.floor(b.length / N);
let line = '';
for (let i = 1; i < nF; i++) {
  let s = 0; for (let k = 0; k < N; k++) s += Math.abs(b[i * N + k] - b[(i - 1) * N + k]);
  line += `${(off + i / 30).toFixed(3)}:${(0.8 * s / N).toFixed(1)}  `;
  if (i % 8 === 0) { console.log(line); line = ''; }
}
console.log(line);
