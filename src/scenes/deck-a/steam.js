// Vapor del plato (vista cenital): bocanadas suaves que suben hacia la cámara (crecen y se abren por la
// perspectiva), se enroscan con el giro del plato y se desvanecen. También el escape bajo la campana y la
// nube que se libera al destaparla.
import { makeCanvas } from '../../engine/env.js';
import { rng, hash, noise1 } from '../../engine/noise.js';
import { TAU, clamp, E } from '../../engine/ease.js';
import { project, flatten } from './util.js';

let PUFFS = null;
export function buildSteam() {
  const r = rng(4040);
  PUFFS = [];
  for (let v = 0; v < 3; v++) {
    const a = makeCanvas(200, 200);
    const c = a.getContext('2d');
    c.translate(100, 100);
    for (let k = 0; k < 7; k++) {
      const ang = r() * TAU, d = 10 + r() * 34, rad = 18 + r() * 22;
      const x = Math.cos(ang) * d, y = Math.sin(ang) * d;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
    }
    // voluta: un rulo más denso
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const u = i / 20, ang = u * 4.5 + v, rr = 8 + u * 38;
      const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke();
    const b = makeCanvas(200, 200);
    const bc = b.getContext('2d');
    bc.filter = 'blur(7px)';
    bc.drawImage(a, 0, 0);
    bc.filter = 'none';
    PUFFS.push(flatten(b));
  }
}

function puff(ctx, C, wx, wy, h, size, alpha, rot, v) {
  if (alpha <= 0.004) return;
  const [x, y, k] = project(C, wx, wy, h);
  const s = (size * k) / 100;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(PUFFS[v % 3], -100 * s, -100 * s, 200 * s, 200 * s);
  ctx.restore();
}

/**
 * Vapor continuo desde la comida. from = cuándo arranca · spin = giro acumulado del plato (enrosca el vapor).
 * strength 0..1.
 */
export function drawSteam(ctx, C, t, { px, py, from, strength = 1, spin = 0 }) {
  if (t < from || strength <= 0.01) return;
  const N = 12, T = 1.25;
  for (let i = 0; i < N; i++) {
    const ph = hash(i, 71) * T;
    const age = t - from - ph;
    if (age < 0) continue;
    const u = (age % T) / T;
    const cycle = Math.floor(age / T);
    const a0 = hash(i, cycle, 72) * TAU + spin * (0.35 + u * 0.4);
    const r0 = 10 + hash(i, cycle, 73) * 62;
    const sway = noise1(t * 0.9 + i * 3.1, 74) * 30 * u;
    const wx = px + Math.cos(a0) * r0 + sway, wy = py + Math.sin(a0) * r0 - u * 30;
    const h = 20 + E.outQuad(u) * 760;
    const al = Math.pow(Math.sin(Math.PI * u), 1.6) * 0.3 * strength;
    puff(ctx, C, wx, wy, h, 30 + u * 70, al, a0 + u * 2.2, i);
  }
}

/** Escapes de vapor bajo el labio de la campana (anticipación). p 0..1. */
export function drawLeak(ctx, C, t, { px, py, p, R }) {
  if (p <= 0) return;
  for (let i = 0; i < 7; i++) {
    const a = hash(i, 81) * TAU;
    const u = clamp(p * 1.3 - hash(i, 82) * 0.3);
    if (u <= 0) continue;
    const d = R + 4 + u * 50;
    puff(ctx, C, px + Math.cos(a) * d, py + Math.sin(a) * d, 20 + u * 120, 30 + u * 40, Math.sin(Math.PI * u) * 0.3, a, i);
  }
}

/** Nube que se libera al destapar: anillo de bocanadas que se expande y sube. p 0..1 (≈0,8 s). */
export function drawBurst(ctx, C, t, { px, py, p }) {
  if (p <= 0 || p >= 1) return;
  const e = E.outCubic(p);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + hash(i, 91) * 0.4;
    const d = 30 + e * (90 + hash(i, 92) * 80);
    const h = 40 + e * (300 + hash(i, 93) * 380);
    puff(ctx, C, px + Math.cos(a) * d, py + Math.sin(a) * d, h, 60 + e * 90, Math.pow(1 - p, 1.8) * 0.55, a + e * 1.5, i);
  }
}

/**
 * Volutas de vapor estilizadas (las que leen "recién servido"): cintas onduladas que nacen sobre la comida,
 * suben hacia arriba del cuadro, se mecen y se desvanecen; giran apenas con el plato. Coordenadas de pantalla.
 */
export function drawWisps(ctx, t, { x, y, k, from, strength = 1, spin = 0 }) {
  if (t < from || strength <= 0.01) return;
  const W = [[-34, 4, 0], [10, -14, 1], [44, 8, 2], [-6, 22, 3]];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [ox, oy, i] of W) {
    const T = 1.35, ph = hash(i, 501) * T;
    const age = t - from + ph;
    const u = (age % T) / T;
    const grow = clamp(u / 0.35), fade = Math.pow(Math.sin(Math.PI * u), 0.8);
    const a = spin * 0.5;
    const bx = x + (ox * Math.cos(a) - oy * Math.sin(a)) * k, by = y + (ox * Math.sin(a) + oy * Math.cos(a)) * k;
    const L = (170 + hash(i, 502) * 90) * k * (0.3 + 0.7 * grow);
    const rise = u * 110 * k;
    const pts = [];
    for (let j = 0; j <= 18; j++) {
      const v = j / 18;
      const sw = Math.sin(v * 6 - t * 3.1 + i * 1.7) * (6 + 20 * v) * k + v * v * 26 * k * (i % 2 ? 1 : -1);
      pts.push([bx + sw, by - rise - L * v]);
    }
    const path = new Path2D();
    pts.forEach(([px, py], j) => (j ? path.lineTo(px, py) : path.moveTo(px, py)));
    const al = 0.5 * fade * strength;
    const grad = (c0) => {
      const g = ctx.createLinearGradient(bx, by - rise, bx, by - rise - L);
      g.addColorStop(0, `rgba(${c0},0)`);
      g.addColorStop(0.25, `rgba(${c0},${al})`);
      g.addColorStop(0.7, `rgba(${c0},${al * 0.6})`);
      g.addColorStop(1, `rgba(${c0},0)`);
      return g;
    };
    // separación sobre la porcelana blanca: sombra tibia muy suave
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = grad('150,120,100');
    ctx.lineWidth = 12 * k;
    ctx.save(); ctx.translate(-3 * k, 4 * k); ctx.stroke(path); ctx.restore();
    ctx.globalCompositeOperation = 'screen';
    for (const [w, m] of [[22, 0.35], [8, 1]]) {
      ctx.strokeStyle = grad('255,248,236');
      ctx.globalAlpha = m;
      ctx.lineWidth = w * k;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}
