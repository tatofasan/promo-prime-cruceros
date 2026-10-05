// Kit chico para las viñetas-postal del mapa (280 × 184 unidades locales). Luz SIEMPRE arriba a la izquierda.
import { PAL, rgba, mixHex } from '../../../engine/color.js';
import { TAU } from '../../../engine/ease.js';
import { sparkle } from '../../../engine/draw.js';
import { hash } from '../../../engine/noise.js';

export const AW = 280, AH = 184;

/** Cielo en degradé vertical de 0 a hz. */
export function sky(ctx, hz, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  stops.forEach((c, i) => g.addColorStop(Array.isArray(c) ? c[0] : i / (stops.length - 1), Array.isArray(c) ? c[1] : c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, AW, hz + 2);
}

/** Sol blando con halo. */
export function sunGlow(ctx, x, y, r, { core = PAL.warmWhite, halo = PAL.goldLight, a = 1 } = {}) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, rgba(halo, 0.55 * a));
  g.addColorStop(0.35, rgba(halo, 0.16 * a));
  g.addColorStop(1, rgba(halo, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.fillStyle = rgba(core, a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/**
 * Mar del horizonte (hz) para abajo: degradé, líneas de oleaje que derivan, brillo del horizonte y destellos.
 */
export function sea(ctx, t, hz, { top = PAL.ocean400, bottom = PAL.ocean600, line = PAL.aqua100, glint = 6, seed = 1, speed = 1 } = {}) {
  const g = ctx.createLinearGradient(0, hz, 0, AH);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, hz, AW, AH - hz);
  // brillo del horizonte
  ctx.fillStyle = rgba(PAL.white, 0.35);
  ctx.fillRect(0, hz, AW, 1.6);
  // oleaje: trazos cortos que derivan, más largos y gruesos cerca
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const d = hash(i, seed);
    const y = hz + 4 + Math.pow(d, 1.6) * (AH - hz - 4);
    const near = (y - hz) / (AH - hz);
    const len = 6 + near * 22;
    const x = ((hash(i, seed + 7) * AW + t * speed * (6 + near * 14)) % (AW + 40)) - 20;
    ctx.strokeStyle = rgba(line, 0.25 + 0.35 * near);
    ctx.lineWidth = 0.8 + near * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len / 2, y - 1.5 - near * 2, x + len, y);
    ctx.stroke();
  }
  for (let i = 0; i < glint; i++) {
    const ph = t * 2.2 + hash(i, seed + 3) * 6;
    const a = Math.max(0, Math.sin(ph));
    sparkle(ctx, hash(i, seed + 4) * AW, hz + 6 + hash(i, seed + 5) * (AH - hz - 10), 4 + 4 * a, { alpha: a * a, halo: 0.5 });
  }
}

/** Nube plana estilizada en 3 tonos (base, panza en sombra, filo). */
export function cloud(ctx, x, y, s, { base = PAL.white, belly = PAL.aqua100, a = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y);
  ctx.scale(s, s);
  const p = new Path2D();
  p.arc(-14, 0, 9, Math.PI * 0.5, Math.PI * 1.5);
  p.arc(-4, -8, 11, Math.PI * 1.05, Math.PI * 1.85);
  p.arc(10, -5, 9, Math.PI * 1.25, Math.PI * 2);
  p.arc(18, 1, 7, Math.PI * 1.5, Math.PI * 0.5);
  p.closePath();
  ctx.fillStyle = base;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = belly;
  ctx.fillRect(-30, 1.5, 60, 20);
  ctx.restore();
  ctx.restore();
}

/** Gaviota en V con aleteo. */
export function gull(ctx, x, y, s, t, ph = 0, color = PAL.navy700) {
  const f = Math.sin(t * 9 + ph);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7, -1 - f * 3);
  ctx.quadraticCurveTo(-3.5, -3 - f * 2, 0, 0);
  ctx.quadraticCurveTo(3.5, -3 - f * 2, 7, -1 - f * 3);
  ctx.stroke();
  ctx.restore();
}

