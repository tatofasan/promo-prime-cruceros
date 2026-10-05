// NAVIERAS (18,75–20,625): kicker «LAS MEJORES NAVIERAS» que golpea palabra por palabra SIN que las letras se
// encimen (cada palabra se agranda desde su borde izquierdo, hacia donde todavía no hay nada) con extrusión navy
// en dos pasadas (primero todas las extrusiones, después todas las caras), y una grilla de 3×2 chips limpios
// (sin logos) de igual ancho con calles de 24 px. Los chips hacen pop en 3 cuadros asentado en su corchea,
// laten con el bombo y los cruza un barrido de luz; el bloque hace un push-in lento. En lines.out: anticipación
// con inclinación 3D (sigue legible) y LÁTIGO HACIA ARRIBA real desde ~20,47.
import { W, cue, beatPulse, BEAT as BEAT_S } from '../../engine/time.js';
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, TAU } from '../../engine/ease.js';
import { txt } from '../../engine/text.js';
import { sparkle, lin, lensFlare } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';

const T0 = cue('lines.in'), OUT = cue('lines.out'), END = 20.625;
export const LT = { t0: T0, out: OUT, whip: OUT + 0.075, end: END };
const CHIPS = [
  ['MSC', 'lines.in'], ['Costa', 'lines.c2'], ['Royal Caribbean', 'lines.c3'],
  ['Norwegian', 'lines.c4'], ['Celebrity', 'lines.c5'], ['Princess', 'lines.c6'],
];
const KS = 96, KY = 352;           // kicker: tamaño y centro vertical
const CS = 46, GUT = 24;           // chips: tamaño de letra y calle
const ROW0 = 612;                  // centro de la primera fila
const BLOCK_C = [960, 535];        // centro del push-in del bloque

let K = null, G = null;
/** Mide el kicker y arma la grilla (en init: en el navegador las fuentes cargan antes). */
export function initLines() {
  if (K) return;
  // ---- kicker: tracking 0, +0,02 em en los pares L–A y A–S (Outfit los junta demasiado)
  const words = ['LAS', 'MEJORES', 'NAVIERAS'];
  const Tm = txt('LAS MEJORES NAVIERAS', { size: KS, weight: 900, tracking: 0 });
  const extra = 0.02 * KS;
  const glyphs = Tm.lines[0].glyphs.map((g) => ({ ...g }));
  let shift = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i], p = glyphs[i - 1];
    if (p && p.word === g.word && ((p.ch === 'L' && g.ch === 'A') || (p.ch === 'A' && g.ch === 'S'))) shift += extra;
    if (p && p.word !== g.word) shift += 0.08 * KS; // calle entre palabras un poco más ancha (aire en el golpe)
    g.x += shift;
  }
  const total = Tm.width + shift;
  const x0 = W / 2 - total / 2;
  const W_ = words.map((_, wi) => {
    const gs = glyphs.filter((g) => g.word === wi);
    const a = gs[0].x, b = gs[gs.length - 1].x + gs[gs.length - 1].w;
    return { gs, left: x0 + a, right: x0 + b, w: b - a, cx: x0 + (a + b) / 2 };
  });
  K = { font: Tm.font, capH: Tm.capH, x0, words: W_, base: KY + Tm.capH / 2 };
  // ---- grilla de chips: todos del ancho del más largo
  const tm = CHIPS.map(([s]) => txt(s, { size: CS, weight: 700, tracking: 0.01 }));
  const capH = tm[0].capH;
  const padX = 0.62 * CS, padY = 0.5 * CS;
  const iconH = capH * 1.9, iconW = iconH + CS * 0.3;
  const cw = Math.max(...tm.map((m) => m.width)) + iconW + 2 * padX;
  const ch = capH + 2 * padY;
  const cells = CHIPS.map(([label, id], i) => {
    const c = i % 3, r = Math.floor(i / 3);
    return { label, tc: cue(id), i, x: W / 2 + (c - 1) * (cw + GUT), y: ROW0 + r * (ch + GUT), tm: tm[i] };
  });
  G = { cw, ch, capH, iconH, iconW, cells };
}

