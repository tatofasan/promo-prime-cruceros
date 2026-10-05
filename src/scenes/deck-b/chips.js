// Fichas de casino que caen y se apilan con rebote (exp.chips). Cada ficha: costado con marcas (cilindro con
// sombreado de izquierda a derecha), tapa con anillo de marcas, incrustación central y filo de luz.
import { TAU, clamp, E } from '../../engine/ease.js';
import { PAL, shade, rgba } from '../../engine/color.js';
import { hash } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';
import { DB } from './pal.js';
import { cylFrame, sidePath, contactShadow } from './solid.js';

export const CHIP = { r: 36, h: 8.6 };
const STYLES = {
  coral: { base: DB.chipCoral, spot: PAL.warmWhite, inlay: PAL.warmWhite, mark: DB.chipCoral },
  navy: { base: DB.chipNavy, spot: PAL.gold, inlay: PAL.goldPale, mark: DB.chipNavy },
  gold: { base: DB.chipGold, spot: PAL.navy700, inlay: PAL.warmWhite, mark: shade(DB.chipGold, -0.35) },
  teal: { base: DB.chipTeal, spot: PAL.warmWhite, inlay: PAL.aqua100, mark: DB.chipTeal },
  white: { base: DB.chipWhite, spot: PAL.coral, inlay: PAL.white, mark: PAL.coral },
};
for (const k in STYLES) {
  const s = STYLES[k];
  s.dark = shade(s.base, -0.42);
  s.mid = shade(s.base, -0.18);
  s.light = shade(s.base, 0.35);
  s.spotDark = shade(s.spot, -0.35);
}

/** Pilas sobre la grilla de apuestas: posición en la mesa, cantidad, color y retardo respecto del cue. */
export const STACKS = [
  { x: -560, y: -10, n: 9, style: 'coral', d: 0.0, glint: true },
  { x: -478, y: -92, n: 6, style: 'gold', d: 0.05 },
  { x: -640, y: -110, n: 7, style: 'navy', d: 0.085 },
  { x: -400, y: 70, n: 4, style: 'teal', d: 0.12, glint: true },
  { x: -700, y: 46, n: 8, style: 'white', d: 0.03 },
  { x: -360, y: -40, n: 3, style: 'navy', d: 0.155 },
  // la última apuesta: cae tarde y sigue asentándose con rebote hasta el látigo
  { x: -300, y: 150, n: 4, style: 'gold', d: 0.27, glint: true },
];
const DT = 0.024; // separación entre fichas que aterrizan (≈1,5 cuadros)
const FALL = 0.2; // segundos de caída
const HFALL = 1500; // altura desde la que caen (arranca fuera de cuadro)

/** Una ficha en (x, y, z): squash en el espesor, giro de las marcas, alfa. */
export function drawChip(ctx, cam, x, y, z, styleId, spin = 0, sq = 1) {
  const st = STYLES[styleId];
  const h = CHIP.h * sq, r = CHIP.r;
  const F = cylFrame(cam, x, y, z, r, h);
  const a0 = F.th0, a1 = F.th0 + Math.PI;
  const pa = F.P(a0), pb = F.P(a1);
  // costado: cilindro con luz desde la izquierda
  const g = ctx.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
  g.addColorStop(0, st.light);
  g.addColorStop(0.25, st.mid);
  g.addColorStop(1, st.dark);
  ctx.fillStyle = g;
  ctx.fill(sidePath(F, a0, a1, 12));
  // marcas del canto (6 rectángulos que siguen el giro)
  for (let k = 0; k < 6; k++) {
    let c = spin + (k * TAU) / 6;
    c = a0 + (((c - a0) % TAU) + TAU) % TAU; // llevar a [a0, a0 + 2π)
    const w = 0.2;
    const s0 = Math.max(a0, c - w), s1 = Math.min(a1, c + w);
    if (s1 <= s0) continue;
    const f = (c - a0) / Math.PI;
    ctx.fillStyle = f < 0.45 ? st.spot : st.spotDark;
    ctx.fill(sidePath(F, s0, s1, 3));
  }
  // tapa
  const m = cam.aff(x, y, z + h);
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = st.base; ctx.fill();
  // marcas del borde sobre la tapa
  ctx.save();
  ctx.rotate(spin);
  ctx.fillStyle = st.spot;
  for (let k = 0; k < 6; k++) {
    ctx.save();
    ctx.rotate((k * TAU) / 6);
    ctx.fillRect(r * 0.74, -r * 0.13, r * 0.26, r * 0.26);
    ctx.restore();
  }
  // anillo interior punteado
  ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, TAU);
  ctx.strokeStyle = rgba(st.spot, 0.85); ctx.lineWidth = r * 0.05;
  ctx.setLineDash([r * 0.1, r * 0.08]); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  // incrustación central con estrella
  ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, TAU);
  ctx.fillStyle = st.inlay; ctx.fill();
  ctx.save();
  ctx.rotate(spin);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.14 : r * 0.32;
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = st.mark; ctx.fill();
  ctx.restore();
  // filo de luz arriba-izquierda y sombra dura abajo-derecha del bisel
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r - 1.2, Math.PI * 1.0, Math.PI * 1.55);
  ctx.strokeStyle = rgba(PAL.white, 0.75); ctx.lineWidth = 1.8; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r - 1, Math.PI * 0.05, Math.PI * 0.6);
  ctx.strokeStyle = rgba(PAL.ink, 0.3); ctx.lineWidth = 2.2; ctx.stroke();
  ctx.restore();
}

