// Fondo de pantalla del monitor: una playa tropical (la única ventana a «otra vida»). Se hornea en color y
// en grises; la palmera, el brillo del mar y la espuma van en vivo.
import { PAL, mixHex, rgba } from '../../engine/color.js';
import { lin, rad, fill, rrectPath, circlePath, ellipsePath, polyPath, smoothPath } from '../../engine/draw.js';
import { hash } from '../../engine/noise.js';
import { sparkle } from '../../engine/draw.js';

export const SAND = mixHex(PAL.goldPale, PAL.peach, 0.25);
export const LEAF = '#2F9C7A';
export const LEAF_DK = '#1E6E5A';
const TRUNK = '#9A6A47';

/** Horizonte y orilla (fracción del alto). */
export const HZ = 0.5, SHORE = 0.75;

export function paintBeach(g, w, h) {
  // cielo
  fill(g, rrectPath(0, 0, w, h * HZ + 2, 0), lin(g, 0, 0, 0, h * HZ, [PAL.ocean500, PAL.ocean400, PAL.aqua200, mixHex(PAL.aqua100, PAL.goldPale, 0.3)]));
  // sol con halo
  const sx = w * 0.8, sy = h * 0.2;
  fill(g, rrectPath(0, 0, w, h * HZ, 0), rad(g, sx, sy, w * 0.45, [[0, rgba(PAL.goldPale, 0.8)], [0.25, rgba(PAL.goldLight, 0.25)], [1, rgba(PAL.goldLight, 0)]]));
  fill(g, circlePath(sx, sy, 17), PAL.warmWhite);
  // nubes con panza celeste
  for (const [cx, cy, s] of [[w * 0.2, h * 0.16, 1], [w * 0.52, h * 0.3, 0.7]]) {
    for (const [dx, dy, r] of [[0, 0, 16], [-18, 6, 11], [18, 5, 12], [6, -8, 12]]) fill(g, circlePath(cx + dx * s * 1.6, cy + dy * s * 1.6, r * s * 1.6), PAL.white);
    fill(g, ellipsePath(cx, cy + 12 * s * 1.6, 34 * s * 1.6, 6 * s * 1.6), rgba(PAL.aqua200, 0.8));
  }
  // isla lejana con palmeritas
  const iy = h * HZ;
  fill(g, ellipsePath(w * 0.16, iy + 2, 62, 13), mixHex(LEAF_DK, PAL.ocean500, 0.35));
  fill(g, ellipsePath(w * 0.15, iy - 1, 40, 8), mixHex(LEAF, PAL.ocean400, 0.3));
  for (const px of [w * 0.12, w * 0.18]) {
    g.strokeStyle = mixHex(TRUNK, PAL.ocean500, 0.4); g.lineWidth = 2;
    g.beginPath(); g.moveTo(px, iy - 4); g.quadraticCurveTo(px + 3, iy - 18, px + 1, iy - 26); g.stroke();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.6;
      fill(g, ellipsePath(px + 1 + Math.cos(a) * 8, iy - 26 + Math.sin(a) * 5 + 3, 9, 2.5, a), mixHex(LEAF, PAL.ocean400, 0.25));
    }
  }
  // mar en bandas (más claro hacia la orilla)
  const bands = [[HZ, PAL.ocean600], [HZ + 0.05, PAL.ocean500], [HZ + 0.11, PAL.ocean400], [HZ + 0.18, PAL.aqua300]];
  bands.forEach(([y0, col], i) => {
    const y1 = i < bands.length - 1 ? bands[i + 1][0] : SHORE + 0.02;
    fill(g, rrectPath(0, h * y0, w, h * (y1 - y0) + 1, 0), col);
  });
  // líneas de oleaje
  g.strokeStyle = rgba(PAL.white, 0.45); g.lineWidth = 1.4; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const yy = h * (HZ + 0.03 + hash(i, 4) * 0.2), xx = hash(i, 5) * w, len = 14 + hash(i, 6) * 30;
    g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + len, yy); g.stroke();
  }
  // arena con orilla curva, arena mojada y sombra de palmera
  const shore = [];
  for (let i = 0; i <= 10; i++) shore.push([(i / 10) * w, h * SHORE + Math.sin(i * 1.3) * 6]);
  const sand = smoothPath(shore);
  sand.lineTo(w, h); sand.lineTo(0, h); sand.closePath();
  fill(g, sand, lin(g, 0, h * SHORE, 0, h, [mixHex(SAND, '#C9A06A', 0.35), SAND, mixHex(SAND, PAL.white, 0.25)]));
  fill(g, ellipsePath(w * 0.86, h * 0.9, 60, 8, -0.1), rgba('#8A6A45', 0.25));
  // sombrilla coral y toallón (acentos cálidos)
  const ux = w * 0.6, uy = h * 0.82;
  g.strokeStyle = PAL.warmWhite; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(ux, uy + 30); g.lineTo(ux + 4, uy - 6); g.stroke();
  const um = new Path2D();
  um.moveTo(ux - 34, uy); um.quadraticCurveTo(ux + 2, uy - 30, ux + 40, uy - 4); um.closePath();
  fill(g, um, PAL.coral);
  for (const k of [-0.5, 0.15]) fill(g, polyPath([[ux + 2, uy - 16], [ux + 34 * k - 6, uy], [ux + 34 * k + 8, uy - 1]]), PAL.warmWhite);
  fill(g, ellipsePath(ux + 8, uy + 32, 30, 4), rgba('#8A6A45', 0.3));
  fill(g, rrectPath(ux - 46, uy + 22, 40, 12, 2), PAL.gold);
  fill(g, rrectPath(ux - 46, uy + 26, 40, 3, 1), PAL.warmWhite);
}

