// QA del cierre: contraste WCAG del texto contra su fondo REAL en el cuadro renderizado (pieza completa).
//   node src/scenes/close/_contrast.mjs --t=29.98
// CTA: fila por fila en el alto de las letras, fondo = píxeles verdes de la cara (ni texto ni extrusión), se toma el
// más claro de cada fila (peor caso). URL: fondo = percentil 90 de luminancia de lo que no es texto en su caja.
import sharp from 'sharp';
import { boot, parseArgs } from '../../../tools/node-env.mjs';
const f = parseArgs();
const B = await boot();
const { ctaBox } = await import('./cta.js');
const { lockupGeo } = await import('./layout.js');
const { txt } = await import('../../engine/text.js');
const t = Number(f.t ?? 29.98);
const { data, info } = await sharp(B.png(t)).raw().toBuffer({ resolveWithObject: true });
const W = info.width, ch = info.channels;
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Lum = (i) => 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]);
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
// cerca de texto (radio 3 px con algún píxel claro): borde antialias, no es fondo
const nearText = (x, y, thr) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Lum(((y + dy) * W + x + dx) * ch) > thr) return true; return false; };
const G = lockupGeo();
const Bx = ctaBox(G.cta.x, G.cta.y, G.cta.h);
const T = Bx.T;
const tx0 = Math.round(Bx.x0 + Bx.padL + Bx.icon + Bx.gap), tx1 = Math.round(tx0 + T.width);
const cap = T.capH ?? 31;
const yA = Math.round(Bx.y - cap / 2 - 2), yB = Math.round(Bx.y + cap / 2 + 2);
const rows = [];
let textL = 0;
for (let y = yA; y <= yB; y++) {
  let bgMax = 0, n = 0;
  for (let x = tx0; x < tx1; x++) {
    const i = (y * W + x) * ch, L = Lum(i);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (L > 0.85) textL = Math.max(textL, L);
    if (g > r + 50 && g > b + 30 && L > 0.11 && L < 0.6 && !nearText(x, y, 0.6)) { bgMax = Math.max(bgMax, L); n++; }
  }
  rows.push({ y, bgMax: +bgMax.toFixed(3), n });
}
const worst = rows.filter((r) => r.n > 20).reduce((a, r) => (r.bgMax > a.bgMax ? r : a), { bgMax: 0 });
const textRef = Math.max(textL, 0.9);
const out = { t, cta: { textL: +textRef.toFixed(3), worstRow: worst.y, worstBgL: worst.bgMax, minContrast: +cr(textRef, worst.bgMax).toFixed(2),
  rows: rows.filter((_, k) => k % 6 === 0).map((r) => `${r.y}:${cr(textRef, r.bgMax).toFixed(2)}`).join(' ') } };
// URL
const U = G.url, UT = txt('primecruceros.com.ar', { size: U.size, weight: 600, tracking: 0.035 });
const ux0 = Math.round(U.x - UT.width / 2), ux1 = Math.round(U.x + UT.width / 2), uy0 = Math.round(U.y - UT.height / 2), uy1 = Math.round(U.y + UT.height / 2);
const bg = [];
let uText = 0;
for (let y = uy0; y < uy1; y++) for (let x = ux0; x < ux1; x++) { const L = Lum((y * W + x) * ch); if (L > 0.8) uText = Math.max(uText, L); else if (L < 0.5 && !nearText(x, y, 0.5)) bg.push(L); }
bg.sort((a, b) => a - b);
const p90 = bg[Math.floor(bg.length * 0.9)], p99 = bg[Math.floor(bg.length * 0.99)];
out.url = { textL: +uText.toFixed(3), bgP90: +p90.toFixed(3), bgP99: +p99.toFixed(3), contrastP90: +cr(uText, p90).toFixed(2), contrastP99: +cr(uText, p99).toFixed(2), box: [ux0, uy0, ux1, uy1] };
console.log(JSON.stringify(out, null, 1));
