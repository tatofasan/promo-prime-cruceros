// «EXPERIENCIAS» · «ÚNICAS» · «EN CRUCERO» (5,6–12,86): golpean en 5,625 / 5,86 / 6,09 centradas y GRANDES
// (bloque arriba, centro y≈380, para dejar libre la pileta, el tobogán y el splash de DECK-A), desde ~6,85 viajan
// (escalonadas, en arco) a un lockup arriba a la izquierda, sobre una placa que es SIEMPRE la caja del texto más
// el margen (misma curva, misma ancla: el texto nunca se sale), laten en cada corte y salen juntas en exp.out.
// La anticipación (5,600–5,625) la dibuja type-hook con esta misma función: cae desde arriba, por encima del aro
// del ojo de buey (nunca lo pisa).
import { txt } from '../../engine/text.js';
import { E, clamp, lerp, pop, spring } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { makeCanvas } from '../../engine/env.js';
import { drawGlyphs, S0, spaced, warm } from './glyphs.js';
import { echoAt, lineFloat, travel } from './motion.js';
import { C, SEA, SEA_GOLD, BAR_CORAL } from './style.js';
import { drawBar } from './bar.js';
import { drawPlate, PLATE, plateState, PAD } from './plate.js';
import { drawBurst } from './burst.js';

const LIGHT = [-0.5, -0.86];
const BIGK = 0.8; // el bloque grande es un 20 % más chico que en la v1 (mismas proporciones)
const LS = PLATE.scale / BIGK; // escala del lockup respecto del bloque grande (el lockup queda del mismo tamaño)
// grande: centradas (línea de base) · bloque centrado en y≈380, base de «EN CRUCERO» en 566
const BIG = [240, 446, 566];
const UL = { off: 26, h: 16, pad: 5 };
let E1, E2, E3, LINES = null;

/** Mide, arma el lockup y pre-arma (en init: en el navegador las fuentes cargan DESPUÉS de importar las escenas). */
export function initExpTitle() {
  E1 = txt('EXPERIENCIAS', { size: 148 * BIGK, weight: 900, tracking: -0.015 });
  E2 = txt('ÚNICAS', { size: 212 * BIGK, weight: 900, tracking: -0.02 });
  E3 = spaced(txt('EN CRUCERO', { size: 120 * BIGK, weight: 900, tracking: 0.03 }), 0.1);
  const SMALL = [PLATE.y + PAD.top + E1.capH * LS, 0, 0];
  SMALL[1] = SMALL[0] + 14 + (E2.capH + E2.size * 0.2) * LS;
  SMALL[2] = SMALL[1] + 18 + E3.capH * LS;
  const m = makeCanvas(8, 8).getContext('2d');
  LINES = [E1, E2, E3].map((T, k) => {
    m.font = T.font;
    const desc = k === 2 ? UL.off + UL.h / 2 + 8 : m.measureText(T.lines[0].glyphs.map((g) => g.ch).join('')).actualBoundingBoxDescent + 12;
    return { T, k, bigX: 960 - T.width / 2, bigB: BIG[k], smX: PLATE.textX, smB: SMALL[k], desc };
  });
  // tamaño de la placa en reposo (ancla del latido)
  const R = textBox(8.0);
  PLATE.w = R.w; PLATE.h = R.h;
  warm(E1, SEA, LIGHT, true);
  warm(E2, SEA, LIGHT, true);
  warm(E3, SEA_GOLD, LIGHT, true);
}

const MOVE0 = 6.87; // arranque del viaje al lockup (después de la anticipación) — NO tocar: es lo mejor del tramo
const MOVE_DUR = 0.4;
const STAG = 0.045;
const SLAM = 0.025; // anticipación de «EXPERIENCIAS»: arranca 1,5 cuadros antes de 5,625 (en 5,600 no se ve)
const EXIT = 0.17; // salida en exp.out: las tres líneas (1 cuadro entre cada una) y la placa con la última
export const EXP_TITLE = { from: C.pool - SLAM, to: C.out + 2 / 60 + EXIT + 0.02 };

