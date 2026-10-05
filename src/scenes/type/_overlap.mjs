// Verificación numérica: ¿se pisan las letras del gancho gris durante el empuje de la ola? (solo para medir)
// Reproduce el empuje de hook-grey.js (mismas constantes) con las cajas de tinta de cada letra rotadas.
import { createCanvas } from '@napi-rs/canvas';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { boot, root } from '../../../tools/node-env.mjs';
await boot({ scenes: false });
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { txt } = await imp('src/engine/text.js');
const { smoothstep, clamp } = await imp('src/engine/ease.js');
const { HOOK_WAVE } = await imp('src/scenes/waves.js');
const { spaced, glyphList } = await imp('src/scenes/type/glyphs.js');
const c = createCanvas(8, 8).getContext('2d');
const X0 = 124, BASE = [416, 604, 734], PUSH = 270;
const Ls = [spaced(txt('¿Y SI', { size: 212, weight: 900, tracking: -0.02 }), 0.16), spaced(txt('TUS PRÓXIMAS', { size: 112, weight: 900, tracking: -0.01 }), 0.12), txt('VACACIONES…', { size: 118, weight: 900, tracking: -0.01 })];
const pushF = (x) => 1 + 0.55 * clamp((1100 - x) / 1000);
const kpAt = (t) => { const k = smoothstep(0.2, 0.8, HOOK_WAVE.p(t)); return k * k; };
function polys(t) {
  const kp = kpAt(t), out = [];
  Ls.forEach((T, k) => {
    c.font = T.font;
    for (const it of glyphList(T)) {
      const m = c.measureText(it.g.ch);
      const gx = it.ln.x0 + it.g.x, l = gx - m.actualBoundingBoxLeft, r = gx + (it.g.dot !== undefined ? it.g.w : m.actualBoundingBoxRight);
      const top = it.base - m.actualBoundingBoxAscent, bot = it.base + m.actualBoundingBoxDescent;
      const f = pushF(X0 + it.cx);
      const dx = -PUSH * kp * f, dy = -70 * kp * f, rot = -0.11 * kp * f;
      const pts = [[l, top], [r, top], [r, bot], [l, bot]].map(([x, y]) => {
        const u = x - it.cx, v = y - it.base;
        return [X0 + it.cx + dx + u * Math.cos(rot) - v * Math.sin(rot), BASE[k] - T.lines[0].base + it.base + dy + u * Math.sin(rot) + v * Math.cos(rot)];
      });
      out.push({ k, ch: it.g.ch, pts });
    }
  });
  return out;
}
// penetración (SAT) entre cajas convexas: 0 si no se tocan. Las cajas de pares con kerning (AV, ¿Y) ya se
// cruzan en reposo: lo que se verifica es que el empuje NUNCA aumente esa penetración (las letras se separan).
function pen(A, B) {
  let best = Infinity;
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4];
    let nx = y2 - y1, ny = x1 - x2; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    const pa = A.map(([x, y]) => x * nx + y * ny), pb = B.map(([x, y]) => x * nx + y * ny);
    const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (o <= 0) return 0;
    best = Math.min(best, o);
  }
  return best;
}
const R = polys(3.0);
const bad = [];
let worst = 0;
for (let t = 3.45; t <= 3.9; t += 1 / 60) {
  const G = polys(t);
  for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
    const d = pen(G[i].pts, G[j].pts) - pen(R[i].pts, R[j].pts);
    worst = Math.max(worst, d);
    if (d > 1) bad.push(`${t.toFixed(3)} ${G[i].ch}(${G[i].k})×${G[j].ch}(${G[j].k}) +${d.toFixed(1)}px`);
  }
}
console.log(bad.length ? bad.slice(0, 30).join(' | ') : `el empuje nunca acerca letras (peor: +${worst.toFixed(2)} px) 3.45–3.90`);
