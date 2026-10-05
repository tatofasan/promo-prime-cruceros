// Coreografía de la cena (todo función pura de t) contra los cues:
//   7,500 exp.dinner  corte: plato con campana girando y creciendo (sigue al flotador) con la mesa ya puesta y la vela
//                     prendida; el ala refleja 5 cuadros las rayas del flotador, destello en anillo, pop 1→1,06→1
//   7,5–9,14          push-in lento y continuo (z 1 → 1,12) con cámara en mano y un poco de roll
//   7,969 exp.cloche  la campana sale volando arriba a la derecha → plato gourmet, vapor y brillo; golpe de cámara
//                     (push-in + sacudón) y ráfaga de pétalos en primer plano (deck-a/petals.js)
//   8,203 (corchea)   la botella entra desde afuera del cuadro y frena con overshoot (golpe chico)
//   8,438 exp.pour    el chorro de malbec toca la copa (sube con remolino) en el tercio derecho; golpe y 2ª ráfaga
//   8,672 (corchea)   la mano toma la copa (golpe chico); la otra copa entra con más recorrido
//   8,906 exp.clink   chin-chin: las dos copas se tocan (con 3 cuadros de amague) con estrella y anillo
//   9,14–9,375        el plato gira como cuerpo rígido: ω 0 → 360°/s (inCubic), smear; en 9,358 r = 230
import { cue, BEAT } from '../../engine/time.js';
import { E, clamp, prog, pop, lerp, kf } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';
import { springV, wobble, cam, CX, CY } from './util.js';

export const T0 = cue('exp.dinner');
export const TC = cue('exp.cloche');
export const TP = cue('exp.pour');
export const TK = cue('exp.clink');
export const T1 = cue('exp.casino');
export const T_LIT = T0 + BEAT / 2; // 7,734: la vela se enciende en la corchea
// El cuadro de impacto es el más cercano al cue: a 60 fps puede caer hasta 8 ms ANTES. Los golpes apuntan a cue − 1/120.
export const HIT = 1 / 120;
const TKh = TK - HIT, TPh = TP - HIT;

// ------------------------------------------------------------------ cámara
export const T_EXIT = 9.14;
export const T_LAST = T1 - 1 / 60; // último cuadro de la cena (9,358): geometría del match con la ruleta
const Z_CUT = 1.05, Z_PUSH = 1.125, Z_END = 1.15;
// [t del golpe, push-in, sacudón x, y] (el del brindis queda como estaba: no mueve la geometría del corte a la ruleta)
const PUNCH = [
  [TC - HIT, 0.055, -14, 10], [TC + BEAT / 2 - HIT, 0.022, 8, -6],
  [TP - HIT, 0.06, 14, -10], [TP + BEAT / 2 - HIT, 0.026, -8, 6],
  [TK - HIT, 0.03, 0, 0],
];
export function camAt(t) {
  // entra creciendo (con la velocidad del flotador), pasa de largo y se asienta sobre el push-in lento
  const base = 1 + (Z_PUSH - 1) * E.inOutSine(prog(t, 7.88, T_EXIT));
  let z = base + springV(t - T0, Z_CUT - 1, 0.85, 0, { freq: 1.6, damp: 6.2 });
  // empuje final hacia el plato (acelera hacia el corte): 1,12 → 1,15 en el último cuadro y sigue
  const u = (t - T_EXIT) / (T_LAST - T_EXIT);
  if (u > 0) z += (Z_END - Z_PUSH) * (u < 1 ? u * u * u : 1 + 3 * (u - 1));
  // golpes de cámara en el beat (campana, vino, brindis) y en las corcheas de la acción (llega la botella, la mano
  // toma la copa): push-in que pega en el cuadro del cue y rebota, con un sacudón lateral que se amortigua
  let jx = 0, jy = 0;
  for (const [tc, amp, kx, ky] of PUNCH) {
    const d = t - tc;
    if (d > 0 && d < 0.6) {
      const w = Math.exp(-d * 9) * Math.cos(d * 22);
      z *= 1 + amp * w;
      jx += kx * w; jy += ky * w;
    }
  }
  // paneo hacia la acción del vino (sigue a la botella) y el brindis, y de vuelta al centro para el corte
  const toAct = E.inOutSine(prog(t, 7.95, 8.4)) * (1 - E.inOutCubic(prog(t, 8.98, 9.26)));
  const toClink = E.inOutSine(prog(t, 8.5, 8.9)) * (1 - E.inOutCubic(prog(t, 8.98, 9.26)));
  let x = CX + 64 * toAct + 30 * toClink + jx, y = CY - 30 * toAct - 18 * toClink + jy;
  // cámara en mano y roll lento (cero en los dos cortes)
  const env = E.inOutSine(prog(t, T0, T0 + 0.3)) * (1 - E.inOutSine(prog(t, 9.0, 9.26)));
  x += env * 10 * noise1(t * 0.7, 31);
  y += env * 8 * noise1(t * 0.7 + 17, 32);
  const r = env * (0.012 * noise1(t * 0.45 + 5, 33) + 0.03 * Math.sin(Math.PI * prog(t, 7.6, 9.1)) - 0.012);
  return cam(x, y, z, r);
}

