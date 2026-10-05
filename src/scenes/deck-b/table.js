// Mesa del casino: alfombra, baranda acolchada navy con vivo dorado, paño teal con la grilla de apuestas
// impresa, pozo de luz de la lámpara y grano. Todo en el plano de la mesa (cámara de perspectiva).
import { makeCanvas } from '../../engine/env.js';
import { TAU } from '../../engine/ease.js';
import { PAL, rgba, shade } from '../../engine/color.js';
import { rad } from '../../engine/draw.js';
import { grain } from './grain.js';
import { DB } from './pal.js';

// mesa: rectángulo de x0 a 0 (ancho 2·hw) con un extremo semicircular de radio hw alrededor de la rueda (0, 0)
export const TABLE = { x0: -2600, hw: 660, rail: 86, railZ: 36, floorZ: -520, wallY: 1150 };
export const LAYOUT = { cx: -820, cy: 30, cell: 74, rowH: 84 };
const LK = 1.5;
let layoutImg = null;
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function outline(hw, n = 28) {
  const pts = [[TABLE.x0, -hw]];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    pts.push([Math.cos(a) * hw, Math.sin(a) * hw]);
  }
  pts.push([TABLE.x0, hw]);
  return pts;
}
const IN = outline(TABLE.hw);
const OUT = outline(TABLE.hw + TABLE.rail);

function projPath(cam, pts, z, into = null) {
  const p = into || new Path2D();
  pts.forEach(([x, y], i) => {
    const q = cam.p(x, y, z);
    if (i) p.lineTo(q.x, q.y); else p.moveTo(q.x, q.y);
  });
  p.closePath();
  return p;
}

function buildLayout() {
  const { cell, rowH } = LAYOUT;
  const w = cell * 14 + 40, h = rowH * 3 + 70 * 2 + 40;
  const cv = makeCanvas(Math.ceil(w * LK), Math.ceil(h * LK));
  const g = cv.getContext('2d');
  g.scale(LK, LK);
  g.translate(20, 20);
  const line = rgba(PAL.goldPale, 0.78);
  g.strokeStyle = line;
  g.lineWidth = 2.6;
  g.lineJoin = 'round';
  // cero del lado de la rueda (derecha), con punta redondeada
  const zx = cell * 13;
  g.beginPath();
  g.moveTo(zx, 0); g.lineTo(zx + cell * 0.65, 0); g.quadraticCurveTo(zx + cell, rowH * 1.5, zx + cell * 0.65, rowH * 3); g.lineTo(zx, rowH * 3);
  g.stroke();
  // grilla 12 × 3 (del 1 junto al cero hasta el 36) y la columna de rombos a la izquierda
  for (let c = -1; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      const x = c < 0 ? 0 : cell * (12 - c), y = r * rowH;
      g.strokeRect(x, y, cell, rowH);
      if (c >= 0) {
        const n = c * 3 + (3 - r);
        const red = RED.has(n);
        g.beginPath();
        g.ellipse(x + cell / 2, y + rowH / 2, cell * 0.3, rowH * 0.27, 0, 0, TAU);
        g.fillStyle = red ? rgba(PAL.coral, 0.85) : rgba(PAL.navy900, 0.75);
        g.fill();
        g.fillStyle = PAL.warmWhite;
        g.font = '700 22px Outfit';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(n), x + cell / 2, y + rowH / 2 + 1);
      } else {
        g.save();
        g.translate(x + cell / 2, y + rowH / 2);
        g.beginPath(); g.moveTo(0, -14); g.lineTo(9, 0); g.lineTo(0, 14); g.lineTo(-9, 0); g.closePath();
        g.fillStyle = rgba(PAL.goldLight, 0.7); g.fill();
        g.restore();
      }
    }
  }
  g.fillStyle = PAL.warmWhite;
  g.font = '700 28px Outfit';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('0', zx + cell * 0.5, rowH * 1.5);
  // docenas y apuestas externas (solo formas: rombos rojo/negro y marcas)
  const y1 = rowH * 3, y2 = y1 + 70;
  for (let d = 0; d < 3; d++) {
    g.strokeRect(cell + d * cell * 4, y1, cell * 4, 70);
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(cell + d * cell * 4 + cell * (1.2 + k * 0.8), y1 + 35, 5, 0, TAU);
      g.fillStyle = rgba(PAL.goldPale, 0.55);
      g.fill();
    }
  }
  for (let k = 0; k < 6; k++) {
    const x = cell + k * cell * 2;
    g.strokeRect(x, y2, cell * 2, 70);
    g.save();
    g.translate(x + cell, y2 + 35);
    if (k === 2 || k === 3) {
      g.beginPath(); g.moveTo(-34, 0); g.lineTo(0, -20); g.lineTo(34, 0); g.lineTo(0, 20); g.closePath();
      g.fillStyle = k === 2 ? rgba(PAL.coral, 0.9) : rgba(PAL.navy900, 0.85);
      g.fill();
      g.strokeStyle = line; g.lineWidth = 1.6; g.stroke();
    } else {
      g.strokeStyle = rgba(PAL.goldPale, 0.6); g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke();
      g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.stroke();
    }
    g.restore();
  }
  return { cv, w, h };
}