/** Progreso del viaje de la línea k (−anticipación … 1 con rebote). */
const moveK = (t, k) => travel(t, MOVE0 + k * STAG, MOVE_DUR, { back: 0.04, anti: 0.08, over: 0.05 });

/** Salida de la línea k en exp.out: { dy, a } (sube y se apaga; 1 cuadro de diferencia entre líneas). */
function exitK(t, k) {
  const q = t - (C.out + k / 60);
  if (q < -0.05) return { dy: 0, a: 1 };
  if (q < 0) return { dy: 5 * E.outCubic((q + 0.05) / 0.05), a: 1 }; // anticipación: se hunde apenas
  const e = clamp(q / EXIT);
  return { dy: 5 - 230 * E.inCubic(e), a: 1 - E.inQuad(e) };
}

/** Pose de la línea k en t: { x, b (base), s, e, dy (salida), a }. */
function linePose(t, L) {
  const m = moveK(t, L.k);
  const e = clamp(m, -0.2, 1.3);
  const s = Math.exp(lerp(0, Math.log(LS), clamp(e * 1.08 - 0.02, -0.1, 1.08)));
  const x = lerp(L.bigX, L.smX, e) - Math.sin(Math.PI * clamp(e)) * 70;
  // flotación suave mientras está grande (se apaga al viajar)
  const fl = lineFloat(t, L.k, [C.pool, C.w2, C.w3][L.k] + 0.45, { amp: 3 }) * (1 - clamp(e * 3));
  const b = lerp(L.bigB, L.smB, e) + Math.sin(Math.PI * clamp(e)) * 40 + fl;
  const X = exitK(t, L.k);
  return { x, b: b + X.dy, s, e, a: X.a };
}

/**
 * Entrada de cada palabra como UNA pieza (escala uniforme: ninguna letra a mitad de pop que parezca minúscula).
 * Devuelve { sx, sy, r, dy, a, echo } con pivote en la base centrada de la línea.
 */
function wordHit(L, t) {
  const o = { sx: 1, sy: 1, r: 0, dy: 0, a: 1, echo: -1 };
  if (L.k === 0) {
    const q = t - C.pool;
    if (q > 0 && q < 0.6) { const k = Math.exp(-q * 9) * Math.cos(q * 30); o.sy = 1 - 0.08 * k; o.sx = 1 + 0.05 * k; }
    o.echo = echoAt(q, 0.38);
  } else if (L.k === 1) {
    const q = t - C.w2;
    const dur = 0.36, t0 = -0.4 * dur;
    if (q <= t0) { o.a = 0; return o; }
    const k = q > dur * 1.7 ? 1 : pop(q, t0, { dur, over: 1.16 });
    o.sx = o.sy = Math.max(0.001, k);
    o.a = clamp(k * 4);
    o.dy = (1 - Math.min(1, k)) * 30;
    if (q < 0.6) o.r = -0.12 * Math.exp(-Math.max(0, q + 0.1) * 8) * Math.cos(q * 18);
    o.echo = echoAt(q - 0.02, 0.3);
  } else {
    // sube desde abajo con resorte (no cruza «ÚNICAS»): pasa por su lugar justo en el cue y se pasa un poco
    const q = t - C.w3;
    const h = 90, freq = 3.2, damp = 12, w = 2 * Math.PI * freq;
    const lead = (Math.PI - Math.atan(w / damp)) / w;
    if (q < -lead) { o.a = 0; return o; }
    if (q < 0.9) {
      const dy = spring(q, -lead, { from: h, to: 0, freq, damp });
      o.dy = dy;
      o.a = clamp((q + lead) / 0.05);
      const v = clamp(Math.abs(dy) / h);
      o.sy = 1 + 0.16 * v * (q < 0 ? 1 : 0.5);
      o.sx = 1 - 0.06 * v;
    }
    o.echo = echoAt(q - 0.01, 0.3);
  }
  return o;
}

