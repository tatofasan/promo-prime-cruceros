// Humo de la chimenea y BOCINAZO del crucero (v2).
//  · Humo: bocanadas ENCADENADAS que nacen pegadas a la boca de la chimenea, crecen, derivan con el viento y se
//    desvanecen; 3 tonos (sombra fría del lado opuesto a la luz, base, filo cálido del lado del sol). Nunca hay un
//    disco suelto: la bocanada más joven siempre está en la boca y las siguientes se solapan.
//  · Bocinazo (drawHorn): mini flash en el silbato, anillo de presión y un CHORRO blanco que sale disparado y
//    enrosca la punta (rulo); después se abre en nube y se lo lleva el viento. Dirección configurable.
// Todo función pura de t. Coordenadas: las del ctx (en drawShip, las locales del barco: eslora 1000).
import { E, TAU, clamp } from '../../engine/ease.js';
import { hash } from '../../engine/noise.js';
import { mixHex } from '../../engine/color.js';
import { rad, sparkle } from '../../engine/draw.js';
import { ca, unit } from '../util.js';
import { blobInto } from '../water.js';
import { shipColors } from './body.js';

/** Tonos del vapor para los colores del barco C. */
function tones(C) {
  return {
    base: mixHex('#FFFFFF', C.key, 0.08),
    shade: mixHex(mixHex(C.whiteShade, '#ffffff', 0.25), C.sky?.light?.shade ?? C.whiteShade, 0.25),
    lit: mixHex(C.rim, '#ffffff', 0.25),
  };
}