/** Escala propia del plato en el corte: 1,0 → 1,06 → 1,0 con resorte (~8 cuadros). */
export function platePop(t) {
  const d = t - T0;
  if (d <= 0) return 1;
  return 1 + (0.06 / 0.62) * Math.exp(-d * 9) * Math.sin(d * 24);
}

// ------------------------------------------------------------------ giro del plato (horario = +)
const W_IN = (120 * Math.PI) / 180, W_OUT = 2 * Math.PI;
export function plateRot(t) {
  let a = springV(t - T0, -0.42, W_IN, 0, { freq: 1.05, damp: 4.4 });
  // amague: se va para atrás (sin velocidad al soltarse) y después acelera como cuerpo rígido (ω ∝ inCubic)
  a -= 0.09 * Math.sin((Math.PI / 2) * prog(t, 9.04, T_EXIT));
  const D = T_LAST - T_EXIT;
  const u = (t - T_EXIT) / D;
  if (u > 0) a += u < 1 ? (W_OUT * D * u * u * u * u) / 4 : (W_OUT * D) / 4 + W_OUT * (t - T_LAST);
  return a;
}
/** Velocidad angular (rad/s) para el desenfoque rotacional. */
export const plateOmega = (t) => (plateRot(t) - plateRot(t - 1 / 240)) * 240;

// ------------------------------------------------------------------ campana
export function clocheState(t) {
  // anticipación: se aprieta y "respira" (escapa luz y vapor) · después sale volando arriba a la derecha
  const ant = prog(t, 7.7, 7.84);
  const squash = 1 - 0.035 * Math.sin(Math.PI * ant) + 0.015 * wobble(t - 7.7, { freq: 9, damp: 10 });
  const q = prog(t, 7.84, 8.05);
  const h = 900 * E.outQuad(q) + 7 * Math.sin(Math.PI * ant);
  const lat = E.inQuad(q);
  return {
    on: t < 8.06,
    h, dx: 640 * lat, dy: -560 * lat, spin: 0.7 * E.inQuad(q), squash, q,
    leak: clamp(ant * 1.2) * (1 - clamp(q * 3)),
  };
}

// ------------------------------------------------------------------ armado de la mesa (caen desde arriba)
export function dropIn(t, tIn, { h0 = 640, dur = 0.2 } = {}) {
  if (t < tIn) return { a: 0, h: h0, sx: 1, sy: 1, r: 0 };
  const u = clamp((t - tIn) / dur);
  const land = tIn + dur;
  const w = wobble(t - land, { freq: 6, damp: 11 });
  return {
    a: 1,
    h: u < 1 ? h0 * (1 - E.inQuad(u)) : 0,
    sx: 1 + 0.05 * w, sy: 1 - 0.05 * w,
    r: 0.04 * w,
  };
}
export const popIn = (t, tIn, dur = 0.42, over = 1.2) => Math.max(0, pop(t, tIn, { dur, over }));

// la mesa ya está puesta en el corte: cada pieza "aterriza" justo antes de 7,5 y rebota (sin fundidos de alfa)
const TL = T0 - 0.2;
export const TABLE = {
  napkin: TL, fork: TL - 0.01, fork2: TL - 0.02, knife: TL - 0.015, spoon: TL - 0.005,
  bread: TL - 0.025, candle: T0 - 1, wine: T0 - 1, tumbler: T0 - 1, flowers: T0 - 1, votive: T0 - 1,
};

// ------------------------------------------------------------------ vela
export function candleLit(t) {
  // prendida desde el primer cuadro; en la corchea de 7,734 la llama da un respiro (acento de luz)
  const flare = t > T_LIT ? 0.6 * Math.exp(-(t - T_LIT) / 0.12) : 0;
  return { lit: 1, flare, amb: 1 };
}

