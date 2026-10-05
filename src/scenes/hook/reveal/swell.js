// Oleaje de primer plano (plano 1,5): una loma de agua en diagonal abajo a la izquierda que guía la mirada
// al barco. Recién pasada la ola está crecida (resaca) y se va calmando. Tres tonos: cara en sombra, franja
// translúcida bajo la cresta (la luz del sol la atraviesa) y filo de luz; espuma de encaje y destellos.
// Con «CRUCERO?» (4,22) y detrás del bocinazo (4,74) una loma entra por la derecha, levanta el primer plano (la
// cámara se mece con ella) y su cresta revienta en spray (kit de agua de ART) hacia la izquierda.
import { PAL, mixHex, rgba } from '../../../engine/color.js';
import { lin, sparkle } from '../../../engine/draw.js';
import { clamp, TAU } from '../../../engine/ease.js';
import { drawSpray } from '../../../art/index.js';
import { hash } from '../../../engine/noise.js';
import { plane } from '../../../engine/camera.js';
import { R, PRESET } from './time.js';
import { kick } from './backdrop.js';
import { drawLace } from '../foam.js';

export const SWELL_DEPTH = 1.5;
const X0 = -260, X1 = 2180, STEP = 24;

/** Lomas del primer plano: [t en que la cresta entra por la derecha, fuerza 0..1]. */
// (las olas vienen en series: a cada loma la sigue una más chica)
export const HEAVES = [[R.q5 - 0.03, 1], [R.q5 + 0.21, 0.7], [R.horn + 0.05, 1], [R.horn + 0.28, 0.6]];
const YT = 812;    // a dónde llega la cresta de la loma en su pico (plano del oleaje; ≈ y 860 en pantalla, bajo el casco)
const TRAVEL = 0.2; // s que tarda la loma en cruzar el primer plano (de derecha a izquierda)
const TAU_H = 0.085;
/** Llegada de la loma a x (0 = borde derecho, TRAVEL = borde izquierdo). */
const delay = (x) => TRAVEL * clamp((X1 - x) / (X1 - X0));
/** Golpe que sube rápido y se asienta (máximo 1 en u = TAU_H). */
export const bump = (u) => (u <= 0 ? 0 : (u / TAU_H) * Math.exp(1 - u / TAU_H));
function lift(x, t) {
  let h = 0;
  for (const [tb, a] of HEAVES) h += a * bump(t - tb - delay(x));
  return Math.min(1, h);
}

/** Altura de la superficie en x (plano del oleaje). */
function surf(x, t) {
  const surge = 70 * Math.exp(-Math.max(0, t - R.drop) / 0.55) * (t > R.drop - 0.2 ? 1 : 0);
  let base = 900 + 150 * Math.pow(clamp((x - X0) / (X1 - X0)), 1.3) - surge * (1 - x / 2400);
  // la loma de la corchea levanta el primer plano hasta YT (más donde la loma base está más abajo)
  base -= (base - YT) * lift(x, t);
  const crest = 30 * Math.sin(TAU * (x / 1150) - t * 1.6) + 11 * Math.sin(x / 150 + t * 2.3) + 5 * Math.sin(x / 61 - t * 3.1);
  return base + crest;
}

function surfacePts(t) {
  const pts = [];
  for (let x = X0; x <= X1; x += STEP) pts.push([x, surf(x, t)]);
  return pts;
}

function bodyPath(pts, dy = 0) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1] + dy);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1] + dy);
  p.lineTo(X1, 1500); p.lineTo(X0, 1500); p.closePath();
  return p;
}

