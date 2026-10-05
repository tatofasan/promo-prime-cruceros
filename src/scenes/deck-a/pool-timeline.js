// Coreografía de la pileta (todo función pura de t) contra los cues:
//   5,625 exp.pool   iris desde el ojo de buey (r 300 → cubre el cuadro en 5,86); la cámara entra girando y se asienta
//   5,859 exp.w2     el aro del ojo de buey termina de salir de cuadro
//   6,094 exp.w3     barrido de luz sobre el agua
//   6,328 (corchea)  quien baja entra a la canaleta: abanico de agua
//   6,563 exp.slide  SPLASH (corona, columna, gotas, espuma, anillos)
//   6,797 (corchea)  asoma la cabeza y saluda
//   7,031 (beat)     la onda llega a la pelota de playa: salta con salpicadura y destello
//   7,148            la del flotador levanta el trago a cámara (destello)
//   7,166            la chica se larga del aro (¡salud!) y entra al agua en exp.ring con un mini splash
//   7,266 exp.ring   el aro queda limpio, arranca a girar a 120°/s y la cámara se zambulle hacia él
//   7,500 exp.dinner flotador centrado (960, 540), r ext 210 / int 95, girando horario a 120°/s y creciendo
import { cue, BEAT } from '../../engine/time.js';
import { E, clamp, prog, lerp, kf } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';
import { springV, wobble, cam } from './util.js';
import { F } from './pool-geo.js';
import { TI, SPLASH_PT } from './pool-path.js';

export const T0 = cue('exp.pool');
export const TW2 = cue('exp.w2');
export const TW3 = cue('exp.w3');
export const TR = cue('exp.ring');
export const T1 = cue('exp.dinner');
export const HIT = 1 / 120;
export const T_SURF = cue('exp.slide') + BEAT / 2 - HIT; // 6,789: asoma
export const T_BALL = T1 - BEAT - HIT;                  // 7,023: la onda del splash llega a la pelota (beat)
export const T_TOAST = TR - BEAT / 4 - HIT;             // 7,140: brindis del flotador (ya con el lockup arriba)
export const IRIS_END = 5.86;
export { TI, SPLASH_PT };

// ------------------------------------------------------------------ iris
/** Radio del iris (vidrio del ojo de buey): 300 en el corte, sale de cuadro en ~5,86 (expo). */
export function irisR(t) {
  const u = prog(t, T0, IRIS_END);
  if (u >= 1) return 4000;
  return 300 * Math.pow(1180 / 300, E.outCubic(u));
}

// ------------------------------------------------------------------ flotador
export const RING = { R: 62, r: 28 }; // 210 / 95 en el corte (k = 3,387)
export const K_END = 210 / RING.R;
const W_END = (120 * Math.PI) / 180;
const W0 = 0.16;
// giro: deriva lenta y, desde exp.ring, arranca a 120°/s (rampa suave de 5 cuadros) y lo mantiene hasta el plato
const SPIN0 = TR, SPIN1 = TR + 0.08;
const spinInt = (t) => {
  if (t <= SPIN0) return 0;
  const D = SPIN1 - SPIN0;
  if (t < SPIN1) { const u = (t - SPIN0) / D; return (W_END - W0) * D * (u * u * u - (u * u * u * u) / 2); }
  return (W_END - W0) * (D / 2 + (t - SPIN1));
};
/** Zambullida de la chica: se larga del aro en T_DIVE0 y entra al agua en exp.ring (afuera del aro). */
export const T_DIVE0 = TR - 0.1;
export const DIVE_OUT = 150; // distancia (local, hacia la cabeza) donde entra al agua

/** Estado del flotador: { x, y, rot, bob (escala), hit, toast }. */
export function floatAt(t) {
  const d = prog(t, 5.4, 7.35);
  let x = 668 + 132 * E.inOutSine(d) + 7 * noise1(t * 0.7, 61);
  let y = 664 - 58 * E.inOutSine(d) + 6 * noise1(t * 0.6 + 9, 62);
  // al largarse la chica, el aro retrocede un poco (acción y reacción)
  const kick = Math.sin(Math.PI * prog(t, T_DIVE0, TR + 0.06));
  const hit = t > TR - 0.02 ? Math.exp(-(t - (TR - 0.02)) * 7) : 0;
  let rot = 0.62 + W0 * (t - T0) + spinInt(t);
  rot -= 0.05 * Math.sin(Math.PI * prog(t, T_DIVE0 - 0.04, SPIN0)); // anticipación: contragiro
  const quiet = 1 - E.inOutSine(prog(t, TR, TR + 0.15)); // el aro queda limpio: sin cabeceo en la zambullida
  const bob = 1 + quiet * (0.012 * Math.sin(t * 5.2) + 0.03 * wobble(t - (TR - 0.02), { freq: 4, damp: 7 }));
  const toast = wobble(t - T_TOAST, { freq: 5, damp: 8 }) * (t > T_TOAST ? 1 : 0);
  const a0 = 0.62 + W0 * (T_DIVE0 - T0) - Math.PI / 2; // dirección de la cabeza al largarse (mundo)
  x -= Math.cos(a0) * 12 * kick;
  y -= Math.sin(a0) * 12 * kick;
  return { x, y, rot, bob, hit, toast };
}

