// Rutas: curvas suaves que van SIEMPRE por mar (puntos de paso sobre el océano de tools/build-map.mjs,
// Catmull-Rom centrípeta de routegeo.js; la prueba _route-land-test.mjs verifica que no pisen tierra). Se
// dibujan solas desde Buenos Aires, punteadas blanco/dorado con resplandor, una estela de luz en la punta y el
// barquito navegando. En map.all toda la red brilla con pulsos de luz que viajan por los arcos.
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, prog, lerp, TAU } from '../../engine/ease.js';
import { beatPulse } from '../../engine/time.js';
import { ROUTES } from './world.js';
import { T, toScr } from './mapcam.js';
import { drawShipTop } from './shiptop.js';
import { buildLeg } from './routegeo.js';

// tramos (de puerto a puerto, por mar) y su tiempo de dibujo
export const LEGS = [
  { id: 'A', from: 'ba', to: 'pde', t0: T.route, t1: T.uy },
  { id: 'B', from: 'pde', to: 'rio', t0: T.uy, t1: T.br },
  { id: 'C', from: 'rio', to: 'car', t0: T.br, t1: T.car },
  { id: 'D', from: 'car', to: 'eu', t0: T.car, t1: T.eu },
  { id: 'E', from: 'eu', to: 'dxb', t0: T.eu, t1: T.dxb },
  { id: 'F', from: 'ba', to: 'ant', t0: T.whip - 0.22, t1: T.ant },
  // red extra: se enciende en map.all (Buenos Aires → Europa por la costa de Brasil, Cabo Verde y Gibraltar)
  { id: 'G', from: 'ba', to: 'eu', t0: T.all + 0.02, t1: T.all + 0.5, extra: true },
];

export function initRoutes() {
  for (const L of LEGS) {
    if (L.pts) continue;
    Object.assign(L, buildLeg(ROUTES[L.id]));
  }
}

/** Progreso de dibujo del tramo en t (con desaceleración al llegar al pin). */
export function legU(L, t) {
  const p = prog(t, L.t0, L.t1);
  return L.extra ? E.outCubic(p) : E.inOutSine(p);
}

/** Punto (mapa) y tangente a la fracción de longitud u. */
export function legAt(L, u) {
  const s = clamp(u) * L.total;
  let i = 1;
  while (i < L.len.length - 1 && L.len[i] < s) i++;
  const a = L.pts[i - 1], b = L.pts[i];
  const f = (s - L.len[i - 1]) / Math.max(1e-6, L.len[i] - L.len[i - 1]);
  return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), i };
}

/** Polilínea de pantalla del tramo hasta la fracción u: [[x,y], …]. */
function screenPts(L, cam, u) {
  const end = legAt(L, u);
  const out = [];
  for (let i = 0; i < end.i; i++) out.push(toScr(cam, L.pts[i][0], L.pts[i][1]));
  out.push(toScr(cam, end.x, end.y));
  return out;
}
function polyPath(pts) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  return p;
}

/** Brillo general de la red (map.all + pulsos en el beat). */
export function networkGlow(t) {
  const on = clamp((t - T.all) / 0.25) * (1 - clamp((t - T.lines) / 0.4) * 0.45);
  return on * (0.75 + 0.25 * beatPulse(t, { from: T.all, every: 1, decay: 0.16 }));
}

/**
 * Dibuja todas las rutas en t. scale = factor de grosor (1 a zoom medio).
 * Devuelve la info del barco activo (para que la cámara y los rótulos lo usen).
 */
export function drawRoutes(ctx, cam, t, { dim = 0 } = {}) {
  const g = networkGlow(t);
  const w = clamp(0.8 + 0.25 * Math.log2(cam.z / 0.64), 0.75, 1.3);
  // la ruta late con el bombo desde que arranca: el resplandor engorda y se enciende en cada beat
  const kick = beatPulse(t, { from: T.route, to: T.lines + 0.4, every: 1, decay: 0.12 });
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const L of LEGS) {
    const u = legU(L, t);
    if (u <= 0.0005) continue;
    const sp = screenPts(L, cam, u);
    const path = polyPath(sp);
    // resplandor dorado debajo
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(PAL.gold, (0.1 + 0.16 * g + 0.06 * kick) * (1 - dim));
    ctx.lineWidth = (10 + 8 * g + 5 * kick) * w;
    ctx.stroke(path);
    ctx.strokeStyle = rgba(kick > 0.3 ? PAL.goldPale : PAL.goldLight, Math.min(1, 0.32 + 0.4 * g + 0.5 * kick) * (1 - dim * 0.6));
    ctx.lineWidth = (2.2 + 3.2 * kick) * w;
    ctx.stroke(path);
    ctx.globalCompositeOperation = 'source-over';
    // punteado blanco que fluye hacia la punta
    ctx.setLineDash([0.01, 13 * w]);
    ctx.lineDashOffset = -t * 42;
    ctx.strokeStyle = rgba(PAL.warmWhite, 0.95);
    ctx.lineWidth = 4.6 * w;
    ctx.stroke(path);
    ctx.setLineDash([]);
    // estela de luz en la punta mientras se dibuja
    const live = u < 1 ? 1 : 1 - clamp((t - L.t1) / 0.35);
    if (live > 0.01 && sp.length > 1) drawTrail(ctx, sp, 260 * w, live * (1 - dim));
    // pulsos que recorren la red en map.all
    if (g > 0.01 && u >= 0.999) drawPulses(ctx, L, cam, t, g * (1 - dim * 0.5), w);
  }
  ctx.restore();
}

