// SIN USO desde la ronda de correcciones: la losa de agua de borde recto se sacó (el agua del reventón es el domo
// de burst.js, con su cortina y charquitos). Se deja como referencia; hook-office.js ya no la importa.
// Lengua de agua que corre por el escritorio hacia la izquierda después del estallido (plano D.desk):
// frente redondo que se enrula con espuma de encaje y spray, cuerpo translúcido en capas con crestas, y una
// cortina que cae por el canto con borde ondulado. Al pasar, salpica contra la taza, el teléfono y el lapicero.
import { PAL, rgba } from '../../engine/color.js';
import { lin, fill, circlePath, ellipsePath, smoothPath } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { DESK, MON, T } from './layout.js';
import { drawLace } from './foam.js';

const X1 = 2140;
const A = 1700, B = 1900; // frente: x = x0 − (A·u + B·u²)
const X0 = MON.x + 60;
// objetos del escritorio contra los que choca el agua: [x, alto de la salpicadura]
const HITS = [[1052, 70], [700, 50], [476, 56], [300, 36]];

/** x del frente en t (acelera: el agua viene empujada). */
export function floodFront(t) {
  const u = t - T.surge - 0.05;
  return u <= 0 ? null : X0 - (A * u + B * u * u);
}
function hitTime(x) {
  const d = X0 - x;
  if (d <= 0) return null;
  return T.surge + 0.05 + (-A + Math.sqrt(A * A + 4 * B * d)) / (2 * B);
}

