// Cámara del mapa: centro (cx, cy) en coordenadas de mapa, zoom z (px de pantalla por px de mapa) y roll r.
// Se define por encuadres («tal lugar en tal punto de pantalla con tal zoom») y se interpola en log(z),
// así el zoom se siente parejo. Encima va una deriva de mano y un «dolly» lento que no se detiene nunca
// (el mapa jamás queda congelado). Dos tramos son a medida: el LÁTIGO al sur (contramovimiento, pico de
// velocidad EN map.whip y frenada con overshoot) y el alejamiento de map.all (micro push-in + ease-in-out).
// Todo función pura de t.
import { W, H, cue } from '../../engine/time.js';
import { E, kf, clamp, lerp, smoothstep, prog } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';
import { PLACES } from './world.js';

/** Encuadre: el punto de mapa `p` queda en la pantalla en (sx, sy) con zoom z. */
export function frame(p, sx, sy, z, r = 0) {
  return { cx: p[0] - (sx - W / 2) / z, cy: p[1] - (sy - H / 2) / z, lz: Math.log(z), r };
}
const fr = (k, sx, sy, z, r = 0) => frame(PLACES[k], sx, sy, z, r);
const at = (cx, cy, z, r = 0) => ({ cx, cy, lz: Math.log(z), r });

// tiempos de la escena
export const T = {
  in: cue('map.in'), route: cue('map.route'), uy: cue('map.uy'), br: cue('map.br'), car: cue('map.car'),
  trans: cue('map.trans'), eu: cue('map.eu'), dxb: cue('map.dxb'), whip: cue('map.whip'), ant: cue('map.ant'),
  all: cue('map.all'), hold: cue('map.hold'), lines: cue('lines.in'), out: cue('lines.out'), end: 20.625,
};

// zoom del corte con el sol: lo bastante abierto para que el Río de la Plata se lea entero (costa nítida a ambos
// lados del estuario) y no como una mancha desenfocada pegada al pin
export const Z_IN = 12;

// encuadre amplio con toda la red (EU arriba y la Antártida abajo entran justo con sus rótulos)
export const WIDE = at(-62, 137, 0.64);

// tramo del látigo: [w0 contramovimiento · w1 arranque · wp pico de velocidad (= cue) · w2 resuelto]
export const WH = { w0: T.whip - 0.075, w1: T.whip - 0.025, wp: T.whip, w2: T.whip + 0.2 };
const WHIP_FROM = fr('dxb', 1236, 560, 1.92);
const WHIP_TO = fr('ant', 880, 650, 1.95);
// tramo de map.all: [a0 micro push-in · a1 = cue, arranca el alejamiento · a2 llega a la red completa]
export const AL = { a0: T.all - 0.066, a1: T.all, a2: T.all + 0.2 };
const ALL_FROM = at(-64, 146, 0.68);
const ALL_PUSH = at(-64, 148, 0.696);

/** Ease «sale rápido y sigue rodando»: frena como outCubic pero llega con velocidad (no se congela). */
const outTail = (f = 0.5, w = 0.3) => (p) => (1 - w) * E.outCubic(Math.min(1, p / f)) + w * p;

