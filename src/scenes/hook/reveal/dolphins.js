// Delfines (evento propio de reveal.q5, además del golpe de TYPE): un delfín GRANDE salta en primer plano abajo a
// la izquierda y llega a lo más alto en «CRUCERO?» (4,22), seguido por otro escalonado; una pareja lejana salta
// a la derecha del barco. Ilustración en 3 tonos (lomo, flanco y panza) con filo de luz del sol; los cercanos
// salen y entran con la salpicadura de ART (corona, gotas y espuma de encaje), los lejanos con una propia.
import { PAL, mixHex, rgba } from '../../../engine/color.js';
import { lin, sparkle } from '../../../engine/draw.js';
import { E, clamp, TAU } from '../../../engine/ease.js';
import { hash } from '../../../engine/noise.js';
import { plane } from '../../../engine/camera.js';
import { seaDepth, drawSplash } from '../../../art/index.js';
import { HZ, R } from './time.js';

let WATER = 742;
const D = 0.62; // duración del salto
// [apex, x de salida, x de entrada, altura, escala, agua (y del plano), cerca]
const FAR = [
  [R.q5 + 0.06, 1590, 1800, 110, 0.95, 742, false],
  [R.q5 + 0.2, 1540, 1730, 90, 0.8, 742, false],
];
const NEAR = [
  [R.q5, 170, 700, 250, 3.1, 880, true],
  [R.q5 + 0.234, 540, 950, 200, 2.5, 872, true],
];

const C = {
  back: mixHex(PAL.navy600, PAL.ocean700, 0.35),
  side: mixHex(PAL.ocean600, '#7FA3B8', 0.45),
  belly: mixHex(PAL.aqua100, PAL.warmWhite, 0.4),
  rim: PAL.goldPale,
};

let BODY = null, BELLY = null, FIN = null, PEC = null, FLUKE = null;
function shapes() {
  if (BODY) return;
  // unidades: largo 100 (−60 cola … +62 hocico), arriba negativo; mira a la derecha
  // cuerpo arqueado, melón redondo y pico corto (rostro); aleta dorsal curva hacia atrás
  BODY = new Path2D('M66 2 C63 0 58 -1 54 -2 C51 -6 47 -11 40 -13 C28 -17 12 -18 -4 -16 C-20 -13 -34 -8 -46 -3 C-51 -1 -55 -0.5 -58 0 C-55 1.5 -51 3 -46 4 C-32 9 -14 13 4 13 C20 13 34 10 46 7 C52 5.5 58 4.5 66 2 Z');
  BELLY = new Path2D('M64 3 C56 4.5 46 7.5 32 10 C16 12.5 -4 12.5 -24 9 C-10 6 6 5 22 5 C38 5 52 3.5 64 3 Z');
  FIN = new Path2D('M-6 -15.5 C-6 -22 -9 -29 -15 -34 C-5 -31.5 6 -24 12 -16.5 Z');
  PEC = new Path2D('M22 8 C19 13 14 17 7 19 C11 14 15 10 16 8 Z');
  // aletas de la cola: horizontales, de perfil se ven como una hoja fina
  FLUKE = new Path2D('M-55 -1 C-61 -3 -69 -6 -79 -5 C-73 -2 -68 0 -64 1 C-69 2 -74 4 -78 6 C-69 6 -61 3 -55 2 Z');
}

