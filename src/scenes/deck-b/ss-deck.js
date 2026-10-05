// Cubierta de teca en perspectiva (fuga en el sol), barnizada: el sol rasante la enciende con un camino de luz
// que sigue al del mar, los parantes y la pareja proyectan sombras largas hacia cámara y el zócalo deja una franja
// de sombra al pie de la baranda. Coordenadas del plano de la cubierta (z = 1).
import { PAL, rgba, mixHex } from '../../engine/color.js';
import { lin, rad, sparkle } from '../../engine/draw.js';
import { TAU } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { HZ } from './ss-time.js';
import { RAIL, POSTS } from './ss-rail.js';
import { grain } from './grain.js';

const Y0 = RAIL.base, Y1 = 1500, X0 = -900, X1 = 2820;
const C = {
  teak: mixHex(mixHex(PAL.navy900, '#5A2A1C', 0.5), PAL.dusk, 0.18),
  teakDeep: mixHex(PAL.ink, '#3A1A14', 0.35),
  lit: mixHex(PAL.gold, PAL.coral, 0.35),
  hot: PAL.goldPale,
  seam: PAL.ink,
};

let SEAMS = null, AREA = null;
function build() {
  AREA = new Path2D();
  AREA.rect(X0, Y0, X1 - X0, Y1 - Y0);
  SEAMS = [];
  for (let k = 1; k < 60; k++) {
    const y = HZ + (Y0 - HZ) / (1 - k * 0.032);
    if (y > Y1 || y < 0) break;
    SEAMS.push(y);
  }
}
export function initDeck() { if (!SEAMS) build(); }

/** Punto de la línea de fuga desde el sol (sx, HZ) que pasa por (x, y0), a la altura y. */
const ray = (sx, x, y0, y) => sx + ((x - sx) * (y - HZ)) / (y0 - HZ);

/**
 * sx = x del sol en el plano de la cubierta · people = [{ x, w }] pies de la pareja (sombras largas)
 * glow 0..1.5 = intensidad del camino de luz.
 */
export function drawDeck(ctx, t, { sx = 960, people = [], glow = 1 } = {}) {
  if (!SEAMS) build();
  // base: teca oscura a contraluz, más cálida al fondo (la baña la luz que pasa por el vidrio)
  ctx.fillStyle = lin(ctx, 0, Y0, 0, 1250, [[0, mixHex(C.teak, C.lit, 0.32)], [0.25, C.teak], [1, C.teakDeep]]);
  ctx.fillRect(X0, Y0 - 30, X1 - X0, Y1 - Y0 + 30); // arranca escondido detrás del zócalo (parallax)
  // camino de luz del sol sobre el barniz (se abre hacia cámara)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.moveTo(ray(sx, sx - 60, Y0, Y0), Y0);
  ctx.lineTo(ray(sx, sx + 60, Y0, Y0), Y0);
  ctx.lineTo(ray(sx, sx + 60, Y0, Y1), Y1);
  ctx.lineTo(ray(sx, sx - 60, Y0, Y1), Y1);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, ray(sx, sx - 60, Y0, 1080), 0, ray(sx, sx + 60, Y0, 1080), 0, [[0, rgba(C.lit, 0)], [0.3, rgba(C.lit, 0.28 * glow)], [0.5, rgba(C.hot, 0.5 * glow)], [0.7, rgba(C.lit, 0.28 * glow)], [1, rgba(C.lit, 0)]]);
  ctx.fill();
  ctx.fillStyle = rad(ctx, sx, Y0 + 10, 520, [[0, rgba(C.lit, 0.42 * glow)], [0.5, rgba(C.lit, 0.12 * glow)], [1, rgba(C.lit, 0)]]);
  ctx.fillRect(sx - 520, Y0, 1040, 520);
  ctx.restore();

  // sombras largas: parantes (rayos finos) y la pareja (bandas que se abren), hacia cámara
  ctx.fillStyle = rgba(PAL.ink, 0.5);
  ctx.beginPath();
  for (const px of POSTS) wedge(ctx, sx, px - 7, px + 7, Y0, Y1);
  ctx.fill();
  ctx.fillStyle = rgba(PAL.ink, 0.42);
  ctx.beginPath();
  for (const p of people) wedge(ctx, sx, p.x - p.w / 2, p.x + p.w / 2, p.y, Y1, p.y);
  ctx.fill();
  // franja de sombra del zócalo al pie de la baranda
  ctx.fillStyle = lin(ctx, 0, Y0, 0, Y0 + 46, [[0, rgba(PAL.ink, 0.72)], [1, rgba(PAL.ink, 0)]]);
  ctx.fillRect(X0, Y0, X1 - X0, 46);

  // juntas de las tablas: línea oscura con su filo de luz abajo (más visibles en la luz)
  ctx.fillStyle = rgba(C.seam, 0.42);
  ctx.beginPath();
  for (const y of SEAMS) {
    const th = 0.8 + (y - HZ) * 0.0045;
    ctx.rect(X0, y, X1 - X0, th);
  }
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lin(ctx, sx - 900, 0, sx + 900, 0, [[0, rgba(C.lit, 0.03)], [0.5, rgba(C.hot, 0.32 * glow)], [1, rgba(C.lit, 0.03)]]);
  ctx.beginPath();
  for (const y of SEAMS) {
    const th = 0.8 + (y - HZ) * 0.0045;
    ctx.rect(X0, y + th, X1 - X0, th * 0.8);
  }
  ctx.fill();
  ctx.restore();
  // cabezas de tablas (juntas cortas sobre las líneas de fuga)
  ctx.fillStyle = rgba(C.seam, 0.35);
  ctx.beginPath();
  for (let i = 0; i < SEAMS.length - 1; i++) {
    const ya = SEAMS[i], yb = SEAMS[i + 1];
    for (let k = 0; k < 7; k++) {
      const xb = -700 + hash(i, k, 5) * 3300;
      const xa = ray(sx, xb, yb, ya);
      const th = 0.7 + (yb - HZ) * 0.004;
      ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.lineTo(xb + th, yb); ctx.lineTo(xa + th, ya); ctx.closePath();
    }
  }
  ctx.fill();
  grain(ctx, AREA, { alpha: 0.1, blend: 'overlay' });

  // destellos sobre el barniz, en el camino del sol
  for (let i = 0; i < 9; i++) {
    const y = Y0 + 30 + hash(i, 71) * 260;
    const x = ray(sx, sx + (hash(i, 72) - 0.5) * 120, Y0, y);
    const tw = Math.sin(t * (3 + hash(i, 73) * 3) * TAU * 0.5 + hash(i, 74) * TAU);
    if (tw > 0.55) sparkle(ctx, x, y, 5 + (y - Y0) * 0.025 + 8 * (tw - 0.55), { color: PAL.goldPale, alpha: (tw - 0.55) * 2 * glow, halo: 0.5 });
  }
}

/** Cuña que fuga del sol: de (xa..xb) a la altura y0 hasta y1 (yStart: dónde empieza). */
function wedge(ctx, sx, xa, xb, y0, y1, yStart = y0) {
  ctx.moveTo(ray(sx, xa, y0, yStart), yStart);
  ctx.lineTo(ray(sx, xb, y0, yStart), yStart);
  ctx.lineTo(ray(sx, xb, y0, y1), y1);
  ctx.lineTo(ray(sx, xa, y0, y1), y1);
  ctx.closePath();
}
