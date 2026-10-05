// Compás 12, contador y sello: la energía del tramo 22,97–23,91 (beats que antes quedaban quietos).
//  · Cuenta (T.roll → T.price): la cámara empuja hacia la ventana del precio acelerando, la tarjeta da un
//    «tic» en cada semicorchea (respira con el contador) y los rayos del fondo aceleran.
//  · Sello (T.price → T.tear): la cámara rebota hacia atrás con resorte, la tarjeta se bambolea, sale una
//    onda expansiva doble desde el sello y una corona de líneas de impacto; los rayos frenan de a poco.
// Todo es función pura de t. Equipo VALUE.
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, TAU } from '../../engine/ease.js';
import { rng } from '../../engine/noise.js';
import { T, E16 } from './timeline.js';

/** Punto del mundo hacia donde empuja la cámara: la ventana del precio (y del sello) sobre la tarjeta. */
export const PUSH_AT = [984, 712];
const PUSH = 0.085;

/** Zoom extra de la cámara: empuje acelerado durante la cuenta y rebote amortiguado después del sello. */
export function pushZ(t) {
  const t0 = T.roll - 0.06;
  if (t < t0 || t > T.price + 1.2) return 0;
  if (t < T.price) {
    const p = prog(t, t0, T.price);
    return PUSH * p * p; // arranca con velocidad 0 y acelera hacia el golpe
  }
  const dt = t - T.price;
  // el golpe invierte la velocidad: la cámara sale despedida hacia atrás (pasa de largo) y se asienta
  return PUSH * Math.exp(-dt * 5.2) * Math.cos(dt * TAU * 1.55);
}

/** Tic de semicorchea mientras rueda el contador (0..1, pico en cada semicorchea). */
export function countTick(t) {
  if (t < T.roll || t >= T.price - 0.02) return 0;
  const local = (t - T.roll) % E16;
  // sube en un cuadro (sin salto seco) y cae rápido
  return local < 0.016 ? local / 0.016 : Math.exp(-(local - 0.016) / 0.045);
}

/** Bamboleo de la tarjeta después del sello (rad) y su respiración durante la cuenta. */
export function cardHype(t) {
  const tick = countTick(t);
  const p = prog(t, T.roll, T.price);
  let rot = 0, dy = 0, ds = 0;
  // respiración: cada tic la levanta y la agranda un pelito (más fuerte a medida que se acerca el sello)
  dy -= (5 + 7 * p) * tick;
  ds += (0.008 + 0.012 * p) * tick;
  // tensión: la tarjeta se inclina de a poco hacia el sello (y vuelve en el rebote)
  rot -= 0.03 * E.inQuad(p) * (t < T.price ? 1 : 0);
  if (t >= T.price) {
    const dt = t - T.price;
    rot += -0.03 * Math.exp(-dt * 9) + 0.032 * Math.exp(-dt * 5.5) * Math.sin(dt * TAU * 2.4);
  }
  return { rot, dy, ds };
}

/** Ángulo extra de los rayos: aceleran durante la cuenta y frenan con inercia después del sello. */
const RAY_A = 0.55, RAY_TAU = 0.3;
export function rayAngle(t) {
  const t0 = T.roll - 0.06, D = T.price - t0;
  if (t < t0) return 0;
  if (t < T.price) { const p = (t - t0) / D; return RAY_A * (0.5 * p * p + 0.5 * p * p * p); }
  const v0 = (RAY_A * (1 + 1.5)) / D; // velocidad al llegar al sello
  const dt = t - T.price;
  return RAY_A + v0 * RAY_TAU * (1 - Math.exp(-dt / RAY_TAU));
}

/** Brillo extra de los rayos (tics de la cuenta + fogonazo del sello). */
export function rayFlash(t) {
  const st = t >= T.price ? Math.exp(-(t - T.price) / 0.12) : 0;
  return 0.05 * countTick(t) * prog(t, T.roll - 0.1, T.price) + 0.14 * st;
}

/** Onda expansiva y líneas de impacto del sello, en pantalla (cx, cy = centro del sello). Va DEBAJO de la tarjeta. */
export function drawStampWave(ctx, t, cx, cy) {
  const dt = t - T.price;
  if (dt < 0 || dt > 0.6) return;
  ctx.save();
  // dos anillos escalonados (2 y 6 cuadros)
  for (const [d0, col, w0] of [[0, PAL.goldPale, 46], [0.07, '#FFFFFF', 22]]) {
    const p = clamp((dt - d0) / 0.5);
    if (p <= 0 || p >= 1) continue;
    const r = 260 + 1500 * E.outCubic(p);
    ctx.strokeStyle = rgba(col, 0.7 * (1 - p));
    ctx.lineWidth = w0 * (1 - p) + 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  }
  // corona de líneas de impacto que salen disparadas
  const q = clamp(dt / 0.3);
  if (q < 1) {
    const r = rng(4375);
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + (r() - 0.5) * 0.18;
      const r0 = (620 + r() * 120) + 900 * E.outCubic(q);
      const len = (160 + r() * 200) * (1 - q);
      ctx.strokeStyle = rgba(i % 3 ? '#FFFFFF' : PAL.goldPale, 0.75 * (1 - q));
      ctx.lineWidth = (8 + r() * 10) * (1 - 0.6 * q);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.62);
      ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len) * 0.62);
      ctx.stroke();
    }
  }
  ctx.restore();
}
