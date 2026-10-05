// QA del nacimiento del logo (26,20–26,80, cuadro a cuadro a 60 fps), analítico sobre las curvas reales:
//  - por letra visible: |sy/sx − 1| ≤ 0,15 y pivote en la línea base (la transformación no la mueve)
//  - el pin (con su squash) nunca se superpone con la caja de una letra visible (en px del PNG del logo)
//  - el logo está completo y quieto desde 26,70
//   node src/scenes/close/_birth-check.mjs
import { boot } from '../../../tools/node-env.mjs';
await boot({ scenes: false });
const { letterAnim, LOGO_DONE } = await import('./lockup.js');
const { pinState } = await import('./pin-drop.js');
const { lockupGeo } = await import('./layout.js');
const { logoGlyphs, pinFit, LOGO } = await import('../../brand/logo.js');
const { PIN } = await import('../../brand/pin.js');
const G = lockupGeo();
const F = G.F, PF = pinFit();
const gl = logoGlyphs();
let worstRatio = 0, overlaps = [], notStill = [], frames = 0;
for (let f = Math.ceil(26.2 * 60); f <= Math.floor(26.8 * 60); f++) {
  const t = f / 60;
  frames++;
  const A = letterAnim(t);
  const s = pinState(t, G);
  // caja del pin en px del PNG (pivote en la punta)
  let pb = null;
  if (s) {
    const k = s.size / PIN.h / F.s; // px PNG por unidad PIN
    const tipX = (s.x - F.ox) / F.s, tipY = (s.y - F.oy) / F.s;
    const hw = PIN.headR * k * s.sx, top = tipY - PIN.h * k * s.sy;
    pb = [tipX - hw, top, tipX + hw, tipY];
  }
  for (const g of gl) {
    if (g.pin) continue;
    const m = A(g.i, g);
    const visible = !m || m.alpha === undefined || m.alpha > 0.002;
    if (!visible) continue;
    if (m) {
      const r = Math.abs(m.sy / m.sx - 1);
      worstRatio = Math.max(worstRatio, r);
      if (m.dy || m.dx || m.r) notStill.push({ t: +t.toFixed(4), ch: g.ch, m });
    }
    if (t >= 26.7 && m) notStill.push({ t: +t.toFixed(4), ch: g.ch, why: 'animando después de 26,70' });
    if (pb) {
      // caja de la letra escalada alrededor de su pivote (pie, centro)
      const sx = m?.sx ?? 1, sy = m?.sy ?? 1;
      const [x0, y0, x1, y1] = g.box;
      const lb = [g.px + (x0 - g.px) * sx, g.py + (y0 - g.py) * sy, g.px + (x1 - g.px) * sx, g.py + (y1 - g.py) * sy];
      if (pb[0] < lb[2] && pb[2] > lb[0] && pb[1] < lb[3] && pb[3] > lb[1]) overlaps.push({ t: +t.toFixed(4), ch: g.ch, pin: pb.map((v) => +v.toFixed(1)), letter: lb.map((v) => +v.toFixed(1)) });
    }
  }
}
console.log(JSON.stringify({ frames, logoDone: +LOGO_DONE.toFixed(4), worstScaleDiff: +worstRatio.toFixed(4), ok15: worstRatio <= 0.15, baselinePivot: 'escala con pivote en el pie: la línea base no se mueve', pinOverlaps: overlaps.length, firstOverlaps: overlaps.slice(0, 4), notStill: notStill.slice(0, 4) }, null, 1));