const KEYS_A = [
  [T.in, fr('ba', 960, 685, Z_IN)],
  [T.in + 0.12, fr('ba', 948, 682, Z_IN * 0.75), E.inSine],    // aterriza: la cámara recién arranca (squash)
  [T.route - 0.15, fr('ba', 880, 640, 4.7), E.outCubic],        // se aleja rápido atravesando las nubes y frena
  [T.route, fr('ba', 900, 650, 5.5), E.inOutSine],              // anticipación: toma aire (push-in de 9 cuadros)
  [T.uy - 0.04, fr('ba', 700, 566, 3.0), outTail(0.5, 0.42)],   // map.route: la ruta sale y la cámara se dispara
                                                                // hacia atrás y al este (paneo anticipado a Uruguay)
  [T.uy + 0.26, fr('rio', 1120, 330, 2.55), E.inOutCubic],     // encuadre anticipado: Uruguay + Río
  [T.br + 0.2, fr('rio', 1092, 350, 2.32), E.outSine],         // deriva (Brasil)
  [T.car - 0.1, fr('car', 690, 360, 1.22), E.inOutCubic],      // Río → Caribe
  [T.car + 0.18, fr('car', 640, 396, 1.13), E.outSine],
  [T.trans + 0.06, fr('car', 470, 590, 0.98), E.inOutSine],    // se abre al Atlántico: todo el arco
  [T.eu - 0.07, fr('eu', 1250, 400, 1.2), E.inOutCubic],       // llega a Europa (queda el Atlántico a la izquierda)
  [T.eu + 0.14, fr('eu', 1232, 392, 1.26), E.outSine],
  [T.dxb - 0.06, fr('dxb', 1226, 566, 1.8), E.inOutCubic],     // Europa → Dubái (con el mar Rojo)
  [WH.w0, WHIP_FROM, E.inOutSine],                             // aguanta (empuje lento)
];
const KEYS_B = [
  [WH.w2 + 0.2, WHIP_TO],
  [T.ant + 0.02, fr('ant', 872, 676, 1.78), E.inOutSine],
  [AL.a0, ALL_FROM, E.inOutSine],                              // dolly hacia atrás: anticipa la red completa
];
const KEYS_C = [
  [AL.a2, WIDE],
  [T.hold, at(-60, 136, 0.648), E.outSine],
  [T.hold + 0.36, at(-70, 146, 0.596), E.inOutSine],          // anticipación (toma aire): se abre un 8 %
  [T.out, at(250, 152, 0.84), E.inOutSine],                     // el mapa de fondo viaja sin parar detrás de las
                                                                // navieras (parallax con el bloque; máxima en c3–c4)
  [T.out + 0.065, at(254, 139, 0.846), E.outSine],             // amague hacia abajo (anticipación)
  [T.out + 0.075, at(255, 139, 0.846), E.linear],
  [T.end, at(258, 600, 0.85), E.inCubic],                     // LÁTIGO hacia ARRIBA (el mapa sigue subiendo)
];

// --------------------------------------------------------------- látigo
const WA = 0.022;  // contramovimiento (fracción del recorrido hacia el norte)
const WO = 0.022;  // overshoot al frenar
const RISE = WH.wp - WH.w1, TAU_W = 0.042;
/** Avance del látigo 0 → 1 (con contramovimiento negativo antes y overshoot después). */
export function whipS(t) {
  if (t <= WH.w0) return 0;
  if (t < WH.w1) return -WA * E.inOutSine(prog(t, WH.w0, WH.w1));
  // velocidad: sube en RISE (sin²) hasta el pico en WH.wp y cae exponencial
  const tau = t - WH.w1;
  const area = RISE / 2 + TAU_W;
  let a;
  if (tau < RISE) a = tau / 2 - (RISE / (2 * Math.PI)) * Math.sin((Math.PI * tau) / RISE);
  else a = RISE / 2 + TAU_W * (1 - Math.exp(-(tau - RISE) / TAU_W));
  const m = a / area;
  return -WA + (1 + WA + WO) * m - WO * E.inOutSine(prog(t, WH.wp + 0.12, WH.w2 + 0.2));
}
function whipCam(t) {
  const s = whipS(t);
  const sc = clamp(s, 0, 1);
  // a mitad de camino se abre (zoom out) para no recorrer 4000 px de pantalla
  const dip = 0.75 * Math.sin(Math.PI * sc);
  return {
    cx: lerp(WHIP_FROM.cx, WHIP_TO.cx, s), cy: lerp(WHIP_FROM.cy, WHIP_TO.cy, s),
    lz: lerp(WHIP_FROM.lz, WHIP_TO.lz, s) - dip, r: 0,
  };
}

