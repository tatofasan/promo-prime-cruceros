// Palmeras en maceta vistas desde arriba: copa de hojas plumosas (3 tonos, nervadura con filo de luz, folíolos
// recortados) a h ≈ 480 (parallax: se abre desde el centro), maceta en la cubierta, sombra larga horneada.
// Primeros planos: hojas enormes y desenfocadas MUY cerca de la cámara (h ≈ 1500) que pasan rápido.
import { makeCanvas } from '../../engine/env.js';
import { PAL, mixHex } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { TROPIC } from '../../art/tropics.js';
import { sprite, put, project, softBlur } from './util.js';
import { SUN, shadowOff } from './pool-geo.js';

const la = Math.atan2(SUN[1], SUN[0]);

// una hoja de palmera (eje +x, largo len) como path de folíolos dentados
function frondPath(len, w, seed, curl = 0.18) {
  const p = new Path2D();
  const n = 15;
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = u * len, y = Math.sin(u * Math.PI * 0.9) * curl * len * 0.35;
    const ww = w * Math.sin(Math.PI * Math.min(1, u * 1.08)) * (0.75 + 0.25 * hash(i, seed));
    const tooth = i % 2 ? 1 : 0.55;
    top.push([x + ww * 0.25, y - ww * tooth]);
    bot.push([x + ww * 0.25, y + ww * tooth]);
  }
  p.moveTo(0, 0);
  for (const [x, y] of top) p.lineTo(x, y);
  p.lineTo(len, 0);
  for (let i = bot.length - 1; i >= 0; i--) p.lineTo(bot[i][0], bot[i][1]);
  p.closePath();
  return p;
}

function crown(seed, R = 150, nF = 9) {
  return sprite(R * 2 + 40, R * 2 + 40, (c) => {
    for (let k = 0; k < nF; k++) {
      const a = (k / nF) * TAU + hash(k, seed) * 0.5;
      const len = R * (0.82 + 0.18 * hash(k, seed + 1));
      const lit = Math.cos(a - la);
      c.save();
      c.rotate(a);
      const P = frondPath(len, 26 + 6 * hash(k, seed + 2), seed + k, 0.2 * (hash(k, seed + 3) - 0.5));
      // sombra de la hoja sobre las de abajo
      c.save(); c.translate(-SUN[0] * 6, -SUN[1] * 6); c.fillStyle = 'rgba(8,40,40,0.35)'; c.fill(P); c.restore();
      const base = lit > 0 ? mixHex(TROPIC.leaf, TROPIC.leafLight, 0.35 * lit) : mixHex(TROPIC.leaf, TROPIC.leafShade, -0.6 * lit);
      c.fillStyle = base;
      c.fill(P);
      // mitad en sombra (la hoja se pliega en V por la nervadura)
      c.save(); c.clip(P);
      c.fillStyle = mixHex(base, TROPIC.leafShade, 0.55);
      c.fillRect(0, lit > 0 ? 0 : -60, len + 10, 60);
      c.restore();
      // nervadura con filo de luz
      c.strokeStyle = mixHex(TROPIC.leafLight, '#FFFFFF', 0.3);
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(4, 0); c.quadraticCurveTo(len * 0.5, len * 0.03, len * 0.97, 0); c.stroke();
      c.restore();
    }
    // corazón de la copa
    c.fillStyle = TROPIC.trunkShade;
    c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill();
    c.fillStyle = TROPIC.trunk;
    c.beginPath(); c.arc(SUN[0] * 3, SUN[1] * 3, 10, 0, TAU); c.fill();
    // cocos
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + seed;
      c.fillStyle = '#7A5230';
      c.beginPath(); c.arc(Math.cos(a) * 14, Math.sin(a) * 14, 7, 0, TAU); c.fill();
      c.fillStyle = '#A8754A';
      c.beginPath(); c.arc(Math.cos(a) * 14 + SUN[0] * 2, Math.sin(a) * 14 + SUN[1] * 2, 3.5, 0, TAU); c.fill();
    }
  }, 1.4);
}

