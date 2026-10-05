// Trópico: palmeras con tronco curvo anillado y hojas plumosas que se balancean (acción secundaria en las
// puntas), e islas con arena, morro verde, palmeras, agua turquesa de bajío y espuma que respira.
// Los verdes y marrones son los únicos tonos fuera de PAL: se derivan acá (teal-verde que armoniza con el mar).
import { TAU } from '../engine/ease.js';
import { hash } from '../engine/noise.js';
import { PAL, mixHex } from '../engine/color.js';
import { lin, texture } from '../engine/draw.js';
import { resolve } from './presets.js';
import { ca } from './util.js';

export const TROPIC = {
  leaf: '#1FA68A', leafShade: '#137565', leafLight: '#62D3A2',
  trunk: '#A7764B', trunkShade: '#6F4B34', trunkLight: '#D3A46C',
  sand: PAL.goldPale, sandShade: mixHex(PAL.goldPale, PAL.coral, 0.28), sandWet: mixHex(PAL.gold, PAL.coral, 0.25),
  hill: '#2C9C7A', hillShade: '#1A6F5E', hillLight: '#5CC79A',
};

/** Tiñe la paleta tropical con el ambiente del preset (atardecer/noche). */
function tint(preset) {
  const P = resolve(preset ?? 'golden');
  const L = P.sky.light;
  const k = L.ambientA * 1.6;
  const T = {};
  for (const key in TROPIC) T[key] = mixHex(TROPIC[key], L.ambient, Math.min(0.7, k));
  T.rim = L.rim;
  T.sil = mixHex(PAL.navy900, PAL.dusk, 0.25);
  return T;
}

/**
 * drawPalm(ctx, t, x, y, h, { lean, sway, seed, fronds, coconuts, preset, silhouette })
 *  (x, y) = pie del tronco · h = alto · lean −1..1 (inclinación) · sway 0..2 (balanceo) · fronds (def 9)
 */
export function drawPalm(ctx, t, x, y, h, o = {}) {
  const T = tint(o.preset);
  const sil = !!o.silhouette;
  const lean = o.lean ?? 0.3;
  const sway = o.sway ?? 1;
  const seed = o.seed ?? 1;
  const nF = o.fronds ?? 9;
  const sw = Math.sin(t * 1.15 + seed * 1.7) * 0.5 + Math.sin(t * 2.3 + seed) * 0.2;
  // tronco: curva cuadrática del pie a la copa
  const tx = x + lean * h * 0.42 + sw * sway * h * 0.012, ty = y - h;
  const cx = x + lean * h * 0.02, cy = y - h * 0.55;
  const pt = (u) => [(1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * tx, (1 - u) * (1 - u) * y + 2 * (1 - u) * u * cy + u * u * ty];
  const w0 = h * 0.06, w1 = h * 0.032;
  const L = [], R = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const [px, py] = pt(u);
    const [qx, qy] = pt(Math.min(1, u + 0.01));
    const [ax, ay] = pt(Math.max(0, u - 0.01));
    const dx = qx - ax, dy = qy - ay, l = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * u) * (i === 0 ? 1.25 : 1);
    L.push([px - (dy / l) * w * -1, py - (dx / l) * w]);
    R.push([px + (dy / l) * w * -1, py + (dx / l) * w]);
  }
  const trunk = new Path2D();
  L.forEach(([a, b], i) => (i ? trunk.lineTo(a, b) : trunk.moveTo(a, b)));
  for (let i = R.length - 1; i >= 0; i--) trunk.lineTo(R[i][0], R[i][1]);
  trunk.closePath();
  ctx.save();
  ctx.fillStyle = sil ? T.sil : T.trunk;
  ctx.fill(trunk);
  if (!sil) {
    ctx.save();
    ctx.clip(trunk);
    // sombra del lado derecho y anillos
    ctx.fillStyle = T.trunkShade;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const [px, py] = pt(i / N); const w = (w0 + (w1 - w0) * (i / N)); i ? ctx.lineTo(px + w * 0.25, py) : ctx.moveTo(px + w * 0.25, py); }
    ctx.lineTo(x + h, y + 10); ctx.lineTo(x + h, y - h * 1.2);
    ctx.closePath();
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ca(T.trunkShade, 0.75);
    ctx.lineWidth = Math.max(1, h * 0.008);
    for (let i = 1; i < 14; i++) {
      const u = i / 14;
      const [px, py] = pt(u);
      const w = w0 + (w1 - w0) * u;
      ctx.beginPath(); ctx.moveTo(px - w * 1.2, py + w * 0.15); ctx.quadraticCurveTo(px, py + w * 0.45, px + w * 1.2, py + w * 0.1); ctx.stroke();
    }
    ctx.fillStyle = ca(T.trunkLight, 0.8);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const [px, py] = pt(i / N); const w = (w0 + (w1 - w0) * (i / N)); i ? ctx.lineTo(px - w * 0.55, py) : ctx.moveTo(px - w * 0.55, py); }
    for (let i = N; i >= 0; i--) { const [px, py] = pt(i / N); const w = (w0 + (w1 - w0) * (i / N)); ctx.lineTo(px - w * 0.95, py); }
    ctx.closePath();
    ctx.fill();
    texture(ctx, trunk, { alpha: 0.12, scale: 0.6 });
    ctx.restore();
  }
  // hojas: detrás las de atrás, adelante las de adelante
  const fr = [];
  for (let i = 0; i < nF; i++) {
    const base = -Math.PI / 2 + (i / (nF - 1) - 0.5) * Math.PI * 1.75 + (hash(i, seed) - 0.5) * 0.25;
    fr.push({ i, a: base, len: h * (0.42 + 0.14 * hash(i, seed, 2)), back: i % 2 === 0 });
  }
  for (const f of fr.filter((q) => q.back)) frond(ctx, t, tx, ty, f, h, T, sil, sway, seed, true);
  // cocos
  if ((o.coconuts ?? 3) > 0 && !sil) {
    for (let k = 0; k < (o.coconuts ?? 3); k++) {
      const a = 0.6 + k * 0.9;
      const r = h * 0.032;
      const ccx = tx + Math.cos(a) * r * 1.1, ccy = ty + r * 0.8 + Math.sin(a) * r * 0.5;
      ctx.fillStyle = T.trunkShade;
      ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, TAU); ctx.fill();
      ctx.fillStyle = ca(T.trunkLight, 0.8);
      ctx.beginPath(); ctx.arc(ccx - r * 0.3, ccy - r * 0.3, r * 0.35, 0, TAU); ctx.fill();
    }
  }
  for (const f of fr.filter((q) => !q.back)) frond(ctx, t, tx, ty, f, h, T, sil, sway, seed, false);
  ctx.restore();
}

