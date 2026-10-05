// Atardecer: tiempos, cámara y sol (todo función pura de t). Lo comparten los módulos ss-*.
// Entrada: el sol en (960, 430) r = 160 (match con el reflector del show) y la cámara se aleja de z 2,2 a 1 con
// grúa: el primer plano arranca fuera de cuadro por abajo y entra opaco con el movimiento.
// Medio: la cámara aterriza en el beat 2 y sigue VIVA (dolly lento z 1 → 1,05, deriva lateral con parallax y
// cámara en mano) mientras el sol baja ~55 px hacia el horizonte.
// Salida: anticipación (respira para atrás), GOLPE en exp.out (empuje seco +7 %) y empuje E.inExpo hacia el sol;
// el mundo crece mientras el disco se achica de ~150 a r = 120 (dolly-zoom) y se satura de coral a naranja de
// marca: en el último cuadro es un disco liso en (960, 520) r = 120 (match con la cabeza del pin de map).
import { cue, BEAT } from '../../engine/time.js';
import { E, clamp, kf, prog, smoothstep } from '../../engine/ease.js';
import { handheld } from '../../engine/camera.js';

export const T0 = cue('exp.sunset');
export const T_CHEERS = cue('exp.cheers');
export const T_OUT = cue('exp.out');
export const T1 = cue('map.in');
export const TL = T1 - 1 / 60; // último cuadro de la escena
export const T_B2 = T0 + BEAT; // beat 2: la cámara aterriza y se prenden las luces
export const T_ANT = T_OUT - 0.1; // anticipación del golpe de salida
export const T_KICK = T_OUT + 0.1; // fin del golpe seco de exp.out
export const T_PUSH = T_KICK; // (compat) desde acá el empuje acelera
/** Fin del lavado de luz de la entrada (en 11,35 ya no está). */
export const T_WASH = T0 + 6 / 60;

// mundo en reposo (z = 1): horizonte y profundidades de los planos
export const HZ = 612;
export const D = { rail: 1.12, couple: 1.24, deck: 1.3, fg: 1.6, table: 2.0, lights: 1.7, near: 2.4 };

// sol: su tamaño escala con su propia «profundidad» (así se achica al alejarse la cámara)
export const SUN_D = 0.62;
const R_START = 160, R_END = 120, R_SWELL = 152;
const R_REST = R_START / Math.pow(2.2, SUN_D);
const L_END = 2.6; // zoom de lente del empuje final (todo el mundo crece, también el cielo)

/** Zoom de cámara (dolly: depende de la profundidad de cada plano). */
export function camZ(t) {
  if (t < T_ANT) {
    return kf(t, [
      [T0, 2.2],
      [T_B2, 0.984, E.outCubic], // se aleja de golpe y aterriza en el beat 2 pasándose apenas
      [T_B2 + 0.2, 1.0, E.inOutSine],
      [T_ANT, 1.05, E.inOutSine], // dolly lento hacia el sol: la cámara nunca se traba
    ]);
  }
  if (t < T_OUT) return 1.05 - 0.01 * E.outQuad(prog(t, T_ANT, T_OUT)); // anticipación: respira para atrás
  // el primer plano vuela hacia abajo y afuera mientras empuja
  return 1.04 * Math.pow(1.6 / 1.04, E.inCubic(prog(t, T_OUT, TL)));
}

/** Zoom de lente alrededor del sol: anticipación, golpe seco en exp.out y empuje E.inExpo hasta el corte. */
export function lensZ(t) {
  if (t < T_ANT) return 1;
  if (t < T_OUT) return 1 - 0.012 * E.outQuad(prog(t, T_ANT, T_OUT));
  const u = prog(t, T_OUT, TL);
  const kick = 1 + 0.075 * E.outExpo(prog(t, T_OUT, T_KICK));
  const drift = 1 + 0.1 * prog(t, T_KICK, TL);
  return 0.988 * kick * drift * (1 + (L_END - 1) * E.inExpo(u));
}

/** Centro del sol en pantalla (también es el centro del zoom de la cámara). */
export function sunY(t) {
  return kf(t, [
    [T0, 430],
    [T_B2, 447, E.outCubic],
    [T_OUT, 501, E.inOutSine], // baja hacia el horizonte (≈ 55 px desde 11,5)
    [T_KICK, 495, E.outCubic], // en el golpe sube apenas
    [TL, 520, E.inOutCubic], // y cae al lugar del pin
  ]);
}