// ------------------------------------------------------------------ salida
/** Desplazamiento vertical del bloque: amague hacia abajo (anticipación) y látigo hacia ARRIBA. */
export function exitY(t, d = 0) {
  const dip = E.outSine(prog(t, OUT + d, OUT + 0.06 + d)) * (1 - E.inQuad(prog(t, LT.whip + d, LT.whip + 0.05 + d)));
  const up = Math.pow(prog(t, LT.whip + d, LT.whip + 0.25 + d), 3);
  return 22 * dip - 1500 * up;
}
/** Velocidad vertical de salida (px/s) para el smear. */
export function exitVel(t) {
  const h = 1 / 240;
  return (exitY(t + h) - exitY(t - h)) / (2 * h);
}
/** Inclinación 3D de la anticipación (0..1): el bloque se echa hacia atrás y vuelve al salir. */
const tilt = (t) => E.inOutSine(prog(t, OUT, OUT + 0.06)) * (1 - E.outCubic(prog(t, LT.whip, LT.whip + 0.08)));

function anchorIcon(c, h) {
  // insignia circular cian con un ancla blanca (no es logo: ícono genérico)
  const r = h * 0.5;
  c.save();
  c.translate(r, 0);
  c.fillStyle = PAL.brandCyan;
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  c.fillStyle = rgba(PAL.white, 0.25);
  c.beginPath(); c.arc(-r * 0.25, -r * 0.3, r * 0.55, 0, TAU); c.fill();
  c.strokeStyle = PAL.white;
  c.lineWidth = r * 0.16;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -r * 0.5); c.lineTo(0, r * 0.58);
  c.moveTo(-r * 0.3, -r * 0.18); c.lineTo(r * 0.3, -r * 0.18);
  c.moveTo(-r * 0.55, r * 0.12); c.quadraticCurveTo(-r * 0.45, r * 0.62, 0, r * 0.6); c.quadraticCurveTo(r * 0.45, r * 0.62, r * 0.55, r * 0.12);
  c.stroke();
  c.beginPath(); c.arc(0, -r * 0.62, r * 0.13, 0, TAU); c.stroke();
  c.restore();
}