// racimo de 3 hojas que salen de un punto (esquina de una copa que pasa MUY cerca de la cámara), desenfocado
function blurredLeaf(seed, R, blur) {
  // a media resolución: está desenfocada, no pierde nada y cuesta 1/4
  const S = 2 * R + blur * 6, q = 0.5;
  const a = makeCanvas(Math.ceil(S * q), Math.ceil(S * q));
  const c = a.getContext('2d');
  c.scale(q, q);
  c.translate(S / 2, S / 2);
  for (let k = 0; k < 3; k++) {
    c.save();
    c.rotate((k - 1) * 0.62 + (hash(k, seed) - 0.5) * 0.2);
    const len = R * (0.92 + 0.08 * k);
    const P = frondPath(len, R * 0.2, seed + k, 0.22 * (k - 1));
    c.fillStyle = mixHex(TROPIC.leafShade, PAL.navy800, 0.15);
    c.fill(P);
    c.save(); c.clip(P); c.fillStyle = mixHex(TROPIC.leaf, TROPIC.leafLight, 0.25); c.fillRect(0, -R, len + 10, R); c.restore();
    c.strokeStyle = mixHex(TROPIC.leafLight, '#ffffff', 0.2);
    c.lineWidth = 5;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, len * 0.03 * (k - 1), len * 0.96, 0); c.stroke();
    c.restore();
  }
  return { c: softBlur(a, Math.max(1, Math.round(Math.log2(blur * q)))), w: S, h: S, res: q };
}

export const PALMS = [
  { x: 120, y: 600, h: 470, seed: 3, R: 160 },
  { x: 1700, y: 70, h: 520, seed: 7, R: 165 },
  { x: -60, y: 70, h: 500, seed: 11, R: 150 },
];
// (ubicadas para que, con k ≈ 2, caigan en la esquina de arriba a la derecha y en el borde izquierdo)
export const FG = [
  { x: 1450, y: 268, h: 1500, rot: 2.45, seed: 2, R: 330 },
  { x: 455, y: 585, h: 1500, rot: 0.05, seed: 5, R: 250 },
];

let SPR = null;
export function initPlants() {
  if (SPR) return;
  SPR = { crowns: PALMS.map((p) => crown(p.seed, p.R)), fg: FG.map((f) => blurredLeaf(f.seed, f.R, 7)) };
}

/** Siluetas de sombra de las palmeras: copa (suave) y tronco + maceta (nítida). */
export function plantShadow(soft, sharp) {
  for (const p of PALMS) {
    const [ox, oy] = shadowOff(p.h);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + hash(k, p.seed) * 0.5;
      soft.save();
      soft.translate(p.x + ox, p.y + oy);
      soft.rotate(a);
      soft.fill(frondPath(p.R * 0.9, 28, p.seed + k, 0.1));
      soft.restore();
    }
    sharp.lineWidth = 16;
    sharp.beginPath(); sharp.moveTo(p.x, p.y); sharp.lineTo(p.x + ox, p.y + oy); sharp.stroke();
    const [mx, my] = shadowOff(70);
    sharp.fillRect(p.x - 52 + mx * 0.5, p.y - 52 + my * 0.5, 104, 104);
  }
}

/** Macetas cuadradas de piedra con tierra (objetos en la cubierta). */
export function plantPots(c) {
  for (const p of PALMS) {
    c.save();
    c.fillStyle = '#E9E2D4';
    c.fillRect(p.x - 52, p.y - 52, 104, 104);
    c.fillStyle = '#FFFFFF';
    c.fillRect(p.x - 52, p.y - 52, 104, 6);
    c.fillRect(p.x + 46, p.y - 52, 6, 104);
    c.fillStyle = '#BDB2A0';
    c.fillRect(p.x - 52, p.y + 46, 104, 6);
    c.fillRect(p.x - 52, p.y - 52, 6, 104);
    c.fillStyle = '#6B4A33';
    c.fillRect(p.x - 42, p.y - 42, 84, 84);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (let k = 0; k < 40; k++) c.fillRect(p.x - 40 + hash(k, 1) * 78, p.y - 40 + hash(k, 2) * 78, 2.5, 2.5);
    c.restore();
  }
}

/** Copas por cuadro (con balanceo). */
export function drawPalms(ctx, C, t) {
  PALMS.forEach((p, i) => {
    const [x, y, k] = project(C, p.x, p.y, p.h);
    const half = (SPR.crowns[i].w / 2) * k;
    if (x + half < 0 || x - half > 1920 || y + half < 0 || y - half > 1080) return;
    const sway = 0.03 * Math.sin(t * 1.3 + i * 2) + 0.012 * Math.sin(t * 3.7 + i);
    put(ctx, SPR.crowns[i], x, y, { r: C.r + sway + i, s: k });
  });
}

/** Primeros planos desenfocados (pasan rápido con la cámara). */
export function drawForeground(ctx, C, t, alpha = 1) {
  FG.forEach((f, i) => {
    if ((C.A ?? 3000) - f.h < 300) return;
    const [x, y, k] = project(C, f.x, f.y, f.h);
    const half = (SPR.fg[i].w / 2) * k * 0.8;
    if (x + half < 0 || x - half > 1920 || y + half < 0 || y - half > 1080) return;
    const sway = 0.04 * Math.sin(t * 1.1 + i);
    put(ctx, SPR.fg[i], x, y, { r: C.r + f.rot + sway, s: k, alpha: 0.8 * alpha });
  });
}
