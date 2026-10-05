// Contenido de la pantalla: fondo de playa (apagado → saturado), planilla que avanza fila a fila y parpadea
// en c1, el mar que sube dentro del monitor desde hook.leak y el vidrio que se raja justo antes de hook.surge.
import { PAL, rgba } from '../../engine/color.js';
import { lin, rad, fill, rrectPath, circlePath, polyPath } from '../../engine/draw.js';
import { E, clamp, prog, lerp, TAU } from '../../engine/ease.js';
import { BEAT } from '../../engine/time.js';
import { rng, hash } from '../../engine/noise.js';
import { bake, put, greySprite, hit } from './util.js';
import { paintBeach, paintTaskbar, drawPalm, drawBeachLife } from './beach.js';
import { MON, T } from './layout.js';

const SW = MON.w, SHt = MON.h;
const WIN = { x: 14, y: 12, w: 372, h: 236 };
const GRID = { x: 0, y: 58, rowH: 12, cols: [20, 70, 120, 170, 220, 270, 320, 372] };
let BEACH_C = null, BEACH_G = null, CHROME = null, ROWS = null, GLASS = null, CRACKS = null;

export function initScreen() {
  const beach = bake(0, 0, SW, SHt, 2, (g) => { paintBeach(g, SW, SHt); paintTaskbar(g, SW, SHt); });
  BEACH_C = beach;
  BEACH_G = greySprite(beach, { contrast: 0.62, lift: -18, tint: [0.96, 1, 1.05] });
  CHROME = bake(-14, -10, WIN.w + 30, WIN.h + 26, 2, paintChrome);
  ROWS = bake(0, 0, WIN.w, 64 * GRID.rowH, 2, paintRows);
  GLASS = bake(0, 0, SW, SHt, 1, (g) => {
    fill(g, rrectPath(0, 0, SW, SHt, 0), rad(g, SW / 2, SHt / 2, SW * 0.62, [[0.6, rgba(PAL.ink, 0)], [1, rgba(PAL.ink, 0.35)]]));
    g.save();
    g.translate(SW * 0.3, 0);
    g.rotate(0.5);
    fill(g, rrectPath(0, -200, 70, 700, 0), lin(g, 0, 0, 70, 0, [rgba(PAL.white, 0), rgba(PAL.white, 0.07), rgba(PAL.white, 0)]));
    fill(g, rrectPath(110, -200, 22, 700, 0), rgba(PAL.white, 0.04));
    g.restore();
    fill(g, rrectPath(0, 0, SW, 30, 0), lin(g, 0, 0, 0, 30, [rgba(PAL.white, 0.06), rgba(PAL.white, 0)]));
  });
  CRACKS = buildCracks();
}

function paintChrome(g) {
  const { w, h } = WIN;
  g.save();
  g.shadowColor = rgba(PAL.ink, 0.45); g.shadowBlur = 16; g.shadowOffsetY = 6;
  fill(g, rrectPath(0, 0, w, h, 5), '#EEF1F3');
  g.restore();
  fill(g, rrectPath(0, 0, w, 20, 5), '#D3D8DD');
  fill(g, rrectPath(0, 14, w, 6, 0), '#D3D8DD');
  [0, 1, 2].forEach((i) => fill(g, circlePath(10 + i * 12, 10, 3.6), ['#A5ACB3', '#B7BCC3', '#C5CACF'][i]));
  fill(g, rrectPath(w / 2 - 50, 8, 100, 4, 2), rgba('#7D858E', 0.6));
  fill(g, rrectPath(0, 20, w, 16, 0), '#E6E9EC');
  for (let i = 0; i < 12; i++) fill(g, rrectPath(8 + i * 17 + (i > 5 ? 10 : 0), 23, 11, 10, 2), ['#9AA1A9', '#B5BBC1', '#8E969E'][i % 3]);
  fill(g, rrectPath(0, 36, w, 12, 0), '#FFFFFF');
  fill(g, rrectPath(4, 38, 30, 8, 1), '#E3E6E9');
  fill(g, rrectPath(40, 41, 120, 2, 1), '#B9BFC5');
  fill(g, rrectPath(0, 48, w, 10, 0), '#DDE1E5');
  for (let c = 1; c < GRID.cols.length - 1; c++) {
    fill(g, rrectPath(GRID.cols[c], 48, 1, 10, 0), '#C3C9CF');
    fill(g, rrectPath(GRID.cols[c] + 20, 51, 8, 3, 1), '#9AA1A9');
  }
  fill(g, rrectPath(0, 57, w, 1, 0), '#B9BFC5');
}