function drawTrail(ctx, sp, maxLen, a) {
  // tomo el final de la polilínea hasta maxLen px
  const seg = [sp[sp.length - 1]];
  let acc = 0;
  for (let i = sp.length - 2; i >= 0 && acc < maxLen; i--) {
    const [x0, y0] = sp[i + 1], [x1, y1] = sp[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (acc + d > maxLen) { const f = (maxLen - acc) / d; seg.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]); acc = maxLen; break; }
    seg.push(sp[i]);
    acc += d;
  }
  if (seg.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const n = seg.length - 1;
  for (let i = n - 1; i >= 0; i--) {
    const f = 1 - i / n; // 1 en la punta
    ctx.strokeStyle = rgba(f > 0.6 ? PAL.goldPale : PAL.gold, a * f * f * 0.9);
    ctx.lineWidth = 2 + 6 * f * f;
    ctx.beginPath();
    ctx.moveTo(seg[i + 1][0], seg[i + 1][1]);
    ctx.lineTo(seg[i][0], seg[i][1]);
    ctx.stroke();
  }
  const [hx, hy] = seg[0];
  const r = 34;
  const gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
  gr.addColorStop(0, rgba(PAL.goldPale, 0.75 * a));
  gr.addColorStop(0.4, rgba(PAL.gold, 0.25 * a));
  gr.addColorStop(1, rgba(PAL.gold, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(hx - r, hy - r, r * 2, r * 2);
  ctx.restore();
}

function drawPulses(ctx, L, cam, t, g, w) {
  const n = Math.max(1, Math.round(L.total / 420));
  const dt = t - T.all;
  // en cada beat los pulsos se encienden y engordan (la red late con el bombo)
  const kick = beatPulse(t, { from: T.all, every: 1, decay: 0.12 });
  w *= 1 + 0.8 * kick;
  g = Math.min(1.4, g * (1 + 0.6 * kick));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < n; k++) {
    const u = ((dt * 0.9 + k / n + (L.id.charCodeAt(0) % 5) * 0.13) % 1 + 1) % 1;
    const head = legAt(L, u), tail = legAt(L, Math.max(0, u - (70 + 70 * kick) / L.total));
    const [hx, hy] = toScr(cam, head.x, head.y), [tx, ty] = toScr(cam, tail.x, tail.y);
    const gr = ctx.createLinearGradient(tx, ty, hx, hy);
    gr.addColorStop(0, rgba(PAL.gold, 0));
    gr.addColorStop(1, rgba(PAL.goldPale, 0.9 * g));
    ctx.strokeStyle = gr;
    ctx.lineWidth = 5 * w;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    const r = 16 * w;
    const rg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
    rg.addColorStop(0, rgba(PAL.white, 0.8 * g));
    rg.addColorStop(1, rgba(PAL.gold, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(hx - r, hy - r, 2 * r, 2 * r);
  }
  ctx.restore();
}

// --------------------------------------------------------------- barcos
const SHIPS = [
  { legs: ['A', 'B', 'C', 'D', 'E'], tIn: T.route - 0.12, tOut: T.whip + 0.15 },
  { legs: ['F'], tIn: T.whip - 0.2, tOut: T.all + 0.25 },
];
const byId = Object.fromEntries(LEGS.map((L) => [L.id, L]));

/** Estado del barco i en t: { x, y (mapa), ang, alpha, scale } o null. */
export function shipState(i, t) {
  const S = SHIPS[i];
  if (t < S.tIn || t > S.tOut + 0.3) return null;
  const legs = S.legs.map((id) => byId[id]);
  let L = legs[0];
  for (const l of legs) if (t >= l.t0) L = l;
  const u = legU(L, t);
  const p = legAt(L, Math.max(0.0005, u));
  // rumbo: se mezcla con el del tramo siguiente al llegar a cada pin (gira en el lugar, sin saltos)
  let ang = p.ang;
  const nx = legs[legs.indexOf(L) + 1];
  if (nx) {
    const k = E.inOutSine(clamp((t - (L.t1 - 0.07)) / 0.14));
    if (k > 0) ang = lerpAng(ang, legAt(nx, 0.002).ang, k);
  }
  const pre = legs.indexOf(L) > 0 ? legs[legs.indexOf(L) - 1] : null;
  if (pre) {
    const k = E.inOutSine(clamp((t - (L.t0 - 0.07)) / 0.14));
    if (k < 1) ang = lerpAng(legAt(pre, 0.998).ang, ang, k);
  }
  const sIn = E.backOut(2.2)(clamp((t - S.tIn) / 0.28));
  const sOut = 1 - E.backIn(1.8)(clamp((t - S.tOut) / 0.25));
  return { x: p.x, y: p.y, ang, scale: Math.max(0, Math.min(sIn, sOut)), moving: u > 0 && u < 1 };
}
function lerpAng(a, b, k) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * k;
}

export function drawShips(ctx, cam, t, size) {
  for (let i = 0; i < SHIPS.length; i++) {
    const s = shipState(i, t);
    if (!s || s.scale <= 0.01) continue;
    const [x, y] = toScr(cam, s.x, s.y);
    // ángulo en pantalla (la cámara puede rotar apenas)
    const bob = Math.sin(t * 7.3 + i) * 0.04;
    drawShipTop(ctx, x, y, s.ang + (cam.r || 0) + bob, size * s.scale, { t, wake: s.moving ? 1 : 0.35 });
  }
}
