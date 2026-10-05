// Curvas de movimiento. TODO en la pieza es función pura de t: nada de estado entre cuadros.
// Vocabulario: prog/seg (progreso 0→1), E.* (easings), kf (keyframes con easing por tramo),
// spring (resorte amortiguado: overshoot natural), pop (aparición con rebote), anticip (anticipación + golpe).

export const clamp = (x, a = 0, c = 1) => (x < a ? a : x > c ? c : x);
export const lerp = (a, c, p) => a + (c - a) * p;
export const invLerp = (a, c, x) => (c === a ? 0 : (x - a) / (c - a));
export const remap = (x, a0, a1, b0, b1, ease = (p) => p) => lerp(b0, b1, ease(clamp(invLerp(a0, a1, x))));
export const smoothstep = (a, c, x) => { const p = clamp(invLerp(a, c, x)); return p * p * (3 - 2 * p); };
export const fract = (x) => x - Math.floor(x);
export const TAU = Math.PI * 2;

const backOutF = (s) => (p) => { const q = p - 1; return q * q * ((s + 1) * q + s) + 1; };
const backInF = (s) => (p) => p * p * ((s + 1) * p - s);
const backInOutF = (s) => (p) => {
  const k = s * 1.525;
  return p < 0.5 ? (Math.pow(2 * p, 2) * ((k + 1) * 2 * p - k)) / 2 : (Math.pow(2 * p - 2, 2) * ((k + 1) * (p * 2 - 2) + k) + 2) / 2;
};
const elasticOutF = (amp = 1, period = 0.3) => (p) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const a = Math.max(1, amp);
  const s = (period / TAU) * Math.asin(1 / a);
  return a * Math.pow(2, -10 * p) * Math.sin(((p - s) * TAU) / period) + 1;
};
const bounceOut = (p) => {
  const n = 7.5625, d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
};
const pw = (k) => [(p) => Math.pow(p, k), (p) => 1 - Math.pow(1 - p, k), (p) => (p < 0.5 ? Math.pow(2 * p, k) / 2 : 1 - Math.pow(2 - 2 * p, k) / 2)];
const [inQuad, outQuad, inOutQuad] = pw(2);
const [inCubic, outCubic, inOutCubic] = pw(3);
const [inQuart, outQuart, inOutQuart] = pw(4);
const [inQuint, outQuint, inOutQuint] = pw(5);

/** Easings p∈[0,1] → [0,1] (los back/elastic se pasan de rango a propósito). */
export const E = {
  linear: (p) => p,
  inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, inQuart, outQuart, inOutQuart, inQuint, outQuint, inOutQuint,
  inSine: (p) => 1 - Math.cos((p * Math.PI) / 2),
  outSine: (p) => Math.sin((p * Math.PI) / 2),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  inExpo: (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
  outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  inOutExpo: (p) => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2),
  inCirc: (p) => 1 - Math.sqrt(1 - p * p),
  outCirc: (p) => Math.sqrt(1 - Math.pow(p - 1, 2)),
  inOutCirc: (p) => (p < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * p, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * p + 2, 2)) + 1) / 2),
  inBack: backInF(1.70158),
  outBack: backOutF(1.70158),
  inOutBack: backInOutF(1.70158),
  outElastic: elasticOutF(1, 0.3),
  outBounce: bounceOut,
  inBounce: (p) => 1 - bounceOut(1 - p),
  /** back con intensidad propia: E.backOut(2.4) */
  backOut: backOutF,
  backIn: backInF,
  backInOut: backInOutF,
  elasticOut: elasticOutF,
};

/** Progreso lineal recortado de t entre t0 y t1. */
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
/** Progreso con easing de un tramo que arranca en t0 y dura `dur`. */
export const seg = (t, t0, dur, ease = E.outCubic) => ease(clamp((t - t0) / dur));

/**
 * Keyframes. keys = [[t, valor, easeDelTramoQueTerminaAcá?], ...] ordenados por t.
 * valor: número, array de números u objeto de números. Antes del primero / después del último, se sostiene.
 */
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 1;
  while (keys[i][0] < t) i++;
  const [t0, v0] = keys[i - 1];
  const [t1, v1, ease = E.inOutCubic] = keys[i];
  const p = ease((t - t0) / (t1 - t0));
  return mixVal(v0, v1, p);
}
function mixVal(a, c, p) {
  if (typeof a === 'number') return a + (c - a) * p;
  if (Array.isArray(a)) return a.map((x, k) => x + (c[k] - x) * p);
  const o = {};
  for (const k in a) o[k] = typeof a[k] === 'number' ? a[k] + (c[k] - a[k]) * p : (p < 1 ? a[k] : c[k]);
  return o;
}

/**
 * Resorte amortiguado que arranca en t0: vale `from` antes y converge a `to` oscilando.
 * freq (Hz) = rapidez de la oscilación · damp = cuánto se apaga (más alto = menos rebote).
 * Velocidad inicial cero → arranca con suavidad y pasa de largo (overshoot).
 */
export function spring(t, t0, { from = 0, to = 1, freq = 3.2, damp = 7 } = {}) {
  const dt = t - t0;
  if (dt <= 0) return from;
  const w = TAU * freq;
  const env = Math.exp(-damp * dt);
  return to + (from - to) * env * (Math.cos(w * dt) + (damp / w) * Math.sin(w * dt));
}

/**
 * Escala de "pop": 0 → pasa de largo hasta `over` → se asienta en 1 con un rebote chico.
 * El pico llega a t0 + 0,4·dur; asentado a t0 + ~dur. Ideal para pines, íconos, chips, stickers.
 * (Si querés que el pico CAIGA en el beat, arrancá en cue − 0,4·dur.)
 */
export function pop(t, t0, { dur = 0.42, over = 1.2 } = {}) {
  if (t <= t0) return 0;
  const tp = dur * 0.4;
  const freq = 1 / (2 * tp);
  const damp = 2 * freq * Math.log(1 / Math.max(0.001, over - 1));
  return spring(t, t0, { from: 0, to: 1, freq, damp });
}

/**
 * Anticipación + acción: antes de tAct retrocede un poco (−back) y después va a 1 con overshoot.
 * Devuelve el valor de "movimiento" (0 = reposo inicial, 1 = destino). Usar para cámaras y objetos que salen disparados.
 */
export function anticip(t, tAnt, tAct, tEnd, { back = 0.12, overshoot = 1.6 } = {}) {
  if (t <= tAnt) return 0;
  if (t < tAct) return -back * E.outCubic(prog(t, tAnt, tAct));
  const p = prog(t, tAct, tEnd);
  return lerp(-back, 1, backOutF(overshoot)(p));
}

/** Índice → retardo para escalonar: stagger(i, 0.04) o desde el centro: stagger(i, 0.04, n, 'center'). */
export function stagger(i, step, n = 0, from = 'start') {
  if (from === 'center') return Math.abs(i - (n - 1) / 2) * step;
  if (from === 'end') return (n - 1 - i) * step;
  return i * step;
}

/** Onda triangular/seno 0..1 útil para latidos. */
export const osc = (t, hz, phase = 0) => 0.5 + 0.5 * Math.sin(TAU * (t * hz + phase));