/** Velo oscuro detrás del bloque grande (sobre la pileta hay mucho detalle). Arranca en el corte, no antes. */
function veil(ctx, t) {
  const a = 0.4 * E.outCubic(clamp((t - C.pool) / 0.25)) * (1 - E.inOutCubic(clamp((t - MOVE0) / 0.35)));
  if (a <= 0.01) return;
  ctx.save();
  ctx.translate(960, 385);
  ctx.scale(1, 0.48);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 760);
  g.addColorStop(0, rgba(PAL.ink, a));
  g.addColorStop(0.6, rgba(PAL.ink, a * 0.6));
  g.addColorStop(1, rgba(PAL.ink, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-760, -760, 1520, 1520);
  ctx.restore();
}

/** Latido del lockup en cada corte: pico del 6 % EXACTO en el cue, rebote corto. */
export function cutPulse(t) {
  let k = 0;
  for (const tc of [C.dinner, C.casino, C.sunset]) {
    const q = t - tc;
    if (q >= 0 && q < 0.6) k += Math.exp(-q * 10) * Math.cos(q * 22);
  }
  return k;
}

/** Caja de las líneas (pantalla, antes del latido) con sus poses: la placa la sigue cuadro a cuadro. */
function textBox(t) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, a = 0;
  for (const L of LINES) {
    const P = linePose(t, L);
    x0 = Math.min(x0, P.x - 4 * P.s);
    x1 = Math.max(x1, P.x + L.T.width * P.s * 1.02);
    y0 = Math.min(y0, P.b - L.T.capH * P.s);
    y1 = Math.max(y1, P.b + L.desc * P.s);
    if (L.k === 2) a = P.a;
  }
  return { x: x0 - PAD.left, y: y0 - PAD.top, w: x1 - x0 + PAD.left + PAD.right, h: y1 - y0 + PAD.top + PAD.bottom, a };
}

function drawLines(c, t, only = null) {
  const sp = sweepPhase(t);
  for (const L of only ?? LINES) {
    const P = linePose(t, L);
    if (P.a <= 0.003) continue;
    const H = wordHit(L, t);
    if (H.a <= 0.003) continue;
    const q = t - C.w3;
    c.save();
    c.globalAlpha *= P.a * Math.min(1, H.a);
    c.translate(P.x, P.b);
    c.scale(P.s, P.s);
    // golpe de la palabra entera (pivote: base centrada)
    const cx = L.T.width / 2;
    c.translate(cx, H.dy);
    if (H.r) c.rotate(H.r);
    if (H.sx !== 1 || H.sy !== 1) c.scale(H.sx, H.sy);
    c.translate(-cx, 0);
    // subrayado coral de «EN CRUCERO»
    if (L.k === 2 && q > 0.06) {
      const k = E.outExpo(clamp((q - 0.06) / 0.36));
      drawBar(c, -UL.pad, UL.off, L.T.width + UL.pad * 2, UL.h, k, BAR_CORAL, { light: LIGHT, depth: 6, from: 'center' });
    }
    // al viajar, las letras se aprietan (estela) y se relajan al llegar — igual para todas
    const m = moveK(t, L.k);
    const sq = m > 0 && m < 1 ? 1 + 0.08 * Math.sin(Math.PI * m) : 1;
    const echo = H.echo;
    drawGlyphs(c, L.T, { x: 0, y: -L.T.lines[0].base, style: L.k === 2 ? SEA_GOLD : SEA, light: LIGHT,
      state: sq !== 1 || (echo >= 0 && echo < 1) ? () => { const s = S0(); s.sx = sq; s.echo = echo; return s; } : null,
      sheen: sp > -1 ? { p: sp * 1.25 - L.k * 0.12, alpha: 0.95, width: 0.3 } : null });
    c.restore();
  }
}

