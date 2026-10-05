// Cámara del mar abierto. Tres actos:
//  1) la ola la revuelca: llega inclinada y baja (al ras del agua) y se endereza con resorte en el drop;
//  2) PUSH-IN real hacia el barco (E.inOutCubic, z 1 → 1,45 entre 3,75 y 5,156) montada en el oleaje: rolido
//     suave de ±1,5°, cámara en mano y paneo que acompaña al barco (el primer plano se corre mucho más rápido que
//     el horizonte), con el retumbe del bocinazo;
//  3) anticipación (dolly-out del 3 % con aplastamiento, 5,08–5,156) y disparo al casco con E.inExpo.
import { E, clamp, prog, spring, smoothstep, TAU } from '../../../engine/ease.js';
import { noise1 } from '../../../engine/noise.js';
import { R } from './time.js';

/** Curva del disparo: arranca casi quieta (todavía se suelta la anticipación) y acelera en expo hasta el vidrio. */
export function pushK(t) {
  const p = prog(t, R.push, R.land);
  return 0.1 * E.inCubic(p) + 0.9 * E.inExpo(p);
}
/** Velocidad del disparo (1/s, en fracción de k): para el desenfoque de movimiento y las estelas. */
export function pushRate(t) {
  const d = 1 / 120;
  return (pushK(t + d) - pushK(t - d)) / (2 * d);
}

/** Anticipación: 0 → 1 entre 5,08 y el disparo (5 cuadros) y se suelta en ~3 cuadros cuando arranca. */
export function antic(t) {
  if (t < R.ant) return 0;
  if (t < R.push) return E.outCubic(prog(t, R.ant, R.push));
  return 1 - E.inOutSine(prog(t, R.push, R.push + 0.1));
}

/** Mecida de la cámara sobre una loma: sube rápido, rebota un poco y se asienta. */
function lurch(u) {
  if (u <= 0) return 0;
  return Math.sin(Math.min(u / 0.1, 1) * Math.PI / 2) * Math.exp(-Math.max(0, u - 0.1) / 0.11) * Math.cos(Math.max(0, u - 0.1) * 9);
}

/**
 * Golpes de LENTE en el beat (zoom uniforme de todo el plano del mar, cielo incluido; el titular de TYPE no se
 * mueve): entran en un cuadro y se sueltan en ~0,15 s. Negras más fuertes que las corcheas. Se apagan antes del
 * disparo al casco (desde 5,14 vale 1 exacto).
 */
const HITS = [[R.drop + R.beat / 2, 0.016], [R.q5, 0.03], [R.q5 + R.beat / 2, 0.022], [R.horn, 0.032], [R.horn2, 0.02]];
export function lensPunch(t) {
  if (t < HITS[0][0] || t >= 5.14) return 1;
  let z = 0;
  for (const [tb, a] of HITS) {
    const u = t - tb;
    if (u > 0) z += a * (1 - Math.exp(-u / 0.01)) * Math.exp(-u / 0.12);
  }
  return 1 + z * (1 - smoothstep(5.04, 5.14, t));
}

/**
 * Sacudón de LENTE en los golpes grandes (solo el plano del mar; el titular queda quieto y legible): un temblor
 * vertical que se apaga en ~0,2 s. Devuelve [dx, dy] en px de pantalla. Cero desde 5,14 (el disparo no cambia).
 */
const JOLTS = [[R.q5, 15], [R.q5 + R.beat / 2, 7], [R.horn, 17], [R.horn2, 8]];
export function lensJolt(t) {
  if (t < JOLTS[0][0] || t >= 5.14) return [0, 0];
  let a = 0;
  for (const [tb, A] of JOLTS) if (t > tb) a += A * Math.exp(-(t - tb) / 0.1);
  a *= 1 - smoothstep(5.04, 5.14, t);
  return [0.45 * a * noise1(t * 34, 71), a * noise1(t * 38, 72)];
}

/** Push-in del drop (0 → 1 entre 3,75 y 5,156). */
export const pushIn = (t) => E.inOutCubic(prog(t, R.drop, R.push));

