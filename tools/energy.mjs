// Energía por beat y salto de luz en los cortes, medidos sobre un video (borrador de render.mjs).
//
//   node tools/energy.mjs --video=out/draft-v1.mp4 --out=shots/director/energy
//   node tools/energy.mjs --video=out/draft-map.mp4 --from=13.125 --to=20.625 --out=shots/map/energy
//
// (a) ENERGÍA: cambio medio entre cuadros consecutivos (|Δ luma| promedio, 0–255, a 30 fps y 192×108),
//     ×0,8 (calibrado contra la medición de la crítica de motion de la ronda 1), promediado por beat. Una barra por beat; roja si queda por debajo de 3 ("no pasa nada en ese beat").
// (b) CORTES: luma media del cuadro anterior y del cuadro del corte, su diferencia (Δ luma) y el MAD entre
//     ambos, en 5,625 · 7,5 · 9,375 · 11,25 · 13,125 · 20,625 · 24,375.
// Escribe energy.png + energy.csv + cuts.csv en --out e imprime un JSON con el resumen.
// Nota: el video debe empezar en t=0 de la pieza (o pasar --offset=<t de inicio del video>).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseArgs, root } from './node-env.mjs';

const flags = parseArgs();
const video = resolve(root, String(flags.video ?? 'out/draft.mp4'));
const out = resolve(root, String(flags.out ?? 'shots/energy'));
mkdirSync(out, { recursive: true });
const sheet = JSON.parse(readFileSync(join(root, 'src/cues.json'), 'utf8'));
const BEAT = 60 / sheet.bpm;
const FPS = 30, SW = 192, SH = 108, N = SW * SH;
const offset = Number(flags.offset ?? 0);
const from = Number(flags.from ?? offset), to = Number(flags.to ?? sheet.duration);

const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', `fps=${FPS},scale=${SW}:${SH}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
if (r.status !== 0) { console.error(String(r.stderr)); process.exit(1); }
const buf = r.stdout;
const nF = Math.floor(buf.length / N);
const frame = (i) => buf.subarray(i * N, (i + 1) * N);
const tOf = (i) => offset + i / FPS;
const luma = (i) => { const f = frame(i); let s = 0; for (let k = 0; k < N; k++) s += f[k]; return s / N; };
const mad = (i, j) => { const a = frame(i), b = frame(j); let s = 0; for (let k = 0; k < N; k++) s += Math.abs(a[k] - b[k]); return s / N; };

// (a) energía por beat
const diffs = [];
const K = 0.8;
for (let i = 1; i < nF; i++) diffs.push({ t: tOf(i), e: K * mad(i - 1, i) });
const beats = [];
for (let b = Math.floor(from / BEAT + 1e-6); b * BEAT < to - 1e-6; b++) {
  const t0 = b * BEAT, t1 = t0 + BEAT;
  const v = diffs.filter((d) => d.t >= t0 && d.t < t1).map((d) => d.e);
  if (!v.length) continue;
  beats.push({ beat: b, t: +t0.toFixed(4), energy: +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2), max: +Math.max(...v).toFixed(2) });
}
writeFileSync(join(out, 'energy.csv'), 'beat,t,energy,max\n' + beats.map((b) => `${b.beat},${b.t},${b.energy},${b.max}`).join('\n'));

// (b) cortes
const CUTS = [5.625, 7.5, 9.375, 11.25, 13.125, 20.625, 24.375].filter((c) => c > from && c < to);
const cuts = CUTS.map((c) => {
  const iAt = Math.round((c - offset) * FPS), iPrev = iAt - 1;
  if (iPrev < 0 || iAt >= nF) return null;
  const a = luma(iPrev), b = luma(iAt);
  return { cut: c, lumaBefore: +a.toFixed(1), lumaAt: +b.toFixed(1), dLuma: +Math.abs(b - a).toFixed(1), mad: +mad(iPrev, iAt).toFixed(1) };
}).filter(Boolean);
writeFileSync(join(out, 'cuts.csv'), 'cut,lumaBefore,lumaAt,dLuma,mad\n' + cuts.map((c) => `${c.cut},${c.lumaBefore},${c.lumaAt},${c.dLuma},${c.mad}`).join('\n'));

// gráfico
const GW = 1800, GH = 420, pad = 40;
const maxE = Math.max(8, ...beats.map((b) => b.energy));
const bw = (GW - 2 * pad) / Math.max(1, beats.length);
const bars = beats.map((b, i) => {
  const h = ((GH - 2 * pad) * b.energy) / maxE;
  const col = b.energy < 3 ? '#FF4D4D' : b.energy < 4 ? '#FFB938' : '#2FB3DD';
  return `<rect x="${pad + i * bw + 1}" y="${GH - pad - h}" width="${Math.max(1, bw - 2)}" height="${h}" fill="${col}"/>` +
    (i % 4 === 0 ? `<text x="${pad + i * bw + 2}" y="${GH - pad + 16}" font-size="12" fill="#ccc" font-family="Consolas">${b.t.toFixed(2)}</text>` : '');
}).join('');
const y3 = GH - pad - ((GH - 2 * pad) * 3) / maxE, y4 = GH - pad - ((GH - 2 * pad) * 4) / maxE;
const svg = `<svg width="${GW}" height="${GH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101418"/>${bars}
<line x1="${pad}" x2="${GW - pad}" y1="${y3}" y2="${y3}" stroke="#FF4D4D" stroke-dasharray="6 4"/><line x1="${pad}" x2="${GW - pad}" y1="${y4}" y2="${y4}" stroke="#FFB938" stroke-dasharray="6 4"/>
<text x="${pad}" y="24" font-size="15" fill="#FFD27A" font-family="Consolas">energía por beat (|Δ luma| medio a 30 fps) · rojo &lt; 3 · ámbar &lt; 4 · ${video.split(/[\\/]/).pop()}</text></svg>`;
await sharp(Buffer.from(svg)).png().toFile(join(out, 'energy.png'));

const low = beats.filter((b) => b.energy < 3);
console.log(JSON.stringify({
  ok: true, out, frames: nF, beats: beats.length,
  low3: low.map((b) => b.t), low4: beats.filter((b) => b.energy < 4).map((b) => b.t),
  cuts, png: join(out, 'energy.png'),
}, null, 1));
