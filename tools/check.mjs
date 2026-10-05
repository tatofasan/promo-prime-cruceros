// Control de calidad técnico del motor y las escenas:
//  1) recorre la pieza (o un tramo) cada 1/15 s en modo estricto: cualquier excepción falla
//  2) determinismo: los mismos t dibujados en otro orden (y después de otros cuadros) dan píxeles idénticos
//  3) tiempos: ms por cuadro (promedio, máximo y los más lentos) para estimar el render final
//
//   node tools/check.mjs                 · node tools/check.mjs --from=5.6 --to=7.5 · --step=0.0333
import { createHash } from 'node:crypto';
import { boot, parseArgs } from './node-env.mjs';

const flags = parseArgs();
const B = await boot();
const I = B.info;
const from = Number(flags.from ?? 0), to = Number(flags.to ?? I.DUR), step = Number(flags.step ?? 1 / 15);
const report = { ok: true, errors: [], slow: [], determinism: null };
const times = [];
for (let t = from; t <= to + 1e-9; t += step) times.push(+t.toFixed(4));

const ms = [];
for (const t of times) {
  const a = performance.now();
  try { B.touch(t); } catch (e) { report.ok = false; report.errors.push(String(e?.message || e).slice(0, 600)); if (report.errors.length > 12) break; continue; }
  ms.push([t, performance.now() - a]);
}
const hashAt = (t) => createHash('md5').update(B.png(t)).digest('hex');
const probe = [from, (from + to) / 2, to - 0.01, from + (to - from) * 0.27, from + (to - from) * 0.73].map((x) => +x.toFixed(4));
const h1 = probe.map(hashAt);
const h2 = [...probe].reverse().map(hashAt).reverse();
const mism = probe.filter((_, i) => h1[i] !== h2[i]);
report.determinism = mism.length ? { ok: false, differentAt: mism } : { ok: true, probes: probe.length };
if (mism.length) report.ok = false;
if (ms.length) {
  const v = ms.map((x) => x[1]);
  report.frames = ms.length;
  report.msAvg = +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1);
  report.msMax = +Math.max(...v).toFixed(1);
  report.slow = ms.sort((a, c) => c[1] - a[1]).slice(0, 8).map(([t, m]) => ({ t, ms: +m.toFixed(1) }));
  report.estFinalMinutes = +((report.msAvg * 6 * 1800) / 1000 / 60 / 12).toFixed(1);
  report.note = 'ms medidos en un solo proceso: si la máquina está cargada, se inflan (medir con la máquina libre)';
}
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