/** Velerito con vela blanca en 2 tonos, cabeceo suave. */
export function sailboat(ctx, x, y, s, t, ph = 0) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2.3 + ph) * 0.8);
  ctx.rotate(Math.sin(t * 1.9 + ph) * 0.05);
  ctx.scale(s, s);
  ctx.fillStyle = PAL.navy700;
  ctx.beginPath();
  ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(6, 3.5); ctx.lineTo(-6, 3.5); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.white;
  ctx.beginPath();
  ctx.moveTo(0.5, -1); ctx.lineTo(0.5, -18); ctx.lineTo(9, -1); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.aqua100;
  ctx.beginPath();
  ctx.moveTo(-0.5, -1); ctx.lineTo(-0.5, -15); ctx.lineTo(-7, -1); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Polígono relleno rápido. */
export function poly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

/** Bruma atmosférica sobre lo lejano. */
export function haze(ctx, y0, y1, color, a) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, AW, y1 - y0);
}

/**
 * Palmera: tronco curvo con anillos (2 tonos), penacho de hojas en 3 tonos que se mece y cocos.
 * lean = inclinación (+ derecha), h = alto.
 */
export function palm(ctx, x, y, h, t, { lean = 0.15, n = 7, ph = 0, leaf = 1 } = {}) {
  const sw = Math.sin(t * 1.7 + ph) * 0.07;
  const tx = lean * h, ty = -h;
  ctx.save();
  ctx.translate(x, y);
  // tronco: franja que se afina, con sombra a la derecha y anillos
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const cx = tx * u * u + Math.sin(u * Math.PI) * lean * h * 0.35, cy = ty * u;
    pts.push([cx, cy, 2.4 - 1.1 * u]);
  }
  ctx.fillStyle = '#9A6A4C';
  ctx.beginPath();
  pts.forEach(([cx, cy, w], i) => (i ? ctx.lineTo(cx - w, cy) : ctx.moveTo(cx - w, cy)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0] + pts[i][2], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#734A33';
  ctx.beginPath();
  pts.forEach(([cx, cy], i) => (i ? ctx.lineTo(cx + 0.3, cy) : ctx.moveTo(cx + 0.3, cy)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0] + pts[i][2], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,36,24,0.55)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 10; i++) {
    const [cx, cy, w] = pts[i];
    ctx.beginPath(); ctx.moveTo(cx - w, cy + 0.6); ctx.lineTo(cx + w, cy - 0.6); ctx.stroke();
  }
  // copa
  ctx.translate(pts[10][0], pts[10][1]);
  ctx.rotate(sw);
  ctx.fillStyle = '#6B4430';
  for (const [cx, cy] of [[-2, 2.5], [2, 3], [0, 4.5]]) { ctx.beginPath(); ctx.arc(cx, cy, 2.1, 0, TAU); ctx.fill(); }
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 1.02 + (i / (n - 1)) * Math.PI * 1.04;
    const len = h * 0.5 * leaf * (0.82 + 0.25 * Math.sin(i * 2.3));
    ctx.save();
    ctx.rotate(a + Math.sin(t * 2.3 + i + ph) * 0.06);
    const back = i % 2 === 1;
    ctx.fillStyle = back ? GREEN.lo : GREEN.base;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.26, len, len * 0.22);
    ctx.quadraticCurveTo(len * 0.5, len * 0.08, 0, 2.2);
    ctx.fill();
    // nervadura clara y dientes de la hoja
    ctx.strokeStyle = back ? GREEN.base : GREEN.hi;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(1, 0.4); ctx.quadraticCurveTo(len * 0.5, -len * 0.18, len * 0.96, len * 0.2); ctx.stroke();
    ctx.strokeStyle = back ? GREEN.deep : GREEN.lo;
    for (let k = 1; k < 5; k++) {
      const u = k / 5, px = len * u, py = -len * 0.2 * Math.sin(u * Math.PI) + len * 0.2 * u * u;
      ctx.beginPath(); ctx.moveTo(px, py + 1); ctx.lineTo(px + 3, py + 4.5); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export const GREEN = { hi: '#7ED9A0', base: '#2FA36B', lo: '#1D7350', deep: '#145A40' };
export const ROCK = { hi: mixHex(PAL.grey300, PAL.peach, 0.25), base: mixHex(PAL.grey400, PAL.peach, 0.12), lo: PAL.grey600, deep: PAL.grey700 };
