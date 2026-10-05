// Rótulos del mapa: chips pegados a los pines («BUENOS AIRES» chico en el corte y todos los destinos cuando la
// red brilla en map.all) y «TRANSATLÁNTICOS» escrito SOBRE el arco que cruza el Atlántico, anclado a la mitad
// VISIBLE del arco (se desliza por la curva mientras la cámara panea, siempre dentro del área segura).
// Regla de lectura: un rótulo completo nunca queda cortado ni fuera del área segura (x 96–1824, y 54–1026).
import { PAL, rgba } from '../../engine/color.js';
import { E, clamp, pop } from '../../engine/ease.js';
import { drawChip, txt } from '../../engine/text.js';
import { T, toScr, camAt } from './mapcam.js';
import { LEGS } from './route.js';
import { ROUTES } from './world.js';

export const SAFE = { x0: 96, y0: 54, x1: 1824, y1: 1026 };

const chipStyle = (size) => ({
  size, weight: 700, tracking: 0.06, upper: true, bg: rgba(PAL.navy900, 0.9), fg: PAL.white, padX: 0.6, padY: 0.4,
  shadow: { color: rgba(PAL.ink, 0.45), blur: 10, y: 4 }, border: { color: rgba(PAL.aqua300, 0.6), width: 1.5 },
});

/** Caja (pantalla) del chip de un pin: { x, y (ancla), anchor, w, h, box: [x0, y0, x1, y1] }, ya metida en el área segura. */
export function labelBox(text, x, y, pinSize, { side = 'r', size = 22 } = {}) {
  const Tm = txt(text, { size, weight: 700, tracking: 0.06, upper: true });
  const w = Tm.width + 2 * 0.6 * size, h = Tm.capH + 2 * 0.4 * size;
  const off = pinSize * 0.42;
  // 'rd': a la derecha a la altura de la punta del pin (gana aire arriba en la toma amplia)
  const hy = y - pinSize * (side === 'rd' ? -0.05 : 0.62);
  let x0 = side === 'l' ? x - off - w : side === 'u' ? x - w / 2 : x + off;
  let y0 = side === 'u' ? y - pinSize * 1.18 - h : hy - h / 2;
  // margen chico extra para el overshoot del pop
  const m = 4;
  x0 = clamp(x0, SAFE.x0 + m, SAFE.x1 - m - w);
  y0 = clamp(y0, SAFE.y0 + m, SAFE.y1 - m - h);
  return { x: x0, y: y0, w, h, box: [x0, y0, x0 + w, y0 + h] };
}

/** Chip pegado a un pin (side 'l' | 'r' | 'u'), metido en el área segura. */
export function pinLabel(ctx, t, text, x, y, pinSize, { tIn, side = 'r', size = 22, tOut, dur = 0.3 } = {}) {
  if (t < tIn) return;
  const b = labelBox(text, x, y, pinSize, { side, size });
  // el pop crece desde el lado del pin
  const anchor = side === 'l' ? [1, 0.5] : side === 'u' ? [0.5, 1] : [0, 0.5];
  const px = b.x + anchor[0] * b.w, py = b.y + anchor[1] * b.h;
  drawChip(ctx, text, { ...chipStyle(size), t, in: tIn, out: tOut, outDur: 0.16, x: px, y: py, anchor, dur });
}

// ------------------------------------------------------------------ TRANSATLÁNTICOS sobre el arco
const TL = 'TRANSATLÁNTICOS';
const legD = () => LEGS.find((L) => L.id === 'D');
// el rótulo vive en la parte ATLÁNTICA del arco (del Caribe a Gibraltar, punto de paso 6 de la ruta D)
let I_GIB = null;
function gibIndex(L) {
  if (I_GIB !== null) return I_GIB;
  const g = ROUTES.D[6];
  let best = 0, bd = Infinity;
  L.pts.forEach(([x, y], i) => { const d = Math.hypot(x - g[0], y - g[1]); if (d < bd) { bd = d; best = i; } });
  I_GIB = best;
  return best;
}
export const TRANS = { in1: T.trans - 0.27, out1: T.eu + 0.09 };
/** Posición del rótulo en map.all: fracción de la parte atlántica del arco D. */
export const TRANS_MID = 0.56;

const textSize = (z) => Math.round(48 * clamp(0.75 + 0.3 * Math.log2(z), 0.72, 1.15));