function paintRows(g) {
  const r = rng(321);
  const { rowH, cols } = GRID;
  for (let row = 0; row < 64; row++) {
    const y = row * rowH;
    const total = row % 9 === 8;
    fill(g, rrectPath(0, y, WIN.w, rowH, 0), total ? '#E9EDEF' : '#FFFFFF');
    fill(g, rrectPath(0, y, 20, rowH, 0), '#E2E5E8');
    fill(g, rrectPath(5, y + 5, 6 + (row % 3) * 2, 2, 1), '#A3AAB1');
    for (let c = 1; c < cols.length - 1; c++) {
      const x0 = cols[c], x1 = cols[c + 1], cw = x1 - x0;
      const k = r();
      if (k < 0.07) fill(g, rrectPath(x0, y, cw, rowH, 0), '#D9E5DC');
      else if (k < 0.1) fill(g, rrectPath(x0, y, cw, rowH, 0), '#EFE8CF');
      if (r() < 0.82 || total) {
        const len = (total ? 0.6 : 0.2 + r() * 0.55) * (cw - 8);
        const right = c > 1;
        fill(g, rrectPath(right ? x1 - 4 - len : x0 + 4, y + 4.5, len, total ? 3.2 : 2.4, 1), total ? '#4E555D' : '#868E97');
      }
    }
    fill(g, rrectPath(0, y + rowH - 1, WIN.w, 1, 0), '#D5DADE');
    if (total) fill(g, rrectPath(20, y, WIN.w - 20, 1.4, 0), '#9AA1A9');
  }
  for (let c = 1; c < cols.length; c++) fill(g, rrectPath(cols[c] - 0.5, 0, 1, 64 * rowH, 0), '#D5DADE');
}

function buildCracks() {
  const r = rng(77);
  const ox = SW * 0.64, oy = SHt * 0.84;
  const segs = [];
  const branch = (x, y, a, len, d, depth) => {
    let cx = x, cy = y, dist = d;
    const n = Math.round(len / 20);
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.7;
      const l = 12 + r() * 20;
      const nx = cx + Math.cos(a) * l, ny = cy + Math.sin(a) * l;
      segs.push([cx, cy, nx, ny, dist, depth]);
      dist += l;
      if (depth < 2 && r() < 0.22) branch(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6), len * 0.4, dist, depth + 1);
      cx = nx; cy = ny;
    }
  };
  for (let i = 0; i < 9; i++) branch(ox, oy, (i / 9) * TAU + r() * 0.5, 220 + r() * 220, 0, 0);
  // anillos del impacto
  for (const rr of [14, 30]) {
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * TAU, a1 = ((i + 0.8) / 10) * TAU;
      segs.push([ox + Math.cos(a0) * rr, oy + Math.sin(a0) * rr, ox + Math.cos(a1) * rr * 1.05, oy + Math.sin(a1) * rr * 1.05, rr, 1]);
    }
  }
  return { segs, ox, oy };
}

/** Saturación del fondo de playa: apagado al principio, se enciende en hook.leak. */
export function beachSat(t) {
  if (t < T.q[0]) return 0.5 + 0.02 * t;
  if (t < T.leak) return lerp(0.54, 0.7, E.inQuad(prog(t, T.q[0], T.leak)));
  return lerp(0.7, 1, E.outCubic(prog(t, T.leak - 0.02, T.leak + 0.06)));
}

/** Brillo extra de la pantalla (latidos en c1, fogonazo en leak). */
export function screenBright(t) {
  let b = 0;
  for (const q of T.q) b = Math.max(b, 0.16 * hit(t, q, 0.12));
  if (t >= T.leak) b = Math.max(b, 0.05 + 0.35 * hit(t, T.leak, 0.18));
  return b;
}

/**
 * Nivel del mar dentro del monitor (fracción del alto desde arriba). Hasta el reventón solo inunda la arena (el
 * cielo, el sol y la palmera se siguen leyendo: la playa se reconoce hasta ~3,40); después termina de llenarse
 * detrás del domo de agua.
 */
