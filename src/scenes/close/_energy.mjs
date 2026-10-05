// QA del cierre: energía de movimiento y desplazamiento de textos, sobre renders reales de la pieza.
//   node src/scenes/close/_energy.mjs --from=26.72 --to=30 [--fps=30] [--pairs=4]
// Por beat: diferencia media absoluta (0–255, RGB) entre cuadros consecutivos a `fps`, a --w=320 de ancho (como
// la métrica de los críticos sobre el borrador), con grano y fx,
// tomando `pairs` pares repartidos en el beat. También el mismo número a 60 fps (cuadros separados 1/60).
import sharp from 'sharp';
import { boot, parseArgs } from '../../../tools/node-env.mjs';
const f = parseArgs();
const B = await boot();
const BEAT = 0.46875, from = Number(f.from ?? 26.72), to = Number(f.to ?? 30), fps = Number(f.fps ?? 30), pairs = Number(f.pairs ?? 4);
const RW = Number(f.w ?? 320);
const small = async (t) => sharp(B.png(Math.min(29.9999, t))).resize(RW, Math.round(RW * 9 / 16)).raw().toBuffer();
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const out = [];
for (let t0 = from; t0 < to - 0.05; t0 += BEAT) {
  const r = { t: +t0.toFixed(3), d30: [], d60: [] };
  for (let k = 0; k < pairs; k++) {
    const t = t0 + (k + 0.15) * (BEAT / pairs);
    if (t + 1 / fps > to + 1e-6) break;
    const a = await small(t), b = await small(t + 1 / 60), c = await small(t + 1 / fps);
    r.d60.push(+diff(a, b).toFixed(2));
    r.d30.push(+diff(a, c).toFixed(2));
  }
  const avg = (v) => +(v.reduce((s, x) => s + x, 0) / Math.max(1, v.length)).toFixed(2);
  out.push({ t: r.t, avg30: avg(r.d30), avg60: avg(r.d60), d30: r.d30 });
}
console.log(JSON.stringify(out));