/** Centro del rótulo (longitud de arco en px de MAPA) para la cámara c, o null si no entra. */
function centerFor(L, c, wPx) {
  const iG = gibIndex(L);
  const sp = [];
  for (let i = 0; i <= iG; i++) sp.push(toScr(c, L.pts[i][0], L.pts[i][1]));
  // tramo visible más largo dentro de un rectángulo interior (las letras van ~60 px arriba del arco)
  const ok = ([x, y]) => x > SAFE.x0 + 30 && x < SAFE.x1 - 30 && y > SAFE.y0 + 70 && y < SAFE.y1 - 30;
  let best = null, cur = null;
  for (let i = 0; i < sp.length; i++) {
    if (ok(sp[i])) {
      if (!cur) cur = { a: i, b: i };
      cur.b = i;
      if (!best || cur.b - cur.a > best.b - best.a) best = { ...cur };
    } else cur = null;
  }
  if (!best || best.b === best.a) return null;
  // longitudes en pantalla del tramo
  let acc = 0;
  const sAcc = [0];
  for (let i = best.a + 1; i <= best.b; i++) { acc += Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]); sAcc.push(acc); }
  if (acc < wPx + 30) return null;
  const mid = clamp(acc / 2, wPx / 2 + 15, acc - wPx / 2 - 15);
  // pasa a longitud de arco de mapa
  let k = 1;
  while (k < sAcc.length - 1 && sAcc[k] < mid) k++;
  const f = (mid - sAcc[k - 1]) / Math.max(1e-6, sAcc[k] - sAcc[k - 1]);
  const i0 = best.a + k - 1;
  return L.len[i0] + f * (L.len[i0 + 1] - L.len[i0]);
}

/**
 * o.phase2In: inicio del pop en map.all (lo agenda map.js). En map.trans el rótulo sigue la mitad visible del
 * arco (promediada en el tiempo para que se deslice suave); en map.all queda en el medio del Atlántico.
 */
export function drawTransLabel(ctx, cam, t, { phase2In = T.all + 0.1, dim = 0 } = {}) {
  const L = legD();
  if (!L.pts) return;
  const ph1 = t >= TRANS.in1 && t < TRANS.out1 + 0.22;
  const ph2 = t >= phase2In;
  if (!ph1 && !ph2) return;
  const size = textSize(cam.z);
  const Tx = txt(TL, { size, weight: 800, tracking: 0.1 });
  const iG = gibIndex(L);
  let sMap;
  if (ph2) sMap = L.len[iG] * TRANS_MID;
  else {
    // promedio de la mitad visible en t, t−0,05 y t−0,1 (función pura de t: se desliza sin saltos)
    const vals = [];
    for (const dt of [0, 0.05, 0.1, 0.15]) {
      const c = dt ? camAt(t - dt) : cam;
      const v = centerFor(L, c, Tx.width * (dt ? camAt(t - dt).z / cam.z : 1));
      if (v !== null) vals.push(v);
    }
    if (!vals.length) return;
    sMap = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  // polilínea del arco en pantalla con longitudes acumuladas (para ubicar cada letra)
  const sp = L.pts.slice(0, iG + 1).map(([x, y]) => toScr(cam, x, y));
  const acc = [0];
  for (let i = 1; i < sp.length; i++) acc.push(acc[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]));
  // longitud de mapa → de pantalla
  let k = 1;
  while (k < L.len.length - 1 && L.len[k] < sMap) k++;
  const fk = (sMap - L.len[k - 1]) / Math.max(1e-6, L.len[k] - L.len[k - 1]);
  const kk = Math.min(k, acc.length - 1);
  const sc = acc[kk - 1] + fk * (acc[kk] - acc[kk - 1]);
  const total = acc[acc.length - 1];
  const at = (s) => {
    s = clamp(s, 0, total);
    let i = 1;
    while (i < acc.length - 1 && acc[i] < s) i++;
    const f = (s - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
    const [ax, ay] = sp[i - 1], [bx, by] = sp[i];
    return [ax + (bx - ax) * f, ay + (by - ay) * f, Math.atan2(by - ay, bx - ax)];
  };
  const w = size / 48;
  const lift = 20 * w + size * 0.35;
  ctx.save();
  ctx.font = Tx.font;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha *= 1 - dim;
  for (const g of Tx.lines[0].glyphs) {
    const gx = g.x + g.w / 2 - Tx.width / 2;
    // entra escrita de izquierda a derecha y sale igual (escalonado de 1 cuadro por letra)
    let k2;
    if (ph2) k2 = pop(t, phase2In + g.char * 0.002, { dur: 0.17, over: 1.25 });
    else {
      k2 = pop(t, TRANS.in1 + g.char * 0.008, { dur: 0.24, over: 1.25 });
      const q = clamp((t - (TRANS.out1 + g.char * 0.005)) / 0.12);
      k2 *= 1 - E.backIn(2)(q);
    }
    if (k2 <= 0.01) continue;
    const [x, y, ang] = at(sc + gx);
    ctx.save();
    ctx.translate(x - Math.sin(ang) * -lift, y + Math.cos(ang) * -lift);
    ctx.rotate(ang);
    ctx.scale(k2, k2);
    // sombra dura corrida (sin shadowBlur: el desenfoque por glifo rotado es carísimo en Skia)
    ctx.fillStyle = rgba(PAL.ink, 0.6);
    ctx.fillText(g.ch, -g.w / 2 + 1.5, Tx.capH / 2 + 3);
    ctx.fillStyle = PAL.white;
    ctx.fillText(g.ch, -g.w / 2, Tx.capH / 2);
    ctx.restore();
  }
  ctx.restore();
}