/** Barra de tareas (encima del fondo, debajo de las ventanas). */
export function paintTaskbar(g, w, h) {
  fill(g, rrectPath(0, h - 16, w, 16, 0), rgba(PAL.ink, 0.72));
  fill(g, circlePath(12, h - 8, 5), rgba(PAL.aqua200, 0.85));
  const cols = [PAL.ocean400, PAL.grey300, PAL.gold, PAL.grey400, PAL.aqua300];
  cols.forEach((c, i) => fill(g, rrectPath(28 + i * 18, h - 13, 12, 10, 2.5), c));
  g.fillStyle = rgba(PAL.white, 0.6);
  g.fillRect(w - 40, h - 10, 28, 3);
}

/** Palmera que se hamaca (sat: 0 grises → 1 color pleno). */
export function drawPalm(ctx, t, w, h, sat, gust = 0) {
  const bx = w * 0.88, by = h * 0.93;
  const sway = Math.sin(t * 2.1) * 0.05 + gust * Math.sin(t * 17) * 0.12;
  const tc = mixHex(mixHex(TRUNK, PAL.grey500, 0.7), TRUNK, sat);
  const lc = mixHex(mixHex(LEAF, PAL.grey500, 0.75), LEAF, sat);
  const ld = mixHex(mixHex(LEAF_DK, PAL.grey600, 0.75), LEAF_DK, sat);
  // tronco curvo con anillos
  const tx = bx - 46 + sway * 60, ty = by - 150;
  ctx.strokeStyle = tc; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 4, by - 90, tx, ty); ctx.stroke();
  ctx.strokeStyle = rgba(PAL.ink, 0.25); ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const p = i / 8, x = (1 - p) * (1 - p) * bx + 2 * p * (1 - p) * (bx + 4) + p * p * tx;
    const y = (1 - p) * (1 - p) * by + 2 * p * (1 - p) * (by - 90) + p * p * ty;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y + 1.5); ctx.stroke();
  }
  // hojas (pinnas) en dos tonos
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI + (k / 6) * Math.PI + sway * (1.5 + k * 0.2) + 0.08 * Math.sin(t * 3 + k);
    const len = 58 + (k % 2) * 12;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    const leaf = new Path2D();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(len * 0.5, -16, len, 8 + Math.abs(Math.cos(a)) * 10);
    leaf.quadraticCurveTo(len * 0.5, 2, 0, 0);
    fill(ctx, leaf, k % 2 ? ld : lc);
    ctx.restore();
  }
  fill(ctx, circlePath(tx, ty + 3, 5), mixHex(tc, PAL.ink, 0.3));
}

/** Destellos y espuma de la orilla en vivo. */
export function drawBeachLife(ctx, t, w, h, sat, speed = 1) {
  if (sat > 0.05) {
    for (let i = 0; i < 7; i++) {
      const ph = (t * (0.9 + hash(i, 3)) * speed + hash(i, 1)) % 1;
      const a = Math.sin(ph * Math.PI);
      sparkle(ctx, hash(i, 7) * w, h * (HZ + 0.03 + hash(i, 8) * 0.2), 4 + 5 * a, { alpha: a * sat, rot: 0.2 });
    }
  }
  // espuma que avanza y retrocede
  const k = Math.sin(t * 2.4 * speed) * 0.5 + 0.5;
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push([(i / 12) * w, h * (SHORE - 0.012 + 0.02 * k) + Math.sin(i * 1.3) * 6 + Math.sin(i * 3.1 + t * 4) * 1.5]);
  ctx.strokeStyle = rgba(PAL.white, 0.55 + 0.35 * sat);
  ctx.lineWidth = 3;
  ctx.stroke(smoothPath(pts));
}
