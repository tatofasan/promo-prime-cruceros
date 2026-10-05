// Gaviotas del mar abierto (con la gaviota del kit de ART):
//  - bandadas lejanas a los costados del cielo (el centro de arriba es del texto);
//  - una pareja que pasa rasante sobre el agua en primer plano (parallax);
//  - las que rondan la chimenea y se espantan con el bocinazo (acción secundaria);
//  - una que pasa volando pegada a la cámara en el disparo al casco.
import { drawGulls, gull, shipPoint, resolvePreset } from '../../../art/index.js';
import { plane } from '../../../engine/camera.js';
import { PAL, mixHex } from '../../../engine/color.js';
import { E, clamp, prog, TAU } from '../../../engine/ease.js';
import { hash, noise1 } from '../../../engine/noise.js';
import { PRESET, R } from './time.js';

let COL = null;
function col() {
  if (COL) return COL;
  const L = resolvePreset(PRESET).sky.light;
  COL = { top: mixHex(PAL.grey300, L.shade, 0.3), under: mixHex('#ffffff', L.key, 0.25), tip: PAL.grey900, body: '#ffffff', rim: mixHex('#ffffff', L.rim, 0.5), beak: PAL.gold };
  return COL;
}

/** Aleteo con ráfagas y planeos: devuelve f ∈ [−1, 1]. */
function flapAt(t, i, hz = 3) {
  const burst = clamp(0.35 + 1.3 * noise1(t * 0.9 + i * 5.3, 41));
  return Math.sin(t * TAU * hz + i * 2.1) * burst;
}

export function drawSkyGulls(ctx, t, cam) {
  plane(ctx, cam, 0.3, (c) => {
    drawGulls(c, t, { preset: PRESET, count: 3, area: { x: -60, y: 150, w: 640, h: 190 }, scale: 0.6, seed: 5, dir: 1 });
    drawGulls(c, t, { preset: PRESET, count: 3, area: { x: 1330, y: 400, w: 620, h: 110 }, scale: 0.45, seed: 9, dir: -1 });
  });
}

// pareja rasante: [entra, sale, y0, y1, R]
const LOW = [
  [R.drop + 0.12, R.push + 0.05, 790, 715, 54],
  [R.drop + 0.3, R.push + 0.3, 860, 790, 70],
];
export function drawLowGulls(ctx, t, cam) {
  plane(ctx, cam, 1.05, (c) => {
    LOW.forEach(([t0, t1, y0, y1, Rr], i) => {
      if (t < t0 || t > t1) return;
      const p = (t - t0) / (t1 - t0);
      const x = -160 + p * 2260;
      const y = y0 + (y1 - y0) * p + 16 * Math.sin(p * 5 + i);
      const f = flapAt(t, i, 3.3);
      gull(c, x, y, Rr, f, 1, col(), false, -0.06 + 0.05 * Math.cos(p * 5 + i));
    });
  });
}

/** Las que rondan la chimenea: antes del bocinazo planean en círculos; con el bocinazo salen disparadas. */
export function drawFunnelGulls(ctx, t, o) {
  const s = o.scale;
  if (s > 1.4) return;
  for (let i = 0; i < 6; i++) {
    if (t - R.horn > 0.6 + 0.03 * i) continue;
    const ph = hash(i, 61) * TAU, rr = 34 + hash(i, 62) * 40;
    const a = ph + t * (0.9 + 0.5 * hash(i, 63)) * (i % 2 ? 1 : -1);
    let lx = -221 + Math.cos(a) * rr * 1.6, ly = -320 + Math.sin(a) * rr * 0.55 - hash(i, 64) * 40;
    let size = 11;
    const u = t - R.horn - 0.03 * i;
    if (u > 0) {
      // espantada: salen disparadas hacia afuera y HACIA CÁMARA (crecen mucho y abandonan el cuadro por los
      // costados, debajo del titular)
      const dx = (hash(i, 65) < 0.5 ? -1 : 1) * (0.7 + 0.6 * hash(i, 66)), e = E.inQuad(clamp(u / 0.55));
      lx += dx * 1100 * e + 60 * u;
      ly += -60 * E.outCubic(clamp(u / 0.2)) + 240 * e;
      size *= 1 + 9 * e;
    }
    const [x, y] = shipPoint(o, lx, ly);
    const f = Math.sin(t * TAU * (u > 0 ? 5.5 : 2.2) + i * 1.3);
    gull(ctx, x, y, size * s / 0.5, f, Math.cos(a) > 0 || u > 0 ? 1 : -1, col(), false);
  }
}

