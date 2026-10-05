// Baranda de cubierta a contraluz: pasamanos de teca con filo dorado, parantes de acero, paneles de vidrio
// (se ve el mar a través, con reflejos y canto brillante) y zócalo. Coordenadas del plano de la baranda (z = 1).
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { lin, rrectPath, sparkle } from '../../engine/draw.js';
import { E, clamp } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { grain } from './grain.js';

export const RAIL = { top: 698, hand: 18, glassTop: 722, glassBot: 876, kick: 878, base: 905, x0: -700, x1: 2620 };
export const POSTS = [];
for (let k = -4; k <= 4; k++) {
  if (k === 0) continue;
  POSTS.push(960 + Math.sign(k) * (150 + (Math.abs(k) - 1) * 300));
}
POSTS.sort((a, c) => a - c);

const C = {
  wood: mixHex(mixHex(PAL.navy900, '#4A2418', 0.5), PAL.dusk, 0.15),
  woodDark: mixHex(PAL.ink, '#2A1210', 0.4),
  woodLit: mixHex(PAL.gold, PAL.coral, 0.25),
  steel: mixHex(PAL.navy900, PAL.dusk, 0.3),
  steelDark: PAL.ink,
  rim: PAL.goldLight,
};

let P = null;
function build() {
  // (sin addPath: en napi une el último punto con el camino agregado)
  const panels = new Path2D();
  const xs = [RAIL.x0, ...POSTS, RAIL.x1];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i] + 9, b = xs[i + 1] - 9;
    panels.rect(a, RAIL.glassTop, b - a, RAIL.glassBot - RAIL.glassTop);
  }
  P = { panels, xs };
}
export function initRail() { if (!P) build(); }

/** Luz del sol en x (más fuerte cerca de la columna del sol, x ≈ 960). */
const sunK = (x, sx) => Math.exp(-Math.pow((x - sx) / 520, 2));

/**
 * Dibuja la baranda en coordenadas del plano. sx = x del sol en ese plano.
 * sweep 0..1 = barrido de luz sobre el vidrio; glint 0..1 = brillo extra (beat).
 */
