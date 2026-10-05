// Pared del fondo (plano D.wall): revoque frío con cono de luz del tubo fluorescente, ventana de aluminio con
// persiana americana (el hueco queda transparente para ver la ciudad), estante con biblioratos, reloj y el
// artefacto de luz colgante. Todo horneado una vez; lo que se mueve (agujas, almanaque, tubo, cordón) va aparte.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, rad, fill, rrectPath, circlePath, polyPath, texture } from '../../engine/draw.js';
import { bake, put, shadowOnly, wobble } from './util.js';
import { WIN, LAMP, MON, CAL, T } from './layout.js';
import { paintClockFace } from './clock.js';
import { paintShelf } from './shelf.js';

const BX = -340, BY = -170, BW = 2600, BH = 1020, S = 1.1;
let SPR = null;

export const WALL = mixHex(PAL.grey600, PAL.navy600, 0.08);
const WALL_LO = mixHex(PAL.grey700, PAL.navy700, 0.14);
const WALL_HI = mixHex(PAL.grey500, PAL.aqua200, 0.06);
export const FRAME = mixHex(PAL.grey300, PAL.grey400, 0.3);

export function initWall() {
  SPR = bake(BX, BY, BW, BH, S, (g) => {
    const all = rrectPath(BX, BY, BW, BH, 0);
    // revoque: degradé vertical + cono de luz del tubo + caída hacia la derecha
    fill(g, all, lin(g, 0, BY, 0, BY + BH, [[0, WALL_LO], [0.3, WALL], [0.75, WALL], [1, WALL_LO]]));
    fill(g, all, rad(g, 640, 70, 1150, [[0, rgba(WALL_HI, 0.75)], [0.45, rgba(WALL_HI, 0.3)], [1, rgba(WALL_HI, 0)]]));
    fill(g, all, lin(g, 1150, 0, 2260, 0, [[0, rgba(PAL.ink, 0)], [1, rgba(PAL.ink, 0.22)]]));
    // juntas de placas de yeso (bisel: sombra + filo)
    for (const x of [1236, 1560, 2040, -40]) {
      g.fillStyle = rgba(PAL.ink, 0.14); g.fillRect(x, BY, 2, BH);
      g.fillStyle = rgba(PAL.grey300, 0.07); g.fillRect(x + 2, BY, 1.5, BH);
    }
    texture(g, all, { alpha: 0.09, blend: 'overlay', scale: 1.4 });
    // sombra del monitor sobre la pared (luz de arriba a la izquierda)
    shadowOnly(g, S, rrectPath(MON.x - 16, MON.y - 16, MON.w + 32, MON.h + 40, 14), { dx: 46, dy: 30, blur: 40, color: rgba(PAL.ink, 0.55) });
    // oclusión junto al escritorio
    fill(g, rrectPath(BX, 690, BW, 160, 0), lin(g, 0, 690, 0, 812, [[0, rgba(PAL.ink, 0)], [1, rgba(PAL.ink, 0.5)]]));

    paintWindow(g);
    paintLamp(g);
    paintClockFace(g);
    paintShelf(g);
    // clavo del almanaque
    fill(g, circlePath(CAL.nx + 3, CAL.ny + 4, 6), rgba(PAL.ink, 0.35));
    fill(g, circlePath(CAL.nx, CAL.ny, 5.5), PAL.grey400);
    fill(g, circlePath(CAL.nx - 1.5, CAL.ny - 1.5, 2.2), PAL.grey200);
  });
}

function paintWindow(g) {
  const { x, y, w, h, mull, blind } = WIN;
  const F = { x: x - 22, y: y - 20, w: w + 44, h: h + 38 };
  // marco con sombra proyectada sobre la pared
  g.save();
  g.shadowColor = rgba(PAL.ink, 0.45); g.shadowBlur = 22; g.shadowOffsetX = 10; g.shadowOffsetY = 12;
  fill(g, rrectPath(F.x, F.y, F.w, F.h, 5), FRAME);
  g.restore();
  // tres tonos del aluminio: filo arriba/izquierda, sombra abajo/derecha
  g.fillStyle = rgba(PAL.grey200, 0.85); g.fillRect(F.x + 3, F.y, F.w - 6, 2.5); g.fillRect(F.x, F.y + 3, 2.5, F.h - 6);
  g.fillStyle = rgba(PAL.ink, 0.28); g.fillRect(F.x + 3, F.y + F.h - 3, F.w - 6, 3); g.fillRect(F.x + F.w - 3, F.y + 3, 3, F.h - 6);
  // bisel interior (el hueco)
  g.fillStyle = mixHex(FRAME, PAL.grey600, 0.45); g.fillRect(x - 6, y - 6, w + 12, 6); g.fillRect(x - 6, y - 6, 6, h + 12);
  g.fillStyle = mixHex(FRAME, PAL.grey200, 0.5); g.fillRect(x - 6, y + h, w + 12, 6); g.fillRect(x + w, y - 6, 6, h + 12);
  // hueco transparente (debajo de la persiana)
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fillRect(x, blind, w, y + h - blind);
  g.restore();
  // parante central
  g.save();
  g.shadowColor = rgba(PAL.ink, 0.3); g.shadowBlur = 8; g.shadowOffsetX = 5;
  g.fillStyle = FRAME; g.fillRect(mull - 9, y, 18, h);
  g.restore();
  g.fillStyle = rgba(PAL.grey200, 0.8); g.fillRect(mull - 9, y, 2.5, h);
  g.fillStyle = rgba(PAL.ink, 0.25); g.fillRect(mull + 6, y, 3, h);
  // persiana americana
  paintBlinds(g, x, y, w, blind);
  // alféizar: cara superior clara, frente y sombra sobre la pared
  const sx = F.x - 20, sw = F.w + 40, sy = F.y + F.h - 8;
  fill(g, rrectPath(sx, sy + 30, sw, 34, 0), lin(g, 0, sy + 30, 0, sy + 64, [[0, rgba(PAL.ink, 0.38)], [1, rgba(PAL.ink, 0)]]));
  fill(g, rrectPath(sx, sy, sw, 13, 2), lin(g, 0, sy, 0, sy + 13, [PAL.grey200, mixHex(PAL.grey300, PAL.grey200, 0.3)]));
  fill(g, rrectPath(sx, sy + 12, sw, 18, 2), lin(g, 0, sy + 12, 0, sy + 30, [PAL.grey400, mixHex(PAL.grey500, PAL.grey600, 0.4)]));
  g.fillStyle = rgba(PAL.white, 0.5); g.fillRect(sx + 2, sy, sw - 4, 1.5);
}

