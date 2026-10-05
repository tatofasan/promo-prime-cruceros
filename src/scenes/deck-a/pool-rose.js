// Rosa de los vientos en venecitas en el fondo de la pileta (náutica, se descubre debajo de las cáusticas).
// Vector puro dibujado en el plano del fondo en cada cuadro: queda nítida con cualquier zoom de la cámara
// (antes era un mosaico de 12 px horneado y escalado, que se leía como pixelado). Colores ya mezclados con el
// agua (se ve a través de ella) y pastina fina encima para que se lea como mosaico incrustado.
import { PAL, mixHex } from '../../engine/color.js';
import { TAU } from '../../engine/ease.js';
import { POOL } from './pool-geo.js';
import { WATER } from './pool-pal.js';

export const ROSE = { x: 560, y: 470, r: 132 };

let P = null;

// tono del agua sobre la rosa (degradé del fondo en x ≈ 560: entre la playa y el medio)
const WAT = mixHex(WATER.shallow, WATER.mid, 0.47);
const tint = (hex, k) => mixHex(hex, WAT, k);

function poly(pts) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
function ring(r0, r1) {
  const p = new Path2D();
  p.moveTo(r1, 0); p.arc(0, 0, r1, 0, TAU);
  p.moveTo(r0, 0); p.arc(0, 0, r0, 0, TAU, true);
  return p;
}
/** Una punta de la estrella partida en dos facetas (luz / sombra): [faceta izq, faceta der]. */
function point(a, len, half) {
  const tip = [Math.cos(a) * len, Math.sin(a) * len];
  const l = [Math.cos(a - Math.PI / 2) * half, Math.sin(a - Math.PI / 2) * half];
  const r = [Math.cos(a + Math.PI / 2) * half, Math.sin(a + Math.PI / 2) * half];
  return [poly([[0, 0], l, tip]), poly([[0, 0], tip, r])];
}
/** Segmentos de una grilla (paso s, origen ox/oy) recortados al círculo de radio R. */
function gridInCircle(s, ox, oy, R) {
  const p = new Path2D();
  const k0x = Math.ceil((-R - ox) / s), k1x = Math.floor((R - ox) / s);
  for (let k = k0x; k <= k1x; k++) {
    const x = ox + k * s, h = Math.sqrt(Math.max(0, R * R - x * x));
    p.moveTo(x, -h); p.lineTo(x, h);
  }
  const k0y = Math.ceil((-R - oy) / s), k1y = Math.floor((R - oy) / s);
  for (let k = k0y; k <= k1y; k++) {
    const y = oy + k * s, w = Math.sqrt(Math.max(0, R * R - y * y));
    p.moveTo(-w, y); p.lineTo(w, y);
  }
  return p;
}

export function buildRose() {
  if (P) return P;
  const R = ROSE.r;
  const ticks = new Path2D();
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU, big = i % 8 === 0, mid = i % 4 === 0;
    const r0 = R - (big ? 15 : mid ? 11 : 7), r1 = R - 3;
    ticks.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ticks.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
  }
  const card = [], inter = [], minor = [];
  for (let k = 0; k < 4; k++) card.push(point(-Math.PI / 2 + (k * Math.PI) / 2, R * 0.97, R * 0.15));
  for (let k = 0; k < 4; k++) inter.push(point(-Math.PI / 4 + (k * Math.PI) / 2, R * 0.66, R * 0.12));
  for (let k = 0; k < 8; k++) minor.push(point(-Math.PI / 2 + Math.PI / 8 + (k * Math.PI) / 4, R * 0.44, R * 0.06));
  // «N» geométrica por fuera del aro, arriba de la punta norte
  const N = new Path2D();
  const ny = -(R + 20), nw = 7, nh = 9;
  N.moveTo(-nw, ny + nh); N.lineTo(-nw, ny - nh); N.lineTo(nw, ny + nh); N.lineTo(nw, ny - nh);
  // pastina: la grilla del piso (39 px) sigue por encima y una más fina (13 px) arma las venecitas
  const ox = POOL.x0 - ROSE.x, oy = POOL.y0 - ROSE.y;
  P = {
    disc: (() => { const p = new Path2D(); p.arc(0, 0, R + 2, 0, TAU); return p; })(),
    band: ring(R - 16, R),
    rimIn: ring(R - 19, R - 16.5),
    rimOut: ring(R, R + 3.5),
    inner: ring(R * 0.5 - 2, R * 0.5 + 1.5),
    ticks, card, inter, minor, N,
    hub: (() => { const p = new Path2D(); p.arc(0, 0, R * 0.12, 0, TAU); return p; })(),
    hubRing: ring(R * 0.12, R * 0.155),
    dot: (() => { const p = new Path2D(); p.arc(0, 0, R * 0.045, 0, TAU); return p; })(),
    fine: gridInCircle(13, ox % 13, oy % 13, R + 2),
    coarse: gridInCircle(39, ox % 39, oy % 39, R + 2),
  };
  return P;
}

const COL = {
  base: tint(PAL.ocean400, 0.55),
  band: tint('#FFFFFF', 0.42),
  rim: tint(PAL.navy600, 0.5),
  tick: tint(PAL.navy600, 0.45),
  light: tint('#FFFFFF', 0.28),
  dark: tint(PAL.navy600, 0.42),
  light2: tint(PAL.aqua200, 0.3),
  dark2: tint(PAL.ocean600, 0.38),
  goldL: tint(PAL.goldLight, 0.3),
  gold: tint(PAL.gold, 0.32),
  goldD: tint('#C98A1E', 0.35),
};

/** Dibuja la rosa en coordenadas de mundo del plano del fondo (ctx ya puesto con onPlane a FLOOR_H). */
export function drawRose(ctx) {
  const p = buildRose();
  ctx.save();
  ctx.translate(ROSE.x, ROSE.y);
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = COL.base;
  ctx.fill(p.disc);
  ctx.fillStyle = COL.band;
  ctx.fill(p.band, 'evenodd');
  ctx.fillStyle = COL.rim;
  ctx.fill(p.rimIn, 'evenodd');
  ctx.fill(p.rimOut, 'evenodd');
  ctx.fill(p.inner, 'evenodd');
  ctx.strokeStyle = COL.tick;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.stroke(p.ticks);
  // puntas: menores (oro) → intercardinales (aqua / océano) → cardinales (blanco / navy)
  for (const [a, b] of p.minor) { ctx.fillStyle = COL.goldL; ctx.fill(a); ctx.fillStyle = COL.goldD; ctx.fill(b); }
  for (const [a, b] of p.inter) { ctx.fillStyle = COL.light2; ctx.fill(a); ctx.fillStyle = COL.dark2; ctx.fill(b); }
  for (const [a, b] of p.card) { ctx.fillStyle = COL.light; ctx.fill(a); ctx.fillStyle = COL.dark; ctx.fill(b); }
  ctx.fillStyle = COL.rim;
  ctx.fill(p.hubRing, 'evenodd');
  ctx.fillStyle = COL.gold;
  ctx.fill(p.hub);
  ctx.fillStyle = COL.light;
  ctx.fill(p.dot);
  ctx.strokeStyle = COL.dark;
  ctx.lineWidth = 3.4;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.stroke(p.N);
  // pastina (venecitas) y la grilla del piso que sigue por encima
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(235,252,255,0.13)';
  ctx.lineWidth = 0.8;
  ctx.stroke(p.fine);
  ctx.strokeStyle = 'rgba(235,252,255,0.16)';
  ctx.lineWidth = 1.4;
  ctx.stroke(p.coarse);
  ctx.restore();
}
