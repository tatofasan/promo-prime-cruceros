// Fondos de VALOR: un color plano contundente por compás (cian → coral → navy) que cambia con un barrido
// circular desde el objeto, patrones geométricos sutiles (anillos, rayos de sol, rosa náutica) y formas
// flotantes en 3 profundidades con parallax.
import { W, H, beatPulse } from '../../engine/time.js';
import { PAL, shade, rgba, mixHex } from '../../engine/color.js';
import { E, clamp, prog, TAU, pop, spring } from '../../engine/ease.js';
import { rng, noise1 } from '../../engine/noise.js';
import { makeCanvas } from '../../engine/env.js';
import { toScreen } from '../../engine/camera.js';
import { T } from './timeline.js';
import { rayAngle, rayFlash } from './hype.js';

export const THEMES = [
  { id: 'cyan', base: PAL.brandCyan, dark: shade(PAL.brandCyan, -0.2), light: shade(PAL.brandCyan, 0.22),
    accent: PAL.goldLight, hot: PAL.coral, t0: T.in, center: [1400, 650] },
  { id: 'coral', base: PAL.coral, dark: shade(PAL.coral, -0.16), light: shade(PAL.coral, 0.2),
    accent: PAL.goldPale, hot: PAL.navy700, t0: T.pass, center: [960, 640] },
  { id: 'navy', base: PAL.navy800, dark: PAL.navy900, light: PAL.navy600,
    accent: PAL.gold, hot: PAL.aqua300, t0: T.pro, center: [960, 655] },
];

// zonas donde no van formas grandes (titulares y protagonistas), por tema
const KEEP = [
  [[80, 200, 1060, 760], [1040, 300, 1800, 980]],
  [[300, 70, 1640, 300], [220, 330, 1700, 940]],
  [[200, 60, 1720, 330], [560, 300, 1360, 1080], [90, 420, 790, 660], [1130, 420, 1840, 720]],
];

let SHAPES = null;
let DOTS = null;

function inKeep(k, x, y, m) {
  return KEEP[k].some(([a, b, c, d]) => x > a - m && x < c + m && y > b - m && y < d + m);
}

function buildShapes() {
  SHAPES = THEMES.map((th, k) => {
    const r = rng(311 + k * 97);
    const out = [];
    const types = ['ring', 'dot', 'plus', 'zig', 'tri', 'half', 'ring', 'dot', 'squig', 'plus'];
    let guard = 0;
    while (out.length < 26 && guard++ < 1200) {
      const x = -60 + r() * (W + 120), y = -60 + r() * (H + 120);
      const depth = 0.55 + r() * 1.15;
      const size = (20 + r() * 32) * (0.7 + depth * 0.45);
      if (inKeep(k, x, y, size * 0.6)) continue;
      if (out.some((s) => Math.hypot(s.x - x, s.y - y) < 140)) continue;
      out.push({
        type: types[out.length % types.length], x, y, depth, size,
        rot: r() * TAU, vr: (r() - 0.5) * 1.4, vy: 10 + r() * 22, ph: r() * 10,
        col: r() < 0.22 ? 'accent' : r() < 0.35 ? 'hot' : 'light', delay: r() * 0.25,
      });
    }
    return out.sort((a, b) => a.depth - b.depth);
  });
}

/** Retícula de puntos en semitono (cacheada): crecen hacia una esquina. */
function buildDots() {
  DOTS = THEMES.map((th, k) => {
    const c = makeCanvas(W + 200, H + 200);
    const x = c.getContext('2d');
    x.fillStyle = k === 2 ? rgba(PAL.aqua200, 0.16) : rgba('#FFFFFF', 0.13);
    const step = 34;
    for (let gy = 0; gy < H + 200; gy += step) {
      for (let gx = (gy / step) % 2 ? step / 2 : 0; gx < W + 200; gx += step) {
        // dos manchas de semitono: arriba-izquierda y abajo-derecha
        const a = 1 - Math.hypot(gx / (W * 0.55), gy / (H * 0.75));
        const b = 1 - Math.hypot((W + 200 - gx) / (W * 0.5), (H + 200 - gy) / (H * 0.7));
        const v = Math.max(a, b);
        if (v <= 0.02) continue;
        const rr = 1.2 + 5.2 * Math.pow(v, 1.3);
        x.beginPath();
        x.arc(gx, gy, rr, 0, TAU);
        x.fill();
      }
    }
    return c;
  });
}

