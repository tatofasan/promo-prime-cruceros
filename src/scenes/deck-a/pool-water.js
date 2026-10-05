// Interior de la pileta con perspectiva real: paredes (se ven más del lado lejano al centro), guarda azul en la
// línea de agua, fondo horneado (degradé de profundidad, teselas, pin de marca en mosaico), cáusticas vivas,
// sombras sobre el fondo y superficie (rayitas de luz, destellos, línea de agua).
import { makeCanvas } from '../../engine/env.js';
import { PAL, mixHex } from '../../engine/color.js';
import { hash } from '../../engine/noise.js';
import { TAU } from '../../engine/ease.js';
import { sparkle } from '../../engine/draw.js';
import { flatten, atH, onPlane, project, shadowLayers } from './util.js';
import { POOL, FLOOR_H, WATER_H, poolPath, shadowOff } from './pool-geo.js';
import { WATER, SHADE } from './pool-pal.js';
import { makeCaustics, causticPath } from './caustics.js';
import { buildRose, drawRose } from './pool-rose.js';

const M = 40; // margen alrededor del fondo
const FX = POOL.x0 - M, FY = POOL.y0 - M, FW = POOL.x1 - POOL.x0 + M * 2, FH = POOL.y1 - POOL.y0 + M * 2;

let base = null, shade = null, K1 = null, K2 = null;

function canvasW(res = 1) {
  const c = makeCanvas(Math.ceil(FW * res), Math.ceil(FH * res));
  const x = c.getContext('2d');
  x.scale(res, res);
  x.translate(-FX, -FY);
  return [c, x];
}

/** Hornea el fondo (y su capa de sombras). shadows(ctx, dh) dibuja siluetas desplazadas para la altura del fondo. */
export function bakeFloor(shadows) {
  const [bc, b] = canvasW(1);
  // profundidad: playa a la izquierda, hondo a la derecha (donde cae el tobogán)
  const g = b.createLinearGradient(POOL.x0, 0, POOL.x1, 0);
  g.addColorStop(0, WATER.shallow);
  g.addColorStop(0.45, WATER.mid);
  g.addColorStop(1, WATER.deep);
  b.fillStyle = g;
  b.fillRect(FX, FY, FW, FH);
  const v = b.createLinearGradient(0, POOL.y0, 0, POOL.y1);
  v.addColorStop(0, 'rgba(10,60,110,0.10)');
  v.addColorStop(0.5, 'rgba(10,60,110,0)');
  v.addColorStop(1, 'rgba(255,255,255,0.06)');
  b.fillStyle = v;
  b.fillRect(FX, FY, FW, FH);
  // teselas: pastina clara en grilla
  b.strokeStyle = 'rgba(235,252,255,0.16)';
  b.lineWidth = 1.4;
  b.beginPath();
  for (let x = POOL.x0; x <= POOL.x1; x += 39) { b.moveTo(x, FY); b.lineTo(x, FY + FH); }
  for (let y = POOL.y0; y <= POOL.y1; y += 39) { b.moveTo(FX, y); b.lineTo(FX + FW, y); }
  b.stroke();
  // franjas oscuras de profundidad (escalón de la playa)
  b.fillStyle = 'rgba(18,90,140,0.16)';
  b.fillRect(POOL.x0 + 470, POOL.y0, 14, POOL.y1 - POOL.y0);
  b.fillStyle = 'rgba(255,255,255,0.10)';
  b.fillRect(POOL.x0 + 484, POOL.y0, 3, POOL.y1 - POOL.y0);

  // capa de sombras: la pared del lado del sol tapa una franja del fondo + lo estático (sombrillas, tobogán)
  const [ox, oy] = shadowOff(0, FLOOR_H);
  const L = shadowLayers(Math.ceil(FW), Math.ceil(FH), FX, FY, (soft, sharp) => {
    const band = poolPath(4);
    band.rect(FX - 50, FY - 50, FW + 100, FH + 100);
    sharp.save();
    sharp.translate(ox, oy);
    sharp.fill(band, 'evenodd');
    sharp.restore();
    if (shadows) shadows(soft, sharp, FLOOR_H);
  }, SHADE);
  const [sc2, s] = canvasW(1);
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.drawImage(L.soft, 0, 0);
  s.drawImage(L.sharp, 0, 0);
  s.globalCompositeOperation = 'destination-in';
  s.translate(-FX, -FY);
  s.fillStyle = '#000';
  s.fill(poolPath(4));
  s.globalCompositeOperation = 'source-over';
  shade = flatten(sc2);
  // la sombra y el volumen del agua van horneados en el fondo (una pasada menos por cuadro)
  b.save();
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalAlpha = 0.34;
  b.drawImage(shade, 0, 0);
  b.restore();
  const vt = b.createLinearGradient(POOL.x0, 0, POOL.x1, 0);
  vt.addColorStop(0, 'rgba(60,200,230,0.05)');
  vt.addColorStop(1, 'rgba(12,110,170,0.16)');
  b.fillStyle = vt;
  b.fillRect(FX, FY, FW, FH);
  base = flatten(bc);
  buildRose();
  K1 = makeCaustics({ x0: POOL.x0, y0: POOL.y0, x1: POOL.x1, y1: POOL.y1, step: 66, seed: 11 });
  K2 = makeCaustics({ x0: POOL.x0, y0: POOL.y0, x1: POOL.x1, y1: POOL.y1, step: 118, seed: 23, jitter: 0.5 });
}