export function drawSwell(ctx, t, cam) {
  if (t < R.wave0 + 0.1) return;
  plane(ctx, cam, SWELL_DEPTH, (c) => {
    const pts = surfacePts(t);
    const body = bodyPath(pts);
    // cara en sombra (tono base → sombra hacia abajo)
    // cara a contraluz (el sol está detrás, arriba a la derecha): oscura, enmarca el barco iluminado
    c.fillStyle = lin(c, 0, 760, 0, 1080, [[0, PAL.ocean600], [0.22, PAL.ocean700], [0.6, mixHex(PAL.ocean700, PAL.navy700, 0.6)], [1, PAL.navy700]]);
    c.fill(body);
    c.save();
    c.clip(body);
    // franja translúcida bajo la cresta (más fuerte del lado del sol)
    c.globalCompositeOperation = 'screen';
    for (const [dy, a, w] of [[18, 0.38, 26], [44, 0.16, 40]]) {
      c.strokeStyle = lin(c, X0, 0, X1, 0, [[0, rgba(PAL.aqua300, a * 0.45)], [1, rgba(PAL.aqua200, a)]]);
      c.lineWidth = w;
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y + dy) : c.moveTo(x, y + dy)));
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    // vetas de la cara que bajan con la corriente (sombra plana en los valles)
    for (let i = 0; i < 9; i++) {
      const x = X0 + ((hash(i, 3) * (X1 - X0) + t * 60) % (X1 - X0));
      const y = surf(x, t) + 70 + hash(i, 4) * 90;
      c.fillStyle = rgba(PAL.navy700, 0.16);
      c.beginPath(); c.ellipse(x, y, 160 + hash(i, 5) * 160, 9 + hash(i, 6) * 7, -0.06, 0, TAU); c.fill();
      c.fillStyle = rgba(PAL.aqua200, 0.13);
      c.beginPath(); c.ellipse(x + 60, y - 22, 90 + hash(i, 7) * 90, 4, -0.06, 0, TAU); c.fill();
    }
    c.restore();
    // filo de luz de la cresta: grosor variable (más grueso donde la cresta mira al sol)
    c.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const slope = (y1 - y0) / STEP;
      const w = clamp(1.2 + 5 * (-slope + 0.2), 1, 6);
      c.strokeStyle = rgba(PAL.aqua100, 0.55 + 0.4 * clamp(-slope * 3));
      c.lineWidth = w;
      c.beginPath(); c.moveTo(x0, y0 + 1); c.lineTo(x1, y1 + 1); c.stroke();
    }
    // espuma de encaje en la cresta (más abundante recién pasada la ola)
    const foamAmt = 0.45 + 0.55 * Math.exp(-Math.max(0, t - R.drop) / 0.7);
    drawLace(c, pts, { width: 22, seed: 4, t, amt: foamAmt, hole: PAL.ocean400 });
    // destellos en las crestas que miran al sol (laten con el bombo)
    const kk = kick(t);
    for (let i = 0; i < 7; i++) {
      const x = X0 + 300 + hash(i, 21) * 2000;
      const y = surf(x, t);
      const tw = Math.max(0, Math.sin(t * (3 + hash(i, 22) * 3) + i * 2.3));
      sparkle(c, x, y + 2, (10 + 18 * hash(i, 23)) * (0.4 + tw) * (1 + 0.6 * kk), { alpha: 0.4 + 0.6 * tw, rot: 0.2 });
    }
    // la cresta de cada loma revienta en spray a medida que la recorre (hacia la izquierda y arriba)
    HEAVES.forEach(([tb], k) => {
      for (let j = 0; j < 4; j++) {
        const x = X1 - 260 - j * 520 - 90 * hash(j, k, 51);
        const t0 = tb + delay(x) + TAU_H * 0.7;
        const p = (t - t0) / 0.75;
        if (p <= 0 || p >= 1) continue;
        drawSpray(c, t, x, surf(x, t) - 6, -Math.PI * 0.64, p, { preset: PRESET, count: 46, speed: 680, gravity: 1700, size: 4.4, spread: 0.85, mist: 1, big: 0, seed: 60 + k * 9 + j, life: 0.65 });
      }
    });
  });
}