/** Estado de la ficha i de una pila en t: altura, squash, corrimiento, giro. */
function chipState(S, i, t, tCue) {
  const tl = tCue + S.d + i * DT;
  const dt = t - tl;
  const jx = (hash(i, S.x, 3) - 0.5) * 16, jy = (hash(i, S.y, 7) - 0.5) * 16;
  const spin0 = hash(i, S.x, 11) * TAU;
  const rest = i * CHIP.h;
  if (dt < -FALL) return null;
  if (dt < 0) {
    const p = -dt / FALL; // 1 arriba → 0 al tocar
    return { z: rest + HFALL * p * p, sq: 1, dx: jx * 2.2, dy: jy * 2.2, spin: spin0 - dt * 9, air: p };
  }
  const bounce = 9 * Math.exp(-dt * 26) * Math.abs(Math.sin(dt * 42));
  const sq = 1 - 0.34 * Math.exp(-dt * 30) * Math.cos(dt * 55);
  const settle = Math.exp(-dt * 14);
  return { z: rest + bounce, sq, dx: jx * (0.3 + 1.9 * settle), dy: jy * (0.3 + 1.9 * settle), spin: spin0 + 1.4 * (1 - Math.exp(-dt * 7)), air: 0, dt };
}

/** Todas las pilas (ordenadas de lejos a cerca). glint: destello en la ficha de arriba al completarse. */
export function drawStacks(ctx, cam, t, tCue) {
  const order = [...STACKS].sort((a, c) => c.y - a.y);
  for (const S of order) {
    // sombra de contacto de la pila y de las fichas en el aire
    const landed = [];
    let airborne = null;
    for (let i = 0; i < S.n; i++) {
      const c = chipState(S, i, t, tCue);
      if (!c) continue;
      if (c.air > 0) { if (!airborne || c.air < airborne.air) airborne = c; } else landed.push(c);
    }
    if (!landed.length && !airborne) continue;
    if (landed.length) contactShadow(ctx, cam, S.x, S.y, CHIP.r * 1.05, { alpha: 0.6, dx: 12 + landed.length * 1.6, dy: -10 - landed.length * 1.6, soft: 1.35 });
    if (airborne) contactShadow(ctx, cam, S.x + airborne.dx, S.y + airborne.dy, CHIP.r * (1 + airborne.air * 1.4), { alpha: 0.5 * (1 - airborne.air) ** 1.5, dx: 14, dy: -12, soft: 1.5 });
    for (let i = 0; i < S.n; i++) {
      const c = chipState(S, i, t, tCue);
      if (!c) continue;
      drawChip(ctx, cam, S.x + c.dx, S.y + c.dy, c.z, S.style, c.spin, c.sq);
    }
    // destello cuando la pila se completa
    const top = chipState(S, S.n - 1, t, tCue);
    if (S.glint && top && top.air === 0 && top.dt < 0.3) {
      const k = Math.sin(clamp(top.dt / 0.3) * Math.PI);
      const p = cam.p(S.x + top.dx - CHIP.r * 0.55, S.y + top.dy + CHIP.r * 0.35, top.z + CHIP.h);
      sparkle(ctx, p.x, p.y, 16 * p.s * k, { alpha: k, color: PAL.goldPale, rot: top.dt * 2, halo: 0.9 });
    }
  }
}

/** Anillos de golpe sobre el paño cuando aterriza la primera ficha de cada pila. */
export function drawImpactRings(ctx, cam, t, tCue) {
  for (const S of STACKS) {
    const dt = t - (tCue + S.d);
    if (dt < 0 || dt > 0.35) continue;
    const p = E.outCubic(dt / 0.35);
    const m = cam.aff(S.x, S.y, 0.5);
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.beginPath();
    ctx.arc(0, 0, CHIP.r * (1.1 + p * 2.4), 0, TAU);
    ctx.strokeStyle = rgba(PAL.goldLight, 0.55 * (1 - p));
    ctx.lineWidth = 5 * (1 - p) + 0.5;
    ctx.stroke();
    ctx.restore();
  }
}
