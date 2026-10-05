// Huella visual de la pieza: md5 de cuadros a tiempos fijos (uno cada medio beat + todos los cues).
// Sirve para comprobar que un cambio que NO debería tocar la imagen (comentarios, documentación, refactor)
// deja los píxeles idénticos.
//
//   node tools/fingerprint.mjs --out=huella.json          → guarda la huella
//   node tools/fingerprint.mjs --compare=huella.json      → compara contra una guardada (exit 1 si difiere)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { boot, parseArgs } from './node-env.mjs';

const flags = parseArgs();
const B = await boot();
const I = B.info;
const times = new Set();
for (let t = 0; t < I.DUR; t += I.BEAT / 2) times.add(+t.toFixed(4));
for (const c of I.cues) times.add(+c.t.toFixed(4));
times.add(+(I.DUR - 1 / I.FPS).toFixed(4));
const list = [...times].sort((a, c) => a - c);
const print = {};
for (const t of list) print[t.toFixed(4)] = createHash('md5').update(B.png(t)).digest('hex');
if (flags.compare) {
  const ref = JSON.parse(readFileSync(String(flags.compare), 'utf8'));
  const diff = Object.keys(ref).filter((k) => ref[k] !== print[k]);
  console.log(JSON.stringify({ ok: diff.length === 0, frames: Object.keys(ref).length, differentAt: diff.slice(0, 30) }, null, 1));
  process.exit(diff.length ? 1 : 0);
}
writeFileSync(String(flags.out ?? 'huella.json'), JSON.stringify(print, null, 1));
console.log(JSON.stringify({ ok: true, frames: list.length, out: flags.out ?? 'huella.json' }));