export function drawRail(ctx, t, { sx = 960, sweep = 0, glint = 0 } = {}) {
  if (!P) build();
  const { top, hand, glassTop, glassBot, kick, base, x0, x1 } = RAIL;
  // vidrio: tinte navy (el mar se ve detrás, más profundo), reflejo frío arriba y canto dorado
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, glassTop, 0, glassBot, [[0, rgba(PAL.navy700, 0.16)], [0.55, rgba(PAL.navy800, 0.3)], [1, rgba(PAL.navy900, 0.5)]]);
  ctx.fill(P.panels);
  ctx.clip(P.panels);
  // reflejos diagonales (vetas frías) que se corren apenas con el tiempo
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < P.xs.length - 1; i++) {
    const a = P.xs[i], b = P.xs[i + 1];
    const w = b - a;
    const off = hash(i, 3) * w * 0.5 + t * 6;
    ctx.fillStyle = rgba(PAL.aqua200, 0.07);
    skew(ctx, a + off, glassTop, 26, glassBot - glassTop, 0.45);
    ctx.fillStyle = rgba(PAL.aqua100, 0.05);
    skew(ctx, a + off + 44, glassTop, 9, glassBot - glassTop, 0.45);
  }
  // barrido de luz (beat): banda cálida que cruza todos los paneles
  if (sweep > 0 && sweep < 1) {
    const cx = -200 + 2300 * E.inOutSine(sweep);
    ctx.fillStyle = lin(ctx, cx - 130, 0, cx + 130, 0, [[0, rgba(PAL.goldPale, 0)], [0.5, rgba(PAL.goldPale, 0.42)], [1, rgba(PAL.goldPale, 0)]]);
    skew(ctx, cx - 130 - 77, glassTop, 260, glassBot - glassTop, 0.5);
  }
  ctx.restore();
  // cantos del vidrio: borde superior encendido cerca del sol, laterales finos
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < P.xs.length - 1; i++) {
    const a = P.xs[i] + 9, b = P.xs[i + 1] - 9;
    const k = 0.25 + 0.75 * sunK((a + b) / 2, sx);
    ctx.fillStyle = lin(ctx, a, 0, b, 0, [[0, rgba(C.rim, 0.12 * k)], [0.5, rgba(C.rim, (0.55 + 0.4 * glint) * k)], [1, rgba(C.rim, 0.12 * k)]]);
    ctx.fillRect(a + 2, glassTop, b - a - 4, 2);
    ctx.fillStyle = rgba(PAL.peach, 0.22 * k);
    ctx.fillRect(a, glassTop + 2, 1.6, glassBot - glassTop - 4);
    ctx.fillRect(b - 1.6, glassTop + 2, 1.6, glassBot - glassTop - 4);
  }
  ctx.restore();

  // zócalo
  ctx.fillStyle = C.steel;
  ctx.fillRect(x0, kick, x1 - x0, base - kick);
  ctx.fillStyle = lin(ctx, x0, 0, x1, 0, [[0, rgba(C.rim, 0.05)], [clamp((sx - x0) / (x1 - x0)), rgba(C.rim, 0.75)], [1, rgba(C.rim, 0.05)]]);
  ctx.fillRect(x0, kick, x1 - x0, 2.2);
  ctx.fillStyle = rgba(PAL.ink, 0.5);
  ctx.fillRect(x0, base - 7, x1 - x0, 7);

  // parantes: tubo con sombra del lado opuesto al sol, filo de luz del lado del sol y brida arriba
  for (const px of POSTS) {
    const side = px < sx ? 1 : -1; // hacia dónde está el sol
    const k = 0.35 + 0.65 * sunK(px, sx);
    ctx.fillStyle = C.steel;
    ctx.fillRect(px - 7, top + hand - 2, 14, base - top - hand);
    ctx.fillStyle = C.steelDark;
    ctx.fillRect(side > 0 ? px - 7 : px + 2, top + hand, 5, base - top - hand - 2);
    ctx.fillStyle = rgba(C.rim, 0.9 * k);
    ctx.fillRect(side > 0 ? px + 4.5 : px - 7, top + hand, 2.5, base - top - hand - 6);
    // abrazaderas del vidrio
    for (const yy of [glassTop + 22, glassBot - 30]) {
      ctx.fillStyle = C.steel;
      ctx.fillRect(px - 15, yy, 30, 13);
      ctx.fillStyle = rgba(C.rim, 0.65 * k);
      ctx.fillRect(px - 15, yy, 30, 1.6);
    }
  }

  // pasamanos de teca: cuerpo, panza en sombra, lomo encendido por el sol (más brillante cerca de él)
  const hp = rrectPath(x0, top, x1 - x0, hand, hand / 2);
  ctx.fillStyle = C.wood;
  ctx.fill(hp);
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x0, top + hand * 0.58, x1 - x0, hand * 0.42);
  grain(ctx, hp, { alpha: 0.12, blend: 'overlay' });
  const g = lin(ctx, sx - 1500, 0, sx + 1500, 0, [[0, rgba(C.woodLit, 0.25)], [0.36, rgba(C.woodLit, 0.6)], [0.5, rgba(PAL.goldPale, 1)], [0.64, rgba(C.woodLit, 0.6)], [1, rgba(C.woodLit, 0.25)]]);
  ctx.fillStyle = g;
  ctx.fillRect(x0 + 4, top, x1 - x0 - 8, 3.4);
  ctx.fillStyle = rgba(C.woodLit, 0.35);
  ctx.fillRect(x0 + 4, top + 3.4, x1 - x0 - 8, 3);
  // brillo especular del pasamanos frente al sol (destella en el beat)
  sparkle(ctx, sx + 6, top + 1.5, 14 + 26 * glint, { color: PAL.goldPale, alpha: 0.6 + 0.4 * glint, halo: 0.7 });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, sx - 260, 0, sx + 260, 0, [[0, rgba(PAL.goldLight, 0)], [0.5, rgba(PAL.goldPale, 0.55)], [1, rgba(PAL.goldLight, 0)]]);
  ctx.fillRect(sx - 260, top - 1, 520, 3);
  ctx.restore();
}

function skew(ctx, x, y, w, h, k) {
  ctx.beginPath();
  ctx.moveTo(x + h * k, y);
  ctx.lineTo(x + h * k + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
}