function frond(ctx, t, x, y, f, h, T, sil, sway, seed, back) {
  // espina: arranca con el ángulo a, se curva hacia abajo por el peso (más en hojas horizontales)
  const flutter = Math.sin(t * 2.2 + f.i * 0.9 + seed) * 0.06 * sway + Math.sin(t * 1.1 + seed) * 0.05 * sway;
  const a = f.a + flutter;
  const droop = 0.65 + 0.6 * Math.abs(Math.cos(a));
  const n = 16;
  const pts = [];
  const dirs = [];
  for (let j = 0; j <= n; j++) {
    const u = j / n;
    const ang = a + Math.sign(Math.cos(a) || 1) * droop * u * u * 1.9 + Math.sin(t * 3 + f.i + u * 3) * 0.05 * sway * u;
    const prev = pts[j - 1] ?? [x, y];
    pts.push(j ? [prev[0] + Math.cos(ang) * (f.len / n), prev[1] + Math.sin(ang) * (f.len / n)] : [x, y]);
    dirs.push(ang);
  }
  // hojitas (pinnas): borde plumoso a los dos lados, cada hojita apunta hacia la punta y cuelga un poco
  const side = (s) => {
    const out = [];
    for (let j = 0; j <= n; j++) {
      const [px, py] = pts[j];
      const ang = dirs[j];
      const u = j / n;
      const w = f.len * 0.15 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.04)), 0.65);
      const nx = -Math.sin(ang) * s, ny = Math.cos(ang) * s;
      const tx = Math.cos(ang), ty = Math.sin(ang);
      const hang = s > 0 ? 0.25 : -0.1; // las de abajo cuelgan más
      if (j % 2) out.push([px + nx * w + tx * w * 0.75, py + ny * w + ty * w * 0.75 + w * hang]);
      else out.push([px + nx * w * 0.32 + tx * w * 0.1, py + ny * w * 0.32 + ty * w * 0.1]);
    }
    return out;
  };
  const A = side(1), B = side(-1);
  const half = (S) => {
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j <= n; j++) p.lineTo(S[j][0], S[j][1]);
    for (let j = n; j >= 0; j--) p.lineTo(pts[j][0], pts[j][1]);
    p.closePath();
    return p;
  };
  if (sil) {
    ctx.fillStyle = T.sil;
    ctx.fill(half(A)); ctx.fill(half(B));
    return;
  }
  const dark = back ? mixHex(T.leafShade, PAL.navy800, 0.15) : T.leafShade;
  ctx.fillStyle = back ? mixHex(T.leaf, T.leafShade, 0.5) : T.leaf;
  ctx.fill(half(A));
  ctx.fillStyle = dark;
  ctx.fill(half(B));
  // nervio central con filo de luz
  ctx.strokeStyle = ca(back ? T.leaf : T.leafLight, 0.9);
  ctx.lineWidth = Math.max(1, h * 0.006);
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
}