export function initTable() {
  if (!layoutImg) layoutImg = buildLayout();
}

/** Alfombra del salón (lejos, debajo de la mesa) y pared del fondo: devuelve la Y del zócalo en pantalla. */
export function drawFloor(ctx, cam) {
  const z = TABLE.floorZ;
  const far = TABLE.wallY;
  const pts = [[-9000, -6000], [9000, -6000], [9000, far], [-9000, far]];
  const path = projPath(cam, pts, z);
  ctx.fillStyle = PAL.navy900;
  ctx.fill(path);
  // degradé de la alfombra hacia el fondo + dibujo de rombos muy sutil
  const a = cam.p(0, -1000, z), b = cam.p(0, far, z);
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(0, a.y, 0, b.y);
  g.addColorStop(0, rgba(PAL.navy700, 0.0));
  g.addColorStop(1, rgba(PAL.navy600, 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.min(a.y, b.y) - 2000, 1920, 6000);
  ctx.restore();
  return b.y;
}

/** Mesa completa: costado de la baranda, pared interior, paño, grilla impresa, luz y baranda. */
export function drawTable(ctx, cam, t, { lampX = -380, lampY = -60, lamp = 1 } = {}) {
  const { railZ } = TABLE;
  // costado exterior de la baranda (lo cercano) y canto de la mesa
  ctx.fillStyle = PAL.ink;
  ctx.fill(projPath(cam, OUT, -46));
  ctx.fillStyle = shade(PAL.navy900, -0.2);
  ctx.fill(projPath(cam, OUT, railZ * 0.4));
  // pared interior de la baranda (se ve del lado lejano)
  ctx.fillStyle = shade(PAL.navy800, -0.15);
  ctx.fill(projPath(cam, IN, railZ));
  // paño
  const felt = projPath(cam, IN, 0);
  ctx.fillStyle = DB.felt;
  ctx.fill(felt);
  ctx.save();
  ctx.clip(felt);
  // pozo de luz de la lámpara (elipse en perspectiva)
  const m = cam.aff(lampX, lampY, 0);
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const R = 1250;
  ctx.fillStyle = rad(ctx, 0, 0, R, [[0, rgba(DB.feltHi, 0.55 * lamp)], [0.35, rgba(DB.feltLight, 0.4 * lamp)], [0.75, rgba(DB.feltDark, 0.0)], [1, rgba(DB.feltDeep, 0)]]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rad(ctx, 0, 0, R * 0.6, [[0, rgba(PAL.goldLight, 0.16 * lamp)], [1, rgba(PAL.goldLight, 0)]]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  // borde del paño más oscuro (viñeta propia)
  const mm = cam.aff(-300, 0, 0);
  ctx.save();
  ctx.transform(mm[0], mm[1], mm[2], mm[3], mm[4], mm[5]);
  const R2 = 2300;
  ctx.fillStyle = rad(ctx, 0, 0, R2, [[0.35, rgba(DB.feltDeep, 0)], [1, rgba(DB.feltDeep, 0.85)]]);
  ctx.fillRect(-R2, -R2, R2 * 2, R2 * 2);
  ctx.restore();
  // grilla de apuestas impresa
  const L = layoutImg;
  const ml = cam.aff(LAYOUT.cx, LAYOUT.cy, 0.5);
  ctx.save();
  ctx.transform(ml[0], ml[1], ml[2], ml[3], ml[4], ml[5]);
  ctx.globalAlpha *= 0.9;
  ctx.drawImage(L.cv, -L.w / 2, -L.h / 2, L.w, L.h);
  ctx.restore();
  grain(ctx, null, { alpha: 0.13, blend: 'overlay' });
  ctx.restore();
  // sombra dura que la baranda proyecta sobre el paño (lado de la luz)
  ctx.save();
  ctx.clip(felt);
  ctx.strokeStyle = rgba(PAL.ink, 0.35);
  ctx.lineWidth = 26 * cam.p(0, 0, 0).s;
  ctx.stroke(projPath(cam, IN, 0));
  ctx.restore();
  // tapa de la baranda: cuero navy acolchado (base, sombra hacia afuera, brillo especular en el lomo)
  const top = new Path2D();
  projPath(cam, OUT, railZ, top);
  projPath(cam, IN, railZ, top);
  ctx.fillStyle = PAL.navy700;
  ctx.fill(top, 'evenodd');
  const s = cam.p(0, 0, railZ).s;
  ctx.save();
  ctx.clip(top, 'evenodd');
  ctx.strokeStyle = PAL.navy800;
  ctx.lineWidth = TABLE.rail * 0.5 * s;
  ctx.stroke(projPath(cam, OUT, railZ));
  const spine = projPath(cam, outline(TABLE.hw + TABLE.rail * 0.42), railZ + 6);
  ctx.strokeStyle = rgba(PAL.navy500, 0.9);
  ctx.lineWidth = 26 * s;
  ctx.stroke(spine);
  ctx.strokeStyle = rgba(PAL.aqua200, 0.3);
  ctx.lineWidth = 11 * s;
  ctx.stroke(spine);
  ctx.strokeStyle = rgba(PAL.white, 0.55);
  ctx.lineWidth = 3 * s;
  ctx.stroke(spine);
  ctx.strokeStyle = rgba(PAL.ink, 0.45);
  ctx.lineWidth = 3 * s;
  ctx.stroke(projPath(cam, outline(TABLE.hw + TABLE.rail * 0.86), railZ + 2));
  ctx.restore();
  // tachas de bronce a lo largo del canto exterior
  const studs = outline(TABLE.hw + TABLE.rail * 0.86, 60);
  for (let i = 1; i < studs.length - 1; i += 1) {
    const q = cam.p(studs[i][0], studs[i][1], railZ - 2);
    if (q.x < -20 || q.x > 1940 || q.y < -20 || q.y > 1100) continue;
    const rr = 3.4 * q.s;
    ctx.fillStyle = DB.brassDark;
    ctx.beginPath(); ctx.arc(q.x, q.y + rr * 0.3, rr, 0, TAU); ctx.fill();
    ctx.fillStyle = DB.brassLight;
    ctx.beginPath(); ctx.arc(q.x - rr * 0.25, q.y - rr * 0.1, rr * 0.55, 0, TAU); ctx.fill();
  }
  // vivo dorado del borde interior con filo de luz
  ctx.strokeStyle = DB.brassDark;
  ctx.lineWidth = 5 * s;
  ctx.stroke(projPath(cam, IN, railZ));
  ctx.strokeStyle = DB.brass;
  ctx.lineWidth = 3 * s;
  ctx.stroke(projPath(cam, IN, railZ + 1.5));
}