export function drawFlood(ctx, t) {
  const xf = floodFront(t);
  if (xf === null) return;
  const h = (x) => {
    const d = x - xf;
    return 18 + 54 * Math.exp(-(((d - 70) / 90) ** 2)) + 10 * Math.max(0, Math.sin(x * 0.02 + t * 15)) + 4 * Math.sin(x * 0.07 - t * 11);
  };
  const top = (x) => DESK.back - h(x);
  const surf = [];
  for (let x = xf + 40; x <= X1; x += 28) surf.push([x, top(x)]);
  // cortina que cae por el canto (detrás del cuerpo): borde de abajo ondulado
  const lipX = xf + 70;
  if (lipX < X1) {
    const bot = (x) => DESK.front + Math.min(150, (x - lipX) * 0.9) + 26 * Math.sin(x * 0.018 + t * 7) + 14 * Math.sin(x * 0.051 - t * 5);
    const pts = [[lipX, DESK.front - 4]];
    for (let x = lipX + 30; x <= X1; x += 30) pts.push([x, bot(x)]);
    const cur = smoothPath(pts);
    cur.lineTo(X1, DESK.front - 4);
    cur.closePath();
    fill(ctx, cur, lin(ctx, 0, DESK.front, 0, DESK.front + 170, [rgba(PAL.ocean400, 0.95), rgba(PAL.ocean500, 0.88), rgba(PAL.aqua300, 0.8)]));
    ctx.save();
    ctx.clip(cur);
    ctx.fillStyle = rgba(PAL.aqua100, 0.35);
    for (let i = 0; i < 40; i++) {
      const x = lipX + hash(i, 81) * (X1 - lipX);
      const y = DESK.front + ((hash(i, 82) * 180 + t * 900) % 180);
      ctx.fillRect(x, y, 2.5, 18 + hash(i, 83) * 34);
    }
    ctx.restore();
    // gotas que se desprenden del borde de abajo
    for (let i = 0; i < 18; i++) {
      const x = lipX + 40 + hash(i, 84) * (X1 - lipX - 40);
      const ph = (t * 2.4 + hash(i, 85)) % 1;
      fill(ctx, circlePath(x, bot(x) + 10 + ph * 90, (3 + hash(i, 86) * 4) * (1 - ph * 0.5)), rgba(PAL.aqua200, 0.9 * (1 - ph)));
    }
  }
  // cuerpo: fondo translúcido y franja clara de superficie (la vemos un poco desde arriba)
  const body = new Path2D();
  body.moveTo(xf + 18, DESK.front + 2);
  body.bezierCurveTo(xf - 42, DESK.front - 40, xf - 50, top(xf + 40) - 12, xf + 40, top(xf + 40));
  for (const [x, y] of surf) body.lineTo(x, y);
  body.lineTo(X1, DESK.front + 2);
  body.closePath();
  fill(ctx, body, lin(ctx, 0, DESK.back - 80, 0, DESK.front, [rgba(PAL.aqua300, 0.95), rgba(PAL.ocean400, 0.82), rgba(PAL.ocean500, 0.9)]));
  ctx.save();
  ctx.clip(body);
  const band = new Path2D();
  band.moveTo(xf - 60, DESK.back + 40);
  for (const [x, y] of surf) band.lineTo(x, y + 30 + 6 * Math.sin(x * 0.04 + t * 9));
  band.lineTo(X1, DESK.back - 100);
  band.lineTo(xf - 60, DESK.back - 100);
  band.closePath();
  fill(ctx, band, lin(ctx, 0, DESK.back - 80, 0, DESK.back + 40, [rgba(PAL.aqua100, 0.85), rgba(PAL.aqua200, 0.5)]));
  // reflejos alargados que viajan
  ctx.fillStyle = rgba(PAL.white, 0.5);
  for (let i = 0; i < 22; i++) {
    const x = xf + 120 + ((hash(i, 1) * 1900 + t * 340) % 1900);
    const y = DESK.back + 40 + hash(i, 2) * (DESK.front - DESK.back - 50);
    ctx.fillRect(x, y, 24 + hash(i, 3) * 50, 2.2);
  }
  ctx.restore();
  // borde de superficie con brillo
  ctx.strokeStyle = rgba(PAL.white, 0.9);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  surf.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  // crestas con gorro de espuma que viajan
  for (let k = 0; k < 7; k++) {
    const xc = xf + 230 + k * 240 - ((t * 280) % 240);
    if (xc > X1 - 20) continue;
    const yc = top(xc);
    for (let i = 0; i < 6; i++) {
      if (hash(k, i, 4) < 0.25) continue;
      const r = 4 + hash(k, i, 1) * 8;
      fill(ctx, circlePath(xc - 26 + i * 10 + hash(k, i, 2) * 6, yc + 1 + hash(k, i, 3) * 6, r), rgba(PAL.foam, 0.92));
    }
  }
  // frente: espuma de encaje sobre la nariz (cinta irregular, de abajo hacia arriba: crece hacia el cuerpo)
  const nose = [];
  for (let i = 0; i <= 16; i++) {
    const p = 1 - i / 16;
    const y = top(xf + 40) + p * (DESK.front - top(xf + 40));
    nose.push([xf + 14 - 36 * Math.sin(p * Math.PI) + 4 * Math.sin(i * 1.7 + t * 25), y]);
  }
  for (let x = xf + 52; x < xf + 420 && x < X1; x += 24) nose.push([x, top(x) + 1]);
  drawLace(ctx, nose, { width: 13, seed: 7, t, amt: 0.9, hole: PAL.ocean400 });
  for (let i = 0; i < 24; i++) {
    const ph = (t * 3 + hash(i, 95)) % 1;
    const x = xf - 20 - ph * (60 + hash(i, 96) * 130);
    const y = top(xf + 40) + 20 - ph * (80 + hash(i, 97) * 100) + ph * ph * 150;
    const r = (2 + hash(i, 98) * 6) * (1 - ph * 0.5);
    fill(ctx, circlePath(x, y, r), rgba(PAL.aqua100, 0.9 * (1 - ph)));
  }
  // salpicaduras donde el frente choca con lo que hay en el escritorio
  for (const [ox, oh] of HITS) {
    const th = hitTime(ox);
    if (th === null || t < th || t > th + 0.4) continue;
    const q = (t - th) / 0.4;
    fill(ctx, ellipsePath(ox, DESK.back - oh * 0.5, 60 * (0.4 + q), 30 * (1 - q * 0.6)), rgba(PAL.foam, 0.85 * (1 - q)));
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * (0.12 + 0.76 * hash(ox, i, 1));
      const sp = 300 + hash(ox, i, 2) * 480;
      const x = ox + Math.cos(a) * sp * q * 0.5 - 140 * q;
      const y = DESK.back - oh + Math.sin(a) * sp * q * 0.5 + 500 * q * q;
      const r = (3 + hash(ox, i, 3) * 8) * (1 - q * 0.5);
      fill(ctx, circlePath(x, y, r), rgba(PAL.aqua100, 0.95 * (1 - q)));
    }
  }
}