function paintBlinds(g, x, y, w, bottom) {
  // cabezal
  fill(g, rrectPath(x - 10, y - 8, w + 20, 18, 3), lin(g, 0, y - 8, 0, y + 10, [PAL.grey200, PAL.grey400]));
  g.fillStyle = rgba(PAL.ink, 0.3); g.fillRect(x - 10, y + 10, w + 20, 3);
  // tablillas: base, filo claro arriba y ranura oscura
  const pitch = 13;
  let i = 0;
  for (let yy = y + 12; yy < bottom - 12; yy += pitch, i++) {
    const bent = i === 6;
    g.fillStyle = rgba(mixHex(PAL.grey900, PAL.navy800, 0.3), 0.85);
    g.fillRect(x, yy + pitch - 2.6, w, 2.6);
    fill(g, rrectPath(x - 4, yy, w + 8, pitch - 2.6, 2), lin(g, 0, yy, 0, yy + pitch, [mixHex(PAL.grey300, PAL.grey200, 0.4), PAL.grey400]));
    g.fillStyle = rgba(PAL.white, 0.45); g.fillRect(x - 4, yy, w + 8, 1.2);
    if (bent) {
      // una tablilla doblada (detalle para la segunda mirada)
      fill(g, polyPath([[x + 120, yy + 3], [x + 200, yy + 14], [x + 290, yy + 3], [x + 290, yy + 10], [x + 200, yy + 22], [x + 120, yy + 10]]), PAL.grey400);
      fill(g, polyPath([[x + 125, yy + 10], [x + 200, yy + 20], [x + 285, yy + 10], [x + 200, yy + 12]]), rgba(PAL.ink, 0.5));
    }
  }
  // riel inferior con sombra
  fill(g, rrectPath(x - 6, bottom - 12, w + 12, 13, 3), lin(g, 0, bottom - 12, 0, bottom + 1, [PAL.grey200, PAL.grey500]));
  // escaleritas (cordones)
  g.fillStyle = rgba(PAL.grey500, 0.7);
  for (const lx of [x + 110, x + 330, x + 490, x + 710]) g.fillRect(lx, y + 10, 1.5, bottom - y - 10);
}

function paintLamp(g) {
  const { x0, x1, y } = LAMP;
  // cables de suspensión
  g.fillStyle = rgba(PAL.grey900, 0.7);
  g.fillRect(x0 + 70, BY, 2, y - BY + 2); g.fillRect(x1 - 72, BY, 2, y - BY + 2);
  // sombra del artefacto sobre la pared
  fill(g, rrectPath(x0 + 10, y + 26, x1 - x0, 20, 8), rgba(PAL.ink, 0.18));
  // carcasa en tres tonos
  fill(g, rrectPath(x0, y, x1 - x0, 24, 6), lin(g, 0, y, 0, y + 24, [PAL.grey200, PAL.grey400, PAL.grey500]));
  g.fillStyle = rgba(PAL.white, 0.6); g.fillRect(x0 + 6, y + 1, x1 - x0 - 12, 1.5);
  fill(g, rrectPath(x0, y, 14, 24, 5), rgba(PAL.ink, 0.2));
  fill(g, rrectPath(x1 - 14, y, 14, 24, 5), rgba(PAL.ink, 0.3));
}

/** Pared horneada (con el hueco de la ventana transparente). */
export function drawWall(ctx) {
  put(ctx, SPR);
}

/** Cordón de la persiana que se hamaca (acción secundaria; el estallido lo sacude). */
export function drawCord(ctx, t) {
  const x0 = WIN.x + WIN.w - 46, y0 = WIN.blind - 6, len = 230;
  let a = 0.035 * Math.sin(t * 2.1) + 0.02 * Math.sin(t * 3.7 + 1);
  for (const q of T.q) a += 0.05 * wobble(t, q, { freq: 1.6, decay: 2.5 });
  if (t > T.surge) a += -0.5 * wobble(t, T.surge, { freq: 2.2, decay: 2 }) - 0.25 * Math.min(1, (t - T.surge) * 4);
  const ex = x0 + Math.sin(a) * len, ey = y0 + Math.cos(a) * len;
  ctx.strokeStyle = mixHex(PAL.grey300, PAL.grey400, 0.5);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(x0 + Math.sin(a * 0.5) * len * 0.5 + a * 20, y0 + len * 0.5, ex, ey);
  ctx.stroke();
  // borla en tres tonos
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(-a);
  fill(ctx, rrectPath(-5, 0, 10, 26, 4), lin(ctx, -5, 0, 5, 0, [PAL.grey200, PAL.grey400, PAL.grey500]));
  fill(ctx, rrectPath(-6, 0, 12, 5, 2), PAL.grey300);
  ctx.restore();
}