// pequeñas rayas de luz que flotan en la superficie (viento suave)
const DASH = [];
for (let i = 0; i < 70; i++) {
  DASH.push({
    x: POOL.x0 + hash(i, 1) * (POOL.x1 - POOL.x0), y: POOL.y0 + hash(i, 2) * (POOL.y1 - POOL.y0),
    len: 16 + hash(i, 3) * 40, ph: hash(i, 4) * TAU, hz: 0.5 + hash(i, 5) * 1.2, a: 0.25 + hash(i, 6) * 0.4, curl: hash(i, 7) - 0.5,
  });
}

/**
 * Dibuja el interior. o.under(ctx) = sombras dinámicas y partes sumergidas (plano del fondo ya puesto por cada uno),
 * o.surface(ctx) = cosas en la superficie (ondas, estelas). pulse 0..1 = latido de la luz en el beat.
 */
export function drawPool(ctx, C, t, o = {}) {
  const m0 = ctx.getTransform();
  ctx.save();
  atH(ctx, C, 0);
  const open = poolPath(0);
  ctx.clip(open);
  // pared (oscura del lado contrario al sol) y guarda azul en la línea de agua
  {
    const g = ctx.createLinearGradient(POOL.x1, POOL.y0, POOL.x0, POOL.y1);
    g.addColorStop(0, mixHex(WATER.wallLo, PAL.ocean600, 0.5));
    g.addColorStop(1, WATER.wall);
    ctx.fillStyle = g;
    ctx.fill(open);
    ctx.strokeStyle = WATER.band;
    ctx.lineWidth = 9;
    ctx.stroke(open);
  }
  ctx.setTransform(m0);
  // fondo (con sombras y volumen horneados) + cáusticas
  onPlane(ctx, C, FLOOR_H, (c) => {
    c.drawImage(base, FX, FY, FW, FH);
    drawRose(c); // vector: nítida con cualquier zoom
  });
  caustics(ctx, C, t, o.pulse ?? 0);
  if (o.under) o.under(ctx);
  onPlane(ctx, C, WATER_H, (c) => {
    // rayitas de luz en la superficie
    c.lineCap = 'round';
    for (const d of DASH) {
      const a = d.a * (0.45 + 0.55 * Math.sin(t * d.hz * TAU + d.ph));
      if (a < 0.06) continue;
      const x = POOL.x0 + ((d.x - POOL.x0 + t * 22) % (POOL.x1 - POOL.x0)), y = d.y + Math.sin(t * 0.9 + d.ph) * 4;
      c.strokeStyle = `rgba(240,253,255,${a})`;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(x - d.len / 2, y);
      c.quadraticCurveTo(x, y + d.curl * 10, x + d.len / 2, y - d.curl * 3);
      c.stroke();
    }
    // línea de agua contra la pared
    c.strokeStyle = 'rgba(240,253,255,0.5)';
    c.lineWidth = 2.4;
    c.stroke(poolPath(-1.5));
  });
  if (o.surface) o.surface(ctx);
  ctx.restore();
}

