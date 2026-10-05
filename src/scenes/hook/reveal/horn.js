// Bocinazo (reveal.horn): ondas de sonido que salen del silbato de la chimenea y un flare que BARRE el cuadro
// desde el sol (banda cálida diagonal, estría anamórfica y fantasmas que viajan sobre la línea sol → centro).
import { W, H } from '../../../engine/time.js';
import { PAL, rgba } from '../../../engine/color.js';
import { lin, rad } from '../../../engine/draw.js';
import { E, clamp, smoothstep, TAU } from '../../../engine/ease.js';
import { shipPoint, SHIP, drawHorn } from '../../../art/index.js';
import { R, PRESET } from './time.js';

/** Ondas de sonido: tres arcos que se abren desde el silbato, escalonados. */
export function drawHornRings(ctx, t, o) {
  // ondas del sonido hacia proa (sobre el mar, bajas); las de presión alrededor del silbato las pone drawHorn
  ringsAt(ctx, t, o, R.horn, 0.8);
  ringsAt(ctx, t, o, R.horn2, 0.55);
}
function ringsAt(ctx, t, o, t0, amp) {
  const u0 = t - t0;
  if (u0 < 0 || u0 > 0.9 || o.scale > 2) return;
  const [hx, hy] = shipPoint(o, SHIP.horn.x, SHIP.horn.y - 8, t);
  const k = o.scale / 0.5;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const u = u0 - i * 0.09;
    if (u <= 0 || u > 0.6) continue;
    const p = E.outCubic(u / 0.6);
    const r = (24 + 360 * p) * k;
    ctx.strokeStyle = rgba(PAL.warmWhite, 0.85 * amp * (1 - p) * (1 - p));
    ctx.lineWidth = (7 - 5 * p) * k;
    // arcos hacia adelante (proa) y bajos: el sonido se abre sobre el mar, lejos del titular
    ctx.beginPath(); ctx.arc(hx, hy, r, -0.12, 0.42); ctx.stroke();
  }
  ctx.restore();
}

/**
 * BOCINAZO: el chorro de vapor de ART (drawHorn: flash en el silbato, anillos de presión y chorro con rulo).
 * Sale casi horizontal hacia popa, con el rulo hacia ARRIBA (al cielo, no sobre las cubiertas blancas) y por
 * debajo del subrayado del titular. Vapor en tres tonos de alto contraste contra el cielo dorado: cuerpo blanco
 * puro, panza fría azul pizarra y filo cálido del lado del sol. La nube se disipa antes del disparo al casco:
 * en 5,15 la chimenea queda limpia.
 */
