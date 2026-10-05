// Cámara del gancho.
//  0 → hook.q1: APERTURA cerrada sobre el reloj y el almanaque (z ≈ 1,44), con un micro-punch en el cuadro 0,
//    push lento y un golpe corto en cada arrancada de hoja (hook.cal1/2/3).
//  hook.q1 (1,875): la cámara se ABRE de golpe (E.outExpo, 5 cuadros) al encuadre del escritorio, que deja libre
//    la mitad izquierda para la pregunta de TYPE. De ahí push-in lento hacia el monitor (z 1,03 → 1,1).
//  hook.surge: retrocede de golpe (el estallido la empuja) y tiembla cada vez más hasta que llega la ola.
import { E, kf, clamp, prog, lerp, spring } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';
import { handheld } from '../../engine/camera.js';
import { T } from './layout.js';

/** Encuadre de apertura (pan en px del plano focal y zoom): reloj a la izquierda, almanaque a la derecha. */
export const OPEN = { x: 688, y: -307, z: 1.44 };
/** Duración del destape en hook.q1 (5 cuadros). */
export const OPEN_DUR = 5 / 60;

/** Encuadre del escritorio (el «encuadre actual» desde hook.q1). */
function deskCam(t) {
  const s = T.surge;
  const z = kf(t, [
    [T.q[0], 1.032],
    [s, 1.1, E.inQuad],
    [s + 0.13, 1.055, E.outCubic],
    [T.end, 1.12, E.inCubic],
  ]);
  const x = kf(t, [[T.q[0], 34], [s, 64, E.inOutSine], [s + 0.13, 36, E.outCubic], [T.end, 80, E.inCubic]]);
  const y = kf(t, [[T.q[0], 8], [s, 16, E.inOutSine], [s + 0.13, 4, E.outCubic], [T.end, 22, E.inCubic]]);
  return { x, y, z };
}

/** Plano cerrado de la apertura: push lento y deriva hacia el almanaque. */
function closeCam(t) {
  const p = E.inOutSine(clamp(t / T.q[0]));
  return { x: OPEN.x + 34 * p, y: OPEN.y - 10 * p, z: OPEN.z * (1 + 0.045 * p) };
}

/** Progreso del destape (0 hasta hook.q1, 1 a los 5 cuadros). */
export const openK = (t) => E.outExpo(prog(t, T.q[0], T.q[0] + OPEN_DUR));

export function camAt(t) {
  const s = T.surge;
  let { x, y, z } = deskCam(t);
  const k = openK(t);
  if (k < 1) {
    const c = closeCam(t);
    x = lerp(c.x, x, k);
    y = lerp(c.y, y, k);
    z = Math.exp(lerp(Math.log(c.z), Math.log(z), k));
  }
  // micro-punch del cuadro 0: arranca metida y se asienta con un rebote corto
  z *= 1 + 0.085 * spring(t, 0, { from: 1, to: 0, freq: 1.5, damp: 4.6 });
  x += 44 * spring(t, 0, { from: 1, to: 0, freq: 1.3, damp: 4 });
  y += 18 * spring(t, 0, { from: 1, to: 0, freq: 1.4, damp: 4.2 });
  // golpe corto en cada arrancada del almanaque (la cámara «siente» el tirón) y en el destape
  let kick = 0, roll = 0, kx = 0;
  for (const tc of T.cal) {
    if (t < tc) continue;
    const u = t - tc;
    kick += 0.03 * Math.exp(-u / 0.085);
    roll += -0.006 * Math.exp(-u / 0.12) * Math.cos(u * 26);
    kx += -10 * Math.exp(-u / 0.1);
  }
  let c = handheld({ x: x + kx, y, z: z * (1 + kick), r: roll, cx: 1120, cy: 560 }, t, { amp: 5, hz: 0.5, rollAmp: 0.0018, seed: 7 });
  // temblor creciente desde el estallido
  if (t > s) {
    const q = clamp((t - s) / 0.35);
    const a = 3 + 7 * q;
    c = { ...c, x: c.x + a * noise1(t * 26, 3), y: c.y + a * 0.8 * noise1(t * 29, 8), r: c.r + 0.004 * q * noise1(t * 21, 5) };
  }
  return c;
}

/** Velocidad del destape (para el desenfoque de zoom de esos cuadros): 0..1. */
export function openBlur(t) {
  const d = 1 / 120;
  return Math.abs(openK(t + d) - openK(t - d)) / (2 * d) * OPEN_DUR;
}