// cáusticas a media resolución (se ven a través del agua: el borde apenas blando queda bien y cuesta 1/4)
let half = null;
function caustics(ctx, C, t, pulse) {
  half ??= makeCanvas(960, 540);
  const h = half.getContext('2d');
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.clearRect(0, 0, 960, 540);
  ctx.save();
  atH(ctx, C, FLOOR_H);
  const m = ctx.getTransform();
  ctx.restore();
  h.setTransform(m.a * 0.5, m.b * 0.5, m.c * 0.5, m.d * 0.5, m.e * 0.5, m.f * 0.5);
  h.fillStyle = `rgba(200,248,255,${0.32 + 0.1 * pulse})`;
  h.fill(causticPath(K2, t, { amp: 0.2, speed: 0.55, gap: 0.05, gapVar: 0.035, seed: 7, sx: 9 }), 'evenodd');
  h.fillStyle = `rgba(235,253,255,${0.78 + 0.12 * pulse})`;
  h.fill(causticPath(K1, t, { amp: 0.26, speed: 0.95, gap: 0.075, gapVar: 0.06, seed: 3, sx: 14, sy: 4 }), 'evenodd');
  // donde hay sombra no hay cáusticas
  h.globalCompositeOperation = 'destination-out';
  h.globalAlpha = 0.75;
  h.drawImage(shade, FX, FY, FW, FH);
  h.globalAlpha = 1;
  h.globalCompositeOperation = 'source-over';
  // solo el rectángulo de la pileta en pantalla
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [wx, wy] of [[POOL.x0, POOL.y0], [POOL.x1, POOL.y0], [POOL.x0, POOL.y1], [POOL.x1, POOL.y1]]) {
    const X = m.a * wx + m.c * wy + m.e, Y = m.b * wx + m.d * wy + m.f;
    x0 = Math.min(x0, X); y0 = Math.min(y0, Y); x1 = Math.max(x1, X); y1 = Math.max(y1, Y);
  }
  x0 = Math.max(0, Math.floor(x0 / 2) * 2); y0 = Math.max(0, Math.floor(y0 / 2) * 2);
  x1 = Math.min(1920, Math.ceil(x1 / 2) * 2); y1 = Math.min(1080, Math.ceil(y1 / 2) * 2);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.62;
  ctx.drawImage(half, x0 / 2, y0 / 2, (x1 - x0) / 2, (y1 - y0) / 2, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

/** Destellos de sol sobre el agua (titilan; los del beat brillan más). */
export function waterGlints(ctx, C, t, pulse = 0, sweep = null) {
  for (let i = 0; i < 34; i++) {
    const wx = POOL.x0 + 40 + hash(i, 41) * (POOL.x1 - POOL.x0 - 80), wy = POOL.y0 + 30 + hash(i, 42) * (POOL.y1 - POOL.y0 - 60);
    const s = Math.sin(t * (1.4 + hash(i, 43) * 2.4) * TAU + hash(i, 44) * TAU);
    let k = Math.pow(Math.max(0, s), 5);
    if (sweep) k = Math.max(k, sweep(wx, wy));
    if (k < 0.05) continue;
    const [x, y, kk] = project(C, wx + Math.sin(t + i) * 6, wy, WATER_H);
    sparkle(ctx, x, y, (7 + 9 * hash(i, 45)) * kk * k * (1 + 0.35 * pulse), { alpha: Math.min(1, k * 1.1), color: '#FFFFFF', rot: 0.2, halo: 0.5 });
  }
}