const STEAM_C = { key: '#FFFFFF', whiteShade: '#6F87A4', rim: '#FFF6E2', sky: { light: { shade: '#5F7A9C' } } };
const DIR = Math.PI, SQ = 0.74;
export function drawHornSteam(ctx, t, o) {
  hornAt(ctx, t, o, R.horn, 1.4, 1, 0.42);
  // segundo toque (corchea): un chorrito corto que se apaga antes del disparo
  hornAt(ctx, t, o, R.horn2, 0.9, 0.9, 0.2);
}
function hornAt(ctx, t, o, t0, size, alpha, life) {
  const dt = t - t0;
  if (dt < -0.05 || dt > life || o.scale > 2) return;
  const env = 1 - smoothstep(life * 0.55, life, dt);
  const fadeOut = 1 - clamp((t - R.push) / 0.08);
  const a = alpha * env * fadeOut;
  if (a <= 0.01) return;
  const [hx, hy] = shipPoint(o, SHIP.horn.x, SHIP.horn.y, t);
  const S = o.scale * size;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(1, SQ);
  ctx.translate(-hx, -hy);
  // panza fría difusa debajo del chorro: lo despega del cielo claro (el vapor blanco gana contraste)
  if (dt > 0) {
    const front = E.outExpo(clamp(dt / 0.06));
    ctx.save();
    ctx.globalAlpha *= a * 0.75;
    for (let i = 0; i < 5; i++) {
      const d = (14 + i * 20) * S * front;
      const x = hx + Math.cos(DIR) * d - 2 * S, y = hy + Math.sin(DIR) * d + (7 + 2 * i) * S;
      const r = (16 + 5 * i) * S;
      ctx.fillStyle = rad(ctx, x, y, r, [[0, rgba('#5F7A9C', 0.55)], [0.6, rgba('#6F87A4', 0.25)], [1, rgba('#6F87A4', 0)]]);
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }
  drawHorn(ctx, t, t0, { x: hx, y: hy, scale: S, dir: DIR, curl: 1, wind: 0.25, preset: PRESET, light: [0.76, -0.64], alpha: a, C: STEAM_C });
  ctx.restore();
}

/**
 * Onda del bocinazo sobre el agua: dos anillos en perspectiva que salen del barco y barren el mar (se dibujan
 * antes que el barco, así el casco tapa la parte de atrás).
 */
export function drawHornRipple(ctx, t, o) {
  rippleAt(ctx, t, o, R.horn, 2, 1);
  rippleAt(ctx, t, o, R.horn2, 1, 0.6);
}
function rippleAt(ctx, t, o, t0, n, amp) {
  const u0 = t - t0, life = 0.8;
  if (u0 < 0 || u0 > life + 0.2 || o.scale > 2) return;
  const cx = o.x + 60 * o.scale, cy = o.y + 4 * o.scale;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const u = u0 - i * 0.12;
    if (u <= 0 || u > life) continue;
    const p = E.outQuad(u / life);
    const rx = (0.3 + 2.4 * p) * 1000 * o.scale, ry = rx * 0.11;
    const k = o.scale / 0.6;
    const f = (1 - p) * (1 - p);
    ctx.strokeStyle = rgba(PAL.aqua100, 0.3 * amp * f);
    ctx.lineWidth = (20 - 12 * p) * k;
    ctx.beginPath(); ctx.ellipse(cx, cy + 5 * k, rx * 0.985, ry * 0.97, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(PAL.foam, 0.75 * amp * f);
    ctx.lineWidth = (7 - 4 * p) * k;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Flare del bocinazo: un golpe de luz de 2–3 cuadros en reveal.horn (lavado desde el sol + estría anamórfica de
 * borde a borde) que se corta en seco, y una barra de luz NÍTIDA que barre el cuadro del sol al rincón opuesto en
 * 0,3 s (pasa rápido: no deja el plano lechoso). Fantasmas chicos y suaves sobre la línea sol → centro.
 */
export function flarePeak(t) {
  // 4,6833 (sube) · 4,70 (pico) · 4,7167 (un cuarto) · 4,7333 ya limpio
  const d = t - R.horn;
  if (d < 0) return Math.exp(d / 0.006);
  const h = 0.014;
  if (d < h) return 1;
  return Math.exp(-(d - h) / 0.011);
}
export function drawFlareSweep(ctx, t, sun) {
  const u = t - R.horn;
  const dur = 0.3;
  const pk = flarePeak(t);
  if ((u < 0 || u > dur) && pk < 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // 1) lavado de 2–3 cuadros: fuerte junto al sol y más suave en el rincón opuesto
  if (pk > 0.02) {
    ctx.fillStyle = rad(ctx, sun.x, sun.y, 2300, [[0, rgba(PAL.white, 0.62 * pk)], [0.3, rgba(PAL.goldPale, 0.42 * pk)], [1, rgba(PAL.goldLight, 0.2 * pk)]]);
    ctx.fillRect(0, 0, W, H);
  }
  // 2) barra de luz nítida que barre (del sol hacia abajo a la izquierda)
  if (u >= 0 && u <= dur) {
    const p = E.inOutSine(u / dur);
    const env = Math.sin(Math.PI * clamp(u / dur));
    const dx = -1, dy = 0.55, l = Math.hypot(dx, dy);
    const nx = dx / l, ny = dy / l;
    const cx = sun.x + nx * (2700 * p - 200), cy = sun.y + ny * (2700 * p - 200);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.atan2(ny, nx));
    const bw = 300;
    ctx.fillStyle = lin(ctx, -bw / 2, 0, bw / 2, 0, [[0, rgba(PAL.goldPale, 0)], [0.5, rgba(PAL.goldPale, 0.2 * env)], [1, rgba(PAL.goldPale, 0)]]);
    ctx.fillRect(-bw / 2, -2400, bw, 4800);
    ctx.fillStyle = lin(ctx, -46, 0, 46, 0, [[0, rgba(PAL.white, 0)], [0.5, rgba(PAL.white, 0.42 * env)], [1, rgba(PAL.white, 0)]]);
    ctx.fillRect(-46, -2400, 92, 4800);
    ctx.restore();
    // fantasmas chicos y tenues que corren sobre la línea sol → centro
    ctx.globalCompositeOperation = 'lighter';
    const G = [[0.45, 30, PAL.goldLight], [0.85, 18, PAL.aqua200], [1.3, 44, PAL.gold], [1.75, 24, PAL.aqua300]];
    for (const [f, r, c] of G) {
      const q = f + (p - 0.5) * 0.7;
      const gx = sun.x + (W / 2 - sun.x) * q, gy = sun.y + (H / 2 - sun.y) * q;
      ctx.fillStyle = rad(ctx, gx, gy, r, [[0, rgba(c, 0.035 * env)], [0.8, rgba(c, 0.03 * env)], [0.94, rgba(c, 0.06 * env)], [1, rgba(c, 0)]]);
      ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill();
    }
  }
  // 3) estría anamórfica de borde a borde a la altura del sol (fina: sigue un poco más que el lavado)
  const st = Math.max(pk, 0.3 * Math.sin(Math.PI * clamp(u / dur)));
  if (st > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [h, a, col] of [[34, 0.4, PAL.aqua200], [10, 0.9, PAL.white]]) {
      ctx.fillStyle = lin(ctx, 0, sun.y - h, 0, sun.y + h, [[0, rgba(col, 0)], [0.5, rgba(col, a * st)], [1, rgba(col, 0)]]);
      ctx.fillRect(-20, sun.y - h, W + 40, 2 * h);
    }
  }
  ctx.restore();
}