/** Pinta una lista de bocanadas [{x, y, r, s}] como UNA masa en 3 tonos (unión: sin solapes que oscurezcan). */
function puffMass(ctx, list, T, light, alpha, t) {
  if (!list.length || alpha <= 0.01) return;
  const [lx, ly] = light;
  const P = new Path2D(), L = new Path2D();
  let avg = 0;
  for (const q of list) avg += q.r;
  const off = (avg / list.length) * 0.28;
  for (const q of list) {
    blobInto(P, q.x, q.y, q.r, q.s, t, 0.16);
    blobInto(L, q.x + lx * q.r * 0.34, q.y + ly * q.r * 0.34, q.r * 0.62, q.s + 7, t, 0.2);
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  // sombra: la masa entera en el tono frío
  ctx.fillStyle = T.shade;
  ctx.fill(P);
  // base: la misma masa corrida hacia la luz (queda la sombra del lado opuesto)
  ctx.save();
  ctx.clip(P);
  ctx.fillStyle = T.base;
  ctx.save();
  ctx.translate(lx * off, ly * off);
  ctx.fill(P);
  ctx.restore();
  // filo cálido del lado del sol
  ctx.fillStyle = ca(T.lit, 0.75);
  ctx.fill(L);
  ctx.restore();
  ctx.restore();
}

/**
 * Humo continuo de la chimenea. o = { x, y (boca), amt 0..1, wind 1, light [x,y], C | preset, scale (px por
 * unidad, para el tamaño del detalle) }. Unidades locales del barco.
 */
export function drawSmoke(ctx, t, o) {
  const amt = o.amt ?? 0;
  if (amt <= 0.01) return;
  const C = o.C ?? shipColors(o.preset ?? 'golden');
  const T = tones(C);
  const light = o.light ? unit(o.light) : [0.6, -0.8];
  const wind = o.wind ?? 1;
  const rate = 5.5, life = 2.6;
  const n = Math.ceil(rate * life);
  const ph = t * rate;
  const base = Math.floor(ph), fr = ph - base;
  const bands = [[], [], []];
  for (let j = 0; j < n; j++) {
    const a = (fr + j) / rate; // edad de la bocanada
    if (a > life) continue;
    const id = base - j;
    const u = a / life;
    const k = 1 - Math.exp(-a * 1.6);
    const x = o.x - wind * (26 * a + 9 * a * a) - 3 * k + (hash(id, 3) - 0.5) * 6 * k;
    const y = o.y - 3 - 30 * k - 5 * a + Math.sin(a * 3 + id) * 2 * k;
    const r = (5 + 17 * Math.sqrt(u) + 4 * hash(id, 4) * u) * (0.8 + 0.2 * amt);
    bands[u < 0.33 ? 0 : u < 0.66 ? 1 : 2].push({ x, y, r, s: 500 + (id % 997) });
  }
  // raíz fija en la boca (la cadena nunca se despega)
  bands[0].push({ x: o.x - 1, y: o.y - 2, r: 5, s: 499 });
  const A = [0.95, 0.7, 0.38];
  const k = 0.55 + 0.45 * Math.min(1, amt);
  for (let b = 2; b >= 0; b--) puffMass(ctx, bands[b], T, light, A[b] * k, t);
}

/**
 * BOCINAZO: drawHorn(ctx, t, tHorn, o). Dibuja donde esté parado el ctx.
 * o = { x, y: silbato · scale 1 (unidades → px: con scale 1 el chorro mide ~115 unidades, 2,2× la chimenea del
 *       barco) · dir (rad; def −2,0 = arriba y hacia popa en las coordenadas locales del barco; HOOK puede
 *       pasar, p. ej., −0,9 en pantalla para sacarlo hacia la derecha) · curl 1 (−1 enrosca al otro lado) ·
 *       wind 1 · light [x,y] · C | preset · alpha }
 * Picos: flash en tHorn + 0,02; chorro completo en tHorn + 0,06 y hasta tHorn + 0,32; nube hasta tHorn + 1,55.
 */
export function drawHorn(ctx, t, tHorn, o = {}) {
  if (tHorn === null || tHorn === undefined) return;
  const dt = t - tHorn;
  if (dt < -0.04 || dt > 1.6) return;
  const C = o.C ?? shipColors(o.preset ?? 'golden');
  const T = tones(C);
  const light = o.light ? unit(o.light) : [0.6, -0.8];
  const S = o.scale ?? 1;
  const dir = o.dir ?? -2.0;
  const cs = o.curl ?? 1;
  const wind = o.wind ?? 1;
  const hx = o.x ?? 0, hy = o.y ?? 0;
  const dx = Math.cos(dir), dy = Math.sin(dir);
  const nx = -dy * cs, ny = dx * cs; // normal hacia donde enrosca
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  // anticipación: el silbato escupe un hilito justo antes
  if (dt < 0) {
    const q = (dt + 0.04) / 0.04;
    puffMass(ctx, [{ x: hx + dx * 4 * S, y: hy + dy * 4 * S, r: 3 * S * q, s: 41 }], T, light, q, t);
    ctx.restore();
    return;
  }
  // 1) anillo de presión (dos, escalonados) y mini flash en el silbato
  for (let i = 0; i < 2; i++) {
    const q = clamp((dt - i * 0.07) / 0.42);
    if (q <= 0 || q >= 1) continue;
    const r = (8 + 120 * E.outCubic(q)) * S;
    ctx.strokeStyle = ca(T.base, 0.8 * (1 - q) * (1 - q));
    ctx.lineWidth = Math.max(1, (5 - 4 * q) * S);
    ctx.beginPath(); ctx.ellipse(hx, hy, r, r * 0.8, dir, 0, TAU); ctx.stroke();
  }
  const fl = Math.exp(-Math.pow((dt - 0.02) / 0.05, 2));
  if (fl > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = 26 * S;
    ctx.fillStyle = rad(ctx, hx, hy, R, [[0, ca(T.lit, 0.8 * fl)], [1, ca(T.lit, 0)]]);
    ctx.fillRect(hx - R, hy - R, R * 2, R * 2);
    ctx.restore();
    sparkle(ctx, hx, hy, 22 * S * fl, { alpha: fl, color: '#ffffff', rot: 0.25 });
  }
  // 2) chorro con rulo: cadena de bocanadas a lo largo del recorrido; el frente avanza muy rápido
  const Lmax = 92, Rc = 27; // tramo recto + radio del rulo (unidades)
  const front = E.outExpo(clamp(dt / 0.06));
  const open = clamp((dt - 0.3) / 1.6);          // la nube se abre y se va
  const fade = clamp(1 - (dt - 0.45) / 1.1);
  const drift = Math.max(0, dt - 0.25);
  const N = 18;
  const list = [];
  for (let i = 0; i < N; i++) {
    const s = i / (N - 1);
    if (s > front + 0.02) break;
    let px, py;
    if (s <= 0.62) {
      const d = (s / 0.62) * Lmax;
      const bend = 0.0025 * d * d * wind; // el viento la dobla
      px = hx + (dx * d + nx * bend) * S; py = hy + (dy * d + ny * bend) * S;
    } else {
      // rulo: la punta se enrosca alrededor de un centro al costado del extremo
      const ex = hx + (dx * Lmax + nx * 0.0025 * Lmax * Lmax * wind) * S, ey = hy + (dy * Lmax + ny * 0.0025 * Lmax * Lmax * wind) * S;
      const cxr = ex + nx * Rc * S, cyr = ey + ny * Rc * S;
      const phi = ((s - 0.62) / 0.38) * Math.PI * 1.35;
      const a0 = Math.atan2(-ny, -nx);
      const ang = a0 + phi * cs * (dx * ny - dy * nx >= 0 ? 1 : -1);
      const rr = Rc * (1 - 0.35 * (s - 0.62) / 0.38);
      px = cxr + Math.cos(ang) * rr * S; py = cyr + Math.sin(ang) * rr * S;
    }
    // después del golpe: deriva con el viento (hacia popa = −x local), sube y se abre
    px += (-wind * (26 * drift + 12 * drift * drift) + (hash(i, 7) - 0.5) * 18 * open) * S;
    py += (-10 * drift - 6 * open * hash(i, 8)) * S;
    const r = (6 + 15 * Math.pow(s, 0.6) + (s > 0.62 ? 4 : 0)) * (1 + 1.3 * open) * S * (0.88 + 0.24 * hash(i, 9));
    list.push({ x: px, y: py, r, s: 700 + i });
  }
  // la base del chorro se corta del silbato cuando deja de soplar
  const cut = clamp((dt - 0.32) / 0.25);
  const shown = list.slice(Math.floor(cut * list.length * 0.5));
  puffMass(ctx, shown, T, light, fade, t);
  ctx.restore();
}