/** Sombra blanda que acompaña al bloque mientras viaja (contraste sobre la pileta) y se funde en la placa. */
function travelShade(ctx, t, box, plateA) {
  const a = 0.62 * clamp((t - MOVE0 + 0.05) / 0.12) * (1 - plateA) * (1 - clamp((t - C.out) / 0.1));
  if (a <= 0.01) return;
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.scale(box.w / 2, box.h / 2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.25);
  g.addColorStop(0, rgba(PAL.ink, a));
  g.addColorStop(0.6, rgba(PAL.ink, a * 0.75));
  g.addColorStop(1, rgba(PAL.ink, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-1.3, -1.3, 2.6, 2.6);
  ctx.restore();
}

export function drawExpTitle(ctx, t, { scene = 'hook' } = {}) {
  if (t < EXP_TITLE.from || t >= EXP_TITLE.to) return;
  if (!LINES) initExpTitle();
  // type-hook dibuja solo la anticipación; type-exp desde 5,625
  if (scene === 'hook' && t >= C.pool) return;
  if (scene === 'exp' && t < C.pool) return;
  veil(ctx, t);
  // golpe de «EXPERIENCIAS»: cae desde ARRIBA del aro del ojo de buey (×1,6 → 1 acelerando) y pega en 5,625
  const q0 = t - C.pool;
  let slam = 1, drop = 0;
  if (q0 < 0) {
    const e = E.inQuad(clamp((q0 + SLAM) / SLAM));
    slam = 1.6 - 0.6 * e;
    drop = -235 * (1 - e);
  }
  const box = textBox(t);
  const ps = plateState(t, box.a);
  // todo el lockup (placa + texto) late junto en cada corte: misma ancla
  const pulse = cutPulse(t) * 0.06;
  ctx.save();
  if (pulse) { const px = PLATE.x, py = PLATE.y + PLATE.h / 2; ctx.translate(px, py); ctx.scale(1 + pulse, 1 + pulse); ctx.translate(-px, -py); }
  travelShade(ctx, t, box, ps.body);
  drawPlate(ctx, t, ps, box);
  ctx.save();
  ctx.globalAlpha *= clamp((q0 + SLAM) / 0.008);
  if (slam !== 1 || drop) { const cy = BIG[0] - E1.capH / 2; ctx.translate(960, cy + drop); ctx.scale(slam, slam); ctx.translate(-960, -cy); }
  // durante la anticipación solo existe «EXPERIENCIAS»
  drawLines(ctx, t, q0 < 0 ? [LINES[0]] : null);
  ctx.restore();
  ctx.restore();
  if (t >= C.pool && t < C.w3 + 0.6) hits(ctx, t);
}

/** Acción secundaria de los tres golpes del titular grande. */
function hits(c, t) {
  const [a, b, d] = LINES;
  const cy = (L) => L.bigB - L.T.capH / 2;
  drawBurst(c, t, C.pool, 960, cy(a), a.T.width * 0.53, a.T.capH * 0.7, { n: 20, seed: 31, reach: 170, kinds: ['streak', 'streak', 'dot', 'spark'], colors: ['#FFFFFF', PAL.aqua100] });
  drawBurst(c, t, C.w2, 960, cy(b), b.T.width * 0.55, b.T.capH * 0.62, { n: 18, seed: 37, reach: 170, size: 1.1, kinds: ['spark', 'dot', 'ring', 'spark'], colors: [PAL.goldPale, '#FFFFFF', PAL.gold] });
  drawBurst(c, t, C.w3, 960, cy(d), d.T.width * 0.55, d.T.capH * 0.8, { n: 12, seed: 41, reach: 100, kinds: ['dot', 'spark'], colors: [PAL.coralLight, PAL.goldPale] });
}

/** Fase del barrido de luz del lockup: cruza en cada corte (−1 = apagado). */
function sweepPhase(t) {
  for (const tc of [C.dinner, C.casino, C.sunset]) {
    const p = (t - tc + 0.02) / 0.55;
    if (p > 0 && p < 1) return p;
  }
  return -1;
}