function dolphin(ctx, s) {
  shapes();
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = C.back;
  ctx.fill(FIN);
  ctx.fill(FLUKE);
  ctx.fillStyle = lin(ctx, 0, -18, 0, 14, [[0, C.back], [0.45, C.side], [1, C.side]]);
  ctx.fill(BODY);
  ctx.fillStyle = C.belly;
  ctx.fill(BELLY);
  ctx.fillStyle = mixHex(C.back, C.side, 0.3);
  ctx.fill(PEC);
  // filo de luz del lomo (el sol arriba a la derecha)
  ctx.save();
  ctx.clip(BODY);
  ctx.strokeStyle = rgba(C.rim, 0.9);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-32, -8.5); ctx.bezierCurveTo(-14, -15, 6, -17.5, 26, -15.5); ctx.bezierCurveTo(38, -14, 48, -10, 52, -4);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.arc(44, -4, 1.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(PAL.ink, 0.35);
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(64, 2.2); ctx.quadraticCurveTo(58, 3.2, 52, 2.4); ctx.stroke();
  ctx.fillStyle = rgba(PAL.white, 0.9);
  ctx.beginPath(); ctx.arc(44.5, -4.5, 0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Salpicadura de salida/entrada: corona de gotas, anillo de espuma y destello. u = s desde el impacto. */
function splash(ctx, x, u, s, seed) {
  if (u < 0 || u > 0.55) return;
  const p = u / 0.55;
  const ring = E.outCubic(p);
  ctx.strokeStyle = rgba(PAL.foam, 0.85 * (1 - p));
  ctx.lineWidth = 3 * s * (1 - p * 0.6);
  ctx.beginPath(); ctx.ellipse(x, WATER + 2, (14 + 46 * ring) * s, (3 + 8 * ring) * s, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = rgba(PAL.foam, 0.9 * (1 - p));
  ctx.beginPath(); ctx.ellipse(x, WATER, 18 * s * (1 - p * 0.5), 5 * s, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * (0.12 + 0.76 * hash(i, seed)), v = (120 + 160 * hash(i, seed + 1)) * s;
    const gx = x + Math.cos(a) * v * u, gy = WATER + Math.sin(a) * v * u + 900 * u * u;
    if (gy > WATER + 4) continue;
    const r = (1.6 + 2.6 * hash(i, seed + 2)) * s;
    ctx.fillStyle = rgba(hash(i, seed + 3) < 0.5 ? PAL.foam : PAL.aqua100, 0.95);
    ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill();
  }
  if (p < 0.35) sparkle(ctx, x + 6 * s, WATER - 10 * s, 16 * s * (1 - p / 0.35), { alpha: 0.9 });
}

function drawSet(ctx, t, cam, JUMPS) {
  const t0 = JUMPS[0][0] - D / 2 - 0.05, t1 = JUMPS[JUMPS.length - 1][0] + D / 2 + 1.0;
  if (t < t0 || t > t1) return;
  for (let i = 0; i < JUMPS.length; i++) {
    const [apex, xa, xb, h, s, water, near] = JUMPS[i];
    WATER = water;
    plane(ctx, cam, seaDepth(water, HZ), (c) => {
      const ta = apex - D / 2, tb = apex + D / 2;
      if (near) {
        drawSplash(c, t, xa + 14 * s, WATER, (t - ta + 0.02) / 0.7, { size: 32 * s, tilt: 0.3, seed: 11 + i * 7, preset: 'golden', drops: 14, column: false, foam: false });
        drawSplash(c, t, xb - 14 * s, WATER, (t - tb + 0.01) / 0.75, { size: 40 * s, tilt: 0.3, seed: 31 + i * 7, preset: 'golden', drops: 24, column: i === 0 });
      } else {
        splash(c, xa + 10 * s, t - ta, s, 10 + i * 7);
        splash(c, xb - 10 * s, t - tb, s, 30 + i * 7);
      }
      const p = (t - ta) / D;
      if (p <= 0 || p >= 1) return;
      const x = xa + (xb - xa) * p, y = WATER + 30 * s - (h + 30 * s) * 4 * p * (1 - p);
      const vx = (xb - xa), vy = -(h + 30 * s) * 4 * (1 - 2 * p);
      const ang = Math.atan2(vy, vx);
      c.save();
      c.beginPath();
      c.rect(x - 200 * s, WATER - 400 * Math.max(1, s * 0.5), 400 * s, 400 * Math.max(1, s * 0.5) + 1);
      c.clip();
      c.translate(x, y);
      c.rotate(ang);
      dolphin(c, s);
      c.restore();
      // hilo de agua que se escurre de la cola al salir
      if (p < 0.4) {
        c.fillStyle = rgba(PAL.aqua100, 0.7 * (1 - p / 0.4));
        for (let k = 0; k < 5; k++) {
          const q = clamp(p - k * 0.03);
          const dx = xa + (xb - xa) * q, dy = WATER + 30 * s - (h + 30 * s) * 4 * q * (1 - q) + 20 * s;
          c.beginPath(); c.arc(dx - 30 * s, Math.min(WATER, dy), (2.4 - k * 0.3) * s, 0, TAU); c.fill();
        }
      }
    });
  }
}

/** Pareja lejana (detrás del barco en profundidad: se dibuja antes que él). */
export function drawDolphins(ctx, t, cam) {
  drawSet(ctx, t, cam, FAR);
}

/** Los delfines de primer plano (se dibujan después del barco). */
export function drawNearDolphins(ctx, t, cam) {
  drawSet(ctx, t, cam, NEAR);
}
