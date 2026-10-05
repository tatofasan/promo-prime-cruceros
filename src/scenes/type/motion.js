// Movimientos por letra para los titulares (todas funciones puras de t que modifican un estado s de glyphs.js).
// Convención: q = t − tGolpe (el golpe visual cae EXACTO en el cue; anticipación antes, rebote después).
import { E, clamp, pop, spring, TAU } from '../../engine/ease.js';
import { noise1 } from '../../engine/noise.js';

/** Aplastamiento y rebote después de un golpe (pivote en la base de la letra). */
export function squash(s, q, amt = 1) {
  if (q < 0 || q > 0.62) return s; // asentado: la letra vuelve a quieta exacta (sprite de línea)
  const k = Math.exp(-q * 9) * Math.cos(q * 34);
  s.sy *= 1 - 0.16 * amt * k;
  s.sx *= 1 + 0.1 * amt * k;
  return s;
}

/** Eco (contorno que se expande) durante `dur` después del golpe: 0..1, o −1 apagado. */
export const echoAt = (q, dur = 0.34) => (q < 0 || q > dur ? -1 : q / dur);

/** Caída: se estira mientras cae acelerando, toca en q = 0, aplasta y da un saltito. */
export function dropIn(s, q, { h = 240, fall = 0.2, hop = 16 } = {}) {
  if (q < -fall) { s.a = 0; return s; }
  if (q < 0) {
    const p = 1 + q / fall; // 0 → 1
    s.dy -= h * (1 - p * p);
    s.a *= clamp(p * 6);
    s.sy *= 1 + 0.2 * p;
    s.sx *= 1 - 0.08 * p;
    return s;
  }
  if (q > 0.75) return s;
  const env = Math.exp(-q * 13);
  s.sy *= 1 - 0.26 * env;
  s.sx *= 1 + 0.15 * env;
  s.dy -= hop * Math.exp(-q * 5) * Math.max(0, Math.sin(q * 15));
  return s;
}

/** Sube desde abajo con resorte: cruza su lugar en q = 0, se pasa hacia arriba y se asienta (se estira al subir). */
export function springUp(s, q, { h = 110, freq = 3.2, damp = 12 } = {}) {
  const w = TAU * freq;
  const lead = (Math.PI - Math.atan(w / damp)) / w; // primer cruce por 0 del resorte: cae en q = 0
  if (q < -lead) { s.a = 0; return s; }
  if (q > 0.9) return s;
  const dy = spring(q, -lead, { from: h, to: 0, freq, damp });
  s.dy += dy;
  s.a *= clamp((q + lead) / 0.05);
  const v = clamp(Math.abs(dy) / h);
  s.sy *= 1 + 0.22 * v * (q < 0 ? 1 : 0.5);
  s.sx *= 1 - 0.08 * v;
  return s;
}

/** Pop: 0 → pasa de largo → 1. El PICO cae en q = 0 (arranca 0,4·dur antes). */
export function popIn(s, q, { dur = 0.4, over = 1.26, lift = 0.5 } = {}) {
  const t0 = -0.4 * dur;
  if (q <= t0) { s.a = 0; return s; }
  if (q > dur * 1.7) return s;
  const k = pop(q, t0, { dur, over });
  s.sx *= Math.max(0, k);
  s.sy *= Math.max(0, k);
  s.a *= clamp(k * 4);
  s.dy += (1 - Math.min(1, k)) * 40 * lift;
  return s;
}

/** Flotación de la LÍNEA entera (dy en px) después de asentarse; cada línea con su fase. */
export function lineFloat(t, k, from, { amp = 3, hz = 0.5, ramp = 0.6 } = {}) {
  const r = clamp((t - from) / ramp);
  if (r <= 0) return 0;
  return Math.sin(TAU * hz * (t - from) + k * 1.9) * amp * E.inOutSine(r);
}

/** Temblor nervioso (antes de la ola): amp en px. */
export function tremble(s, t, i, amp) {
  if (amp <= 0.01) return s;
  s.dx += noise1(t * 28 + i * 3.1, 11) * amp;
  s.dy += noise1(t * 31 + i * 5.7, 23) * amp * 0.8;
  s.r += noise1(t * 24 + i * 2.3, 37) * amp * 0.004;
  return s;
}

/** Curva de viaje: anticipación (retrocede `back`), ease-in-out fuerte, pasa de largo `over` y se asienta (−back … 1). */
export function travel(t, t0, dur, { back = 0.05, anti = 0.08, over = 0.05 } = {}) {
  if (t <= t0 - anti) return 0;
  if (t < t0) return -back * E.outCubic((t - (t0 - anti)) / anti);
  const p = clamp((t - t0) / dur);
  const main = 0.78;
  if (p < main) return -back + (1 + back + over) * E.inOutCubic(p / main);
  return 1 + over * (1 - E.inOutSine((p - main) / (1 - main)));
}