// --------------------------------------------------------------- map.all
function allCam(t) {
  if (t < AL.a1) return kfMix(ALL_FROM, ALL_PUSH, E.inOutSine(prog(t, AL.a0, AL.a1)));
  return kfMix(ALL_PUSH, WIDE, E.inOutSine(prog(t, AL.a1, AL.a2)));
}
const kfMix = (a, b, p) => ({ cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), lz: lerp(a.lz, b.lz, p), r: lerp(a.r, b.r, p) });

/** Cámara base (sin deriva). */
export function camBase(t) {
  if (t < WH.w0) return kf(t, KEYS_A);
  if (t < WH.w2 + 0.2) return whipCam(t);
  if (t < AL.a0) return kf(t, KEYS_B);
  if (t < AL.a2) return allCam(t);
  return kf(t, KEYS_C);
}

/** Cámara en t (con deriva de mano y dolly vivo). */
export function camAt(t) {
  const k = camBase(t);
  const z0 = Math.exp(k.lz);
  // deriva orgánica en px de pantalla (arranca en cero para que el corte con el sol sea exacto) y se calma
  // en el látigo; «respira» un poco en el zoom para que el mapa nunca quede quieto
  const on = smoothstep(T.in, T.in + 0.4, t) * (1 - 0.8 * smoothstep(WH.w0 - 0.04, WH.w0, t) * (1 - smoothstep(WH.w2, WH.w2 + 0.15, t)));
  // más calma en la toma amplia (los rótulos de arriba y abajo van justos en el área segura)
  const amp = 9 * on * (1 - 0.5 * smoothstep(AL.a1, AL.a2, t) * (1 - smoothstep(T.lines - 0.2, T.lines - 0.05, t)));
  const dx = amp * (noise1(t * 0.62, 41) + 0.35 * noise1(t * 2.1, 44));
  const dy = amp * 0.7 * (noise1(t * 0.62 + 17.3, 42) + 0.35 * noise1(t * 2.3 + 3.1, 45));
  const lz = k.lz + on * (amp / 9) * 0.018 * noise1(t * 0.5 + 9.7, 46);
  const z = Math.exp(lz);
  return { cx: k.cx + dx / z, cy: k.cy + dy / z, z, r: k.r + on * 0.004 * noise1(t * 0.4 + 5.1, 43), z0 };
}

/** Velocidad de la cámara en px de pantalla por segundo (para el smear de los látigos). */
export function camVel(t, dt = 1 / 240) {
  const a = camAt(t - dt), b = camAt(t + dt);
  const [ax, ay] = toScr(a, b.cx, b.cy);
  return [(W / 2 - ax) / (2 * dt), (H / 2 - ay) / (2 * dt)];
}
/** Velocidad del zoom (d ln z / dt). */
export function zoomVel(t, dt = 1 / 240) {
  return (Math.log(camAt(t + dt).z) - Math.log(camAt(t - dt).z)) / (2 * dt);
}

/** Aplica la cámara al contexto (dentro de save/restore). */
export function applyCam(ctx, c) {
  ctx.translate(W / 2, H / 2);
  if (c.r) ctx.rotate(c.r);
  ctx.scale(c.z, c.z);
  ctx.translate(-c.cx, -c.cy);
}

/** Punto de mapa → pantalla. */
export function toScr(c, x, y) {
  let dx = (x - c.cx) * c.z, dy = (y - c.cy) * c.z;
  if (c.r) { const s = Math.sin(c.r), k = Math.cos(c.r); [dx, dy] = [dx * k - dy * s, dx * s + dy * k]; }
  return [W / 2 + dx, H / 2 + dy];
}

/** Tamaño de pin en pantalla según el zoom (no escala lineal: siempre legible). */
export function pinSizeFor(z) {
  return 58 + 30 * clamp((Math.log(z) - Math.log(0.64)) / (Math.log(2.2) - Math.log(0.64))) + 6 * clamp(Math.log(z / 2.2));
}