export function waterLevel(t) {
  const a = lerp(0.8, 0.6, E.inOutCubic(prog(t, T.leak + 0.05, T.surge)));
  return lerp(a, 0.02, E.inQuad(prog(t, T.surge + 0.12, T.surge + 0.3)));
}

function rowsScroll(t) {
  const n = Math.floor(t / BEAT);
  let rows = Math.min(n, 4) + E.outCubic(clamp((t - n * BEAT) / 0.12)) * (n < 4 ? 1 : 0);
  if (t > T.q[0]) {
    const e = BEAT / 2, u = t - T.q[0];
    const m = Math.floor(u / e);
    rows += 2 * m + 2 * E.outCubic(clamp((u - m * e) / 0.08));
  }
  return rows * GRID.rowH;
}

function flicker(t) {
  if (t < T.q[0] || t > T.leak + 0.05) return 0;
  const e = BEAT / 2;
  const u = t - T.q[0];
  const m = Math.floor(u / e);
  const strong = m % 2 === 0;
  return (strong ? 0.6 : 0.28) * hit(u, m * e, 0.05);
}

/** Pantalla completa en coordenadas del plano escritorio (clip al vidrio). */
export function drawScreen(ctx, t) {
  const sat = beachSat(t);
  const { x: X, y: Y } = MON;
  ctx.save();
  ctx.beginPath();
  ctx.rect(X, Y, SW, SHt);
  ctx.clip();
  ctx.translate(X, Y);
  // presión antes del estallido: el contenido se hincha
  const bulge = 1 + 0.03 * E.inQuad(prog(t, T.surge - 0.08, T.surge));
  if (bulge > 1) { ctx.translate(SW / 2, SHt / 2); ctx.scale(bulge, bulge); ctx.translate(-SW / 2, -SHt / 2); }
  // fondo: grises + color encima según la saturación
  put(ctx, BEACH_G);
  ctx.globalAlpha = sat;
  put(ctx, BEACH_C);
  ctx.globalAlpha = 1;
  drawBeachLife(ctx, t, SW, SHt, sat, t > T.leak ? 2.4 : 1);
  drawPalm(ctx, t, SW, SHt, sat, t > T.leak ? clamp((t - T.leak) / 0.2) : 0);
  // planilla (se la lleva el agua en leak)
  drawSheet(ctx, t);
  // el mar sube dentro del monitor
  if (t > T.leak) drawRisingSea(ctx, t);
  // fogonazo / brillo de pantalla
  const b = screenBright(t);
  if (b > 0.005) {
    ctx.globalCompositeOperation = 'screen';
    fill(ctx, rrectPath(0, 0, SW, SHt, 0), rad(ctx, SW * 0.8, SHt * 0.2, SW, [[0, rgba(PAL.goldPale, b * 1.4)], [0.5, rgba(PAL.aqua200, b * 0.8)], [1, rgba(PAL.aqua200, b * 0.3)]]));
    ctx.globalCompositeOperation = 'source-over';
  }
  put(ctx, GLASS);
  drawCracks(ctx, t);
  ctx.restore();
}

function drawSheet(ctx, t) {
  const p = prog(t, T.leak - 0.03, T.leak + 0.12);
  if (p >= 1) return;
  const f = flicker(t);
  ctx.save();
  ctx.translate(WIN.x, WIN.y);
  if (p > 0) {
    // la ola de la pantalla la arrastra hacia abajo, girando
    ctx.translate(WIN.w / 2, WIN.h / 2);
    ctx.translate(-30 * E.inCubic(p), 300 * E.inBack(p));
    ctx.rotate(-0.35 * E.inCubic(p));
    ctx.translate(-WIN.w / 2, -WIN.h / 2);
    ctx.globalAlpha = 1 - p * p;
  }
  put(ctx, CHROME);
  // filas que avanzan (clip a la grilla)
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, GRID.y, WIN.w, WIN.h - GRID.y - 4);
  ctx.clip();
  const off = rowsScroll(t);
  const glitch = f > 0.35 ? (hash(Math.floor(t * 60), 3) - 0.5) * 18 : 0;
  ctx.drawImage(ROWS.c, 0, 0, ROWS.c.width, ROWS.c.height, glitch * 0.3, GRID.y - off, ROWS.w, ROWS.h);
  // cursor de celda que salta en cada corchea (en c1, en cada semicorchea)
  const step = t < T.q[0] ? BEAT / 2 : BEAT / 4;
  const n = Math.floor(t / step);
  const col = 1 + ((n * 3) % 6), row = 2 + ((n * 5) % 11);
  ctx.strokeStyle = '#4F7A5E';
  ctx.lineWidth = 2;
  ctx.strokeRect(GRID.cols[col], GRID.y + row * GRID.rowH - (off % GRID.rowH), GRID.cols[col + 1] - GRID.cols[col], GRID.rowH);
  if (glitch) {
    // franja corrida (parpadeo con glitch)
    const gy = GRID.y + 20 + hash(Math.floor(t * 60), 9) * 120;
    ctx.drawImage(ROWS.c, 0, (gy - GRID.y + off) * ROWS.s, ROWS.c.width, 18 * ROWS.s, glitch, gy, ROWS.w, 18);
  }
  ctx.restore();
  if (f > 0.002) fill(ctx, rrectPath(0, 0, WIN.w, WIN.h, 5), rgba(PAL.white, f * 0.7));
  ctx.restore();
}