/**
 * drawIsland(ctx, t, x, y, s, { preset, palms, seed, hut })
 *  (x, y) = centro sobre la línea de agua · s = escala (1 ≈ 560 px de ancho)
 */
export function drawIsland(ctx, t, x, y, s, o = {}) {
  const T = tint(o.preset);
  const seed = o.seed ?? 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // agua de bajío turquesa y anillo de espuma que respira
  const br = 0.5 + 0.5 * Math.sin(t * 1.6 + seed);
  ctx.fillStyle = lin(ctx, 0, -20, 0, 40, [[0, ca(PAL.aqua300, 0.95)], [1, ca(PAL.ocean400, 0.4)]]);
  ctx.beginPath(); ctx.ellipse(0, 6, 330, 40, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = ca(PAL.foam, 0.65 + 0.3 * br);
  ctx.lineWidth = 3.5;
  ctx.setLineDash([26, 10, 8, 12]);
  ctx.lineDashOffset = -t * 18;
  ctx.beginPath(); ctx.ellipse(0, 6, 300 + br * 10, 32 + br * 3, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  // morro verde detrás
  const hill = new Path2D();
  hill.moveTo(-150, -28);
  hill.bezierCurveTo(-120, -150, -10, -190, 40, -150);
  hill.bezierCurveTo(80, -200, 170, -140, 175, -30);
  hill.closePath();
  ctx.fillStyle = T.hill;
  ctx.fill(hill);
  ctx.save();
  ctx.clip(hill);
  ctx.fillStyle = T.hillShade;
  ctx.beginPath(); ctx.moveTo(40, -150); ctx.bezierCurveTo(70, -110, 90, -60, 80, 0); ctx.lineTo(200, 0); ctx.lineTo(200, -200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ca(T.hillLight, 0.8);
  ctx.beginPath(); ctx.moveTo(-150, -28); ctx.bezierCurveTo(-120, -150, -10, -190, 40, -150); ctx.bezierCurveTo(-10, -170, -100, -130, -128, -30); ctx.closePath(); ctx.fill();
  texture(ctx, hill, { alpha: 0.1, scale: 0.6 });
  ctx.restore();
  // arena con orilla mojada
  const sand = new Path2D();
  sand.moveTo(-270, 4);
  sand.bezierCurveTo(-200, -38, -60, -52, 40, -48);
  sand.bezierCurveTo(150, -46, 230, -26, 275, 4);
  sand.closePath();
  ctx.fillStyle = T.sand;
  ctx.fill(sand);
  ctx.save();
  ctx.clip(sand);
  ctx.fillStyle = T.sandShade;
  ctx.beginPath(); ctx.moveTo(-270, 4); ctx.bezierCurveTo(-150, -14, 120, -12, 275, 4); ctx.lineTo(275, 10); ctx.lineTo(-270, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ca(T.sandWet, 0.7);
  ctx.fillRect(-280, -3, 560, 8);
  ctx.fillStyle = ca('#ffffff', 0.5);
  ctx.beginPath(); ctx.moveTo(-200, -30); ctx.bezierCurveTo(-120, -46, -20, -50, 40, -48); ctx.bezierCurveTo(-30, -44, -120, -40, -200, -28); ctx.closePath(); ctx.fill();
  texture(ctx, sand, { alpha: 0.12, scale: 0.5 });
  ctx.restore();
  // choza opcional
  if (o.hut) hut(ctx, 110, -40, T);
  // palmeras
  const n = o.palms ?? 3;
  const spots = [[-150, -26, 230, -0.55], [-60, -44, 290, -0.1], [40, -46, 250, 0.45], [150, -36, 200, 0.7]];
  for (let i = 0; i < n && i < spots.length; i++) {
    const [px, py, ph, ln] = spots[i];
    drawPalm(ctx, t, px, py, ph * (0.9 + 0.2 * hash(i, seed)), { lean: ln, seed: seed * 10 + i, preset: o.preset });
  }
  ctx.restore();
}

function hut(ctx, x, y, T) {
  ctx.fillStyle = T.trunkShade;
  ctx.fillRect(x - 26, y - 34, 52, 34);
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x - 8, y - 22, 16, 22);
  ctx.fillStyle = mixHex(PAL.gold, PAL.coral, 0.2);
  ctx.beginPath(); ctx.moveTo(x - 44, y - 30); ctx.lineTo(x, y - 70); ctx.lineTo(x + 44, y - 30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ca(PAL.coral, 0.6);
  ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.lineTo(x + 44, y - 30); ctx.lineTo(x + 10, y - 30); ctx.closePath(); ctx.fill();
}