// ------------------------------------------------------------------ cámara
// x, y = punto del mundo que va al centro · z = zoom · r = roll · A = altura (dolly)
// En el splash (exp.slide) la cámara ya se anticipó: la boca del tobogán queda al centro-derecha y el impacto cae
// en (1450, 830) de pantalla, en la zona que deja libre TYPE (x 1250–1650 · y 700–960).
export const SPLASH_SCREEN = [1450, 832];
export const CAM_S = { x: 869.4, y: 514.3, z: 1.22 };
const DIVE0 = TR + 0.03, DIVE1 = T1;
export function camAt(t) {
  const dt = t - T0;
  let z = springV(dt, 0.86, 1.55, 1, { freq: 1.25, damp: 5.4 });
  let r = springV(dt, -0.17, 1.05, 0, { freq: 1.0, damp: 4.4 });
  // paneo: amaga hacia la izquierda, se anticipa al tobogán (6,2–6,5), acompaña el splash y cruza al flotador
  let [x, y] = kf(t, [
    [T0, [1000, 548]], [5.95, [1000, 556]], [6.2, [1012, 552], E.inOutSine],
    [6.5, [CAM_S.x, CAM_S.y], E.inOutCubic], [6.66, [CAM_S.x - 6, CAM_S.y + 3], E.outSine],
    [7.1, [806, 600], E.inOutSine], [7.3, [800, 604], E.outSine],
  ]);
  z *= kf(t, [[5.95, 1], [6.2, 0.985, E.inOutSine], [6.5, CAM_S.z, E.inOutCubic], [6.66, CAM_S.z + 0.01], [7.12, 1.3, E.inOutSine], [7.3, 1.34, E.outSine]]);
  r += 0.028 * E.inOutSine(prog(t, 5.95, 6.45)) - 0.04 * E.inOutSine(prog(t, 6.6, 7.1));
  // golpe del splash: empujón de 3 cuadros hacia el impacto con micro push-in
  if (t > TI) {
    const w = Math.exp(-(t - TI) * 16) * Math.sin(Math.min(Math.PI, (t - TI) * 60));
    x += (SPLASH_PT.x - x) * 0.035 * w;
    y += (SPLASH_PT.y - y) * 0.035 * w;
    z *= 1 + 0.035 * w + 0.012 * wobble(t - TI - 0.05, { freq: 3.2, damp: 7 }) * (t > TI + 0.05 ? 1 : 0);
  }
  // cámara en mano (se apaga en la zambullida)
  const live = 1 - E.inOutSine(prog(t, TR - 0.1, TR + 0.12));
  x += live * 7 * noise1(t * 0.5, 41);
  y += live * 5 * noise1(t * 0.5 + 13, 42);
  r += live * 0.008 * noise1(t * 0.37 + 3, 43);
  let A = F;
  // anticipación (retrocede) y zambullida al flotador: zoom en log con llegada a 0,81/s (sigue en el plato)
  if (t > TR - 0.07) {
    const fl = floatAt(t);
    const back = Math.sin(Math.PI * prog(t, TR - 0.07, DIVE0 + 0.015));
    z *= 1 - 0.035 * back;
    const u = prog(t, DIVE0, DIVE1);
    if (u > 0) {
      const k0 = z, lk = Math.log(K_END / k0);
      const slope = (0.81 * (DIVE1 - DIVE0)) / lk; // pendiente final de la curva (para empalmar con la cena)
      const f = (3 - 2 * u) * u * u + (u * u * u - u * u) * slope;
      const K = k0 * Math.exp(lk * f);
      A = F - 1350 * E.inOutSine(u);
      z = (K * A) / F;
      const g = E.outCubic(clamp(u * 1.7));
      x = lerp(x, fl.x, g);
      y = lerp(y, fl.y, g);
      // el roll se termina de asentar antes del tramo medido (el giro en pantalla es el del aro: 120°/s)
      r += 0.05 * E.inOutSine(clamp(u / 0.45));
    }
  }
  return cam(x, y, z, r, A, F);
}
