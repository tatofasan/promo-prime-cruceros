// Tiempos por cuadro en dos pasadas (para separar calentamiento de costo real).
import { boot } from '../../../tools/node-env.mjs';
const B = await boot();
for (let pass = 0; pass < 2; pass++) {
  const ms = [];
  for (let t = 26; t <= 30; t += 1 / 15) { const a = performance.now(); B.pixels(+t.toFixed(4)); ms.push(performance.now() - a); }
  ms.sort((a, b) => a - b);
  console.log(JSON.stringify({ pass, avg: +(ms.reduce((s, x) => s + x, 0) / ms.length).toFixed(1), med: +ms[ms.length >> 1].toFixed(1), max: +ms[ms.length - 1].toFixed(1) }));
}