export function initBg() {
  if (!SHAPES) buildShapes();
  if (!DOTS) buildDots();
}

function shapePath(c, s, sz) {
  const p = new Path2D();
  switch (s.type) {
    case 'dot': p.arc(0, 0, sz * 0.32, 0, TAU); break;
    case 'plus': {
      const a = sz * 0.5, b = sz * 0.15;
      p.rect(-a, -b, a * 2, b * 2); p.rect(-b, -a, b * 2, a * 2); break;
    }
    case 'tri': p.moveTo(0, -sz * 0.5); p.lineTo(sz * 0.46, sz * 0.32); p.lineTo(-sz * 0.46, sz * 0.32); p.closePath(); break;
    case 'half': p.arc(0, 0, sz * 0.5, Math.PI, 0); p.closePath(); break;
    default: break;
  }
  return p;
}

function drawShape(c, s, sz, col, shadowCol) {
  if (s.type === 'ring' || s.type === 'zig' || s.type === 'squig') {
    const line = (ox, oy) => {
      c.beginPath();
      if (s.type === 'ring') c.arc(ox, oy, sz * 0.4, 0, TAU);
      else if (s.type === 'zig') {
        for (let i = 0; i <= 4; i++) c.lineTo(ox - sz * 0.6 + i * sz * 0.3, oy + (i % 2 ? -sz * 0.18 : sz * 0.18));
      } else {
        for (let i = 0; i <= 12; i++) c.lineTo(ox - sz * 0.6 + i * sz * 0.1, oy + Math.sin(i * 0.9) * sz * 0.16);
      }
      c.stroke();
    };
    c.lineWidth = sz * 0.16;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = shadowCol;
    line(sz * 0.08, sz * 0.1);
    c.strokeStyle = col;
    line(0, 0);
    return;
  }
  const p = shapePath(c, s, sz);
  c.save(); c.translate(sz * 0.08, sz * 0.1); c.fillStyle = shadowCol; c.fill(p); c.restore();
  c.fillStyle = col;
  c.fill(p);
}

/**
 * Formas flotantes del tema k. near=false → planos lejanos (depth < 1.25); near=true → los cercanos.
 * vy0 = velocidad extra hacia arriba (entrada en látigo), en px/s de pantalla.
 */
export function drawShapes(ctx, t, k, cam, { near = false, streak = 0, alpha = 1 } = {}) {
  const th = THEMES[k];
  const t0 = th.t0;
  const pulse = beatPulse(t, { from: t0, decay: 0.12 });
  for (const s of SHAPES[k]) {
    if ((s.depth >= 1.25) !== near) continue;
    const a = pop(t, t0 - 0.06 + s.delay * 0.6, { dur: 0.5, over: 1.25 });
    if (a <= 0.01) continue;
    const yy = s.y - (t - t0) * s.vy * s.depth;
    const [sx, sy] = toScreen(cam, s.depth, s.x + noise1(t * 0.3 + s.ph, 5) * 12, yy);
    const z = Math.pow(cam.z, s.depth) * a * (1 + 0.18 * pulse);
    const sz = s.size * z;
    const col = s.col === 'accent' ? th.accent : s.col === 'hot' ? th.hot : th.light;
    ctx.save();
    ctx.globalAlpha *= alpha * (s.col === 'light' ? 0.75 : 0.95) * clamp(a * 3);
    ctx.translate(sx, sy);
    // estela vertical durante el látigo de entrada
    if (streak > 3) {
      ctx.fillStyle = rgba(col, 0.32);
      ctx.fillRect(-sz * 0.14, 0, sz * 0.28, streak * s.depth);
    }
    ctx.rotate(s.rot + t * s.vr);
    drawShape(ctx, s, sz, col, rgba(PAL.ink, k === 2 ? 0.35 : 0.16));
    ctx.restore();
  }
}