/** La que pasa pegada a la cámara en el disparo: sale del centro hacia abajo a la izquierda y crece. */
export function drawWhipGull(ctx, t) {
  const t0 = R.push + 0.03, t1 = R.push + 0.2;
  if (t < t0 || t > t1) return;
  const p = E.inQuad(prog(t, t0, t1));
  const x = 760 - 1250 * p, y = 640 + 700 * p;
  const Rr = 46 + 560 * p * p;
  // estela de movimiento barata: copias que se quedan atrás en la trayectoria (sin capas extra)
  const f = flapAt(t, 7, 4.5);
  const dx = 1250 * 0.018, dy = -700 * 0.018;
  ctx.save();
  for (let k = 4; k >= 0; k--) {
    ctx.globalAlpha = k ? 0.16 : 1;
    gull(ctx, x + dx * k * (0.5 + p), y + dy * k * (0.5 + p), Rr * (1 - 0.04 * k), f, 1, col(), false, 0.25);
  }
  ctx.restore();
}

// gaviotas que cruzan PEGADAS a la cámara en el drop: [entra, sale, x0, x1, y0, y1, R, sentido]
const NEAR = [
  [R.drop - 0.06, R.drop + 0.3, -260, 2180, 900, 770, 160, 1],
  [R.drop + 0.07, R.drop + 0.42, 2160, -240, 470, 560, 96, -1],
  // en «CRUCERO?» una cruza bajo, sobre el oleaje, de izquierda a derecha
  [R.q5 - 0.02, R.q5 + 0.3, -250, 2170, 1010, 905, 118, 1],
  // una de la bandada de reveal.q5 se abre y pasa rozando la cámara (en la corchea siguiente)
  [R.q5 + 0.16, R.q5 + 0.5, 2180, -260, 780, 970, 150, -1],
  // las que espantó el bocinazo pasan rozando la cámara en el segundo toque
  [R.horn2 - 0.06, R.horn2 + 0.3, -240, 2160, 980, 820, 170, 1],
]
// gaviotas que pasan ROZANDO EL LENTE por el tercio de abajo (enormes, rapidísimas): [entra, sale, x0, x1, y0, y1, R, sentido]
const LENS = [
  // la corchea entre «CRUCERO?» y el bocinazo
  [R.q5 + 0.24, R.q5 + 0.47, 2320, -420, 1010, 880, 380, -1],
  // espantada por el bocinazo: cruza de izquierda a derecha
  [R.horn + 0.05, R.horn + 0.29, -440, 2340, 1000, 905, 400, 1],
];
/** Gaviotas en primer plano que cruzan rápido el cuadro (estela de copias como desenfoque de movimiento). */
export function drawNearGulls(ctx, t) {
  for (let i = 0; i < LENS.length; i++) {
    const [t0, t1, x0, x1, y0, y1, Rr, dir] = LENS[i];
    if (t < t0 || t > t1) continue;
    const p = prog(t, t0, t1);
    const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p - 40 * Math.sin(Math.PI * p);
    const v = (x1 - x0) / (t1 - t0);
    const f = flapAt(t, 30 + i, 5);
    ctx.save();
    for (let k = 5; k >= 0; k--) {
      ctx.globalAlpha = k ? 0.12 : 0.96;
      gull(ctx, x - v * 0.005 * k, y, Rr, f, dir, col(), false, -0.1 * dir);
    }
    ctx.restore();
  }
  for (let i = 0; i < NEAR.length; i++) {
    const [t0, t1, x0, x1, y0, y1, Rr, dir] = NEAR[i];
    if (t < t0 || t > t1) continue;
    const p = E.inOutSine(prog(t, t0, t1));
    const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p + 26 * Math.sin(p * 6 + i);
    const v = (x1 - x0) / (t1 - t0);
    const f = flapAt(t, 20 + i, 4.2);
    ctx.save();
    for (let k = 4; k >= 0; k--) {
      ctx.globalAlpha = k ? 0.13 : 1;
      gull(ctx, x - v * 0.006 * k, y, Rr * (1 - 0.02 * k), f, dir, col(), false, -0.08 * dir);
    }
    ctx.restore();
  }
}

/**
 * Bandada que cruza en reveal.q5 (acción propia del beat): siete gaviotas de derecha a izquierda, rasantes sobre
 * el agua por delante del casco (debajo de la chimenea y del titular), escalonadas y con aleteo propio.
 */
export function drawFlock(ctx, t, cam) {
  const t0 = R.q5 + 0.02, t1 = R.q5 + 0.8;
  if (t < t0 - 0.2 || t > t1 + 0.1) return;
  plane(ctx, cam, 0.9, (c) => {
    for (let i = 0; i < 7; i++) {
      const d = i * 0.04 + hash(i, 91) * 0.03;
      const p = (t - t0 - d) / (t1 - t0 - 0.2);
      if (p <= 0 || p >= 1) continue;
      const x = 2050 - 2350 * p + (hash(i, 92) - 0.5) * 160;
      // rasante sobre el agua, por delante del casco: nunca sube hasta la chimenea ni su pin
      const y = 845 + (hash(i, 93) - 0.5) * 100 - 50 * p + 12 * Math.sin(p * 9 + i);
      const Rr = 42 + 34 * hash(i, 94);
      gull(c, x, y, Rr, flapAt(t, 40 + i, 4), -1, col(), false, 0.05);
    }
  });
}
