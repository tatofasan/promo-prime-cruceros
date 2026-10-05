// QA del cierre: cuánto se desplazan en pantalla la URL y el texto del CTA por la cámara de la marca (deriva y
// empuje) entre 26,72 y 30,0, cuadro a cuadro a 60 fps (el pop de entrada y el golpe de 28,125 son coreografía).
//   node src/scenes/close/_drift.mjs
import { boot } from '../../../tools/node-env.mjs';
await boot({ scenes: false });
const { uiCam } = await import('../close.js');
const { toScreen } = await import('../../engine/camera.js');
const { lockupGeo, T_URL, T_CTA } = await import('./layout.js');
const { ctaBox } = await import('./cta.js');
const { txt } = await import('../../engine/text.js');
const G = lockupGeo();
const B = ctaBox(G.cta.x, G.cta.y, G.cta.h);
const UT = txt('primecruceros.com.ar', { size: G.url.size, weight: 600, tracking: 0.035 });
const lx0 = B.x0 + B.padL + B.icon + B.gap;
const pts = {
  url: { from: T_URL + 0.4, p: [[G.url.x - UT.width / 2, G.url.y], [G.url.x + UT.width / 2, G.url.y], [G.url.x, G.url.y]] },
  cta: { from: T_CTA + 0.6, p: [[lx0, B.y], [lx0 + B.T.width, B.y], [B.x, B.y]] },
  logo: { from: 26.7, p: [[G.F.ox, G.F.oy], [G.F.ox + 2651 * G.F.s, G.F.oy + 334 * G.F.s]] },
};
const out = {};
for (const [k, o] of Object.entries(pts)) {
  let max = 0;
  for (let f = Math.ceil(Math.max(26.72, o.from) * 60); f <= 1800; f++) {
    const t = Math.min(30, f / 60), c = uiCam(t), c0 = uiCam(Math.max(26.72, o.from));
    for (const [x, y] of o.p) {
      const [a, b] = toScreen(c, 1, x, y), [a0, b0] = toScreen(c0, 1, x, y);
      max = Math.max(max, Math.hypot(a - a0, b - b0));
    }
  }
  out[k] = { desde: o.from.toFixed(2), maxDesplazamientoPx: +max.toFixed(2) };
}
console.log(JSON.stringify(out));