function pill(c, x, y, w, h) {
  const r = h / 2;
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

/** Bokeh dorado que sube despacio detrás de las navieras (vida en el fondo oscuro). par = [dx, dy] corrimiento
 *  de parallax (px) que le pasa la escena según el viaje de la cámara: los más grandes (más cerca) se corren más. */
function bokeh(ctx, t, par = [0, 0]) {
  const a = clamp((t - T0 + 0.1) / 0.4);
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const r = 8 + hash(i, 31) * 30;
    const depth = 0.4 + 1.2 * hash(i, 31);
    const x = ((hash(i, 32) * 2200 + Math.sin(t * 0.8 + i) * 18 + par[0] * depth) % 2200 + 2200) % 2200 - 140;
    const y = ((hash(i, 33) * 1300 - (t - T0) * (70 + 110 * hash(i, 34)) + par[1] * depth) % 1300 + 1300) % 1300 - 110 + exitY(t, 0.02) * (0.3 + 0.5 * hash(i, 35));
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7) + 0.6 * beatPulse(t, { from: T0, every: 1, decay: 0.12, offset: (i % 4) * 0.25 });
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(i % 4 ? PAL.gold : PAL.aqua200, 0.26 * a * tw));
    g.addColorStop(0.7, rgba(i % 4 ? PAL.gold : PAL.aqua200, 0.09 * a * tw));
    g.addColorStop(1, rgba(PAL.gold, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ kicker
// LAS 18,55 · MEJORES 18,65 · NAVIERAS 18,75 (= lines.in). El escalonado (0,1 s) es igual a lo que dura el
// golpe: cuando una palabra crece, la anterior ya aterrizó y la siguiente todavía no existe → nunca se tocan.
const WORD_HIT = (wi) => T0 - (2 - wi) * 0.1;
/** Transformación de la palabra wi en t: null si todavía no entró. */
function wordState(wi, t) {
  const hit = WORD_HIT(wi), t0 = hit - 0.1;
  const dt = t - t0;
  if (dt < 0) return null;
  const Wd = K.words[wi];
  if (dt < 0.1) {
    // se agranda desde su borde IZQUIERDO (a la derecha todavía no hay palabras): no choca con nada
    const s = 1.36 - 0.36 * E.inQuad(dt / 0.1);
    return { ox: Wd.left, s, sx: s, sy: s, a: clamp(dt / 0.04) };
  }
  // golpe: aplasta y rebota SOLO en vertical (no invade la calle entre palabras)
  const q = dt - 0.1;
  const k = Math.exp(-q * 10) * Math.cos(q * 34);
  return { ox: Wd.cx, s: 1, sx: 1, sy: 1 - 0.13 * k, a: 1 };
}

function drawKicker(ctx, t) {
  const gold = lin(ctx, 0, K.base - K.capH, 0, K.base, [PAL.goldPale, PAL.gold]);
  const states = K.words.map((_, wi) => wordState(wi, t));
  const cy = K.base - K.capH / 2;
  const each = (fn) => K.words.forEach((Wd, wi) => {
    const s = states[wi];
    if (!s || s.a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha *= s.a;
    ctx.translate(s.ox, cy);
    ctx.scale(s.sx, s.sy);
    ctx.translate(-s.ox, -cy);
    fn(Wd, wi);
    ctx.restore();
  });
  ctx.save();
  ctx.font = K.font;
  ctx.textBaseline = 'alphabetic';
  // subrayado coral que crece debajo de NAVIERAS (y engorda con el bombo)
  const up = E.outExpo(clamp((t - (T0 + 0.05)) / 0.42));
  if (up > 0) {
    const Wd = K.words[2];
    const h = 9 + 4 * beatPulse(t, { from: T0 + 0.3, every: 1, decay: 0.12 });
    const x0 = Wd.left - 4, w = (Wd.w + 8) * up, y = K.base + 22;
    ctx.fillStyle = PAL.coral;
    ctx.beginPath();
    pill(ctx, x0, y - h / 2, Math.max(h, w), h);
    ctx.fill();
  }
  // flotación por letra después del golpe (acción secundaria; 2,5 px)
  const fl = (g, wi) => 2.5 * Math.sin(t * 6.3 + g.char * 0.6) * clamp((t - WORD_HIT(wi) - 0.15) / 0.3);
  // PASADA 1: extrusiones de todas las letras (navy900, profundidad 9)
  each((Wd, wi) => {
    ctx.fillStyle = PAL.navy900;
    for (const g of Wd.gs) { const dy = fl(g, wi); for (let k = 9; k >= 1; k--) ctx.fillText(g.ch, K.x0 + g.x + 0.6 * k, K.base + k + dy); }
  });
  // PASADA 2: caras (NAVIERAS en degradé dorado)
  each((Wd, wi) => {
    ctx.fillStyle = wi === 2 ? gold : PAL.white;
    for (const g of Wd.gs) ctx.fillText(g.ch, K.x0 + g.x, K.base + fl(g, wi));
  });
  // barrido de luz sobre las caras
  const p = prog(t, cue('lines.c6') + 0.1, cue('lines.c6') + 0.55);
  if (p > 0 && p < 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const x = K.x0 - 200 + (K.words[2].right - K.x0 + 400) * E.inOutSine(p);
    ctx.beginPath();
    for (const Wd of K.words) for (const g of Wd.gs) ctx.rect(K.x0 + g.x - 4, K.base - K.capH - 6, g.w + 8, K.capH + 12);
    ctx.clip();
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = PAL.white;
    for (const Wd of K.words) for (const g of Wd.gs) {
      const gx = K.x0 + g.x + g.w / 2;
      const f = Math.max(0, 1 - Math.abs(gx - x) / 110);
      if (f <= 0) continue;
      ctx.globalAlpha = 0.55 * f;
      ctx.fillText(g.ch, K.x0 + g.x, K.base);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ chips
/** Escala del pop de un chip: 3 cuadros hasta asentarse EN su corchea, con un temblor chico después. */
function chipPop(t, tc) {
  const p = clamp((t - (tc - 0.05)) / 0.05);
  if (p <= 0) return 0;
  const s = E.backOut(2.2)(p);
  const q = t - tc;
  return q > 0 ? 1 + 0.014 * Math.exp(-q * 10) * Math.sin(q * 30) : s;
}

/** Salto en ola con el bombo: cada chip brinca unos px en cada beat, escalonado de izquierda a derecha. */
function hop(t, c) {
  if (t < c.tc + 0.12) return 0;
  const on = clamp((t - c.tc - 0.12) / 0.2);
  // flota siempre un poco y brinca en cada corchea (fuerte en el beat, suave en el «y»). La ola va por
  // COLUMNA: las dos filas de una columna se mueven juntas, así las calles quedan siempre iguales
  const col = c.i % 3;
  const bob = 3.5 * Math.sin(t * 7.1 + col * 1.9);
  const q = (t - T0 - col * 0.035) / (BEAT_S / 2);
  const k = Math.floor(q), ph = (q - k) * (BEAT_S / 2);
  const d = 0.17;
  const amp = ((k % 2) + 2) % 2 === 0 ? 11 : 6;
  return on * (bob + (ph < d ? -amp * Math.sin((Math.PI * ph) / d) : 0));
}

/** Efectos del pop de un chip (resplandor, anillo, chispas): van en una pasada ANTES de las píldoras, así
 *  las chispas de un chip nunca tapan el texto de su vecino. */
function drawChipFx(ctx, t, c) {
  const k = chipPop(t, c.tc);
  const dt = t - c.tc;
  if (k <= 0.01 || dt > 0.42) return;
  const { cw, ch } = G;
  ctx.save();
  ctx.translate(c.x, c.y + hop(t, c));
  // resplandor del pop (luz que se apaga en 0,25 s)
  if (dt > -0.03 && dt < 0.25) {
    const q = clamp(dt / 0.25), r = cw * (0.55 + 0.35 * q);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(PAL.goldPale, 0.45 * (1 - q)));
    g.addColorStop(1, rgba(PAL.gold, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.scale(1, 0.45);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
  }
  // anillo que se expande al aparecer
  if (dt > -0.02 && dt < 0.3) {
    const q = clamp(dt / 0.3), e = E.outCubic(q);
    const w = cw * (1 + 0.14 * e), h = ch * (1 + 0.45 * e);
    ctx.strokeStyle = rgba(PAL.goldLight, (1 - q) * 0.9);
    ctx.lineWidth = 4 * (1 - q) + 1;
    ctx.beginPath();
    pill(ctx, -w / 2, -h / 2, w, h);
    ctx.stroke();
  }
  // chispas
  if (dt > -0.02) {
    const q = clamp(dt / 0.42);
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU + hash(c.i, j) * 0.8;
      const d = cw * 0.36 + 110 * E.outCubic(q);
      sparkle(ctx, Math.cos(a) * d, Math.sin(a) * d * 0.5, 13 * (1 - q), { alpha: 1 - q, color: j % 2 ? PAL.goldLight : PAL.white });
    }
  }
  ctx.restore();
}

/** Pulso de luz de los chips YA asentados en cada beat: halo dorado detrás de la píldora y un anillo fino que
 *  se abre (no tapa el texto: va en la pasada de efectos, debajo de las píldoras). */
function drawChipBeat(ctx, t, c) {
  if (t < c.tc + 0.2) return;
  // fuerte en el beat, suave en el «y» (acompaña el saltito de cada corchea)
  const k = Math.max(beatPulse(t, { from: T0, every: 1, decay: 0.11 }), 0.5 * beatPulse(t, { from: T0, every: 1, decay: 0.09, offset: 0.5 }));
  const q = ((t - T0) % BEAT_S) / 0.32;
  if (k < 0.02 && q >= 1) return;
  const { cw, ch } = G;
  ctx.save();
  ctx.translate(c.x, c.y + hop(t, c));
  ctx.globalCompositeOperation = 'lighter';
  if (k > 0.02) {
    const r = cw * 0.62;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, rgba(PAL.goldPale, 0.34 * k));
    g.addColorStop(0.6, rgba(PAL.gold, 0.14 * k));
    g.addColorStop(1, rgba(PAL.gold, 0));
    ctx.save();
    ctx.scale(1, 0.5);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.restore();
  }
  if (q < 1) {
    const e = E.outCubic(q);
    const w = cw * (1.01 + 0.07 * e), h = ch * (1.06 + 0.5 * e);
    ctx.strokeStyle = rgba(PAL.goldLight, 0.7 * (1 - q) * (1 - q));
    ctx.lineWidth = 1 + 3 * (1 - q);
    ctx.beginPath();
    pill(ctx, -w / 2, -h / 2, w, h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChipCell(ctx, t, c) {
  const k = chipPop(t, c.tc);
  if (k <= 0.01) return;
  const { cw, ch } = G;
  const rot = (hash(c.i, 5) - 0.5) * 0.05 * Math.exp(-Math.max(0, t - c.tc) * 14);
  ctx.save();
  ctx.translate(c.x, c.y + hop(t, c));
  ctx.rotate(rot);
  ctx.scale(k, k);
  // píldora: sombra, cuerpo claro, filo dorado
  ctx.save();
  ctx.shadowColor = rgba(PAL.ink, 0.5);
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 9;
  ctx.beginPath();
  pill(ctx, -cw / 2, -ch / 2, cw, ch);
  ctx.fillStyle = lin(ctx, 0, -ch / 2, 0, ch / 2, [PAL.white, '#E3F3F8']);
  ctx.fill();
  ctx.restore();
  // filo dorado que se enciende con el bombo
  const kb = t > c.tc + 0.2 ? beatPulse(t, { from: T0, every: 1, decay: 0.11 }) : 0;
  ctx.strokeStyle = rgba(kb > 0.05 ? PAL.goldLight : PAL.gold, 0.9);
  ctx.lineWidth = 3 + 2.5 * kb;
  ctx.stroke();
  // ícono + texto centrados como grupo
  const gw = G.iconW + c.tm.width;
  const gx = -gw / 2;
  ctx.save();
  ctx.translate(gx, 0);
  anchorIcon(ctx, G.iconH);
  ctx.restore();
  ctx.font = c.tm.font;
  ctx.fillStyle = PAL.navy900;
  ctx.textBaseline = 'alphabetic';
  for (const g of c.tm.lines[0].glyphs) ctx.fillText(g.ch, gx + G.iconW + g.x, G.capH / 2);
  ctx.restore();
}

/** Barrido de luz diagonal que cruza los 6 chips (pasa por el centro en ~20,16). */
function chipSweep(ctx, t) {
  const p = prog(t, 20.06, 20.26);
  if (p <= 0 || p >= 1) return;
  const { cw, ch } = G;
  ctx.save();
  ctx.beginPath();
  for (const c of G.cells) pill(ctx, c.x - cw / 2, c.y - ch / 2, cw, ch);
  ctx.clip();
  const x0 = G.cells[0].x - cw / 2 - 260, x1 = G.cells[2].x + cw / 2 + 260;
  const x = x0 + (x1 - x0) * E.inOutSine(p);
  ctx.translate(x, ROW0 + ch / 2);
  ctx.rotate(-0.35);
  const g = ctx.createLinearGradient(-110, 0, 110, 0);
  g.addColorStop(0, rgba(PAL.white, 0));
  g.addColorStop(0.5, rgba(PAL.white, 0.75));
  g.addColorStop(1, rgba(PAL.white, 0));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(-110, -500, 220, 1000);
  ctx.restore();
}

/** Golpe de luz de lines.in: onda dorada que sale del kicker hacia los bordes. */
function impactWave(ctx, t) {
  const dt = t - T0;
  if (dt < 0 || dt > 0.5) return;
  const q = dt / 0.5;
  const x = K.words[2].cx, y = KY;
  const r = 60 + 1500 * E.outCubic(q), w = 90 + 220 * q, R = r + w * 0.4;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, rgba(PAL.goldLight, 0));
  g.addColorStop(Math.max(0, (r - w) / R), rgba(PAL.goldLight, 0));
  g.addColorStop(r / R, rgba(PAL.goldLight, 0.26 * (1 - q) * (1 - q)));
  g.addColorStop(1, rgba(PAL.goldLight, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(-200, -200, W + 400, 1480);
  ctx.restore();
}

/** Navieras completas (texto y chips) en t. */
export function drawLines(ctx, t, { par = [0, 0] } = {}) {
  if (t < T0 - 0.25) return;
  if (!K) initLines();
  bokeh(ctx, t, par);
  impactWave(ctx, t);
  // push-in lento del bloque (1 → 1,08) + pulso de bombo del bloque entero (las calles escalan parejas) + salida
  const zb = (1 + 0.08 * E.inOutSine(prog(t, T0 - 0.1, OUT))) * (1 + 0.022 * beatPulse(t, { from: T0 + 0.2, every: 1, decay: 0.1 }));
  const tl = tilt(t);
  ctx.save();
  ctx.translate(BLOCK_C[0], BLOCK_C[1] + exitY(t));
  ctx.scale(zb * (1 + 0.03 * tl), zb * (1 - 0.12 * tl));
  // inclinación «3D» leve: se echa hacia atrás (arriba más chico que abajo no se puede en 2D: va un sesgo)
  ctx.transform(1, 0, -0.06 * tl, 1, 0, 0);
  ctx.translate(-BLOCK_C[0], -BLOCK_C[1]);
  drawKicker(ctx, t);
  for (const pass of [drawChipBeat, drawChipFx, drawChipCell]) {
    for (const c of G.cells) {
      ctx.save();
      // cada fila sale con un leve retardo (la de abajo arrastra)
      ctx.translate(0, exitY(t, 0.012 + Math.floor(c.i / 3) * 0.018) - exitY(t));
      pass(ctx, t, c);
      ctx.restore();
    }
  }
  chipSweep(ctx, t);
  // destello anamórfico dorado en el golpe de NAVIERAS
  const fk = t >= T0 - 0.02 ? Math.exp(-Math.max(0, t - T0) / 0.16) : 0;
  if (fk > 0.01) lensFlare(ctx, K.words[2].cx, KY - 8, { intensity: 0.85 * fk, tint: PAL.gold, streak: 1100, core: 90, ghosts: false });
  ctx.restore();
}

/** Velo y desenfoque del mapa detrás de las navieras (0..1): arranca cuando ya se leyó la red (18,57). */
export function linesVeil(t) {
  return E.outCubic(prog(t, 18.57, T0 + 0.12));
}

/** Para pruebas: cajas de los chips en pantalla en t → [{ label, x0, y0, x1, y1 }] (sin giro, que es < 0,5°). */
export function chipBoxes(t) {
  if (!K) initLines();
  const zb = (1 + 0.08 * E.inOutSine(prog(t, T0 - 0.1, OUT))) * (1 + 0.022 * beatPulse(t, { from: T0 + 0.2, every: 1, decay: 0.1 }));
  const tl = tilt(t);
  const sx = zb * (1 + 0.03 * tl), sy = zb * (1 - 0.12 * tl);
  return G.cells.filter((c) => chipPop(t, c.tc) > 0.01).map((c) => {
    const k = chipPop(t, c.tc);
    const ly = c.y + hop(t, c) + exitY(t, 0.012 + Math.floor(c.i / 3) * 0.018) - exitY(t);
    const cx = BLOCK_C[0] + (c.x - BLOCK_C[0]) * sx - 0.06 * tl * (ly - BLOCK_C[1]) * sx;
    const cy = BLOCK_C[1] + exitY(t) + (ly - BLOCK_C[1]) * sy;
    const hw = (G.cw * k * sx) / 2, hh = (G.ch * k * sy) / 2;
    return { label: c.label, x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
  });
}
