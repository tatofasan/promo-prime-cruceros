// Postal EUROPA: Santorini. Acantilado volcánico con estratos, casitas blancas cúbicas escalonadas,
// cúpulas azules con cruz, campanario, escalera en zigzag, buganvilias y el Egeo profundo con velero.
// 280 × 184, luz arriba-izquierda.
import { PAL, rgba, mixHex } from '../../../engine/color.js';
import { TAU } from '../../../engine/ease.js';
import { sparkle } from '../../../engine/draw.js';
import { AW, AH, sky, sunGlow, sea, cloud, gull, sailboat, poly, haze } from './kit.js';

const CLIFF = { hi: '#D7B49C', base: '#B88C74', lo: '#93695A', deep: '#6E4D44' };
const WALL = PAL.warmWhite, WALLS = mixHex(PAL.aqua100, PAL.grey300, 0.35);
const DOME = { base: PAL.ocean600, hi: PAL.ocean400, lo: PAL.navy600 };

const HOUSES = [
  // x, y (base), w, h
  [206, 72, 24, 16], [232, 66, 26, 18], [258, 62, 24, 16],
  [180, 86, 22, 14], [214, 90, 20, 14], [238, 86, 22, 16], [262, 82, 20, 16],
  [160, 104, 20, 14], [190, 108, 22, 15], [222, 106, 18, 13], [246, 104, 24, 16],
  [150, 124, 18, 13], [176, 126, 22, 14], [206, 126, 20, 14], [234, 124, 22, 14], [258, 122, 22, 14],
];

export function draw(ctx, t) {
  const hz = 104;
  sky(ctx, hz, [PAL.aqua300, [0.5, PAL.aqua200], [1, PAL.warmWhite]]);
  sunGlow(ctx, 44, 28, 11);
  cloud(ctx, 96, 44, 0.9, { a: 0.9 });
  // isla lejana
  ctx.fillStyle = mixHex(PAL.aqua200, PAL.dusk, 0.18);
  ctx.beginPath(); ctx.moveTo(0, hz); ctx.quadraticCurveTo(30, 88, 70, 92); ctx.quadraticCurveTo(96, 96, 112, hz); ctx.fill();
  haze(ctx, 80, hz, PAL.warmWhite, 0.5);
  sea(ctx, t, hz, { top: PAL.ocean500, bottom: PAL.navy500, line: PAL.aqua200, seed: 9, glint: 7 });
  sailboat(ctx, 70, 140, 1.1, t, 0.3);
  // acantilado con estratos
  const cliff = [[96, AH], [112, 160], [128, 140], [142, 120], [160, 100], [180, 84], [200, 70], [226, 62], [252, 56], [AW, 52], [AW, AH]];
  poly(ctx, cliff, CLIFF.base);
  ctx.save();
  ctx.beginPath(); cliff.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
  const bands = [[CLIFF.hi, 0], [CLIFF.base, 14], [CLIFF.lo, 30], [CLIFF.base, 48], [CLIFF.deep, 64], [CLIFF.lo, 82]];
  for (const [c, off] of bands) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(90, AH);
    for (let x = 90; x <= AW; x += 10) ctx.lineTo(x, 150 - (x - 90) * 0.5 + off + Math.sin(x * 0.15 + off) * 2.5);
    ctx.lineTo(AW, AH);
    ctx.fill();
  }
  // sombra del acantilado hacia abajo-derecha
  const sg = ctx.createLinearGradient(120, 0, AW, 0);
  sg.addColorStop(0, rgba(PAL.navy900, 0));
  sg.addColorStop(1, rgba(PAL.navy900, 0.22));
  ctx.fillStyle = sg;
  ctx.fillRect(90, 40, 200, 150);
  ctx.restore();
  // filo de luz del borde del acantilado
  ctx.strokeStyle = rgba(PAL.warmWhite, 0.65);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); cliff.slice(1, 10).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  // escalera en zigzag que baja al mar
  ctx.strokeStyle = rgba(PAL.warmWhite, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(146, 138);
  for (let i = 0; i < 5; i++) ctx.lineTo(i % 2 ? 146 : 134, 143 + i * 5);
  ctx.stroke();
  // casitas: frente blanco, costado en sombra, puertas y ventanas
  for (const [x, y, w, h] of HOUSES) {
    poly(ctx, [[x, y], [x, y - h], [x + w, y - h], [x + w, y]], WALL);
    poly(ctx, [[x + w * 0.72, y], [x + w * 0.72, y - h], [x + w, y - h], [x + w, y]], WALLS);
    ctx.fillStyle = rgba(PAL.white, 0.9);
    ctx.fillRect(x - 1, y - h - 1.6, w + 2, 2);
    ctx.fillStyle = (x + y) % 3 ? PAL.ocean600 : PAL.navy700;
    ctx.fillRect(x + w * 0.2, y - 6, 3.2, 6);
    ctx.fillStyle = PAL.navy700;
    ctx.fillRect(x + w * 0.48, y - h + 4, 2.6, 2.6);
  }
  // cúpulas azules con cruz
  for (const [x, y, r] of [[218, 56, 10], [188, 72, 8], [168, 92, 7]]) {
    poly(ctx, [[x - r, y + 8], [x - r, y], [x + r, y], [x + r, y + 8]], WALL);
    ctx.fillStyle = WALLS;
    ctx.fillRect(x + r * 0.45, y, r * 0.55, 8);
    ctx.fillStyle = DOME.base;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = DOME.lo;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.6, TAU); ctx.lineTo(x, y); ctx.fill();
    ctx.fillStyle = DOME.hi;
    ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.48, r * 0.22, r * 0.36, 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.white;
    ctx.fillRect(x - 0.6, y - r - 6, 1.3, 6);
    ctx.fillRect(x - 2.2, y - r - 4.4, 4.4, 1.2);
  }
  // campanario
  poly(ctx, [[246, 50], [246, 26], [262, 26], [262, 50]], WALL);
  poly(ctx, [[256, 50], [256, 26], [262, 26], [262, 50]], WALLS);
  ctx.fillStyle = PAL.ocean600;
  ctx.beginPath(); ctx.arc(254, 26, 8, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = PAL.navy800;
  for (const x of [249, 255.5]) { ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, 35); ctx.arc(x + 1.7, 35, 1.7, Math.PI, TAU); ctx.lineTo(x + 3.4, 44); ctx.fill(); }
  ctx.fillStyle = PAL.gold;
  ctx.beginPath(); ctx.arc(250.7 + Math.sin(t * 5) * 0.5, 39, 1.3, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.fillRect(253.4, 12, 1.3, 7);
  ctx.fillRect(251.8, 14, 4.5, 1.2);
  // buganvilias
  const pinks = [PAL.sunsetPink, mixHex(PAL.sunsetPink, PAL.dusk, 0.3), mixHex(PAL.sunsetPink, PAL.white, 0.3)];
  for (const [x, y] of [[200, 106], [176, 124], [238, 84], [150, 122]]) {
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = pinks[i % 3];
      ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.4) * 4.5, y - 2 + Math.sin(i * 2.4) * 2.6, 1.6, 0, TAU); ctx.fill();
    }
  }
  const a = Math.max(0, Math.sin(t * 2.3));
  sparkle(ctx, 213, 49, 7 * a, { alpha: a });
  gull(ctx, 120, 30, 0.9, t, 1.1);
  gull(ctx, 140, 22, 0.7, t, 0.1);
}
