// Fondo del escenario: pared navy con cortina de estrellas, rayos de sol de music hall que giran lento,
// el gran aro de lamparitas (marquesina) con persecución de luces al ritmo y el contraluz cálido.
import { makeCanvas } from '../../engine/env.js';
import { W, H, BEAT } from '../../engine/time.js';
import { TAU, clamp } from '../../engine/ease.js';
import { PAL, rgba } from '../../engine/color.js';
import { rng } from '../../engine/noise.js';
import { rad, sparkle } from '../../engine/draw.js';
import { grain } from './grain.js';
import { DB } from './pal.js';

export const RING = { x: 960, y: 455, r: 330, n: 44 };
const PAD = 260; // margen para el paneo y el zoom
let wall = null;
let bulb = null;
let stars = [];

function buildWall() {
  const cv = makeCanvas(W + PAD * 2, H + PAD * 2);
  const g = cv.getContext('2d');
  g.translate(PAD, PAD);
  const bg = g.createLinearGradient(0, -PAD, 0, H + PAD);
  bg.addColorStop(0, PAL.ink);
  bg.addColorStop(0.45, PAL.navy900);
  bg.addColorStop(1, PAL.navy800);
  g.fillStyle = bg;
  g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);
  // paneles verticales de la escenografía (3 tonos: base, sombra, filo)
  for (let i = 0; i < 14; i++) {
    const x = -PAD + i * 180;
    g.fillStyle = rgba(PAL.navy700, 0.35);
    g.fillRect(x, -PAD, 120, H + PAD * 2);
    g.fillStyle = rgba(PAL.ink, 0.35);
    g.fillRect(x + 120, -PAD, 18, H + PAD * 2);
    g.fillStyle = rgba(PAL.aqua300, 0.06);
    g.fillRect(x, -PAD, 3, H + PAD * 2);
  }
  // cortina de estrellas (puntitos fijos, algunos titilan en vivo)
  const r = rng(808);
  for (let i = 0; i < 520; i++) {
    const x = -PAD + r() * (W + PAD * 2), y = -PAD + r() * (H * 0.8 + PAD);
    const s = 0.6 + r() * 1.6;
    g.fillStyle = rgba(r() < 0.75 ? PAL.goldPale : PAL.aqua100, 0.25 + r() * 0.5);
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
  grain(g, null, { alpha: 0.06, blend: 'overlay' });
  return cv;
}

function buildBulb() {
  const S = 64;
  const cv = makeCanvas(S, S);
  const g = cv.getContext('2d');
  g.fillStyle = rad(g, S / 2, S / 2, S / 2, [[0, rgba(PAL.white, 1)], [0.16, rgba(PAL.goldPale, 1)], [0.3, rgba(PAL.gold, 0.55)], [1, rgba(PAL.coral, 0)]]);
  g.fillRect(0, 0, S, S);
  return cv;
}

export function initStageBg() {
  if (wall) return;
  wall = buildWall();
  bulb = buildBulb();
  const r = rng(91);
  stars = Array.from({ length: 26 }, () => ({ x: r() * W, y: r() * H * 0.62, s: 6 + r() * 10, hz: 0.8 + r() * 2, ph: r() * TAU }));
}

/** Pared + estrellas titilando (en el plano del fondo; el llamador aplica la cámara). */
export function drawWall(ctx, t, starAlpha = 1) {
  ctx.drawImage(wall, -PAD, -PAD);
  if (starAlpha <= 0.01) return;
  for (const s of stars) {
    const k = Math.max(0, Math.sin(t * s.hz * TAU + s.ph));
    sparkle(ctx, s.x, s.y, s.s * k, { alpha: 0.6 * k * starAlpha, color: PAL.goldPale, halo: 0.4 });
  }
}

/** Rayos de music hall detrás del aro: cuñas alternadas que giran lento. */
export function drawSunburst(ctx, t, glow = 1) {
  const { x, y } = RING;
  const n = 24;
  const rot = t * 0.18;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalCompositeOperation = 'lighter';
  const R = 1500;
  ctx.fillStyle = rad(ctx, 0, 0, R, [[0, rgba(PAL.gold, 0.2 * glow)], [0.35, rgba(PAL.coral, 0.08 * glow)], [1, rgba(PAL.coral, 0)]]);
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, a0, a1);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/** Contraluz cálido detrás de los bailarines (el halo que hace leer las siluetas). */
export function drawBacklight(ctx, t, amt = 1) {
  const { x, y } = RING;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rad(ctx, x, y + 120, 620, [[0, rgba(PAL.goldLight, 0.45 * amt)], [0.3, rgba(PAL.gold, 0.22 * amt)], [0.7, rgba(PAL.coral, 0.07 * amt)], [1, rgba(PAL.coral, 0)]]);
  ctx.fillRect(x - 700, y - 600, 1400, 1300);
  ctx.restore();
}

/**
 * Aro de lamparitas: persecución que da una vuelta por compás y se ilumina entera en los golpes.
 * hit 0..1 = destello general (beat), chase = velocidad.
 */
export function drawRing(ctx, t, { hit = 0, alpha = 1 } = {}) {
  const { x, y, r, n } = RING;
  // aro metálico (3 tonos)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.strokeStyle = DB.brassDeep; ctx.lineWidth = 26; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r - 2, 0, TAU);
  ctx.strokeStyle = DB.brassDark; ctx.lineWidth = 16; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r + 7, Math.PI * 1.05, Math.PI * 1.85);
  ctx.strokeStyle = rgba(PAL.goldLight, 0.7); ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r - 70, 0, TAU);
  ctx.strokeStyle = rgba(DB.brassDark, 0.6); ctx.lineWidth = 6; ctx.stroke();
  // lamparitas
  const head = (t / (BEAT * 4)) * n;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r;
    const d = ((head - i) % n + n) % n;
    const chase = Math.exp(-d / 3.5);
    const on = clamp(0.32 + 0.68 * chase + hit * 0.7) * alpha;
    const s = 22 + 26 * on;
    ctx.globalAlpha = on;
    ctx.drawImage(bulb, bx - s, by - s, s * 2, s * 2);
  }
  // segundo aro interior más chico, persecución al revés
  const n2 = 30;
  for (let i = 0; i < n2; i++) {
    const a = -(i / n2) * TAU - Math.PI / 2;
    const r2 = r - 70;
    const bx = x + Math.cos(a) * r2, by = y + Math.sin(a) * r2;
    const d = ((head * (n2 / n) - i) % n2 + n2) % n2;
    const on = clamp(0.2 + 0.6 * Math.exp(-d / 2.5) + hit * 0.6) * alpha;
    const s = 14 + 16 * on;
    ctx.globalAlpha = on;
    ctx.drawImage(bulb, bx - s, by - s, s * 2, s * 2);
  }
  ctx.restore();
}