function drawRisingSea(ctx, t) {
  const lvl = waterLevel(t) * SHt;
  const u = t - T.leak;
  const A = 3 + 9 * clamp(u / 0.2);
  const surf = (x) => lvl + A * Math.sin(x * 0.045 + t * 13) + A * 0.55 * Math.sin(x * 0.11 - t * 9);
  const p = new Path2D();
  p.moveTo(0, SHt + 2);
  for (let x = 0; x <= SW; x += 12) p.lineTo(x, surf(x));
  p.lineTo(SW, SHt + 2);
  p.closePath();
  fill(ctx, p, lin(ctx, 0, lvl - 10, 0, SHt, [rgba(PAL.aqua300, 0.95), rgba(PAL.ocean400, 0.96), rgba(PAL.ocean600, 0.98), rgba(PAL.ocean700, 0.98)]));
  // rayos de luz bajo el agua
  ctx.save();
  ctx.clip(p);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.3) * SW / 4 + Math.sin(t * 2 + i) * 20;
    fill(ctx, polyPath([[x, lvl], [x + 26, lvl], [x + 90, SHt], [x + 30, SHt]]), rgba(PAL.aqua100, 0.12));
  }
  // burbujas
  for (let i = 0; i < 22; i++) {
    const sp = 120 + hash(i, 1) * 160;
    const span = SHt - lvl + 20;
    const y = SHt - ((u * sp + hash(i, 2) * span) % span);
    const x = hash(i, 3) * SW + Math.sin(u * 8 + i) * 4;
    const r = 1.5 + hash(i, 4) * 3.5;
    ctx.strokeStyle = rgba(PAL.white, 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  // línea de superficie con filo de luz
  const s = new Path2D();
  for (let x = 0; x <= SW; x += 12) (x ? s.lineTo(x, surf(x)) : s.moveTo(x, surf(x)));
  ctx.strokeStyle = rgba(PAL.white, 0.9);
  ctx.lineWidth = 2.5;
  ctx.stroke(s);
}

function drawCracks(ctx, t) {
  const q = E.outQuad(prog(t, T.surge - 0.14, T.surge));
  if (q <= 0 || t >= T.surge) return;
  const maxD = 420 * q;
  ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.beginPath();
    for (const [x0, y0, x1, y1, d, depth] of CRACKS.segs) {
      if (d > maxD) continue;
      ctx.moveTo(x0 + pass * 1.2, y0 + pass * 1.2);
      ctx.lineTo(x1 + pass * 1.2, y1 + pass * 1.2);
    }
    ctx.strokeStyle = pass ? rgba(PAL.ink, 0.35) : rgba(PAL.white, 0.9);
    ctx.lineWidth = pass ? 1.4 : 1.8;
    ctx.stroke();
  }
  // destello en el punto de impacto
  fill(ctx, circlePath(CRACKS.ox, CRACKS.oy, 10 + 20 * q), rad(ctx, CRACKS.ox, CRACKS.oy, 10 + 20 * q, [[0, rgba(PAL.white, 0.8)], [1, rgba(PAL.white, 0)]]));
}

/** Punto de impacto de las rajaduras en el plano escritorio (de ahí revienta el agua). */
export const crackOrigin = () => [MON.x + SW * 0.64, MON.y + SHt * 0.84];
