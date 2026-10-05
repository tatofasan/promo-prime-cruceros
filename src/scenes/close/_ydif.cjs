// QA del cierre: energía por beat = YDIF medio (|ΔY| entre cuadros consecutivos, ffmpeg signalstats) de un
// borrador, con cada cuadro asignado al beat en que cae (ventanas desde cada beat de la grilla).
//   node src/scenes/close/_ydif.cjs out/draft-close.mp4 26.7 [26.71875] [30]
//   (2º arg: t de la pieza del primer cuadro del video · 3º: primer beat · 4º: fin)
const { spawnSync } = require('child_process');
const [f, start, b0 = '26.71875', end = '30'] = process.argv.slice(2);
const BEAT = 0.46875, S = Number(start), B0 = Number(b0), E = Number(end);
const r = spawnSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-', '-f', 'null', '-'], { maxBuffer: 1 << 28 });
const lines = r.stdout.toString().split('\n');
const beats = new Map();
let t = null;
for (const ln of lines) {
  const m = ln.match(/pts_time:([\d.]+)/);
  if (m) { t = S + Number(m[1]); continue; }
  const y = ln.match(/YDIF=([\d.]+)/);
  if (y && t !== null && t > S + 0.001 && t >= B0 && t < E) {
    const k = Math.floor((t - B0) / BEAT + 1e-6);
    const e = beats.get(k) ?? { s: 0, n: 0 };
    e.s += Number(y[1]); e.n++;
    beats.set(k, e);
  }
}
console.log([...beats.entries()].map(([k, e]) => `${(B0 + k * BEAT).toFixed(2)}:${(e.s / e.n).toFixed(2)}(${e.n})`).join(' '));