/** Radio «propio» del sol (sin cámara) hasta exp.out. */
const sunR0 = (t) => kf(t, [[T0, R_REST], [T_OUT, R_REST * 1.03, E.inOutSine]]);
const preR = (t) => sunR0(t) * Math.pow(camZ(t), SUN_D) * lensZ(t);
const R_OUT = preR(T_OUT);
/** Radio del sol en pantalla. En la salida: se hincha con el golpe y después se achica a 120 mientras todo crece. */
export function sunR(t) {
  if (t <= T_OUT) return preR(t);
  const r1 = R_OUT + (R_SWELL - R_OUT) * E.backOut(1.6)(prog(t, T_OUT, T_KICK));
  return r1 + (R_END - r1) * E.inOutCubic(prog(t, T_KICK, TL));
}
/** Radio del sol dentro del mundo ya ampliado por la lente. */
export const sunRWorld = (t) => sunR(t) / lensZ(t);

/** Saturación del sol a naranja (0 = blanco dorado, 1 = disco liso naranja). */
export const sunFlat = (t) => E.inOutCubic(prog(t, T_OUT + 0.1, TL - 0.04));

/** Amplitud de la cámara en mano: 0 en los dos cortes (match exacto). */
const camLive = (t) => smoothstep(T0, T0 + 0.45, t) * (1 - smoothstep(T_OUT, TL - 0.04, t));

/**
 * Grúa: al arrancar la cámara mira más arriba (el primer plano queda debajo del cuadro, sin asomar) y baja al
 * alejarse; el primer plano entra entero y opaco con el movimiento. En la salida vuelve a mirar al sol: el
 * primer plano se cae por abajo mientras empuja.
 */
const craneEase = (p) => E.outCubic(p) * 0.75 + E.inOutCubic(p) * 0.25;
export const camTilt = (t) => kf(t, [[T0, -300], [T_B2, 6, craneEase], [T_B2 + 0.35, 0, E.inOutSine], [T_OUT, 0], [TL, -330, E.inCubic]]);

/**
 * Travelling lateral (truck) a lo largo de la baranda: con el dolly da parallax fuerte entre el cielo (casi
 * quieto), la baranda, la pareja, la guirnalda y el primer plano (lo que más corre). Vale 0 en los dos cortes
 * (el sol queda exacto en el match) y pasa por 0 en el brindis (la pareja centrada delante del sol).
 */
export const camX = (t) => kf(t, [[T0, 0], [T_B2 - 0.1, -86, E.outCubic], [T_OUT, 108, (p) => 0.5 * E.inOutSine(p) + 0.5 * p], [TL, 0, E.inOutCubic]]);
export const ORBIT_D = 0;

const SKY_D = 0.08;
/**
 * Cámara de la escena: { x, y, z, r, cx, cy }. El zoom se centra en el sol: (cx, cy) es el sol en el mundo del
 * cielo y se corrige por la grúa para que en pantalla quede exactamente en (960, sunY(t)).
 */
export function sunsetCam(t) {
  const k = camLive(t);
  const z = camZ(t);
  const c = handheld({ x: camX(t), y: camTilt(t), z, r: 0 }, t, { amp: 5 * k, hz: 0.5, rollAmp: 0.0026 * k, seed: 61 });
  c.cx = 960 + c.x * SKY_D * Math.pow(z, SKY_D);
  c.cy = sunY(t) + c.y * SKY_D * Math.pow(z, SKY_D);
  c.tilt = camTilt(t);
  c.ox = c.x * ORBIT_D; // recentrado de la órbita (corrimiento de pantalla de todo el cuadro)
  return c;
}

/** Progreso de la salida (0 hasta exp.out, 1 en el último cuadro). */
export const outU = (t) => clamp((t - T_OUT) / (TL - T_OUT));

/**
 * Desenfoque de profundidad de campo de un plano que entra por abajo durante la grúa: máximo cuando asoma y
 * nítido 7 cuadros después. topY = borde de arriba del objeto en el plano; d = profundidad.
 */
const ENTRY = new Map();
function entryTime(topY, d) {
  const key = `${topY}|${d}`;
  if (ENTRY.has(key)) return ENTRY.get(key);
  let te = T_B2;
  for (let t = T0; t < T_B2; t += 1 / 240) {
    const c = sunsetCam(t);
    const y = c.cy + (topY - c.cy - c.y * d) * Math.pow(c.z, d);
    if (y < 1080) { te = t; break; }
  }
  ENTRY.set(key, te);
  return te;
}
export function entryBlur(t, topY, d, px = 14) {
  if (t > T_B2) return 0;
  const te = entryTime(topY, d);
  return px * (1 - E.outCubic(prog(t, te - 1 / 60, te + 7 / 60)));
}