/**
 * Cámara del mar en t (antes del disparo al casco). Pivote cerca del barco, sobre el horizonte.
 * { x, y, z, r, cx, cy, sq } para drawSky/drawOcean/plane (sq = aplastamiento vertical de la anticipación).
 */
export function seaCam(t) {
  // 1) revolcón: la ola la deja inclinada y al ras del agua; se endereza con resorte desde el drop
  const s0 = R.drop - 0.05;
  const zDrop = spring(t, s0, { from: 0.1, to: 0, freq: 1.7, damp: 5.0 });
  const roll0 = spring(t, s0, { from: 0.05, to: 0, freq: 1.5, damp: 4.4 });
  const rise = spring(t, s0, { from: 110, to: 0, freq: 1.4, damp: 4.2 });
  // 2) push-in real
  const pi = pushIn(t);
  // 3) anticipación: retrocede un 3 %, baja un poco y se aplasta
  const a = antic(t);
  let z = (1 + zDrop) * (1 + 0.45 * pi) * (1 - 0.03 * a);
  // golpe chico en «CRUCERO?» (el cue ya da un punch global)
  const q5 = t >= R.q5 ? Math.exp(-(t - R.q5) / 0.13) : 0;
  z *= 1 + 0.03 * q5;
  // oleaje: la cámara flota; paneo que acompaña al barco (+70 px) y mano viva
  const sw = TAU * 0.55 * (t - R.drop);
  const hh = (k, s) => noise1(t * k + s * 7.3, s);
  let x = 70 * pi + 5 * Math.sin(TAU * 0.7 * t + 0.4) + 7 * hh(0.9, 3) + 3 * hh(2.1, 4);
  let y = rise + 10 * Math.sin(TAU * 0.95 * (t - R.drop)) + 5 * hh(0.8, 5) + 2.5 * hh(2.3, 6) + 26 * a;
  // rolido suave ±1,5° (un balanceo de barco) + mano
  const deg = Math.PI / 180;
  let r = roll0 + 1.5 * deg * Math.sin(sw + 0.6) * clamp((t - R.drop + 0.05) / 0.25) + 0.25 * deg * hh(1.1, 8) - 0.6 * deg * a;
  // sacudón corto en «CRUCERO?»
  x += 8 * q5 * noise1(t * 36, 21);
  y += 7 * q5 * noise1(t * 39, 22);
  // bocinazo: golpe de cámara (punch) y retumbe que se apaga
  if (t > R.horn - 0.02) {
    const q = t - R.horn;
    z *= 1 + 0.03 * Math.exp(-Math.max(0, q) / 0.14) * clamp((q + 0.02) / 0.03);
    const k = Math.exp(-Math.max(0, q) / 0.3) * clamp((q + 0.02) / 0.04);
    x += 11 * k * noise1(t * 38, 11);
    y += 9 * k * noise1(t * 41, 12);
    r += 0.004 * k * noise1(t * 33, 13);
  }
  // segundo toque (corchea): golpecito más chico
  if (t > R.horn2) z *= 1 + 0.016 * Math.exp(-(t - R.horn2) / 0.1);
  // las lomas del primer plano (4,22 y 4,74) pasan por debajo de la cámara: la levantan, la inclinan y la sueltan (se apaga
  // del todo antes del disparo: desde 5,14 la cámara del disparo es la misma de siempre)
  const gate = 1 - smoothstep(5.04, 5.14, t);
  if (gate > 0) {
    const l1 = lurch(t - R.q5 - 0.05), l2 = lurch(t - R.horn - 0.1);
    y += (30 * l1 + 18 * l2) * gate;
    x -= (12 * l1 + 8 * l2) * gate;
    r += deg * (0.9 * l1 - 0.6 * l2) * gate;
    z *= 1 + (0.022 * l1 + 0.012 * l2) * gate;
  }
  return { x, y, z, r, cx: 1040, cy: 610, sq: 1 - 0.022 * a };
}
