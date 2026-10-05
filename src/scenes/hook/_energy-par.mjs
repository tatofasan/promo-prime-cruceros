// Herramienta de prueba de HOOK (no es del motor): energía de movimiento por beat, en paralelo.
// Igual que _energy.mjs (diferencia absoluta media de luma 0–255 entre cuadros consecutivos a 30 fps, en
// miniatura 320×180, promediada en cada beat [b, b + BEAT)) pero reparte los cuadros en N procesos.
// Uso: node src/scenes/hook/_energy-par.mjs --from=0 --to=5.6 [--jobs=10] [--nograde] [--frames] [--full]
// Sin --full usa el registro reducido de _tools/reg.mjs (solo gancho + TYPE + vecinas).
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { boot, parseArgs } from '../../../tools/node-env.mjs';

const f = parseArgs();
const BEAT = 0.46875;

if (f.worker) {
  const B = await boot();
  const times = String(f.times).split(',').map(Number);
  const opts = { grade: !f.nograde };
  let prev = null;
  const out = [];
  for (const t of times) {
    const { data } = await sharp(B.png(t, opts)).resize(320, 180).greyscale().raw().toBuffer({ resolveWithObject: true });
    if (prev) { let s = 0; for (let i = 0; i < data.length; i++) s += Math.abs(data[i] - prev[i]); out.push([t, s / data.length]); }
    prev = data;
  }
  process.send(out);
  process.exit(0);
}

const from = Number(f.from ?? 0), to = Number(f.to ?? 5.625), fps = Number(f.fps ?? 30), jobs = Number(f.jobs ?? 10);
const all = [];
for (let k = 0; from + k / fps <= to + 1e-9; k++) all.push(+(from + k / fps).toFixed(4));
const per = Math.ceil(all.length / jobs);
const runs = [];
for (let j = 0; j < jobs; j++) {
  const a = j * per, b = Math.min(all.length, a + per + 1);
  if (b - a < 2) continue;
  const ts = all.slice(a, b);
  runs.push(new Promise((res, rej) => {
    const args = ['--worker', `--times=${ts.join(',')}`];
    if (f.nograde) args.push('--nograde');
    const execArgv = f.full ? [] : ['--import', new URL('./_tools/reg.mjs', import.meta.url).href];
    const c = fork(fileURLToPath(import.meta.url), args, { execArgv, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    c.on('message', res);
    c.on('exit', (code) => (code ? rej(new Error(`worker ${j} salió con ${code}`)) : null));
  }));
}
const diffs = (await Promise.all(runs)).flat().sort((a, b) => a[0] - b[0]);
const res = [];
for (let b = Math.floor(from / BEAT + 1e-6) * BEAT; b < to; b += BEAT) {
  const v = diffs.filter(([t]) => t >= b - 1e-6 && t < b + BEAT - 1e-6).map((d) => d[1]);
  if (v.length) res.push({ beat: +b.toFixed(3), e: +(v.reduce((a, c) => a + c, 0) / v.length).toFixed(2), max: +Math.max(...v).toFixed(1) });
}
console.log(JSON.stringify(res));
if (f.frames) console.log(JSON.stringify(diffs.map(([t, d]) => [+t.toFixed(3), +d.toFixed(1)])));