/** Patrón propio de cada tema (en el plano depth 0.4 de la cámara). */
function drawPattern(ctx, t, k, cam, o = {}) {
  const th = THEMES[k];
  const t0 = th.t0;
  const pulse = beatPulse(t, { from: t0, decay: 0.16 });
  const [cx, cy] = o.center ?? th.center;
  const [px, py] = toScreen(cam, 0.4, cx, cy);
  const z = Math.pow(cam.z, 0.4) * (1 + 0.02 * pulse);
  // semitono
  ctx.save();
  ctx.globalAlpha *= 0.9;
  const [dx, dy] = toScreen(cam, 0.25, -100, -100);
  ctx.drawImage(DOTS[k], dx, dy);
  ctx.restore();
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(z, z);
  if (k === 0) {
    // anillos concéntricos que se expanden lento desde la valija
    // anillos que salen de la valija (onda continua, más marcada en cada beat)
    const sp = 120;
    const off = (((t - t0) * 150) % sp + sp) % sp;
    for (let i = 0; i < 16; i++) {
      const r = 150 + i * sp + off;
      ctx.strokeStyle = rgba('#FFFFFF', (0.1 + 0.1 * pulse) * clamp(1 - i / 15));
      ctx.lineWidth = 30;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
  } else if (k === 1) {
    // rayos de sol que giran detrás del precio
    const n = 22;
    // giro base lento + aceleración durante la cuenta del precio (y frenada con inercia después del sello)
    const rot = (t - t0) * 0.22 + rayAngle(t);
    ctx.rotate(rot);
    ctx.fillStyle = rgba(PAL.goldPale, 0.13 + 0.06 * pulse + rayFlash(t));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = a0 + (TAU / n) * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 2400, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = rgba(PAL.white, 0.08);
    ctx.beginPath(); ctx.arc(0, 0, 330, 0, TAU); ctx.fill();
  } else {
    // rosa náutica: círculos punteados, rumbos y marcas de grados (gira y da un tirón en cada beat)
    let rot = (t - t0) * 0.2;
    for (let k = 1; k <= 3; k++) rot += 0.18 * spring(t, t0 + k * 0.46875 - 0.02, { from: 0, to: 1, freq: 3, damp: 8 });
    ctx.rotate(rot);
    ctx.strokeStyle = rgba(PAL.aqua200, 0.14 + 0.08 * pulse);
    ctx.lineWidth = 3;
    for (const [r, dash] of [[420, [3, 14]], [560, [26, 12]], [720, [3, 18]], [900, [60, 20]]]) {
      ctx.setLineDash(dash);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(PAL.aqua200, 0.08);
    ctx.lineWidth = 2;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      const r0 = i % 4 === 0 ? 380 : 470;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * 1600, Math.sin(a) * 1600);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(PAL.aqua200, 0.22);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const r = 560 + (i % 6 === 0 ? 0 : 0);
      const l = i % 6 === 0 ? 18 : 8;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(r - l / 2 + 40, -1.5, l, 3);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Pinta el tema k completo (fondo plano + patrón + formas lejanas). */
export function drawTheme(ctx, t, k, cam, o = {}) {
  ctx.fillStyle = THEMES[k].base;
  ctx.fillRect(0, 0, W, H);
  drawPattern(ctx, t, k, cam, o);
  drawShapes(ctx, t, k, cam, { near: false, streak: o.streak ?? 0 });
}

/**
 * Barrido circular (iris): el tema nuevo crece desde (cx, cy) de pantalla entre t0 y t0 + dur.
 * Devuelve el radio (0 si no empezó; 2350 cubre todo el cuadro desde cualquier punto).
 */
export const SWEEP_R = 2350;
export function sweepRadius(t, t0, dur, ease = E.outQuart) {
  const p = prog(t, t0, t0 + dur);
  return SWEEP_R * ease(p) * (p > 0 ? 1 : 0);
}

export function drawSweepRing(ctx, t, t0, dur, cx, cy, col, ease) {
  const r = sweepRadius(t, t0, dur, ease);
  const p = prog(t, t0, t0 + dur);
  if (r <= 0 || p >= 1) return;
  ctx.save();
  ctx.strokeStyle = rgba(col, 0.75 * (1 - p));
  ctx.lineWidth = 26 * (1 - p) + 4;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(col, 0.4 * (1 - p));
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, r - 70 - 60 * p), 0, TAU); ctx.stroke();
  ctx.restore();
}

/** Líneas de velocidad verticales del látigo de entrada (pantalla): desde el barrido hasta frenar. */
export function drawSpeedLines(ctx, t) {
  const dt = t - T.win;
  if (dt < 0 || dt > 0.36) return;
  const f = 1 - E.inQuad(dt / 0.36);
  const r = rng(77);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const x = r() * W, len = 220 + r() * 620, sp = 2600 + r() * 2400, y0 = H * 0.55 + r() * 900;
    const y = y0 - dt * sp;
    ctx.strokeStyle = rgba('#FFFFFF', (0.25 + r() * 0.4) * f);
    ctx.lineWidth = 3 + r() * 7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len * f); ctx.stroke();
  }
  ctx.restore();
}

export { mixHex };