// ------------------------------------------------------------------ vino (tercio derecho: x ≈ 1200–1500, y ≈ 300–500)
export const GLASS1 = { x: 1272, y: 432 };
export const BOTTLE_DIR = -0.42;
export function bottleState(t) {
  // entra desde afuera del cuadro con más recorrido y frena con overshoot; se va rápido y subiendo
  const enter = E.backOut(2.2)(prog(t, 8.02, 8.32));
  const leave = E.inCubic(prog(t, 8.6, 8.76));
  const along = 860 * (1 - enter) + 1000 * leave;
  const tilt = 0.18 + 0.27 * E.outBack(prog(t, 8.2, 8.4)) - 0.22 * E.inOutSine(prog(t, 8.56, 8.64));
  const flow = clamp((t - 8.405) / 0.035) * (1 - clamp((t - 8.56) / 0.05));
  return {
    on: t > 8.02 && t < 8.77,
    mx: GLASS1.x + 8 + Math.cos(BOTTLE_DIR) * along, my: GLASS1.y - 8 + Math.sin(BOTTLE_DIR) * along,
    mh: 372 + leave * 260, dir: BOTTLE_DIR, tilt, flow,
    reach: clamp((t - 8.405) / (TPh - 8.405)), // el chorro llega a la superficie en el cue
  };
}
export function wineLevel(t) {
  return 0.55 * E.outQuad(prog(t, TPh, 8.62));
}

// ------------------------------------------------------------------ brindis
// pies de las copas en el brindis e inclinación del cáliz hacia la otra (los bordes se tocan en CLINK)
export const G1K = { x: 1262, y: 452 }, LEAN1 = [24, -14];
export const G2K = { x: 1402.5, y: 360.8 }, LEAN2 = [-24, 14];
export const ARM1_DIR = 0.78, ARM2_DIR = -0.82;
/** Avance hacia el contacto con amague: llega al 95 %, retrocede (3 cuadros) y pega en el cue. */
const kickAt = (t) => (t > TKh ? Math.exp(-(t - TKh) * 9) * Math.sin(2 * Math.PI * 5.5 * (t - TKh)) : 0);
function approach(t, t0) {
  return kf(t, [[t0, 0], [TKh - 0.07, 0.95, E.inOutCubic], [TKh - 0.03, 0.91, E.inOutSine], [TKh, 1, E.inQuad]]);
}
export function glass1State(t) {
  // nuestra copa: espera servida, la mano la toma y va al brindis; rebota y sale hacia la cámara
  const go = approach(t, 8.74);
  const kick = kickAt(t);
  const out = E.inCubic(prog(t, 9.0, 9.3));
  return {
    x: lerp(GLASS1.x, G1K.x, go) - 8 * kick + 260 * out,
    y: lerp(GLASS1.y, G1K.y, go) + 5 * kick + 220 * out,
    lift: 64 * E.outCubic(prog(t, 8.74, 8.86)) + 420 * out,
    lean: [LEAN1[0] * go, LEAN1[1] * go],
    alpha: 1,
  };
}
export function arm1State(t) {
  const reach = E.outBack(prog(t, 8.64, 8.78));
  const g = glass1State(t);
  return {
    x: g.x + Math.cos(ARM1_DIR) * 320 * (1 - reach), y: g.y + Math.sin(ARM1_DIR) * 320 * (1 - reach), h: g.lift + 58,
    dir: ARM1_DIR, grip: E.outCubic(prog(t, 8.7, 8.77)), alpha: t > 8.64 ? 1 : 0,
  };
}
export function glass2State(t) {
  const come = approach(t, 8.5);
  const kick = kickAt(t);
  const out = E.inCubic(prog(t, 9.0, 9.28));
  const fx = Math.cos(ARM2_DIR), fy = Math.sin(ARM2_DIR);
  return {
    x: G2K.x + fx * 700 * (1 - come) + 8 * kick + fx * 260 * out,
    y: G2K.y + fy * 700 * (1 - come) - 5 * kick + fy * 260 * out,
    lift: 64 + 380 * out,
    lean: [LEAN2[0] * come, LEAN2[1] * come],
    alpha: t > 8.5 ? 1 : 0,
  };
}
/** Punto de contacto del brindis (mundo + altura). */
export const CLINK = { x: (G1K.x + LEAN1[0] + G2K.x + LEAN2[0]) / 2, y: (G1K.y + LEAN1[1] + G2K.y + LEAN2[1]) / 2, h: 64 + 112 + 160 };
