// Parrilla de luces (truss) y cabezas móviles. Cada cabeza cuelga de su horquilla y gira: tilt 0 = apunta al
// piso, tilt π/2 = mira a cámara (la lente pasa de elipse finita a círculo y se vuelve un disco enceguecedor).
import { makeCanvas } from '../../engine/env.js';
import { W } from '../../engine/time.js';
import { TAU, clamp } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { rad, lin } from '../../engine/draw.js';
import { DB } from './pal.js';

export const TRUSS_Y = 196;
let truss = null;

function buildTruss() {
  const TW = W + 600, TH = 60;
  const cv = makeCanvas(TW, TH);
  const g = cv.getContext('2d');
  const metal = PAL.navy600, dark = PAL.navy900, hi = PAL.aqua200;
  // dos cordones (arriba y abajo) con filo de luz
  for (const y of [8, 46]) {
    g.fillStyle = dark; g.fillRect(0, y - 1, TW, 9);
    g.fillStyle = metal; g.fillRect(0, y - 1, TW, 6);
    g.fillStyle = rgba(hi, 0.55); g.fillRect(0, y - 1, TW, 1.6);
  }
  // celosía en zigzag
  g.lineCap = 'round';
  for (let x = 0; x < TW; x += 44) {
    g.strokeStyle = dark; g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 22, 46); g.lineTo(x + 44, 12); g.stroke();
    g.strokeStyle = metal; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 22, 46); g.lineTo(x + 44, 12); g.stroke();
  }
  return cv;
}

export function initFixtures() {
  if (!truss) truss = buildTruss();
}

/** Parrilla horizontal en y = TRUSS_Y (plano de las luces). */
export function drawTruss(ctx) {
  ctx.drawImage(truss, -300, TRUSS_Y - 30);
}

/**
 * Cabeza móvil con el eje de la horquilla en (x, y). pan = giro lateral del haz (rad), tilt (0 abajo → π/2 cámara),
 * glow 0..1 = brillo de la lente. Devuelve el centro y radio de la lente en coordenadas locales del plano.
 */
export function drawHead(ctx, x, y, { tilt = 0, pan = 0, glow = 0.5, s = 1, color = DB.beamWarm } = {}) {
  const R = 34 * s; // radio de la lente
  const bodyL = 56 * s;
  // horquilla (U) colgando de la parrilla
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = PAL.navy900; ctx.lineWidth = 13 * s;
  ctx.beginPath(); ctx.moveTo(x, y - 30 * s); ctx.lineTo(x, y - 18 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 46 * s, y + 6 * s); ctx.lineTo(x - 46 * s, y - 18 * s); ctx.lineTo(x + 46 * s, y - 18 * s); ctx.lineTo(x + 46 * s, y + 6 * s); ctx.stroke();
  ctx.strokeStyle = PAL.navy600; ctx.lineWidth = 8 * s;
  ctx.beginPath(); ctx.moveTo(x - 46 * s, y + 6 * s); ctx.lineTo(x - 46 * s, y - 18 * s); ctx.lineTo(x + 46 * s, y - 18 * s); ctx.lineTo(x + 46 * s, y + 6 * s); ctx.stroke();
  ctx.strokeStyle = rgba(PAL.aqua200, 0.5); ctx.lineWidth = 2 * s;
  ctx.beginPath(); ctx.moveTo(x - 49 * s, y + 4 * s); ctx.lineTo(x - 49 * s, y - 21 * s); ctx.lineTo(x + 30 * s, y - 21 * s); ctx.stroke();
  ctx.restore();
  // cabeza: el frente (lente) se proyecta según el tilt; pan inclina el eje en pantalla
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const ax = Math.sin(pan) * ct, ay = Math.cos(pan) * ct; // dirección en pantalla del eje (hacia el frente)
  const fx = x + ax * bodyL * 0.55, fy = y + 4 * s + ay * bodyL * 0.55;
  const bx = x - ax * bodyL * 0.45, by = y + 4 * s - ay * bodyL * 0.45;
  const ang = Math.atan2(ay, ax);
  const ry = Math.max(R * 0.08, R * Math.max(st, 0.0) + R * 0.12 * ct);
  // cuerpo (cilindro entre la tapa trasera y el frente)
  ctx.save();
  ctx.translate(0, 0);
  const g = lin(ctx, x - 40 * s, 0, x + 40 * s, 0, [[0, PAL.navy600], [0.35, PAL.navy800], [1, PAL.ink]]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(bx, by, R * 1.05, Math.max(R * 0.1, ry * 1.02), ang + Math.PI / 2, 0, TAU);
  ctx.fill();
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(bx + nx * R * 1.05, by + ny * R * 1.05);
  ctx.lineTo(fx + nx * R * 1.08, fy + ny * R * 1.08);
  ctx.lineTo(fx - nx * R * 1.08, fy - ny * R * 1.08);
  ctx.lineTo(bx - nx * R * 1.05, by - ny * R * 1.05);
  ctx.closePath();
  ctx.fill();
  // aro del frente
  ctx.beginPath();
  ctx.ellipse(fx, fy, R * 1.12, Math.max(R * 0.12, ry * 1.1), ang + Math.PI / 2, 0, TAU);
  ctx.fillStyle = PAL.navy700;
  ctx.fill();
  ctx.lineWidth = 2.2 * s;
  ctx.strokeStyle = rgba(PAL.aqua200, 0.45);
  ctx.stroke();
  // lente
  ctx.beginPath();
  ctx.ellipse(fx, fy, R, Math.max(R * 0.08, ry), ang + Math.PI / 2, 0, TAU);
  ctx.fillStyle = rad(ctx, fx, fy, R, [[0, PAL.white], [0.35, PAL.goldPale], [0.8, rgba(PAL.gold, 0.9)], [1, rgba(DB.brassDark, 1)]]);
  ctx.globalAlpha *= clamp(0.35 + glow * 0.65);
  ctx.fill();
  ctx.restore();
  return { x: fx, y: fy, r: R, ry, open: st };
}

/** Halo de la lente (se suma con 'lighter'): crece con glow y con lo que la lente mira a cámara. */
export function lensGlow(ctx, L, glow, color = PAL.goldLight) {
  const k = glow * (0.25 + 0.75 * L.open);
  if (k <= 0.01) return;
  const R = L.r * (1.6 + 5 * k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, L.x, L.y, R, [[0, rgba(PAL.white, 0.9 * k)], [0.18, rgba(color, 0.6 * k)], [0.5, rgba(PAL.gold, 0.18 * k)], [1, rgba(PAL.coral, 0)]]);
  ctx.fillRect(L.x - R, L.y - R, R * 2, R * 2);
  ctx.restore();
}
